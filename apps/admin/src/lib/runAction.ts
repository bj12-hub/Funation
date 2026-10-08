import type { ActionResult } from "@/types/adminApi";

/**
 * Runs a console Server Action from a form. A call that throws (the admin server restarting or unreachable, an action
 * gone stale after a deploy) comes back as UNAVAILABLE, so the form shows its inline error and keeps what the operator
 * typed, instead of the whole page turning into the error screen.
 */
export async function runAction(action: () => Promise<ActionResult>): Promise<ActionResult> {
  try {
    return await action();
  } catch {
    return { status: "UNAVAILABLE" };
  }
}
