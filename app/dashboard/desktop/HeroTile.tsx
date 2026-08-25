"use client";

import type { ReactNode } from "react";

type Props = {
  variant: "discord" | "sprint" | "live";
  icon: ReactNode;
  badge: string;
  title: string;
  sub: string;
  cta: string;
  href: string;
  external?: boolean;
};

export default function HeroTile({
  variant,
  icon,
  badge,
  title,
  sub,
  cta,
  href,
  external,
}: Props) {
  return (
    <a
      className={`hub-d-hero-tile hub-d-t-${variant}`}
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      <div className="hub-d-ht-top">
        <div className="hub-d-ht-icn">{icon}</div>
        <span className="hub-d-ht-badge">{badge}</span>
      </div>
      <div>
        <div className="hub-d-ht-title">{title}</div>
        <div className="hub-d-ht-sub">{sub}</div>
        <div className="hub-d-ht-cta">{cta}</div>
      </div>
    </a>
  );
}
