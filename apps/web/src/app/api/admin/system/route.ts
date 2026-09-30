import { adminRoute } from "@/lib/adminApi";
import { getSystemView } from "@/services/admin/system";

export const dynamic = "force-dynamic";

export const GET = adminRoute(() => getSystemView());
