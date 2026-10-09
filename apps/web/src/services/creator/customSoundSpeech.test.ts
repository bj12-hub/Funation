import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { alertSpeech, speechParts } from "./customSoundSpeech";

/** 커스텀 사운드 (code-first): TTS reads the message and plays each registered word's sound in its place. */
const sound = (word: string, url = `/s/${word}`, volume = 50) => ({ word, url, volume });

describe("speechParts", () => {
  it("reads the whole message when no word is registered or none appears", () => {
    expect(speechParts("오늘 방송 재밌어요", [])).toEqual([{ kind: "TEXT", text: "오늘 방송 재밌어요" }]);
    expect(speechParts("오늘 방송 재밌어요", [sound("ㅋㅋ")])).toEqual([{ kind: "TEXT", text: "오늘 방송 재밌어요" }]);
    expect(speechParts("   ", [sound("ㅋㅋ")])).toEqual([]);
  });

  it("plays the sound in place of each word and reads the text around it", () => {
    expect(speechParts("안녕하세요 ㅋㅋ 오늘도 ㅋㅋ", [sound("ㅋㅋ", "/s/laugh", 80)])).toEqual([
      { kind: "TEXT", text: "안녕하세요" },
      { kind: "SOUND", url: "/s/laugh", volume: 80 },
      { kind: "TEXT", text: "오늘도" },
      { kind: "SOUND", url: "/s/laugh", volume: 80 }
    ]);
    expect(speechParts("ㅋㅋ", [sound("ㅋㅋ")])).toEqual([{ kind: "SOUND", url: "/s/ㅋㅋ", volume: 50 }]);
  });

  it("prefers the longer word where words overlap and matches letters in any case", () => {
    expect(speechParts("ㅋㅋㅋ 대박", [sound("ㅋㅋ"), sound("ㅋㅋㅋ")]).map((p) => (p.kind === "SOUND" ? p.url : p.text))).toEqual(["/s/ㅋㅋㅋ", "대박"]);
    expect(speechParts("GG 잘했어요 gg", [sound("gg")]).map((p) => p.kind)).toEqual(["SOUND", "TEXT", "SOUND"]);
  });

  it("treats a word's symbols as plain text", () => {
    expect(speechParts("와 (박수) 최고 ?!", [sound("(박수)"), sound("?!")]).map((p) => (p.kind === "SOUND" ? p.url : p.text))).toEqual(["와", "/s/(박수)", "최고", "/s/?!"]);
    expect(speechParts("a.b axb", [sound("a.b")]).map((p) => (p.kind === "SOUND" ? p.url : p.text))).toEqual(["/s/a.b", "axb"]);
  });
});

/** 2026-10-09 결정: TTS follows 후원 메시지 표시 (후원 알림 디자인). TTS reads only the message, so off = silent. */
describe("alertSpeech", () => {
  const base = { message: "오늘도 ㅋㅋ 화이팅", showMessage: true, on: true, muted: false, ttsVolume: 80, sounds: [sound("ㅋㅋ", "/s/laugh", 80)] };

  it("reads the message with its 커스텀 사운드 while the message is shown", () => {
    expect(alertSpeech(base)).toEqual([
      { kind: "TEXT", text: "오늘도" },
      { kind: "SOUND", url: "/s/laugh", volume: 80 },
      { kind: "TEXT", text: "화이팅" }
    ]);
  });

  it("stays silent with 후원 메시지 표시 off — no name reading, no 커스텀 사운드", () => {
    expect(alertSpeech({ ...base, showMessage: false })).toEqual([]);
  });

  it("stays silent when muted, at TTS 볼륨 0, with 기능 제어 OFF or without a message", () => {
    expect(alertSpeech({ ...base, muted: true })).toEqual([]);
    expect(alertSpeech({ ...base, ttsVolume: 0 })).toEqual([]);
    expect(alertSpeech({ ...base, on: false })).toEqual([]);
    expect(alertSpeech({ ...base, message: "" })).toEqual([]);
  });

  it("is what the OBS alert overlay speaks (no direct speechParts call there)", () => {
    const overlay = readFileSync(new URL("../../features/creatorStudio/remote/AlertOverlay.tsx", import.meta.url), "utf8");
    expect(overlay).toMatch(/alertSpeech\(\{[^}]*showMessage/);
    expect(overlay).not.toMatch(/speechParts\(/);
  });
});
