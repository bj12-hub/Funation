import { adminRoute, readBody } from "@/lib/adminApi";
import { holdRefund } from "@/services/admin/payments";

/** 보류 / 보류 해제 (2026-10-08 결정): `{ action: "HOLD" | "RELEASE", note, requestId }` for a waiting charge refund request. */
export const POST = adminRoute<{ chargeId: string }>(async (admin, req, p) => holdRefund(admin, { ...(await readBody(req)), chargeId: p.chargeId }));
