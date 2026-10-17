/**
 * A crew overlay address as the screen shows it: the integration key masked (`c2b6-····-····-····`), as on 오버레이 주소
 * and in the widget popups — the studio is often on screen while live. Only the 복사 button copies the full address.
 */
export const shownOverlayAddress = (origin: string, overlayPath: string, query = "") =>
  `${origin}${overlayPath.replace(/[^/]+$/, (key) => `${key.slice(0, 4)}-····-····-····`)}${query}`;
