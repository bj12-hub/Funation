import { SideNavLayout } from "@/components/layout/SideNav";

// Figma 617:316 / 617:5 — 260px side navigation + content.
export default function LiveLayout({ children }: { children: React.ReactNode }) {
  // TODO: pass the signed-in user (with server-provided FN balance) once authentication exists.
  return <SideNavLayout user={null}>{children}</SideNavLayout>;
}
