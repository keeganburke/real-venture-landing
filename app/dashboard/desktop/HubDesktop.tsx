"use client";

import NavBar from "./NavBar";
import HeroBand from "./HeroBand";
import SprintFullWidth from "./SprintFullWidth";
import SecondaryGrid from "./SecondaryGrid";

type Props = {
  // Shared with the mobile renderer. Desktop keeps the sprint always visible
  // (per mockup) and has no dismissable Discord card, so these are unused
  // until the hide-sprint interaction lands.
  sprintOpen: boolean;
  discordDismissed: boolean;
};

export default function HubDesktop({
  sprintOpen: _sprintOpen,
  discordDismissed: _discordDismissed,
}: Props) {
  return (
    <div className="hub-d-root">
      <NavBar />
      <HeroBand />

      <div className="hub-d-grid-section">
        <div className="hub-d-grid-inner">
          <div className="hub-d-section-h">
            <h2>
              Your <span>14-day sprint</span>
            </h2>
            {/* TODO: hide-sprint interaction not launched yet */}
            <a
              className="hub-d-see-all"
              href="#"
              onClick={(e) => {
                e.preventDefault();
                console.log("TODO: not launched yet");
              }}
            >
              Hide sprint {"×"}
            </a>
          </div>
          <SprintFullWidth />

          <div className="hub-d-section-h">
            <h2>
              Explore <span>everything else</span>
            </h2>
          </div>
          <SecondaryGrid />
        </div>
      </div>

      <button
        className="hub-d-help"
        title="Help"
        onClick={() => console.log("TODO: help widget")}
      >
        ?
      </button>
    </div>
  );
}
