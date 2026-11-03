import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSitePath } from "@/lib/surface";
import { getMyAccount } from "@/services/account/myAccount";

// Figma 817:9017 · 817:8317 — SOOP / FlexTV 후원 pages share the side navigation. Signed-in members only.
export const dynamic = "force-dynamic";

export default async function DonationLayout({ children }: { children: ReactNode }) {
  // Route guard for UX only; every donation action re-checks the session on the server.
  const account = await getMyAccount();
  // After signing in, back to the page that was opened (this runs before that page's own redirect).
  if (!account) redirect(`/login?next=${encodeURIComponent(await getSitePath())}`);

  return (
    <>
      {children}
    </>
  );
}
