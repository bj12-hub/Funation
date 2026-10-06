import type { ReactNode } from "react";

// OBS overlays always use the dark tokens, whatever theme the browser saved. The page is transparent from
// the first byte (the server-rendered style), so the source never flashes the site background while it loads,
// errors or reloads; each overlay also clears the html/body background once it runs. The root is always dark: a
// light root (the site theme the browser saved) inside a dark page — the studio's 오버레이 미리보기 iframe — is painted
// on an opaque white canvas, which no background rule can clear.
const TRANSPARENT = "html { color-scheme: dark !important; } html, body { background: transparent !important; }";

export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark">
      <style>{TRANSPARENT}</style>
      {children}
    </div>
  );
}
