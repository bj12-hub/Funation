import { adminRoute } from "@/lib/adminApi";
import { deleteFaq } from "@/services/admin/content";

export const DELETE = adminRoute<{ id: string }>((admin, _req, p) => deleteFaq(admin, p.id));
