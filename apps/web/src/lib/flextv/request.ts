import { headers } from "next/headers";
import { deviceContextFrom, type DeviceContext } from "./auth";

/** The member's IP and device for a FLEXTV call made from a Server Action. */
export async function requestDeviceContext(): Promise<DeviceContext> {
  return deviceContextFrom(await headers());
}

/**
 * This site's address as the member reached it, for links the studio shows them to share (내 후원링크). Only a plain
 * host[:port] is taken from the headers.
 */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host")?.split(",")[0]?.trim() || h.get("host") || "";
  const proto = h.get("x-forwarded-proto")?.split(",")[0]?.trim() || (process.env.NODE_ENV === "production" ? "https" : "http");
  return /^[A-Za-z0-9.-]+(:\d+)?$/.test(host) && /^https?$/.test(proto) ? `${proto}://${host}` : "https://ssumnation.com";
}
