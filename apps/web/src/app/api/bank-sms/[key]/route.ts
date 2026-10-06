import { timingSafeEqual } from "node:crypto";
import { USE_MOCK } from "@/lib/mock";
import { bankSmsStore, receiveBankSms } from "@/services/bankSms/bankSmsCore";
import { BANK_SMS_LIMITS } from "@/services/bankSms/bankSmsTypes";

/**
 * SMS 계좌후원 webhook — code-first mock (2026-10-06). A text-forwarding app posts each bank SMS here: JSON
 * `{ "text": "...", "id": "optional message id" }` or the plain text itself. The key in the path is the secret
 * (재발급 on `/creator/widgets/link`). Responses never echo the text. TBD: per-forwarder formats, rate limits.
 */

const json = (status: number, body: Record<string, unknown>) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

const sameKey = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!USE_MOCK) return json(404, { status: "NOT_FOUND" });
  if (!sameKey((await params).key, bankSmsStore().key)) return json(404, { status: "NOT_FOUND" });
  const raw = await request.text();
  if (raw.length > BANK_SMS_LIMITS.textMax * 4) return json(413, { status: "TOO_LARGE" });
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
