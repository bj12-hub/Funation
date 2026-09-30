import { adminRoute, readBody } from "@/lib/adminApi";
import { listFaqsAdmin, saveFaq } from "@/services/admin/content";

export const dynamic = "force-dynamic";

export const GET = adminRoute(() => listFaqsAdmin());
export const POST = adminRoute(async (admin, req) => saveFaq(admin, await readBody(req)));
