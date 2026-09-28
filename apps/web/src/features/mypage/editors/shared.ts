export const GENERIC_ERROR = "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요";

/** ISO date → "2026년 10월 18일" (Figma 747:166 / 747:439). */
export function formatKoreanDate(iso: string) {
  return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Seoul" }).format(new Date(iso));
}

/** Korean particle 으로/로 for `word` (Figma 747:210: "길동의펀타임" → "으로"). */
export function euroParticle(word: string) {
  const last = word.charCodeAt(word.length - 1);
  if (last < 0xac00 || last > 0xd7a3) return "로";
  const finalConsonant = (last - 0xac00) % 28;
  // No final consonant, or ㄹ (index 8), takes 로.
  return finalConsonant === 0 || finalConsonant === 8 ? "로" : "으로";
}

/** 2.4MB style size (Figma 745:52). */
export const formatMegabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;
