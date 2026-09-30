import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Somnation 관리자",
  description: "Somnation admin console",
  robots: { index: false, follow: false }
};

// Same fonts as the site (Gothic A1 for Korean UI, Inter for Latin runs).
const FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;600;700;800;900&family=Inter:wght@400;500;700;800&display=swap";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-theme="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body>{children}</body>
    </html>
  );
}
