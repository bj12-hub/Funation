import type { DonationRequest, DonationResult } from "@/services/donations/donationTypes";

/**
 * Sending a confirmed donation without ever debiting twice. Each sent request gets its own idempotency key. While a
 * request's outcome is unknown (the answer was lost, or the server is still on it) it stays `unsettled`, and the next
 * confirm first re-sends exactly that request with the same key: the server answers with what happened to it. If it
 * completed, that is the result (an edited form is not sent); only once it is known to have failed without a debit
 * does the form's current request go out.
 */

/** A request without its key (per donation type: Omit over the union would drop the type-specific fields). */
export type FormRequest = DonationRequest extends infer R ? (R extends unknown ? Omit<R, "idempotencyKey"> : never) : never;
export type Sent<K extends string = string> = { request: DonationRequest; formKey: K; chatText: string };
export type SubmitState<K extends string = string> = { unsettled: Sent<K> | null };

/** IN_PROGRESS: the server is still on it. UNAUTHORIZED: the session ended before the server looked at the request. */
const stillUnknown = (r: DonationResult) => r.status === "IN_PROGRESS" || r.status === "UNAUTHORIZED";

/** The same donation apart from its key (the form builds requests with a fixed field order). */
export const sameRequest = (a: FormRequest, b: FormRequest) =>
  JSON.stringify({ ...a, idempotencyKey: undefined }) === JSON.stringify({ ...b, idempotencyKey: undefined });

/**
 * Sends `form` (or first settles the earlier unknown request) and returns the answer with the request it belongs to.
 * Throws when an answer is lost; the request then stays unsettled for the next call.
 */
export async function submitDonation<K extends string>(
  state: SubmitState<K>,
  form: FormRequest,
  meta: { formKey: K; chatText: string },
  send: (request: DonationRequest) => Promise<DonationResult>,
  newKey: () => string
): Promise<{ sent: Sent<K>; result: DonationResult }> {
  const earlier = state.unsettled;
  if (earlier) {
    const result = await send(earlier.request);
    const failed = result.status !== "COMPLETED" && !stillUnknown(result);
    if (!failed || sameRequest(earlier.request, form)) return settle(state, earlier, result);
    state.unsettled = null; // it failed without a debit: the edited form goes out
  }
  const sent: Sent<K> = { request: { ...form, idempotencyKey: newKey() }, ...meta };
  state.unsettled = sent; // unknown until the answer arrives
  return settle(state, sent, await send(sent.request));
}

function settle<K extends string>(state: SubmitState<K>, sent: Sent<K>, result: DonationResult) {
  if (!stillUnknown(result)) state.unsettled = null;
  return { sent, result };
}
