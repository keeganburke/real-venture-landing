"use client";

import { Fragment, useEffect, useRef, useState } from "react";

const payouts = [
  { amt: "$8,400", name: "Dylan M.", meta: "Ohio • Aug 22", tag: "Closed" },
  { amt: "$6,200", name: "Jazmin R.", meta: "Texas • Aug 20", tag: "1st deal" },
  { amt: "$12,500", name: "Marcus C.", meta: "Florida • Aug 18", tag: "JV" },
  { amt: "$4,800", name: "Tyler W.", meta: "Georgia • Aug 17", tag: "Closed" },
  { amt: "$15,750", name: "Sarah R.", meta: "Arizona • Aug 15", tag: "Closed" },
  { amt: "$9,300", name: "Kyle J.", meta: "Nevada • Aug 14", tag: "JV" },
  { amt: "$7,100", name: "Amanda L.", meta: "NC • Aug 12", tag: "1st deal" },
  { amt: "$11,200", name: "Ryan B.", meta: "Colorado • Aug 10", tag: "Closed" },
  { amt: "$5,600", name: "Jason P.", meta: "Michigan • Aug 8", tag: "JV" },
  { amt: "$18,400", name: "Chris D.", meta: "Illinois • Aug 6", tag: "Closed" },
];

const incCards = [
  {
    emoji: "\u{1F3A5}",
    title: "Live coaching, 3 days a week",
    short: "Mon Wed Fri live sessions",
    desc: "Live with William and Keegan. Q and A, deal reviews, and we call sellers on screen. Recordings drop right after.",
  },
  {
    emoji: "\u{1F4DA}",
    title: "13 lesson curriculum",
    short: "Video, workbook, quiz per lesson",
    desc: "From orientation to case studies. Built to actually finish. Each lesson has a short video, written breakdown, and a quiz.",
  },
  {
    emoji: "\u{1F4CA}",
    title: "Studio Deal Analyzer",
    short: "ARV, MAO, comps in seconds",
    desc: "Drop any address in and get an underwrite in under 10 seconds. Unlimited runs on any tier. Real time comps from public data.",
  },
  {
    emoji: "\u{1F48E}",
    title: "Buyer CRM + Network",
    short: "Track your buyers and their boxes",
    desc: "Add cash buyers as you meet them. Filter by market, price band, and asset class. Plus browse our verified buyer network from day one.",
  },
  {
    emoji: "\u{1F4DD}",
    title: "Contract templates + scripts",
    short: "PA, assignment, cold call scripts",
    desc: "Purchase agreements, assignment contracts, cold call scripts, follow up texts. Fill in the blanks and send. Battle tested.",
  },
  {
    emoji: "\u{1F91D}",
    title: "Active community",
    short: "Discord + in-app chat, always on",
    desc: "Discord and in-app chat. Ask anything, log your wins, hang with people actually doing it. Not a graveyard, actually active daily.",
  },
];

const videos = [
  { duration: "3:42", title: "[Video 1 title from Vimeo]" },
  { duration: "4:18", title: "[Video 2 title from Vimeo]" },
  { duration: "5:03", title: "[Video 3 title from Vimeo]" },
];

const reviews = [
  { date: "Aug 22", body: "[Whop review 1 - short quote pulled from Whop review page.]", name: "Dylan M." },
  { date: "Aug 19", body: "[Whop review 2 - short quote from Whop.]", name: "Jazmin R." },
  { date: "Aug 15", body: "[Whop review 3 - short quote from Whop.]", name: "Marcus C." },
  { date: "Aug 12", body: "[Whop review 4 - short quote from Whop.]", name: "Sarah R." },
  { date: "Aug 8", body: "[Whop review 5 - short quote from Whop.]", name: "Amanda L." },
  { date: "Aug 5", body: "[Whop review 6 - short quote from Whop.]", name: "Ryan B." },
];

const marqueeItems = [
  "Find the buyer",
  "Match the deal",
  "Call the seller",
  "Lock the contract",
  "Assign and close",
  "Get paid",
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
        <nav className="nav">
          <div className="shell nav-inner">
            <div className="nav-brand">
              <img src="/logo.png" alt="Real Venture" width={32} height={32} style={{ borderRadius: 8 }} />
              <div className="nav-name">Real Venture</div>
            </div>
            <div className="nav-links">
              <a onClick={() => scrollToSection("included")}>What is included</a>
              <a onClick={openPricing}>Pricing</a>
              <a onClick={() => scrollToSection("reviews")}>Reviews</a>
            </div>
            <div className="nav-cta">
              <button className="nav-login">Log in</button>
              <button className="nav-join" onClick={openPricing}>Join now {"→"}</button>
            </div>
          </div>
        </nav>

        <section className="hero">
          <div className="shell">
            <div className="hero-eyebrow"><span className="dot"></span>Now enrolling</div>
            <h1>We teach you <em>secured wholesaling</em>. That is it.</h1>
            <p className="hero-sub">Live coaching <b>three days a week</b>, a course you actually finish, the deal analyzer, buyer CRM, and contract templates. Everything between you and your first assignment fee.</p>
            <div className="hero-cta-row">
              <button className="btn-primary" onClick={openPricing}>
                Join for $19.99/mo
                <ArrowIcon />
              </button>
              <button className="btn-secondary" onClick={() => scrollToSection("included")}>
                See everything you get
                <ArrowIcon />
              </button>
            </div>
            <div className="hero-trust">
              <span><CheckIcon /><b>Cancel anytime</b></span>
              <span>{"•"}</span>
              <span><CheckIcon /><b>Secured by Whop</b></span>
            </div>
          </div>
        </section>

        <section className="proof-strip">
          <div className="shell proof-inner">
            <div className="proof-item"><div className="proof-num g">3 days</div><div className="proof-lbl">Live coaching per week</div></div>
            <div className="proof-item"><div className="proof-num">200+</div><div className="proof-lbl">Active wholesalers</div></div>
            <div className="proof-item"><div className="proof-num">$0</div><div className="proof-lbl">Starting capital needed</div></div>
            <div className="proof-item"><div className="proof-num">No experience</div><div className="proof-lbl">Required</div></div>
          </div>
        </section>

        <div className="marquee">
          <div className="marquee-track">
            <span>
              {[...marqueeItems, ...marqueeItems].map((item, i) => (
                <Fragment key={i}>
                  {item} <span className="sep">{"✦"}</span>
                </Fragment>
              ))}
            </span>
          </div>
        </div>

        <section className="section section-cream" id="reviews">
          <div className="shell">
            <div className="section-head">
              <div className="section-eyebrow">Every payout, real time</div>
              <h2 className="section-h2">Members are actually <em>getting paid</em></h2>
              <p className="section-lead">Every one of these is a verified assignment fee wired to a Real Venture member. Live from the JV queue.</p>
            </div>
          </div>
          <div className="payouts-strip">
            <div className="payouts-track">
              {[...payouts, ...payouts].map((p, i) => (
                <div className="payout-card" key={i}>
                  <div className="payout-amt">{p.amt}</div>
                  <div className="payout-name">{p.name}</div>
                  <div className="payout-meta"><span>{p.meta}</span><span className="payout-tag">{p.tag}</span></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section" id="included">
          <div className="shell">
            <div className="section-head">
              <div className="section-eyebrow">What is included</div>
              <h2 className="section-h2">Everything you need to close your <em>first deal</em></h2>
              <p className="section-lead">Hover any card for details. One membership, all the tools.</p>
            </div>
            <div className="inc-grid">
              {incCards.map((card, i) => (
                <div
                  className={`inc-card${expandedCard === i || autoFlipped.includes(i) ? " flipped" : ""}`}
                  key={i}
                  data-index={i}
                  ref={(el) => {
                    cardRefs.current[i] = el;
                  }}
                  onClick={() => toggleCard(i)}
                >
                  <div className="inc-card-inner">
                    <div className="inc-face inc-front">
                      <div className="inc-emoji">{card.emoji}</div>
                      <div className="inc-title">{card.title}</div>
                      <div className="inc-short">{card.short}</div>
                      <div className="inc-hint">Hover<span className="dot-anim"></span></div>
                    </div>
                    <div className="inc-face inc-back">
                      <div className="inc-title">{card.title}</div>
                      <div className="inc-desc">{card.desc}</div>
                      <div className="anim-slot"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-deep">
          <div className="shell">
            <div className="section-head">
              <div className="section-eyebrow">Member stories</div>
              <h2 className="section-h2">Watch how members actually <em>close deals</em></h2>
              <p className="section-lead">Full stories from real members. Three short videos, straight from the source.</p>
            </div>
            <div className="video-grid">
              {videos.map((video, i) => (
                <div className="video-card" key={i}>
                  <div className="video-player">
                    <div className="play-btn">
                      <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4" /></svg>
                    </div>
                    <div className="video-duration">{video.duration}</div>
                  </div>
                  <div className="video-meta">
                    <div className="video-title">{video.title}</div>
                    <div className="video-attr">Member name<span className="dot">{"•"}</span>State</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section section-cream">
          <div className="shell">
            <div className="section-head">
              <div className="section-eyebrow">Whop reviews</div>
              <h2 className="section-h2">Straight from <em>our members</em></h2>
              <p className="section-lead">Every review below is from a paying member on Whop. Not curated. Not paid.</p>
            </div>
            <div className="reviews-grid">
              {reviews.map((review, i) => (
                <div className="review-card" key={i}>
                  <div className="review-head">
                    <div className="review-stars">{"★★★★★"}</div>
                    <div className="review-date">{review.date}</div>
                  </div>
                  <div className="review-body placeholder">{review.body}</div>
                  <div className="review-attr">
                    <span className="review-name">{review.name}</span>
                    <span>{"•"}</span>
                    <span>Member</span>
                    <span className="whop-badge">Whop</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div className="shell content">
            <h2>Everything you need. <em>One membership.</em></h2>
            <p>Stop watching YouTube and asking Reddit. Get the tools, the coaching, and the community that actually get you paid.</p>
            <button className="final-btn" onClick={openPricing}>
              Join for $19.99/mo
              <ArrowIcon />
            </button>
            <div className="final-guarantee">
              <span><CheckIcon />Cancel anytime</span>
              <span><CheckIcon />Secured by Whop</span>
            </div>
          </div>
        </section>

        <footer className="footer">
          <div className="shell">
            <div className="footer-inner">
              <div className="footer-brand"><img src="/logo.png" alt="Real Venture" width={24} height={24} style={{ borderRadius: 6 }} /><span>Real Venture</span></div>
              <div className="footer-links"><a>Studio login</a><a>Contact</a><a>Terms</a><a>Privacy</a></div>
            </div>
            <div className="footer-legal">{"©"} 2026 Real Venture. Wholesaling education. Not a get rich quick program. Results vary and depend on the effort you put in.</div>
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
