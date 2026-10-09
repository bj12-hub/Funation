import { adminRoute } from "@/lib/adminApi";
import { listEventsAdmin } from "@/services/admin/events";

export const dynamic = "force-dynamic";

/** 운영 › 이벤트 (2026-10-08 결정): every event with its reward setting and result. */
export const GET = adminRoute(async () => listEventsAdmin());
