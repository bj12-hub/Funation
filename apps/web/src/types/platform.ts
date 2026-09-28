/** Confirmed external broadcasting platforms (see CLAUDE.md). */
export type Platform = "YOUTUBE" | "FLEXTV" | "SOOP";

export const PLATFORM_LABEL: Record<Platform, string> = {
  YOUTUBE: "YouTube",
  FLEXTV: "FlexTV",
  SOOP: "SOOP"
};
