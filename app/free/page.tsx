import LandingClient from "../LandingClient";

// Identical to the homepage below the fold; the "free" variant swaps the
// paid hero for the free hero with the guest Discord door.
export default function FreePage() {
  // Where the joined card's "Open Discord" button goes. Server-side only:
  // DISCORD_GUILD_ID never reaches the client except inside this URL.
  const guildId = process.env.DISCORD_GUILD_ID;
  const discordUrl = guildId ? `https://discord.com/channels/${guildId}` : "https://discord.com/app";
  return <LandingClient variant="free" discordUrl={discordUrl} />;
}
