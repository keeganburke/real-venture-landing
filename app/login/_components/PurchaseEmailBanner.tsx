"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

// Written by LandingClient's handleCheckoutComplete right after the embedded
// Whop checkout succeeds. sessionStorage is the primary source; the ?email=
// param is the fallback when the flow crosses tabs.
const STORAGE_KEY = "rv_purchase_email";

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

  const [email, setEmail] = useState<string | null>(
    looksLikeEmail(urlEmail) ? urlEmail.trim() : null
  );

  // sessionStorage is client-only: read on mount, prefer it over the URL,
  // then clear it so a later visit to /login does not re-show the banner.
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (looksLikeEmail(stored)) setEmail(stored.trim());
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
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
