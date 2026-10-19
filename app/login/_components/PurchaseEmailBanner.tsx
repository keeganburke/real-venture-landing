"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Shown on /login right after a purchase. Sources, in order:
//   1. ?payment=pay_... (Whop Elements returnUrl) or sessionStorage
//      rv_purchase_payment (written by LandingClient's onComplete), resolved
//      server-side by /api/whop/lookup-purchase so the API key never ships.
//   2. ?email= and sessionStorage rv_purchase_email (the previous checkout's
//      handoff, kept for anyone who paid mid-rollout).
//   3. ?justpurchased=1 alone: the generic "exact email" message.
// ?status= other than "succeeded" (Elements appends failed / canceled on the
// same returnUrl) is never a sale: that shows the "didn't go through" card.
const EMAIL_KEY = "rv_purchase_email";
const PAYMENT_KEY = "rv_purchase_payment";
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
  // Two URL formats land here: the Elements returnUrl (payment=, status=
  // succeeded|failed|canceled) and Whop's dashboard "Checkout redirect"
  // (payment_id=, receipt_id=, checkout_status=success, status=success).
  // Only an explicit failed / canceled is a failure; anything else is a sale.
  const status = params.get("status") ?? params.get("checkout_status");
  const failed = status === "failed" || status === "canceled" || status === "cancelled";
  const rawPaymentId = params.get("payment") ?? params.get("payment_id") ?? params.get("receipt_id");
  const urlPaymentId = rawPaymentId && PAYMENT_ID_RE.test(rawPaymentId) ? rawPaymentId : null;

  const [email, setEmail] = useState<string | null>(
    looksLikeEmail(urlEmail) ? urlEmail.trim() : null
  );
  // True while the payment lookup is in flight.
  const [checking, setChecking] = useState(false);
  // True once a payment id was found anywhere (shows the banner even before
  // the lookup answers).
  const [hadPayment, setHadPayment] = useState(Boolean(urlPaymentId));

  useEffect(() => {
    if (failed) return;

    // Legacy handoff first: it is already the email, no lookup needed.
    let storedEmail: string | null = null;
    try {
      storedEmail = sessionStorage.getItem(EMAIL_KEY);
      sessionStorage.removeItem(EMAIL_KEY);
    } catch {}

    let paymentId = urlPaymentId;
    try {
      const storedPayment = sessionStorage.getItem(PAYMENT_KEY);
      if (!paymentId && storedPayment && PAYMENT_ID_RE.test(storedPayment)) paymentId = storedPayment;
      sessionStorage.removeItem(PAYMENT_KEY);
    } catch {}

    if (paymentId) setHadPayment(true);

    if (paymentId) {
      let cancelled = false;
      setChecking(true);
      (async () => {
        let found: string | null = null;
        try {
          const res = await fetch(`${LOOKUP_URL}?payment=${encodeURIComponent(paymentId)}`, {
            cache: "no-store",
          });
          if (res.ok) {
            const body = (await res.json()) as { email?: unknown };
            if (looksLikeEmail(body?.email)) found = body.email.trim();
          }
        } catch {}
        if (cancelled) return;
        if (found) setEmail(found);
        else if (looksLikeEmail(storedEmail)) setEmail(storedEmail.trim());
        setChecking(false);
      })();
      return () => {
        cancelled = true;
      };
    }

    if (looksLikeEmail(storedEmail)) setEmail(storedEmail.trim());
    // urlPaymentId / failed come from the URL and do not change after mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = failed || Boolean(email) || hadPayment || jp;
  useEffect(() => {
    onShown?.(shown);
  }, [shown, onShown]);

  if (!shown) return null;

  if (failed) {
    return (
      <div className="login-purchase-banner login-purchase-banner--failed" role="alert">
        <div className="login-purchase-banner-eyebrow">Payment not completed</div>
        <p className="login-purchase-banner-body">
          {"Your payment didn't go through. No charge was made. "}
          <a className="login-purchase-banner-retry" href="/?pricing=1">Try again</a>
        </p>
      </div>
    );
  }

  return (
    <div className="login-purchase-banner" role="status">
      <div className="login-purchase-banner-eyebrow">Payment received</div>
      <p className="login-purchase-banner-body">
        {email ? (
          <>
            You just paid with <b>{email}</b>. Sign in with this exact email.
          </>
        ) : (
          <>Sign in with the exact email you just paid with.</>
        )}
      </p>
      {checking && !email && (
        <p className="login-purchase-banner-body">Checking your payment...</p>
      )}
    </div>
  );
}
