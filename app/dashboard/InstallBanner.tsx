"use client";

import { useEffect, useState } from "react";

// iOS Safari install hint. Renders only on iOS, only outside standalone
// mode, and only until dismissed (localStorage).
export default function InstallBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("rv_install_banner_dismissed") === "1") return;
    } catch {
      return;
    }
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as { MSStream?: unknown }).MSStream;
    if (!isIOS) return;
    const nav = window.navigator as Navigator & { standalone?: boolean };
    if (nav.standalone === true) return;
    setShow(true);
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem("rv_install_banner_dismissed", "1");
    } catch {
      // Storage unavailable; hide for this page load only.
    }
    setShow(false);
  };

  return (
    <div className="install-banner">
      <span className="install-banner-text">
        📱 Install Real Venture as an app: tap Share {"→"} Add to Home Screen
      </span>
      <button type="button" className="install-banner-close" aria-label="Dismiss" onClick={dismiss}>
        ✕
      </button>
    </div>
  );
}
