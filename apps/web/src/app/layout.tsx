import type { Metadata } from "next";
import { Black_Han_Sans, Gothic_A1, Inter, Jua } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/I18nProvider";
import { getLocale } from "@/lib/i18n/server";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ssumnation",
  description: "Broadcasting donation platform"
};

// Fonts used by the Figma service screens: Gothic A1 (Korean UI) and Inter (Latin/emoji glyph runs).
// Self-hosted by next/font (2026-10-06 결정): the files are fetched at build time and served from this site, so
// pages make no request to Google and nothing blocks the first paint. The build needs to reach Google Fonts.
// Gothic A1 is split into many unicode-range files (Korean) that browsers load on demand, so none are preloaded.
const gothic = Gothic_A1({
  weight: ["400", "500", "600", "700", "800", "900"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-gothic"
});
const inter = Inter({ subsets: ["latin"], display: "swap", variable: "--font-inter" });
// 오버레이 테마 display faces (OFL): Black Han Sans for 볼드 플랫 numbers and titles, Jua for 소프트 글래스. Only the
// overlays and the studio's theme previews use them, so nothing is preloaded.
const overlayBlack = Black_Han_Sans({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-ov-black" });
const overlayRound = Jua({ weight: "400", subsets: ["latin"], display: "swap", preload: false, variable: "--font-ov-round" });

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The locale cookie is read on every request so the first render is already in the chosen language.
  const locale = await getLocale();
  return (
    // data-theme is replaced before paint by THEME_INIT_SCRIPT (saved preference), hence suppressHydrationWarning.
    <html lang={locale} data-theme="dark" className={`${gothic.variable} ${inter.variable} ${overlayBlack.variable} ${overlayRound.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
