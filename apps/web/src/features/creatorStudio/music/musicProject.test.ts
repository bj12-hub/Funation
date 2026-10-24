import { describe, expect, it } from "vitest";
import {
  MUSIC_CLIP_MIN,
  clipEnd,
  encodeWav,
  fadeEnvelope,
  fitFades,
  formatSec,
  mixPlan,
  moveClip,
  newClip,
  peaks,
  projectLength,
  splitClip,
  trimClip,
  wavBytes,
  type MusicClip,
  type MusicTrack
} from "./musicProject";

/** 음악 편집기 (2026-10-24, StreamDonate "음악 제작" 참고) — P3. The editing model. */
const source = { id: "src-1", name: "기타", duration: 10 };
const clip = (patch: Partial<MusicClip> = {}): MusicClip => ({ ...newClip("c-1", source, 2), ...patch });

describe("음악 편집기 클립", () => {
  it("places a whole source as a clip, and moves it (never before 0)", () => {
    expect(clip()).toEqual({ id: "c-1", sourceId: "src-1", start: 2, in: 0, out: 10, fadeIn: 0, fadeOut: 0, gain: 1 });
    expect(clipEnd(clip())).toBe(12);
    expect(moveClip(clip(), 5.1234).start).toBe(5.123);
    expect(moveClip(clip(), -3).start).toBe(0);
  });

  it("trims an edge inside its source, keeping the audio in place and the clip at least 0.05s", () => {
    // Left edge +1.5s: starts later, reads from 1.5s in.
    expect(trimClip(clip(), "left", 1.5, 10)).toMatchObject({ start: 3.5, in: 1.5, out: 10 });
    // Not before the source's start, nor before the timeline's.
    expect(trimClip(clip({ in: 1, start: 0.5 }), "left", -5, 10)).toMatchObject({ start: 0, in: 0.5 });
    expect(trimClip(clip(), "left", 20, 10)).toMatchObject({ in: 10 - MUSIC_CLIP_MIN, start: 12 - MUSIC_CLIP_MIN });
    expect(trimClip(clip({ out: 8 }), "right", 5, 10)).toMatchObject({ out: 10 });
    expect(trimClip(clip(), "right", -20, 10)).toMatchObject({ out: MUSIC_CLIP_MIN });
    // Fades shrink with the clip.
    expect(trimClip(clip({ fadeIn: 3, fadeOut: 3 }), "right", -6, 10)).toMatchObject({ out: 4, fadeIn: 3, fadeOut: 1 });
  });

  it("splits at the playhead into two clips that play the same audio", () => {
    const [a, b] = splitClip(clip({ fadeIn: 1, fadeOut: 2 }), 6, "c-2")!;
    expect(a).toMatchObject({ id: "c-1", start: 2, in: 0, out: 4, fadeIn: 1, fadeOut: 0 });
    expect(b).toMatchObject({ id: "c-2", start: 6, in: 4, out: 10, fadeIn: 0, fadeOut: 2 });
    expect(clipEnd(a)).toBe(b.start);
    expect(splitClip(clip(), 2.01, "x")).toBeNull();
    expect(splitClip(clip(), 13, "x")).toBeNull();
  });

  it("fits fades and draws the volume envelope", () => {
    expect(fitFades(clip({ out: 2, fadeIn: 1.5, fadeOut: 1.5 }))).toMatchObject({ fadeIn: 1.5, fadeOut: 0.5 });
    expect(fadeEnvelope(clip({ fadeIn: 1, fadeOut: 2, gain: 0.8 }))).toEqual([
      { t: 2, v: 0 },
      { t: 3, v: 0.8 },
      { t: 10, v: 0.8 },
      { t: 12, v: 0 }
    ]);
    expect(fadeEnvelope(clip()).map((p) => p.v)).toEqual([1, 1, 1, 1]);
  });

  it("mixes unmuted tracks only, times the track volume, and ends at the last clip on any track", () => {
    const tracks: MusicTrack[] = [
      { id: "t1", name: "1", gain: 0.5, muted: false, clips: [clip()] },
      { id: "t2", name: "2", gain: 1, muted: true, clips: [clip({ id: "c-9", start: 20 })] }
    ];
    expect(mixPlan(tracks)).toEqual([{ clipId: "c-1", sourceId: "src-1", when: 2, offset: 0, duration: 10, envelope: fadeEnvelope(clip()).map((p) => ({ t: p.t, v: 0.5 })) }]);
    expect(projectLength(tracks)).toBe(30);
    expect(projectLength([])).toBe(0);
  });
});

describe("음악 편집기 내보내기", () => {
  it("encodes 16-bit PCM WAV with a correct header, clipping out-of-range samples", () => {
    const buf = encodeWav([new Float32Array([0, 1, -1, 2, -2, 0.5])], 22_050);
    const v = new DataView(buf);
    const text = (at: number, n: number) => String.fromCharCode(...new Uint8Array(buf, at, n));
    expect([text(0, 4), text(8, 4), text(12, 4), text(36, 4)]).toEqual(["RIFF", "WAVE", "fmt ", "data"]);
    expect([v.getUint32(4, true), v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true), v.getUint32(28, true), v.getUint16(34, true), v.getUint32(40, true)]).toEqual([
      36 + 12,
      1,
      1,
      22_050,
      44_100,
      16,
      12
    ]);
    expect(Array.from({ length: 6 }, (_, i) => v.getInt16(44 + i * 2, true))).toEqual([0, 32767, -32768, 32767, -32768, 16384]);
    expect(buf.byteLength).toBe(wavBytes(6 / 22_050, 22_050));
    // Stereo interleaves L, R.
    const st = new DataView(encodeWav([new Float32Array([1, 0]), new Float32Array([-1, 0])], 44_100));
    expect([st.getUint16(22, true), st.getInt16(44, true), st.getInt16(46, true)]).toEqual([2, 32767, -32768]);
  });

  it("estimates sizes against the 2MB sound limit and draws peaks", () => {
    expect(wavBytes(20, 44_100)).toBe(44 + 1_764_000);
    expect(wavBytes(30, 44_100)).toBeGreaterThan(2 * 1024 * 1024);
    expect(wavBytes(30, 22_050)).toBeLessThan(2 * 1024 * 1024);
    const data = new Float32Array([0, 0.5, -1, 0.25, 0, 0, 0.75, -0.125]);
    expect(peaks(data, 4, 0, 2, 2)).toEqual([1, 0.75]);
    expect(peaks(data, 4, 1, 2, 1)).toEqual([0.75]);
    expect([formatSec(12.34), formatSec(65)]).toEqual(["12.3초", "1분 5.0초"]);
  });
});
