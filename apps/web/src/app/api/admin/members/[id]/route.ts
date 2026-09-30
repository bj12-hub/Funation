import { adminRoute } from "@/lib/adminApi";
import { getMemberDetail } from "@/services/admin/members";

export const dynamic = "force-dynamic";

export const GET = adminRoute<{ id: string }>((_admin, _req, p) => getMemberDetail(p.id));
