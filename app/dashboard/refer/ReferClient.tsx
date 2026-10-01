"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// Mirrors GET /api/referral/me. 401 is handled separately (logged out).
type ReferralData =
  | { status: "ok"; link: string; referrals: number; earnings_usd: string; active_referred: number }
  | { status: "under_18" }
  | { status: "no_username" }
  | { status: "error" };

type ViewState = { kind: "loading" } | { kind: "loaded"; data: ReferralData };

// Full earnings, payouts and history live in Whop's affiliate dashboard.
const WHOP_AFFILIATES_URL = "https://whop.com/realventure/affiliates?company_id=biz_CJXSvqDcFQ064Z";

// 50% of the friend's first monthly payment. Crowns and colours match the
// landing page pricing cards (public/crowns/*, .tier.base/.pro/.ultra).
const TIERS = [
  { key: "base", name: "Base", price: "$19.99/mo", earn: "$10", crown: "/crowns/base.png" },
  { key: "pro", name: "Pro", price: "$49.99/mo", earn: "$25", crown: "/crowns/pro.png" },
  { key: "ultra", name: "Ultra", price: "$249.99/mo", earn: "$125", crown: "/crowns/ultra.png" },
] as const;

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through to the legacy path.
  }
  try {
    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

export default function ReferClient() {
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  // True for 2s after a successful copy.
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setView({ kind: "loading" });
    try {
      const res = await fetch("/api/referral/me", { cache: "no-store" });
      if (res.status === 401) {
        // Session expired under us: same destination the dashboard layout uses.
        window.location.assign("/api/auth/whop/start");
        return;
      }
      if (!res.ok) throw new Error("bad status");
      const data = (await res.json()) as ReferralData;
      if (!data || typeof data.status !== "string") throw new Error("bad body");
      setView({ kind: "loaded", data });
    } catch {
      setView({ kind: "loaded", data: { status: "error" } });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  const copyLink = async (link: string) => {
    const ok = await copyText(link);
    if (ok) setCopied(true);
  };

  // Narrowed once here so the JSX below (and its click handlers) can use it.
  const ready = view.kind === "loaded" && view.data.status === "ok" ? view.data : null;

  return (
    <div className="hub2-page">
      <div className="hub2-shell refer">
        <nav className="hub2-nav">
          <Link href="/dashboard" className="hub2-menu">{"←"} Back</Link>
        </nav>

        <header className="hub2-greeting">
          <h1 className="hub2-greeting-name refer-title">Refer &amp; Earn</h1>
          <p className="hub2-greeting-sub refer-sub">Earn $10 to $125 for every friend who joins.</p>
        </header>

        {view.kind === "loading" && <Skeleton />}

        {view.kind === "loaded" && view.data.status === "under_18" && (
          <section className="refer-card refer-notice" role="status">
            <div className="refer-notice-icon" aria-hidden="true">🎁</div>
            <p className="refer-notice-text">
              Referral payouts are for members 18 and older. We&apos;ll let you know when we have
              rewards for you too.
            </p>
          </section>
        )}

        {view.kind === "loaded" && view.data.status === "no_username" && (
          <section className="refer-card refer-notice" role="status">
            <div className="refer-notice-icon" aria-hidden="true">👤</div>
            <p className="refer-notice-text">Set a username on your Whop profile to get your link.</p>
            <a
              className="refer-btn refer-btn-primary"
              href="https://whop.com/settings"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Whop settings
            </a>
            <button type="button" className="refer-btn refer-btn-ghost" onClick={() => void load()}>
              I set it, check again
            </button>
          </section>
        )}

        {view.kind === "loaded" && view.data.status === "error" && (
          <section className="refer-card refer-notice" role="alert">
            <div className="refer-notice-icon" aria-hidden="true">⚠️</div>
            <p className="refer-notice-text">Couldn&apos;t load your referral link. Try again in a minute.</p>
            <button type="button" className="refer-btn refer-btn-primary" onClick={() => void load()}>
              Retry
            </button>
          </section>
        )}

        {ready && (
          <>
            <div className="hub2-section-head">
              <div className="hub2-section-title">Your link</div>
            </div>
            <section className="refer-card">
              <div className="refer-link-box" aria-label="Your referral link">
                <span className="refer-link-text">{ready.link.replace(/^https?:\/\//, "")}</span>
              </div>
              <button
                type="button"
                className={`refer-btn refer-btn-primary${copied ? " is-copied" : ""}`}
                onClick={() => void copyLink(ready.link)}
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
            </section>
          </>
        )}

        <div className="hub2-section-head">
          <div className="hub2-section-title">What you earn</div>
        </div>
        <section className="refer-tiers" aria-label="What you earn per tier">
          {TIERS.map((t) => (
            <div className={`refer-card refer-tier refer-tier-${t.key}`} key={t.key}>
              <img className="refer-tier-crown" src={t.crown} alt="" width={62} height={54} />
              <div className="refer-tier-name">{t.name}</div>
              <div className="refer-tier-price">{t.price}</div>
              <div className="refer-tier-earn">You earn {t.earn}</div>
            </div>
          ))}
        </section>

        {ready && (
          <section className="refer-card refer-statsrow" aria-label="Your referral stats">
            <div className="refer-statsrow-items">
              <div className="refer-statsrow-item">
                <span className="refer-statsrow-label">Friends joined:</span>{" "}
                <span className="refer-statsrow-value">{Math.max(0, Math.floor(ready.referrals))}</span>
              </div>
              <div className="refer-statsrow-item">
                <span className="refer-statsrow-label">Earned:</span>{" "}
                <span className="refer-statsrow-value">{ready.earnings_usd}</span>
              </div>
            </div>
            <a
              className="refer-btn refer-btn-ghost"
              href={WHOP_AFFILIATES_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              See full earnings on Whop
            </a>
          </section>
        )}

        <div className="hub2-section-head">
          <div className="hub2-section-title">How it works</div>
        </div>
        <ol className="refer-steps">
          <li><span className="refer-step-num">1</span><span>Share your link.</span></li>
          <li><span className="refer-step-num">2</span><span>Your friend joins through it.</span></li>
          <li>
            <span className="refer-step-num">3</span>
            <span>You get 50% of their first payment in your Whop balance after 30 days.</span>
          </li>
        </ol>
        <p className="refer-fineprint">
          Refunds in the first 30 days don&apos;t pay out. You must be 18+ to get paid.
          If you post your link publicly, say you get paid if someone joins.
        </p>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="refer-skel" aria-busy="true" aria-label="Loading your referral link">
      <div className="refer-card refer-skel-block" style={{ height: 130 }} />
    </div>
  );
}
