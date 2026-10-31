import { describe, expect, it } from "vitest";
import { FlextvUnavailableError } from "./client";
import { mapRegister, mapStreamAnswer, readAdult, readMyChannel, readOpenStreamPassword, readRefOptions, readStreamKeys, readStreamerStatus, readSuspension, readTags, streamBody } from "./studio";
import { flextvStudioServes, isStudioPath } from "./studioRoutes";

/** FLEXTV's broadcaster answers (server/routes/api/my, my/channel of FLEXTV's web repository), in its shapes. */

describe("who may become a streamer", () => {
  const profile = (over: Record<string, unknown>) => ({ luv: 0, profile: { memberDiv: 1, PI: { isAdult: true }, isAdultCheck: 1, isCustomForeigner: false, ...over } });

  it("follows FLEXTV's 방송하기 order: streamer, 본인인증, foreign member, age", () => {
    expect(readStreamerStatus(profile({ memberDiv: 2 }))).toEqual({ kind: "STREAMER" });
    expect(readStreamerStatus(profile({ memberDiv: 3, PI: null }))).toEqual({ kind: "STREAMER" });
    expect(readStreamerStatus(profile({ PI: null, isCustomForeigner: true }))).toEqual({ kind: "IDENTITY_REQUIRED" });
    expect(readStreamerStatus(profile({ isCustomForeigner: true }))).toEqual({ kind: "FOREIGNER" });
    expect(readStreamerStatus(profile({ isAdultCheck: 3 }))).toEqual({ kind: "ELIGIBLE" });
    expect(readStreamerStatus(profile({ isAdultCheck: 4 }))).toEqual({ kind: "UNDER_AGE" });
    expect(readStreamerStatus(profile({ isAdultCheck: null }))).toEqual({ kind: "UNDER_AGE" });
    expect(readStreamerStatus("Unauthorized")).toBeNull();
  });

  it("reads 19+ from FLEXTV's age level only", () => {
    expect(readAdult(profile({ isAdultCheck: 1 }))).toBe(true);
    expect(readAdult(profile({ isAdultCheck: 2 }))).toBe(false);
    expect(readAdult({})).toBe(false);
  });

  it("maps the registration answer", () => {
    expect(mapRegister({ status: 200, data: "waiting" })).toEqual({ kind: "REGISTERED" });
    expect(mapRegister({ status: 200, data: "ok" })).toEqual({ kind: "REGISTERED" });
    expect(mapRegister({ status: 403, data: "성인인증이 완료되지 않은 회원입니다." })).toEqual({ kind: "NOT_VERIFIED" });
    expect(mapRegister({ status: 403, data: "방송을 원하는 해외 스트리머는 1대1 문의를 주세요." })).toEqual({ kind: "FOREIGNER" });
    expect(mapRegister({ status: 403, data: "유효하지 않은 사용자 입니다." })).toEqual({ kind: "REFUSED" });
    expect(mapRegister({ status: 401, data: "Unauthorized" })).toEqual({ kind: "UNAUTHORIZED" });
    expect(() => mapRegister({ status: 500, data: "InternalError" })).toThrow(FlextvUnavailableError);
  });
});

describe("the member's channel", () => {
  const stream = { id: 991, title: "저녁 방송", themeId: 5, password: "room-secret", isForAdult: 0, visitAllow: 1, useWatermark: 1, useRecordingwarning: 0, useAdultThumbnail: 0, displayMode: "portrait", tag: [{ code: "12", des: "토크" }] };
  const channel = (over: Record<string, unknown> = {}) => ({ id: 3021, name: "방송국", isInLive: 1, stream, laststreams: { ...stream, id: 990, title: "어제 방송" }, channelStop: null, keySet: { url: "rtmp://x", streamKey: "never-read" }, ...over });

  it("reads the open stream and the last one without the room password or the key", () => {
    const mine = readMyChannel(channel())!;
    expect(mine).toMatchObject({ channelId: "3021", name: "방송국", live: true, suspension: null });
    expect(mine.stream).toEqual({ streamId: "991", title: "저녁 방송", themeId: "5", tagCodes: ["12"], forAdult: false, hasPassword: true, visitAllow: true, watermark: true, recordingWarning: false, adultThumbnail: false, displayMode: "portrait" });
    expect(mine.last?.title).toBe("어제 방송");
    const shown = JSON.stringify(mine);
    expect(shown).not.toContain("room-secret");
    expect(shown).not.toContain("never-read");
    expect(readOpenStreamPassword(channel())).toBe("room-secret");
  });

  it("has no open stream after 방송 종료, and no last one for a new streamer", () => {
    const mine = readMyChannel(channel({ stream: undefined, laststreams: undefined, isInLive: 0 }))!;
    expect(mine).toMatchObject({ live: false, stream: null, last: null });
    expect(readOpenStreamPassword(channel({ stream: undefined }))).toBe("");
    expect(readMyChannel({ name: "id 없음" })).toBeNull();
  });

  it("reads a 정지 while it applies", () => {
    const now = Date.parse("2026-10-25T12:00:00Z");
    expect(readSuspension({ status: 1, stopDate: "2026-10-20", releaseDate: "2026-11-01T00:00:00Z", suspendedDesc: "운영정책 위반" }, now)).toEqual({ permanent: false, until: "2026-11-01T00:00:00Z", reason: "운영정책 위반" });
    expect(readSuspension({ status: 2, releaseDate: null }, now)).toEqual({ permanent: true, until: null, reason: null });
    expect(readSuspension({ status: 1, releaseDate: "2026-10-01T00:00:00Z" }, now)).toBeNull();
    expect(readSuspension(null, now)).toBeNull();
  });
});

describe("form options and keys", () => {
  it("reads themes, ref codes and tags", () => {
    expect(readRefOptions([{ key: 1, value: "5", text: "토크/캠방" }, { key: 2, value: 7, text: "성인" }, { key: 3, value: "", text: "빈값" }])).toEqual([
      { value: "5", label: "토크/캠방" },
      { value: "7", label: "성인" }
    ]);
    expect(readTags([{ code: "12", des: "토크" }, { code: 13 }])).toEqual([{ value: "12", label: "토크" }]);
  });

  it("keeps the two engines FLEXTV's page offers, 짧은 지연 first", () => {
    const keys = readStreamKeys([
      { url: "rtmp://ingest.flextv.test/live", streamKey: "k-ncp", engine: "ncp" },
      { url: "rtmp://llh.flextv.test/live", streamKey: "k-llh", engine: "ncp_llh", used: true },
      { url: "rtmp://aws.flextv.test/live", streamKey: "k-aws", engine: "aws" },
      { url: "javascript:alert(1)", streamKey: "k-bad", engine: "ncp" }
    ]);
    expect(keys.map((k) => [k.engine, k.serverUrl])).toEqual([
      ["ncp_llh", "rtmp://llh.flextv.test/live"],
      ["ncp", "rtmp://ingest.flextv.test/live"]
    ]);
  });
});

describe("starting, changing and ending", () => {
  const form = { title: "제목", themeId: "5", tagCodes: ["12"], forAdult: false, password: "", visitAllow: true, watermark: false, recordingWarning: true, adultThumbnail: true, displayMode: "landscape" as const, resolution: "1080" as const };

  it("sends the fields of FLEXTV's own PC form only", () => {
    const body = streamBody(form, "ncp_llh");
    expect(body).toMatchObject({ title: "제목", theme: "5", tag: ["12"], minRatingLevel: 0, isForAdult: false, visitAllow: true, isRecordingwarning: true, engine: "ncp_llh", resolution: "1080" });
    // The adult thumbnail only goes with 연령제한.
    expect(body.isAdultThumbnail).toBe(0);
    expect(body).not.toHaveProperty("force");
    expect(body).not.toHaveProperty("activeItem");
    expect(streamBody({ ...form, forAdult: true }, "ncp").isAdultThumbnail).toBe(1);
  });

  it("maps FLEXTV's answers", () => {
    expect(mapStreamAnswer({ status: 200, data: "OK" })).toEqual({ kind: "OK" });
    expect(mapStreamAnswer({ status: 400, data: "현재 채널로 영상이 송출되고 있지 않습니다." })).toEqual({ kind: "NO_SIGNAL" });
    expect(mapStreamAnswer({ status: 400, data: "현재 방송중인 방송이 없습니다." })).toEqual({ kind: "NOT_LIVE" });
    expect(mapStreamAnswer({ status: 400, data: "중지된 방송입니다." })).toEqual({ kind: "SUSPENDED" });
    expect(mapStreamAnswer({ status: 400, data: "방송 승인이 되지 않은 사용자 입니다." })).toEqual({ kind: "NOT_ALLOWED" });
    expect(mapStreamAnswer({ status: 400, data: "방송 태그 개수는 최대 3개 입니다." })).toEqual({ kind: "REFUSED", message: "방송 태그 개수는 최대 3개 입니다." });
    expect(mapStreamAnswer({ status: 400, data: "" })).toEqual({ kind: "REFUSED", message: null });
    expect(mapStreamAnswer({ status: 400, data: "Error: ER_PARSE at line 1" })).toEqual({ kind: "REFUSED", message: null });
    expect(mapStreamAnswer({ status: 401, data: null })).toEqual({ kind: "UNAUTHORIZED" });
    expect(() => mapStreamAnswer({ status: 500, data: "InternalError" })).toThrow(FlextvUnavailableError);
  });
});

describe("studio pages served with FLEXTV", () => {
  it("serves only the connected pages", () => {
    for (const path of ["/creator", "/creator/", "/creator/broadcast", "/creator/settings", "/creator/widgets", "/creator/revenue", "/creator/donations", "/creator/settlement", "/creator/settlement/apply", "/creator/settlement/manage", "/creator/settlement/register"]) {
      expect(flextvStudioServes(path)).toBe(true);
    }
    for (const path of ["/creator/widgets/overlays", "/creator/settlement/register/form", "/creator/crew/broadcast", "/creator/youtube"]) expect(flextvStudioServes(path)).toBe(false);
    expect(isStudioPath("/creator")).toBe(true);
    expect(isStudioPath("/creators/3021")).toBe(false);
  });
});
