import { adminRoute, readBody } from "@/lib/adminApi";
import { decideSettlement } from "@/services/admin/settlements";

export const POST = adminRoute<{ id: string }>(async (admin, req, p) => decideSettlement(admin, { ...(await readBody(req)), id: p.id }));
