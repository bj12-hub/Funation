import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { signatureArchive } from "@/services/donations/signatureCore";

/**
 * 시그니처 ZIP 다운로드 (2026-10-25, StreamDonate 시그니처 관리 참고) for `/creator/widgets/signatures`: every signature's
 * image and sound with `시그니처 목록.csv`. Creator only; never cached.
 */
export async function GET() {
  if (!USE_MOCK) return new Response("Not found", { status: 404 });
  if (!(await getCreatorSession())) return new Response("Unauthorized", { status: 401 });
  const { bytes } = await signatureArchive();
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Length": String(bytes.length),
      "Content-Disposition": `attachment; filename="signatures.zip"; filename*=UTF-8''${encodeURIComponent("시그니처.zip")}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}
