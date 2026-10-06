import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());

const DEFAULT_TEXT = "(금지어가 포함된 메시지예요)";

/** 대체 메시지 표시 설정 (539:7) and 후원 필터링 (539:466) on stream — 2026-10-06 결정. */
async function load() {
  const core = await import("./donationPageCore");
  const actions = await import("./donationManagement");
  const { mockAlerts } = await import("./alertCore");
  const { mockAccount } = await import("@/services/account/mockStore");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const { requestDonation } = await import("@/services/donations/donate");
  // The session's donations go to the studio channel, the one whose overlay gets alerts in the mock.
  const creators = await import("@/services/creators/creators");
  const c1 = (await creators.getCreatorById("c1"))!;
  vi.spyOn(creators, "getCreatorById").mockResolvedValue({ ...c1, id: "studio" });
  mockAccount.fnBalance = 50_000;
  let n = 0;
  const send = (message: string) =>
    requestDonation({ creatorId: "studio", hideProfile: false, type: "TEXT", amount: 1_000, message, voiceId: null, idempotencyKey: key(++n) });
  // Only the 후원 필터링 settings under test: no 금지어 and every filter off.
  core.donationPageStore.replacement = { applyToNickname: false, applyToText: true, bannedWords: [], message: "응원 고마워요" };
  Object.assign(core.donationFilterStore, { strength: "OFF", blockSpam: false, words: [] });
  return { ...core, ...actions, send, last: () => mockAlerts.items.at(-1)!, wallet: mockWallet, account: mockAccount };
}

describe("방송에 보이는 후원 (shownOnStream)", () => {
  beforeEach(() => resetMockStores());

  it("shows the default text and 익명 when the 대체 메시지 is empty", async () => {
    const { shownOnStream, donationPageStore } = await load();
    const { DEFAULT_REPLACEMENT_MESSAGE } = await import("./donationManagementTypes");
    expect(DEFAULT_REPLACEMENT_MESSAGE).toBe(DEFAULT_TEXT);
    donationPageStore.replacement = { applyToNickname: true, applyToText: true, bannedWords: ["길동"], message: "" };
    expect(shownOnStream({ donor: "홍길동", message: "길동이 왔어요" })).toEqual({ donor: "익명", message: DEFAULT_TEXT });
    // Without a 금지어 nothing changes; a set 대체 메시지 still wins over the default.
    expect(shownOnStream({ donor: "철수", message: "화이팅" })).toEqual({ donor: "철수", message: "화이팅" });
    donationPageStore.replacement.message = "응원 고마워요";
    expect(shownOnStream({ donor: "홍길동", message: "길동이 왔어요" })).toEqual({ donor: "응원 고마워요", message: "응원 고마워요" });
  });

  it("replaces a custom blacklist word on stream (case-insensitive) and keeps the record and the payment", async () => {
    const { send, last, wallet, account, addFilterWord, shownOnStream } = await load();
    expect(await addFilterWord("SPAM")).toEqual({ status: "SAVED" }); // the action writes what the core reads
    expect((await send("spam 아니에요 진짜 후원")).status).toBe("COMPLETED");
    expect(last()).toMatchObject({ donor: "홍길동", message: "응원 고마워요" }); // the alert and its TTS
    expect(wallet.donations[0].message).toBe("spam 아니에요 진짜 후원");
    expect(account.fnBalance).toBe(49_000);
    // The message only: a name with the word stays as it is.
    expect(shownOnStream({ donor: "spam왕", message: "안녕" })).toEqual({ donor: "spam왕", message: "안녕" });
  });

  it("replaces 특수 문자/도배 on stream when the switch is on", async () => {
    const { send, last, wallet, setSpamBlock } = await load();
    expect(await setSpamBlock(true)).toEqual({ status: "SAVED" });
    await send("ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ");
    expect(last().message).toBe("응원 고마워요");
    expect(wallet.donations[0].message).toBe("ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ");
    await send("오늘 방송 재밌어요 ㅋㅋㅋ!!");
    expect(last().message).toBe("오늘 방송 재밌어요 ㅋㅋㅋ!!");
  });

  it("detects 특수 문자/도배 narrowly", async () => {
    const { isSpamMessage } = await load();
    for (const text of ["ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ", "축하해요!!!!!!!!!!", "사랑해사랑해사랑해사랑해사랑해", "ㅎㅇ ㅎㅇ ㅎㅇ ㅎㅇ ㅎㅇ ", "★☆♡◆▶◀♣♤♧※", "🎉🎉🎉🎉🎉🎉🎉🎉🎉🎉"]) {
      expect(isSpamMessage(text), text).toBe(true);
    }
    for (const text of ["ㅋㅋㅋㅋㅋㅋㅋㅋㅋ", "축하해요!!!", "사랑해사랑해사랑해사랑해", "오늘도 화이팅 🎉🎉🎉", "10,000,000 FN 갑니다", "영상 youtu.be/dQw4w9WgXcQ", "", "          "]) {
      expect(isSpamMessage(text), text).toBe(false);
    }
  });

  it("checks the platform forbidden words by 비속어 필터 강도 (OFF · 보통 · 매우 높음)", async () => {
    const { send, last, wallet, setFilterStrength, shownOnStream, hasProfanity } = await load();
    // The Donation Core refuses these words as written before any debit, so 보통 is checked on shownOnStream directly.
    expect(await setFilterStrength("NORMAL")).toEqual({ status: "SAVED" });
    expect(shownOnStream({ donor: "철수", message: "나는 ADMIN" }).message).toBe("응원 고마워요");
    await send("운 영 자 님 보세요");
    expect(last().message).toBe("운 영 자 님 보세요");
    // 매우 높음: also when spaces or symbols split the word.
    await setFilterStrength("HIGH");
    await send("운 영 자 님 보세요");
    expect(last().message).toBe("응원 고마워요");
    expect(wallet.donations[0].message).toBe("운 영 자 님 보세요");
    expect(hasProfanity("a.d.m.i.n", "HIGH")).toBe(true);
    expect(hasProfanity("a.d.m.i.n", "NORMAL")).toBe(false);
    expect(hasProfanity("나는 admin", "OFF")).toBe(false);
  });

  it("applies the filter whatever the 텍스트 내용 switch says, and uses the default text when the 대체 메시지 is empty", async () => {
    const { send, last, donationPageStore, donationFilterStore } = await load();
    donationPageStore.replacement = { applyToNickname: false, applyToText: false, bannedWords: [], message: "" };
    donationFilterStore.words = ["어그로"];
    await send("어그로 아님");
    expect(last()).toMatchObject({ donor: "홍길동", message: DEFAULT_TEXT });
  });

  it("changes nothing while every filter is off", async () => {
    const { send, last, shownOnStream } = await load();
    for (const message of ["ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ", "운 영 자", "광고 아니에요"]) {
      await send(message);
      expect(last().message).toBe(message);
    }
    expect(shownOnStream({ donor: "철수", message: "나는 admin" })).toEqual({ donor: "철수", message: "나는 admin" });
  });
});
