import { AppShell } from "@/components/layout/AppShell";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { SiteBanner } from "@/components/layout/SiteBanner";
import { HelperFrame } from "@/features/helper/HelperLanding";
import { FLEXTV_AUTH } from "@/lib/flextv/mode";
import { getSession, hasRole, type Session } from "@/lib/session";
import { getSurface } from "@/lib/surface";
import { getMyAccount } from "@/services/account/myAccount";
import { getSiteBanner } from "@/services/system/siteBanner";
import { getWalletBalance } from "@/services/wallet/balance";

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
  // FLEXTV backend (docs/development/flextv-backend.md): the member and the 렉스 balance are FLEXTV's — 마이페이지's
  // account is still the mock's, and absent without it.
  const user = FLEXTV_AUTH
    ? session && {
        nickname: session.nickname,
        ssumnationId: session.ssumnationId,
        avatarUrl: session.avatarUrl,
        fnBalance: await getWalletBalance(),
        creator: hasRole(session, "CREATOR")
      }
    : await mockUser(session);

  return (
    <AppShell user={user}>
      {banner && <SiteBanner banner={banner} />}
      <main>{children}</main>
      <GlobalFooter />
    </AppShell>
  );
}

async function mockUser(session: Session | null) {
  const account = session ? await getMyAccount() : null;
  return session && account
    ? { nickname: account.nickname, ssumnationId: account.ssumnationId, avatarUrl: account.avatarUrl, fnBalance: account.fnBalance, creator: hasRole(session, "CREATOR") }
    : null;
}
