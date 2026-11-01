import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { FLEXTV_WALLET } from "@/lib/flextv/mode";
import { getSession } from "@/lib/session";
import { getMyAccount } from "@/services/account/myAccount";

// Figma 640:2 · 632:4 — FN 내역 pages share the side navigation. Signed-in members only.
export const dynamic = "force-dynamic";

export default async function WalletLayout({ children }: { children: ReactNode }) {
  // Route guard for UX only; the backend must authorize every wallet API call. With the FLEXTV backend the wallet is
  // FLEXTV's and needs only the session (the mock's account is not there).
  const signedIn = FLEXTV_WALLET ? !!(await getSession()) : !!(await getMyAccount());
  if (!signedIn) redirect("/login?next=/wallet/charges");

  return (
    <>
      {children}
    </>
  );
}
