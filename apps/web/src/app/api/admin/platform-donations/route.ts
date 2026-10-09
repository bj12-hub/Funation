import { adminRoute } from "@/lib/adminApi";
import { getPendingDonations } from "@/services/admin/pendingDonations";

export const dynamic = "force-dynamic";

/** 확인 중 후원 (2026-10-08 결정): reading it re-checks the PENDING platform donations still inside their 24 h. */
export const GET = adminRoute(async () => getPendingDonations());
