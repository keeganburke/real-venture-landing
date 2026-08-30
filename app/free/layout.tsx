import type { Metadata } from "next";

// Title-only override, same pattern as app/onboarding/layout.tsx. No session
// gating: this route is deliberately public. noindex keeps the free-training
// variant out of search while still letting crawlers follow through to /.
export const metadata: Metadata = {
  title: "Real Venture | Secured Wholesaling Blueprint",
  robots: { index: false, follow: true },
};

export default function FreeLayout({ children }: LayoutProps<"/free">) {
  return children;
}
