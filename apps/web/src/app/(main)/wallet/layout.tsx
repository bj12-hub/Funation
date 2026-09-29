import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getMyAccount } from "@/services/account/myAccount";

// Figma 640:2 · 632:4 — FN 내역 pages share the side navigation. Signed-in members only.
export const dynamic = "force-dynamic";

export default async function WalletLayout({ children }: { children: ReactNode }) {
  // Route guard for UX only; the backend must authorize every wallet API call.
  const account = await getMyAccount();
  if (!account) redirect("/login?next=/wallet/charges");

  return (
    <>
      {children}
    </>
  );
}
