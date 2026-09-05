"use client";

type Props = {
  onStart: () => void;
  busy: boolean;
};

export default function Welcome({ onStart, busy }: Props) {
  return (
    <div className="welcome">
      <div className="wel-badge">{"✓ Payment confirmed"}</div>
      <div className="wel-avatars">
        <img className="wel-av k" src="/founders/will.jpg" alt="William" width={80} height={80} />
        <img className="wel-av h" src="/founders/keegan.png" alt="Keegan" width={80} height={80} />
      </div>
      <h1 className="wel-h">
        Welcome to <span>Real Venture</span>
      </h1>
      <p className="wel-body">
        Answer these <span className="wel-body-em">7 quick questions</span> so we can custom
        build your experience.
      </p>
      <p className="wel-from">
        From <b>William</b> and <b>Keegan</b>
      </p>
      <button className="wel-cta" onClick={onStart} disabled={busy}>
        {"Start →"}
      </button>
    </div>
  );
}
