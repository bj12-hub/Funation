import { adminRoute, queryOf } from "@/lib/adminApi";
import { listReports } from "@/services/admin/reports";

export const dynamic = "force-dynamic";

export const GET = adminRoute((_admin, req) => listReports({ status: queryOf(req).status }));
