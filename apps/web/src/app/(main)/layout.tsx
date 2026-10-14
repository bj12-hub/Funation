import { AppShell } from "@/components/layout/AppShell";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { SiteBanner } from "@/components/layout/SiteBanner";
import { HelperFrame } from "@/features/helper/HelperLanding";
import { getSession, hasRole } from "@/lib/session";
import { getSurface } from "@/lib/surface";
import { getMyAccount } from "@/services/account/myAccount";
import { getSiteBanner } from "@/services/system/siteBanner";

// Site shell (funnation structure): header + side menu on every page + footer in the content column.
export default async function MainLayout({ children }: { children: React.ReactNode }) {
  // The 도우미 domain serves only 채널 만들기 and the terms from this group, under the helper's top bar.
  if ((await getSurface()) === "helper") {
    return (
      <HelperFrame>
        <main>{children}</main>
      </HelperFrame>
    );
  }

  const [session, banner] = await Promise.all([getSession(), getSiteBanner()]);
  const account = session ? await getMyAccount() : null;
  const user =
    session && account
      ? {
          nickname: account.nickname,
          ssumnationId: account.ssumnationId,
          avatarUrl: account.avatarUrl,
          fnBalance: account.fnBalance,
          creator: hasRole(session, "CREATOR")
        }
      : null;

  return (
    <AppShell user={user}>
      {banner && <SiteBanner banner={banner} />}
      <main>{children}</main>
      <GlobalFooter />
    </AppShell>
  );
}
