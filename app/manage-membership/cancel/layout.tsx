import type { ReactNode } from "react";

// Auth is inherited. This layout nests under app/manage-membership/layout.tsx,
// which reads the rv_session cookie and redirects unauthenticated requests to
// /api/auth/whop/start before any child renders. Nothing to re-check here.
export default function CancelLayout({ children }: { children: ReactNode }) {
  return children;
}
