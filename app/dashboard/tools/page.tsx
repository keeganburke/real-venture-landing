"use client";

import { useState } from "react";
import Link from "next/link";
import { RESOURCES } from "./resources-data";
import { SOFTWARE } from "./software-data";

export default function ToolsPage() {
  const [tab, setTab] = useState<"resources" | "software">("resources");

  return (
    <div className="hub2-page">
      <div className="hub2-shell">
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

        {tab === "resources" && (
          <div className="res-list" role="tabpanel">
            {RESOURCES.map((r) => (
              <details key={r.id} className="res-card">
                <summary className="res-summary">
                  <div className="res-summary-left">
                    <span className="res-emoji" aria-hidden="true">{r.emoji}</span>
                    <div className="res-summary-text">
                      <div className="res-title">{r.title}</div>
                      <div className="res-desc">{r.description}</div>
                    </div>
                  </div>
                  <span className="res-chev" aria-hidden="true">{"›"}</span>
                </summary>
                <div className="res-body">
                  {r.content.split(/\n\n+/).filter((p) => p.trim().length > 0).map((para, i) => (
                    <p key={i} className="res-para">
                      {para.split("\n").map((line, li) => (
                        <span key={li}>
                          {line}
                          {li < para.split("\n").length - 1 && <br />}
                        </span>
                      ))}
                    </p>
                  ))}

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
                        <a
                          key={d.href}
                          href={d.href}
                          download
                          className="res-download"
                        >
                          <span className="res-download-icon" aria-hidden="true">{"⬇"}</span>
                          <span className="res-download-label">{d.label}</span>
                          {d.size && <span className="res-download-size">{d.size}</span>}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}

        {tab === "software" && (
          <div className="soft-list" role="tabpanel">
            {SOFTWARE.map((s) => (
              <a
                key={s.id}
                href={s.href}
                {...(s.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="soft-card"
              >
                <div className="soft-icon" aria-hidden="true">{s.emoji}</div>
                <div className="soft-body">
                  <div className="soft-title-row">
                    <div className="soft-title">{s.title}</div>
                    {s.badge && <span className="soft-badge">{s.badge}</span>}
                  </div>
                  <div className="soft-desc">{s.description}</div>
                </div>
                <div className="soft-arrow" aria-hidden="true">{s.external ? "↗" : "→"}</div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
