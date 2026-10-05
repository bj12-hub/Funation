import type { ReactNode } from "react";

// OBS overlays always use the dark tokens, whatever theme the browser saved. The page is transparent from
// the first byte (the server-rendered style), so the source never flashes the site background while it loads,
// errors or reloads; each overlay also clears the html/body background once it runs.
const TRANSPARENT = "html, body { background: transparent !important; }";

export default function OverlayLayout({ children }: { children: ReactNode }) {
  return (
    <div data-theme="dark">
      <style>{TRANSPARENT}</style>
      {children}
    </div>
  );
}
