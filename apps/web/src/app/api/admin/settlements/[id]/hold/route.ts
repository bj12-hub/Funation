import { adminRoute, readBody } from "@/lib/adminApi";
import { holdSettlement } from "@/services/admin/settlements";

/** 보류 / 보류 해제 (2026-10-08 결정): `{ action: "HOLD" | "RELEASE", note, requestId }` for a 심사 대기 or 승인 request. */
export const POST = adminRoute<{ id: string }>(async (admin, req, p) => holdSettlement(admin, { ...(await readBody(req)), id: p.id }));
