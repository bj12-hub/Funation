import { adminRoute, queryOf } from "@/lib/adminApi";
import { getDonationsView } from "@/services/admin/payments";

export const dynamic = "force-dynamic";

export const GET = adminRoute((_admin, req) => getDonationsView({ status: queryOf(req).status }));
