import { NextRequest, NextResponse } from "next/server";
import { getIntakeCookie, setIntakeCookie, type IntakeAnswers } from "../../../../lib/intake-cookie";

const FIELD_VALUES: Record<string, readonly string[]> = {
  experience: ["never", "1-5", "6+"],
  bottleneck: ["deals", "buyers", "funding", "contracts", "all"],
  hours: ["<5", "5-15", "15+"],
  goal: ["10k", "10-30k", "30k+"],
  need: ["community", "tools", "access"],
};

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const incoming: Partial<IntakeAnswers> = {};
  for (const [field, allowed] of Object.entries(FIELD_VALUES)) {
    if (!(field in body)) continue;
    const value = body[field];
    if (value !== null && !(typeof value === "string" && allowed.includes(value))) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }
    (incoming as Record<string, string | null>)[field] = value as string | null;
  }

  const existing = (await getIntakeCookie()) ?? {};
  const merged: Partial<IntakeAnswers> = { ...existing, ...incoming };

  const complete = body.complete === true;
  if (complete) merged.completedAt = new Date().toISOString();

  const response = complete
    ? NextResponse.json({ ok: true, redirect: "/dashboard" })
    : NextResponse.json({ ok: true });

  const signed = await setIntakeCookie(response, merged);
  if (!signed) return NextResponse.json({ ok: false }, { status: 500 });

  return response;
}
