import { describe, expect, it } from "vitest";
import { speechParts } from "./customSoundSpeech";

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
