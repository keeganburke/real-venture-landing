"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { WhopCheckoutEmbed } from "@whop/checkout/react";
import NavDrawer from "./components/NavDrawer";
import CtaStrip from "./components/CtaStrip";
import SectionHead from "./components/SectionHead";
import PayoutCarousel from "./components/PayoutCarousel";
import ToolkitCards from "./components/ToolkitCards";
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
  { id: "dylan", name: "Dylan", videoId: "1221681436", amount: "$24,000 Profit" },
  { id: "yves", name: "Yves", videoId: "1197200708", amount: "$11,000 Profit" },
  { id: "zach", name: "Zach", videoId: "1197200691", amount: "$6,000 Profit" },
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

const ADDONS = [
  { id: "call-william", title: "1-on-1 with William", subtitle: "45-min strategy call", price: "$249" },
  { id: "call-keegan", title: "1-on-1 with Keegan", subtitle: "45-min systems review", price: "$249" },
  { id: "playbook", title: "Wholesaling Playbook PDF", subtitle: "The exact playbook we use", price: "$39", comingSoon: true },
];

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [pricingOpen, setPricingOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // 3-step wizard inside the pricing modal: tiers -> add-ons -> embedded checkout.
  const [step, setStep] = useState<"pricing" | "addons" | "checkout">("pricing");
  const [selectedPlan, setSelectedPlan] = useState<"base" | "pro" | null>(null);
  const [addedAddons, setAddedAddons] = useState<Set<string>>(new Set());

  // Deep link: /?pricing=1 opens the modal; &plan=base|pro (the old /checkout
  // routes redirect here) jumps straight to the add-ons step.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("pricing") === "1") {
      setPricingOpen(true);
      const planParam = params.get("plan");
      if (planParam === "base" || planParam === "pro") {
        setSelectedPlan(planParam);
        setStep("addons");
      }
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPricingOpen(false);
        setStep("pricing");
        setSelectedPlan(null);
        setAddedAddons(new Set());
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
    setAddedAddons(new Set());
  };

  // Inline pricing-section CTAs: open the modal directly at the add-ons step.
  const openPricingAt = (plan: "base" | "pro") => {
    setSelectedPlan(plan);
    setStep("addons");
    setPricingOpen(true);
  };

  const choosePlan = (plan: "base" | "pro") => {
    setSelectedPlan(plan);
    setStep("addons");
  };

  const toggleAddon = (id: string) => {
    setAddedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCheckoutComplete = (planId: string, receiptId?: string) => {
    // Fires once on payment success; close the modal and send the user to
    // OAuth so they land in the dashboard.
    console.log("Whop checkout complete", { planId, receiptId });
    closePricing();
    router.push("/login?justpurchased=1");
  };

  const toggleDrawer = () => setDrawerOpen((open) => !open);
  const closeDrawer = () => setDrawerOpen(false);

  const scrollToSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      <div className="wrap">
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

        <section className="lp-hero">
          <div className="shell">
            <div className="lp-hero-badge">Real Venture {"·"} Proven Path</div>
            <h1 className="lp-hero-h">
              <span className="lp-hero-line-1">Your first</span>
              <span className="lp-hero-line-2">real estate payday.</span>
              <span className="lp-hero-line-3">{"We'll walk you there."}</span>
            </h1>
            <p className="lp-hero-sub">{"We teach you live, hand you the tools, and send real buyers to your deals. No license, no capital, no experience needed."}</p>
            <CtaStrip onJoin={openPricing} />
            <div className="lp-trust">
              <div className="lp-trust-item"><span className="lp-trust-check">{"✓"}</span> Cancel anytime</div>
              <div className="lp-trust-dot" />
              <div className="lp-trust-item"><span className="lp-trust-check">{"✓"}</span> Secured by Whop</div>
            </div>
          </div>
        </section>

        <section className="lp-payouts">
          <div className="shell">
            <SectionHead
              heading={<>Student <span>payouts.</span></>}
              sub="Real wins by real students."
            />
          </div>
          <PayoutCarousel />
        </section>

        <section className="lp-section" id="included">
          <div className="shell">
            <SectionHead
              heading={<>The full <span>toolkit.</span></>}
              sub="Every tool, every script, every step. Nothing gate-kept."
            />
            <ToolkitCards />
            <div className="lp-cta-after">
              <CtaStrip onJoin={openPricing} />
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
            </div>
          </div>
        </section>

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
                    <div className="lp-vid-name">{story.name}</div>
                    <div className="lp-vid-amount">{story.amount}</div>
                  </div>
                </div>
              ))}
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
            <div className="modal-tiers lp-pricing-tiers">

              <div className="tier base">
                <div className="tier-icon"><img src="/crowns/base.png" alt="Base" width={62} height={54} /></div>
                <div className="tier-name">Base</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">19.99</span></div>
                <div className="tier-per">/ per month</div>
                <div className="tier-tag">Learn the entire process, start to finish.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Live calls 7 days a week</li>
                  <li><span className="chk">{"✓"}</span>JV deals, keep 50%</li>
                  <li><span className="chk">{"✓"}</span>Studio deal analyzer</li>
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

              <div className="tier pro">
                <div className="ribbon">Most Popular</div>
                <div className="tier-icon"><img src="/crowns/pro.png" alt="Pro" width={62} height={54} /></div>
                <div className="tier-name">Pro</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">49.99</span></div>
                <div className="tier-per">/ per month</div>
                <div className="tier-tag">Stop learning, start closing.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Everything in Base</li>
                  <li><span className="chk">{"✓"}</span>JV deals, keep 60%</li>
                  <li><span className="chk">{"✓"}</span>Contract generator (auto fill)</li>
                  <li><span className="chk">{"✓"}</span>Advanced course modules</li>
                  <li><span className="chk">{"✓"}</span>First look at incoming buyers</li>
                  <li><span className="chk">{"✓"}</span>Priority DM + Deal support</li>
                </ul>
                <button type="button" className="tier-cta" onClick={() => openPricingAt("pro")}>Choose Pro {"→"}</button>
              </div>

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
                  <li>Live coaching 6x/week</li>
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
            <CtaStrip onJoin={openPricing} />
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
        <div className="modal">
          <button className="modal-close" onClick={closePricing}>{"×"}</button>
          <div className="modal-body">
            {step === "pricing" && (
            <div className="modal-step" key="step-pricing">
            <div className="modal-head">
              <div className="modal-title">Join <em>Real Venture</em></div>
              <p className="modal-tag">One membership. Cancel anytime.</p>
            </div>
            <div className="modal-tiers">

              <div className="tier base">
                <div className="tier-icon"><img src="/crowns/base.png" alt="Base" width={62} height={54} /></div>
                <div className="tier-name">Base</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">19.99</span></div>
                <div className="tier-per">/ per month</div>
                <div className="tier-tag">Learn the entire process, start to finish.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Live calls 7 days a week</li>
                  <li><span className="chk">{"✓"}</span>JV deals, keep 50%</li>
                  <li><span className="chk">{"✓"}</span>Studio deal analyzer</li>
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

              <div className="tier pro">
                <div className="ribbon">Most Popular</div>
                <div className="tier-icon"><img src="/crowns/pro.png" alt="Pro" width={62} height={54} /></div>
                <div className="tier-name">Pro</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">49.99</span></div>
                <div className="tier-per">/ per month</div>
                <div className="tier-tag">Stop learning, start closing.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Everything in Base</li>
                  <li><span className="chk">{"✓"}</span>JV deals, keep 60%</li>
                  <li><span className="chk">{"✓"}</span>Contract generator (auto fill)</li>
                  <li><span className="chk">{"✓"}</span>Advanced course modules</li>
                  <li><span className="chk">{"✓"}</span>First look at incoming buyers</li>
                  <li><span className="chk">{"✓"}</span>Priority DM + Deal support</li>
                </ul>
                <button type="button" className="tier-cta" onClick={() => choosePlan("pro")}>Choose Pro {"→"}</button>
              </div>

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

            </div>
            <div className="modal-foot">
              <span><CheckIcon />Cancel anytime</span>
              <span>{"•"}</span>
              <span><CheckIcon />Secured by Whop</span>
            </div>
            </div>
            )}

            {step === "addons" && selectedPlan && (
              <div className="modal-step modal-step-narrow" key="step-addons">
                <div className="co-addons-head">
                  <h2 className="co-addons-title">Add to your plan?</h2>
                  <p className="co-addons-sub">
                    {PLANS[selectedPlan].name} · {PLANS[selectedPlan].price} {PLANS[selectedPlan].cadence} · optional one-time add-ons
                  </p>
                </div>
                <div className={`checkout-summary tier-${PLANS[selectedPlan].crownColor}`}>
                  <div className="checkout-summary-info">
                    <div className="checkout-summary-name">{PLANS[selectedPlan].name}</div>
                    <div className="checkout-summary-tagline">{PLANS[selectedPlan].tagline}</div>
                  </div>
                  <div className="checkout-summary-price">
                    <div className="checkout-summary-amount">{PLANS[selectedPlan].price}</div>
                    <div className="checkout-summary-cadence">{PLANS[selectedPlan].cadence}</div>
                  </div>
                  <button
                    type="button"
                    className="checkout-summary-back"
                    onClick={() => setStep("pricing")}
                  >
                    <span aria-hidden="true">{"←"}</span>
                    <span>Back</span>
                  </button>
                </div>
                <div className="co-addons-list">
                  {ADDONS.map((addon) => {
                    const isAdded = addedAddons.has(addon.id);
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
                <button
                  type="button"
                  className="co-checkout-cta"
                  onClick={() => setStep("checkout")}
                >
                  <span>Continue to checkout</span>
                  <span aria-hidden="true">→</span>
                </button>
                <p className="co-checkout-note">
                  Add-ons above are optional. You can skip straight to checkout.
                </p>
              </div>
            )}

            {step === "checkout" && selectedPlan && (
              <div className="modal-step modal-step-narrow" key="step-checkout">
                <div className={`checkout-summary tier-${PLANS[selectedPlan].crownColor}`}>
                  <div className="checkout-summary-info">
                    <div className="checkout-summary-name">{PLANS[selectedPlan].name}</div>
                    <div className="checkout-summary-tagline">{PLANS[selectedPlan].tagline}</div>
                  </div>
                  <div className="checkout-summary-price">
                    <div className="checkout-summary-amount">{PLANS[selectedPlan].price}</div>
                    <div className="checkout-summary-cadence">{PLANS[selectedPlan].cadence}</div>
                  </div>
                  <button
                    type="button"
                    className="checkout-summary-back"
                    onClick={() => setStep("addons")}
                  >
                    <span aria-hidden="true">{"←"}</span>
                    <span>Back</span>
                  </button>
                </div>
                <div className="modal-checkout-wrap">
                  <WhopCheckoutEmbed
                    planId={PLANS[selectedPlan].planId}
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
