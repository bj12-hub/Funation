import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { DEFAULT_REPLACEMENT_MESSAGE, type DonationPageSettings, type FilterSettings, type FilterStrength } from "./donationManagementTypes";

/**
 * Server-only 후원 페이지 설정 and 후원 필터링 stores (not a "use server" module): the 후원관리+ actions write them and
 * the Donation Core reads them when it puts a donation on stream. Kept on `globalThis` like the other mocks.
 */
type MockManagement = Omit<DonationPageSettings, "donateUrlBase" | "slug">;

const g = globalThis as typeof globalThis & { __ssumnationMockDonationMgmt?: MockManagement; __ssumnationMockDonationFilterSettings?: FilterSettings };
export const donationPageStore = (g.__ssumnationMockDonationMgmt ??= {
  oneLineMessage: "제 방송을 시청해주셔서 감사합니다.",
  options: { rankPublic: false, historyPublic: true, nicknameChangeable: true, customSoundPublic: false },
  replacement: { applyToNickname: false, applyToText: true, bannedWords: ["클리어"], message: "" }
});

/** 후원 필터링 › 필터링 (539:466). */
export const donationFilterStore = (g.__ssumnationMockDonationFilterSettings ??= { strength: "NORMAL", blockSpam: true, words: ["광고", "어그로", "욕설"] });

/** Case-insensitive substring match (금지어 and 커스텀 블랙리스트 단어). */
const hasWord = (text: string, words: readonly string[]) => words.some((w) => text.toLowerCase().includes(w.toLowerCase()));

/** Letters and digits only, lowercased: "운 영 자" and "a.d.m.i.n" read as the word they spell. */
const squeeze = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/**
 * 비속어 필터 강도. There is no profanity dictionary yet (provider TBD), so every level checks only the platform forbidden
 * words (MOCK_FORBIDDEN_WORDS, which chat and the Donation Core already refuse as written):
 * - 사용 안 함 (OFF): no check.
 * - 보통 (NORMAL): the word as written, case-insensitive.
 * - 매우 높음 (HIGH): also when spaces or symbols split it ("운 영 자", "a.d.m.i.n"), even across words.
 * TBD: the real dictionary and what each level covers.
 */
export function hasProfanity(text: string, strength: FilterStrength): boolean {
  if (strength === "OFF") return false;
  if (hasWord(text, MOCK_FORBIDDEN_WORDS)) return true;
  return strength === "HIGH" && MOCK_FORBIDDEN_WORDS.some((w) => squeeze(text).includes(squeeze(w)));
}

/**
 * 특수 문자/도배 차단. The screen names the switch only, so the rule is deliberately narrow (assumption, TBD: tune with
 * real messages). A message counts when it has
 * - 도배: one character 10+ times in a row ("ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ", "!!!!!!!!!!"), or the same 2–5 characters (starting
 *   with a non-space) 5+ times in a row ("사랑해사랑해사랑해사랑해사랑해"); runs of spaces do not count;
 * - 특수 문자: 10+ characters that are not letters, digits or spaces (symbols, emoji, combining marks), making up more
 *   than half of the non-space characters.
 * Each message is judged alone: sending many donations is not 도배 here (each one is paid).
 */
export function isSpamMessage(text: string): boolean {
  if (/(\S)\1{9,}/u.test(text) || /(\S.{1,4})\1{4,}/u.test(text)) return true;
  const chars = [...text].filter((c) => !/\s/u.test(c));
  const symbols = chars.filter((c) => !/[\p{L}\p{N}]/u.test(c)).length;
  return symbols >= 10 && symbols * 2 > chars.length;
}

/** 후원 필터링 (2026-10-06 결정 "대체 메시지로 바꿔 표시"): the message only — the screen speaks of 도네이션 내용. */
const filteredOut = (message: string, f: FilterSettings) =>
  hasWord(message, f.words) || hasProfanity(message, f.strength) || (f.blockSpam && isSpamMessage(message));

/**
 * What a donation shows on stream (the alert and its TTS); the payment and the records keep the original text.
 * - 대체 메시지 표시 설정 (Figma 539:7): "도네이터가 등록한 금지어를 사용하여 후원할 경우, 사전에 등록된 대체메시지로
 *   노출됩니다." A name or message with one of the creator's 금지어 shows as the 대체 메시지 when that target
 *   (닉네임 / 텍스트 내용) is switched on.
 * - 후원 필터링 (539:466): a message the filter matches shows as the 대체 메시지 too, whatever the 텍스트 내용 switch
 *   says; the donation itself goes through as usual.
 * An empty 대체 메시지 (2026-10-06 결정 "기본 문구로 표시"): the message shows DEFAULT_REPLACEMENT_MESSAGE and the name
 * shows 익명, the label a hidden profile already uses.
 */
export function shownOnStream(shown: { donor: string; message: string }): { donor: string; message: string } {
  const { applyToNickname, applyToText, bannedWords, message } = donationPageStore.replacement;
  const replaceText = (applyToText && hasWord(shown.message, bannedWords)) || filteredOut(shown.message, donationFilterStore);
  return {
    donor: applyToNickname && hasWord(shown.donor, bannedWords) ? message || "익명" : shown.donor,
    message: replaceText ? message || DEFAULT_REPLACEMENT_MESSAGE : shown.message
  };
}
