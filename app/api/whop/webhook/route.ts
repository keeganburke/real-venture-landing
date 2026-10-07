import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "../../../../lib/supabase/server";
import { whopAuthHeaders } from "../whop-membership";

export const dynamic = "force-dynamic";

// POST /api/whop/webhook
//
// Whop event intake. Every event is idempotent via the webhook_events table
// (migration 014). Flows:
//
//   payment_failed_renewal       a subscription cycle charge failed -> DM the member
//   payment_failed_new_checkout  a first-time checkout charge failed -> DM with the join link
//   membership_ended             membership.deactivated / membership.went_invalid
//                                -> live Whop re-check, verdict RECORDED ONLY (no kick here)
//   ignored                      every other type: recorded with the payload's top-level keys
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
// non-2xx, and a retry storm against a handler that adds free days is worse
// than a logged failure.

// Whop event types (verified against @whop/sdk 0.0.39 webhook types:
// PaymentFailedWebhookEvent.type = "payment.failed", data = Payment with
// billing_reason in subscription_create | subscription_cycle |
// subscription_update | one_time | manual | subscription | null).
const WHOP_EVENT_PAYMENT_FAILED = "payment.failed";
// Same strings Studio's webhook classifies as a deactivation.
const WHOP_EVENTS_MEMBERSHIP_ENDED = new Set(["membership.deactivated", "membership.went_invalid"]);
const PAYMENT_FAILED_RENEWAL = "payment_failed_renewal";
const PAYMENT_FAILED_NEW_CHECKOUT = "payment_failed_new_checkout";
const MEMBERSHIP_ENDED = "membership_ended";
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
// this file never acts on it.
async function checkMembershipEnded(
  whopUserId: string
): Promise<{ verdict: EndedVerdict; statuses: string[] }> {
  const companyId = process.env.WHOP_COMPANY_ID;
  if (!companyId) {
    console.error("[whop/webhook] WHOP_COMPANY_ID unset, cannot check membership");
    return { verdict: "keep_check_failed", statuses: [] };
  }
  try {
    const params = new URLSearchParams({ company_id: companyId, first: "100" });
    params.append("user_ids", whopUserId);
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
    // If Whop ignored user_ids (seen on a newer API version), rows for other
    // people come back. Never trust such a response.
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

// Bot DM = open (or reuse) the DM channel, then post to it. 403 on the
// second call means the user has DMs from server members disabled.
async function sendDiscordDm(discordUserId: string, content: string): Promise<boolean> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error("[webhook payment_failed] DISCORD_BOT_TOKEN unset, cannot DM");
    return false;
  }
  const headers = { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" };
  try {
    const chanRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers,
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    if (!chanRes.ok) {
      console.error("[webhook payment_failed] discord open DM failed", chanRes.status, await chanRes.text());
      return false;
    }
    const channelId = idOf(await chanRes.json().catch(() => null));
    if (!channelId) {
      console.error("[webhook payment_failed] discord open DM returned no channel id");
      return false;
    }
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
    });
    if (!msgRes.ok) {
      console.error("[webhook payment_failed] discord send failed", msgRes.status, await msgRes.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("[webhook payment_failed] discord DM threw", err);
    return false;
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
// than retrying, which is the safer failure for a handler that grants days.
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
// membership_ended: re-check with Whop, record the verdict. NO kick, NO DM,
// NO role change, in either mode. The verdict feeds a later, separate step.
// ---------------------------------------------------------------------------

async function handleMembershipEnded(eventId: string, eventType: string, data: Json | null) {
  const claim = await claimEvent(eventId, MEMBERSHIP_ENDED);
  if (claim === "duplicate") {
    console.log("[whop/webhook] membership_ended duplicate delivery", eventId);
    return ok();
  }
  if (claim === "error") {
    console.error("[whop/webhook] membership_ended idempotency guard unavailable, not recorded", eventId);
    return ok();
  }

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
  return ok();
}

// ---------------------------------------------------------------------------
// Everything else: record that it arrived (type + payload KEYS only, never values).
// ---------------------------------------------------------------------------

async function handleIgnored(eventId: string, eventType: string, data: Json | null) {
  const claim = await claimEvent(eventId, IGNORED);
  if (claim !== "claimed") return ok();
  await finishEvent(eventId, {
    flow: IGNORED,
    mode: MODE,
    event_type: eventType,
    data_keys: data ? Object.keys(data).sort() : [],
    completed_at: new Date().toISOString(),
  });
  return ok();
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
    // Same precedence as Studio's webhook: action first, then type.
    const eventType = str(event.action) ?? str(event.type) ?? "unknown";

    // Envelope id is "a unique ID for every single webhook request"; the
    // Standard Webhooks message id header is the fallback.
    const eventId = str(event.id) ?? request.headers.get("webhook-id");
    if (!eventId) {
      console.error("[whop/webhook] no event id, cannot guarantee idempotency, skipping", eventType);
      return ok();
    }

    const data = (event.data && typeof event.data === "object" ? event.data : null) as Json | null;

    if (WHOP_EVENTS_MEMBERSHIP_ENDED.has(eventType)) {
      return handleMembershipEnded(eventId, eventType, data);
    }
    if (eventType !== WHOP_EVENT_PAYMENT_FAILED) {
      return handleIgnored(eventId, eventType, data);
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
      // Without the guard we cannot prove this is a first delivery. Do not
      // grant days or DM on an unguarded event; Whop's own emails still go out.
      console.error("[webhook payment_failed] idempotency guard unavailable, skipping side effects", eventId);
      return ok();
    }

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

    return ok();
  } catch (err) {
    // Never throw out of a webhook. Log and acknowledge.
    console.error("[whop/webhook] unhandled error", err);
    return ok();
  }
}
