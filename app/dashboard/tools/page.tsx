"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { TOOL_ITEMS } from "./tools-config";

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

      <div className="soft-list" role="tabpanel">
        {items.map((item) =>
          item.resource ? (
            <Link key={item.slug} href={`/dashboard/tools/${item.slug}`} className="soft-card">
              <div className="soft-icon" aria-hidden="true">{item.icon}</div>
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
              <div className="soft-icon" aria-hidden="true">{item.icon}</div>
              <div className="soft-body">
                <div className="soft-title-row">
                  <div className="soft-title">{item.title}</div>
                  {item.badge && <span className="soft-badge">{item.badge}</span>}
                </div>
                <div className="soft-desc">{item.description}</div>
              </div>
              <div className="soft-arrow" aria-hidden="true">{item.external ? "↗" : "→"}</div>
            </a>
          )
        )}
      </div>
    </div>
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
