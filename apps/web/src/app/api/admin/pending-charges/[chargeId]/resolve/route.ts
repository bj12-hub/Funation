import { adminRoute, readBody } from "@/lib/adminApi";
import { resolvePendingCharge } from "@/services/admin/pendingCharges";

/** 결제 확인 / 결제 취소: `{ outcome: "COMPLETED" | "CANCELLED", note, requestId }` for a charge still 처리중. */
export const POST = adminRoute<{ chargeId: string }>(async (admin, req, p) => resolvePendingCharge(admin, { ...(await readBody(req)), chargeId: p.chargeId }));
