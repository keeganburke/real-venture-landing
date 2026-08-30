"use client";

const STUDIO_URL = "https://realventurestudio.com";

type Narrator = "keegan" | "william" | "both";

const steps: {
  target: string;
  title: string;
  body: string;
  narrator: Narrator;
  href?: string;
  linkLabel?: string;
}[] = [
  {
    target: "Welcome",
    title: "Welcome to Real Venture",
    body: "We built the Studio to walk you through wholesaling from your first buyer to your first close. Ready?",
    narrator: "both",
  },
  {
    target: "Sprint card",
    title: "Your 14-day sprint",
    body: "Follow the seven milestones in order. Every button routes you to the exact tool you need for that step.",
    narrator: "william",
    href: "/dashboard/sprint",
    linkLabel: "Open your sprint",
  },
  {
    target: "Livestreams",
    title: "Jump into Livestreams",
    body: "Eleven live calls a week. Coaching, deal reviews, buyer sourcing, mindset. All in Discord voice, all times PST.",
    narrator: "keegan",
    href: "/dashboard/livestreams",
    linkLabel: "See the schedule",
  },
  {
    target: "Learn",
    title: "Work the curriculum",
    body: "Thirteen lessons. Video, breakdown, quiz. Start at Lesson 1 and work down.",
    narrator: "william",
    href: "/dashboard/learn",
    linkLabel: "Open the course library",
  },
  {
    target: "Studio Analyzer",
    title: "Run your first deal",
    body: "Drop any address in and get ARV, MAO, and comps in under 10 seconds.",
    narrator: "keegan",
    href: STUDIO_URL,
  },
  {
    target: "Buyers CRM",
    title: "Load up your buyer list",
    body: "Add cash buyers as you meet them. Filter by market, price band, and asset class when a deal comes in.",
    narrator: "keegan",
    href: STUDIO_URL,
  },
  {
    target: "Contracts",
    title: "Grab a contract",
    body: "Templates and the auto-fill generator live here. Pro tier unlocks proof of funds letters too.",
    narrator: "william",
    href: STUDIO_URL,
  },
  {
    target: "Pipeline",
    title: "Track every deal",
    body: "Kanban board or table. Under contract, marketing, closed. Reminders and activity built in.",
    narrator: "keegan",
    href: STUDIO_URL,
  },
  {
    target: "Log a Win",
    title: "Log your wins",
    body: "Got a contract or buyer? Log it. Shows up in the community wins feed and starts your streak.",
    narrator: "william",
    href: STUDIO_URL,
  },
];

function ArrowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function NarratorBadge({ narrator }: { narrator: Narrator }) {
  if (narrator === "both") {
    return (
      <div className="ob-narrator">
        <div className="ob-faces">
          <img className="ob-face k" src="/founders/keegan.png" alt="Keegan" width={44} height={44} />
          <img className="ob-face w" src="/founders/will.jpg" alt="William" width={44} height={44} />
        </div>
        <div className="ob-name both">Keegan + William</div>
      </div>
    );
  }
  if (narrator === "william") {
    return (
      <div className="ob-narrator">
        <img className="ob-face w" src="/founders/will.jpg" alt="William" width={44} height={44} />
        <div className="ob-name w">William</div>
      </div>
    );
  }
  return (
    <div className="ob-narrator">
      <img className="ob-face k" src="/founders/keegan.png" alt="Keegan" width={44} height={44} />
      <div className="ob-name">Keegan</div>
    </div>
  );
}

type Props = {
  onDone: () => void;
  busy: boolean;
};

export default function Tour({ onDone, busy }: Props) {
  const startTour = () => {
    document.getElementById("step-1")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="ob-shell">
      <section className="ob-welcome">
        <div className="ob-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Payment confirmed
        </div>

        <div className="ob-avatars">
          <img className="ob-avatar k" src="/founders/keegan.png" alt="Keegan" width={88} height={88} />
          <img className="ob-avatar w" src="/founders/will.jpg" alt="William" width={88} height={88} />
        </div>

        <h1 className="ob-h1">Welcome to <em>Real Venture</em></h1>
        <p className="ob-sub">You are in. We are going to walk you through everything you just unlocked so you know exactly where everything is and what to do first.</p>
        <p className="ob-founders">From <b>Keegan</b> and <b>William</b></p>

        <div className="ob-actions">
          <button className="ob-primary" onClick={startTour} disabled={busy}>
            Take the 60 second tour
            <ArrowIcon />
          </button>
          <button className="ob-skip" onClick={onDone} disabled={busy}>
            I know what I am doing, skip the tour
          </button>
        </div>
      </section>

      <section className="ob-steps">
        {steps.map((step, i) => (
          <article className="ob-step" id={`step-${i + 1}`} key={i}>
            <div className="ob-step-head">
              <div className="ob-num">{i + 1}</div>
              <NarratorBadge narrator={step.narrator} />
            </div>
            <div className="ob-target">{step.target}</div>
            <div className="ob-title">{step.title}</div>
            <p className="ob-body">{step.body}</p>
            {step.href && (
              <a className="ob-link" href={step.href}>
                {step.linkLabel ?? "Open in the Studio"}
                <ArrowIcon />
              </a>
            )}
          </article>
        ))}
        <div className="ob-actions">
          <button className="ob-primary" onClick={onDone} disabled={busy}>
            Continue
            <ArrowIcon />
          </button>
        </div>
      </section>
    </div>
  );
}
