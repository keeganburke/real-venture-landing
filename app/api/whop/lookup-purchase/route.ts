import { NextResponse } from "next/server";

// /login banner helper for the Whop Elements checkout. The element redirects
// the buyer to /login?justpurchased=1&payment=pay_...&status=succeeded, and
// the page asks here for the email that payment was made with so the banner
// can say "sign in with this exact email". Server side only: WHOP_API_KEY
// never reaches the browser, and nothing here logs the key or the email.
export const dynamic = "force-dynamic";

const WHOP_API_BASE = "https://api.whop.com/api/v1";
const PAYMENT_ID_RE = /^pay_[A-Za-z0-9]+$/;
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const PAID_STATUSES = new Set(["paid", "succeeded"]);

function nothing(status = 200) {
  return NextResponse.json({ email: null }, { status });
}

function idOf(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

function toMs(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string") {
    const n = Number(value);
    if (Number.isFinite(n) && value.trim() !== "") return n < 1e12 ? n * 1000 : n;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentId =
    searchParams.get("payment") ?? searchParams.get("payment_id") ?? searchParams.get("receipt_id");
  if (!paymentId || !PAYMENT_ID_RE.test(paymentId)) {
    return nothing(400);
  }

  const apiKey = process.env.WHOP_API_KEY;
  const productId = process.env.WHOP_PRODUCT_ID;
  if (!apiKey || !productId) {
    console.error("[whop/lookup-purchase] WHOP_API_KEY or WHOP_PRODUCT_ID unset");
    return nothing(500);
  }

  try {
    const res = await fetch(`${WHOP_API_BASE}/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.error("[whop/lookup-purchase] whop read failed", res.status);
      return nothing();
    }
    const data = (await res.json()) as Record<string, unknown>;

    const status = typeof data.status === "string" ? data.status : "";
    const paidProduct = idOf(data.product_id) ?? idOf(data.product);
    const paidAt = toMs(data.paid_at) ?? toMs(data.created_at);
    const fresh = paidAt !== null && Date.now() - paidAt >= 0 && Date.now() - paidAt <= MAX_AGE_MS;

    if (!PAID_STATUSES.has(status) || paidProduct !== productId || !fresh) {
      return nothing();
    }

    const email = data.customer_email;
    if (typeof email !== "string" || !email.includes("@") || email.length > 254) {
      return nothing();
    }
    return NextResponse.json({ email }, { status: 200 });
  } catch {
    console.error("[whop/lookup-purchase] lookup threw");
    return nothing();
  }
}
