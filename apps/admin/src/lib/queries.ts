import { redirect } from "next/navigation";
import type {
  AdminCreatorRow,
  AdminDashboard,
  AdminReportView,
  AdminSettlementView,
  AuditPage,
  DonationsView,
  FaqItem,
  MemberDetail,
  MemberPage,
  Notice,
  PaymentsView,
  PlatformStatusRow,
  SystemView
} from "@/types/adminApi";
import { getOperator } from "./session";
import { siteGet } from "./siteApi";

/** Page data loaders (Server Components). Sign-in is required; site errors surface in app/error.tsx. */
async function get<T>(path: string): Promise<T | null> {
  const operator = await getOperator();
  if (!operator) redirect("/login");
  return siteGet<T>(operator, path);
}
const qs = (params: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export const loadDashboard = () => get<AdminDashboard>("/dashboard");
export const loadAudit = (show: number) => get<AuditPage>(`/audit${qs({ show })}`);
export const loadMembers = (params: Record<string, string | undefined>) => get<MemberPage>(`/members${qs(params)}`);
export const loadMember = (id: string) => get<MemberDetail>(`/members/${encodeURIComponent(id)}`);
export const loadCreators = (q: string) => get<AdminCreatorRow[]>(`/creators${qs({ q })}`);
export const loadPayments = () => get<PaymentsView>("/payments");
export const loadDonations = (status: string | null) => get<DonationsView>(`/donations${qs({ status })}`);
export const loadSettlements = (status: string | null) => get<AdminSettlementView>(`/settlements${qs({ status })}`);
export const loadNotices = () => get<Notice[]>("/content/notices");
export const loadFaqs = () => get<FaqItem[]>("/content/faqs");
export const loadReports = (status: string | null) => get<AdminReportView>(`/reports${qs({ status })}`);
export const loadPlatforms = () => get<PlatformStatusRow[]>("/platforms");
export const loadSystem = () => get<SystemView>("/system");
