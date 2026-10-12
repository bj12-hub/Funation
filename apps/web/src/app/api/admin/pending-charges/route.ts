import { adminRoute } from "@/lib/adminApi";
import { getPendingCharges } from "@/services/admin/pendingCharges";

export const dynamic = "force-dynamic";

/** 처리 중 충전 (2026-10-12 결정): FN 충전 still 처리중 (`waiting`) and the ones decided in the console (`resolved`). */
export const GET = adminRoute(async () => getPendingCharges());
