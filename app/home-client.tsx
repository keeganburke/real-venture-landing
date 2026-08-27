"use client";

import { useEffect, useState } from "react";
import NavDrawer from "./components/NavDrawer";
import CtaStrip from "./components/CtaStrip";
import SectionHead from "./components/SectionHead";
import PayoutCarousel from "./components/PayoutCarousel";
import ToolkitCards from "./components/ToolkitCards";
import Reviews from "./components/Reviews";
import type { ReviewsData } from "./lib/whop-reviews";

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
  "Live Q&A calls 6x/week + Discord 24/7",
  "Deal analyzer + contract templates ready",
  "Proven strategies to find buyers from the founders",
  "Countless testimonials and students actually getting paid",
  "Starting at the same price as your DoorDash order",
];

const LP_PHASES = [
  {
    num: "01",
    step: "Phase 1 · Days 1-4",
    title: "Learn the fundamentals",
    desc: "Watch the course content and jump in the live streams. Get the framework locked before you touch a single deal.",
  },
  {
    num: "02",
    step: "Phase 2 · Days 5-9",
    title: "Analyze deals and find buyers",
    desc: "Start pulling comps and running deals through the analyzer. Build your buyer list. Take real action every day.",
  },
  {
    num: "03",
    step: "Phase 3 · Days 10-14",
    title: "Send offers and get paid",
    desc: "Use the vetted contracts to send offers, lock up your first deal, and collect your assignment fee.",
  },
];

const LP_STORIES = [
  { id: "marcus", attr: "Marcus T.", detail: "$18,000 first assignment · 22 days" }, // TODO placeholder video, swap Vimeo embed
  { id: "sara", attr: "Sara R.", detail: "$12,500 in month 2 · closed via JV" }, // TODO placeholder video, swap Vimeo embed
  { id: "devon", attr: "Devon K.", detail: "3 deals since joining · $56k YTD" }, // TODO placeholder video, swap Vimeo embed
];


function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default function HomeClient({ reviewsData }: { reviewsData: ReviewsData }) {
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
              heading={<>The simple 3-step path to success.</>}
              sub="Each distinct phase to your first deal."
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
          </div>
        </section>

        <section className="lp-pricing">
          <div className="shell">
            <SectionHead
              heading={<>Three ways <span>in.</span></>}
              sub="Start on Base. Upgrade to Pro when you close."
            />
            <div className="modal-tiers lp-pricing-tiers">

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
                <button className="tier-cta" onClick={openPricing}>Choose Base {"→"}</button>
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
                <button className="tier-cta" onClick={openPricing}>Choose Pro {"→"}</button>
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
          </div>
        </section>

        <section id="reviews" className="lp-reviews">
          <div className="shell">
            <SectionHead
              heading={<>What members <span>say.</span></>}
              sub={reviewsData.source === "whop" ? "All reviews collected + verified by Whop." : "From our members on Whop."}
            />
            <div className="lp-review-summary">
              <div className="lp-reviews-score">{reviewsData.average.toFixed(1)}</div>
              <div>
                <div className="lp-reviews-stars">{"\u2605\u2605\u2605\u2605\u2605"}</div>
                <div className="lp-reviews-count">{reviewsData.total} verified reviews</div>
              </div>
            </div>
            <Reviews reviews={reviewsData.reviews} average={reviewsData.average} total={reviewsData.total} />
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
                  <li>300+ members closing deals with you</li>
                  <li>Finally start your journey in entrepreneurship</li>
                </ul>
              </div>

            </div>

            <div className="lp-choice-cta-row">
              <a
                href="https://www.indeed.com/companies"
                target="_blank"
                rel="noopener noreferrer"
                className="lp-choice-dead-btn"
              >
                Do It Your Way {"\u2192"}
              </a>
              <button
                type="button"
                onClick={openPricing}
                className="lp-cta-primary lp-cta-hero lp-choice-alive-btn"
              >
                Join Real Venture {"\u2192"}
              </button>
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
