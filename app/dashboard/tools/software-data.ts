export type SoftwareLink = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  badge?: string;
};

export const SOFTWARE: SoftwareLink[] = [
  {
    id: "studio",
    emoji: "🛠",
    title: "Real Venture Studio",
    description: "Deal analyzer, buyers, pipeline, contract generator. All in one.",
    href: "https://realventurestudio.com",
    external: true,
    badge: "Members",
  },
  {
    id: "propstream",
    emoji: "📍",
    title: "PropStream",
    description: "Motivated-seller lists, property data, and comps.",
    href: "https://www.propstream.com/",
    external: true,
  },
  {
    id: "batchleads",
    emoji: "📱",
    title: "Batch Leads",
    description: "SMS blasting for off-market outreach.",
    href: "https://batchleads.io/",
    external: true,
  },
  {
    id: "docusign",
    emoji: "✍️",
    title: "DocuSign",
    description: "E-sign PSAs and assignment agreements.",
    href: "https://www.docusign.com/",
    external: true,
  },
];
