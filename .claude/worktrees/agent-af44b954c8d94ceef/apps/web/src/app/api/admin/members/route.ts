import { adminRoute, queryOf } from "@/lib/adminApi";
import { listMembers } from "@/services/admin/members";

export const dynamic = "force-dynamic";

export const GET = adminRoute((_admin, req) => listMembers(queryOf(req)));
