import { describe, expect, it } from "vitest";
import { hasReservedLoginWord, isFlextvLoginId, isFlextvNickname, isFlextvPassword } from "./rules";

/**
 * FLEXTV's account rules, checked against FLEXTV's own expressions (server/services/auth/auth.const.js LOGIN_ID_REGEX,
 * server/const.js NICK_REGEX) so a value Ssumnation accepts is one FLEXTV accepts.
 */
const FLEXTV_LOGIN_ID = /^(?!(?:[0-9]+)$)[a-zA-Z0-9]{6,15}$/;
const FLEXTV_NICK = /^[가-힣a-zA-Z0-9~`!@#$%^&*()-+=]{2,10}$/;

describe("FLEXTV account rules", () => {
  it("accepts the 아이디 FLEXTV accepts", () => {
    for (const value of ["viewer01", "abcdef", "ABCdef123456789", "123456", "12345a", "abc", "abcdefghijklmnop", "abc_def", "아이디아이디"]) {
      expect(isFlextvLoginId(value), value).toBe(FLEXTV_LOGIN_ID.test(value));
    }
    expect(hasReservedLoginWord("myflexid")).toBe(true);
    expect(hasReservedLoginWord("myFLEXid")).toBe(false);
  });

  it("accepts the nicknames FLEXTV accepts", () => {
    for (const value of ["시청자", "a", "열글자닉네임입니다", "열한글자닉네임입니다요", "nick!@#", "nick?", "nick-", "nick_", "nick name", "nick*+=", "😀😀"]) {
      expect(isFlextvNickname(value), value).toBe(FLEXTV_NICK.test(value));
    }
  });

  it("asks for 8–15 characters with a letter, a digit and one of FLEXTV's specials", () => {
    expect(isFlextvPassword("pass!word1")).toBe(true);
    expect(isFlextvPassword("pass?word1")).toBe(true);
    expect(isFlextvPassword("password1")).toBe(false);
    expect(isFlextvPassword("pass-word1")).toBe(false);
    expect(isFlextvPassword("!1aaaaa")).toBe(false);
    expect(isFlextvPassword("pass!word1234567")).toBe(false);
  });
});
