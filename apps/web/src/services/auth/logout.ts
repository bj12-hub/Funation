"use server";

import { redirect } from "next/navigation";
import { endSession } from "@/lib/session";

/** Server Action: clears the session cookie and returns to the home screen. */
export async function logout() {
  // TODO: also revoke the session on the backend once it exists.
  await endSession();
  redirect("/");
}
