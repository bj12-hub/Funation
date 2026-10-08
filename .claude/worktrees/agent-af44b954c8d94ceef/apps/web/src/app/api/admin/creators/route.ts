import { adminRoute, queryOf } from "@/lib/adminApi";
import { listAdminCreators } from "@/services/admin/members";

export const dynamic = "force-dynamic";

export const GET = adminRoute((_admin, req) => listAdminCreators({ q: queryOf(req).q }));
