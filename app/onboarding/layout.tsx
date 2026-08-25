import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome to Real Venture",
};

export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return children;
}
