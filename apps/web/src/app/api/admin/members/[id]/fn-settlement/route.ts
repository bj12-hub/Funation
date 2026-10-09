import { adminRoute, readBody } from "@/lib/adminApi";
import { settleMemberFn } from "@/services/admin/members";

/**
 * 남은 FN 정리 (2026-10-08 결정) of a 영구 정지 member: `{ note, requestId, expectedGrossFn, expectedNetFn,
 * expectedRefundKrw, expectedForfeitFn }` — paid FN refunded per charge under the 환불 정책 기본값, free FN forfeited.
 */
export const POST = adminRoute<{ id: string }>(async (admin, req, p) => settleMemberFn(admin, { ...(await readBody(req)), id: p.id }));
