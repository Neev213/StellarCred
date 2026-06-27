import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { SiteNav } from "@/components/SiteNav";
import { WalletProvider } from "@/lib/wallet-context";
import "./globals.css";

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-body",
});

const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "StellarCred — Prove anything. Reveal nothing.",
  description:
    "Zero-knowledge credentials on Stellar. Prove facts about yourself without the data ever touching the chain.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>
        <WalletProvider>
          <SiteNav />
          <main className="container">{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
