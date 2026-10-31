import { USE_MOCK } from "@/lib/mock";
import { findAsset } from "@/services/creator/assetCore";

/**
 * Mock CDN for 이미지·사운드 library files (code-first). The id is an unguessable UUID, like a CDN key;
 * the bytes were type-checked on upload and are served with their sniffed type and `nosniff`.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!USE_MOCK) return new Response("Not found", { status: 404 });
  const asset = findAsset((await params).id);
  if (!asset) return new Response("Not found", { status: 404 });
  const size = asset.bytes.length;
  const headers = {
    "Content-Type": asset.mime,
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox"
  };
  // One byte range (2026-10-25, 후원 이펙트 영상): video players ask for parts of the file. Anything else gets it whole.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start >= size || start > end) return new Response(null, { status: 416, headers: { ...headers, "Content-Range": `bytes */${size}` } });
    return new Response(new Uint8Array(asset.bytes.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) }
    });
  }
  return new Response(new Uint8Array(asset.bytes), { headers: { ...headers, "Content-Length": String(size) } });
}
