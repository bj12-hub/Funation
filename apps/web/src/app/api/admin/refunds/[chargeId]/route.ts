import { adminRoute, readBody } from "@/lib/adminApi";
import { decideRefund } from "@/services/admin/payments";

export const POST = adminRoute<{ chargeId: string }>(async (admin, req, p) => decideRefund(admin, { ...(await readBody(req)), chargeId: p.chargeId }));
