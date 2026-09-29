import type { Metadata } from "next";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Somnation",
  description: "Broadcasting donation platform"
};

// Fonts used by the Figma service screens: Gothic A1 (Korean UI) and Inter (Latin/emoji glyph runs).
// Loaded from Google Fonts at runtime. TODO: self-host via next/font once the build
// environment can reach fonts.googleapis.com, to remove the render-blocking request.
const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;600;700;800;900&family=Inter:wght@400;500;700;800&display=swap";

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // data-theme is replaced before paint by THEME_INIT_SCRIPT (saved preference), hence suppressHydrationWarning.
    <html lang="ko" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONT_STYLESHEET} />
      </head>
      <body>{children}</body>
    </html>
  );
}
