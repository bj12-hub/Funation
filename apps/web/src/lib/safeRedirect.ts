/**
 * Returns `path` only if it is a same-site relative path (e.g. "/mypage"), otherwise `fallback`.
 * Prevents open redirects through `?next=`.
 */
export function safeRedirectPath(path: string | string[] | undefined, fallback = "/") {
  if (typeof path !== "string") return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}
