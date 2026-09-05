import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getToolBySlug } from "../tools-config";

const STACK_STYLE = {
  gridColumn: "1 / -1",
  width: "100%",
  maxWidth: 800,
  margin: "0 auto",
} as const;

// ── Content parser ─────────────────────────────────────────────────────────
// resources-data.ts stores each body as one long string whose structure lives
// in typographic conventions, not markup: a leading emoji marks a heading,
// "· " marks a bullet, "N. " marks a step, a trailing ":" marks a subhead.
// This turns those conventions into semantic elements so the CSS has real
// headings and lists to style. The data file is never modified.

const EMOJI_LINE = /^(\p{Extended_Pictographic}(?:️)?)\s+(.+)$/u;
const BULLET_LINE = /^·\s+(.*)$/;
const STEP_LINE = /^\d+\.\s+(.*)$/;
const TIP_LINE = /^Tip:\s*(.*)$/;

// A glossary term is the ALL-CAPS head of an emoji line, ignoring anything
// after a colon or inside a parenthetical: "SECURED WHOLESALING",
// "ARV: After Repair Value", "70% RULE", "REPAIR COSTS (Rehab)". Testing "no
// lowercase, at least one letter" rather than /^[A-Z]/ keeps "70% RULE" with
// its siblings; ignoring the parenthetical keeps "REPAIR COSTS (Rehab)".
function isTermHeading(rest: string): boolean {
  const head = rest.split(":")[0].split("(")[0];
  return /[A-Z]/.test(head) && !/[a-z]/.test(head);
}

type LineKind = "blank" | "bullet" | "step" | "tip" | "emoji" | "text";

function kindOf(line: string): LineKind {
  if (line.trim().length === 0) return "blank";
  if (BULLET_LINE.test(line)) return "bullet";
  if (STEP_LINE.test(line)) return "step";
  if (TIP_LINE.test(line)) return "tip";
  if (EMOJI_LINE.test(line)) return "emoji";
  return "text";
}

function renderContent(raw: string): ReactNode[] {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];

  let bullets: string[] = [];
  let steps: string[] = [];
  let para: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length === 0) return;
    out.push(
      <ul className="res-bullets" key={`u${key++}`}>
        {bullets.map((b, i) => (
          <li key={i}>{b}</li>
        ))}
      </ul>
    );
    bullets = [];
  };
  const flushSteps = () => {
    if (steps.length === 0) return;
    out.push(
      <ol className="res-steps" key={`o${key++}`}>
        {steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>
    );
    steps = [];
  };
  const flushPara = () => {
    if (para.length === 0) return;
    out.push(
      <p className="res-para" key={`p${key++}`}>
        {para.map((line, i) => (
          <span key={i}>
            {line}
            {i < para.length - 1 && <br />}
          </span>
        ))}
      </p>
    );
    para = [];
  };
  const flushAll = () => {
    flushBullets();
    flushSteps();
    flushPara();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const kind = kindOf(line);

    if (kind === "blank") {
      flushAll();
      continue;
    }

    if (kind === "bullet") {
      flushSteps();
      flushPara();
      bullets.push(line.match(BULLET_LINE)![1]);
      continue;
    }

    if (kind === "step") {
      flushBullets();
      flushPara();
      steps.push(line.match(STEP_LINE)![1]);
      continue;
    }

    if (kind === "tip") {
      flushAll();
      out.push(
        <div className="res-callout" key={`c${key++}`}>
          <span className="res-callout-label">Tip</span>
          {line.match(TIP_LINE)![1]}
        </div>
      );
      continue;
    }

    if (kind === "emoji") {
      flushAll();
      const rest = line.match(EMOJI_LINE)![2];
      if (isTermHeading(rest)) {
        out.push(
          <h3 className="res-term" key={`t${key++}`}>
            {line}
          </h3>
        );
      } else {
        out.push(
          <h4 className="res-emoji-head" key={`e${key++}`}>
            {line}
          </h4>
        );
      }
      continue;
    }

    // Plain text. A line ending in ":" labels whatever follows it -- a
    // sentence, a numbered list, an emoji-led block -- so it reads as a
    // subhead rather than body copy. No lookahead: "Tip:" already claimed its
    // own rule above, and every other rule fires earlier in the chain.
    const trimmed = line.trim();
    if (trimmed.endsWith(":")) {
      flushAll();
      out.push(
        <h4 className="res-subhead" key={`s${key++}`}>
          {trimmed}
        </h4>
      );
      continue;
    }

    flushBullets();
    flushSteps();
    para.push(line);
  }

  flushAll();
  return out;
}

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  // Link-out resources carry no body, so they get no resource page -- without
  // the content check /dashboard/tools/deal-analyzer would render an empty
  // shell. Narrowing `r` directly is what lets `r.content` type as string.
  const r = getToolBySlug(slug)?.resource;
  if (!r?.content) notFound();

  return (
    <div className="hub2-page">
      <div className="hub2-shell">
        <div style={STACK_STYLE}>
          <nav className="hub2-nav">
            <Link href="/dashboard/tools" className="hub2-menu">{"←"} Back to tools</Link>
          </nav>

          <header className="hub2-greeting">
            <div className="hub2-greeting-eyebrow">{r.emoji} Resource</div>
            <h1 className="hub2-greeting-name">{r.title}</h1>
            <p className="hub2-greeting-sub">{r.description}</p>
          </header>

          <div className="res-card">
            <div className="res-body">
              {renderContent(r.content)}

              {r.image && (
                <div className="res-image-wrap">
                  <img src={r.image} alt={r.title} className="res-image" />
                </div>
              )}

              {r.links && r.links.length > 0 && (
                <div className="res-links">
                  {r.links.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className="res-link"
                    >
                      <span>{link.label}</span>
                      <span aria-hidden="true">{link.external ? "↗" : "→"}</span>
                    </a>
                  ))}
                </div>
              )}

              {r.downloads && r.downloads.length > 0 && (
                <div className="res-downloads">
                  {r.downloads.map((d) => (
                    <a key={d.href} href={d.href} download className="res-download">
                      <span className="res-download-icon" aria-hidden="true">{"⬇"}</span>
                      <span className="res-download-label">{d.label}</span>
                      {d.size && <span className="res-download-size">{d.size}</span>}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
