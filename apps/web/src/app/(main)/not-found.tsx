import { NotFoundView } from "@/components/layout/NotFoundView";

// notFound() inside site pages (missing creator, deleted post, …): the 404 keeps the site header and menu.
export default function MainNotFound() {
  return <NotFoundView />;
}
