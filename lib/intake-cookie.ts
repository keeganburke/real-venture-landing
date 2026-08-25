import type { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const INTAKE_COOKIE_NAME = "rv_intake";
const INTAKE_TTL_SECONDS = 60 * 60 * 24 * 7;

export type IntakeAnswers = {
  experience?: "never" | "1-5" | "6+" | null;
  bottleneck?: "deals" | "buyers" | "funding" | "contracts" | "all" | null;
  hours?: "<5" | "5-15" | "15+" | null;
  goal?: "10k" | "10-30k" | "30k+" | null;
  need?: "community" | "tools" | "access" | null;
  completedAt?: string | null;
};

// Same HMAC-SHA256 signed token pattern as lib/session.ts, keyed by the same
// SESSION_SECRET: base64url(JSON payload) + "." + base64url(signature).
async function getHmacKey(): Promise<CryptoKey | null> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

export async function setIntakeCookie(
  res: NextResponse,
  answers: Partial<IntakeAnswers>
): Promise<boolean> {
  const key = await getHmacKey();
  if (!key) return false;
  const body = Buffer.from(JSON.stringify(answers)).toString("base64url");
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const token = `${body}.${Buffer.from(signature).toString("base64url")}`;
  res.cookies.set(INTAKE_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: INTAKE_TTL_SECONDS,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
  return true;
}

export async function getIntakeCookie(): Promise<IntakeAnswers | null> {
  const key = await getHmacKey();
  if (!key) return null;

  const cookieStore = await cookies();
  const token = cookieStore.get(INTAKE_COOKIE_NAME)?.value;
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;

  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = new Uint8Array(Buffer.from(signature, "base64url"));
  } catch {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(body)
  );
  if (!valid) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    return payload as IntakeAnswers;
  } catch {
    return null;
  }
}
