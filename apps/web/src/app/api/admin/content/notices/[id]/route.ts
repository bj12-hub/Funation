import { adminRoute } from "@/lib/adminApi";
import { deleteNotice } from "@/services/admin/content";

export const DELETE = adminRoute<{ id: string }>((admin, _req, p) => deleteNotice(admin, p.id));
