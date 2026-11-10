export const SESSION_COOKIE_NAME = "rv_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  whopUserId: string;
  exp: number;
  // seconds; tokens made before 2026-11-09 have none (treated as old)
  iat?: number;
};

/** ttlSeconds: shorter for a session given while Whop could not confirm the
    membership (the login callback lets people in when Whop is down), so they
    are checked again soon. Default: the normal 7 days. */
export function sessionCookieOptions(ttlSeconds: number = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: ttlSeconds,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

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

export async function createSessionToken(whopUserId: string, ttlSeconds: number = SESSION_TTL_SECONDS): Promise<string | null> {
  const key = await getHmacKey();
  if (!key) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    whopUserId,
    exp: nowSec + ttlSeconds,
    iat: nowSec,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `${body}.${Buffer.from(signature).toString("base64url")}`;
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  const key = await getHmacKey();
  if (!key) return null;

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

  let payload: SessionPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (typeof payload.whopUserId !== "string" || payload.whopUserId.length === 0) return null;
  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return payload;
}

// ---------------------------------------------------------------------------
// "Finishing your purchase" pass. The login callback gives one to someone who
// just bought but whose membership Whop doesn't list yet: it lets
// /api/auth/whop/purchase-status keep checking Whop for them, and nothing
// else. It is NOT a session: it is signed over "pending." + body, so
// verifySessionToken (which signs the body alone) can never accept it, and
// it lives in its own cookie.
export const PENDING_COOKIE_NAME = "rv_pending_purchase";
export const PENDING_TTL_SECONDS = 30 * 60;

export type PendingPayload = { whopUserId: string; exp: number; since: number };

export async function createPendingToken(whopUserId: string, sinceMs: number = Date.now()): Promise<string | null> {
  const key = await getHmacKey();
  if (!key) return null;
  const payload: PendingPayload = { whopUserId, exp: Math.floor(Date.now() / 1000) + PENDING_TTL_SECONDS, since: sinceMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`pending.${body}`));
  return `${body}.${Buffer.from(signature).toString("base64url")}`;
}

export async function verifyPendingToken(token: string): Promise<PendingPayload | null> {
  const key = await getHmacKey();
  if (!key) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, signature] = parts;
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = new Uint8Array(Buffer.from(signature, "base64url"));
  } catch {
    return null;
  }
  const valid = await crypto.subtle.verify("HMAC", key, signatureBytes, new TextEncoder().encode(`pending.${body}`));
  if (!valid) return null;
  let payload: PendingPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (typeof payload.whopUserId !== "string" || payload.whopUserId.length === 0) return null;
  if (typeof payload.exp !== "number" || payload.exp <= Math.floor(Date.now() / 1000)) return null;
  if (typeof payload.since !== "number") return null;
  return payload;
}

export function pendingCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: PENDING_TTL_SECONDS,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}
