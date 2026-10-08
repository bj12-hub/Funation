"use server";

import { randomUUID } from "node:crypto";
import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { bankSmsStore, receiveBankSms, shownName } from "./bankSmsCore";
import { BANK_SMS_LIMITS, type BankSmsResult, type BankSmsView } from "./bankSmsTypes";

/**
 * SMS 계좌후원 studio actions — code-first mock (2026-10-06 결정), on `/creator/widgets/link`. Creator only.
 * The webhook itself is `POST /api/bank-sms/[key]`.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Bank SMS API is not connected yet.");
};

export async function getBankSms(): Promise<BankSmsView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  const s = bankSmsStore();
  return {
    enabled: s.enabled,
    maskNames: s.maskNames,
    hookPath: `/api/bank-sms/${s.key}`,
    ...s.stats,
    recent: s.recent.map((d) => ({ ...d, depositor: shownName(s, d.depositor) }))
  };
}

/** 사용 · 입금자명 가리기. Turning it on does not replay anything sent while it was off. */
export async function setBankSms(input: unknown): Promise<BankSmsResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const flags = [v.enabled, v.maskNames];
  if (flags.every((f) => f === undefined) || flags.some((f) => f !== undefined && typeof f !== "boolean")) return { status: "INVALID", message: "잘못된 요청입니다." };
  const s = bankSmsStore();
  if (typeof v.enabled === "boolean") s.enabled = v.enabled;
  if (typeof v.maskNames === "boolean") s.maskNames = v.maskNames;
  return { status: "SAVED" };
}

/** 주소 재발급: the old address stops working at once (e.g. after it leaked). */
export async function reissueBankSmsKey(): Promise<BankSmsResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  bankSmsStore().key = randomUUID();
  return { status: "SAVED" };
}

/** 테스트 문자: runs a pasted SMS through the same steps as the webhook (the request id dedupes a double click). */
export async function simulateBankSms(input: unknown): Promise<BankSmsResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const text = typeof v.text === "string" ? v.text.trim() : "";
  if (!text || text.length > BANK_SMS_LIMITS.textMax) return { status: "INVALID", message: `문자 내용을 1~${BANK_SMS_LIMITS.textMax}자로 붙여 넣어 주세요.` };
  await mockDelay(150);
  return receiveBankSms(text, `test-${v.requestId}`);
}
