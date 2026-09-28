import { NextRequest, NextResponse } from "next/server";
import { getIntakeCookie, setIntakeCookie, type IntakeAnswers } from "../../../../lib/intake-cookie";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";

type FieldSpec =
  | { kind: "text" }
  | { kind: "enum"; values: string[] }
  | { kind: "multi"; values: string[] }
  | { kind: "int"; min: number; max: number };

// 7-question flow (migrations 021 + 022 add the new columns). The old keys
// hours / identity / invest / seriousness / worry are no longer accepted;
// their DB columns keep historical data and stay null for new rows.
const FIELD_SPECS: Record<string, FieldSpec> = {
  dream: { kind: "text" },
  commitment_min: { kind: "enum", values: ["15", "30", "60", "120"] },
  tried: {
    kind: "multi",
    values: ["drop_shipping", "trading", "reselling", "freelance", "content", "nothing", "other"],
  },
  tried_failure: { kind: "text" },
  situation: { kind: "enum", values: ["full_time", "part_time", "not_working", "in_school"] },
  seriousness_scale: { kind: "int", min: 1, max: 10 },
  seriousness_followup: { kind: "text" },
  // Age has no floor or ceiling (migration 022 dropped the CHECK); digits only,
  // capped at the Postgres int4 maximum so the insert can never overflow.
  age: { kind: "int", min: 0, max: 2147483647 },
  phone: { kind: "text" },
};

// Phone is optional free text; when present it must look like a phone number
// (digits, spaces, + ( ) - .) with at least 10 digits, at most 30 chars.
function validPhone(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed === "") return true;
  return trimmed.length <= 30 && /^[0-9+()\-.\s]+$/.test(trimmed) && trimmed.replace(/\D/g, "").length >= 10;
}

const MAX_TEXT = 2000;

// Returns the validated value, or the symbol INVALID.
const INVALID = Symbol("invalid");
function validate(spec: FieldSpec, value: unknown): unknown | typeof INVALID {
  if (value === null) return null;
  switch (spec.kind) {
    case "text":
      return typeof value === "string" && value.length <= MAX_TEXT ? value : INVALID;
    case "enum":
      return typeof value === "string" && spec.values.includes(value) ? value : INVALID;
    case "multi":
      return Array.isArray(value) &&
        value.every((v) => typeof v === "string" && spec.values.includes(v))
        ? value
        : INVALID;
    case "int": {
      // Accept a number or a digit string (the inputs are text fields), then
      // coerce to an integer and range-check.
      const n =
        typeof value === "number"
          ? value
          : typeof value === "string" && /^\d+$/.test(value.trim())
            ? Number(value.trim())
            : NaN;
      return Number.isInteger(n) && n >= spec.min && n <= spec.max ? n : INVALID;
    }
  }
}

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const incoming: Partial<IntakeAnswers> = {};
  for (const [field, spec] of Object.entries(FIELD_SPECS)) {
    if (!(field in body)) continue;
    const result = validate(spec, body[field]);
    if (result === INVALID) {
      return NextResponse.json({ ok: false, error: `invalid ${field}` }, { status: 400 });
    }
    (incoming as Record<string, unknown>)[field] = result;
  }

  if ("phone" in incoming) {
    if (!validPhone(incoming.phone)) {
      return NextResponse.json({ ok: false, error: "invalid phone" }, { status: 400 });
    }
    const trimmed = typeof incoming.phone === "string" ? incoming.phone.trim() : "";
    incoming.phone = trimmed === "" ? null : trimmed;
  }

  const existing = (await getIntakeCookie()) ?? {};
  const merged: Partial<IntakeAnswers> = { ...existing, ...incoming };

  const complete = body.complete === true;
  if (complete) merged.completedAt = new Date().toISOString();
  if (body.tourDone === true) merged.tourCompletedAt = new Date().toISOString();

  // On completion, mirror the answers into member_profiles. The cookie stays
  // the gating source of truth (dashboard/layout.tsx reads completedAt from
  // it); these columns are the durable, queryable copy.
  if (complete) {
    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySessionToken(token) : null;
    if (session) {
      try {
        const supabase = createAdminClient();
        const { error: upsertError } = await supabase.from("member_profiles").upsert(
          {
            whop_user_id: session.whopUserId,
            intake_dream: merged.dream ?? null,
            intake_tried: merged.tried ?? null,
            intake_tried_failure: merged.tried_failure ?? null,
            intake_situation: merged.situation ?? null,
            intake_seriousness_scale: merged.seriousness_scale ? Number(merged.seriousness_scale) : null,
            intake_seriousness_followup: merged.seriousness_followup ?? null,
            intake_age: merged.age ? Number(merged.age) : null,
            whop_commitment_min: merged.commitment_min ? Number(merged.commitment_min) : null,
            whop_phone: merged.phone ?? null,
            intake_completed_at: new Date().toISOString(),
          },
          { onConflict: "whop_user_id" }
        );
        if (upsertError) {
          console.error("[intake/save] supabase upsert failed", upsertError.message);
          // Don't fail the request -- cookie is source of truth for gating.
        }
      } catch (err) {
        console.error("[intake/save] supabase upsert threw", err);
      }
    }
  }

  const response = complete
    ? NextResponse.json({ ok: true, redirect: "/dashboard" })
    : NextResponse.json({ ok: true });

  const signed = await setIntakeCookie(response, merged);
  if (!signed) return NextResponse.json({ ok: false }, { status: 500 });

  return response;
}
