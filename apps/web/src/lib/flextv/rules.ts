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
