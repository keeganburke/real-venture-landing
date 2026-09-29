export type SoftwareLink = {
  id: string;
  emoji: string;
  title: string;
  description: string;
  href: string;
  external?: boolean;
  badge?: string;
  // Brand mark. Takes precedence over `emoji`, which stays as the fallback
  // when the image fails to load.
  logo?: string;
};

export const SOFTWARE: SoftwareLink[] = [
  {
    id: "studio",
    emoji: "🛠",
    logo: "/rv-logo.png",
    title: "Real Venture Studio",
    description: "Deal analyzer, buyers, pipeline, contract generator. All in one.",
    href: "https://realventurestudio.com",
    external: true,
    badge: "Members",
  },
  {
    id: "propstream",
    logo: "https://www.google.com/s2/favicons?domain=propstream.com&sz=128",
    emoji: "📍",
    title: "PropStream",
    description: "Motivated-seller lists, property data, and comps.",
    href: "https://www.propstream.com/",
    external: true,
  },
  {
    id: "batchleads",
    logo: "https://www.google.com/s2/favicons?domain=batchleads.io&sz=128",
    emoji: "📱",
    title: "Batch Leads",
    description: "SMS blasting for off-market outreach.",
    href: "https://batchleads.io/",
    external: true,
  },
  {
    id: "docusign",
    logo: "https://www.google.com/s2/favicons?domain=docusign.com&sz=128",
    emoji: "✍️",
    title: "DocuSign",
    description: "E-sign PSAs and assignment agreements.",
    href: "https://www.docusign.com/",
    external: true,
  },
  {
    id: "google-voice",
    emoji: "☎️",
    title: "Google Voice",
    description: "Free business number for seller and buyer calls.",
    href: "https://voice.google.com",
    external: true,
    logo: "https://www.google.com/s2/favicons?domain=voice.google.com&sz=128",
  },
  {
    id: "mercury",
    emoji: "🏦",
    title: "Mercury",
    description: "Business banking for your LLC. Free, no minimums.",
    href: "https://mercury.com",
    external: true,
    logo: "https://www.google.com/s2/favicons?domain=mercury.com&sz=128",
  },
  {
    id: "rentcast",
    emoji: "🏠",
    title: "RentCast",
    description: "Rental comps and AVM data for repair-heavy deals.",
    href: "https://rentcast.io",
    external: true,
    logo: "https://www.google.com/s2/favicons?domain=rentcast.io&sz=128",
  },
];
