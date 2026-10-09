import { adminRoute } from "@/lib/adminApi";
import { checkPendingDonation } from "@/services/admin/pendingDonations";

/** 다시 확인: asks the platform about a PENDING donation now; answers `{ status: "OK", outcome }`. */
export const POST = adminRoute<{ transactionId: string }>(async (admin, _req, p) => checkPendingDonation(admin, { transactionId: p.transactionId }));
