"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/verify", label: "Get credential" },
  { href: "/holder", label: "Holder" },
  { href: "/issuer", label: "Issuer" },
  { href: "/verifier", label: "Demo" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <header className="nav">
      <div className="nav-inner">
        <Link href="/" className="brand">
          <span className="dot" />
          StellarCred
        </Link>
        <nav className="nav-links">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={pathname.startsWith(l.href) ? "active" : undefined}
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
