import { adminRoute, queryOf } from "@/lib/adminApi";
import { listAuditLog } from "@/services/admin/admin";

export const dynamic = "force-dynamic";

export const GET = adminRoute((_admin, req) => listAuditLog({ show: queryOf(req).show }));
