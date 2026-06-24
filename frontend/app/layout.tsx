import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "StellarCred",
  description: "ZK credential proofs on Stellar — prove without revealing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header className="nav">
          <Link href="/" className="brand">
            StellarCred
          </Link>
          <nav>
            <Link href="/issuer">Issuer</Link>
            <Link href="/holder">Holder</Link>
            <Link href="/verifier">Verifier Demo</Link>
          </nav>
        </header>
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
