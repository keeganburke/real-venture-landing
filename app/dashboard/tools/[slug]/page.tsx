import Link from "next/link";
import { notFound } from "next/navigation";
import { getToolBySlug } from "../tools-config";

const STACK_STYLE = {
  gridColumn: "1 / -1",
  width: "100%",
  maxWidth: 800,
  margin: "0 auto",
} as const;

export default async function ToolPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getToolBySlug(slug);
  if (!item || !item.resource) notFound();
  const r = item.resource;

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
