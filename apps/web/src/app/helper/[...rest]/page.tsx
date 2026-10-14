import { notFound } from "next/navigation";

// Any other address on the helper domain (including the site's own pages) is the helper's 404.
export default function Page() {
  notFound();
}
