/**
 * Client-side format checks for auth forms.
 * These give instant feedback only — the server must validate again.
 * Rules come from Figma helper copy (722:838, 722:985).
 */

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/**
 * 8–20 chars with a letter, a digit and a special character — one rule for sign-up, password reset and the
 * password change (2026-10-08 결정, Figma 747:579 copy).
 */
export const isValidPassword = (value: string) =>
  value.length >= 8 && value.length <= 20 && /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

/** 2–12 chars of Korean, English letters or digits. */
export const isValidNickname = (value: string) => /^[가-힣A-Za-z0-9]{2,12}$/.test(value);

/** Keeps digits only and formats as 010-0000-0000 while typing. */
export function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export const isValidPhone = (value: string) => /^01[016789]-\d{3,4}-\d{4}$/.test(value);

/*
 * My page edit rules (Figma 747:28 · 747:304; the password rule is isValidPassword above). The server applies the same checks.
 */

/** Funation ID: 5–20 lowercase English letters or digits (Figma 747:304 copy). */
export const isValidFunationId = (value: string) => /^[a-z0-9]{5,20}$/.test(value);

/** Profile photo types and size (Figma 745:52 · 745:98). */
export const PROFILE_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
