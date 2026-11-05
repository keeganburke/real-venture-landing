// Discord webhook for every payment-recovery post (hourly embed, morning
// digest, reply embeds, weekly post, the Duplicate past_due and Ultra lines).
// DISCORD_RECOVERY_WEBHOOK_URL when set, else DISCORD_MOD_WEBHOOK_URL (the
// channel the sweep and pause-resume posts use). Neither set: the post is
// logged to the console and nothing is sent. No mentions are ever parsed.

export type RecoveryEmbed = {
  title?: string;
  description?: string;
  color?: number;
  footer?: { text: string };
};

// Brand gold.
export const RECOVERY_GOLD = 0xc9a14a;
const DESCRIPTION_MAX = 4000;
const FOOTER_MAX = 2000;

export function recoveryWebhookUrl(): string | undefined {
  return process.env.DISCORD_RECOVERY_WEBHOOK_URL || process.env.DISCORD_MOD_WEBHOOK_URL || undefined;
}

export function recoveryWebhookSource(): "recovery" | "mod" | "unset" {
  if (process.env.DISCORD_RECOVERY_WEBHOOK_URL) return "recovery";
  if (process.env.DISCORD_MOD_WEBHOOK_URL) return "mod";
  return "unset";
}

async function post(body: Record<string, unknown>, logLabel: string): Promise<boolean> {
  const url = recoveryWebhookUrl();
  if (!url) {
    console.log(`[payment-recovery] recovery webhook unset, ${logLabel}:\n` + JSON.stringify(body));
    return false;
  }
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, allowed_mentions: { parse: [] } }),
    });
    if (!res.ok) {
      console.error("[payment-recovery] recovery webhook post failed", res.status);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[payment-recovery] recovery webhook post threw", err instanceof Error ? err.message : "unknown");
    return false;
  }
}

// One embed per message. Description and footer are cut to Discord's limits.
export async function postRecoveryEmbed(embed: RecoveryEmbed): Promise<boolean> {
  const clean: RecoveryEmbed = { ...embed };
  if (clean.description && clean.description.length > DESCRIPTION_MAX) clean.description = `${clean.description.slice(0, DESCRIPTION_MAX - 3)}...`;
  if (clean.footer && clean.footer.text.length > FOOTER_MAX) clean.footer = { text: `${clean.footer.text.slice(0, FOOTER_MAX - 3)}...` };
  return post({ embeds: [clean] }, clean.title ?? "embed");
}

// Plain one-line post (the Duplicate past_due and Ultra lines).
export async function postRecoveryText(content: string): Promise<boolean> {
  return post({ content: content.length > 1900 ? `${content.slice(0, 1897)}...` : content }, "text");
}
