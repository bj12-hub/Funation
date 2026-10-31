"use server";

import { randomUUID } from "node:crypto";
import { isFlextvChannelId } from "@/lib/flextv/donation";
import { FLEXTV_DONATION } from "@/lib/flextv/mode";
import { toDateString } from "@/lib/period";
import { memberKeyOf } from "@/lib/records";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS, currentPersonKey, mockAccount } from "@/services/account/mockStore";
import { sessionAccount } from "@/services/account/withdrawalCore";
import { donorKeyOf, enqueueDonationAlert } from "@/services/creator/alertCore";
import { shownOnStream } from "@/services/creator/donationPageCore";
import { getCreatorById } from "@/services/creators/creators";
import { attributeMemberDonation, isActiveMember, isMinusDonation, linkFeedAlert, liveBroadcastOf, recordBroadcastDonation, type FeedListing } from "@/services/crew/crewCore";
import { gamesForSignature } from "@/services/crew/crewGameTriggers";
import { drawMedley, medleyRun } from "@/services/crew/crewMedleyCore";
import { drawRandomSig, randomSigRun } from "@/services/crew/crewRandomSigCore";
import { MEMBER_NICKNAME_ID, attributeDonation, nicknameChangeable, ownsNickname, resolveBadges } from "@/services/supporter/identityCore";
import { alertBadgeLabels } from "@/services/supporter/identityTypes";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import type { DonationCatalog } from "./donationCatalog";
import * as flextv from "./flextvDonate";
import { recordQuest } from "./questCore";
import { canParticipate, enqueueSpin } from "./rouletteCore";
import { canDraw, enqueueDraw } from "./gachaCore";
import { getDonationCatalog, matchSignatureByAmount, signatureIdFor, signatureImageFor, signatureImageOf, signatureSoundFor, signatureSoundOf } from "./signatureCore";
import { addDonationDrawing, enqueueDonationVideo } from "@/services/creator/mediaCore";
import { notify } from "@/services/notifications/notificationCore";
import { parseDetails, type ParsedDetails } from "./donationDetails";
import type { DonationResult } from "./donationTypes";

/**
 * Donation Core: one debit path for every donation type (CLAUDE.md §10). Each type only
 * contributes validation and the amount — signature and wishlist prices come from the server catalog.
 *
 * Server Action: re-checks the session, validates input, checks the balance on the server and is
 * idempotent per `idempotencyKey` — a retried or double-submitted request returns the first result, even when the
 * catalog changed since (a new price, a sold-out 뽑기), so a client that lost the answer can always learn it.
 * Supporter-written text (message, 미니 text, quest / drawing title) with a platform forbidden word is refused
 * before anything is debited. Priced types (signature, wishlist, 뽑기) debit the price the supporter confirmed, and
 * only while it is still the creator's price (PRICE_CHANGED otherwise). The debit is for the account whose session the
 * request read, only while it still holds the slot, active (UNAUTHORIZED otherwise, nothing debited) — every type, 룰렛 ·
 * 뽑기 · 퀘스트 · 미니 · 크루 멤버 지정 included, debits here.
 * TBD: creator revenue share, platform fee, refunds, delivery to the broadcast platform/overlay.
 *
 * A donation to a FLEXTV channel (FLEXTV_DONATION, a FLEXTV channel id as `creatorId`) goes to ./flextvDonate.ts:
 * FLEXTV moves the 렉스 and delivers it to the broadcast.
 */
export async function requestDonation(input: unknown): Promise<DonationResult> {
  if (FLEXTV_DONATION && isFlextvChannelId((input as { creatorId?: unknown } | null)?.creatorId)) return flextv.requestDonation(input);
  if (!USE_MOCK) throw new Error("Donation API is not connected yet.");
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  // The account this request acts for. It debits only while that account still holds the slot, active: a 탈퇴 and a
  // 재가입 during an await below must not spend the new account's FN (the debit side of the 2026-10-10 credit rule).
  const holder = sessionAccount();

  const v = typeof input === "object" && input !== null ? (input as Record<string, unknown>) : null;
  if (!v || typeof v.idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.idempotencyKey) || typeof v.creatorId !== "string") return { status: "INVALID" };
  const idempotencyKey = v.idempotencyKey;
  const creator = await getCreatorById(v.creatorId);

  // No await from the lookup to the registration: two copies of one request cannot both pass. Keys belong to the
  // member: another member's key never returns (or blocks) their result — nor does another account's in the slot.
  if (!holder.stillHere()) return { status: "UNAUTHORIZED" };
  const fingerprint = fingerprintOf(v);
  const memberKey = memberKeyOf(session.userId, idempotencyKey);
  const previous = mockWallet.donationIdempotency[memberKey];
  if (previous) {
    if (previous.fingerprint !== fingerprint) return { status: "CONFLICT" };
    return previous.result ?? { status: "IN_PROGRESS" };
  }
  if (!creator) return { status: "NOT_FOUND" };
  const catalog = getDonationCatalog();
  const request = parse(v, catalog);
  if (!request) return { status: "INVALID" };
  if ("refused" in request) return { status: "INVALID", message: request.refused };
  // Held by reference: a 재가입 during the await moves the entry to the withdrawn account's own id (account/rejoin.ts).
  const entry: { fingerprint: string; result: DonationResult | null } = (mockWallet.donationIdempotency[memberKey] = { fingerprint, result: null });

  await mockDelay(600);
  // From here to the debit nothing awaits: the checks and the write see the same state.
  let result: DonationResult;
  const price = request.priced ? currentPrice(request.type, request.details) : request.amount;
  // 룰렛 · 뽑기 limits count per person (the verified phone), so a 재가입 the same day does not reset them; the room's
  // 내 룰렛 · 내 뽑기 list the account's own (2026-10-08 결정).
  const player = { supporterUserId: session.userId, account: holder.account, person: currentPersonKey() };
  if (!holder.stillHere()) {
    // The account withdrew during the wait (and someone may have signed up in the slot since): nothing is debited.
    result = { status: "UNAUTHORIZED" };
  } else if (request.type === "ROULETTE" && !canParticipate(creator.id, player.person, request.amount)) {
    // 룰렛 turned off or today's 참여 가능 횟수 used up since the panel loaded.
    result = { status: "INVALID" };
  } else if (request.type === "GACHA" && !canDraw(creator.id, player.person, request.details.gachaId as string)) {
    // 뽑기 turned off, sold out (상품소진형) or 1인 횟수 한도 reached since the panel loaded.
    result = { status: "INVALID" };
  } else if (price === null) {
    // The signature / wishlist item was removed or went out of stock since the panel loaded.
    result = { status: "INVALID" };
  } else if (price !== request.amount) {
    // The creator changed the price after the supporter confirmed it: nothing is debited.
    result = { status: "PRICE_CHANGED", amount: price };
  } else if (mockAccount.fnBalance < request.amount) {
    result = { status: "INSUFFICIENT_FN", balance: mockAccount.fnBalance, required: request.amount };
  } else {
    // What the alert shows — the same values as the confirm dialog preview (getAlertBadges), resolved
    // before this donation counts. A hidden profile shows 익명 without badges (TBD: final display rules).
    const shown = request.hideProfile ? null : resolveBadges(request.nicknameId, creator.id);
    const donor = shown?.name ?? "익명";
    const badges = shown ? alertBadgeLabels(shown) : [];
    // The name on stream: the creator's 대체 메시지 rules as they are now (the alert below applies the same). Overlays
    // that show the donor from the 룰렛 · 뽑기 and crew records use it; the records keep the original as well.
    const shownDonor = shownOnStream({ donor, message: request.summary }).donor;
    // Debit and record in one step (the backend must do this in a single transaction).
    mockAccount.fnBalance -= request.amount;
    const now = new Date();
    // Unique even for requests finishing in the same millisecond (quest decisions and wallet rows look it up).
    const donationId = `dn-${randomUUID()}`;
    const quest = request.type === "QUEST";
    const donorId = request.hideProfile ? "" : session.ssumnationId;
    mockWallet.donations.unshift({
      id: donationId,
      donatedAt: `${toDateString(now)} ${now.toTimeString().slice(0, 8)}`,
      creatorId: creator.id,
      creatorName: creator.name,
      message: request.summary,
      fnAmount: request.amount,
      typeLabel: catalog.types.find((t) => t.key === request.type)!.title,
      category: HISTORY_CATEGORY[request.type] ?? "basic",
      // A running quest holds the FN (refunded on 실패 · 취소); it completes when the quest succeeds.
      status: quest ? "PROCESSING" : "COMPLETED",
      // Public totals and rankings never count a hidden-profile donation under the member's name.
      hideProfile: request.hideProfile
    });
    // A hidden profile went out as 익명: no 별명 gets it (2026-10-09 결정; it still counts toward the 누적 · 활동 등급).
    if (!request.hideProfile) attributeDonation(donationId, request.nicknameId);
    // 랜덤시그 (점수 게임, 2026-10-23): a 일반 후원 of exactly a 발동 금액 plays a signature drawn from that tier.
    const randomSig = request.type === "TEXT" ? drawRandomSig(creator.id, request.amount) : null;
    // 시그니처 메들리 (2026-10-24): one exactly the 메들리 금액 plays one of the registered signatures (랜덤시그 goes first).
    const medley = request.type === "TEXT" && !randomSig ? drawMedley(creator.id, request.amount) : null;
    const drawn = randomSig?.signature ?? medley?.signature;
    const signatureId = drawn?.id ?? signatureIdFor(request.type, request.amount, request.details);
    // 후원 리스트 entry (crew broadcast, no member picked): listed before its alert is queued (미지정 일시정지).
    let listed: FeedListing | null = null;
    if (quest) {
      const d = request.details as { title: string; timeLimitSec: number; creatorDecides: boolean };
      recordQuest({
        id: donationId,
        channelId: creator.id,
        supporterUserId: session.userId,
        donor,
        donorId,
        title: d.title,
        amount: request.amount,
        timeLimitSec: d.timeLimitSec,
        creatorDecides: d.creatorDecides,
        createdAt: now.toISOString(),
        // Crew points, member ranking and the 후원 리스트 wait for SUCCESS (questCore.ts); the name on stream is the one
        // its 퀘스트 도착 alert showed (2026-10-09 결정).
        crew: { memberId: request.memberId, broadcastId: liveBroadcastOf(creator.id)?.id ?? null, message: request.summary, shownDonor }
      });
    } else {
      // Crew records keep the name as sent (방송 운영 후원 리스트, 크루 후원) and the name on stream (2026-10-09 결정).
      // 마이너스 시그니처 (2026-11-01): fixed now — its points come off the member, and no 점수 게임 plays for it.
      const minus = isMinusDonation(creator.id, signatureId, request.memberId);
      attributeMemberDonation(donationId, creator.id, request.memberId, request.amount, { donor, donorId, message: request.summary, shownDonor }, minus);
      if (!request.memberId) listed = recordBroadcastDonation(creator.id, { donor, shownDonor, message: request.summary, fnAmount: request.amount });
      // 점수 게임 (2026-10-23): a 랜덤시그 records its run; a 시그니처 후원 to a member plays each game with 자동 on while a
      // crew broadcast is live (a 랜덤시그 counts as the signature it drew).
      randomSigRun(creator.id, { donationId, memberId: request.memberId, fnAmount: request.amount, drawn: randomSig });
      medleyRun(creator.id, { donationId, memberId: request.memberId, amount: request.amount, drawn: medley });
      if (!minus) gamesForSignature(creator.id, { donationId, memberId: request.memberId, signatureId, fnAmount: request.amount });
    }
    // 룰렛: the result is drawn now and revealed when the wheel spins (no FN prize — 2026-10-04 결정).
    // 뽑기: the prize is drawn now (stock goes down) and played on the 뽑기 overlay (no FN prize).
    // Their overlays show the name as the alert does (대체 메시지 표시 설정); the records keep the original.
    if (request.type === "GACHA") enqueueDraw({ id: donationId, channelId: creator.id, ...player, donor, shownDonor, gachaId: request.details.gachaId as string, amount: request.amount });
    if (request.type === "ROULETTE") enqueueSpin({ id: donationId, channelId: creator.id, ...player, donor, shownDonor, amount: request.amount });
    const alert = enqueueDonationAlert(creator.id, {
      donor,
      // 후원랭킹 groups by this opaque key, never by the (copyable) name; a hidden profile has none.
      donorKey: request.hideProfile ? null : donorKeyOf(creator.id, session.userId),
      badges,
      message: request.summary,
      fnAmount: request.amount,
      // 금액 매칭 (시그니처 관리): a 일반 후원 whose amount equals an AMOUNT-match signature alerts as that signature.
      typeLabel: randomSig
        ? `랜덤시그 · ${randomSig.signature.name}`
        : medley
          ? `메들리 · ${medley.signature.name}`
          : alertTypeLabel(catalog, request.type, request.amount),
      donationType: request.type,
      imageUrl: drawn ? signatureImageOf(drawn) : signatureImageFor(catalog, request.type, request.amount, request.details),
      // 랜덤시그 알림 롤링 (2026-10-26): the candidates the card flips through first.
      ...(randomSig?.rolling.length ? { rolling: randomSig.rolling } : {}),
      soundUrl: drawn ? signatureSoundOf(drawn) : signatureSoundFor(request.type, request.amount, request.details),
      // 시그 카운트 (2026-10-23): which signature, and the member the supporter picked.
      signatureId,
      ...(request.memberId ? { memberId: request.memberId } : {}),
      // The quest's arrival shows now; its FN counts in the 후원 위젯 once it succeeds.
      ...(quest ? { questId: donationId } : {}),
      ...(listed?.held ? { held: true } : {})
    });
    linkFeedAlert(listed, alert);
    // 영상 · 그림후원 위젯: paid requests reach the creator's queue / gallery.
    const d = request.details as Record<string, unknown>;
    if (request.type === "VIDEO" || request.type === "AUDIO") {
      enqueueDonationVideo(creator.id, { donor, fnAmount: request.amount, videoId: d.videoId as string, startSec: d.start as number, endSec: d.end as number, mode: request.type });
    }
    if (request.type === "DRAWING") addDonationDrawing(creator.id, { donor, title: d.title as string, fnAmount: request.amount, image: d.image as string });
    notify({ kind: "DONATION_SENT", title: "후원을 보냈어요", body: `${creator.name}님께 ${request.amount.toLocaleString("ko-KR")} FN`, href: "/wallet/donations", dedupeKey: `donation:${idempotencyKey}` });
    result = { status: "COMPLETED", donationId, fnAmount: request.amount, balance: mockAccount.fnBalance };
  }
  entry.result = result;
  return result;
}

function alertTypeLabel(catalog: DonationCatalog, type: string, amount: number) {
  const matched = type === "TEXT" ? matchSignatureByAmount(amount) : null;
  return matched ? `시그니처 · ${matched.name}` : catalog.types.find((t) => t.key === type)!.title;
}

// ── Validation ───────────────────────────────────────────────────────────────

/**
 * What the supporter sent (key order ignored, the key itself left out), including the price they confirmed — not what
 * the server derived from it, so a retry still matches after the creator renames a signature or changes a price.
 */
const fingerprintOf = (v: Record<string, unknown>) =>
  JSON.stringify(
    Object.entries(v)
      .filter(([k]) => k !== "idempotencyKey")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  );

type Parsed = ParsedDetails & {
  creatorId: string;
  hideProfile: boolean;
  nicknameId: string | null;
  memberId: string | null;
};

const hasForbidden = (...texts: string[]) => texts.some((t) => MOCK_FORBIDDEN_WORDS.some((w) => t.toLowerCase().includes(w)));

/** The creator's current price of a signature, wishlist item or 뽑기; null when it is gone (or out of stock). */
function currentPrice(type: string, details: Record<string, unknown>): number | null {
  const catalog = getDonationCatalog();
  if (type === "SIGNATURE") return catalog.signatures.find((s) => s.id === details.signatureId)?.price ?? null;
  if (type === "WISHLIST") {
    const item = catalog.wishlist.find((w) => w.id === details.itemId);
    return item?.inStock ? item.price : null;
  }
  return catalog.gacha.find((x) => x.id === details.gachaId)?.price ?? null;
}

/** 후원내역 tabs (632:4): 기본 후원 / 퀘스트 후원 / 게임 후원. */
const HISTORY_CATEGORY: Partial<Record<string, "basic" | "quest" | "game">> = {
  QUEST: "quest",
  ROULETTE: "game",
  GACHA: "game"
};

/** null = malformed; `refused` = well-formed but the text cannot go out (a platform forbidden word). The per-type rules are ./donationDetails.ts. */
function parse(v: Record<string, unknown>, catalog: DonationCatalog): Parsed | { refused: string } | null {
  if (typeof v.creatorId !== "string" || typeof v.hideProfile !== "boolean") return null;

  // Optional donation nickname (별명): must belong to the supporter; null = the default nickname. With the creator's
  // 후원 닉네임 변경 off, the pick is ignored and the donation goes out under the member nickname.
  const changeable = nicknameChangeable();
  if (changeable && v.nicknameId !== undefined && v.nicknameId !== null && !ownsNickname(v.nicknameId)) return null;
  const nicknameId = !changeable ? MEMBER_NICKNAME_ID : typeof v.nicknameId === "string" ? v.nicknameId : null;
  // Optional crew member (크루 멤버 지정): must be an active member of this creator's crew.
  if (v.memberId !== undefined && v.memberId !== null && !isActiveMember(v.creatorId as string, v.memberId)) return null;
  const memberId = typeof v.memberId === "string" ? v.memberId : null;

  const parsed = parseDetails(v, catalog, hasForbidden);
  if (!parsed || "refused" in parsed) return parsed;
  return { ...parsed, creatorId: v.creatorId, hideProfile: v.hideProfile, nicknameId, memberId };
}
