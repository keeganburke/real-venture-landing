"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
  onPricing: () => void;
};

export default function NavDrawer({ open, onClose, onNavigate, onPricing }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  return (
    <>
      <div className={`lp-drawer-backdrop${open ? " open" : ""}`} onClick={onClose} />
      <aside className={`lp-drawer${open ? " open" : ""}`} aria-hidden={!open}>
        <div className="lp-drawer-head">
          <button className="lp-drawer-close" onClick={onClose} aria-label="Close menu">
            {"×"}
          </button>
        </div>
        <nav className="lp-drawer-items">
          <button className="lp-drawer-item" onClick={() => onNavigate("included")}>
            <span className="lp-drawer-num">01</span>
            What is included
          </button>
          <button className="lp-drawer-item" onClick={onPricing}>
            <span className="lp-drawer-num">02</span>
            Pricing
          </button>
          <button className="lp-drawer-item" onClick={() => onNavigate("reviews")}>
            <span className="lp-drawer-num">03</span>
            Reviews
          </button>
        </nav>
      </aside>
    </>
  );
}
