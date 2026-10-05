import { describe, expect, it } from "vitest";
import { CHAT_EMOJIS, insertEmoji } from "./chatEmoji";

describe("채팅 이모지", () => {
  it("inserts at the caret or replaces the selection", () => {
    expect(insertEmoji("안녕", "👍", 2, 2, 200)).toEqual({ text: "안녕👍", caret: 4 });
    expect(insertEmoji("안녕하세요", "😀", 2, 2, 200)).toEqual({ text: "안녕😀하세요", caret: 4 });
    expect(insertEmoji("안녕하세요", "🔥", 0, 2, 200)).toEqual({ text: "🔥하세요", caret: 2 });
    expect(insertEmoji("", "❤️", 0, 0, 200)).toEqual({ text: "❤️", caret: 2 });
  });

  it("clamps a stale caret to the text", () => {
    expect(insertEmoji("ab", "✨", 9, 12, 200)).toEqual({ text: "ab✨", caret: 3 });
    expect(insertEmoji("ab", "✨", 2, 0, 200)).toEqual({ text: "✨", caret: 1 });
  });

  it("refuses to go over the message limit", () => {
    expect(insertEmoji("a".repeat(199), "😀", 199, 199, 200)).toBeNull(); // 😀 is two UTF-16 units
    expect(insertEmoji("a".repeat(198), "😀", 198, 198, 200)).toEqual({ text: `${"a".repeat(198)}😀`, caret: 200 });
  });

  it("offers a fixed set of distinct emoji with Korean labels", () => {
    expect(new Set(CHAT_EMOJIS.map((e) => e.emoji)).size).toBe(CHAT_EMOJIS.length);
    expect(CHAT_EMOJIS.every((e) => e.label.length > 0)).toBe(true);
  });
});
