import { adminRoute, readBody } from "@/lib/adminApi";
import { recordSessionEvent } from "@/services/admin/admin";

export const POST = adminRoute(async (admin, req) => recordSessionEvent(admin, (await readBody(req)).event));
