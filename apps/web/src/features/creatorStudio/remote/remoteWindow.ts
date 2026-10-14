/** The 리모컨 on its own (no studio or 도우미 menu): a small browser window, an OBS custom browser dock or a phone. */
export const REMOTE_WINDOW_PATH = "/popout/remote";

/**
 * Opens the 리모컨 window (the legacy FlexTV 도우미 opened its "라이브 방송 리모컨" at 1000 × 800). Returns false when the
 * browser blocked the popup, so the caller can show the remote in place instead.
 */
export function openRemoteWindow(): boolean {
  const w = window.open(REMOTE_WINDOW_PATH, "ssumnation-remote", "width=1000,height=800");
  w?.focus();
  return w !== null;
}
