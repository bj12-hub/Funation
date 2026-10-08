const BASE = "http://same-site.invalid";

/**
 * Returns `path` only if it is a same-site relative path (e.g. "/mypage"), otherwise `fallback`.
 * Prevents open redirects through `?next=`.
 *
 * The path is resolved the way a browser resolves it: browsers drop tabs and newlines and read "\" as "/", so
 * "/\t/evil.com" or "/\\evil.com" would leave the site even though they start with a single "/". Anything that
 * resolves to another origin falls back; the normalized path (without those characters) is returned.
 */
export function safeRedirectPath(path: string | string[] | undefined, fallback = "/") {
  if (typeof path !== "string" || !path.startsWith("/")) return fallback;
  let url: URL;
  try {
    url = new URL(path, BASE);
  } catch {
    return fallback;
  }
  // Dot segments can also collapse into "//" ("/.//evil.com" → "//evil.com"), which reads as another host.
  if (url.origin !== BASE || url.pathname.startsWith("//")) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}
