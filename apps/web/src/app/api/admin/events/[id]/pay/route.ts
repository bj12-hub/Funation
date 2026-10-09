import { adminRoute, readBody } from "@/lib/adminApi";
import { payEventReward } from "@/services/admin/events";

/** 보상 지급 (참여자 전원 무상 FN), once, after the event ended: `{ requestId }`. */
export const POST = adminRoute<{ id: string }>(async (admin, req, p) => payEventReward(admin, { ...(await readBody(req)), id: p.id }));
