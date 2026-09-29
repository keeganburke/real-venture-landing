"use client";

import { useFlowQuery } from "./CancelShell";

// William's founder letter, one per cancel reason. Copy is verbatim from the
// spec with em dashes rendered as " - " (repo rule). Blank lines separate
// paragraphs; the card renders each as its own <p>.
const LETTERS: Record<string, string> = {
  too_expensive: `Hey - William here.

Money being tight is real, and it's not a stupid reason to cancel. I get it.

Before you do, one thing worth knowing: you can freeze this thing for 30, 60, or 90 days. No charge during the pause. Everything holds. When your situation changes, you unpause.

A lot of people who cancel here regret it in three months when things loosen up. Pause was built specifically so you don't have to be one of them.

Take a look at the next page and decide.

- W`,
  life_busy: `Hey - William here.

Life gets busy. I've had months I couldn't touch my own business. That's not a character flaw, it's just how life works.

Here's the thing though - canceling doesn't fix busy. It just closes the door.

Pausing does fix busy. You freeze everything, no charge, and when the storm passes you come back exactly where you left off. Discord role, saved deals, all of it.

Take a look at the next page. Pick a length that matches how busy you actually are.

- W`,
  not_using: `Hey - William here.

I'll be straight with you. Members who cancel because they weren't using it are almost always members who never tried the smallest first thing - post in Discord, run one deal in the Studio, sit in on one call.

If you've genuinely tried and it's not for you, that's fine - leave with my blessing.

If you haven't, pause instead of cancel. Come back on a day when you have 30 minutes. Do one thing. If it clicks, keep going. If it doesn't, cancel then.

Next page has the pause options.

- W`,
  no_results: `Hey - William here.

Nobody warned you what the real timeline looks like, and that's on us.

Here's the honest version: most people who actually give a fuck close their first deal in 45 to 60 days. Not 14. Not 30. If you're inside that window and haven't closed, you're not behind - you're on schedule.

Canceling here is the equivalent of quitting a job in month two because you haven't gotten promoted yet.

Pause if you need a breather. Cancel if you're truly done. But don't leave because you think you're failing when you're actually on pace.

- W`,
  other: `Hey - William here.

You didn't pick a reason and that's fair - sometimes it's not one clean thing.

Take a look at the pause offer on the next page - no pitch, just an option to freeze for a while.

Or the next screen after this one has a text box where you can tell me what's actually going on. I read every one personally. I can't promise I'll fix it, but if it's fixable I want to know.

Either way, no hard feelings.

- W`,
};

// reason is optional: /testimonial passes it from searchParams; /final's
// FinalLoss renders the card bare, so it falls back to the URL's ?reason.
type Props = { reason?: string | null };

export default function TestimonialCard({ reason }: Props) {
  const { reason: urlReason } = useFlowQuery();
  const key = reason ?? urlReason;
  const letter = (key && LETTERS[key]) || LETTERS.other;
  const paragraphs = letter.split(/\n\s*\n/);
  return (
    <div className="william-letter">
      <div className="william-letter-head">
        <div className="william-letter-avatar" aria-hidden="true">W</div>
        <div>
          <div className="william-letter-name">William</div>
          <div className="william-letter-role">Founder, Real Venture</div>
        </div>
      </div>
      <div className="william-letter-body">
        {paragraphs.map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </div>
  );
}
