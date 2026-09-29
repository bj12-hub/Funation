import type { ReactNode } from "react";

// OBS overlays always use the dark tokens, whatever theme the browser saved (the page itself stays
// transparent; each overlay clears the html/body background).
export default function OverlayLayout({ children }: { children: ReactNode }) {
  return <div data-theme="dark">{children}</div>;
}
