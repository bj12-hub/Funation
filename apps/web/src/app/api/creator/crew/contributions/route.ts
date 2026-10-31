import type { NextRequest } from "next/server";
import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { xlsxFile } from "@/lib/xlsx";
import { contributionTable } from "@/services/crew/crewHistoryCore";

/**
 * 기여도 내보내기 as Excel (.xlsx, 2026-10-25 — StreamDonate 프리셋별 기여도 내역 "엑셀 내보내기") for `/creator/crew/broadcast`:
 * the same table as the CSV (contributionTable). `?format=ROUNDS|LINES` with `broadcastId=<id>` (LINES only) or
 * `project=<name>` (empty = the broadcasts started without one). Creator only, never cached; the row count and whether it
 * was cut come back in `X-Export-Rows` · `X-Export-Truncated` for the screen's note.
 */
export async function GET(request: NextRequest) {
  if (!USE_MOCK) return new Response("Not found", { status: 404 });
  if (!(await getCreatorSession())) return Response.json({ message: "로그인이 필요해요." }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const input: Record<string, unknown> = { format: q.get("format") };
  if (q.has("broadcastId")) input.broadcastId = q.get("broadcastId");
  else if (q.has("project")) input.project = q.get("project") || null;
  const table = contributionTable(input);
  if ("message" in table) return Response.json({ message: table.message }, { status: 400, headers: { "Cache-Control": "no-store" } });
  const bytes = xlsxFile(table.sheet, table.headers, table.rows);
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="contributions.xlsx"; filename*=UTF-8''${encodeURIComponent(`${table.name}.xlsx`)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Export-Rows": String(table.count),
      "X-Export-Truncated": String(table.truncated)
    }
  });
}
