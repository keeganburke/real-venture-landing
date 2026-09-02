"use client";

import { useEffect, useRef, useState } from "react";
import CtaStrip from "./CtaStrip";
import TrustRow from "./TrustRow";

const VIMEO_ID = "1223482453";

// Vendor-prefixed fullscreen, still the only path on iOS Safari.
type FsElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
type FsDocument = Document & {
  webkitExitFullscreen?: () => Promise<void>;
  webkitFullscreenElement?: Element | null;
};

type Props = { onJoin: () => void };

export default function VideoWalkthrough({ onJoin }: Props) {
  const [open, setOpen] = useState(false);
  // The thumbnail may not be present in every environment; hide the <img> on
  // error so the poster shows its own dark ground, not a broken-image glyph.
  const [thumbOk, setThumbOk] = useState(true);
  const modalRef = useRef<HTMLDivElement | null>(null);

  const exitFullscreen = () => {
    const doc = document as FsDocument;
    if (doc.fullscreenElement || doc.webkitFullscreenElement) {
      void (doc.exitFullscreen?.() ?? doc.webkitExitFullscreen?.())?.catch(() => {});
    }
  };

  const close = () => {
    setOpen(false);
    exitFullscreen();
  };

  const openModal = () => {
    setOpen(true);
    const el = modalRef.current as FsElement | null;
    if (!el) return;
    void (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.())?.catch(() => {});
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <section className="lp-section lp-walkthrough">
      <div className="shell">
        {/* Same head markup as SectionHead, minus the eyebrow slot. */}
        <div className="lp-section-head">
          <h2 className="lp-section-h2">
            Exactly what you get.
            <br />
            <span>In 60 seconds.</span>
          </h2>
          <p className="lp-section-sub">All the tools, resources, and support you need.</p>
        </div>

        <button
          type="button"
          className="lp-walkthrough-poster"
          onClick={openModal}
          aria-label="Play the 60 second walkthrough"
        >
          {thumbOk && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/william-thumb.jpg"
              alt="William Lynch"
              className="lp-walkthrough-poster-img"
              onError={() => setThumbOk(false)}
            />
          )}
          <span className="lp-walkthrough-poster-vignette" aria-hidden="true" />
          <span className="lp-walkthrough-poster-glow" aria-hidden="true" />
          <span className="lp-walkthrough-play-btn" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>

        <div className="lp-cta-after">
          <CtaStrip onJoin={onJoin} />
          <TrustRow />
        </div>
      </div>

      {/* The wrapper stays mounted so the fullscreen ref exists and the fade
          runs; the iframe only mounts on open, so nothing loads or autoplays
          until the poster is clicked. */}
      <div
        className={`lp-walkthrough-modal${open ? " is-open" : ""}`}
        ref={modalRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="60 second walkthrough"
      >
        <button
          type="button"
          className="lp-walkthrough-modal-close"
          onClick={close}
          aria-label="Close video"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {open && (
          <div className="lp-walkthrough-modal-frame">
            <iframe
              src={`https://player.vimeo.com/video/${VIMEO_ID}?autoplay=1&title=0&byline=0&portrait=0&playsinline=0`}
              frameBorder="0"
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              title="60 second walkthrough"
              style={{ width: "min(400px, 90vw)", aspectRatio: "9 / 16", maxHeight: "90vh" }}
            />
          </div>
        )}
      </div>
    </section>
  );
}
