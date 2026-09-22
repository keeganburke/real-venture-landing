import { NextResponse } from "next/server";

const WHOP_API_BASE = "https://api.whop.com/api/v1";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get("payment_id");

  if (!paymentId || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) {
    return NextResponse.json({ email: null, error: "invalid_payment_id" }, { status: 400 });
  }

  const apiKey = process.env.WHOP_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ email: null, error: "server_misconfigured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${WHOP_API_BASE}/payments/${paymentId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ email: null, error: "whop_lookup_failed" }, { status: 200 });
    }

    const data = await res.json();
    const email = data?.member?.user?.email ?? data?.user?.email ?? null;
    const validEmail = typeof email === "string" && email.includes("@") ? email : null;

    return NextResponse.json({ email: validEmail }, { status: 200 });
  } catch {
    return NextResponse.json({ email: null, error: "lookup_error" }, { status: 200 });
  }
}
