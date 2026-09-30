import { adminRoute, readBody } from "@/lib/adminApi";
import { saveSiteBanner } from "@/services/admin/system";

export const PUT = adminRoute(async (admin, req) => saveSiteBanner(admin, await readBody(req)));
