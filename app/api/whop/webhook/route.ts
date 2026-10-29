import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "../../../../lib/supabase/server";
import { whopAuthHeaders } from "../whop-membership";
import { checkOneFromWebhook } from "../../../../lib/discord-kick";
import { sendDiscordDm } from "../../../../lib/discord-dm";

export const dynamic = "force-dynamic";
// Background work (waitUntil) may outlive the response; give it room.
export const maxDuration = 60;

// POST /api/whop/webhook
//
// Whop event intake. Every event is idempotent via the webhook_events table
// (migration 014). Flows:
//
//   payment_failed_renewal       a subscription cycle charge failed -> DM the member
//   payment_failed_new_checkout  a first-time checkout charge failed -> DM with the join link
//   membership_ended             membership.deactivated / membership.went_invalid
//                                -> live Whop re-check, verdict recorded, then the
//                                   lib/discord-kick check (kicks only when DISCORD_KICK_MODE=live)
//   payment_succeeded            recorded only (ids + billing_reason), no side effects yet
//   membership_updated           recorded only (ids + status), no side effects yet
//   ignored                      every other type: recorded with the payload's top-level keys
//
// Timing: Whop counts anything that is not a 2xx within 5 seconds as a failed
// delivery and disabled this endpoint on 2026-09-02 after 90 of them. So the
// request path does only: verify signature -> parse -> claim the event id in
// webhook_events -> respond 200. Everything else (Whop reads, Discord DM, kick
// check, the metadata update) runs after the response via waitUntil.
//
// Payload shapes: v1 webhooks pinned to a dated API version send { type, data }
// with data.account_id; unpinned (legacy) ones send { action, data } with
// data.company_id. Both are accepted: type ?? action, account_id ?? company_id.
//
// Action switch: WHOP_WEBHOOK_ACTIONS=live enables the Discord DMs. Unset
// means LOG-ONLY: no request to discord.com and no write request to Whop;
// the route only reads Whop and writes webhook_events. Nothing in this file
// kicks anyone or changes a role in either mode.
//
// Signature verification: Whop signs with the Standard Webhooks scheme
// (headers webhook-id / webhook-timestamp / webhook-signature, HMAC-SHA256
// over "<id>.<timestamp>.<body>", base64, "v1," prefix, 5 minute skew).
// Replicated here from the standardwebhooks reference implementation so no
// new package is needed. Prod without WHOP_WEBHOOK_SECRET refuses (503); dev
// without it skips verification so local curl tests work.
//
// After the signature passes, this route ALWAYS returns 200. Whop retries on
// non-2xx, and a retry storm is worse than a logged failure.

// Whop event types (verified against @whop/sdk 0.0.39 webhook types:
// PaymentFailedWebhookEvent.type = "payment.failed", data = Payment with
// billing_reason in subscription_create | subscription_cycle |
// subscription_update | one_time | manual | subscription | null).
const WHOP_EVENT_PAYMENT_FAILED = "payment.failed";
// Same strings Studio's webhook classifies as a deactivation. went_invalid is
// the legacy name, kept as an alias; the current event list has deactivated.
const WHOP_EVENTS_MEMBERSHIP_ENDED = new Set(["membership.deactivated", "membership.went_invalid"]);
const WHOP_EVENT_PAYMENT_SUCCEEDED = "payment.succeeded";
const WHOP_EVENT_MEMBERSHIP_UPDATED = "membership.updated";
const PAYMENT_FAILED_RENEWAL = "payment_failed_renewal";
const PAYMENT_FAILED_NEW_CHECKOUT = "payment_failed_new_checkout";
const MEMBERSHIP_ENDED = "membership_ended";
const PAYMENT_SUCCEEDED = "payment_succeeded";
const MEMBERSHIP_UPDATED = "membership_updated";
const IGNORED = "ignored";

// LOG-ONLY unless explicitly switched to live. Live only unlocks the Discord DMs.
const ACTIONS_LIVE = process.env.WHOP_WEBHOOK_ACTIONS === "live";
const MODE = ACTIONS_LIVE ? "live" : "log_only";

// Membership statuses that mean the membership is over. Anything else keeps the member.
const ENDED_STATUSES = new Set(["canceled", "expired", "drafted"]);

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

const DM_RENEWAL =
  "Hey! Your Real Venture renewal didn't go through - probably just a card thing. " +
  "Update your card here: https://whop.com/manage \u{1F91D}";
const DM_NEW_CHECKOUT =
  "Hey! Looks like your payment didn't go through when you tried to join Real Venture - " +
  "probably just a card thing. Finish joining here: https://realventure.io \u{1F91D}";

type Json = Record<string, unknown>;

const ok = () => NextResponse.json({ ok: true });

// ---------------------------------------------------------------------------
// Signature
// ---------------------------------------------------------------------------

// The Studio webhook passes btoa(secret) to the SDK, which base64-decodes it
// back to the raw secret bytes. Equivalent here: raw utf8 bytes, unless the
// value already carries the standard "whsec_" prefix (then strip + decode).
function webhookKeyBytes(secret: string): Buffer {
  if (secret.startsWith("whsec_")) return Buffer.from(secret.slice(6), "base64");
  return Buffer.from(secret, "utf8");
}

function verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
  const msgId = headers.get("webhook-id");
  const msgTimestamp = headers.get("webhook-timestamp");
  const msgSignature = headers.get("webhook-signature");
  if (!msgId || !msgTimestamp || !msgSignature) return false;

  const ts = parseInt(msgTimestamp, 10);
  const now = Math.floor(Date.now() / 1000);
  if (Number.isNaN(ts)) return false;
  if (now - ts > SIGNATURE_TOLERANCE_SECONDS) return false;
  if (ts > now + SIGNATURE_TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", webhookKeyBytes(secret))
    .update(`${msgId}.${ts}.${rawBody}`, "utf8")
    .digest("base64");
  const expectedBuf = Buffer.from(expected, "utf8");

  for (const versioned of msgSignature.split(" ")) {
    const [version, sig] = versioned.split(",");
    if (version !== "v1" || !sig) continue;
    const sigBuf = Buffer.from(sig, "utf8");
    if (sigBuf.length === expectedBuf.length && timingSafeEqual(sigBuf, expectedBuf)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Payload extraction (defensive: Whop has shipped both "user": "user_x" and
// "user": { id: "user_x" } shapes)
// ---------------------------------------------------------------------------

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object") {
    const id = (value as Json).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

// The company the event belongs to, in either payload shape (pinned v1 sends
// account_id, legacy sends company_id). Recorded in metadata; the membership
// re-check keeps using WHOP_COMPANY_ID from the environment.
function payloadAccountId(data: Json | null): string | null {
  return idOf(data?.account_id) ?? idOf(data?.company_id) ?? idOf(data?.account) ?? idOf(data?.company);
}

type FailedPayment = {
  membershipId: string | null;
  membershipStatus: string | null;
  userId: string | null;
  planId: string | null;
  billingReason: string | null;
  failureMessage: string | null;
};

function extractPayment(data: Json | null): FailedPayment {
  const membership = data?.membership;
  return {
    membershipId: idOf(membership) ?? str(data?.membership_id),
    membershipStatus:
      membership && typeof membership === "object" ? str((membership as Json).status) : null,
    userId: idOf(data?.user) ?? str(data?.user_id),
    planId: idOf(data?.plan) ?? str(data?.plan_id),
    billingReason: str(data?.billing_reason),
    failureMessage: str(data?.failure_message),
  };
}

// subscription_cycle is unambiguously a renewal. subscription_create and
// one_time are unambiguously first purchases. For the ambiguous or missing
// values, a membership already in past_due can only be a renewal failure.
function classifyFailure(p: FailedPayment): typeof PAYMENT_FAILED_RENEWAL | typeof PAYMENT_FAILED_NEW_CHECKOUT {
  if (p.billingReason === "subscription_cycle" || p.billingReason === "subscription_update") {
    return PAYMENT_FAILED_RENEWAL;
  }
  if (p.billingReason === "subscription_create" || p.billingReason === "one_time") {
    return PAYMENT_FAILED_NEW_CHECKOUT;
  }
  if (p.membershipStatus === "past_due") return PAYMENT_FAILED_RENEWAL;
  return PAYMENT_FAILED_NEW_CHECKOUT;
}

// ---------------------------------------------------------------------------
// Side effects (each swallows its own errors and reports a boolean)
// ---------------------------------------------------------------------------

type EndedVerdict =
  | "no_user_id"
  | "keep_check_failed"
  | "keep_no_rows"
  | "keep_filter_untrusted"
  | "keep_has_membership"
  | "would_kick";

// Live read of EVERY membership the user holds with us: no product filter,
// no status filter. Read only. Decides whether the member would be removed;
// this file never acts on it. SINGULAR user_id filter: the plural user_ids is
// ignored by the key's API version and returned strangers' rows, which the
// owner check below turned into keep_filter_untrusted on every event.
async function checkMembershipEnded(
  whopUserId: string
): Promise<{ verdict: EndedVerdict; statuses: string[] }> {
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) {
    console.error("[whop/webhook] WHOP_COMPANY_ID unset, cannot check membership");
    return { verdict: "keep_check_failed", statuses: [] };
  }
  try {
    const params = new URLSearchParams({ company_id: companyId, user_id: whopUserId, first: "100" });
    const res = await fetch(`https://api.whop.com/api/v1/memberships?${params.toString()}`, {
      method: "GET",
      headers: whopAuthHeaders(),
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[whop/webhook] membership check non-2xx", res.status);
      return { verdict: "keep_check_failed", statuses: [] };
    }
    const page = (await res.json().catch(() => null)) as { data?: unknown[] } | null;
    const rows = (Array.isArray(page?.data) ? page.data : []).filter(
      (m): m is Json => !!m && typeof m === "object"
    );
    const statuses = rows.map((m) => str(m.status) ?? "unknown");
    if (rows.length === 0) return { verdict: "keep_no_rows", statuses };
    // If Whop ignored user_id, rows for other people come back. Never trust
    // such a response.
    const foreign = rows.some((m) => {
      const owner = idOf(m.user) ?? str(m.user_id);
      return owner !== null && owner !== whopUserId;
    });
    if (foreign) return { verdict: "keep_filter_untrusted", statuses };
    if (statuses.some((st) => !ENDED_STATUSES.has(st))) return { verdict: "keep_has_membership", statuses };
    return { verdict: "would_kick", statuses };
  } catch (err) {
    console.error("[whop/webhook] membership check threw", err);
    return { verdict: "keep_check_failed", statuses: [] };
  }
}

async function lookupDiscordId(whopUserId: string): Promise<string | null> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("discord_connections")
      .select("discord_user_id")
      .eq("whop_user_id", whopUserId)
      .maybeSingle();
    if (error) {
      console.error("[webhook payment_failed] discord lookup error", error.message);
      return null;
    }
    return str(data?.discord_user_id);
  } catch (err) {
    console.error("[webhook payment_failed] discord lookup threw", err);
    return null;
  }
}

// Resolves who actually receives the DM. WEBHOOK_TEST_DISCORD_ID (dev only,
// unset in prod) redirects every DM to that id, including when the member
// has no Discord connection at all, so the flow is testable end to end.
async function resolveDmTarget(whopUserId: string | null): Promise<string | null> {
  const testId = process.env.WEBHOOK_TEST_DISCORD_ID;
  if (testId) {
    console.log("[webhook payment_failed] TEST MODE: redirecting DM to", process.env.WEBHOOK_TEST_DISCORD_ID);
    return testId;
  }
  if (!whopUserId) return null;
  return lookupDiscordId(whopUserId);
}

// ---------------------------------------------------------------------------
// Idempotency: claim the event id FIRST, then do work. Two concurrent
// deliveries race the insert and exactly one wins (PK violation 23505 on the
// other), which a check-then-insert cannot guarantee. Trade-off: a crash
// mid-processing leaves the row marked handled with pending metadata rather
// than retrying.
// ---------------------------------------------------------------------------

async function claimEvent(eventId: string, eventType: string): Promise<"claimed" | "duplicate" | "error"> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("webhook_events")
      .insert({ event_id: eventId, event_type: eventType, metadata: { pending: true } });
    if (!error) return "claimed";
    if (error.code === "23505") return "duplicate";
    console.error("[webhook payment_failed] webhook_events insert error", error.message);
    return "error";
  } catch (err) {
    console.error("[webhook payment_failed] webhook_events insert threw", err);
    return "error";
  }
}

async function finishEvent(eventId: string, metadata: Json): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("webhook_events")
      .update({ metadata })
      .eq("event_id", eventId);
    if (error) console.error("[webhook payment_failed] webhook_events update error", error.message);
  } catch (err) {
    console.error("[webhook payment_failed] webhook_events update threw", err);
  }
}

// ---------------------------------------------------------------------------
// membership_ended: re-check with Whop and record the verdict as before, then
// hand the member to lib/discord-kick (same rules as the nightly sweep). That
// step kicks only when DISCORD_KICK_MODE=live; otherwise it logs + posts a
// "would kick" line. It is independent of WHOP_WEBHOOK_ACTIONS, which still
// only gates the payment.failed DM. NO DM, NO role change here.
// Runs AFTER the 200 (waitUntil); the event is already claimed.
// ---------------------------------------------------------------------------

async function processMembershipEnded(eventId: string, eventType: string, data: Json | null): Promise<void> {
  // Same field path Studio's extractUserId uses: data.user (string or { id }), then data.user_id.
  const whopUserId = idOf(data?.user) ?? str(data?.user_id);
  let verdict: EndedVerdict = "no_user_id";
  let statuses: string[] = [];
  let discordUserId: string | null = null;
  if (whopUserId) {
    ({ verdict, statuses } = await checkMembershipEnded(whopUserId));
    discordUserId = await lookupDiscordId(whopUserId);
  }

  await finishEvent(eventId, {
    flow: MEMBERSHIP_ENDED,
    mode: MODE,
    event_type: eventType,
    account_id: payloadAccountId(data),
    verdict,
    whop_user_id: whopUserId,
    discord_user_id: discordUserId,
    discord_note: whopUserId && !discordUserId ? "no_discord_link" : undefined,
    statuses_seen: statuses,
    membership_id: idOf(data?.membership) ?? str(data?.membership_id),
    acted: false,
    completed_at: new Date().toISOString(),
  });
  console.log(
    `[whop/webhook] membership_ended ${verdict} whop ${whopUserId ?? "none"} discord ${discordUserId ?? "none"}`
  );

  // Auto-kick check (lib/discord-kick): never throws, logs to discord_kick_log,
  // posts one line to the mod channel. Only members with a Discord link can
  // be evaluated; everyone else is already recorded above as no_discord_link.
  if (whopUserId && discordUserId) {
    const kick = await checkOneFromWebhook(whopUserId, discordUserId);
    console.log(`[whop/webhook] membership_ended kick-check ${kick.action} (${kick.reason}) mode ${kick.mode}`);
  }
}

// ---------------------------------------------------------------------------
// payment.succeeded and membership.updated: RECORD ONLY (ids, status, billing
// reason, payload key names; never emails or amounts). No side effects yet;
// the payment-recovery drip will read these rows later.
// ---------------------------------------------------------------------------

async function processRecordOnly(flow: string, eventId: string, eventType: string, data: Json | null): Promise<void> {
  const membership = data?.membership;
  await finishEvent(eventId, {
    flow,
    mode: MODE,
    event_type: eventType,
    account_id: payloadAccountId(data),
    membership_id: idOf(membership) ?? str(data?.membership_id) ?? (flow === MEMBERSHIP_UPDATED ? str(data?.id) : null),
    user_id: idOf(data?.user) ?? str(data?.user_id),
    plan_id: idOf(data?.plan) ?? str(data?.plan_id),
    status: str(data?.status),
    billing_reason: flow === PAYMENT_SUCCEEDED ? str(data?.billing_reason) : undefined,
    membership_status:
      membership && typeof membership === "object" ? str((membership as Json).status) : undefined,
    data_keys: data ? Object.keys(data).sort() : [],
    completed_at: new Date().toISOString(),
  });
}

// ---------------------------------------------------------------------------
// Everything else: record that it arrived (type + payload KEYS only, never values).
// ---------------------------------------------------------------------------

async function processIgnored(eventId: string, eventType: string, data: Json | null): Promise<void> {
  await finishEvent(eventId, {
    flow: IGNORED,
    mode: MODE,
    event_type: eventType,
    account_id: payloadAccountId(data),
    data_keys: data ? Object.keys(data).sort() : [],
    completed_at: new Date().toISOString(),
  });
}

// payment.failed after the claim: DM (or log-only) + metadata. Behaviour unchanged.
async function processPaymentFailed(eventId: string, flow: string, payment: FailedPayment, data: Json | null): Promise<void> {
  const dmText = flow === PAYMENT_FAILED_RENEWAL ? DM_RENEWAL : DM_NEW_CHECKOUT;
  const target = await resolveDmTarget(payment.userId);
  let dmSent = false;
  let dmWouldSend = false;
  if (!target) {
    console.log("[webhook payment_failed] no Discord connection for", payment.userId, "skipping DM");
  } else if (ACTIONS_LIVE) {
    dmSent = await sendDiscordDm(target, dmText);
  } else {
    // LOG-ONLY: record what would have gone out, touch nothing.
    dmWouldSend = true;
    console.log("[webhook payment_failed] LOG-ONLY: would DM", target, "with", flow);
  }

  await finishEvent(eventId, {
    flow,
    mode: MODE,
    account_id: payloadAccountId(data),
    membership_id: payment.membershipId,
    user_id: payment.userId,
    plan_id: payment.planId,
    billing_reason: payment.billingReason,
    discord_user_id: target,
    dm_sent: dmSent,
    dm_would_send: dmWouldSend,
    dm_text: dmWouldSend ? dmText : undefined,
    test_mode: Boolean(process.env.WEBHOOK_TEST_DISCORD_ID),
    completed_at: new Date().toISOString(),
  });
}

// Hands work to the platform after the response is sent. A rejection is logged
// and never surfaces; the event row keeps { pending: true } in that case.
function runAfterResponse(label: string, work: Promise<void>): void {
  waitUntil(
    work.catch((err) => {
      console.error(`[whop/webhook] background ${label} failed`, err);
    })
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const secret = process.env.WHOP_WEBHOOK_SECRET;

    if (!secret) {
      if (process.env.NODE_ENV === "production") {
        console.error("[whop/webhook] WHOP_WEBHOOK_SECRET unset in production, refusing event");
        return NextResponse.json({ error: "webhook secret not configured" }, { status: 503 });
      }
      console.warn("[whop/webhook] WHOP_WEBHOOK_SECRET unset, skipping signature verification (dev only)");
    } else if (!verifySignature(rawBody, request.headers, secret)) {
      console.error("[whop/webhook] signature verification failed");
      return NextResponse.json({ error: "invalid signature" }, { status: 401 });
    }

    let event: Json;
    try {
      const parsed = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
      event = parsed as Json;
    } catch {
      console.error("[whop/webhook] body is not a JSON object");
      return NextResponse.json({ error: "invalid body" }, { status: 400 });
    }

    // From here on: always 200.
    // Pinned v1 payloads carry `type`; legacy unpinned ones carry `action`.
    const eventType = str(event.type) ?? str(event.action) ?? "unknown";

    // Envelope id is "a unique ID for every single webhook request"; the
    // Standard Webhooks message id header is the fallback.
    const eventId = str(event.id) ?? request.headers.get("webhook-id");
    if (!eventId) {
      console.error("[whop/webhook] no event id, cannot guarantee idempotency, skipping", eventType);
      return ok();
    }

    const data = (event.data && typeof event.data === "object" ? event.data : null) as Json | null;

    // Fast path for every type except payment.failed: claim, respond, then
    // finish in the background.
    if (WHOP_EVENTS_MEMBERSHIP_ENDED.has(eventType)) {
      const claim = await claimEvent(eventId, MEMBERSHIP_ENDED);
      if (claim === "duplicate") console.log("[whop/webhook] membership_ended duplicate delivery", eventId);
      else if (claim === "error") console.error("[whop/webhook] membership_ended idempotency guard unavailable, not recorded", eventId);
      else runAfterResponse(MEMBERSHIP_ENDED, processMembershipEnded(eventId, eventType, data));
      return ok();
    }
    if (eventType === WHOP_EVENT_PAYMENT_SUCCEEDED || eventType === WHOP_EVENT_MEMBERSHIP_UPDATED) {
      const flow = eventType === WHOP_EVENT_PAYMENT_SUCCEEDED ? PAYMENT_SUCCEEDED : MEMBERSHIP_UPDATED;
      const claim = await claimEvent(eventId, flow);
      if (claim === "claimed") runAfterResponse(flow, processRecordOnly(flow, eventId, eventType, data));
      return ok();
    }
    if (eventType !== WHOP_EVENT_PAYMENT_FAILED) {
      const claim = await claimEvent(eventId, IGNORED);
      if (claim === "claimed") runAfterResponse(IGNORED, processIgnored(eventId, eventType, data));
      return ok();
    }

    const payment = extractPayment(data);
    const flow = classifyFailure(payment);

    console.log("[webhook payment_failed] received", {
      eventId,
      flow,
      billingReason: payment.billingReason,
      membershipId: payment.membershipId,
      membershipStatus: payment.membershipStatus,
      userId: payment.userId,
      planId: payment.planId,
      failureMessage: payment.failureMessage,
    });

    const claim = await claimEvent(eventId, flow);
    if (claim === "duplicate") {
      console.log("[webhook payment_failed] duplicate delivery, already handled", eventId);
      return ok();
    }
    if (claim === "error") {
      // Without the guard we cannot prove this is a first delivery. Do not DM
      // on an unguarded event; Whop's own emails still go out.
      console.error("[webhook payment_failed] idempotency guard unavailable, skipping side effects", eventId);
      return ok();
    }

    // Claimed: respond now, DM + metadata after the response.
    runAfterResponse(flow, processPaymentFailed(eventId, flow, payment, data));
    return ok();
  } catch (err) {
    // Never throw out of a webhook. Log and acknowledge.
    console.error("[whop/webhook] unhandled error", err);
    return ok();
  }
}
