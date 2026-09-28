import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { GlobalHeader } from "@/components/layout/GlobalHeader";
import { getSession } from "@/lib/session";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const user = session && { nickname: session.nickname, avatarUrl: session.avatarUrl };

  return (
    <>
      <GlobalHeader user={user} />
      <main>{children}</main>
      <GlobalFooter />
    </>
  );
}
