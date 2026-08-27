"use client";

import { useEffect, useState } from "react";
import NavDrawer from "./components/NavDrawer";
import CtaStrip from "./components/CtaStrip";
import SectionHead from "./components/SectionHead";
import PayoutCarousel from "./components/PayoutCarousel";
import ToolkitCards from "./components/ToolkitCards";

const LP_COMPARE_BAD = [
  "Watch YouTube for hours without taking action",
  "Random advice from random people, trying to piece all the information together yourself, getting stuck with nowhere to ask questions",
  "No idea how to actually spot a deal",
  "Never talked to a real cash buyer, no reliable path to finding buyers",
  "Quit after one week because it seems hopeless",
];

const LP_COMPARE_GOOD = [
  "Direct access to William + Keegan every day",
  "Step-by-step 14-day sprint with clear checkpoints",
  "Live Q&A calls 6x/week + Discord 24/7",
  "Deal analyzer + contract templates ready",
  "Proven strategies to find buyers from the founders",
  "Countless testimonials and students actually getting paid",
  "Starting at the same price as your DoorDash order",
];

const LP_PHASES = [
  {
    num: "01",
    step: "Phase 1 · Days 1-3",
    title: "Learn the fundamentals",
    desc: "Live onboarding call. 3-lesson intensive. LLC + business bank setup. Discord tour with the founders.",
  },
  {
    num: "02",
    step: "Phase 2 · Days 4-9",
    title: "Analyze your first deals",
    desc: "Deal analyzer training. Pull comps like a pro. Run 10 deals through the calculator live with William.",
  },
  {
    num: "03",
    step: "Phase 3 · Days 10-14",
    title: "Send offers, sign contracts",
    desc: "Contract templates. Outreach scripts. First offer sent. Buyer network unlocked. Assignment ready.",
  },
];

const LP_STORIES = [
  { id: "marcus", attr: "Marcus T.", detail: "$18,000 first assignment · 22 days" }, // TODO placeholder video, swap Vimeo embed
  { id: "sara", attr: "Sara R.", detail: "$12,500 in month 2 · closed via JV" }, // TODO placeholder video, swap Vimeo embed
  { id: "devon", attr: "Devon K.", detail: "3 deals since joining · $56k YTD" }, // TODO placeholder video, swap Vimeo embed
];

// TODO: placeholder reviews, swap in real Whop review pulls later.
const LP_REVIEWS = [
  {
    name: "jordan_l",
    avatar: "linear-gradient(135deg,#FFE89A,#B8881F)",
    body: '"The buyer network is the whole game. Analyzed a deal Monday, had a buyer Wednesday, closed $16k Friday."',
  },
  {
    name: "alex_m",
    avatar: "linear-gradient(135deg,#a78bfa,#7c3aed)",
    body: '"I\'ve bought 3 other wholesaling courses. This is the only one where the founders actually respond and the tools actually work."',
  },
  {
    name: "devon_k",
    avatar: "linear-gradient(135deg,#5FB3E0,#3b82f6)",
    body: '"Live calls with William are worth the $50 alone. Bring a deal, leave with a plan."',
  },
];


function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function Home() {
  const [pricingOpen, setPricingOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Deep link from /login ("Join"): /?pricing=1 opens the pricing modal.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("pricing") === "1") {
      setPricingOpen(true);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPricingOpen(false);
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
  const closePricing = () => setPricingOpen(false);

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
              {"Your first real estate payday. "}
              <br className="lp-h1-break" />
              {"We'll walk you there."}
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
              sub="Every dollar closed by a Real Venture student."
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
              heading={<>See the <span>payoff.</span></>}
              sub="Real students. Real deals. Real dollars."
            />
            <div className="lp-vid-stack">
              {LP_STORIES.map((story) => (
                <div className="lp-vid-card" key={story.id}>
                  <button
                    className="lp-vid-thumb"
                    onClick={() => console.log("TODO: open Vimeo modal for testimonial", story.id)}
                    aria-label={`Play testimonial from ${story.attr}`}
                  >
                    <span className="lp-play" />
                  </button>
                  <div className="lp-vid-meta">
                    <div className="lp-vid-attr">{story.attr}</div>
                    <div className="lp-vid-detail">{story.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-phases">
          <div className="shell">
            <SectionHead
              heading={<>From zero to <span>first wire.</span></>}
              sub="Three phases. Fourteen days. Real deals."
            />
            <div className="lp-phase-list">
              {LP_PHASES.map((phase) => (
                <div className="lp-phase-card" key={phase.num}>
                  <div className="lp-phase-num">{phase.num}</div>
                  <div className="lp-phase-step">{phase.step}</div>
                  <div className="lp-phase-title">{phase.title}</div>
                  <div className="lp-phase-desc">{phase.desc}</div>
                </div>
              ))}
            </div>
            <div className="lp-cta-after">
              <CtaStrip onJoin={openPricing} />
            </div>
          </div>
        </section>

        <section className="lp-pricing">
          <div className="shell">
            <SectionHead
              heading={<>Three ways <span>in.</span></>}
              sub="Start on Base. Upgrade to Pro when you close."
            />
            <div className="lp-tier-stack">
              <div className="lp-tier">
                <div className="lp-tier-crown">{"\u{1F451}"}</div>
                <div className="lp-tier-name">Base</div>
                <div className="lp-tier-price"><b>$19.99</b><span> / month</span></div>
                <ul className="lp-tier-feats">
                  <li>Discord community access</li>
                  <li>3x/week live calls</li>
                  <li>Full 13-lesson curriculum</li>
                  <li>Deal analyzer + templates</li>
                  <li>14-day First Deal Sprint</li>
                </ul>
                <button className="lp-tier-cta" onClick={openPricing}>Get started {"\u2192"}</button>
              </div>
              <div className="lp-tier pro">
                <span className="lp-tier-badge">Most Popular</span>
                <div className="lp-tier-crown">{"\u{1F451}"}</div>
                <div className="lp-tier-name">Pro</div>
                <div className="lp-tier-price"><b>$49.99</b><span> / month</span></div>
                <ul className="lp-tier-feats">
                  <li>Everything in Base</li>
                  <li><b>We close deals with you {"\u00b7"} 60% to you</b></li>
                  <li>Full buyer network access</li>
                  <li>Auto-fill contracts + Proof of Funds</li>
                  <li>All call recordings + priority DM</li>
                </ul>
                <button className="lp-tier-cta" onClick={openPricing}>Join Pro {"\u2192"}</button>
              </div>
              <div className="lp-tier ultra">
                <span className="lp-tier-badge">Coming Soon</span>
                <div className="lp-tier-crown">{"\u{1F451}"}</div>
                <div className="lp-tier-name">Ultra</div>
                <div className="lp-tier-price"><b>$249</b><span> / month</span></div>
                <ul className="lp-tier-feats">
                  <li>{"Direct DM with William & Keegan"}</li>
                  <li>Monthly mastermind call</li>
                  <li>Founder review of your offers</li>
                  <li>First 10: $149/mo locked forever</li>
                </ul>
                <button className="lp-tier-cta" disabled>Notify me</button>
              </div>
            </div>
          </div>
        </section>

        <section id="reviews" className="lp-reviews">
          <div className="shell">
            <SectionHead
              heading={<>What members <span>say.</span></>}
              sub="All reviews collected + verified by Whop."
            />
            <div className="lp-review-summary">
              <div className="lp-reviews-score">4.9</div>
              <div>
                <div className="lp-reviews-stars">{"\u2605\u2605\u2605\u2605\u2605"}</div>
                <div className="lp-reviews-count">124 verified reviews</div>
              </div>
            </div>
            <div className="lp-reviews-grid">
              {LP_REVIEWS.map((review) => (
                <div className="lp-review-card" key={review.name}>
                  <div className="lp-review-top">
                    <div className="lp-review-user">
                      <span className="lp-review-avatar" style={{ background: review.avatar }} />
                      <span className="lp-review-name">{review.name}</span>
                    </div>
                    <div className="lp-review-stars">{"\u2605\u2605\u2605\u2605\u2605"}</div>
                  </div>
                  <div className="lp-review-body">{review.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-final">
          <div className="shell">
            <h2 className="lp-section-h2">Your first payday <span>starts today.</span></h2>
            <p className="lp-section-sub lp-final-sub">Join 300+ students who stopped watching and started closing.</p>
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
            <div className="modal-head">
              <div className="modal-title">Join <em>Real Venture</em></div>
              <p className="modal-tag">One membership. Cancel anytime.</p>
            </div>
            <div className="modal-tiers">

              <div className="tier base">
                <div className="tier-icon"><img src="/crowns/base.png" alt="Base" width={62} height={54} /></div>
                <div className="tier-name">Base</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">19.99</span></div>
                <div className="tier-per">per month</div>
                <div className="tier-tag">Pull up a chair. Learn live.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Live calls Mon Wed Fri</li>
                  <li><span className="chk">{"✓"}</span>Full 13 lesson curriculum</li>
                  <li><span className="chk">{"✓"}</span>Discord community</li>
                  <li><span className="chk">{"✓"}</span>Studio deal analyzer</li>
                  <li><span className="chk">{"✓"}</span>Buyer CRM plus directory</li>
                  <li><span className="chk">{"✓"}</span>Contract templates</li>
                  <li><span className="chk">{"✓"}</span>LLC and Bank Playbook</li>
                  <li><span className="chk">{"✓"}</span>14 day First Deal Sprint</li>
                </ul>
                <button className="tier-cta">Choose Base {"→"}</button>
              </div>

              <div className="tier pro">
                <div className="ribbon">Most Popular</div>
                <div className="tier-icon"><img src="/crowns/pro.png" alt="Pro" width={62} height={54} /></div>
                <div className="tier-name">Pro</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">49.99</span></div>
                <div className="tier-per">per month</div>
                <div className="tier-tag">Everything in Base plus we JV your deals.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li className="hero"><span className="chk">{"✓"}</span>JV on your deals, keep 60%</li>
                  <li><span className="chk">{"✓"}</span>Everything in Base</li>
                  <li><span className="chk">{"✓"}</span>Contract generator (auto fill)</li>
                  <li><span className="chk">{"✓"}</span>Proof of Funds letters</li>
                  <li><span className="chk">{"✓"}</span>Complete buyer network access</li>
                  <li><span className="chk">{"✓"}</span>All previous call recordings</li>
                  <li><span className="chk">{"✓"}</span>Priority DM support</li>
                </ul>
                <button className="tier-cta">Choose Pro {"→"}</button>
              </div>

              <div className="tier ultra">
                <div className="ribbon coming">Coming Soon</div>
                <div className="tier-icon"><img src="/crowns/ultra.png" alt="Ultra" width={62} height={54} /></div>
                <div className="tier-name">Ultra</div>
                <div className="tier-price"><span className="cur">$</span><span className="amt">249</span></div>
                <div className="tier-per">per month {"•"} 25 seats</div>
                <div className="tier-tag">Get in the room with William.</div>
                <div className="tier-divider"></div>
                <ul className="tier-feats">
                  <li><span className="chk">{"✓"}</span>Everything in Pro</li>
                  <li><span className="chk">{"✓"}</span>Direct DM to William</li>
                  <li><span className="chk">{"✓"}</span>Monthly Mastermind Call</li>
                  <li><span className="chk">{"✓"}</span>Founder review of first 3 offers</li>
                  <li><span className="chk">{"✓"}</span>Priority JV queue (24hr)</li>
                  <li><span className="chk">{"✓"}</span>Private Ultra Discord channel</li>
                  <li><span className="chk">{"✓"}</span>First 10 lock $149 forever</li>
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
        </div>
      </div>
    </>
  );
}
