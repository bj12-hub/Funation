import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminHeader, AdminSideNav } from "@/features/AdminChrome";
import studio from "@/features/shell.module.css";
import { getOperator } from "@/lib/session";

// Admin console shell. Operators only; every page load and action re-checks the operator on the server,
// and the site's admin API re-authorises the app itself.
export const dynamic = "force-dynamic";

export default async function ConsoleLayout({ children }: { children: ReactNode }) {
  const operator = await getOperator();
  if (!operator) redirect("/login");
  return (
    <div className={studio.themeScope}>
      <AdminHeader operator={operator.name} />
      <div className={studio.shell}>
        <AdminSideNav />
        <main className={studio.main}>{children}</main>
      </div>
    </div>
  );
}
