import { adminRoute, queryOf } from "@/lib/adminApi";
import { getSettlementReview } from "@/services/admin/settlements";

export const dynamic = "force-dynamic";

export const GET = adminRoute((_admin, req) => getSettlementReview({ status: queryOf(req).status }));
