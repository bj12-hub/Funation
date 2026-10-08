import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, signIn } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

/** 매니저 채팅창 링크: a token link per manager, creator-chosen permissions, revocable, named in the 관리 기록. */
async function load() {
  const chat = await import("./unifiedChat");
  const mgr = await import("./managerChat");
  const yt = await import("@/services/creator/youtube");
  await yt.connectYouTube({ handle: "streamer", requestId: key(900) });
  await chat.connectBroadcastChannel({ platform: "SOOP", handle: "streamer" });
  await chat.simulateViewerChat({ requestId: key(901), platform: "YOUTUBE", nick: "시청자1", text: "안녕하세요" });
  await chat.simulateViewerChat({ requestId: key(902), platform: "YOUTUBE", nick: "도배맨", text: "ㅋㅋㅋㅋ" });
  return { ...chat, ...mgr };
}

const tokenOf = (path: string) => path.split("/").at(-1)!;
const suspendCreator = async () => {
  const { SAMPLE_MEMBER_ID, memberStore } = await import("@/services/admin/memberCore");
  memberStore().suspensions[SAMPLE_MEMBER_ID] = { reason: "테스트 정지", at: new Date().toISOString(), until: null, by: "adm-1" };
  return () => delete memberStore().suspensions[SAMPLE_MEMBER_ID];
};
const withdrawCreator = async () => {
  const { recordWithdrawal } = await import("@/services/account/withdrawalRecord");
  recordWithdrawal({ at: new Date().toISOString(), requestId: key(99), forfeitedFn: 0, forfeitedEarningsFn: 0 });
};

describe("매니저 채팅창 링크", () => {
  beforeEach(() => resetMockStores());

  it("creates one link per manager with validated names and permissions (default 숨김 only on the screen)", async () => {
    const m = await load();
    expect((await m.createManagerLink({ requestId: key(1), name: "", permissions: ["HIDE"] })).status).toBe("INVALID");
    expect((await m.createManagerLink({ requestId: key(2), name: "x".repeat(13), permissions: ["HIDE"] })).status).toBe("INVALID");
    expect((await m.createManagerLink({ requestId: key(3), name: "지민", permissions: ["ADMIN"] })).status).toBe("INVALID");
    expect(await m.createManagerLink({ requestId: key(4), name: "지민", permissions: ["HIDE"] })).toEqual({ status: "OK" });
    expect(await m.createManagerLink({ requestId: key(4), name: "지민", permissions: ["HIDE"] })).toEqual({ status: "OK" }); // retry → once
    expect((await m.createManagerLink({ requestId: key(5), name: "지민", permissions: [] })).status).toBe("INVALID"); // same name
    for (let i = 0; i < 4; i++) await m.createManagerLink({ requestId: key(10 + i), name: `매니저${i}`, permissions: [] });
    expect((await m.createManagerLink({ requestId: key(20), name: "여섯째", permissions: [] })).status).toBe("INVALID"); // max 5
    const links = (await m.getUnifiedChat())!.managerLinks;
    expect(links).toHaveLength(5);
    expect(links[0]).toMatchObject({ name: "지민", permissions: ["HIDE"], lastUsedAt: null });
    expect(links[0].path).toMatch(/^\/popout\/chat\/m\/[A-Za-z0-9_-]{32}$/);
    expect(new Set(links.map((l) => l.path)).size).toBe(5);
    signIn(["SUPPORTER"]);
    expect(await m.createManagerLink({ requestId: key(21), name: "남", permissions: [] })).toEqual({ status: "UNAUTHORIZED" });
  });

  it("lets a link do only what it was given, names the manager in the log, and stops when deleted", async () => {
    const m = await load();
    await m.createManagerLink({ requestId: key(1), name: "지민", permissions: ["HIDE"] });
    const link = (await m.getUnifiedChat())!.managerLinks[0];
    const token = tokenOf(link.path);

    const view = await m.getManagerChat(token);
    expect(view).toMatchObject({ name: "지민", permissions: ["HIDE"] });
    if (view === "FORBIDDEN") throw new Error("forbidden");
    expect(view.messages.map((x) => x.text)).toEqual(["안녕하세요", "ㅋㅋㅋㅋ"]);
    expect("log" in view || "managerLinks" in view).toBe(false); // no studio-only data
    expect((await m.getUnifiedChat())!.managerLinks[0].lastUsedAt).not.toBeNull();

    const spam = view.messages[1];
    expect(await m.managerHideMessage(token, { id: spam.id, hidden: true })).toEqual({ status: "OK" });
    expect(await m.managerDeleteMessage(token, { id: spam.id })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.managerBanAuthor(token, { id: spam.id, durationSec: 300 })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.managerSendChat(token, { requestId: key(30), text: "공지", platforms: ["YOUTUBE"] })).toEqual({ status: "UNAUTHORIZED" });
    expect((await m.getUnifiedChat())!.log[0]).toMatchObject({ action: "HIDE", target: "도배맨", by: "지민" });

    // The creator turns on 삭제 · 차단 and 통합 입력; the same link can now use them.
    await m.setManagerLinkPermissions({ id: link.id, permissions: ["HIDE", "MODERATE", "SEND"] });
    expect(await m.managerBanAuthor(token, { id: spam.id, durationSec: 300 })).toEqual({ status: "OK" });
    const sent = await m.managerSendChat(token, { requestId: key(31), text: "매니저 공지예요", platforms: ["YOUTUBE"] });
    expect(sent).toMatchObject({ status: "OK", results: { YOUTUBE: { status: "SENT" } } });
    expect((await m.getUnifiedChat())!.log[0]).toMatchObject({ action: "BAN", by: "지민" });

    expect(await m.deleteManagerLink({ id: link.id })).toEqual({ status: "OK" });
    expect(await m.deleteManagerLink({ id: link.id })).toEqual({ status: "OK" });
    expect(await m.getManagerChat(token)).toBe("FORBIDDEN");
    expect(await m.managerHideMessage(token, { id: spam.id, hidden: false })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.getManagerChat("not-a-token")).toBe("FORBIDDEN");
  });

  it("stops every link while the creator is suspended and after they withdraw", async () => {
    const m = await load();
    await m.createManagerLink({ requestId: key(1), name: "지민", permissions: ["HIDE", "MODERATE", "SEND"] });
    const token = tokenOf((await m.getUnifiedChat())!.managerLinks[0].path);
    expect(await m.getManagerChat(token)).not.toBe("FORBIDDEN");

    const restore = await suspendCreator();
    expect(await m.getManagerChat(token)).toBe("FORBIDDEN");
    expect(await m.managerSendChat(token, { requestId: key(30), text: "공지", platforms: ["YOUTUBE"] })).toEqual({ status: "UNAUTHORIZED" });
    expect(await m.managerHideMessage(token, { id: "x", hidden: true })).toEqual({ status: "UNAUTHORIZED" });
    restore();
    expect(await m.getManagerChat(token)).not.toBe("FORBIDDEN");

    await withdrawCreator();
    expect(await m.getManagerChat(token)).toBe("FORBIDDEN");
  });
});
