import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Somnation 관리자",
  description: "Somnation admin console",
  robots: { index: false, follow: false }
};

// Admin type (Figma "Somnation Admin" text styles): Noto Sans KR for Korean UI, Inter for numbers.
const FONT_STYLESHEET = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Noto+Sans+KR:wght@400;500;700&display=swap";

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body>{children}</body>
    </html>
  );
}
