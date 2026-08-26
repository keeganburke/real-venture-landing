"use client";

import { useEffect, useRef, useState } from "react";
import NavDrawer from "./components/NavDrawer";

const LP_INCLUDED = [
  {
    num: "01",
    title: "Live teaching",
    desc: "3x/week calls with William + Keegan",
    icon: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  },
  {
    num: "02",
    title: "Buyer network",
    desc: "Send deals to our vetted buyers",
    icon: '<path d="M9 12l2 2 4-4M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  },
  {
    num: "03",
    title: "Deal analyzer",
    desc: "Any address, in under a minute",
    icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 9h6M9 13h6M9 17h4"/>',
  },
  {
    num: "04",
    title: "Contracts",
    desc: "Auto-fill or use templates",
    icon: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8"/>',
  },
  {
    num: "05",
    title: "Discord community",
    desc: "300+ members, 24/7 wins",
    icon: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/>',
  },
  {
    num: "06",
    title: "14-day sprint",
    desc: "Contract by day 14, most members",
    icon: '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>',
  },
];

// TODO: placeholder testimonials, swap for real Vimeo embeds later.
const LP_TESTIMONIALS = [
  { id: "marcus", attr: "Marcus T.", detail: "$18,000 first assignment · 22 days" },
  { id: "sara", attr: "Sara R.", detail: "$12,500 in month 2 · closed via JV" },
  { id: "devon", attr: "Devon K.", detail: "3 deals since joining · $56k YTD" },
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

// TODO: all 7 payout cards below are placeholders, swap in real payout
// screenshots and names when Keegan supplies them.
const LP_PAYOUTS = [
  { amt: "$18k", lbl: "assignment fee", name: "Marcus T." }, // TODO placeholder
  { amt: "$12.5k", lbl: "month 2", name: "Sara R." }, // TODO placeholder
  { amt: "$24k", lbl: "first wire", name: "Devon K." }, // TODO placeholder
  { amt: "$8.2k", lbl: "first deal", name: "Alex M." }, // TODO placeholder
  { amt: "$32k", lbl: "2 deals", name: "Jordan L." }, // TODO placeholder
  { amt: "$9k", lbl: "first month", name: "Casey P." }, // TODO placeholder
  { amt: "$15k", lbl: "JV split", name: "Riley B." }, // TODO placeholder
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

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
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [autoFlipped, setAutoFlipped] = useState<number[]>([]);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const autoDemoDone = useRef(new Set<number>());
  const demoTimers = useRef<number[]>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number((entry.target as HTMLElement).dataset.index);
          if (autoDemoDone.current.has(index)) return;
          autoDemoDone.current.add(index);
          observer.unobserve(entry.target);
          const startTimer = window.setTimeout(() => {
            setAutoFlipped((prev) => [...prev, index]);
            const endTimer = window.setTimeout(() => {
              setAutoFlipped((prev) => prev.filter((i) => i !== index));
            }, 1200);
            demoTimers.current.push(endTimer);
          }, index * 150);
          demoTimers.current.push(startTimer);
        });
      },
      { threshold: 0.6 }
    );
    cardRefs.current.forEach((el) => el && observer.observe(el));
    const timers = demoTimers.current;
    return () => {
      observer.disconnect();
      timers.forEach(clearTimeout);
    };
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

  const toggleCard = (index: number) => {
    if (window.matchMedia("(hover: none)").matches) {
      setExpandedCard((current) => (current === index ? null : index));
    }
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
                className="lp-nav-segment"
                onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
                aria-label="Real Venture, back to top"
              >
                <img src="/logo.png" alt="" width={30} height={30} style={{ borderRadius: 8 }} />
                <span className="lp-nav-wordmark">
                  REAL <b>VENTURE</b>
                </span>
              </button>
              <span className="lp-nav-divider" />
              <a className="lp-nav-segment" href="/api/auth/whop/start">
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

        <section className="hero">
          <div className="shell">
            <div className="hero-eyebrow">REAL VENTURE: PROVEN PATH TO SUCCESS</div>
            <h1 className="lp-hero-h">{"Your first real estate payday. We'll walk you there."}</h1>
            <p className="hero-sub">{"We teach you live, hand you the tools, and send real buyers to your deals. Every question answered, every step covered. No license, no capital, no experience needed."}</p>
            <div className="hero-cta-row">
              <button className="btn-primary" onClick={openPricing}>
                Join for $19.99/mo
                <ArrowIcon />
              </button>
              <button className="btn-secondary" onClick={() => scrollToSection("included")}>
                {"See what's inside ↓"}
              </button>
            </div>
            {/* TODO: Keegan drops 1.jpg, 2.jpg, 3.jpg, 4.jpg (200x200+) into /public/avatars/, CSS fallback renders gradient circles until then. */}
            <div className="lp-social">
              <div className="lp-avatar-stack">
                {[
                  "linear-gradient(135deg,#FFE89A,#B8881F)",
                  "linear-gradient(135deg,#a78bfa,#7c3aed)",
                  "linear-gradient(135deg,#5FB3E0,#3b82f6)",
                  "linear-gradient(135deg,#4ade80,#16a34a)",
                ].map((fallback, i) => (
                  <span
                    className="lp-avatar"
                    key={i}
                    style={{ background: `url(/avatars/${i + 1}.jpg) center/cover, ${fallback}` }}
                  />
                ))}
              </div>
              <div className="lp-avatar-label">
                <b>300+</b> active students
              </div>
            </div>
            <div className="hero-trust">
              <span><CheckIcon /><b>Cancel anytime</b></span>
              <span>{"•"}</span>
              <span><CheckIcon /><b>Secured by Whop</b></span>
            </div>
          </div>
        </section>

        <section className="lp-payouts">
          <div className="lp-payouts-eyebrow">REAL STUDENT PAYOUTS</div>
          <div className="lp-marquee">
            <div className="lp-marquee-track">
              {[...LP_PAYOUTS, ...LP_PAYOUTS].map((p, i) => (
                <div
                  className="lp-payout-card"
                  key={i}
                  aria-hidden={i >= LP_PAYOUTS.length || undefined}
                >
                  <div className="lp-payout-amt">{p.amt}</div>
                  <div className="lp-payout-lbl">{p.lbl}</div>
                  <div className="lp-payout-name">{p.name}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-inc" id="included">
          <div className="shell">
            <div className="lp-inc-head">
              <div className="lp-inc-eyebrow">EVERYTHING YOU GET</div>
              <h2 className="lp-inc-h2">The full toolkit</h2>
              <p className="lp-inc-sub">Live teaching. Real buyers. Every tool. Every script. Every step.</p>
            </div>
            <div className="lp-flip-grid">
              {LP_INCLUDED.map((card, i) => (
                <div
                  className={`lp-flip-card${expandedCard === i || autoFlipped.includes(i) ? " flipped" : ""}`}
                  key={i}
                  data-index={i}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  onClick={() => toggleCard(i)}
                >
                  <div className="lp-flip-inner">
                    <div className="lp-flip-face lp-flip-front">
                      <div className="lp-flip-num">{card.num}</div>
                      <div
                        className="lp-flip-icn"
                        dangerouslySetInnerHTML={{
                          __html: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${card.icon}</svg>`,
                        }}
                      />
                      <div className="lp-flip-title">{card.title}</div>
                    </div>
                    <div className="lp-flip-face lp-flip-back">
                      <div className="lp-flip-num">{card.num}</div>
                      <div className="lp-flip-title">{card.title}</div>
                      <div className="lp-flip-desc">{card.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-pricing">
          <div className="shell">
            <div className="lp-sec-head">
              <div className="lp-sec-eyebrow">CHOOSE YOUR PLAN</div>
              <h2 className="lp-sec-h2">Three ways in.</h2>
              <p className="lp-sec-sub">Start on Base, upgrade to Pro when you close.</p>
            </div>
            <div className="lp-tier-stack">
              <div className="lp-tier">
                <div className="lp-tier-crown">{"\u{1F451}"}</div>
                <div className="lp-tier-name">Base</div>
                <div className="lp-tier-price"><b>$19.99</b><span> / month</span></div>
                <ul className="lp-tier-feats">
                  <li>Discord + community</li>
                  <li>3x/week live calls</li>
                  <li>Full 13-lesson curriculum</li>
                  <li>Deal analyzer + contract templates</li>
                  <li>14-day First Deal Sprint</li>
                </ul>
                <button className="lp-tier-cta" onClick={openPricing}>Get started {"→"}</button>
              </div>
              <div className="lp-tier pro">
                <span className="lp-most-pop">Most Popular</span>
                <div className="lp-tier-crown">{"\u{1F451}"}</div>
                <div className="lp-tier-name">Pro</div>
                <div className="lp-tier-price"><b>$49.99</b><span> / month</span></div>
                <ul className="lp-tier-feats">
                  <li>Everything in Base</li>
                  <li><b>We close deals with you. 60% to you.</b></li>
                  <li>Buyer network access</li>
                  <li>Auto-fill contracts + Proof of Funds</li>
                  <li>All call recordings + priority DM</li>
                </ul>
                <button className="lp-tier-cta" onClick={openPricing}>Join Pro {"→"}</button>
              </div>
              <div className="lp-tier ultra">
                <span className="lp-soon">Coming Soon</span>
                <div className="lp-tier-crown">{"\u{1F451}"}</div>
                <div className="lp-tier-name">Ultra</div>
                <div className="lp-tier-price"><b>$249</b><span> / month</span></div>
                <ul className="lp-tier-feats">
                  <li>{"Direct DM with William & Keegan"}</li>
                  <li>Monthly mastermind</li>
                  <li>Founder review of your offers</li>
                  <li>First 10: $149/mo locked forever</li>
                </ul>
                <button className="lp-tier-cta" disabled>Notify me</button>
              </div>
            </div>
          </div>
        </section>

        <section className="lp-testimonials">
          <div className="shell">
            <div className="lp-sec-head">
              <div className="lp-sec-eyebrow">REAL WINS, REAL STUDENTS</div>
              <h2 className="lp-sec-h2">See the payoff.</h2>
              <p className="lp-sec-sub">Real students. Real deals. Real dollars.</p>
            </div>
            <div className="lp-video-stack">
              {LP_TESTIMONIALS.map((t) => (
                <div className="lp-testimonial-card" key={t.id}>
                  <button
                    className="lp-video-thumb"
                    onClick={() => console.log(`TODO: open Vimeo modal for testimonial ${t.id}`)}
                    aria-label={`Play testimonial from ${t.attr}`}
                  >
                    <span className="lp-play-btn" />
                  </button>
                  <div className="lp-video-meta">
                    <div className="lp-video-attr">{t.attr}</div>
                    <div className="lp-video-detail">{t.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="reviews" className="lp-reviews">
          <div className="shell">
            <div className="lp-sec-head">
              <div className="lp-sec-eyebrow">VERIFIED REVIEWS</div>
              <h2 className="lp-sec-h2">What members say.</h2>
              <p className="lp-sec-sub">All reviews collected + verified by Whop.</p>
            </div>
            <div className="lp-review-summary">
              <div className="lp-reviews-score">4.9</div>
              <div>
                <div className="lp-reviews-stars">{"★★★★★"}</div>
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
                    <div className="lp-review-stars">{"★★★★★"}</div>
                  </div>
                  <div className="lp-review-body">{review.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-final-cta">
          <div className="shell">
            <h2 className="lp-final-h">Your first payday <span>starts today.</span></h2>
            <p className="lp-final-sub">Join 300+ students who stopped watching and started closing.</p>
            <button className="btn-primary" onClick={openPricing}>
              Join for $19.99/mo
              <ArrowIcon />
            </button>
            <div className="hero-trust">
              <span><CheckIcon /><b>Cancel anytime</b></span>
              <span>{"•"}</span>
              <span><CheckIcon /><b>Secured by Whop</b></span>
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="shell">
            <div className="footer-inner">
              <div className="footer-brand"><img src="/logo.png" alt="Real Venture" width={24} height={24} style={{ borderRadius: 6 }} /><span>Real Venture</span></div>
              <div className="footer-links">
                <a onClick={openPricing}>Pricing</a>
                <a onClick={() => scrollToSection("included")}>What is included</a>
                <a onClick={() => scrollToSection("reviews")}>Reviews</a>
                <a href="/api/auth/whop/start">Log in</a>
              </div>
            </div>
            <div className="footer-legal">{"©"} 2026 Real Venture · realventure.io · Not financial advice. Not a license.</div>
          </div>
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
