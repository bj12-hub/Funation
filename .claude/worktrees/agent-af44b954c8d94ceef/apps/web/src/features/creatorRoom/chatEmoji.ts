/**
 * 방송 방 채팅 이모지 고르기 (2026-10-06 결정: 기본 유니코드 이모지). Plain characters, so the backend chat sees
 * ordinary text; a custom emote set per channel is TBD.
 */
export const CHAT_EMOJIS: { emoji: string; label: string }[] = [
  { emoji: "😀", label: "웃는 얼굴" },
  { emoji: "😂", label: "기쁨의 눈물" },
  { emoji: "🤣", label: "데굴데굴 웃음" },
  { emoji: "😊", label: "미소" },
  { emoji: "😍", label: "하트 눈" },
  { emoji: "🥰", label: "사랑스러운 얼굴" },
  { emoji: "😎", label: "선글라스" },
  { emoji: "🤔", label: "생각 중" },
  { emoji: "😮", label: "놀람" },
  { emoji: "😢", label: "눈물" },
  { emoji: "😭", label: "엉엉" },
  { emoji: "😡", label: "화남" },
  { emoji: "👍", label: "좋아요" },
  { emoji: "👏", label: "박수" },
  { emoji: "🙌", label: "만세" },
  { emoji: "🙏", label: "부탁해요" },
  { emoji: "💪", label: "힘내요" },
  { emoji: "🔥", label: "불꽃" },
  { emoji: "💯", label: "백점" },
  { emoji: "🎉", label: "축하" },
  { emoji: "❤️", label: "빨간 하트" },
  { emoji: "💜", label: "보라 하트" },
  { emoji: "✨", label: "반짝" },
  { emoji: "🍀", label: "행운" }
];

/**
 * Puts `emoji` in place of the selection [start, end) and returns the new text and caret, or null when the result
 * would be longer than `max` (UTF-16 units, the same count the input's maxLength uses).
 */
export function insertEmoji(text: string, emoji: string, start: number, end: number, max: number): { text: string; caret: number } | null {
  const from = Math.max(0, Math.min(start, end, text.length));
  const to = Math.max(from, Math.min(Math.max(start, end), text.length));
  const next = text.slice(0, from) + emoji + text.slice(to);
  return next.length > max ? null : { text: next, caret: from + emoji.length };
}
