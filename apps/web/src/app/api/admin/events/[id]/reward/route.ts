import { adminRoute, readBody } from "@/lib/adminApi";
import { saveEventReward } from "@/services/admin/events";

/** 보상 설정: `{ kind: "FREE_FN", amountFn }` or `{ kind: "DRAW", winners, prize }`. */
export const POST = adminRoute<{ id: string }>(async (admin, req, p) => saveEventReward(admin, { ...(await readBody(req)), id: p.id }));
