export const SESSION_COOKIE_NAME = "rv_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

export type SessionPayload = {
  whopUserId: string;
  exp: number;
};

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    maxAge: SESSION_TTL_SECONDS,
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

export async function createSessionToken(whopUserId: string): Promise<string | null> {
  const key = await getHmacKey();
  if (!key) return null;
  const payload: SessionPayload = {
    whopUserId,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
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
