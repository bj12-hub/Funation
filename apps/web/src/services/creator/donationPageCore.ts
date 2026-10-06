import type { DonationPageSettings } from "./donationManagementTypes";

/**
 * Server-only 후원 페이지 설정 store (not a "use server" module): the 후원관리+ actions write it and the Donation
 * Core reads the 대체 메시지 표시 설정 when it puts a donation on stream. Kept on `globalThis` like the other mocks.
 */
type MockManagement = Omit<DonationPageSettings, "donateUrlBase" | "slug">;

const g = globalThis as typeof globalThis & { __funationMockDonationMgmt?: MockManagement };
export const donationPageStore = (g.__funationMockDonationMgmt ??= {
  oneLineMessage: "제 방송을 시청해주셔서 감사합니다.",
  options: { rankPublic: false, historyPublic: true, nicknameChangeable: true, customSoundPublic: false },
  replacement: { applyToNickname: false, applyToText: true, bannedWords: ["클리어"], message: "" }
});

const hasBanned = (text: string, words: string[]) => words.some((w) => text.toLowerCase().includes(w.toLowerCase()));

/**
 * 대체 메시지 표시 설정 (Figma 539:7): "도네이터가 등록한 금지어를 사용하여 후원할 경우, 사전에 등록된 대체메시지로
 * 노출됩니다." A donor name or message containing one of the creator's 금지어 is shown as the 대체 메시지 when that
 * target (닉네임 / 텍스트 내용) is switched on. Only what goes on stream changes (the alert and its TTS); the payment
 * and the records keep the original text. An empty 대체 메시지 shows no text; for a name it falls back to 익명, the
 * label a hidden profile already uses (TBD: final rule for an empty 대체 메시지).
 */
export function shownOnStream(shown: { donor: string; message: string }): { donor: string; message: string } {
  const { applyToNickname, applyToText, bannedWords, message } = donationPageStore.replacement;
  return {
    donor: applyToNickname && hasBanned(shown.donor, bannedWords) ? message || "익명" : shown.donor,
    message: applyToText && hasBanned(shown.message, bannedWords) ? message : shown.message
  };
}
