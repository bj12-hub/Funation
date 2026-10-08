import { beforeEach, describe, expect, it, vi } from "vitest";
import { key, mockSessionModule, phoneToken, resetMockStores, signIn, signInAs, verifyMockIdentity } from "@/test/mockEnv";

/** `during` runs inside the next mock delay, i.e. while the server is "busy" between its checks. */
const delay = vi.hoisted(() => ({ during: null as null | (() => void) }));
vi.mock("@/lib/mock", () => ({
  USE_MOCK: true,
  mockDelay: async () => {
    const run = delay.during;
    delay.during = null;
    run?.();
  }
}));
vi.mock("@/lib/session", () => mockSessionModule());
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

/**
 * 회원 탈퇴 (2026-10-04 결정: 남은 FN 소멸 동의 후 바로 탈퇴; 2026-10-05: 크리에이터 정산 대기 수익도 소멸 동의,
 * 비밀번호 재입력, 바로 재가입 가능): every consent and the password are checked on the server, exactly the amounts
 * the member saw are forfeited, the account can no longer sign in, the admin directory keeps the record, and a new
 * sign-up starts a fresh account.
 */
async function load() {
  const withdrawal = await import("./withdrawal");
  const core = await import("./withdrawalCore");
  const store = await import("./mockStore");
  const { mockSettlement } = await import("@/services/creator/mockSettlementStore");
  const { login } = await import("@/services/auth/login");
  const { signup } = await import("@/services/auth/signup");
  const { getWalletOverview } = await import("@/services/wallet/walletHistory");
  const members = await import("@/services/admin/members");
  const { getSettlementReview } = await import("@/services/admin/settlements");
  const { SAMPLE_MEMBER_ID } = await import("@/services/admin/memberCore");
  const session = await import("@/lib/session");
  return {
    ...withdrawal,
    ...core,
    ...members,
    account: store.mockAccount,
    credentials: store.mockCredentials,
    sessionState: store.mockSessionState,
    settlement: mockSettlement,
    login,
    signup,
    getWalletOverview,
    getSettlementReview,
    SAMPLE_MEMBER_ID,
    session
  };
}

const OP = { userId: "admin-1", nickname: "운영자1" };
const PASSWORD = "password"; // the mock account's initial password (services/account/mockStore.ts)
const supporter = (n = 1) => ({ requestId: key(n), confirmed: true, forfeitAgreed: true, fnBalance: 5_000, unsettledFn: 0, password: PASSWORD });

describe("회원 탈퇴", () => {
  beforeEach(() => {
    resetMockStores();
    signIn(["SUPPORTER"]);
  });

  it("needs every consent for the amounts the member saw and the password, then forfeits and ends the account", async () => {
    const m = await load();
    expect(await m.getWithdrawalInfo()).toEqual({ nickname: "홍길동", fnBalance: 5_000, creator: false, unsettledFn: 0, pendingRefunds: 0 });

    const base = supporter();
    expect(await m.withdrawAccount({ ...base, requestId: "short" })).toMatchObject({ status: "INVALID" });
    expect(await m.withdrawAccount({ ...base, confirmed: false })).toEqual({ status: "INVALID", message: "탈퇴 안내를 확인하고 동의해 주세요." });
    expect(await m.withdrawAccount({ ...base, forfeitAgreed: false })).toEqual({ status: "INVALID", message: "남은 FN 소멸에 동의해 주세요." });
    // A charge landed after the page was shown: the consent was for another amount.
    expect(await m.withdrawAccount({ ...base, fnBalance: 3_000 })).toMatchObject({ status: "INVALID" });
    expect(await m.withdrawAccount({ ...base, password: "wrong-one" })).toEqual({ status: "WRONG_PASSWORD" });
    expect(await m.withdrawAccount({ ...base, password: undefined })).toEqual({ status: "WRONG_PASSWORD" });
    expect(m.isWithdrawn()).toBe(false);

    expect(await m.withdrawAccount(base)).toEqual({ status: "WITHDRAWN" });
    expect(m.withdrawalOf()).toMatchObject({ requestId: key(1), forfeitedFn: 5_000, forfeitedEarningsFn: 0, nickname: "홍길동" });
    expect(m.account.fnBalance).toBe(0);
    expect(Object.values(m.account.linkedLoginProviders).every((p) => p === null)).toBe(true);
    expect(m.account.connectedPlatforms.every((p) => p.handle === null)).toBe(true);
    expect(m.session.revokeSession).toHaveBeenCalled();

    // The same request again (lost response) gets the same answer, even signed out; another one does not.
    signIn(null);
    expect(await m.withdrawAccount(base)).toEqual({ status: "WITHDRAWN" });
    expect(await m.withdrawAccount(supporter(2))).toEqual({ status: "UNAUTHORIZED" });

    // The account no longer exists for sign-in.
    expect(await m.login({ identifier: "hongGD123", password: PASSWORD, keepSignedIn: false })).toEqual({ status: "UNKNOWN_ID" });
  });

  it("does not ask for the FN consent without a balance", async () => {
    const m = await load();
    m.account.fnBalance = 0;
    expect(await m.withdrawAccount({ ...supporter(), forfeitAgreed: false, fnBalance: 0 })).toEqual({ status: "WITHDRAWN" });
    expect(m.withdrawalOf()!.forfeitedFn).toBe(0);
  });

  it("lets a creator forfeit earnings waiting for settlement with its own consent", async () => {
    signIn(["SUPPORTER", "CREATOR"]);
    const m = await load();
    m.settlement.requests.push({ ...m.settlement.requests[0], id: "st-pending", status: "PENDING", amountFn: 20_000, review: undefined });
    expect(await m.getWithdrawalInfo()).toMatchObject({ creator: true, unsettledFn: 147_500 });

    const base = { ...supporter(), unsettledFn: 147_500, earningsForfeitAgreed: true };
    expect(await m.withdrawAccount({ ...base, earningsForfeitAgreed: false })).toEqual({ status: "INVALID", message: "정산 대기 수익 소멸에 동의해 주세요." });
    expect(await m.withdrawAccount({ ...base, unsettledFn: 127_500 })).toEqual({ status: "INVALID", message: "정산 대기 수익이 바뀌었어요. 금액을 다시 확인해 주세요." });
    expect(m.isWithdrawn()).toBe(false);

    expect(await m.withdrawAccount(base)).toEqual({ status: "WITHDRAWN" });
    expect(m.withdrawalOf()).toMatchObject({ forfeitedFn: 5_000, forfeitedEarningsFn: 147_500 });
    expect(m.settlement.availableFn).toBe(0);
    // The waiting request ends as 탈퇴 소멸 (not 반려) and leaves the review queue; decided ones stay as they were.
    const forfeited = m.settlement.requests.find((r) => r.id === "st-pending")!;
    expect(forfeited).toMatchObject({ status: "FORFEITED", payoutDate: null, review: { by: "회원 탈퇴" } });
    const review = (await m.getSettlementReview())!;
    expect(review.counts).toMatchObject({ PENDING: 0, FORFEITED: 1, APPROVED: 5, REJECTED: 1 });
  });

  it("re-reads the amounts after the password check, so a decision in between is not recorded as forfeited", async () => {
    signIn(["SUPPORTER", "CREATOR"]);
    const m = await load();
    m.settlement.requests.push({ ...m.settlement.requests[0], id: "st-pending", status: "PENDING", amountFn: 20_000, review: undefined });
    const base = { ...supporter(), unsettledFn: 147_500, earningsForfeitAgreed: true };
    // An operator approves the waiting request while the password is being checked.
    delay.during = () => Object.assign(m.settlement.requests.find((r) => r.id === "st-pending")!, { status: "APPROVED" });
    expect(await m.withdrawAccount(base)).toEqual({ status: "INVALID", message: "정산 대기 수익이 바뀌었어요. 금액을 다시 확인해 주세요." });
    expect(m.isWithdrawn()).toBe(false);
    expect(m.settlement.requests.find((r) => r.id === "st-pending")!.status).toBe("APPROVED");
    expect(await m.withdrawAccount({ ...base, requestId: key(2), unsettledFn: 127_500 })).toEqual({ status: "WITHDRAWN" });
    expect(m.withdrawalOf()).toMatchObject({ forfeitedEarningsFn: 127_500 });
  });

  it("ends what acts for the channel and removes the payout account", async () => {
    signIn(["SUPPORTER", "CREATOR"]);
    const m = await load();
    const { managerLinks } = await import("@/services/broadcast/chatCore");
    const { channelsStore } = await import("@/services/broadcast/channelsCore");
    const { youtubeStore } = await import("@/services/creator/youtubeCore");
    const { bankSmsStore } = await import("@/services/bankSms/bankSmsCore");
    const { mockCreator } = await import("@/services/creator/mockCreatorStore");
    const { createManagerLink } = await import("@/services/broadcast/managerChat");
    const { connectBroadcastChannel } = await import("@/services/broadcast/unifiedChat");
    const { connectYouTube } = await import("@/services/creator/youtube");
    await connectYouTube({ handle: "streamer", requestId: key(900) });
    await connectBroadcastChannel({ platform: "SOOP", handle: "streamer" });
    await createManagerLink({ requestId: key(901), name: "지민", permissions: ["SEND"] });
    const { chatStore } = await import("@/services/broadcast/chatCore");
    const { donationLinkStore } = await import("@/services/creator/donationLinkCore");
    const { setDonationLink } = await import("@/services/creator/donationLink");
    const { simulateViewerChat } = await import("@/services/broadcast/unifiedChat");
    expect(await setDonationLink({ platform: "SOOP", enabled: true })).toEqual({ status: "OK" });
    await simulateViewerChat({ requestId: key(902), platform: "SOOP", nick: "시청자", text: "안녕" });
    expect(chatStore().messages).toHaveLength(1);
    Object.assign(bankSmsStore(), { enabled: true });
    m.settlement.terms = { memberType: "INDIVIDUAL", acceptedAt: "2026-09-01" };
    m.settlement.registration = {
      memberType: "INDIVIDUAL",
      registrant: "홍길동",
      holder: "홍길동",
      bankName: "예시은행",
      accountMasked: "********1234",
      code: "F0L0E0X0",
      submittedAt: "2026-09-01"
    } as typeof m.settlement.registration;
    m.settlement.autoSettlement = true;
    const keys = { overlay: mockCreator.integrationKey, sms: bankSmsStore().key };
    expect(managerLinks()).toHaveLength(1);
    expect(Object.keys(channelsStore().channels).length).toBeGreaterThan(0);
    expect(youtubeStore().channel).not.toBeNull();

    const earnings = (await m.getWithdrawalInfo())!.unsettledFn;
    expect(await m.withdrawAccount({ ...supporter(), unsettledFn: earnings, earningsForfeitAgreed: true })).toEqual({ status: "WITHDRAWN" });
    expect(managerLinks()).toHaveLength(0);
    expect(channelsStore().channels).toEqual({});
    expect(youtubeStore()).toMatchObject({ channel: null, connectedAt: null });
    // The old channels' read positions, the 후원 연동 switches and the viewers' chat go with them.
    expect(chatStore()).toMatchObject({ cursors: {}, messages: [] });
    expect(donationLinkStore()).toMatchObject({ cursors: {}, enabled: { YOUTUBE: false, CHZZK: false, SOOP: false, FLEXTV: false } });
    expect(bankSmsStore().enabled).toBe(false);
    expect(bankSmsStore().key).not.toBe(keys.sms);
    expect(mockCreator.integrationKey).not.toBe(keys.overlay);
    expect(m.settlement).toMatchObject({ terms: null, registration: null, autoSettlement: false });
  });

  it("shares the login's wrong-password limit: the 5th wrong password locks the account instead of withdrawing", async () => {
    const m = await load();
    for (let i = 1; i <= 4; i++) expect(await m.withdrawAccount({ ...supporter(i), password: "wrong-pass1" })).toEqual({ status: "WRONG_PASSWORD" });
    expect(await m.withdrawAccount({ ...supporter(5), password: "wrong-pass1" })).toEqual({ status: "LOCKED" });
    expect(await m.withdrawAccount({ ...supporter(6) })).toEqual({ status: "LOCKED" }); // even with the right one now
    expect(m.isWithdrawn()).toBe(false);
    expect((await m.login({ identifier: "hongGD123", password: PASSWORD, keepSignedIn: false })).status).toBe("LOCKED");
  });

  it("needs a signed-in member", async () => {
    signIn(null);
    const m = await load();
    expect(await m.getWithdrawalInfo()).toBeNull();
    expect(await m.withdrawAccount(supporter())).toEqual({ status: "UNAUTHORIZED" });
  });

  it("keeps the withdrawn member in the admin directory as 탈퇴", async () => {
    const m = await load();
    await m.withdrawAccount(supporter());
    const detail = (await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!;
    expect(detail.member).toMatchObject({ status: "WITHDRAWN", suspension: null, withdrawal: { forfeitedFn: 5_000, forfeitedEarningsFn: 0 } });
    expect((await m.listMembers({ status: "WITHDRAWN" }))!.items.map((i) => i.id)).toEqual([m.SAMPLE_MEMBER_ID]);
    expect(await m.suspendMember(OP, { id: m.SAMPLE_MEMBER_ID, days: 7, reason: "운영 정책 위반 (테스트)", requestId: key(3) })).toEqual({
      status: "INVALID",
      message: "탈퇴한 회원이에요."
    });
  });

  it("waits for FN 충전 환불 requests to be decided before the account can go (2026-10-06 결정)", async () => {
    const m = await load();
    const { requestChargeRefund } = await import("@/services/wallet/refund");
    const { listChargeRecords } = await import("@/services/wallet/walletHistory");
    const { decideRefund } = await import("@/services/admin/payments");
    const [first, second] = listChargeRecords().filter((c) => c.status === "COMPLETED");
    expect(await requestChargeRefund({ chargeId: first.id, reason: "잘못 충전했어요" })).toMatchObject({ status: "REQUESTED" });
    expect(await m.getWithdrawalInfo()).toMatchObject({ pendingRefunds: 1 });
    expect(await m.withdrawAccount(supporter())).toEqual({ status: "REFUND_PENDING", count: 1 });
    expect(m.isWithdrawn()).toBe(false);

    expect(await decideRefund(OP, { chargeId: first.id, decision: "REJECT", note: "사용한 FN이 있어요" })).toEqual({ status: "OK" });
    expect(await m.getWithdrawalInfo()).toMatchObject({ pendingRefunds: 0 });
    // A refund asked for while the password is being checked stops it too.
    delay.during = () => void requestChargeRefund({ chargeId: second.id, reason: "다른 탭에서 요청" });
    expect(await m.withdrawAccount({ ...supporter(), requestId: key(2) })).toEqual({ status: "REFUND_PENDING", count: 1 });
    expect(m.isWithdrawn()).toBe(false);
  });

  it("lets the same person sign up again right away as a new account", async () => {
    const m = await load();
    const { mockWallet } = await import("@/services/wallet/mockWalletStore");
    Object.assign(mockWallet, { chargeTermsAgreedAt: "2026-10-01T00:00:00.000Z", marketingOptIn: true });
    await m.withdrawAccount(supporter());
    const signupRequest = {
      email: "again@funation.kr",
      password: "newpass12!",
      nickname: "다시왔어요",
      phoneVerificationToken: await phoneToken(),
      agreements: { youth: true, service: true, privacy: true, marketing: true }
    } as const;
    expect(await m.signup(signupRequest)).toEqual({ status: "CREATED" });
    expect(m.isWithdrawn()).toBe(false);
    expect(m.account).toMatchObject({ nickname: "다시왔어요", fnBalance: 0, marketingConsent: true, avatarUrl: null });
    // The withdrawn member's consent to the FN charge terms does not carry over.
    expect(mockWallet).toMatchObject({ chargeTermsAgreedAt: null, marketingOptIn: false });
    expect(m.sessionState.roles).toEqual(["SUPPORTER"]);

    // Signs in with the new password only; nothing of the withdrawn account comes back.
    expect(await m.login({ identifier: "again@funation.kr", password: PASSWORD, keepSignedIn: false })).toEqual({ status: "WRONG_PASSWORD" });
    expect(await m.login({ identifier: "again@funation.kr", password: "newpass12!", keepSignedIn: false })).toEqual({ status: "SUCCESS" });
    signIn(["SUPPORTER"]);
    const wallet = (await m.getWalletOverview({ period: "all" }))!;
    expect(wallet).toMatchObject({ available: 0, entries: [] });

    // The withdrawn account stays in the admin directory; the slot is an active member again.
    const withdrawn = (await m.listMembers({ status: "WITHDRAWN" }))!.items;
    expect(withdrawn.map((i) => [i.id, i.nickname, i.withdrawal?.forfeitedFn])).toEqual([[`${m.SAMPLE_MEMBER_ID}-w1`, "홍길동", 5_000]]);
    expect((await m.getMemberDetail(m.SAMPLE_MEMBER_ID))!.member).toMatchObject({ status: "ACTIVE", nickname: "다시왔어요", withdrawal: null });
  });

  it("starts the new account without the withdrawn member's 별명, 대표 별명 or 칭호 setting", async () => {
    const m = await load();
    const identity = await import("@/services/supporter/identity");
    // The sample history earns 골드 서포터; the member shows it, adds a 별명 and makes it the 대표.
    expect((await identity.getSupporterIdentity())!.global.earned).toContain("GOLD");
    expect(await identity.saveEquipSettings({ showGrade: true, globalTitle: "GOLD", showStoreTitle: true })).toEqual({ status: "SAVED" });
    expect(await identity.addDonationNickname("응원단장")).toEqual({ status: "SAVED" });
    const nick = (await identity.getSupporterIdentity())!.nicknames.find((n) => n.name === "응원단장")!;
    expect(await identity.setDefaultDonationNickname(nick.id)).toEqual({ status: "SAVED" });
    expect(await identity.getAlertBadges(null, "c1")).toMatchObject({ name: "응원단장", globalTitle: "골드 서포터" });

    expect(await m.withdrawAccount(supporter())).toEqual({ status: "WITHDRAWN" });
    expect(
      await m.signup({ email: "again@funation.kr", password: "newpass12!", nickname: "다시왔어요", phoneVerificationToken: await phoneToken(), agreements: { youth: true, service: true, privacy: true, marketing: false } })
    ).toEqual({ status: "CREATED" });
    signIn(["SUPPORTER"]);
    const fresh = (await identity.getSupporterIdentity())!;
    expect(fresh.nicknames.map((n) => [n.name, n.isDefault])).toEqual([["다시왔어요", true]]);
    expect(fresh.equip).toEqual({ showGrade: true, globalTitle: "AUTO", showStoreTitle: true });
    expect(fresh.global.earned).toEqual([]);
    // Its alerts carry no title the withdrawn account earned.
    expect(await identity.getAlertBadges(null, "c1")).toEqual({ name: "다시왔어요", grade: null, globalTitle: null, storeTitle: null });
  });

  it("starts the new account without the withdrawn creator's settlement history or earnings", async () => {
    signIn(["SUPPORTER", "CREATOR"]);
    const m = await load();
    await verifyMockIdentity(); // the withdrawn account had done 본인인증
    const earnings = (await m.getWithdrawalInfo())!.unsettledFn;
    const before = m.settlement.requests.length;
    expect(await m.withdrawAccount({ ...supporter(), unsettledFn: earnings, earningsForfeitAgreed: true })).toEqual({ status: "WITHDRAWN" });
    expect(
      await m.signup({ email: "again@funation.kr", password: "newpass12!", nickname: "다시왔어요", phoneVerificationToken: await phoneToken(), agreements: { youth: true, service: true, privacy: true, marketing: false } })
    ).toEqual({ status: "CREATED" });
    expect(m.settlement).toMatchObject({ requests: [], idempotency: {}, availableFn: 0, registration: null });

    // Once the new account opens a channel, its 정산 screens start empty.
    signIn(["SUPPORTER", "CREATOR"]);
    const { getSettlementApplyView } = await import("@/services/creator/settlementRequests");
    const { getSettlementManageView } = await import("@/services/creator/settlementManagement");
    expect(await getSettlementApplyView()).toBe("NOT_REGISTERED"); // the payout account went with the withdrawal
    m.settlement.registration = {
      memberType: "INDIVIDUAL",
      registrant: "다시왔어요",
      holder: "다시왔어요",
      bankName: "예시은행",
      accountMasked: "********5678",
      code: "F0L0E0X1",
      submittedAt: "2026-10-06"
    } as typeof m.settlement.registration;
    // The new account starts without 본인인증 either, and 정산 신청 needs it (2026-10-06 결정).
    expect(m.account.identity).toBeNull();
    expect(await getSettlementApplyView()).toBe("IDENTITY_REQUIRED");
    await verifyMockIdentity();
    expect(await getSettlementApplyView()).toMatchObject({ availableFn: 0, hasPending: false, recent: [] });
    expect(await getSettlementManageView({ period: "all" })).toMatchObject({ items: [] });

    // The console keeps the withdrawn account's requests under its original nickname, marked 탈퇴 (2026-10-08 결정).
    const review = (await m.getSettlementReview())!;
    expect(review.rows).toHaveLength(before);
    expect(new Set(review.rows.map((r) => `${r.creatorName} ${r.creatorWithdrawn}`))).toEqual(new Set(["홍길동 true"]));
  });

  it("leaves the withdrawn account's posts, blocks, reports and notifications with it at a 재가입", async () => {
    const m = await load();
    const community = await import("@/services/community/community");
    const channel = await import("@/services/creators/channelHome");
    const moderation = await import("@/services/moderation/moderation");
    const { listReports } = await import("@/services/admin/reports");
    const notifications = await import("@/services/notifications/notifications");
    const old = `${m.SAMPLE_MEMBER_ID}-w1`;
    signInAs(m.SAMPLE_MEMBER_ID); // the slot's member id, as lib/session gives it

    const post = await community.createPost({ category: "FREE", title: "탈퇴 전 글", body: "내용", requestId: key(51) });
    const postId = post.status === "SAVED" ? post.id : "";
    expect(await community.addComment("p-2", "탈퇴 전 댓글", key(52))).toEqual({ status: "SAVED" });
    const messages = await import("@/services/messages/messages");
    expect(await messages.sendMessage({ to: "c4", body: "탈퇴 전 쪽지", requestId: key(53) })).toEqual({ status: "SAVED" });
    const channelPost = await channel.createChannelPost({ creatorId: "c1", body: "탈퇴 전 응원", requestId: key(50) });
    const channelPostId = channelPost.status === "SAVED" ? channelPost.id : "";
    expect(await moderation.blockAuthorOf({ target: { type: "POST", id: "p-3" } })).toMatchObject({ status: "OK" });
    expect(await moderation.submitReport({ target: { type: "POST", id: "p-1" }, reason: "SPAM" })).toEqual({ status: "REPORTED" });
    expect((await notifications.listNotifications())!.total).toBeGreaterThan(0);
    // Another member blocked the withdrawn account.
    signInAs("u-other");
    expect(await moderation.blockAuthorOf({ target: { type: "POST", id: postId } })).toMatchObject({ status: "OK" });
    signInAs(m.SAMPLE_MEMBER_ID);

    await m.withdrawAccount(supporter());
    expect(
      await m.signup({ email: "again@funation.kr", password: "newpass12!", nickname: "다시왔어요", phoneVerificationToken: await phoneToken(), agreements: { youth: true, service: true, privacy: true, marketing: false } })
    ).toEqual({ status: "CREATED" });

    // The new account in the slot neither owns nor can change what the withdrawn one wrote (it stays up as 탈퇴한 회원).
    expect(await community.getPost(postId)).toMatchObject({ authorName: "탈퇴한 회원", mine: false });
    expect(await community.updatePost(postId, { category: "FREE", title: "남의 글", body: "수정" })).toEqual({ status: "FORBIDDEN" });
    expect(await community.deletePost(postId)).toEqual({ status: "FORBIDDEN" });
    const comment = (await community.getPost("p-2"))!.comments.find((c) => c.body === "탈퇴 전 댓글")!;
    expect(comment.mine).toBe(false);
    expect(await community.deleteComment("p-2", comment.id)).toEqual({ status: "FORBIDDEN" });
    expect((await channel.getChannelPosts("c1"))!.items.find((p) => p.id === channelPostId)).toMatchObject({ mine: false });
    expect(await channel.deleteChannelPost(channelPostId)).toEqual({ status: "FORBIDDEN" });

    // It starts without the old blocks, report history and notifications; 신고 처리 links the old report to the withdrawn member.
    expect(await moderation.listBlocks()).toEqual([]);
    expect((await community.getBoard({})).items.some((p) => p.id === "p-3")).toBe(true);
    expect(await moderation.submitReport({ target: { type: "POST", id: "p-1" }, reason: "SPAM" })).toEqual({ status: "REPORTED" });
    expect(await moderation.submitReport({ target: { type: "POST", id: postId }, reason: "SPAM" })).toEqual({ status: "REPORTED" });
    // The reporter's member id stays on the server (the console lists reports without it), so read the store.
    const { moderationStore } = await import("@/services/moderation/moderationCore");
    expect(moderationStore().reports.map((r) => [r.target.id, r.reporterId, r.authorId]).sort()).toEqual(
      [
        ["p-1", old, "u-sample-1"],
        ["p-1", m.SAMPLE_MEMBER_ID, "u-sample-1"],
        [postId, m.SAMPLE_MEMBER_ID, old]
      ].sort()
    );
    expect((await listReports()).rows.find((r) => r.target.id === postId)!.authorIsMember).toBe(true);
    expect((await notifications.listNotifications())!.total).toBe(0);

    // Request ids are the account's own: the withdrawn account's ids never answer the new account's requests.
    const fresh = await community.createPost({ category: "FREE", title: "새 계정 글", body: "내용", requestId: key(51) });
    expect(fresh.status === "SAVED" && fresh.id).not.toBe(postId);
    expect(await community.addComment("p-2", "새 계정 댓글", key(52))).toEqual({ status: "SAVED" });
    expect((await community.getPost("p-2"))!.comments.find((c) => c.body === "새 계정 댓글")).toMatchObject({ mine: true });
    const again = await channel.createChannelPost({ creatorId: "c1", body: "새 계정 응원", requestId: key(50) });
    expect(again.status === "SAVED" && again.id).not.toBe(channelPostId);
    expect(await messages.sendMessage({ to: "c4", body: "새 계정 쪽지", requestId: key(53) })).toEqual({ status: "SAVED" });
    expect((await messages.getMailbox({ box: "sent" }))!.items.some((x) => x.body === "새 계정 쪽지")).toBe(true);

    // A block on the withdrawn account keeps hiding its posts, and does not hide the new account's.
    signInAs("u-other");
    const board = (await community.getBoard({})).items.map((p) => p.id);
    expect(board).toContain(fresh.status === "SAVED" ? fresh.id : "");
    expect(board).not.toContain(postId);
  });

  it("does not touch accounts that never withdrew when someone signs up", async () => {
    const m = await load();
    expect(
      await m.signup({ email: "new@funation.kr", password: "abcd123!", nickname: "새회원", phoneVerificationToken: await phoneToken(), agreements: { youth: true, service: true, privacy: true, marketing: false } })
    ).toEqual({ status: "CREATED" });
    expect(m.account.nickname).toBe("홍길동");
    expect(m.account.fnBalance).toBe(5_000);
  });
});
