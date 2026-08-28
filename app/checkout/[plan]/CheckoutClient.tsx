"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { WhopCheckoutEmbed } from "@whop/checkout/react";

type PlanConfig = {
  key: "base" | "pro";
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  planId: string;
  whopCheckoutUrl: string; // legacy fallback, unused
};

type AddOn = {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  comingSoon?: boolean;
};

const ADDONS: AddOn[] = [
  { id: "call-william", title: "1-on-1 with William", subtitle: "45-min strategy call", price: "$249" },
  { id: "call-keegan", title: "1-on-1 with Keegan", subtitle: "45-min systems review", price: "$249" },
  { id: "playbook", title: "Wholesaling Playbook PDF", subtitle: "The exact playbook we use", price: "$39", comingSoon: true },
];

export default function CheckoutClient({ plan }: { plan: PlanConfig }) {
  const router = useRouter();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (checkoutOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [checkoutOpen]);

  // Close on Escape
  useEffect(() => {
    if (!checkoutOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCheckoutOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [checkoutOpen]);

  const toggleAddon = (id: string) => {
    setAdded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleComplete = (planId: string, receiptId?: string) => {
    // Fires once on success; Whop guarantees onComplete after payment.
    // Redirect to /login so the user can OAuth in and land in the dashboard.
    console.log("Whop checkout complete", { planId, receiptId });
    router.push("/login?justpurchased=1");
  };

  return (
    <div className="co-page">
      <div className="co-shell">

        <div className="co-topbar">
          <Link href="/" className="co-back">
            <span aria-hidden="true">←</span>
            <span>Back to plans</span>
          </Link>
        </div>

        <header className="co-header">
          <div className="co-eyebrow">Premium membership</div>
          <h1 className="co-title">Join Real Venture</h1>
          <div className="co-steps">
            <span className="co-step">Choose your plan</span>
            <span className="co-step-dot" aria-hidden="true">·</span>
            <span className="co-step">Cancel anytime</span>
            <span className="co-step-dot" aria-hidden="true">·</span>
            <span className="co-step">Secured by Whop</span>
          </div>
        </header>

        <div className="co-progress" aria-hidden="true">
          <div className="co-progress-fill"></div>
        </div>

        <section className="co-plan-summary">
          <div className="co-plan-left">
            <div className="co-plan-name">{plan.name}</div>
            <div className="co-plan-tagline">{plan.tagline}</div>
          </div>
          <div className="co-plan-right">
            <div className="co-plan-price">{plan.price}</div>
            <div className="co-plan-cadence">{plan.cadence}</div>
          </div>
        </section>

        <section className="co-addons">
          <div className="co-addons-head">
            <h2 className="co-addons-title">Add to your plan?</h2>
            <p className="co-addons-sub">
              {plan.name} · {plan.price} {plan.cadence} · optional one-time add-ons
            </p>
          </div>

          <div className="co-addons-list">
            {ADDONS.map((addon) => {
              const isAdded = added.has(addon.id);
              return (
                <div key={addon.id} className={`co-addon${isAdded ? " is-added" : ""}${addon.comingSoon ? " is-soon" : ""}`}>
                  <div className="co-addon-body">
                    <div className="co-addon-title">{addon.title}</div>
                    <div className="co-addon-sub">{addon.subtitle}</div>
                  </div>
                  <div className="co-addon-right">
                    <div className="co-addon-price">{addon.price}</div>
                    {addon.comingSoon ? (
                      <button type="button" className="co-addon-btn is-disabled" disabled>
                        Coming soon
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`co-addon-btn${isAdded ? " is-added" : ""}`}
                        onClick={() => toggleAddon(addon.id)}
                      >
                        {isAdded ? "Added ✓" : "Add"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <button
          type="button"
          className="co-checkout-cta"
          onClick={() => setCheckoutOpen(true)}
        >
          <span>Continue to checkout</span>
          <span aria-hidden="true">→</span>
        </button>

        <p className="co-checkout-note">
          Add-ons above are optional. You can skip straight to checkout.
        </p>

      </div>

      {checkoutOpen && (
        <div
          className="co-modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCheckoutOpen(false);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Complete your purchase"
        >
          <div className="co-modal">
            <button
              type="button"
              className="co-modal-close"
              onClick={() => setCheckoutOpen(false)}
              aria-label="Close checkout"
            >
              ✕
            </button>
            <div className="co-modal-body">
              <WhopCheckoutEmbed
                planId={plan.planId}
                theme="dark"
                themeOptions={{
                  backgroundColor: "#0f0f12",
                  accentColor: "#E5A544",
                  borderRadius: 12,
                }}
                skipRedirect
                onComplete={handleComplete}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
