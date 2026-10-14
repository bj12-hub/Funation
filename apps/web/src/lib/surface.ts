import { headers } from "next/headers";
import { HELPER_PATH_HEADER, SURFACE_HEADER, type Surface } from "@/lib/helperRouting";
import { safeRedirectPath } from "@/lib/safeRedirect";

/**
 * Which product the request's host serves (set by the middleware): the site, or the Ssumnation 도우미 domain.
 * Chrome only (headers, menus, links) — never an authorization input.
 */
export async function getSurface(): Promise<Surface> {
  return (await headers()).get(SURFACE_HEADER) === "helper" ? "helper" : "site";
}

/** The helper address the visitor opened (for `?next=` after sign-in), or "/". */
export async function getHelperPath(): Promise<string> {
  return safeRedirectPath((await headers()).get(HELPER_PATH_HEADER) ?? undefined);
}
