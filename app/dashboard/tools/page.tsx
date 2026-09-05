"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TOOL_ITEMS, type ToolItem } from "./tools-config";
import { SOFTWARE } from "./software-data";

// ToolItem flattens software down to `icon`, so the brand mark is looked up by
// slug here rather than widening the shared ToolItem type.
const SOFTWARE_LOGOS = new Map(
  SOFTWARE.filter((s) => s.logo).map((s) => [s.id, s.logo as string])
);

// Brand mark when one exists, emoji otherwise. If the image 404s the <img>
// hides itself and reveals the emoji, so a dead logo host degrades to exactly
// what the card looked like before.
function IconSlot({ item }: { item: ToolItem }) {
  const logo = item.tab === "software" ? SOFTWARE_LOGOS.get(item.slug) : undefined;
  if (!logo) {
    return (
      <div className="soft-icon" aria-hidden="true">
        {item.icon}
      </div>
    );
  }
  return (
    <div className="soft-icon" aria-hidden="true">
      <img
        src={logo}
        alt=""
        className="soft-icon-img"
        width={40}
        height={40}
        onError={(e) => {
          e.currentTarget.style.display = "none";
          const fallback = e.currentTarget.nextElementSibling as HTMLElement | null;
          if (fallback) fallback.style.display = "inline";
        }}
      />
      <span style={{ display: "none" }}>{item.icon}</span>
    </div>
  );
}

// Resources are grouped by journey stage. Sections with no items are skipped
// entirely, so "coach" and "connect" stay invisible until cards land there.
const SECTIONS = [
  { key: "start", label: "Start Here", emoji: "🚀" },
  { key: "find", label: "Find Deals", emoji: "🔍" },
  { key: "close", label: "Close Deals", emoji: "💼" },
  { key: "scale", label: "Scale", emoji: "📈" },
  { key: "coach", label: "Live Coaching", emoji: "🎥" },
  { key: "connect", label: "Community", emoji: "💬" },
] as const;

// The hub shell becomes a 2-column grid on desktop; this wrapper spans both
// columns and centers the stack so there is no dead right column.
const STACK_STYLE = {
  gridColumn: "1 / -1",
  width: "100%",
  maxWidth: 800,
  margin: "0 auto",
} as const;

function ToolsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "software" ? "software" : "resources";

  const setTab = (next: "resources" | "software") => {
    router.replace(next === "resources" ? "/dashboard/tools" : "/dashboard/tools?tab=software", {
      scroll: false,
    });
  };

  const items = TOOL_ITEMS.filter((item) => item.tab === tab);

  return (
    <div style={STACK_STYLE}>
      <nav className="hub2-nav">
        <Link href="/dashboard" className="hub2-menu">{"←"} Back to hub</Link>
      </nav>

      <header className="hub2-greeting">
        <div className="hub2-greeting-eyebrow">The library</div>
        <h1 className="hub2-greeting-name">Tools</h1>
        <p className="hub2-greeting-sub">
          Everything you need to close deals.
        </p>
      </header>

      <div className="tools-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "resources"}
          className={`tools-tab${tab === "resources" ? " is-active" : ""}`}
          onClick={() => setTab("resources")}
        >
          <span className="tools-tab-icon" aria-hidden="true">📚</span>
          <span>Resources</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "software"}
          className={`tools-tab${tab === "software" ? " is-active" : ""}`}
          onClick={() => setTab("software")}
        >
          <span className="tools-tab-icon" aria-hidden="true">💻</span>
          <span>Software</span>
        </button>
      </div>

      {tab === "resources" ? (
        <div role="tabpanel">
          {SECTIONS.map((section) => {
            const inSection = items.filter((i) => i.resource?.section === section.key);
            if (inSection.length === 0) return null;
            return (
              <div className="tools-section" key={section.key}>
                <h2 className="tools-section-head">
                  <span aria-hidden="true">{section.emoji}</span>
                  {section.label}
                </h2>
                <div className="soft-list">{inSection.map(renderItem)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="soft-list" role="tabpanel">{items.map(renderItem)}</div>
      )}
    </div>
  );
}

function renderItem(item: ToolItem) {
  const r = item.resource;

  // Link-out resource: points at existing infrastructure, not a resource page.
  if (r?.href) {
    const body = (
      <>
        <IconSlot item={item} />
        <div className="soft-body">
          <div className="soft-title-row">
            <div className="soft-title">{item.title}</div>
            {r.badge && <span className="soft-badge">{r.badge}</span>}
          </div>
          <div className="soft-desc">{item.description}</div>
        </div>
        <div className="soft-arrow" aria-hidden="true">{r.external ? "↗" : "→"}</div>
      </>
    );
    return r.external ? (
      <a key={item.slug} href={r.href} target="_blank" rel="noreferrer" className="soft-card">
        {body}
      </a>
    ) : (
      <Link key={item.slug} href={r.href} className="soft-card">
        {body}
      </Link>
    );
  }

  return r ? (
    <Link key={item.slug} href={`/dashboard/tools/${item.slug}`} className="soft-card">
      <IconSlot item={item} />
      <div className="soft-body">
        <div className="soft-title-row">
          <div className="soft-title">{item.title}</div>
        </div>
        <div className="soft-desc">{item.description}</div>
      </div>
      <div className="soft-arrow" aria-hidden="true">{"›"}</div>
    </Link>
  ) : (
    <a
      key={item.slug}
      href={item.href}
      {...(item.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="soft-card"
    >
      <IconSlot item={item} />
      <div className="soft-body">
        <div className="soft-title-row">
          <div className="soft-title">{item.title}</div>
          {item.badge && <span className="soft-badge">{item.badge}</span>}
        </div>
        <div className="soft-desc">{item.description}</div>
      </div>
      <div className="soft-arrow" aria-hidden="true">{item.external ? "↗" : "→"}</div>
    </a>
  );
}

export default function ToolsPage() {
  return (
    <div className="hub2-page">
      <div className="hub2-shell">
        <Suspense fallback={null}>
          <ToolsContent />
        </Suspense>
      </div>
    </div>
  );
}
