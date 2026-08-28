import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Venture | Learn Secured Wholesaling",
  description:
    "Live coaching 7x/week, a full course, deal analyzer, buyer CRM, and contract templates. Everything between you and your first assignment fee.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Real Venture",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

// themeColor is deprecated in `metadata` since Next 14; it lives in the
// viewport export (node_modules/next/dist/docs/.../generate-viewport.md).
export const viewport: Viewport = {
  themeColor: "#E5B547",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <head>
        {/* Next's appleWebApp.capable emits mobile-web-app-capable only;
            older iOS needs the apple- prefixed tag, so add it manually. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,700,800,900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
