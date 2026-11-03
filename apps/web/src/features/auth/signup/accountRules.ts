import { FLEXTV_NICKNAME_MAX, FLEXTV_PASSWORD_SPECIALS, hasReservedLoginWord, isFlextvLoginId, isFlextvNickname, isFlextvPassword } from "@/lib/flextv/rules";
import type { MessageKey } from "@/lib/i18n/translate";
import { isEmail, isValidNickname, isValidPassword } from "@/lib/validation";
import { checkFlextvNicknameAvailability, checkLoginIdAvailability } from "@/services/auth/flextvSignup";
import { checkEmailAvailability, checkNicknameAvailability, type AvailabilityResult } from "@/services/auth/signup";

/**
 * What the 계정 설정 step asks for. Ssumnation's mock: an e-mail as the 아이디 (Figma 45:39). FLEXTV backend: FLEXTV's
 * 아이디 · 비밀번호 · 닉네임 rules (lib/flextv/rules.ts), since new members are FLEXTV members.
 */
export type AccountRules = {
  identifier: {
    label: string;
    name: string;
    type: "email" | "text";
    autoComplete: string;
    placeholder: string;
    maxLength?: number;
    /** Format check before 중복 확인; `forbidden` refuses a reserved word without asking the server. */
    isValid: (value: string) => boolean;
    forbidden?: (value: string) => boolean;
    check: (value: string) => Promise<AvailabilityResult>;
    messages: { format: string; taken: string; forbidden: string; unchecked: string; available: string; formatHint?: string };
  };
  password: { isValid: (value: string) => boolean; placeholder: string; hint: string };
  nickname: { isValid: (value: string) => boolean; check: (value: string) => Promise<AvailabilityResult>; maxLength: number; placeholder: string; formatHint: string };
};

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** The rules with their text in the viewer's language (`t` from useI18n). */
export type AccountRulesFor = (t: Translate) => AccountRules;

export const ssumnationAccountRules: AccountRulesFor = (t) => ({
  identifier: {
    label: t("auth.emailLabel"),
    name: "email",
    type: "email",
    autoComplete: "email",
    placeholder: "example@email.com",
    isValid: isEmail,
    check: checkEmailAvailability,
    messages: {
      format: t("auth.emailFormat"),
      taken: t("auth.emailTaken"),
      forbidden: t("auth.emailForbidden"),
      unchecked: t("auth.emailUnchecked"),
      available: t("auth.emailAvailable")
    }
  },
  password: { isValid: isValidPassword, placeholder: t("auth.passwordPlaceholder", { min: 8, max: 20 }), hint: t("auth.passwordHint", { min: 8, max: 20 }) },
  nickname: {
    isValid: isValidNickname,
    check: checkNicknameAvailability,
    maxLength: 12,
    placeholder: t("auth.nicknamePlaceholder", { min: 2, max: 12 }),
    formatHint: t("auth.nicknameHint", { min: 2, max: 12 })
  }
});

export const flextvAccountRules: AccountRulesFor = (t) => ({
  identifier: {
    label: t("auth.loginIdLabel"),
    name: "loginId",
    type: "text",
    autoComplete: "username",
    placeholder: t("auth.loginIdPlaceholder"),
    maxLength: 15,
    isValid: isFlextvLoginId,
    forbidden: hasReservedLoginWord,
    check: checkLoginIdAvailability,
    messages: {
      format: t("auth.loginIdFormat"),
      taken: t("auth.loginIdTaken"),
      forbidden: t("auth.loginIdForbidden"),
      unchecked: t("auth.loginIdUnchecked"),
      available: t("auth.loginIdAvailable"),
      formatHint: t("auth.loginIdHint")
    }
  },
  password: {
    isValid: isFlextvPassword,
    placeholder: t("auth.passwordPlaceholder", { min: 8, max: 15 }),
    hint: t("auth.flextvPasswordHint", { min: 8, max: 15, specials: FLEXTV_PASSWORD_SPECIALS })
  },
  nickname: {
    isValid: isFlextvNickname,
    check: checkFlextvNicknameAvailability,
    maxLength: FLEXTV_NICKNAME_MAX,
    placeholder: t("auth.nicknamePlaceholder", { min: 2, max: FLEXTV_NICKNAME_MAX }),
    formatHint: t("auth.flextvNicknameHint", { min: 2, max: FLEXTV_NICKNAME_MAX })
  }
});
