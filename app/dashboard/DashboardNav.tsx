"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import MenuDropdown from "./MenuDropdown";
import DashboardNavDrawer from "./DashboardNavDrawer";

type Props = {
  avatarUrl: string | null;
  initial: string;
};

// The landing nav pill (app/page.tsx) with dashboard content: drawer menu,
// logo home button, avatar dropdown. Reuses the lp-nav* styles verbatim.
export default function DashboardNav({ avatarUrl, initial }: Props) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <>
      <nav className="lp-nav dash-nav">
        <div className="lp-nav-inner">
          <div className="lp-nav-pill">
            <button
              className="lp-nav-segment"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-label="Menu"
              aria-expanded={drawerOpen}
            >
              <span className={`lp-burger${drawerOpen ? " open" : ""}`}>
                <span />
                <span />
                <span />
              </span>
              <span className="lp-nav-label">MENU</span>
            </button>
            <span className="lp-nav-divider" />
            <button
              className="lp-nav-segment lp-nav-logo-seg"
              onClick={() => router.push("/dashboard")}
              aria-label="Real Venture, back to hub"
            >
              <img className="lp-nav-logo" src="/logo.png" alt="Real Venture" width={44} height={44} />
            </button>
            <span className="lp-nav-divider" />
            <div className="lp-nav-segment lp-nav-avatar-seg">
              <MenuDropdown avatarUrl={avatarUrl} initial={initial} />
            </div>
          </div>
        </div>
      </nav>

      <DashboardNavDrawer open={drawerOpen} onClose={closeDrawer} />
    </>
  );
}
