/**
 * 음악 편집기 — code-first, StreamDonate "음악 제작" 참고 (P3). The editing model, kept apart from the screen so it can be
 * tested: tracks of clips on one timeline (seconds), each clip a piece of a decoded source (`in` ~ `out`) placed at `start`,
 * with its own 볼륨 and 페이드. Everything runs in the browser; the mixed result is a WAV saved to the 이미지·사운드
 * library (or downloaded). Nothing here touches money.
 */

export const MUSIC_TRACKS_MAX = 4;
export const MUSIC_CLIPS_MAX = 30;
/** The longest mix, seconds (기본값). */
export const MUSIC_LENGTH_MAX = 60;
/** The shortest a clip can be trimmed or split to, seconds. */
export const MUSIC_CLIP_MIN = 0.05;
export const MUSIC_GAIN_MAX = 2;
/** A source file read from disk, at most (bytes). */
export const MUSIC_FILE_MAX = 20 * 1024 * 1024;
/** 녹음 stops by itself after this many seconds. */
export const MUSIC_RECORD_MAX = 60;
export const MUSIC_QUALITIES = [
  { key: "STANDARD", label: "표준 (44.1kHz)", sampleRate: 44_100 },
  { key: "SMALL", label: "작게 (22.05kHz)", sampleRate: 22_050 }
] as const;
export type MusicQuality = (typeof MUSIC_QUALITIES)[number]["key"];

export type MusicSource = { id: string; name: string; duration: number };
export type MusicClip = { id: string; sourceId: string; start: number; in: number; out: number; fadeIn: number; fadeOut: number; gain: number };
export type MusicTrack = { id: string; name: string; gain: number; muted: boolean; clips: MusicClip[] };

const round = (v: number) => Math.round(v * 1000) / 1000;
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const clipLength = (c: MusicClip) => c.out - c.in;
export const clipEnd = (c: MusicClip) => c.start + clipLength(c);
/** Where the mix ends: the last clip's end on any track (muted ones too — muting keeps the timeline). */
export const projectLength = (tracks: MusicTrack[]) => tracks.reduce((end, t) => t.clips.reduce((e, c) => Math.max(e, clipEnd(c)), end), 0);
export const clipCount = (tracks: MusicTrack[]) => tracks.reduce((n, t) => n + t.clips.length, 0);

/** Fades that fit the clip: each at least 0, together no longer than the clip. */
export function fitFades(c: MusicClip): MusicClip {
  const len = clipLength(c);
  const fadeIn = round(clamp(c.fadeIn, 0, len));
  return { ...c, fadeIn, fadeOut: round(clamp(c.fadeOut, 0, len - fadeIn)) };
}

/** A whole source as a new clip at `start`. */
export const newClip = (id: string, source: MusicSource, start: number): MusicClip => ({ id, sourceId: source.id, start: round(Math.max(0, start)), in: 0, out: round(source.duration), fadeIn: 0, fadeOut: 0, gain: 1 });

/** The clip moved to start at `start` (never before 0). */
export const moveClip = (c: MusicClip, start: number): MusicClip => ({ ...c, start: round(Math.max(0, start)) });

/**
 * The clip with one edge dragged by `delta` seconds on the timeline: the left edge moves `in` and `start` together (the
 * audio stays where it was), the right edge moves `out`. It stays inside its source and at least MUSIC_CLIP_MIN long.
 */
export function trimClip(c: MusicClip, edge: "left" | "right", delta: number, sourceDuration: number): MusicClip {
  if (edge === "left") {
    const d = clamp(delta, Math.max(-c.in, -c.start), clipLength(c) - MUSIC_CLIP_MIN);
    return fitFades({ ...c, in: round(c.in + d), start: round(c.start + d) });
  }
  const d = clamp(delta, MUSIC_CLIP_MIN - clipLength(c), sourceDuration - c.out);
  return fitFades({ ...c, out: round(c.out + d) });
}

/** The clip cut in two at timeline `at` (the first keeps its 페이드 인, the second its 페이드 아웃), or null when `at` is too near an edge. */
export function splitClip(c: MusicClip, at: number, rightId: string): [MusicClip, MusicClip] | null {
  const cut = at - c.start;
  if (cut < MUSIC_CLIP_MIN || clipLength(c) - cut < MUSIC_CLIP_MIN) return null;
  const mid = round(c.in + cut);
  return [fitFades({ ...c, out: mid, fadeOut: 0 }), fitFades({ ...c, id: rightId, start: round(at), in: mid, fadeIn: 0 })];
}

/** The clip's volume over the timeline: 0 → 볼륨 over the 페이드 인, held, → 0 over the 페이드 아웃. */
export function fadeEnvelope(c: MusicClip): { t: number; v: number }[] {
  const { fadeIn, fadeOut } = fitFades(c);
  const end = clipEnd(c);
  return [
    { t: c.start, v: fadeIn > 0 ? 0 : c.gain },
    { t: round(c.start + fadeIn), v: c.gain },
    { t: round(end - fadeOut), v: c.gain },
    { t: end, v: fadeOut > 0 ? 0 : c.gain }
  ];
}

/** What the mixer plays: every clip of every unmuted track, with its place, its piece of the source and its envelope × the track volume. */
export function mixPlan(tracks: MusicTrack[]) {
  return tracks.flatMap((t) =>
    t.muted ? [] : t.clips.map((c) => ({ clipId: c.id, sourceId: c.sourceId, when: c.start, offset: c.in, duration: clipLength(c), envelope: fadeEnvelope(c).map((p) => ({ t: p.t, v: p.v * t.gain })) }))
  );
}

/** A WAV file's size for `seconds` of 16-bit PCM. */
export const wavBytes = (seconds: number, sampleRate: number, channels = 1) => 44 + Math.ceil(seconds * sampleRate) * channels * 2;

/** 16-bit PCM WAV (RIFF) of `channels` (each the same length), samples clipped to -1 ~ 1. */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const frames = channels[0]?.length ?? 0;
  const n = channels.length;
  const buf = new ArrayBuffer(44 + frames * n * 2);
  const v = new DataView(buf);
  const text = (at: number, s: string) => [...s].forEach((ch, i) => v.setUint8(at + i, ch.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + frames * n * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, n, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * n * 2, true);
  v.setUint16(32, n * 2, true);
  v.setUint16(34, 16, true);
  text(36, "data");
  v.setUint32(40, frames * n * 2, true);
  let at = 44;
  for (let i = 0; i < frames; i++) {
    for (const ch of channels) {
      const s = clamp(ch[i], -1, 1);
      v.setInt16(at, s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff), true);
      at += 2;
    }
  }
  return buf;
}

/** `count` peak heights (0 ~ 1) of `data` between `from` and `to` seconds, for a clip's waveform. */
export function peaks(data: Float32Array, sampleRate: number, from: number, to: number, count: number): number[] {
  const a = Math.max(0, Math.floor(from * sampleRate));
  const b = Math.min(data.length, Math.ceil(to * sampleRate));
  const step = Math.max(1, (b - a) / count);
  return Array.from({ length: count }, (_, i) => {
    let peak = 0;
    for (let j = Math.floor(a + i * step); j < Math.min(b, Math.floor(a + (i + 1) * step)); j++) peak = Math.max(peak, Math.abs(data[j]));
    return Math.min(1, peak);
  });
}

/** "12.3초" / "1분 5.0초". */
export const formatSec = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}분 ${(s % 60).toFixed(1)}초` : `${s.toFixed(1)}초`);
