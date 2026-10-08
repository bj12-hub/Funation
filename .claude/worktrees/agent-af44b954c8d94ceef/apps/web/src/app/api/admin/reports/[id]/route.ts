import { adminRoute, readBody } from "@/lib/adminApi";
import { decideReport } from "@/services/admin/reports";

export const POST = adminRoute<{ id: string }>(async (admin, req, p) => decideReport(admin, { ...(await readBody(req)), id: p.id }));
