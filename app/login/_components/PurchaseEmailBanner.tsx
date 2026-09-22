"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Email sources, in priority order:
//   1. sessionStorage rv_purchase_email (legacy @whop/checkout flow, kept for
//      anyone mid-purchase during the rollout)
//   2. ?email= URL param (legacy cross-tab fallback)
//   3. ?payment_id=pay_... from the Whop Elements returnUrl, resolved
//      server-side by /api/whop/lookup-purchase (never exposes the API key)
const STORAGE_KEY = "rv_purchase_email";
const LOOKUP_URL = "/api/whop/lookup-purchase";
const PAYMENT_ID_RE = /^pay_[A-Za-z0-9]+$/;

type Props = {
  // Optional overrides; when omitted the banner reads the URL itself.
  initialEmail?: string | null;
  justPurchased?: boolean;
  // Lets the page hide the always-on warning while this banner is showing.
  onShown?: (shown: boolean) => void;
};

function looksLikeEmail(value: unknown): value is string {
  return typeof value === "string" && value.includes("@") && value.length <= 254;
}

export default function PurchaseEmailBanner({ initialEmail, justPurchased, onShown }: Props) {
  const params = useSearchParams();
  const urlEmail = initialEmail ?? params.get("email");
  const jp = justPurchased || params.get("justpurchased") === "1";
  const rawPaymentId = params.get("payment_id");
  const paymentId = rawPaymentId && PAYMENT_ID_RE.test(rawPaymentId) ? rawPaymentId : null;

  const [email, setEmail] = useState<string | null>(
    looksLikeEmail(urlEmail) ? urlEmail.trim() : null
  );

  // sessionStorage is client-only: read on mount, prefer it over the URL,
  // then clear it so a later visit to /login does not re-show the banner.
  // If neither legacy source has an email and the Elements returnUrl carried
  // a payment id, ask the server to resolve it. The ?payment_id param is left
  // in the URL untouched.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
    if (looksLikeEmail(stored)) {
      setEmail(stored.trim());
      return;
    }
    if (looksLikeEmail(urlEmail) || !paymentId) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${LOOKUP_URL}?payment_id=${encodeURIComponent(paymentId)}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { email?: unknown };
        if (!cancelled && looksLikeEmail(body?.email)) setEmail(body.email.trim());
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
    // urlEmail / paymentId come from the URL and do not change after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = Boolean(email) || jp;
  useEffect(() => {
    onShown?.(shown);
  }, [shown, onShown]);

  if (!shown) return null;

  return (
    <div className="login-purchase-banner" role="status">
      <div className="login-purchase-banner-eyebrow">Payment received</div>
      <p className="login-purchase-banner-body">
        {email ? (
          <>
            You just paid with <b>{email}</b>. Sign in with this exact email.
          </>
        ) : (
          <>
            You just paid - sign in with the exact email you used at checkout. Check your Whop
            receipt if you&apos;re unsure.
          </>
        )}
      </p>
    </div>
  );
}
