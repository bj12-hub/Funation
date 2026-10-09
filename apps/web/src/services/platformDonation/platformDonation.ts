"use server";

import { randomUUID } from "node:crypto";
import { toDateString } from "@/lib/period";
import { memberKeyOf, ownEntry } from "@/lib/records";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { accountSince } from "@/services/account/withdrawalCore";
import { adapterFor, type PlatformAdapter, type SendResult } from "./adapters";
import { mockPlatform, type MockPlatformTransaction } from "./mockPlatformStore";
import { recheckPending, walletMirror } from "./pendingCore";
import { platformKeyFor } from "./platformKey";
import {
  MESSAGE_MAX,
  PLATFORMS,
  type PlatformCreator,
  type PlatformCreatorDetail,
  type PlatformDonationResult,
  type PlatformHome,
  type PlatformKey,
  type PlatformProduct,
  type PlatformQuote
} from "./platformTypes";

/**
 * Platform donation (SOOP · FlexTV 머니 후원) — Figma 817:9017–9741 · 817:8317–8948.
 *
 * Donation Core rules: the FN price comes from the platform catalog on the server, the balance is
 * checked and debited on the server, and each confirmation carries an Idempotency-Key so a retry or
 * double click never debits twice. The key is the member's own (kept per member: another member sending the same key
 * gets a donation of their own), and the platform gets a key derived from it (./platformKey.ts), never the member's raw
 * key. If the platform rejects the donation the debit is reversed
 * ("FN은 차감되지 않았습니다."). If the platform call throws or times out the outcome is unknown: the FN
 * stays held, the transaction stays PROCESSING and the key answers PENDING with its Transaction ID. The server then
 * re-checks it for 24 hours and an operator decides it after that (2026-10-08 결정, ./pendingCore.ts).
 * TBD: FN ↔ platform-currency rate, fees, platform API capability and auth, refunds, message moderation.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Platform donation API is not connected yet.");
};

const isPlatform = (v: unknown): v is PlatformKey => typeof v === "string" && Object.hasOwn(PLATFORMS, v);
const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v);

export async function getPlatformHome(platform: PlatformKey): Promise<PlatformHome | null> {
  assertMock();
  if (!(await getSession()) || !isPlatform(platform)) return null;
  const adapter = adapterFor(platform);
  await mockDelay(250);
  // This account's own donations only, as in 후원 내역 (the mock's 재가입 keeps the user id; services/account/rejoin.ts).
  const since = accountSince();
  const recentIds = [...new Set(mockPlatform.transactions.filter((t) => t.platform === platform && (t.account ?? null) === since).map((t) => t.creatorId))].slice(0, 4);
  const recent = (await Promise.all(recentIds.map((id) => adapter.getCreator(id)))).filter((c): c is PlatformCreator => c !== null);
  return { platform, balance: mockAccount.fnBalance, recent, popular: await adapter.popularCreators() };
}

export async function searchPlatformCreators(platform: PlatformKey, query: string): Promise<{ balance: number; results: PlatformCreator[] } | null> {
  assertMock();
  if (!(await getSession()) || !isPlatform(platform)) return null;
  const q = typeof query === "string" ? query.trim().slice(0, 40) : "";
  await mockDelay(300);
  return { balance: mockAccount.fnBalance, results: q ? await adapterFor(platform).searchCreators(q) : [] };
}

export async function getPlatformCreatorDetail(platform: PlatformKey, creatorId: string): Promise<PlatformCreatorDetail | "UNAUTHORIZED" | "NOT_FOUND"> {
  assertMock();
  if (!(await getSession())) return "UNAUTHORIZED";
  if (!isPlatform(platform) || !isId(creatorId)) return "NOT_FOUND";
  const adapter = adapterFor(platform);
  const creator = await adapter.getCreator(creatorId);
  if (!creator) return "NOT_FOUND";
  await mockDelay(250);
  return { platform, balance: mockAccount.fnBalance, creator, products: await adapter.listProducts(creatorId) };
}

/** Resolves the FN price on the server; the browser never sends a price for catalog products. */
async function priceFor(platform: PlatformKey, creatorId: string, productId: unknown, customFn: unknown): Promise<{ product: PlatformProduct; amountFn: number } | "INVALID" | "UNAVAILABLE"> {
  const products = await adapterFor(platform).listProducts(creatorId);
  const product = products.find((p) => p.id === productId);
  if (!product) return "UNAVAILABLE";
  if (product.priceFn !== null) return { product, amountFn: product.priceFn };
  const bounds = product.custom;
  if (!bounds || typeof customFn !== "number" || !Number.isSafeInteger(customFn) || customFn < bounds.minFn || customFn > bounds.maxFn) return "INVALID";
  return { product, amountFn: customFn };
}

/** How long the platform gets to confirm a donation (sample value — the real limit is TBD). */
const SEND_TIMEOUT_MS = 10_000;

/**
 * Bounded platform call. A throw (connection reset …) or no answer in time may still have reached the
 * platform, so both map to TIMEOUT — the PENDING path — rather than a refusal that would refund.
 */
async function sendBounded(adapter: PlatformAdapter, req: Parameters<PlatformAdapter["sendDonation"]>[0]): Promise<SendResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      adapter.sendDonation(req),
      new Promise<SendResult>((resolve) => (timer = setTimeout(() => resolve({ ok: false, reason: "TIMEOUT" }), SEND_TIMEOUT_MS)))
    ]);
  } catch {
    return { ok: false, reason: "TIMEOUT" };
  } finally {
    clearTimeout(timer);
  }
}

/** Payment summary for the message step (817:9334 결제 정보). */
export async function quotePlatformDonation(input: unknown): Promise<PlatformQuote> {
  assertMock();
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (!isPlatform(v.platform) || !isId(v.creatorId)) return { status: "INVALID" };
  if (!(await adapterFor(v.platform).getCreator(v.creatorId))) return { status: "NOT_FOUND" };
  const price = await priceFor(v.platform, v.creatorId, v.productId, v.customFn);
  if (price === "INVALID") return { status: "INVALID" };
  if (price === "UNAVAILABLE") return { status: "UNAVAILABLE" };
  const balance = mockAccount.fnBalance;
  return { status: "OK", priceFn: price.amountFn, balance, afterFn: balance - price.amountFn, sufficient: balance >= price.amountFn, productLabel: price.product.label };
}

export async function requestPlatformDonation(input: unknown): Promise<PlatformDonationResult> {
  assertMock();
  const session = await getSession();
  if (!session) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (!isPlatform(v.platform) || !isId(v.creatorId) || typeof v.idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.idempotencyKey)) {
    return { status: "INVALID" };
  }
  const message = typeof v.message === "string" ? v.message.trim() : null;
  if (message === null || message.length > MESSAGE_MAX) return { status: "INVALID" };
  const platform = v.platform;
  const key = v.idempotencyKey;
  // The member's key, kept under the member: another member's key never answers or blocks this request.
  const requestKey = memberKeyOf(session.userId, key);

  const fingerprint = JSON.stringify([platform, v.creatorId, v.productId, v.customFn ?? null, message]);
  const previous = ownEntry(mockPlatform.idempotency, requestKey);
  if (previous) {
    if (previous.fingerprint !== fingerprint) return { status: "CONFLICT" };
    // 결과 다시 확인: a PENDING key asks the platform first (lazy re-check, ./pendingCore.ts); a result it brings is
    // written to this entry, so the answer below is read after the await.
    const waiting = previous.result?.status === "PENDING" ? previous.result.transactionId : null;
    if (waiting) await recheckPending((t) => t.transactionId === waiting);
    return previous.result ?? { status: "IN_PROGRESS" };
  }
  // Held by reference: a 재가입 during an await moves the entry to the withdrawn account's own id (account/rejoin.ts).
  const entry: { fingerprint: string; result: PlatformDonationResult | null } = (mockPlatform.idempotency[requestKey] = { fingerprint, result: null });
  const finish = (result: PlatformDonationResult) => {
    entry.result = result;
    return result;
  };

  const adapter = adapterFor(platform);
  let creator: PlatformCreator | null;
  let price: Awaited<ReturnType<typeof priceFor>>;
  try {
    creator = await adapter.getCreator(v.creatorId);
    price = creator ? await priceFor(platform, v.creatorId, v.productId, v.customFn) : "UNAVAILABLE";
  } catch {
    // Nothing is held yet: finish the key so a retry gets this answer instead of IN_PROGRESS forever.
    return finish({ status: "FAILED", reason: "API_ERROR" });
  }
  if (!creator) return finish({ status: "FAILED", reason: "NOT_FOUND" });
  if (price === "INVALID") return finish({ status: "INVALID" });
  if (price === "UNAVAILABLE") return finish({ status: "FAILED", reason: "UNAVAILABLE" });
  if (mockAccount.fnBalance < price.amountFn) return finish({ status: "INSUFFICIENT_FN", balance: mockAccount.fnBalance, required: price.amountFn });

  // Hold the FN first, then ask the platform; reverse the hold if it refuses (one transaction in the backend).
  const now = new Date();
  const transactionId = `TXN-${randomUUID().toUpperCase()}`;
  // The platform's own key for this donation, never the member's: a retry of the member's key reaches it under the same one.
  const platformKey = platformKeyFor(session.userId, key);
  mockAccount.fnBalance -= price.amountFn;
  const tx: MockPlatformTransaction = {
    transactionId,
    externalTransactionId: null,
    platform,
    creatorId: creator.id,
    creatorName: creator.nickname,
    productLabel: price.product.label,
    fnAmount: price.amountFn,
    message,
    status: "PROCESSING",
    failureReason: null,
    createdAt: `${toDateString(now)} ${now.toTimeString().slice(0, 5)}`,
    completedAt: null,
    account: accountSince(),
    requestedAt: now.toISOString(),
    requestKey,
    platformKey
  };
  mockPlatform.transactions.unshift(tx);

  await mockDelay(900);
  const sent = await sendBounded(adapter, { creatorId: creator.id, productId: price.product.id, amountFn: price.amountFn, message, idempotencyKey: platformKey });

  if (!sent.ok) {
    const reason = sent.reason;
    // Unknown outcome: the FN stays held and the tx PROCESSING until the result is known (./pendingCore.ts). The hold
    // gets its wallet record now (FN 후원내역 처리중).
    if (reason === "TIMEOUT") {
      tx.pending = { lastCheckAt: null };
      walletMirror(tx);
      return finish({ status: "PENDING", transactionId });
    }
    mockAccount.fnBalance += price.amountFn;
    tx.status = "FAILED";
    tx.failureReason = reason === "API_ERROR" ? `${PLATFORMS[platform].name} 연결 오류` : "후원상품 사용 불가";
    return finish({ status: "FAILED", reason });
  }

  const done = new Date();
  tx.status = "COMPLETED";
  tx.externalTransactionId = sent.externalTransactionId;
  tx.completedAt = `${toDateString(done)} ${done.toTimeString().slice(0, 5)}`;
  // Also show it in FN 후원내역 (632:4) so the wallet history stays complete. Dated at the hold (the request, when the FN
  // were debited) as a PENDING hold is, not at completion: the refund FIFO must see the FN leave when they did, before
  // anything credited while the platform answered. The 완료 time stays on the transaction (후원 내역).
  walletMirror(tx).status = "COMPLETED";
  return finish({
    status: "COMPLETED",
    transactionId,
    externalTransactionId: sent.externalTransactionId,
    creatorName: creator.nickname,
    productLabel: price.product.label,
    fnAmount: price.amountFn,
    balance: mockAccount.fnBalance
  });
}
