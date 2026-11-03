import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import { isFlextvChannelId, mapSend, readActiveStream, readChannel, readSignatures, readVideoSetting } from "./donation";

/** FLEXTV's channel and donation answers (server/routes/api/channel*, luv of FLEXTV's web repository), in its shapes. */

describe("the channel", () => {
  const profile = {
    id: 3021,
    name: "플렉스방송국",
    description: "매일 저녁 9시",
    backgroundImgUrl: "https://static.flextv.test/bg.jpg",
    isInLive: true,
    stat: { numberOfViews: 900, numberOfSubs: 120 },
    owner: { id: 601924, loginId: "bj01", nickname: "방송인", thumbUrl: "https://static.flextv.test/p.png", PI: "Y" }
  };

  it("reads the owner who receives, and whether they can (FLEXTV's 본인인증)", () => {
    expect(readChannel(profile)).toEqual({
      channelId: "3021",
      name: "플렉스방송국",
      description: "매일 저녁 9시",
      backgroundUrl: "https://static.flextv.test/bg.jpg",
      live: true,
      followers: 120,
      owner: { memberId: 601924, loginId: "bj01", nickname: "방송인", thumbUrl: "https://static.flextv.test/p.png", verified: true }
    });
    expect(readChannel({ ...profile, owner: { ...profile.owner, PI: null, thumbUrl: "http://plain.test/p.png" } })?.owner).toMatchObject({ verified: false, thumbUrl: null });
    expect(readChannel({ id: 1 })).toBeNull();
  });

  it("reads the stream on air, none when FLEXTV answers 204", () => {
    expect(readActiveStream({ status: 200, data: { id: 77, title: "저녁 방송", channelId: 3021 } })).toEqual({ streamId: "77", title: "저녁 방송" });
    expect(readActiveStream({ status: 204, data: null })).toBeNull();
  });

  it("takes only FLEXTV channel ids for a FLEXTV room", () => {
    expect(isFlextvChannelId("3021")).toBe(true);
    for (const id of ["c1", "0", "01", "3021/", "-1", "1".repeat(19)]) expect(isFlextvChannelId(id), id).toBe(false);
  });
});

describe("signatures", () => {
  it("offers the channel's own signature images with their amounts, nothing else", () => {
    const giftTypes = {
      img: {
        common: [{ code: "c-100", amount: 100, imgUrl: "https://static.flextv.test/c.png" }],
        host: [
          { id: 1, code: "sig-1000", name: "하트 뿅", amount: 1000, imgUrl: "https://static.flextv.test/s1.png", type: 3 },
          { id: 2, code: "", name: "bad", amount: 10, imgUrl: "https://static.flextv.test/s2.png" },
          { id: 3, code: "sig-x", name: "no image", amount: 10, imgUrl: null }
        ]
      },
      txt: []
    };
    expect(readSignatures(giftTypes)).toEqual([{ code: "sig-1000", name: "하트 뿅", amount: 1000, imageUrl: "https://static.flextv.test/s1.png" }]);
    expect(readSignatures(null)).toEqual([]);
  });
});

describe("sending", () => {
  it("is sent on FLEXTV's 200", () => {
    expect(mapSend({ status: 200, data: "OK" })).toEqual({ kind: "SENT" });
  });

  it("maps FLEXTV's refusals, which come before any debit", () => {
    const refused = (message: string) => mapSend({ status: 400, data: { message } }).kind;
    expect(refused("선물할 수 없는 금액입니다.")).toBe("INSUFFICIENT");
    expect(refused("본인인증 해주세요")).toBe("IDENTITY_REQUIRED");
    expect(refused("선물할 수 없는 계정입니다")).toBe("NOT_ALLOWED");
    expect(refused("차단된 계정입니다")).toBe("BLOCKED");
    expect(refused("재인증이 필요한 회원입니다.")).toBe("REAUTH_REQUIRED");
    expect(refused("잘못된 입력값입니다")).toBe("RECIPIENT_UNAVAILABLE");
    expect(mapSend({ status: 400, data: { message: "지갑 조회 실패" } })).toEqual({ kind: "REFUSED", message: "지갑 조회 실패" });
  });

  it("treats anything else as unknown: FLEXTV may have debited already", () => {
    expect(() => mapSend({ status: 500, data: "InternalError" })).toThrow(FlextvUnavailableError);
    expect(() => mapSend({ status: 502, data: null })).toThrow(FlextvUnavailableError);
  });
});

describe("영상 후원 setting (phase 6)", () => {
  it("reads the streamer's YouTube preset only", () => {
    const presets = [
      { type: "sound", enabled: true, maxLength: 30, minAmount: 100, unitAmount: 10 },
      { type: "youtube", enabled: true, maxLength: 120, minAmount: 300, unitAmount: 20, filterLevel: 1 }
    ];
    expect(readVideoSetting(presets)).toEqual({ enabled: true, perSecond: 20, minAmount: 300, maxSec: 120 });
    expect(readVideoSetting([{ ...presets[1], enabled: false }])).toMatchObject({ enabled: false });
    expect(readVideoSetting([presets[0]])).toBeNull();
    expect(readVideoSetting([{ type: "youtube", enabled: true, maxLength: 0, minAmount: 300, unitAmount: 20 }])).toBeNull();
    expect(readVideoSetting(null)).toBeNull();
  });
});
