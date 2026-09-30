import { adminRoute, readBody } from "@/lib/adminApi";
import { restoreMember } from "@/services/admin/members";

export const POST = adminRoute<{ id: string }>(async (admin, req, p) => restoreMember(admin, { ...(await readBody(req)), id: p.id }));
