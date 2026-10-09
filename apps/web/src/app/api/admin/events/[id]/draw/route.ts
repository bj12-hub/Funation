import { adminRoute, readBody } from "@/lib/adminApi";
import { drawEventWinners } from "@/services/admin/events";

/** 당첨자 추첨 (추첨 N명 경품), once, after the event ended: `{ requestId }`. */
export const POST = adminRoute<{ id: string }>(async (admin, req, p) => drawEventWinners(admin, { ...(await readBody(req)), id: p.id }));
