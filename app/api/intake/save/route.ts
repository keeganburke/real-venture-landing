import { NextRequest, NextResponse } from "next/server";
import { getIntakeCookie, setIntakeCookie, type IntakeAnswers } from "../../../../lib/intake-cookie";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";

type FieldSpec =
  | { kind: "text" }
  | { kind: "enum"; values: string[] }
  | { kind: "multi"; values: string[] }
  | { kind: "int"; min: number; max: number };

const FIELD_SPECS: Record<string, FieldSpec> = {
  dream: { kind: "text" },
  hours: { kind: "enum", values: ["under_5", "five_ten", "ten_twenty", "twenty_plus"] },
  tried: {
    kind: "multi",
    values: ["dropshipping", "trading", "reselling", "freelance", "content", "nothing_yet", "other"],
  },
  tried_failure: { kind: "text" },
  worry: { kind: "enum", values: ["time", "money", "fail_again", "consistency"] },
  identity: {
    kind: "enum",
    values: ["full_time", "part_time_gig", "not_working", "student"],
  },
  invest: { kind: "enum", values: ["easy", "manageable", "stretch", "not_sure"] },
  seriousness: { kind: "enum", values: ["curious", "interested", "committed", "all_in"] },
};

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
    case "int":
      return typeof value === "number" &&
        Number.isInteger(value) &&
        value >= spec.min &&
        value <= spec.max
        ? value
        : INVALID;
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
            intake_hours: merged.hours ?? null,
            intake_tried: merged.tried ?? null,
            intake_tried_failure: merged.tried_failure ?? null,
            intake_worry: merged.worry ?? null,
            intake_identity: merged.identity ?? null,
            intake_invest: merged.invest ?? null,
            intake_seriousness: merged.seriousness ?? null,
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
