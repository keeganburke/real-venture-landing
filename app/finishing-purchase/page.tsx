import type { Metadata } from "next";
import FinishingPurchaseClient from "./FinishingPurchaseClient";

export const metadata: Metadata = {
  title: "Real Venture | Finishing your purchase",
};

// Where a brand new buyer lands if Whop doesn't list their membership yet
// when they sign in (app/api/auth/whop/callback), or when the hub's re-check
// can't find it a few minutes after sign in (app/dashboard/layout.tsx). It
// keeps asking /api/auth/whop/purchase-status and takes them in as soon as
// Whop lists the membership. Never a rejection.
export default function FinishingPurchasePage() {
  return <FinishingPurchaseClient />;
}
