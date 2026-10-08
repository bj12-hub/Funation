import { describe, expect, it } from "vitest";
import { getMockDonationCatalog, type DonationCatalog } from "@/services/donations/donationCatalog";
import { AMOUNT_INPUT_MAX, addAmount, buildDraft, initialStates, isFormKey, parseClock, timeToSec, type FormStates } from "./drafts";

/**
 * The donation panel's form → request step. The server validates everything again; these checks are what the
 * supporter sees before paying (inline errors, a disabled button while incomplete, the confirm rows).
 */
const offer = (id: string, over: Partial<DonationCatalog["gacha"][number]> = {}): DonationCatalog["gacha"][number] => ({
  id,
  name: `뽑기 ${id}`,
  price: 3_000,
  mode: "PROBABILITY",
  prizes: [],
  limit: null,
  soldOut: false,
  ...over
});
const catalog: DonationCatalog = { ...getMockDonationCatalog(), gacha: [offer("g-out", { soldOut: true }), offer("g-1")] };
const states = (patch: Partial<{ [K in keyof FormStates]: Partial<FormStates[K]> }> = {}): FormStates => {
  const s = initialStates(catalog);
  for (const k of Object.keys(patch) as (keyof FormStates)[]) Object.assign(s[k], patch[k]);
  return s;
};

describe("후원 폼 → 요청", () => {
  it("starts each form from the design defaults", () => {
    const s = initialStates(catalog);
    expect(s.ROULETTE.amount).toBe(String(catalog.roulette.minAmount));
    expect(s.QUEST.time).toEqual({ minutes: "10", seconds: "00" });
    expect(s.GACHA.gachaId).toBe("g-1"); // the first 뽑기 that is not sold out
    expect(s.TEXT.voiceId).toBe(catalog.voices[0].id);
  });

  it("parses clock and time-limit inputs", () => {
    expect(parseClock("01:30")).toBe(90);
    expect(parseClock(" 0:05 ")).toBe(5);
    for (const bad of ["1:60", "100:00", "1:5", "", "ab:cd"]) expect(parseClock(bad)).toBeNull();
    expect(timeToSec({ minutes: "2", seconds: "05" })).toBe(125);
    expect(timeToSec({ minutes: "", seconds: "30" })).toBe(30);
    for (const bad of [{ minutes: "0", seconds: "0" }, { minutes: "1", seconds: "60" }, { minutes: "-1", seconds: "0" }, { minutes: "1.5", seconds: "0" }]) {
      expect(timeToSec(bad)).toBeNull();
    }
  });

  it("일반 후원: below the minimum shows an error and sends nothing", () => {
    const low = buildDraft("TEXT", states({ TEXT: { amount: "999", message: " 화이팅 " } }), catalog);
    expect(low.details).toBeNull();
    expect(low.error).toContain("1,000 FN");
    const ok = buildDraft("TEXT", states({ TEXT: { amount: "1000", message: " 화이팅 " } }), catalog);
    expect(ok).toMatchObject({ details: { type: "TEXT", amount: 1_000, message: "화이팅" }, error: null, chatText: "화이팅" });
    expect(buildDraft("TEXT", states(), catalog)).toMatchObject({ details: null, error: null }); // nothing typed yet
  });

  it("미니 후원 needs text as well as the amount", () => {
    expect(buildDraft("MINI", states({ MINI: { amount: "100", text: "  " } }), catalog).details).toBeNull();
    expect(buildDraft("MINI", states({ MINI: { amount: "100", text: "안녕" } }), catalog).details).toMatchObject({ type: "MINI", text: "안녕" });
  });

  it("영상 후원 checks the address, the range and the terms", () => {
    const base = { amount: "1000", url: "https://youtu.be/dQw4w9WgXcQ", start: "00:10", end: "00:40", terms: true };
    expect(buildDraft("VIDEO", states({ VIDEO: base }), catalog).details).toMatchObject({ type: "VIDEO", startSec: 10, endSec: 40, termsAgreed: true });
    expect(buildDraft("VIDEO", states({ VIDEO: { ...base, url: "https://example.com/v" } }), catalog).error).toBe("YouTube 영상 주소를 입력해 주세요.");
    expect(buildDraft("VIDEO", states({ VIDEO: { ...base, end: "00:10" } }), catalog).error).toBe("종료 시간은 시작 시간보다 늦어야 해요.");
    expect(buildDraft("VIDEO", states({ VIDEO: { ...base, terms: false } }), catalog)).toMatchObject({ details: null, error: null });
  });

  it("시그니처 · 위시 prices come from the catalog, not the form", () => {
    const sig = catalog.signatures[0];
    expect(buildDraft("SIGNATURE", states({ SIGNATURE: { signatureId: sig.id } }), catalog)).toMatchObject({ amount: sig.price, details: { signatureId: sig.id, expectedAmount: sig.price } });
    expect(buildDraft("SIGNATURE", states({ SIGNATURE: { signatureId: "nope" } }), catalog).details).toBeNull();
    const out = { ...catalog, wishlist: [{ ...catalog.wishlist[0], inStock: false }] };
    const wish = buildDraft("WISHLIST", states({ WISHLIST: { itemId: out.wishlist[0].id } }), out);
    expect(wish).toMatchObject({ details: null, error: "선택한 상품은 지금 후원할 수 없어요." });
  });

  it("룰렛: off, used up or below the minimum cannot be sent", () => {
    const min = catalog.roulette.minAmount;
    expect(buildDraft("ROULETTE", states({ ROULETTE: { amount: String(min) } }), catalog).details).toEqual({ type: "ROULETTE", amount: min });
    expect(buildDraft("ROULETTE", states({ ROULETTE: { amount: String(min - 1) } }), catalog).details).toBeNull();
    expect(buildDraft("ROULETTE", states({ ROULETTE: { limitReached: true } }), catalog).error).toBe("오늘 참여 가능 횟수를 모두 사용했어요.");
    const off = buildDraft("ROULETTE", states(), { ...catalog, roulette: { ...catalog.roulette, enabled: false } });
    expect(off).toMatchObject({ details: null, error: null, buttonLabel: "룰렛이 꺼져 있어요" });
  });

  it("뽑기: sold out or over the daily limit cannot be sent; the price is the offer's", () => {
    expect(buildDraft("GACHA", states({ GACHA: { gachaId: "g-1", terms: true } }), catalog)).toMatchObject({ amount: 3_000, details: { type: "GACHA", gachaId: "g-1", expectedAmount: 3_000 } });
    expect(buildDraft("GACHA", states({ GACHA: { gachaId: "g-out", terms: true } }), catalog).error).toBe("상품이 모두 소진됐어요.");
    expect(buildDraft("GACHA", states({ GACHA: { gachaId: "g-1", terms: true, limitReached: true } }), catalog).details).toBeNull();
    expect(buildDraft("GACHA", states({ GACHA: { gachaId: "g-1", terms: false } }), catalog).details).toBeNull();
  });

  it("퀘스트: reward minimum, time limit and terms", () => {
    const base = { title: "노래 한 곡", success: "1000", time: { minutes: "10", seconds: "00" }, terms: true };
    expect(buildDraft("QUEST", states({ QUEST: base }), catalog).details).toMatchObject({ type: "QUEST", successReward: 1_000, timeLimitSec: 600, termsAgreed: true });
    expect(buildDraft("QUEST", states({ QUEST: { ...base, success: "999" } }), catalog).error).toContain("1,000 FN 이상");
    expect(buildDraft("QUEST", states({ QUEST: { ...base, time: { minutes: "61", seconds: "00" } } }), catalog).error).toBe("제한 시간을 확인해 주세요.");
    expect(buildDraft("QUEST", states({ QUEST: { ...base, title: "  " } }), catalog).details).toBeNull();
  });

  it("그림 후원 needs a title, a drawing and the terms", () => {
    const base = { amount: "1000", title: "고양이", image: "data:image/png;base64,AAAA", terms: true };
    expect(buildDraft("DRAWING", states({ DRAWING: base }), catalog).details).toMatchObject({ type: "DRAWING", title: "고양이" });
    expect(buildDraft("DRAWING", states({ DRAWING: { ...base, image: null } }), catalog).details).toBeNull();
    expect(buildDraft("DRAWING", states({ DRAWING: { ...base, amount: "500" } }), catalog).error).toContain("1,000 FN");
  });

  it("빠른 금액 추가 adds to the typed amount and stays within the input", () => {
    expect(addAmount("", 1_000)).toBe("1000");
    expect(addAmount("2500", 10_000)).toBe("12500");
    expect(addAmount("999999000", 5_000)).toBe(String(AMOUNT_INPUT_MAX));
  });

  it("knows which donation types have a form", () => {
    expect(isFormKey("TEXT")).toBe(true);
    expect(isFormKey("GACHA")).toBe(true);
  });
});
