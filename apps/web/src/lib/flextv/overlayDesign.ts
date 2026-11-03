import { requestFrom, type DeviceContext } from "./auth";
import { FlextvUnavailableError, flextvRequest, isRecord, type FlextvResponse } from "./client";
import { isOverlayKey } from "./ssumnationBroadcast";

/**
 * The overlay design document FLEXTV keeps for Ssumnation (phase 8, docs/development/flextv-ssumnation-api.md §10):
 * the streamer's own (`/api/ssumnation/my/overlay-design`) and an overlay's, by its key
 * (`/api/ssumnation/overlay/:key/design`). FLEXTV keeps it as Ssumnation sends it; what it holds is
 * services/creator/flextvOverlayDesign.ts's to read.
 */

/** The document, `null` when the streamer never saved one, `"UNAUTHORIZED"` when FLEXTV no longer takes the token. */
export function mapDesign({ status, data }: Pick<FlextvResponse, "status" | "data">): unknown {
  if (status === 401 || status === 403) return "UNAUTHORIZED";
  if (status === 404) return null;
  if (status === 200 && isRecord(data)) return data.design ?? null;
  throw new FlextvUnavailableError(`FLEXTV overlay design answered ${status}`);
}

export async function fetchMyDesign(token: string): Promise<unknown> {
  return mapDesign(await flextvRequest("/api/ssumnation/my/overlay-design", { token }));
}

export type DesignSave = { kind: "SAVED" } | { kind: "INVALID"; message: string | null } | { kind: "UNAUTHORIZED" };

export function mapDesignSave({ status, data }: Pick<FlextvResponse, "status" | "data">): DesignSave {
  if (status === 401 || status === 403) return { kind: "UNAUTHORIZED" };
  if (status === 200 && isRecord(data) && data.status === "SAVED") return { kind: "SAVED" };
  if (status === 400 && isRecord(data) && data.status === "INVALID") return { kind: "INVALID", message: typeof data.message === "string" ? data.message.slice(0, 100) : null };
  throw new FlextvUnavailableError(`FLEXTV overlay design save answered ${status}`);
}

export async function saveMyDesign(token: string, context: DeviceContext, design: Record<string, unknown>): Promise<DesignSave> {
  return mapDesignSave(await flextvRequest("/api/ssumnation/my/overlay-design", { method: "PUT", body: { design }, token, ...requestFrom(context) }));
}

/** An overlay's design by its key: `undefined` for a key FLEXTV does not know (the page answers 404). */
export async function fetchOverlayDesign(key: string): Promise<unknown> {
  if (!isOverlayKey(key)) return undefined;
  const response = await flextvRequest(`/api/ssumnation/overlay/${key}/design`);
  if (response.status === 404) return undefined;
  if (response.status !== 200) throw new FlextvUnavailableError(`FLEXTV overlay design answered ${response.status}`);
  return isRecord(response.data) ? (response.data.design ?? null) : null;
}
