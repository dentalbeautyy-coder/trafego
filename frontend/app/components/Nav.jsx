"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Visão geral" },
  { href: "/campaigns", label: "Campanhas" },
  { href: "/kommo", label: "Kommo" },
  { href: "/sync", label: "Sincronização" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="tabs">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} data-active={pathname === link.href}>
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
