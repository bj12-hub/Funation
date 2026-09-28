/**
 * Client-side format checks for auth forms.
 * These give instant feedback only — the server must validate again.
 * Rules come from Figma helper copy (722:838, 722:985).
 */

export const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** 8+ chars, must contain a letter, a digit and a special character. */
export const isValidPassword = (value: string) =>
  value.length >= 8 && /[A-Za-z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

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
