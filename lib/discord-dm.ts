// Bot DM helper, moved verbatim from app/api/whop/webhook/route.ts so the
// payment-recovery drip can reuse it. Behavior and log lines unchanged.
//
// Bot DM = open (or reuse) the DM channel, then post to it. 403 on the
// second call means the user has DMs from server members disabled.
//
// sendDiscordDmDetailed also returns the DM channel id and the posted
// message id, so the payment-recovery drip can remember the channel and
// poll it for replies (lib/payment-recovery-replies.ts). sendDiscordDm is
// the boolean wrapper every existing caller uses.

function idOf(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  if (value && typeof value === "object") {
    const id = (value as Record<string, unknown>).id;
    if (typeof id === "string" && id.length > 0) return id;
  }
  return null;
}

export type DmResult = { ok: boolean; channelId: string | null; messageId: string | null };

// Opens (or reuses) the bot's DM channel with a user. null on any failure.
export async function openDmChannel(discordUserId: string): Promise<string | null> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    console.error("[webhook payment_failed] DISCORD_BOT_TOKEN unset, cannot DM");
    return null;
  }
  const headers = { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" };
  try {
    const chanRes = await fetch("https://discord.com/api/v10/users/@me/channels", {
      method: "POST",
      headers,
      body: JSON.stringify({ recipient_id: discordUserId }),
    });
    if (!chanRes.ok) {
      console.error("[webhook payment_failed] discord open DM failed", chanRes.status, await chanRes.text());
      return null;
    }
    const channelId = idOf(await chanRes.json().catch(() => null));
    if (!channelId) {
      console.error("[webhook payment_failed] discord open DM returned no channel id");
      return null;
    }
    return channelId;
  } catch (err) {
    console.error("[webhook payment_failed] discord DM threw", err);
    return null;
  }
}

export async function sendDiscordDmDetailed(discordUserId: string, content: string): Promise<DmResult> {
  const channelId = await openDmChannel(discordUserId);
  if (!channelId) return { ok: false, channelId: null, messageId: null };
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const headers = { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" };
  try {
    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
    });
    if (!msgRes.ok) {
      console.error("[webhook payment_failed] discord send failed", msgRes.status, await msgRes.text());
      return { ok: false, channelId, messageId: null };
    }
    const messageId = idOf(await msgRes.json().catch(() => null));
    return { ok: true, channelId, messageId };
  } catch (err) {
    console.error("[webhook payment_failed] discord DM threw", err);
    return { ok: false, channelId, messageId: null };
  }
}

export async function sendDiscordDm(discordUserId: string, content: string): Promise<boolean> {
  return (await sendDiscordDmDetailed(discordUserId, content)).ok;
}
