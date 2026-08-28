import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CheckoutClient from "./CheckoutClient";

export const metadata: Metadata = {
  title: "Real Venture | Checkout",
};

type PlanKey = "base" | "pro";

type PlanConfig = {
  key: PlanKey;
  name: string;
  price: string;
  cadence: string;
  tagline: string;
  whopCheckoutUrl: string;
};

const PLANS: Record<PlanKey, PlanConfig> = {
  base: {
    key: "base",
    name: "Base",
    price: "$19.99",
    cadence: "per month",
    tagline: "The core wholesaling toolkit",
    whopCheckoutUrl: "https://whop.com/checkout/plan_2NqC2WJzV87QY",
  },
  pro: {
    key: "pro",
    name: "Pro",
    price: "$49.99",
    cadence: "per month",
    tagline: "Everything to close your first deal fast",
    whopCheckoutUrl: "https://whop.com/checkout/plan_J8vFpCWME75W3",
  },
};

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ plan: string }>;
}) {
  const { plan } = await params;
  if (plan !== "base" && plan !== "pro") {
    notFound();
  }
  const config = PLANS[plan as PlanKey];
  return <CheckoutClient plan={config} />;
}
