import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "../../../../lib/session";

export async function GET(request: NextRequest) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? new URL(request.url).origin;
  const response = NextResponse.redirect(`${origin}/`);
  response.cookies.set(SESSION_COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return response;
}

// The hub menu signs out with a fetch POST, then navigates itself.
export async function POST(request: NextRequest) {
  return GET(request);
}
