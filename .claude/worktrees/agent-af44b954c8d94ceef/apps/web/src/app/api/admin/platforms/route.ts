import { adminRoute } from "@/lib/adminApi";
import { getPlatformStatus } from "@/services/admin/system";

export const dynamic = "force-dynamic";

export const GET = adminRoute(() => getPlatformStatus());
