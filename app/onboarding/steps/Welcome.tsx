"use client";

type Props = {
  onStart: () => void;
  onSkip: () => void;
  busy: boolean;
};

export default function Welcome({ onStart, onSkip, busy }: Props) {
  return (
    <div className="welcome">
      <div className="wel-badge">{"✓ Payment confirmed"}</div>
      <div className="wel-avatars">
        <img className="wel-av k" src="/founders/keegan.png" alt="Keegan" width={80} height={80} />
        <img className="wel-av h" src="/founders/will.jpg" alt="Henry" width={80} height={80} />
      </div>
      <h1 className="wel-h">
        Welcome to <span>Real Venture</span>
      </h1>
      <p className="wel-body">
        {"You're in. We'll ask 5 quick questions so we can point you at the right thing first."}
      </p>
      <p className="wel-from">
        From <b>Keegan</b> and <b>Henry</b>
      </p>
      <button className="wel-cta" onClick={onStart} disabled={busy}>
        {"Let's go →"}
      </button>
      <button className="wel-skip" onClick={onSkip} disabled={busy}>
        {"I know what I'm doing, skip"}
      </button>
    </div>
  );
}
