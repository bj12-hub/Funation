import type { OverlayCustomSound } from "./alertTypes";
import { CUSTOM_SOUND_TYPES } from "./widgetSettingsTypes";
import { widgetStore } from "./widgetStore";

/**
 * Server-only 커스텀 사운드 reads for the 후원 알림 overlay (code-first). The mock keeps each sound as a data URL;
 * the overlay gets a short address instead (`/api/custom-sound/[id]`), so the 1-second poll never carries the audio.
 */
export const customSoundPath = (id: string) => `/api/custom-sound/${id}`;

/** Every registered word with its audio address and volume, in the order they were added. */
export function overlayCustomSounds(): OverlayCustomSound[] {
  return widgetStore.CUSTOM_SOUND.sounds.map((s) => ({ word: s.word, url: s.fileUrl.startsWith("data:") ? customSoundPath(s.id) : s.fileUrl, volume: s.volume }));
}

/** A registered sound's audio for the mock CDN route; null when the sound is gone or not an allowed audio type. */
export function customSoundFile(id: string): { mime: string; bytes: Buffer } | null {
  const url = widgetStore.CUSTOM_SOUND.sounds.find((s) => s.id === id)?.fileUrl;
  const comma = url?.indexOf(",") ?? -1;
  if (!url || comma < 0) return null;
  const head = url.slice(0, comma);
  const mime = head.replace(/^data:/, "").replace(/;base64$/, "");
  if (head !== `data:${mime};base64` || !(CUSTOM_SOUND_TYPES as readonly string[]).includes(mime)) return null;
  return { mime, bytes: Buffer.from(url.slice(comma + 1), "base64") };
}
