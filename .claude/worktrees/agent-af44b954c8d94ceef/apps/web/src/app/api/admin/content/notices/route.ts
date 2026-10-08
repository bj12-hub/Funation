import { adminRoute, readBody } from "@/lib/adminApi";
import { listNoticesAdmin, saveNotice } from "@/services/admin/content";

export const dynamic = "force-dynamic";

export const GET = adminRoute(() => listNoticesAdmin());
export const POST = adminRoute(async (admin, req) => saveNotice(admin, await readBody(req)));
