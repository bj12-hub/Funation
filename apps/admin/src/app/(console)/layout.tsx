import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminSideNav, AdminTopbar } from "@/features/AdminChrome";
import shell from "@/features/shell.module.css";
import { getOperator, isMock } from "@/lib/session";

// Admin console shell. Operators only; every page load and action re-checks the operator on the server,
// and the site's admin API re-authorises the app itself.
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const operator = await getOperator();
  if (!operator) redirect("/login");
  return (
    <div className={shell.themeScope}>
      <AdminSideNav />
      <div className={shell.column}>
        <AdminTopbar operator={operator.name} mock={isMock()} />
        <main className={shell.main}>{children}</main>
      </div>
    </div>
  );
}
