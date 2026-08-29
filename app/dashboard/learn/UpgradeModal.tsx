"use client";

import { useEffect } from "react";
import Link from "next/link";

type Props = {
  open: boolean;
  onClose: () => void;
};

// Shown when a Base member taps a Pro-only (Advanced) lesson.
export default function UpgradeModal({ open, onClose }: Props) {
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

  if (!open) return null;

  return (
    <div className="um-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="um-modal" role="dialog" aria-modal="true" aria-label="Pro upgrade required">
        <div className="um-icon" aria-hidden="true">🔒</div>
        <h2 className="um-title">This lesson is Pro-only</h2>
        <p className="um-body">
          {"Advanced lessons unlock with a Pro membership. You'll get access to Seller Financing, Reinvesting + Scaling, Case Studies, and everything else in Pro, including the full course library, contract generator, priority support, and JV deal submissions."}
        </p>
        <Link href="/manage-membership" className="um-upgrade-btn">
          Upgrade to Pro {"→"}
        </Link>
        <button type="button" className="um-later-btn" onClick={onClose}>
          Maybe later
        </button>
      </div>
    </div>
  );
}
