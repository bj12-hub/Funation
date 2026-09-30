import { adminRoute } from "@/lib/adminApi";
import { checkPlatform } from "@/services/admin/system";

export const POST = adminRoute<{ platform: string }>((_admin, _req, p) => checkPlatform(p.platform));
