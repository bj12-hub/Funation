import type { Metadata } from "next";
import { Inter, Noto_Sans_KR } from "next/font/google";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ssumnation 관리자",
  description: "Ssumnation admin console",
  robots: { index: false, follow: false }
};

// Admin type (Figma "Ssumnation Admin" text styles): Noto Sans KR for Korean UI, Inter for numbers.
// Self-hosted by next/font like the site (2026-10-06 결정); the Korean unicode-range files load on demand.
const noto = Noto_Sans_KR({ subsets: ["latin"], display: "swap", preload: false, variable: "--font-noto" });
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${noto.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
