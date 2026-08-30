"use client";

import { useSyncExternalStore } from "react";

// One stable string, so useSyncExternalStore's Object.is check passes and the
// snapshot does not resubscribe on every render.
function monthPair() {
  const now = new Date();
  const label = (d: Date) => d.toLocaleString("default", { month: "long" }).toUpperCase();
  // Same two-month horizon as the /start pill.
  return `${label(now)}|${label(new Date(now.getFullYear(), now.getMonth() + 2, 1))}`;
}

// The value never changes while the page is open, so there is nothing to
// subscribe to; the unsubscribe is a no-op.
const subscribe = () => () => {};

export default function FreeHeroPill() {
  // /free is statically prerendered. The /start funnel computes the months at
  // render and pins them with suppressHydrationWarning, which does not work
  // here: per node_modules/next/dist/docs/01-app/02-guides/preventing-flash-
  // before-hydration.md, that attribute makes React keep whatever is already
  // in the DOM, so the pill would advertise the month the site was BUILT in
  // until the next deploy. Returning null as the server snapshot instead lets
  // the prerender and the hydration pass agree, and React swaps in the real
  // client value immediately after hydration — so the months follow the
  // visitor's calendar, not the deploy date.
  const pair = useSyncExternalStore(subscribe, monthPair, () => null);

  if (!pair) {
    // Holds the pill's exact height so the hero does not shift when the real
    // sentence lands a tick later.
    return <div className="lp-hero-pill lp-hero-pill-pending" aria-hidden="true" />;
  }

  const [current, future] = pair.split("|");

  return (
    <div className="lp-hero-pill">
      <span className="lp-hero-pill-dot" aria-hidden="true" />
      <span className="lp-hero-pill-txt">
        SEEING THIS IN {current}? CLOSE YOUR FIRST DEAL BY {future}
      </span>
    </div>
  );
}
