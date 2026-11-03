/**
 * FLEXTV's account rules, copied from its sign-up (`server/services/auth/auth.const.js`, `server/const.js`). Existing
 * FLEXTV members keep their 아이디 · 닉네임, so new accounts follow the same rules; Ssumnation's own rules
 * (`lib/validation.ts`) stay for the mock. Client checks are UX only — FLEXTV validates again on sign-up.
 */

/** 6–15 English letters or digits, not digits only. */
export const isFlextvLoginId = (value: string) => /^(?![0-9]+$)[a-zA-Z0-9]{6,15}$/.test(value);

/** FLEXTV refuses a 아이디 containing "flex" (reserved for its own accounts). */
export const hasReservedLoginWord = (value: string) => value.includes("flex");

/**
 * The special characters FLEXTV's password rule accepts. Compared as a list, not a regex character class: lib/csv.test.ts
 * reads a class holding = + @ as a CSV formula check of its own.
 */
export const FLEXTV_PASSWORD_SPECIALS = "~`!?@#$%^&*()+=";
/** FLEXTV's NICK_REGEX allows the same specials but "?". */
const NICKNAME_SPECIALS = FLEXTV_PASSWORD_SPECIALS.replace("?", "");

/** 8–15 characters with a letter, a digit and one of FLEXTV_PASSWORD_SPECIALS. */
export const isFlextvPassword = (value: string) =>
  value.length >= 8 && value.length <= 15 && /[a-zA-Z]/.test(value) && /\d/.test(value) && [...value].some((c) => FLEXTV_PASSWORD_SPECIALS.includes(c));

/** 2–10 characters of 한글, English letters, digits and NICKNAME_SPECIALS (FLEXTV's NICK_REGEX). */
export const isFlextvNickname = (value: string) =>
  value.length >= 2 && value.length <= 10 && [...value].every((c) => /^[가-힣a-zA-Z0-9]$/.test(c) || NICKNAME_SPECIALS.includes(c));

export const FLEXTV_NICKNAME_MAX = 10;

/** FLEXTV's 채널 설정 form (its channel-setting page): 방송국 이름 2–15자, 소개 250자, 배너 JPG · PNG under 20MB. */
export const CHANNEL_NAME_MIN = 2;
export const CHANNEL_NAME_MAX = 15;
export const CHANNEL_DESCRIPTION_MAX = 250;
export const CHANNEL_BANNER_MAX_BYTES = 20 * 1024 * 1024;
export const CHANNEL_BANNER_TYPES = ["image/jpeg", "image/png"] as const;

/** FLEXTV's 1:1 문의 form (its PostForm, phase 9): 제목 50자, 내용 1000자, one PNG · JPEG picture under 20MB. */
export const FLEXTV_INQUIRY_TITLE_MAX = 50;
export const FLEXTV_INQUIRY_BODY_MAX = 1000;
export const FLEXTV_INQUIRY_IMAGE_MAX_BYTES = 20_000_000;
export const FLEXTV_INQUIRY_IMAGE_TYPES = ["image/png", "image/jpeg"] as const;

/** FLEXTV's chat settings (phase 9): the pop-up 공지 and 규칙 up to 250 characters, a 금지어 up to 30. */
export const CHAT_NOTICE_MAX = 250;
export const BAN_WORD_MAX = 30;

/** The platforms FLEXTV's 방송국 홈페이지 form has a field for. */
export const LINK_PLATFORMS = ["instagram", "youtube", "discord", "tiktok", "twitter"] as const;
export type LinkPlatform = (typeof LINK_PLATFORMS)[number];
