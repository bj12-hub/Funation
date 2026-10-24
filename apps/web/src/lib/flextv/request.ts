import { headers } from "next/headers";
import { deviceContextFrom, type DeviceContext } from "./auth";

/** The member's IP and device for a FLEXTV call made from a Server Action. */
export async function requestDeviceContext(): Promise<DeviceContext> {
  return deviceContextFrom(await headers());
}
