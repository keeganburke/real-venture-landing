import { RESOURCES, type Resource } from "./resources-data";
import { SOFTWARE } from "./software-data";

// One config for both tabs. Resource items carry their full Resource record
// and route to /dashboard/tools/[slug]; href-only items (external software)
// open in a new tab and get no sub-page.
export type ToolItem = {
  slug: string;
  title: string;
  description: string;
  icon: string;
  tab: "resources" | "software";
  resource?: Resource;
  href?: string;
  external?: boolean;
  badge?: string;
};

export const TOOL_ITEMS: ToolItem[] = [
  ...RESOURCES.map((r) => ({
    slug: r.id,
    title: r.title,
    description: r.description,
    icon: r.emoji,
    tab: "resources" as const,
    // POF ships as an embedded image only in resources-data; add a download
    // here so the sub-page reuses the same res-download rendering VA uses.
    resource:
      r.id === "pof"
        ? { ...r, downloads: [{ label: "Download Proof of Funds", href: "/resources/pof.png" }] }
        : r,
  })),
  ...SOFTWARE.map((s) => ({
    slug: s.id,
    title: s.title,
    description: s.description,
    icon: s.emoji,
    tab: "software" as const,
    href: s.href,
    external: s.external,
    badge: s.badge,
  })),
];

export function getToolBySlug(slug: string): ToolItem | undefined {
  return TOOL_ITEMS.find((item) => item.slug === slug && item.resource);
}
