import { adminRoute, readBody } from "@/lib/adminApi";
import { paySettlement } from "@/services/admin/settlements";

/** 지급 완료 (2026-10-08 결정): `{ reference, requestId }` for an APPROVED request. */
export const POST = adminRoute<{ id: string }>(async (admin, req, p) => paySettlement(admin, { ...(await readBody(req)), id: p.id }));
