import { USE_MOCK } from "@/lib/mock";
import { sameSecret } from "@/lib/secret";
import { creatorAccessOpen } from "@/services/account/creatorAccess";
import { bankSmsStore, receiveBankSms } from "@/services/bankSms/bankSmsCore";
import { BANK_SMS_LIMITS } from "@/services/bankSms/bankSmsTypes";

/**
 * SMS 계좌후원 webhook — code-first mock (2026-10-06). A text-forwarding app posts each bank SMS here: JSON
 * `{ "text": "...", "id": "optional message id" }` or the plain text itself. The key in the path is the secret
 * (재발급 on `/creator/widgets/link`). Responses never echo the text. TBD: per-forwarder formats, rate limits.
 */

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!USE_MOCK) return json(404, { status: "NOT_FOUND" });
  if (!sameSecret((await params).key, bankSmsStore().key)) return json(404, { status: "NOT_FOUND" });
  // A suspended or withdrawn creator's key stops working, like their session does.
  if (!creatorAccessOpen()) return json(403, { status: "OFF" });
  // Refuse a large body before reading it (a declared length), and again after (chunked bodies have none).
  const limit = BANK_SMS_LIMITS.textMax * 4;
  if (Number(request.headers.get("content-length") ?? 0) > limit * 4) return json(413, { status: "TOO_LARGE" });
  const raw = await request.text();
  if (raw.length > limit) return json(413, { status: "TOO_LARGE" });
  let text = raw;
  let id: string | null = null;
  if ((request.headers.get("content-type") ?? "").includes("application/json")) {
    try {
      const body = JSON.parse(raw) as { text?: unknown; id?: unknown };
      text = typeof body.text === "string" ? body.text : "";
      id = typeof body.id === "string" && body.id.length <= 100 ? body.id : null;
    } catch {
      return json(400, { status: "BAD_REQUEST" });
    }
  }
  text = text.trim();
  if (!text || text.length > BANK_SMS_LIMITS.textMax) return json(400, { status: "BAD_REQUEST" });
  const res = receiveBankSms(text, id);
  if (res.status === "OK") return json(200, { status: "OK", amount: res.deposit.amount });
  if (res.status === "DUPLICATE") return json(200, { status: "DUPLICATE" });
  if (res.status === "UNPARSED") return json(422, { status: "UNPARSED" });
  return json(403, { status: "OFF" });
}
