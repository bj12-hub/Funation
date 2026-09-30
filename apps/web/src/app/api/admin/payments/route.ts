import { adminRoute } from "@/lib/adminApi";
import { getPaymentsView } from "@/services/admin/payments";

export const dynamic = "force-dynamic";

export const GET = adminRoute(() => getPaymentsView());
