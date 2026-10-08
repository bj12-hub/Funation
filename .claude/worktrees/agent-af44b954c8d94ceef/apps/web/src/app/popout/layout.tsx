import type { ReactNode } from "react";

// Standalone creator pages without the studio menu (code-first): the page fills the window.
export default function PopoutLayout({ children }: { children: ReactNode }) {
  return <main>{children}</main>;
}
