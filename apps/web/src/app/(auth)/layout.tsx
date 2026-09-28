import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { getSession } from "@/lib/session";
import styles from "./layout.module.css";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const user = session && { nickname: session.nickname, avatarUrl: session.avatarUrl };

  return (
    <div className={styles.page}>
      <GlobalHeader user={user} showMenuButton={false} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
