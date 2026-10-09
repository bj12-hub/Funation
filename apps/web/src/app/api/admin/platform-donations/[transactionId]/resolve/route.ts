import { adminRoute, readBody } from "@/lib/adminApi";
import { resolvePendingDonation } from "@/services/admin/pendingDonations";

/** 성공 / 실패 결정: `{ outcome: "COMPLETED" | "FAILED", note, requestId }` for a donation still unknown after 24 h. */
export const POST = adminRoute<{ transactionId: string }>(async (admin, req, p) => resolvePendingDonation(admin, { ...(await readBody(req)), transactionId: p.transactionId }));
