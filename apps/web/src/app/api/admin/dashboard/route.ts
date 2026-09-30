import { adminRoute } from "@/lib/adminApi";
import { getAdminDashboard } from "@/services/admin/admin";

export const dynamic = "force-dynamic";

export const GET = adminRoute(() => getAdminDashboard());
