import { GlobalHeader } from "@/components/layout/GlobalHeader";
import styles from "./layout.module.css";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <GlobalHeader user={null} showMenuButton={false} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
