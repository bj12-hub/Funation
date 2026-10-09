import type { OverlayCustomSound } from "./alertTypes";

/** One step of reading a donation message aloud: TTS text, or a 커스텀 사운드 played in place of its word. */
export type SpeechPart = { kind: "TEXT"; text: string } | { kind: "SOUND"; url: string; volume: number };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Splits a message into TTS text and 커스텀 사운드 (code-first): every registered word (letters in any case) becomes
 * its sound, the text between is read as it is, and blank pieces are dropped. Where words overlap the longer one wins
 * ("ㅋㅋㅋ" before "ㅋㅋ"). How many sounds one message may play is TBD (none capped; TTS 스킵 stops it).
 */
export function speechParts(message: string, sounds: OverlayCustomSound[]): SpeechPart[] {
  const parts: SpeechPart[] = [];
  const text = (t: string) => {
    if (t.trim()) parts.push({ kind: "TEXT", text: t.trim() });
  };
  const words = sounds.filter((s) => s.word.length > 0).sort((a, b) => b.word.length - a.word.length);
  if (words.length === 0) {
    text(message);
    return parts;
  }
  // One group per word, so the matched group tells which sound it is.
  const pattern = new RegExp(words.map((s) => `(${escapeRegExp(s.word)})`).join("|"), "giu");
  let at = 0;
  for (const m of message.matchAll(pattern)) {
    const sound = words[m.slice(1).findIndex((g) => g !== undefined)];
    text(message.slice(at, m.index));
    parts.push({ kind: "SOUND", url: sound.url, volume: sound.volume });
    at = m.index + m[0].length;
  }
  text(message.slice(at));
  return parts;
}

/**
 * What the OBS 후원 알림 reads aloud for an alert (empty = nothing). TTS reads the message only — there is no setting that
 * reads the name — so it follows 후원 메시지 표시 (2026-10-09 결정): with the message hidden it stays silent, 커스텀 사운드
 * included (they play inside the message). 음소거, TTS 볼륨 0, 기능 제어 OFF and an empty message are silent too. The
 * 시그니처 소리 is not TTS and plays as before.
 */
export function alertSpeech(input: {
  message: string;
  showMessage: boolean;
  on: boolean;
  muted: boolean;
  ttsVolume: number;
  sounds: OverlayCustomSound[];
}): SpeechPart[] {
  if (!input.on || input.muted || input.ttsVolume === 0 || !input.showMessage || !input.message) return [];
  return speechParts(input.message, input.sounds);
}
