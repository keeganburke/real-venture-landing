"use client";

import { useEffect, useState } from "react";
import { WhopCheckoutEmbed } from "@whop/checkout/react";

// Base plan. Every trap point in the demo uses this one plan id, matching the
// pricing modal's Base tier (LandingClient PLANS.base).
const BASE_PLAN_ID = "plan_2NqC2WJzV87QY";

type SceneName = "analyzer" | "live" | "discord" | "buyers" | "sprint" | "contracts";
type ViewMode = "scene" | "checkout";

const SCENES: SceneName[] = ["analyzer", "live", "discord", "buyers", "sprint", "contracts"];

type Props = {
  open: boolean;
  onClose: () => void;
  // "Skip to pricing" needs a real destination: there is no #pricing anchor on
  // the page, so the host hands us the pricing modal opener instead.
  onSkipToPricing?: () => void;
};

export default function ProductDemo({ open, onClose, onSkipToPricing }: Props) {
  const [sceneIdx, setSceneIdx] = useState(0);
  const [view, setView] = useState<ViewMode>("scene");

  // Scroll lock + Esc, same pattern as the pricing modal in LandingClient.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const currentScene = SCENES[sceneIdx];
  const isLast = sceneIdx === SCENES.length - 1;

  const goNext = () => {
    if (!isLast) setSceneIdx(sceneIdx + 1);
  };
  const goBack = () => {
    if (sceneIdx > 0) setSceneIdx(sceneIdx - 1);
  };
  const trapToCheckout = () => setView("checkout");
  const closeAll = () => {
    setSceneIdx(0);
    setView("scene");
    onClose();
  };
  const skipToPricing = () => {
    closeAll();
    onSkipToPricing?.();
  };

  if (!open) return null;

  return (
    <div className="demo-page" role="dialog" aria-modal="true" aria-label="Product demo">
      <div className="demo-topbar">
        <div className="demo-progress">
          {SCENES.map((name, i) => (
            <span
              key={name}
              className={`demo-dot ${i === sceneIdx ? "demo-dot-active" : ""} ${i < sceneIdx ? "demo-dot-done" : ""}`}
              aria-hidden="true"
            />
          ))}
        </div>
        <button className="demo-close" onClick={closeAll} aria-label="Close demo">×</button>
      </div>

      <div className="demo-viewport">
        {view === "checkout" ? (
          <CheckoutScene onBack={() => setView("scene")} />
        ) : (
          <>
            {currentScene === "analyzer" && <AnalyzerScene onTrap={trapToCheckout} />}
            {currentScene === "live" && <LiveCallScene onTrap={trapToCheckout} />}
            {currentScene === "discord" && <DiscordScene onTrap={trapToCheckout} />}
            {currentScene === "buyers" && <BuyersScene onTrap={trapToCheckout} />}
            {currentScene === "sprint" && <SprintScene onTrap={trapToCheckout} />}
            {currentScene === "contracts" && <ContractsScene onTrap={trapToCheckout} />}
          </>
        )}
      </div>

      {view === "scene" && (
        <div className="demo-footer">
          <div className="demo-nav">
            {sceneIdx > 0 && (
              <button className="demo-btn demo-btn-ghost" onClick={goBack}>Back</button>
            )}
            {!isLast && (
              <button className="demo-btn demo-btn-primary" onClick={goNext}>Next →</button>
            )}
            {isLast && (
              <button className="demo-btn demo-btn-gold" onClick={trapToCheckout}>
                Get in for $19.99/mo →
              </button>
            )}
          </div>
          <button type="button" className="demo-skip" onClick={skipToPricing}>
            Skip to pricing →
          </button>
        </div>
      )}
    </div>
  );
}

// ===== SCENE COMPONENTS =====

function AnalyzerScene({ onTrap }: { onTrap: () => void }) {
  return (
    <section className="demo-scene demo-scene-analyzer">
      <div className="demo-scene-label">01 · Deal Analyzer</div>
      <h2 className="demo-scene-title">Any address → max offer in 30 seconds.</h2>

      <div className="demo-analyzer-input">
        <label>Paste any Zillow URL</label>
        <div className="demo-analyzer-typewriter">
          <span className="demo-typed">zillow.com/homes/2525-Beverly-Ave-Akron-OH-44312</span>
          <span className="demo-caret" />
        </div>
        <button className="demo-analyzer-run" onClick={onTrap}>Analyze deal →</button>
      </div>

      <div className="demo-analyzer-result">
        <div className="demo-result-row">
          <div><span className="demo-result-label">ARV</span><span className="demo-result-value">$185,000</span></div>
          <div><span className="demo-result-label">Repairs</span><span className="demo-result-value">$24,000</span></div>
        </div>
        <div className="demo-result-row demo-result-hero">
          <div><span className="demo-result-label">Max Offer</span><span className="demo-result-value demo-result-gold">$133,000</span></div>
          <div><span className="demo-result-label">Your Profit</span><span className="demo-result-value demo-result-gold">$15,000</span></div>
        </div>
        <div className="demo-result-buyers">
          <span className="demo-buyer-badge">2 buyer matches</span>
        </div>
      </div>

      <div className="demo-scene-cta">
        <button className="demo-btn demo-btn-primary" onClick={onTrap}>
          Send this offer to buyers →
        </button>
        <p className="demo-scene-caption">Or paste your own address inside.</p>
      </div>
    </section>
  );
}

function LiveCallScene({ onTrap }: { onTrap: () => void }) {
  return (
    <section className="demo-scene demo-scene-live">
      <div className="demo-scene-label">02 · Live Coaching Call</div>
      <h2 className="demo-scene-title">7 live calls every week with William + Keegan.</h2>

      <div className="demo-live-frame">
        <div className="demo-live-video">
          <div className="demo-live-badge"><span className="demo-live-dot" /> LIVE</div>
          <div className="demo-live-viewers">34 watching</div>
          <div className="demo-live-placeholder">
            <span>William teaching live</span>
          </div>
        </div>
        <div className="demo-live-chat">
          <div className="demo-chat-message"><b>marcus</b> this is fire 🔥</div>
          <div className="demo-chat-message"><b>sara</b> taking notes rn</div>
          <div className="demo-chat-message"><b>devon</b> closing next week 💰</div>
          <div className="demo-chat-message demo-chat-you"><b>you</b> ask a question…</div>
        </div>
      </div>

      <div className="demo-scene-cta">
        <button className="demo-btn demo-btn-primary" onClick={onTrap}>
          Join the call live →
        </button>
      </div>
    </section>
  );
}

function DiscordScene({ onTrap }: { onTrap: () => void }) {
  return (
    <section className="demo-scene demo-scene-discord">
      <div className="demo-scene-label">03 · Discord Community</div>
      <h2 className="demo-scene-title">350+ members. 24/7 wins channel.</h2>

      <div className="demo-discord-frame">
        <div className="demo-discord-channel"># wins</div>
        <div className="demo-discord-feed">
          <DiscordMsg name="Badrobot" time="9:14 AM" text="Just closed! $8,000 assignment 🎉🔥" />
          <DiscordMsg name="Dylan" time="9:22 AM" text="$6K in 11 days from Real Venture 🙏" img="/wins/02-dylan-6000.png" />
          <DiscordMsg name="Yves" time="9:31 AM" text="Wire hit this morning 💰" img="/wins/03-yves-5000.png" />
          <DiscordMsg name="William" time="9:40 AM" text="Proud of you both. Who's next? 👀" />
          <DiscordMsg name="Mello" time="10:02 AM" text="Offer accepted today!!" />
        </div>
        <div className="demo-discord-input" onClick={onTrap}>
          <input type="text" placeholder="Say hi to the community…" readOnly onClick={onTrap} />
        </div>
      </div>

      <div className="demo-scene-cta">
        <button className="demo-btn demo-btn-primary" onClick={onTrap}>
          Say hi in the community →
        </button>
      </div>
    </section>
  );
}

function DiscordMsg({ name, time, text, img }: { name: string; time: string; text: string; img?: string }) {
  return (
    <div className="demo-discord-msg">
      <div className="demo-discord-msg-head"><b>{name}</b> <span>{time}</span></div>
      <div className="demo-discord-msg-body">{text}</div>
      {img && <img src={img} alt="" className="demo-discord-msg-img" />}
    </div>
  );
}

function BuyersScene({ onTrap }: { onTrap: () => void }) {
  const markets = [
    { city: "Akron, OH", deals: 8, hot: true },
    { city: "Cleveland, OH", deals: 11, hot: true },
    { city: "Detroit, MI", deals: 22, hot: true },
    { city: "St Louis, MO", deals: 20, hot: false },
  ];
  return (
    <section className="demo-scene demo-scene-buyers">
      <div className="demo-scene-label">04 · Vetted Buyer Network</div>
      <h2 className="demo-scene-title">Send your deals to real cash buyers. Skip cold outreach.</h2>

      <div className="demo-buyers-grid">
        {markets.map((m) => (
          <div key={m.city} className="demo-buyer-card">
            <div className="demo-buyer-head">
              <span className="demo-buyer-city">{m.city}</span>
              {m.hot && <span className="demo-buyer-hot">🔥 HOTTEST</span>}
            </div>
            <div className="demo-buyer-count">{m.deals} deals matched</div>
            <div className="demo-buyer-criteria">$0-250K · 70% ARV · 21-30 day close</div>
          </div>
        ))}
      </div>

      <div className="demo-scene-cta">
        <button className="demo-btn demo-btn-primary" onClick={onTrap}>
          Send this deal to buyers →
        </button>
      </div>
    </section>
  );
}

function SprintScene({ onTrap }: { onTrap: () => void }) {
  const days = [
    { day: 1, done: true, now: false, title: "Watch: Wholesaling overview" },
    { day: 2, done: true, now: false, title: "Introduce yourself in Discord" },
    { day: 3, done: false, now: true, title: "Run a deal" },
    { day: 5, done: false, now: false, title: "Pull your first leads" },
    { day: 7, done: false, now: false, title: "Send your first offers" },
    { day: 10, done: false, now: false, title: "Join a live call" },
    { day: 14, done: false, now: false, title: "Log your first win" },
  ];
  return (
    <section className="demo-scene demo-scene-sprint">
      <div className="demo-scene-label">05 · 14-Day First Deal Sprint</div>
      <h2 className="demo-scene-title">7 steps. Most members close by day 14.</h2>

      <div className="demo-sprint-list">
        {days.map((d) => (
          <div key={d.day} className={`demo-sprint-row ${d.done ? "done" : ""} ${d.now ? "now" : ""}`}>
            <div className="demo-sprint-badge">Day {d.day}</div>
            <div className="demo-sprint-title">
              {d.title}
              {d.now && <span className="demo-sprint-now">● NOW</span>}
            </div>
            <div className="demo-sprint-check">{d.done ? "✓" : ""}</div>
          </div>
        ))}
      </div>

      <div className="demo-scene-cta">
        <button className="demo-btn demo-btn-primary" onClick={onTrap}>
          Start Day 1 →
        </button>
      </div>
    </section>
  );
}

function ContractsScene({ onTrap }: { onTrap: () => void }) {
  const templates = [
    { name: "Purchase Agreement", tag: "Base" },
    { name: "Assignment Contract", tag: "Base" },
    { name: "Proof of Funds", tag: "Base" },
    { name: "JV Agreement", tag: "Base" },
  ];
  return (
    <section className="demo-scene demo-scene-contracts">
      <div className="demo-scene-label">06 · Contract Templates</div>
      <h2 className="demo-scene-title">Every contract you need. Ready to send.</h2>

      <div className="demo-contracts-grid">
        {templates.map((t) => (
          <div key={t.name} className="demo-contract-card">
            <div className="demo-contract-icon">📄</div>
            <div className="demo-contract-name">{t.name}</div>
            <div className="demo-contract-tag">{t.tag}</div>
          </div>
        ))}
      </div>

      <div className="demo-contracts-pro">
        <span className="demo-contracts-pro-tag">PRO</span>
        <span className="demo-contracts-pro-text">
          Contract Generator auto-fills every field. Upgrade to Pro for the full sauce.
        </span>
      </div>

      <div className="demo-scene-cta">
        <button className="demo-btn demo-btn-gold" onClick={onTrap}>
          Get in for $19.99/mo →
        </button>
      </div>
    </section>
  );
}

function CheckoutScene({ onBack }: { onBack: () => void }) {
  return (
    <section className="demo-scene demo-scene-checkout">
      <button className="demo-checkout-back" onClick={onBack}>← Back to demo</button>
      <div className="demo-checkout-frame">
        <h2 className="demo-scene-title demo-checkout-title">You&apos;ve seen inside. Ready?</h2>
        <p className="demo-checkout-sub">$19.99/mo · Cancel anytime</p>
        {/* Same props as the pricing modal's embed (LandingClient), Base plan. */}
        <WhopCheckoutEmbed
          planId={BASE_PLAN_ID}
          theme="dark"
          themeOptions={{
            backgroundColor: "#0f0f12",
            accentColor: "#E5A544",
            borderRadius: 12,
          }}
          skipRedirect
          onComplete={() => {
            window.location.href = "/login?justpurchased=1";
          }}
        />
      </div>
    </section>
  );
}
