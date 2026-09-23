import { NextResponse } from "next/server";

const WHOP_API_BASE = "https://api.whop.com/api/v1";

// Allowlist: only these 4 plans can have configs created for them.
// Prevents this endpoint from minting configs for arbitrary plans.
const ALLOWED_PLANS = new Set([
  "plan_2NqC2WJzV87QY", // Base $19.99/mo
  "plan_J8vFpCWME75W3", // Pro $49.99/mo
  "plan_9nyRNbuhQF0pk", // Pro 3-mo $130
  "plan_tfYMBwmuOwuB0", // Pro 6-mo $250
]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ id: null, error: "invalid_json" }, { status: 400 });
  }

  const planId = typeof body === "object" && body !== null ? (body as { planId?: unknown }).planId : null;
  if (typeof planId !== "string" || !ALLOWED_PLANS.has(planId)) {
    return NextResponse.json({ id: null, error: "invalid_plan_id" }, { status: 400 });
  }

  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ id: null, error: "server_misconfigured" }, { status: 500 });
  }

  // Build the redirect_url from the request origin so preview URLs work too.
  // Whop requires https for redirect_url (http only allowed for localhost).
  const origin = new URL(request.url).origin;
  const redirectUrl = `${origin}/login?justpurchased=1`;

  try {
    const res = await fetch(`${WHOP_API_BASE}/checkout_configurations`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        mode: "payment",
        plan_id: planId,
        redirect_url: redirectUrl,
      }),
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const message = data?.error?.message ?? data?.error ?? `whop config create failed (${res.status})`;
      console.error("whop/checkout-config: whop error", message, "planId:", planId);
      return NextResponse.json({ id: null, error: "whop_create_failed" }, { status: 200 });
    }

    const id = data?.id ?? null;
    if (typeof id !== "string" || !id.startsWith("ch_")) {
      console.error("whop/checkout-config: unexpected response shape", data);
      return NextResponse.json({ id: null, error: "unexpected_response" }, { status: 200 });
    }

    return NextResponse.json({ id }, { status: 200 });
  } catch (err) {
    console.error("whop/checkout-config: fetch error", err);
    return NextResponse.json({ id: null, error: "fetch_error" }, { status: 200 });
  }
}
