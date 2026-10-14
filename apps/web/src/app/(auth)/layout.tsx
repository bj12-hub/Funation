import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { HelperFrame } from "@/features/helper/HelperLanding";
import { getSession } from "@/lib/session";
import { getSurface } from "@/lib/surface";
import styles from "./layout.module.css";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  // On the 도우미 domain (docs/development/helper-domain.md) the same sign-in pages carry the helper's top bar.
  if ((await getSurface()) === "helper") {
    return (
      <HelperFrame>
        <main className={styles.main}>{children}</main>
      </HelperFrame>
    );
  }

  const session = await getSession();
  const user = session && { nickname: session.nickname, avatarUrl: session.avatarUrl };

  return (
    <div className={styles.page}>
      <GlobalHeader user={user} showMenuButton={false} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}
