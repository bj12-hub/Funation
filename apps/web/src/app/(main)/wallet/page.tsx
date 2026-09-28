import { redirect } from "next/navigation";

/** `/wallet` (FN 내역) opens the charge history tab. */
export default function Page() {
  redirect("/wallet/charges");
}
