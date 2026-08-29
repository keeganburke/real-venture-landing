import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../../../../lib/session";
import { createAdminClient } from "../../../../lib/supabase/server";

function optionalString(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) return undefined;
  return value;
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;
  if (!session) return NextResponse.json({ ok: false }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch {
    return NextResponse.json({ ok: false, error: "bad body" }, { status: 400 });
  }

  const displayName = body.displayName;
  if (typeof displayName !== "string" || displayName.trim().length < 1 || displayName.length > 40) {
    return NextResponse.json({ ok: false, error: "display name required (1-40 chars)" }, { status: 400 });
  }

  const phone = optionalString(body.phone, 30);
  const timezone = optionalString(body.timezone, 60);
  const headline = optionalString(body.headline, 120);
  const bio = optionalString(body.bio, 2000);
  const photoUrl = optionalString(body.photoUrl, 500);
  if ([phone, timezone, headline, bio, photoUrl].includes(undefined)) {
    return NextResponse.json({ ok: false, error: "invalid field" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("member_profiles").upsert(
    {
      whop_user_id: session.whopUserId,
      display_name: displayName.trim(),
      phone: phone ?? null,
      timezone: timezone ?? "America/Los_Angeles",
      headline: headline ?? null,
      bio: bio ?? null,
      photo_url: photoUrl ?? null,
    },
    { onConflict: "whop_user_id" }
  );
  if (error) {
    console.error("profile upsert failed:", error.message);
    return NextResponse.json({ ok: false, error: "save failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
