import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, resetMockStores, settleSampleCharges, settleSamplePlatformDonations, signIn, signInAs } from "@/test/mockEnv";

vi.mock("@/lib/mock", () => ({ USE_MOCK: true, mockDelay: () => Promise.resolve() }));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

/**
 * 탈퇴 회원 정보 보관 (2026-10-08: 기본값 — 일반적인 기준, 법무 검토 전). One list of periods; each category of a
 * withdrawn account's data stays until its date and is removed or anonymised from then on; posts stay up under
 * "탈퇴한 회원"; the person key lets the same phone be the same person for a year after the withdrawal, not after.
 */

const WITHDRAWN_AT = "2026-10-08T03:00:00.000Z";
const PASSWORD = "password"; // the mock account's initial password
const WITHDRAWN = "탈퇴한 회원";
const ms = (iso: string) => new Date(iso).getTime();

async function load() {
  const policy = await import("./retentionPolicy");
  const purge = await import("./retentionPurge");
  const core = await import("./withdrawalCore");
  const store = await import("./mockStore");
  const { withdrawAccount } = await import("./withdrawal");
  const { startNewAccount } = await import("./rejoin");
  const { login } = await import("@/services/auth/login");
  const { accessLogOf } = await import("@/services/auth/loginLockCore");
  const members = await import("@/services/admin/members");
  const { getPaymentsView, getDonationsView } = await import("@/services/admin/payments");
  const { getSettlementReview } = await import("@/services/admin/settlements");
  const { listReports } = await import("@/services/admin/reports");
  const { SAMPLE_MEMBER_ID } = await import("@/services/admin/memberCore");
  const community = await import("@/services/community/community");
  const { mockCommunity } = await import("@/services/community/mockCommunityStore");
  const { createChannelPost, getChannelPosts } = await import("@/services/creators/channelHome");
  const { channelCommunityStore } = await import("@/services/creators/channelCommunityCore");
  const { submitReport } = await import("@/services/moderation/moderation");
  const { moderationStore } = await import("@/services/moderation/moderationCore");
  const { submitInquiry } = await import("@/services/support/inquiry");
  const { inquiryStore } = await import("@/services/support/inquiryCore");
  const { getEvent } = await import("@/services/events/events");
  const { mockWallet } = await import("@/services/wallet/mockWalletStore");
  const { mockSettlement } = await import("@/services/creator/mockSettlementStore");
  return {
    ...policy,
    ...purge,
    ...core,
    ...members,
    account: store.mockAccount,
    credentials: store.mockCredentials,
    currentPersonKey: store.currentPersonKey,
    withdrawAccount,
    startNewAccount,
    login,
    accessLogOf,
    getPaymentsView,
    getDonationsView,
    getSettlementReview,
    listReports,
    SAMPLE_MEMBER_ID,
    ...community,
    mockCommunity,
    createChannelPost,
    getChannelPosts,
    channelCommunityStore,
    submitReport,
    moderationStore,
    submitInquiry,
    inquiryStore,
    getEvent,
    mockWallet,
    mockSettlement
  };
}
type M = Awaited<ReturnType<typeof load>>;

/** The sample supporter withdraws at the current (fake) time with the right consents and password. */
async function withdraw(m: M, n = 1, password = PASSWORD) {
  await settleSamplePlatformDonations(); // withdrawal waits while a 플랫폼 후원 is PENDING (2026-10-09 결정)
  await settleSampleCharges(); // and while a charge is in progress (2026-10-10 결정)
  const r = await m.withdrawAccount({ requestId: key(900 + n), confirmed: true, forfeitAgreed: true, fnBalance: m.account.fnBalance, unsettledFn: 0, password });
  expect(r).toEqual({ status: "WITHDRAWN" });
}

const signUp = (m: M, phone: string) => expect(m.startNewAccount({ nickname: "다시왔어요", password: "newpass12!", marketing: false, phone })).toBe(true);

describe("retention schedule", () => {
  it("lists every category once with its period, basis and what it covers, labelled as defaults", async () => {
    const m = await load();
    expect(m.RETENTION_DEFAULTS_LABEL).toBe("기본값 (일반적인 기준, 법무 검토 전)");
    expect(m.RETENTION_RULES.map((r) => [r.category, r.label, r.period, r.basis, r.months])).toEqual([
      ["CONTRACT", "계약 · 청약철회 기록", "5년", "전자상거래법", 60],
      ["PAYMENT", "대금결제 · 재화 공급 기록", "5년", "전자상거래법", 60],
      ["DISPUTE", "소비자 불만 · 분쟁 처리 기록", "3년", "전자상거래법", 36],
      ["ACCESS_LOG", "접속 기록", "3개월", "통신비밀보호법", 3],
      ["PERSON_KEY", "부정 이용 방지용 본인 확인 값", "탈퇴 후 1년", "서비스 운영 (부정 이용 방지)", 12],
      ["POSTS", "게시물 (커뮤니티 글 · 댓글 · 채널 글)", "삭제하지 않음", "서비스 운영", null]
    ]);
    expect(m.retentionRule("PAYMENT").covers).toBe("FN 충전 · 환불 · 후원 · 정산 기록");
    expect(Object.isFrozen(m.RETENTION_RULES) && m.RETENTION_RULES.every((r) => Object.isFrozen(r))).toBe(true);
  });

  it("counts from the withdrawal in Korean calendar months, clamped at a month's end", async () => {
    const m = await load();
    expect(m.retentionSchedule(WITHDRAWN_AT)).toEqual([
      { category: "CONTRACT", until: "2031-10-08T03:00:00.000Z" },
      { category: "PAYMENT", until: "2031-10-08T03:00:00.000Z" },
      { category: "DISPUTE", until: "2029-10-08T03:00:00.000Z" },
      { category: "ACCESS_LOG", until: "2027-01-08T03:00:00.000Z" },
      { category: "PERSON_KEY", until: "2027-10-08T03:00:00.000Z" },
      { category: "POSTS", until: null }
    ]);
    // 2026-11-30 KST + 3개월 → 2027-02-28 KST; 2028-02-29 KST + 1년 → 2029-02-28 KST.
    expect(m.retentionUntil("2026-11-30T01:00:00.000Z", "ACCESS_LOG")).toBe("2027-02-28T01:00:00.000Z");
    expect(m.retentionUntil("2028-02-29T01:00:00.000Z", "PERSON_KEY")).toBe("2029-02-28T01:00:00.000Z");
    // 01:00 on 1월 31일 in Korea is still 1월 30일 in UTC: the Korean date decides (4월 30일 KST, not UTC).
    expect(m.retentionUntil("2027-01-30T16:00:00.000Z", "ACCESS_LOG")).toBe("2027-04-29T16:00:00.000Z");
    expect(() => m.retentionSchedule("not a date")).toThrow(RangeError);
    // Due from the date on, never for posts.
    expect(m.isRetentionExpired("2027-01-08T03:00:00.000Z", new Date(ms("2027-01-08T03:00:00.000Z") - 1))).toBe(false);
    expect(m.isRetentionExpired("2027-01-08T03:00:00.000Z", new Date("2027-01-08T03:00:00.000Z"))).toBe(true);
    expect(m.isRetentionExpired(null, new Date("2999-01-01T00:00:00.000Z"))).toBe(false);
  });
});

describe("탈퇴 회원 정보 보관", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["SUPPORTER"]);
    vi.useFakeTimers({ toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("keeps the consents and the 본인 확인 값 in the withdrawal record and destroys the personal data no rule keeps", async () => {
    vi.setSystemTime(new Date(WITHDRAWN_AT));
    const m = await load();
    m.mockWallet.chargeTermsAgreedAt = "2026-09-01T00:00:00.000Z";
    m.mockSettlement.terms = { memberType: "INDIVIDUAL", acceptedAt: "2026-09-02" };
    Object.assign(m.account, { marketingConsent: true, identity: { name: "홍길동", birthDate: "1995-01-01", verifiedAt: WITHDRAWN_AT } });
    m.mockWallet.marketingOptIn = true;
    const person = m.currentPersonKey();
    await withdraw(m);

    const record = m.withdrawalOf()!;
    expect(record).toMatchObject({ at: WITHDRAWN_AT, nickname: "홍길동", consents: { chargeTerms: "2026-09-01T00:00:00.000Z", settlementTerms: "2026-09-02" }, purged: [] });
    // The phone is gone from the account; the record keeps the person key and a keyed hash, never the number.
    expect(record.person).toMatchObject({ key: person });
    expect(record.person!.phoneHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(record)).not.toMatch(/010-?1234-?5678/);
    expect(m.credentials).toMatchObject({ phone: "", personKey: "" });
    expect(m.account).toMatchObject({ avatarUrl: null, identity: null, marketingConsent: false });
    expect(m.mockWallet.marketingOptIn).toBe(false);
  });

  it("purges each category at its date and not a moment before, lazily when the console reads", async () => {
    vi.setSystemTime(new Date(WITHDRAWN_AT));
    const m = await load();
    signInAs(m.SAMPLE_MEMBER_ID); // the slot's member id, as lib/session gives it
    // 접속 기록: a wrong password and a login.
    expect(await m.login({ identifier: "hongGD123", password: "wrong-pass1", keepSignedIn: false })).toEqual({ status: "WRONG_PASSWORD" });
    expect(await m.login({ identifier: "hongGD123", password: PASSWORD, keepSignedIn: false })).toEqual({ status: "SUCCESS" });
    expect(m.accessLogOf(m.SAMPLE_MEMBER_ID).map((e) => e.event)).toEqual(["FAILURE", "LOGIN"]);
    // 분쟁 처리 기록: a 1:1 문의 and a report the member filed.
    expect(await m.submitInquiry({ requestId: key(1), category: "ACCOUNT", title: "문의", body: "탈퇴 전에 남긴 문의입니다." })).toMatchObject({ status: "SUBMITTED" });
    expect(await m.submitReport({ target: { type: "POST", id: "p-1" }, reason: "ETC", detail: "회원이 쓴 신고 내용" })).toEqual({ status: "REPORTED" });
    const filed = () => m.moderationStore().reports.find((r) => r.reporterId === m.SAMPLE_MEMBER_ID)!;
    await withdraw(m);
    const record = m.withdrawalOf()!;
    const due = Object.fromEntries(m.retentionSchedule(record.at).map((d) => [d.category, d.until])) as Record<string, string>;
    const at = async (iso: string, offset = 0) => {
      vi.setSystemTime(new Date(ms(iso) + offset));
      return (await m.getMemberDetail(m.SAMPLE_MEMBER_ID))?.member ?? null;
    };
    const ownCharges = async () => (await m.getPaymentsView())!.charges.filter((c) => c.memberId === m.SAMPLE_MEMBER_ID).length;

    // 접속 기록 — 3개월.
    await at(due.ACCESS_LOG, -1);
    expect(m.accessLogOf(m.SAMPLE_MEMBER_ID)).toHaveLength(2);
    expect(record.purged).toEqual([]);
    await at(due.ACCESS_LOG);
    expect(m.accessLogOf(m.SAMPLE_MEMBER_ID)).toEqual([]);
    expect(record.purged).toEqual(["ACCESS_LOG"]);

    // 본인 확인 값 — 탈퇴 후 1년.
    await at(due.PERSON_KEY, -1);
    expect(record.person).not.toBeNull();
    await at(due.PERSON_KEY);
    expect(record.person).toBeNull();

    // 분쟁 처리 기록 — 3년: the inquiry goes, the report stays without the reporter's name and words.
    await at(due.DISPUTE, -1);
    expect(m.inquiryStore().byUser[m.SAMPLE_MEMBER_ID]).toHaveLength(1);
    expect(filed()).toMatchObject({ reporterName: "홍길동", detail: "회원이 쓴 신고 내용" });
    await at(due.DISPUTE);
    expect(m.inquiryStore().byUser[m.SAMPLE_MEMBER_ID]).toBeUndefined();
    expect(Object.keys(m.inquiryStore().requests)).toEqual([]);
    expect(filed()).toMatchObject({ reporterName: WITHDRAWN, detail: "", status: "OPEN" });
    expect(Object.keys(m.moderationStore().requests)).toEqual([]);

    // 계약 · 대금결제 기록 — 5년: the console still lists the account and its records the moment before.
    const before = (await at(due.CONTRACT, -1))!;
    expect(before).toMatchObject({ status: "WITHDRAWN", nickname: "홍길동" });
    expect(await ownCharges()).toBeGreaterThan(0);
    expect((await m.getDonationsView())!.rows.length).toBeGreaterThan(0);
    expect((await m.getSettlementReview())!.rows.length).toBeGreaterThan(0);
    expect(record.purged).toEqual(["ACCESS_LOG", "PERSON_KEY", "DISPUTE"]);

    expect(await at(due.CONTRACT)).toBeNull();
    expect((await m.listMembers({ status: "WITHDRAWN" }))!.items).toEqual([]);
    expect(await ownCharges()).toBe(0);
    expect((await m.getDonationsView())!.rows).toEqual([]);
    expect((await m.getSettlementReview())!.rows).toEqual([]);
    expect(record).toMatchObject({ nickname: WITHDRAWN, ssumnationId: "", requestId: "", forfeitedFn: 0, consents: null, purged: ["ACCESS_LOG", "PERSON_KEY", "DISPUTE", "CONTRACT", "PAYMENT"] });

    // Each category goes once: a later run changes nothing.
    const snapshot = JSON.stringify(record);
    m.purgeExpired(new Date("2040-01-01T00:00:00.000Z"));
    expect(JSON.stringify(record)).toBe(snapshot);
  });

  it("keeps posts, comments and channel posts under 탈퇴한 회원, and drops the stored nickname with the 탈퇴 기록", async () => {
    vi.setSystemTime(new Date(WITHDRAWN_AT));
    const m = await load();
    signInAs(m.SAMPLE_MEMBER_ID);
    const post = await m.createPost({ category: "FREE", title: "탈퇴 전 글", body: "남겨 둘 글이에요", requestId: key(1) });
    const postId = post.status === "SAVED" ? post.id : "";
    expect(await m.addComment("p-2", "탈퇴 전 댓글", key(2))).toEqual({ status: "SAVED" });
    const channelPost = await m.createChannelPost({ creatorId: "c1", body: "탈퇴 전 응원", requestId: key(3) });
    const channelPostId = channelPost.status === "SAVED" ? channelPost.id : "";
    signInAs("u-other");
    expect(await m.submitReport({ target: { type: "POST", id: postId }, reason: "SPAM" })).toEqual({ status: "REPORTED" });
    signInAs(m.SAMPLE_MEMBER_ID);
    await withdraw(m);
    const until = m.retentionUntil(WITHDRAWN_AT, "CONTRACT")!;

    const shown = async () => ({
      post: (await m.getPost(postId))?.authorName,
      comment: (await m.getPost("p-2"))!.comments.find((c) => c.body === "탈퇴 전 댓글")?.authorName,
      channel: (await m.getChannelPosts("c1"))!.items.find((p) => p.id === channelPostId)?.authorName
    });
    const stored = () => [
      m.mockCommunity.posts.find((p) => p.id === postId)!.authorName,
      m.mockCommunity.posts.find((p) => p.id === "p-2")!.comments.find((c) => c.body === "탈퇴 전 댓글")!.authorName,
      m.channelCommunityStore().posts.find((p) => p.id === channelPostId)!.authorName
    ];
    const reportedAuthor = async () => (await m.listReports({ status: "OPEN" })).rows.find((r) => r.target.id === postId)!.authorName;

    vi.setSystemTime(new Date(ms(until) - 1));
    signInAs("u-reader");
    expect(await shown()).toEqual({ post: WITHDRAWN, comment: WITHDRAWN, channel: WITHDRAWN });
    // The console still knows who wrote it while the 탈퇴 기록 is kept.
    expect(await reportedAuthor()).toBe("홍길동");
    expect(stored()).toEqual(["홍길동", "홍길동", "홍길동"]);

    // Long after every date: the content is still up, with no name left behind it.
    vi.setSystemTime(new Date("2040-01-01T00:00:00.000Z"));
    expect(await reportedAuthor()).toBe(WITHDRAWN);
    expect(stored()).toEqual([WITHDRAWN, WITHDRAWN, WITHDRAWN]);
    expect(await shown()).toEqual({ post: WITHDRAWN, comment: WITHDRAWN, channel: WITHDRAWN });
    expect(m.mockCommunity.posts.find((p) => p.id === postId)).toMatchObject({ deleted: false, title: "탈퇴 전 글" });
  });

  it("shows each category's date for a withdrawn member in the admin detail", async () => {
    vi.setSystemTime(new Date(WITHDRAWN_AT));
    const m = await load();
    await withdraw(m);
    const detail = (await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.member;
    expect(detail.withdrawal!.retentionNote).toBe("기본값 (일반적인 기준, 법무 검토 전)");
    expect(detail.withdrawal!.retention.map((r) => [r.label, r.period, r.until, r.purged])).toEqual([
      ["계약 · 청약철회 기록", "5년", "2031-10-08T03:00:00.000Z", false],
      ["대금결제 · 재화 공급 기록", "5년", "2031-10-08T03:00:00.000Z", false],
      ["소비자 불만 · 분쟁 처리 기록", "3년", "2029-10-08T03:00:00.000Z", false],
      ["접속 기록", "3개월", "2027-01-08T03:00:00.000Z", false],
      ["부정 이용 방지용 본인 확인 값", "탈퇴 후 1년", "2027-10-08T03:00:00.000Z", false],
      ["게시물 (커뮤니티 글 · 댓글 · 채널 글)", "삭제하지 않음", null, false]
    ]);
    expect(detail.withdrawal!.retention[0]).toMatchObject({ basis: "전자상거래법", covers: "탈퇴 기록, 약관 동의 기록" });

    // After a 재가입 the withdrawn account (`…-w1`) keeps its dates; a date that has come shows as purged.
    signUp(m, "010-0000-0000");
    vi.setSystemTime(new Date("2027-01-08T03:00:00.000Z"));
    const w1 = (await m.getMemberDetail(`${m.SAMPLE_MEMBER_ID}-w1`))!.member;
    expect(w1.withdrawal!.retention.filter((r) => r.purged).map((r) => r.category)).toEqual(["ACCESS_LOG"]);
    expect((await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.member.withdrawal).toBeNull();
  });
});

describe("본인 확인 값 and the person key", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["SUPPORTER"]);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(WITHDRAWN_AT));
  });
  afterEach(() => vi.useRealTimers());

  /** The sample event that is always running (mock events are dated relative to today). */
  const EVENT = "ev-first-donation";

  it("lets the same phone be the same person up to a year after the withdrawal", async () => {
    const m = await load();
    const { joinEvent } = await import("@/services/events/events");
    expect(await joinEvent(EVENT)).toEqual({ status: "JOINED" });
    const person = m.currentPersonKey();
    await withdraw(m);

    vi.setSystemTime(new Date(ms(m.retentionUntil(WITHDRAWN_AT, "PERSON_KEY")!) - 1));
    signUp(m, "010-1234-5678");
    expect(m.currentPersonKey()).toBe(person);
    expect(await m.getEvent(EVENT)).toMatchObject({ joined: true });
  });

  it("drops the person key after that year: the same phone signs up as a new person", async () => {
    const m = await load();
    const { joinEvent } = await import("@/services/events/events");
    expect(await joinEvent(EVENT)).toEqual({ status: "JOINED" });
    const person = m.currentPersonKey();
    await withdraw(m);

    vi.setSystemTime(new Date(m.retentionUntil(WITHDRAWN_AT, "PERSON_KEY")!));
    signUp(m, "010-1234-5678");
    expect(m.currentPersonKey()).not.toBe(person);
    expect(m.currentPersonKey()).not.toBe("");
    expect(await m.getEvent(EVENT)).toMatchObject({ joined: false });
    expect(m.withdrawnAccounts()[0].record.person).toBeNull();
    expect(await joinEvent(EVENT)).toEqual({ status: "JOINED" });
  });

  it("counts the year from the person's latest withdrawal", async () => {
    const m = await load();
    const person = m.currentPersonKey();
    await withdraw(m);
    // Back within the year with the same phone, then gone again three months later.
    vi.setSystemTime(new Date("2027-04-08T03:00:00.000Z"));
    signUp(m, "010-1234-5678");
    expect(m.currentPersonKey()).toBe(person);
    vi.setSystemTime(new Date("2027-07-08T03:00:00.000Z"));
    await withdraw(m, 2, "newpass12!");
    // A year after the first withdrawal the first record's key is gone, the second one's is not.
    vi.setSystemTime(new Date("2027-12-01T00:00:00.000Z"));
    signUp(m, "010-1234-5678");
    expect(m.currentPersonKey()).toBe(person);
    expect(m.withdrawnAccounts().map((a) => a.record.person?.key ?? null)).toEqual([null, person]);
  });

  it("keeps another phone a different person", async () => {
    const m = await load();
    const person = m.currentPersonKey();
    await withdraw(m);
    signUp(m, "010-0000-0000");
    expect(m.currentPersonKey()).not.toBe(person);
  });
});
