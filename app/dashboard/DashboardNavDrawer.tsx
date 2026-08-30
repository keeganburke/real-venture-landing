"use client";

import { useEffect } from "react";
import Link from "next/link";

type Props = {
  open: boolean;
  onClose: () => void;
};

// Dashboard clone of the landing NavDrawer: same lp-drawer styling, but
// route links instead of the landing's scroll anchors.
export default function DashboardNavDrawer({ open, onClose }: Props) {
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

  const signOut = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Cookie clear failed; landing is still the safe destination.
    }
    window.location.href = "/";
  };

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
          <Link className="lp-drawer-item" href="/dashboard" onClick={onClose}>
            <span className="lp-drawer-num">01</span>
            Home
          </Link>
          <Link className="lp-drawer-item" href="/dashboard/sprint" onClick={onClose}>
            <span className="lp-drawer-num">02</span>
            Sprint
          </Link>
          <Link className="lp-drawer-item" href="/dashboard/learn" onClick={onClose}>
            <span className="lp-drawer-num">03</span>
            Learn
          </Link>
          <Link className="lp-drawer-item" href="/dashboard/livestreams" onClick={onClose}>
            <span className="lp-drawer-num">04</span>
            Livestreams
          </Link>
          <Link className="lp-drawer-item" href="/dashboard/tools" onClick={onClose}>
            <span className="lp-drawer-num">05</span>
            Tools
          </Link>
          <div className="dash-drawer-sep" aria-hidden="true"></div>
          <button className="lp-drawer-item dash-drawer-signout" onClick={signOut}>
            <span className="lp-drawer-num">06</span>
            Sign Out
          </button>
        </nav>
      </aside>
    </>
  );
}
