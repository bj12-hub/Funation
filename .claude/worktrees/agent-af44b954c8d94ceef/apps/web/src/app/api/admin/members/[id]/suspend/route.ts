import { adminRoute, readBody } from "@/lib/adminApi";
import { suspendMember } from "@/services/admin/members";

export const POST = adminRoute<{ id: string }>(async (admin, req, p) => suspendMember(admin, { ...(await readBody(req)), id: p.id }));
