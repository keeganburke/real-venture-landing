"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import NavDrawer from "./components/NavDrawer";
import CtaStrip from "./components/CtaStrip";
import TrustRow from "./components/TrustRow";
import SectionHead from "./components/SectionHead";
import PayoutCarousel from "./components/PayoutCarousel";
import VideoWalkthrough from "./components/VideoWalkthrough";
import Reviews from "./components/Reviews";
import Timeline from "./components/Timeline";
import { REVIEW_STATS } from "./lib/whop-reviews";

const LP_COMPARE_BAD = [
  "Watch YouTube for hours without taking action",
  "Trying to piece all the information together yourself",
  "Getting stuck with nowhere to ask questions",
  "No idea how to actually spot a deal",
  "Never talked to a real cash buyer, no reliable path to finding buyers",
  "Quit after one week because it seems hopeless",
];

const LP_COMPARE_GOOD = [
  "Direct access to William + Keegan every day",
  "Step-by-step 14-day sprint with clear checkpoints",
  "Live Q&A calls 7x/week + Discord 24/7",
  "Deal analyzer + contract templates ready",
  "Proven strategies to find buyers from the founders",
  "Countless testimonials and students actually getting paid",
  "Starting at the same price as your DoorDash order",
];

const LP_STORIES = [
  {
    id: "dylan",
    name: "Dylan",
    age: 20,
    videoId: "1221681436",
    amount: "$42,000",
    blurb: "Full-time college student with a part-time job.",
  },
  {
    id: "yves",
    name: "Yves",
    age: 21,
    videoId: "1197200708",
    amount: "$11,000",
    blurb: "Was working 70 hours a week in fast food.",
  },
  {
    id: "zach",
    name: "Zach",
    age: 23,
    videoId: "1197200691",
    amount: "$6,000",
    blurb: "Doorman. Made his first $6K in 45 days.",
  },
];


const PLANS = {
  base: {
    key: "base" as const,
    name: "Base",
    price: "$19.99",
    cadence: "per month",
    tagline: "The core wholesaling toolkit",
    planId: "plan_2NqC2WJzV87QY",
    crownColor: "blue" as const,
  },
  pro: {
    key: "pro" as const,
    name: "Pro",
    price: "$49.99",
    cadence: "per month",
    tagline: "Everything to close your first deal fast",
    planId: "plan_J8vFpCWME75W3",
    crownColor: "gold" as const,
  },
};

// Pro billing terms: monthly, or 3 months at $130 (saves $20 vs 3 x $49.99).
const PRO_TERMS = {
  monthly: { planId: "plan_J8vFpCWME75W3", amount: "49.99", price: "$49.99", cadence: "per month" },
  quarterly: { planId: "plan_9nyRNbuhQF0pk", amount: "130", price: "$130", cadence: "per 3 months" },
} as const;

// Checkout-header copy for the selected plan. Price lives in the name line, so
// the tile is a single stacked block rather than an info/price split.
// Same feature copy as the tier cards on the pricing step, so the two views
// can never drift.
const BASE_FEATURES = [
  "Live coaching 7x/week",
  "JV deals, keep 50%",
  "Real Venture Studio (all-in-one software)",
  "Buyer network access",
  "Full course library",
  "Contract templates",
  "Proof of Funds letters",
  "Deal Manager pipeline",
  "Call recordings",
  "LLC and Bank Playbook",
];

const PRO_FEATURES = [
  "Everything in Base",
  "JV deals, keep 60%",
  "Real Venture Studio Pro (everything unlocked)",
  "Contract generator (auto fill)",
  "Advanced course modules",
  "First look at incoming buyers",
  "Priority DM + Deal support",
];

type PlanCopy = {
  name: string;
  tagline: string;
  accent: "blue" | "gold";
  features: string[];
};

const PLAN_COPY: Record<"base" | "pro" | "pro3", PlanCopy> = {
  base: {
    name: "Base - $19.99/mo",
    tagline: "Everything you need to close your first $10K deal.",
    accent: "blue",
    features: BASE_FEATURES,
  },
  pro: {
    name: "Pro - $49.99/mo",
    tagline: "Everything you need to close your first $10K deal, with extra support included.",
    accent: "gold",
    features: PRO_FEATURES,
  },
  pro3: {
    name: "Pro - $130 for 3 months",
    tagline: "Everything you need to close your first $10K deal, with extra support included. Save $20 vs monthly.",
    accent: "gold",
    features: PRO_FEATURES,
  },
};

// How many features show before the expander.
const FEATURE_PREVIEW = 3;

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

type Props = {
  // "free" switches the hero; "pro" keeps the default hero but hides every
  // tier except Pro in both pricing sites (phone-setter close-protection
  // page at /pro). Everything else is shared, so the routes cannot drift.
  variant: "default" | "free" | "pro";
};

// Whop OAuth failure codes land the user back on "/" with ?auth=<code>.
// Without this banner the page looks like a silent redirect loop.
const AUTH_MESSAGES: Record<string, string> = {
  state_mismatch:
    "Sign-in got interrupted. Please try again. If you opened this from Instagram, TikTok, or another app, tap the ••• menu and choose \"Open in Safari\" first.",
  whop_error: "Whop couldn't complete sign-in. Please try again in a minute.",
  denied:
    "That Whop account doesn't have an active membership. Make sure you're signing in with the same email you paid with.",
  missing_code: "Sign-in got interrupted. Please try again.",
};

export default function LandingClient({ variant }: Props) {
  const proOnly = variant === "pro";
  const router = useRouter();
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  // Tracked separately from the message so "denied" (wrong email after
  // checkout) can render the loud red variant instead of the subtle banner.
  const [authCode, setAuthCode] = useState<string | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);
  // /free hero: "I'll pick up" commitment modal (call-path timeline).
  const [callModalOpen, setCallModalOpen] = useState(false);
  useEffect(() => {
    if (!callModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCallModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [callModalOpen]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 2-step wizard inside the pricing modal: tiers -> embedded checkout.
  const [step, setStep] = useState<"pricing" | "checkout">("pricing");
  const [selectedPlan, setSelectedPlan] = useState<"base" | "pro" | null>(null);
  const [proTerm, setProTerm] = useState<"monthly" | "quarterly">("monthly");
  const [featuresOpen, setFeaturesOpen] = useState(false);

  // Surface OAuth failures redirected here by /api/auth/whop/callback.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("auth");
    if (!code) return;
    setAuthNotice(AUTH_MESSAGES[code] ?? "Sign-in didn't complete. Please try again.");
    setAuthCode(code);
  }, []);

  const dismissAuthNotice = () => {
    setAuthNotice(null);
    setAuthCode(null);
    const params = new URLSearchParams(window.location.search);
    params.delete("auth");
    const rest = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (rest ? "?" + rest : ""));
  };

  // Deep link: /?pricing=1 opens the modal; &plan=base|pro (the old /checkout
  // routes redirect here) jumps straight to checkout.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pricing") === "1") {
      setPricingOpen(true);
      const planParam = params.get("plan");
      if (planParam === "base" || planParam === "pro") {
        setSelectedPlan(planParam);
        setStep("checkout");
      }
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPricingOpen(false);
        setStep("pricing");
        setSelectedPlan(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    document.body.style.overflow = pricingOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [pricingOpen]);

  const openPricing = () => setPricingOpen(true);
  const closePricing = () => {
    setPricingOpen(false);
    setStep("pricing");
    setSelectedPlan(null);
  };

  // Inline pricing-section CTAs: open the modal directly at checkout.
  const openPricingAt = (plan: "base" | "pro") => {
    setSelectedPlan(plan);
    setStep("checkout");
    setPricingOpen(true);
  };

  const choosePlan = (plan: "base" | "pro") => {
    setSelectedPlan(plan);
    setStep("checkout");
  };

  const handleCheckoutComplete = (planId: string, receiptId?: string) => {
    // Fires once on payment success; close the modal and send the user to
    // OAuth so they land in the dashboard.
    console.log("Whop checkout complete", { planId, receiptId });
    closePricing();
    router.push("/login?justpurchased=1");
  };

  // Checkout target: Base is monthly-only; Pro follows the selected term.
  const modalTitle = selectedPlan === "pro" ? "Join Real Venture Pro" : "Join Real Venture";

  // pro splits into monthly / quarterly copy; base has one line.
  const planCopy =
    selectedPlan === "pro"
      ? proTerm === "quarterly"
        ? PLAN_COPY.pro3
        : PLAN_COPY.pro
      : PLAN_COPY.base;

  const activePlan = selectedPlan
    ? selectedPlan === "pro"
      ? { ...PLANS.pro, ...PRO_TERMS[proTerm] }
      : PLANS.base
    : null;

  const toggleDrawer = () => setDrawerOpen((open) => !open);
  const closeDrawer = () => setDrawerOpen(false);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="wrap">
        {authNotice && authCode === "denied" && (
          <div className="lp-auth-warning" role="alert">
            <div className="lp-auth-warning-icon" aria-hidden="true">{"\u{1F6D1}"}</div>
            <div className="lp-auth-warning-body">
              <div className="lp-auth-warning-title">WRONG EMAIL</div>
              <p className="lp-auth-warning-copy">
                It looks like you tried to log in, but that email doesn&apos;t have an active
                membership.
              </p>
              <p className="lp-auth-warning-copy lp-auth-warning-cta">
                Sign out of Whop and sign back in with the <strong>EXACT</strong> email you used to
                buy.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissAuthNotice}
              aria-label="Dismiss"
              className="lp-auth-warning-dismiss"
            >
              {"\u00d7"}
            </button>
          </div>
        )}
        {authNotice && authCode !== "denied" && (
          <div
            role="alert"
            style={{
              position: "relative",
              zIndex: 120,
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              margin: "0 auto",
              maxWidth: 1200,
              padding: "14px 18px",
              background: "rgba(245,197,96,0.08)",
              borderTop: "2px solid #E5B547",
              borderBottom: "1px solid rgba(245,197,96,0.25)",
              fontFamily: '"Inter", sans-serif',
              fontSize: 13.5,
              lineHeight: 1.55,
              color: "rgba(255,232,154,0.95)",
            }}
          >
            <span style={{ flex: 1, minWidth: 0 }}>{authNotice}</span>
            <button
              type="button"
              onClick={dismissAuthNotice}
              aria-label="Dismiss"
              style={{
                flexShrink: 0,
                width: 24,
                height: 24,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "none",
                color: "rgba(255,255,255,0.75)",
                fontSize: 12,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {"\u2715"}
            </button>
          </div>
        )}
        <nav className="lp-nav">
          <div className="lp-nav-inner">
            <div className="lp-nav-pill">
              <button
                className="lp-nav-segment"
                onClick={toggleDrawer}
                aria-label="Menu"
                aria-expanded={drawerOpen}
              >
                <span className={`lp-burger${drawerOpen ? " open" : ""}`}>
                  <span />
                  <span />
                  <span />
                </span>
                <span className="lp-nav-label">MENU</span>
              </button>
              <span className="lp-nav-divider" />
              <button
                className="lp-nav-segment lp-nav-logo-seg"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                aria-label="Real Venture, back to top"
              >
                <img className="lp-nav-logo" src="/logo.png" alt="Real Venture" width={44} height={44} />
              </button>
              <span className="lp-nav-divider" />
              <a className="lp-nav-segment" href="/login">
                <svg className="lp-user-icn" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                <span className="lp-nav-label">LOG IN</span>
              </a>
            </div>
          </div>
        </nav>

        <NavDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          onNavigate={(id) => {
            closeDrawer();
            scrollToSection(id);
          }}
          onPricing={() => {
            closeDrawer();
            openPricing();
          }}
        />

        {variant === "free" ? (
          <section className="lp-hero lp-hero-free">
            <div className="shell">
              {/* "You're in" confirmation flash — fades in, holds, fades out.
                  Pure CSS lifecycle; stays in flow at opacity 0 afterwards so
                  nothing shifts. Hidden entirely under reduced motion. */}
              <div className="lp-hero-yourein" aria-hidden="true">{"🎉 You're in!"}</div>
              <h1 className="lp-hero-h">
                Your <span className="lp-hero-h-em">Secured Wholesaling</span> Blueprint
              </h1>
              {/* Call-expectation callout — the page's #1 job right after
                  opt-in is getting this call ANSWERED. */}
              <div className="lp-hero-callout">
                <p className="lp-hero-callout-main">
                  {"📞 We're calling you in a few minutes, likely from an unknown number. That's us."}
                </p>
                <p className="lp-hero-callout-sub">
                  {"Pick up, we're here to help you get your first deal."}
                </p>
              </div>
              <div className="lp-hero-video">
                <iframe
                  src="https://player.vimeo.com/video/1193039444?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&muted=1&playsinline=1"
                  allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  webkit-playsinline="true"
                  title="Secured Wholesaling Blueprint"
                />
              </div>
              <button
                type="button"
                className="lp-hero-commit"
                onClick={() => setCallModalOpen(true)}
              >
                {"🙋 I'll pick up when you call"}
              </button>
              <p className="lp-hero-cap">{"Watch this first. It's the same method behind every deal below."}</p>
              <div className="lp-hero-scrollcue">
                <span>Want the whole system? Keep scrolling.</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>

              {/* Commitment modal — vertical call-path timeline. */}
              {callModalOpen && (
                <div className="lp-callmodal-overlay" onClick={() => setCallModalOpen(false)}>
                  <div
                    className="lp-callmodal"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Call path"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="lp-callmodal-close"
                      aria-label="Close"
                      onClick={() => setCallModalOpen(false)}
                    >
                      {"×"}
                    </button>
                    <p className="lp-callmodal-h">Awesome, talk soon 🤝</p>
                    <p className="lp-callmodal-sub">{"Here's your path:"}</p>
                    <ol className="lp-callmodal-steps">
                      <li><span className="lp-callmodal-node">🔍</span><span className="lp-callmodal-step-txt">Where to find deals</span></li>
                      <li><span className="lp-callmodal-node">🤝</span><span className="lp-callmodal-step-txt">How to line up buyers</span></li>
                      <li><span className="lp-callmodal-node">📝</span><span className="lp-callmodal-step-txt">Locking your first deal</span></li>
                      <li className="is-payoff"><span className="lp-callmodal-node">💰</span><span className="lp-callmodal-step-txt">Getting your first check</span></li>
                    </ol>
                    <p className="lp-callmodal-foot">{"Phone's about to ring. Pick up 📞"}</p>
                  </div>
                </div>
              )}
              <TrustRow />
              <div className="lp-trust">
                <div className="lp-trust-item"><span className="lp-trust-check">{"\u2713"}</span> Cancel anytime</div>
                <div className="lp-trust-dot" />
                <div className="lp-trust-item"><span className="lp-trust-check">{"\u2713"}</span> Secured by Whop</div>
              </div>
            </div>
          </section>
        ) : (
          <section className="lp-hero">
            <div className="shell">
              <div className="lp-hero-badge">Real Venture {"·"} Proven Path</div>
              <h1 className="lp-hero-h">
                <span className="lp-hero-line-1">Your first</span>
                <span className="lp-hero-line-2">real estate payday.</span>
                <span className="lp-hero-line-3">{"We'll walk you there."}</span>
              </h1>
              <p className="lp-hero-sub">{"We teach you live, hand you the tools, and send real buyers to your deals. No license, no capital, no experience needed."}</p>
              <CtaStrip onJoin={openPricing} label={proOnly ? "Join Pro for $49.99/mo \u2192" : undefined} />
              <TrustRow />
              <div className="lp-trust">
                <div className="lp-trust-item"><span className="lp-trust-check">{"✓"}</span> Cancel anytime</div>
                <div className="lp-trust-dot" />
                <div className="lp-trust-item"><span className="lp-trust-check">{"✓"}</span> Secured by Whop</div>
              </div>
            </div>
          </section>
        )}

        <section className="lp-payouts">
          <div className="shell">
            <SectionHead
              heading={<>Student <span>payouts.</span></>}
              sub="Real wins by real students."
            />
          </div>
          <PayoutCarousel />
        </section>

        <VideoWalkthrough onJoin={openPricing} ctaLabel={proOnly ? "Join Pro for $49.99/mo \u2192" : undefined} />

        <section className="lp-success-stories">
          <div className="shell">
            <SectionHead
              heading={<>Success <span>stories.</span></>}
              sub="Long-form testimonials from the Real Gs."
            />
            <div className="lp-vid-stack">
              {LP_STORIES.map((story) => (
                <div className="lp-vid-card" key={story.id}>
                  <div className="lp-vid-embed">
                    <iframe
                      src={`https://player.vimeo.com/video/${story.videoId}?title=0&byline=0&portrait=0&badge=0&autopause=0&dnt=1&responsive=1&playsinline=1`}
                      frameBorder="0"
                      allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
                      allowFullScreen
                      webkit-playsinline="true"
                      title={`${story.name} testimonial`}
                    />
                  </div>
                  <div className="lp-vid-caption">
                    <div className="lp-vid-caption-row">
                      <div className="lp-vid-name">{`${story.name}, ${story.age}`}</div>
                      <div className="lp-vid-amount">{story.amount}</div>
                    </div>
                    <div className="lp-vid-blurb">{story.blurb}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-compare">
          <div className="shell">
            <SectionHead
              heading={<>Their way <span className="lp-vs-red">vs</span> our way.</>}
              sub={"Most people never make it. Here's why."}
            />
            <div className="lp-compare-grid">
              <div className="lp-compare-col bad">
                <div className="lp-compare-head">Their Way</div>
                <ul className="lp-compare-list">
                  {LP_COMPARE_BAD.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="lp-vs-box">VS</div>
              <div className="lp-compare-col good">
                <div className="lp-compare-head">Real Venture</div>
                <ul className="lp-compare-list">
                  {LP_COMPARE_GOOD.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="lp-cta-after">
              <CtaStrip onJoin={openPricing} label={"Join Real Venture \u2192"} />
              <TrustRow />
            </div>
          </div>
        </section>

        <section className="lp-phases">
          <div className="shell">
            <SectionHead
              heading={<>The simple 7-step path to success.</>}
              sub="Each distinct phase to your first deal."
            />
            <Timeline />
          </div>
        </section>

        <section className="lp-pricing">
          <div className="shell">
            <SectionHead
              heading={<>Choose your <span>path.</span></>}
              sub="Cancel anytime. Upgrade anytime."
            />
            <div className={`modal-tiers lp-pricing-tiers${proOnly ? " pro-only" : ""}`}>

              {!proOnly && (
              <div className="tier base">
                <div className="tier-icon"><img src="/crowns/base.png" alt="Base" width={62} height={54} /></div>
                <div className="tier-name">Base</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">19.99</span></div>
                <div className="tier-per">/ per month</div>
                <div className="tier-tag">Learn the entire process, start to finish.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Live coaching 7x/week</li>
                  <li><span className="chk">{"✓"}</span>JV deals, keep 50%</li>
                  <li><span className="chk">{"✓"}</span>Real Venture Studio (all-in-one software)</li>
                  <li><span className="chk">{"✓"}</span>Buyer network access</li>
                  <li><span className="chk">{"✓"}</span>Full course library</li>
                  <li><span className="chk">{"✓"}</span>Contract templates</li>
                  <li><span className="chk">{"✓"}</span>Proof of Funds letters</li>
                  <li><span className="chk">{"✓"}</span>Deal Manager pipeline</li>
                  <li><span className="chk">{"✓"}</span>Call recordings</li>
                  <li><span className="chk">{"✓"}</span>LLC and Bank Playbook</li>
                </ul>
                <button type="button" className="tier-cta" onClick={() => openPricingAt("base")}>Choose Base {"→"}</button>
              </div>
              )}

              <div className="tier pro">
                <div className="ribbon">Most Popular</div>
                <div className="tier-icon"><img src="/crowns/pro.png" alt="Pro" width={62} height={54} /></div>
                <div className="tier-name">Pro</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">{PRO_TERMS[proTerm].amount}</span></div>
                <div className="tier-per">/ {PRO_TERMS[proTerm].cadence}</div>
                <div className="tier-term-toggle" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={proTerm === "monthly"}
                    className={`tier-term${proTerm === "monthly" ? " on" : ""}`}
                    onClick={() => setProTerm("monthly")}
                  >
                    1 month
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={proTerm === "quarterly"}
                    className={`tier-term${proTerm === "quarterly" ? " on" : ""}`}
                    onClick={() => setProTerm("quarterly")}
                  >
                    3 months
                  </button>
                  {proTerm === "quarterly" && <span className="tier-save-badge">Save $20</span>}
                </div>
                <div className="tier-tag">Stop learning, start closing.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Everything in Base</li>
                  <li><span className="chk">{"✓"}</span>JV deals, keep 60%</li>
                  <li><span className="chk">{"✓"}</span>Real Venture Studio Pro (everything unlocked)</li>
                  <li><span className="chk">{"✓"}</span>Contract generator (auto fill)</li>
                  <li><span className="chk">{"✓"}</span>Advanced course modules</li>
                  <li><span className="chk">{"✓"}</span>First look at incoming buyers</li>
                  <li><span className="chk">{"✓"}</span>Priority DM + Deal support</li>
                </ul>
                <button type="button" className="tier-cta" onClick={() => openPricingAt("pro")}>Choose Pro {"→"}</button>
              </div>

              {!proOnly && (
              <div className="tier ultra">
                <div className="ribbon coming">Coming Soon {"\u00b7"} 25 seats</div>
                <div className="tier-icon"><img src="/crowns/ultra.png" alt="Ultra" width={62} height={54} /></div>
                <div className="tier-name">Ultra</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">249</span></div>
                <div className="tier-per">/ per month</div>
                <div className="tier-tag">Closing deals? Time to scale.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Everything in Pro</li>
                  <li><span className="chk">{"✓"}</span>Direct DM to William</li>
                  <li><span className="chk">{"✓"}</span>Private inner-circle channel</li>
                  <li><span className="chk">{"✓"}</span>Monthly mastermind call</li>
                  <li><span className="chk">{"✓"}</span>1-1 Deal Reviews</li>
                  <li><span className="chk">{"✓"}</span>First in line</li>
                </ul>
                <button className="tier-cta">Coming Soon</button>
              </div>
              )}

            </div>
          </div>
        </section>

        <section id="reviews" className="lp-reviews">
          <div className="shell">
            <SectionHead
              heading={<>What members <span>say.</span></>}
              sub="All reviews verified by Whop."
            />
            <div className="lp-review-summary">
              <div className="lp-reviews-score">{REVIEW_STATS.average.toFixed(1)}</div>
              <div>
                <div className="lp-reviews-stars">{"\u2605\u2605\u2605\u2605\u2605"}</div>
                <div className="lp-reviews-count">{REVIEW_STATS.total} verified reviews</div>
              </div>
              <img src="/whoplogo3.png" alt="Whop" className="lp-reviews-whop-logo" />
            </div>
            <Reviews />
          </div>
        </section>

        <section className="lp-choice">
          <div className="shell">
            <div className="lp-section-head">
              <h2 className="lp-section-h2">The choice is yours.</h2>
              <p className="lp-section-sub">Two paths. One decision.</p>
            </div>

            <div className="lp-choice-grid">

              <div className="lp-choice-col lp-choice-col-dead">
                <div className="lp-choice-col-head">
                  <div className="lp-choice-icon">
                    <svg viewBox="0 0 24 24" width="28" height="28" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="9" />
                      <path d="M12 7v5l3 3" />
                    </svg>
                  </div>
                  <h3 className="lp-choice-col-title">Do Nothing</h3>
                  <p className="lp-choice-col-sub">Same life, forever</p>
                </div>
                <ul className="lp-choice-list">
                  <li>Wake up dreading the 9-5</li>
                  <li>Trade time for a paycheck</li>
                  <li>Watch others get ahead</li>
                  <li>No control over your income</li>
                  <li>Same routine, same results</li>
                  <li>{"Retire at 65, if you're lucky"}</li>
                </ul>
                <a
                  href="https://www.indeed.com/companies"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="lp-choice-dead-btn"
                >
                  Do It Your Way {"\u2192"}
                </a>
              </div>

              <div className="lp-choice-col lp-choice-col-alive">
                <div className="lp-choice-col-head">
                  <div className="lp-choice-icon">
                    <img src="/logo.png" alt="Real Venture" className="lp-choice-alive-logo" />
                  </div>
                  <h3 className="lp-choice-col-title">Join Real Venture</h3>
                  <p className="lp-choice-col-sub">Start earning today</p>
                </div>
                <ul className="lp-choice-list">
                  <li>Wake up on your own schedule</li>
                  <li>Get paid per deal, uncapped</li>
                  <li>Direct access to William + Keegan every day</li>
                  <li>Live coaching 7x/week</li>
                  <li>Vetted buyer network on tap</li>
                  <li>Deal analyzer + contract templates</li>
                  <li>350+ members closing deals with you</li>
                  <li>Finally start your journey in entrepreneurship</li>
                </ul>
                <button
                  type="button"
                  onClick={openPricing}
                  className="lp-cta-primary lp-cta-hero lp-choice-alive-btn"
                >
                  Join Real Venture {"\u2192"}
                </button>
              </div>

            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="shell">
            <h2 className="lp-section-h2">Your first payday <span>starts today.</span></h2>
            <p className="lp-section-sub lp-final-sub">Join 350+ students who stopped watching and started closing.</p>
            <CtaStrip onJoin={openPricing} label={proOnly ? "Join Pro for $49.99/mo \u2192" : undefined} />
            <TrustRow />
            <div className="lp-trust">
              <div className="lp-trust-item"><span className="lp-trust-check">{"\u2713"}</span> Cancel anytime</div>
              <div className="lp-trust-dot" />
              <div className="lp-trust-item"><span className="lp-trust-check">{"\u2713"}</span> Secured by Whop</div>
            </div>
          </div>
        </section>

        <footer className="lp-footer">
          <div className="lp-footer-inner">
            <div className="lp-footer-logo">
              <img src="/logo.png" alt="Real Venture" width={36} height={36} style={{ borderRadius: 9 }} />
              <span className="lp-footer-word">REAL <b>VENTURE</b></span>
            </div>
            <div className="lp-footer-links">
              <a onClick={openPricing}>Pricing</a>
              <a onClick={() => scrollToSection("included")}>{"What's inside"}</a>
              <a onClick={() => scrollToSection("reviews")}>Reviews</a>
              <a href="/login">Log in</a>
              <a href="/privacy">Privacy</a>
              <a href="/terms">Terms</a>
              <a href="/disclaimer">Disclaimer</a>
            </div>
            <div className="lp-footer-site">realventure.io</div>
          </div>
          <div className="lp-footer-legal">{"\u00a9"} 2026 Real Venture {"\u00b7"} Not financial advice. Not a license.</div>
        </footer>
      </div>

      <div
        className={`modal-overlay${pricingOpen ? " active" : ""}`}
        id="pricing-modal"
        onClick={(e) => {
          if (e.target === e.currentTarget) closePricing();
        }}
      >
        <div
          className={`modal${step === "checkout" ? ` pm-theme-${planCopy.accent}` : ""}`}
        >
          {step !== "checkout" && (
            <button className="modal-close" onClick={closePricing} aria-label="Close">{"×"}</button>
          )}
          <div className="modal-body">
            {step === "pricing" && (
            <div className="modal-step" key="step-pricing">
            <div className="modal-head">
              <div className="modal-title">Join <em>Real Venture</em></div>
              <p className="modal-tag">One membership. Cancel anytime.</p>
            </div>
            <div className={`modal-tiers${proOnly ? " pro-only" : ""}`}>

              {!proOnly && (
              <div className="tier base">
                <div className="tier-icon"><img src="/crowns/base.png" alt="Base" width={62} height={54} /></div>
                <div className="tier-name">Base</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">19.99</span></div>
                <div className="tier-per">/ per month</div>
                <div className="tier-tag">Learn the entire process, start to finish.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Live coaching 7x/week</li>
                  <li><span className="chk">{"✓"}</span>JV deals, keep 50%</li>
                  <li><span className="chk">{"✓"}</span>Real Venture Studio (all-in-one software)</li>
                  <li><span className="chk">{"✓"}</span>Buyer network access</li>
                  <li><span className="chk">{"✓"}</span>Full course library</li>
                  <li><span className="chk">{"✓"}</span>Contract templates</li>
                  <li><span className="chk">{"✓"}</span>Proof of Funds letters</li>
                  <li><span className="chk">{"✓"}</span>Deal Manager pipeline</li>
                  <li><span className="chk">{"✓"}</span>Call recordings</li>
                  <li><span className="chk">{"✓"}</span>LLC and Bank Playbook</li>
                </ul>
                <button type="button" className="tier-cta" onClick={() => choosePlan("base")}>Choose Base {"→"}</button>
              </div>
              )}

              <div className="tier pro">
                <div className="ribbon">Most Popular</div>
                <div className="tier-icon"><img src="/crowns/pro.png" alt="Pro" width={62} height={54} /></div>
                <div className="tier-name">Pro</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">{PRO_TERMS[proTerm].amount}</span></div>
                <div className="tier-per">/ {PRO_TERMS[proTerm].cadence}</div>
                <div className="tier-term-toggle" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={proTerm === "monthly"}
                    className={`tier-term${proTerm === "monthly" ? " on" : ""}`}
                    onClick={() => setProTerm("monthly")}
                  >
                    1 month
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={proTerm === "quarterly"}
                    className={`tier-term${proTerm === "quarterly" ? " on" : ""}`}
                    onClick={() => setProTerm("quarterly")}
                  >
                    3 months
                  </button>
                  {proTerm === "quarterly" && <span className="tier-save-badge">Save $20</span>}
                </div>
                <div className="tier-tag">Stop learning, start closing.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Everything in Base</li>
                  <li><span className="chk">{"✓"}</span>JV deals, keep 60%</li>
                  <li><span className="chk">{"✓"}</span>Real Venture Studio Pro (everything unlocked)</li>
                  <li><span className="chk">{"✓"}</span>Contract generator (auto fill)</li>
                  <li><span className="chk">{"✓"}</span>Advanced course modules</li>
                  <li><span className="chk">{"✓"}</span>First look at incoming buyers</li>
                  <li><span className="chk">{"✓"}</span>Priority DM + Deal support</li>
                </ul>
                <button type="button" className="tier-cta" onClick={() => choosePlan("pro")}>Choose Pro {"→"}</button>
              </div>

              {!proOnly && (
              <div className="tier ultra">
                <div className="ribbon coming">Coming Soon {"\u00b7"} 25 seats</div>
                <div className="tier-icon"><img src="/crowns/ultra.png" alt="Ultra" width={62} height={54} /></div>
                <div className="tier-name">Ultra</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">249</span></div>
                <div className="tier-per">/ per month</div>
                <div className="tier-tag">Closing deals? Time to scale.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Everything in Pro</li>
                  <li><span className="chk">{"✓"}</span>Direct DM to William</li>
                  <li><span className="chk">{"✓"}</span>Private inner-circle channel</li>
                  <li><span className="chk">{"✓"}</span>Monthly mastermind call</li>
                  <li><span className="chk">{"✓"}</span>1-1 Deal Reviews</li>
                  <li><span className="chk">{"✓"}</span>First in line</li>
                </ul>
                <button className="tier-cta">Coming Soon</button>
              </div>
              )}

            </div>
            <div className="modal-foot">
              <span><CheckIcon />Cancel anytime</span>
              <span>{"•"}</span>
              <span><CheckIcon />Secured by Whop</span>
            </div>
            </div>
            )}

            {step === "checkout" && activePlan && (
              <div className="modal-step modal-step-narrow" key="step-checkout">
                <div className="pm-header">
                  <h2 className="pm-title">{modalTitle}</h2>
                  {/* Two rows of two. DOM order fills the grid:
                      row 1 = Cancel anytime + Whop rating
                      row 2 = Secured by Whop + Trustpilot rating */}
                  <div className="pm-trust">
                    <span className="pm-trust-item">
                      <span className="pm-trust-icon pm-trust-check" aria-hidden="true">{"✓"}</span>
                      Cancel anytime
                    </span>
                    <span className="pm-trust-item">
                      <span className="pm-trust-icon pm-trust-star" aria-hidden="true">{"★"}</span>
                      5.0 on Whop <span className="pm-trust-count">(53 reviews)</span>
                    </span>
                    <span className="pm-trust-item">
                      <span className="pm-trust-icon pm-trust-check" aria-hidden="true">{"✓"}</span>
                      Secured by Whop
                    </span>
                    <span className="pm-trust-item">
                      <span className="pm-trust-icon pm-trust-tp" aria-hidden="true">{"★"}</span>
                      4.6 on Trustpilot <span className="pm-trust-count">(20 reviews)</span>
                    </span>
                  </div>
                  <span className="pm-accent-bar" aria-hidden="true" />
                </div>

                <div className="pm-planbar">
                  <div className="pm-planbar-info">
                    <div className="pm-plan-name">{planCopy.name}</div>
                    <div className="pm-plan-tagline">{planCopy.tagline}</div>
                  </div>
                  <button
                    type="button"
                    className="pm-back"
                    onClick={() => setStep("pricing")}
                  >
                    {"← Back"}
                  </button>
                </div>

                <ul className="pm-feats">
                  {(featuresOpen
                    ? planCopy.features
                    : planCopy.features.slice(0, FEATURE_PREVIEW)
                  ).map((feat) => (
                    <li className="pm-feat" key={feat}>
                      <span className="pm-feat-check" aria-hidden="true">{"✓"}</span>
                      {feat}
                    </li>
                  ))}
                </ul>
                {planCopy.features.length > FEATURE_PREVIEW && (
                  <button
                    type="button"
                    className="pm-feats-toggle"
                    onClick={() => setFeaturesOpen((open) => !open)}
                    aria-expanded={featuresOpen}
                  >
                    {featuresOpen
                      ? "Show less"
                      : `+ ${planCopy.features.length - FEATURE_PREVIEW} more included`}
                  </button>
                )}

                <div className="modal-checkout-wrap">
                  <WhopCheckoutEmbed
                    planId={activePlan.planId}
                    theme="dark"
                    themeOptions={{
                      backgroundColor: "#0f0f12",
                      accentColor: "#E5A544",
                      borderRadius: 12,
                    }}
                    skipRedirect
                    onComplete={handleCheckoutComplete}
                  />
                </div>
                <div className="pm-friction">
                  <span className="pm-friction-check" aria-hidden="true">{"✓"}</span>
                  <span>
                    Cancel anytime, no lock-in. Not a fit? One click cancels. No emails, no
                    calls, no hoops.
                  </span>
                </div>
                <div className="pm-footer-note">Cancel anytime. One click, no hoops.</div>
                <div className="checkout-trust-footer">
                  Secured by Whop <span aria-hidden="true">·</span> Encrypted <span aria-hidden="true">·</span> Cancel anytime
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
