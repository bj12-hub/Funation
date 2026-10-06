"use server";

import { randomBytes } from "node:crypto";
import { toDateString } from "@/lib/period";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getSession } from "@/lib/session";
import { mockAccount } from "@/services/account/mockStore";
import { mockWallet } from "@/services/wallet/mockWalletStore";
import { adapterFor } from "./adapters";
import { mockPlatform } from "./mockPlatformStore";
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
 * double click never debits twice. If the platform rejects the donation the debit is reversed
 * ("FN은 차감되지 않았습니다."). TBD: FN ↔ platform-currency rate, fees, platform API capability and
 * auth, timeout/reconciliation of PENDING results, refunds, message moderation.
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
  const recentIds = [...new Set(mockPlatform.transactions.filter((t) => t.platform === platform).map((t) => t.creatorId))].slice(0, 4);
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
  if (!(await getSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (!isPlatform(v.platform) || !isId(v.creatorId) || typeof v.idempotencyKey !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.idempotencyKey)) {
    return { status: "INVALID" };
  }
  const message = typeof v.message === "string" ? v.message.trim() : null;
  if (message === null || message.length > MESSAGE_MAX) return { status: "INVALID" };
  const platform = v.platform;
  const key = v.idempotencyKey;

  const fingerprint = JSON.stringify([platform, v.creatorId, v.productId, v.customFn ?? null, message]);
  const previous = mockPlatform.idempotency[key];
  if (previous) {
    if (previous.fingerprint !== fingerprint) return { status: "CONFLICT" };
    return previous.result ?? { status: "IN_PROGRESS" };
  }
  mockPlatform.idempotency[key] = { fingerprint, result: null };
  const finish = (result: PlatformDonationResult) => {
    mockPlatform.idempotency[key].result = result;
    return result;
  };

  const adapter = adapterFor(platform);
  const creator = await adapter.getCreator(v.creatorId);
  if (!creator) return finish({ status: "FAILED", reason: "NOT_FOUND" });
  const price = await priceFor(platform, v.creatorId, v.productId, v.customFn);
  if (price === "INVALID") return finish({ status: "INVALID" });
  if (price === "UNAVAILABLE") return finish({ status: "FAILED", reason: "UNAVAILABLE" });
  if (mockAccount.fnBalance < price.amountFn) return finish({ status: "INSUFFICIENT_FN", balance: mockAccount.fnBalance, required: price.amountFn });

  // Hold the FN first, then ask the platform; reverse the hold if it refuses (one transaction in the backend).
  const now = new Date();
  const transactionId = `TXN-${now.getTime().toString(36).toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
  mockAccount.fnBalance -= price.amountFn;
  const tx = {
    transactionId,
    externalTransactionId: null as string | null,
    platform,
    creatorId: creator.id,
    creatorName: creator.nickname,
    productLabel: price.product.label,
    fnAmount: price.amountFn,
    message,
    status: "PROCESSING" as const,
    failureReason: null as string | null,
    createdAt: `${toDateString(now)} ${now.toTimeString().slice(0, 5)}`,
    completedAt: null as string | null
  };
  mockPlatform.transactions.unshift(tx);

  await mockDelay(900);
  const sent = await adapter.sendDonation({ creatorId: creator.id, productId: price.product.id, amountFn: price.amountFn, message, idempotencyKey: key });
  const record = mockPlatform.transactions.find((t) => t.transactionId === transactionId)!;

  if (!sent.ok) {
    const reason = sent.reason;
    if (reason === "TIMEOUT") return finish({ status: "PENDING", transactionId });
    mockAccount.fnBalance += price.amountFn;
    record.status = "FAILED";
    record.failureReason = reason === "API_ERROR" ? `${PLATFORMS[platform].name} 연결 오류` : "후원상품 사용 불가";
    return finish({ status: "FAILED", reason });
  }

  const done = new Date();
  record.status = "COMPLETED";
  record.externalTransactionId = sent.externalTransactionId;
  record.completedAt = `${toDateString(done)} ${done.toTimeString().slice(0, 5)}`;
  // Also show it in FN 후원내역 (632:4) so the wallet history stays complete.
  mockWallet.donations.unshift({
    id: transactionId,
    donatedAt: `${toDateString(done)} ${done.toTimeString().slice(0, 8)}`,
    creatorId: `${platform.toLowerCase()}:${creator.id}`,
    creatorName: creator.nickname,
    message: message || price.product.label,
    fnAmount: price.amountFn,
    typeLabel: `${PLATFORMS[platform].name} ${price.product.label}`,
    category: "basic",
    status: "COMPLETED"
  });
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
