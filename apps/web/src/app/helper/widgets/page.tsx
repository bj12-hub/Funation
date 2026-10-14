import { redirect } from "next/navigation";

// The first 도우미 build had a 위젯 catalog here; each widget now has its own menu page, listed on the home.
export default function Page() {
  redirect("/");
}
