import { FLEXTV_NICKNAME_MAX, FLEXTV_PASSWORD_SPECIALS, hasReservedLoginWord, isFlextvLoginId, isFlextvNickname, isFlextvPassword } from "@/lib/flextv/rules";
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

export const SSUMNATION_ACCOUNT_RULES: AccountRules = {
  identifier: {
    label: "아이디 (이메일)",
    name: "email",
    type: "email",
    autoComplete: "email",
    placeholder: "example@email.com",
    isValid: isEmail,
    check: checkEmailAvailability,
    messages: {
      format: "올바른 이메일 형식이 아닙니다.",
      taken: "이미 사용 중인 이메일입니다. 다른 이메일을 사용해 주세요.",
      forbidden: "사용할 수 없는 이메일입니다.",
      unchecked: "이메일 중복 확인을 해 주세요.",
      available: "사용 가능한 이메일입니다."
    }
  },
  password: { isValid: isValidPassword, placeholder: "8~20자, 영문/숫자/특수문자 포함", hint: "8~20자 · 영문, 숫자, 특수문자를 모두 포함해 주세요." },
  nickname: {
    isValid: isValidNickname,
    check: checkNicknameAvailability,
    maxLength: 12,
    placeholder: "2~12자 이내",
    formatHint: "2~12자의 한글, 영문, 숫자만 사용할 수 있어요."
  }
};

export const FLEXTV_ACCOUNT_RULES: AccountRules = {
  identifier: {
    label: "아이디",
    name: "loginId",
    type: "text",
    autoComplete: "username",
    placeholder: "6~15자 영문, 숫자",
    maxLength: 15,
    isValid: isFlextvLoginId,
    forbidden: hasReservedLoginWord,
    check: checkLoginIdAvailability,
    messages: {
      format: "올바른 아이디 형식이 아닙니다.",
      taken: "이미 사용 중인 아이디입니다. 다른 아이디를 사용해 주세요.",
      forbidden: "아이디에 'flex'는 사용할 수 없어요.",
      unchecked: "아이디 중복 확인을 해 주세요.",
      available: "사용 가능한 아이디입니다.",
      formatHint: "6~15자의 영문, 숫자로 입력해 주세요. 숫자만으로는 만들 수 없어요."
    }
  },
  password: {
    isValid: isFlextvPassword,
    placeholder: "8~15자, 영문/숫자/특수문자 포함",
    hint: `8~15자 · 영문, 숫자와 특수문자(${FLEXTV_PASSWORD_SPECIALS} 중 하나)를 모두 포함해 주세요.`
  },
  nickname: {
    isValid: isFlextvNickname,
    check: checkFlextvNicknameAvailability,
    maxLength: FLEXTV_NICKNAME_MAX,
    placeholder: `2~${FLEXTV_NICKNAME_MAX}자 이내`,
    formatHint: `2~${FLEXTV_NICKNAME_MAX}자의 한글, 영문, 숫자로 입력해 주세요.`
  }
};
