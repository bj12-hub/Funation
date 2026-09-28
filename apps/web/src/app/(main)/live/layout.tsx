import { SideNav } from "@/components/layout/SideNav";
import styles from "./layout.module.css";

// Figma 617:316 / 617:5 — 260px side navigation + content.
export default function LiveLayout({ children }: { children: React.ReactNode }) {
  // TODO: pass the signed-in user (with server-provided FN balance) once authentication exists.
  return (
    <div className={styles.shell}>
      <SideNav user={null} />
      <div className={styles.main}>{children}</div>
    </div>
  );
}
