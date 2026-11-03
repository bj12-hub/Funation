import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import { mapPasswordUpdate, mapProfileUpdate, readMyAccount } from "./member";

/** FLEXTV's 마이페이지 answers (server/routes/api/my, oauth of FLEXTV's web repository), in its shapes. */

const profile = (over: Record<string, unknown> = {}) => ({
  luv: 2500,
  numMsg: 0,
  profile: { id: 601900, loginId: "viewer01", nickname: "시청자", thumbUrl: "https://cdn.flextv.test/p.png", oauth: null, passwordCheck: null, PI: null, setting: { notificationView: 0 }, ...over }
});

describe("the member's account", () => {
  it("reads what 마이페이지 shows", () => {
    expect(readMyAccount(profile())).toEqual({
      nickname: "시청자",
      loginId: "viewer01",
      thumbUrl: "https://cdn.flextv.test/p.png",
      provider: null,
      hasPassword: true,
      verified: false,
      balance: 2500,
      newNotifications: false,
      unreadMessages: 0
    });
  });

  it("tells a social sign-up (no password of its own) and FLEXTV's 본인인증", () => {
    const account = readMyAccount(profile({ oauth: { provider: "kakao", uid: "1" }, passwordCheck: true, PI: { isAdult: true }, setting: { notificationView: 1 } }))!;
    expect(account).toMatchObject({ provider: "kakao", hasPassword: false, verified: true, newNotifications: true });
    expect(readMyAccount(profile({ oauth: { provider: "asp-toptoon", uid: "1" } }))!.provider).toBe("other");
  });

  it("refuses what is not a profile and keeps only https pictures and a sane balance", () => {
    expect(readMyAccount(null)).toBeNull();
    expect(readMyAccount({ luv: 1, profile: { nickname: "x" } })).toBeNull();
    expect(readMyAccount({ ...profile(), luv: -5 })!.balance).toBe(0);
    expect(readMyAccount(profile({ thumbUrl: "javascript:alert(1)" }))!.thumbUrl).toBeNull();
  });
});

describe("a profile change", () => {
  it("reads FLEXTV's reasons", () => {
    expect(mapProfileUpdate({ status: 200, data: "OK" })).toEqual({ kind: "OK" });
    expect(mapProfileUpdate({ status: 200, data: "동일한 닉네임이 존재합니다." })).toEqual({ kind: "DUPLICATE" });
    expect(mapProfileUpdate({ status: 200, data: "금지된 단어는 입력할 수 없습니다." })).toEqual({ kind: "FORBIDDEN" });
    expect(mapProfileUpdate({ status: 200, data: "잘못된 입력값입니다." })).toEqual({ kind: "INVALID" });
    expect(mapProfileUpdate({ status: 200, data: "사용할 수 없는 이모지가 포함되었습니다." })).toEqual({ kind: "INVALID" });
    expect(mapProfileUpdate({ status: 401, data: "Unauthorized" })).toEqual({ kind: "UNAUTHORIZED" });
  });

  it("does not take an unknown answer for a success", () => {
    expect(() => mapProfileUpdate({ status: 200, data: "something else" })).toThrow(FlextvUnavailableError);
    expect(() => mapProfileUpdate({ status: 500, data: null })).toThrow(FlextvUnavailableError);
  });
});

describe("a password change", () => {
  it("reads FLEXTV's status codes and its new tokens", () => {
    expect(mapPasswordUpdate({ status: 200, data: { accessToken: "a1", refreshToken: "r1" } })).toEqual({ kind: "CHANGED" });
    expect(mapPasswordUpdate({ status: 200, data: { status: 3, msg: "Unauthorized" } })).toEqual({ kind: "WRONG_CURRENT" });
    expect(mapPasswordUpdate({ status: 200, data: { status: 4, msg: "Unauthorized" } })).toEqual({ kind: "REUSED" });
    expect(mapPasswordUpdate({ status: 200, data: { status: 1, msg: "Unauthorized" } })).toEqual({ kind: "UNAUTHORIZED" });
    expect(() => mapPasswordUpdate({ status: 200, data: { error: "oauth" } })).toThrow(FlextvUnavailableError);
  });
});
