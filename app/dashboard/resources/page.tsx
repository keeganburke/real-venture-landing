import type { Metadata } from "next";
import Link from "next/link";
import { RESOURCES } from "./resources-data";

export const metadata: Metadata = {
  title: "Real Venture | Tools & Resources",
};

export default function ResourcesPage() {
  return (
    <div className="hub2-page">
      <div className="hub2-shell">
        <nav className="hub2-nav">
          <Link href="/dashboard" className="hub2-menu">{"←"} Back to hub</Link>
        </nav>

        <header className="hub2-greeting">
          <div className="hub2-greeting-eyebrow">The library</div>
          <h1 className="hub2-greeting-name">Tools &amp; Resources</h1>
          <p className="hub2-greeting-sub">
            Templates, scripts, and setup guides. Everything we use, in one place.
          </p>
        </header>

        <div className="res-list">
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
      </div>
    </div>
  );
}
