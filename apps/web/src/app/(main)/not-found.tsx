import { NotFoundView } from "@/components/layout/NotFoundView";
import { HelperNotFound } from "@/features/helper/HelperNotFound";
import { getSurface } from "@/lib/surface";

// notFound() inside site pages (missing creator, deleted post, …): the 404 keeps the site header and menu.
// On the 도우미 domain (terms, 채널 만들기) it points back to the helper instead.
export default async function MainNotFound() {
  return (await getSurface()) === "helper" ? <HelperNotFound /> : <NotFoundView />;
}
