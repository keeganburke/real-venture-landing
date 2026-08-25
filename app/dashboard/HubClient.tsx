"use client";

import { useState } from "react";
import type { IntakeAnswers } from "../../lib/intake-cookie";
import { GREETING } from "./hub-copy";
import HubHeader from "./components/HubHeader";
import DiscordCTA from "./components/DiscordCTA";
import SprintCard from "./components/SprintCard";
import TileList from "./components/TileList";
import HelpFab from "./components/HelpFab";

type Props = {
  // Reserved for tour routing and greeting personalization (Prompts C and D).
  intakeNeed: IntakeAnswers["need"] | null;
};

export default function HubClient({ intakeNeed: _intakeNeed }: Props) {
  const [sprintOpen, setSprintOpen] = useState(false);
  const [discordDismissed, setDiscordDismissed] = useState(false);

  return (
    <div className="hub-page">
      <div className="hub">
        <HubHeader
          onLogWin={() => console.log("TODO: Log a Win modal")}
          onTour={() => console.log("TODO: guided tour")}
        />

        <div className="greet">
          <div className="greet-hi">{GREETING.hi}</div>
          <div className="greet-q">{GREETING.q}</div>
          <div className="greet-sub">{GREETING.sub}</div>
        </div>

        <div className="search">
          <span className="search-icn">{"\u{1F50D}"}</span>
          <div className="search-in">Search pages...</div>
          <span className="search-key">{"⌘"}K</span>
        </div>

        {!discordDismissed && (
          <DiscordCTA onDismiss={() => setDiscordDismissed(true)} />
        )}

        <SprintCard
          expanded={sprintOpen}
          onToggle={() => setSprintOpen((open) => !open)}
        />

        <TileList />

        <HelpFab />
      </div>
    </div>
  );
}
