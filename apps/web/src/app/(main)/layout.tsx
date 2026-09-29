import { AppShell } from "@/components/layout/AppShell";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { getSession, hasRole } from "@/lib/session";
import { getMyAccount } from "@/services/account/myAccount";

// Site shell (funnation structure): header + side menu on every page + footer in the content column.
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const account = session ? await getMyAccount() : null;
  const user =
    session && account
      ? {
          nickname: account.nickname,
          funationId: account.funationId,
          avatarUrl: account.avatarUrl,
          fnBalance: account.fnBalance,
          creator: hasRole(session, "CREATOR")
        }
      : null;

  return (
    <AppShell user={user}>
      <main>{children}</main>
      <GlobalFooter />
    </AppShell>
  );
}
