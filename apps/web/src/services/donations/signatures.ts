"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { isSignatureImage, isSignatureSound, mockSignatures } from "./signatureCore";
import { SIGNATURE_LIMITS, type ManagedSignature, type SignatureBulkResult, type SignatureResult } from "./signatureTypes";

/**
 * 시그니처 관리 Server Actions — code-first. Route `/creator/widgets/signatures`. Creator only; every
 * value is validated here. New signatures carry a `requestId` so a double submit creates one.
 */

type Fields = Pick<ManagedSignature, "name" | "price" | "imageUrl" | "soundUrl">;

const isRequestId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);

/** Name, price, image and sound of one signature, or what is wrong with them. */
function readFields(v: Record<string, unknown>): Fields | string {
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!name || name.length > SIGNATURE_LIMITS.nameMax) return `이름을 1~${SIGNATURE_LIMITS.nameMax}자로 입력해 주세요.`;
  if (MOCK_FORBIDDEN_WORDS.some((w) => name.toLowerCase().includes(w))) return "사용할 수 없는 단어가 포함되어 있어요.";
  const price = v.price;
  if (typeof price !== "number" || !Number.isInteger(price) || price < SIGNATURE_LIMITS.priceMin || price > SIGNATURE_LIMITS.priceMax) {
    return `가격은 ${SIGNATURE_LIMITS.priceMin.toLocaleString()} ~ ${SIGNATURE_LIMITS.priceMax.toLocaleString()} FN이에요.`;
  }
  if (typeof v.imageUrl !== "string" || !isSignatureImage(v.imageUrl)) return "이미지를 골라 주세요.";
  // Optional; older clients send nothing (= none).
  let soundUrl: string | null = null;
  if (v.soundUrl !== undefined && v.soundUrl !== null) {
    if (typeof v.soundUrl !== "string" || !isSignatureSound(v.soundUrl)) return "소리는 라이브러리의 사운드만 고를 수 있어요.";
    soundUrl = v.soundUrl;
  }
  return { name, price, imageUrl: v.imageUrl, soundUrl };
}

const newSignatureId = (n: number) => `sig-${Date.now().toString(36)}-${n}`;

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Signature API is not connected yet.");
};

export async function listSignatures(): Promise<ManagedSignature[] | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return structuredClone(mockSignatures.items);
}

export async function saveSignature(input: unknown): Promise<SignatureResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const fields = readFields(v);
  if (typeof fields === "string") return { status: "INVALID", message: fields };
  const { name, price } = fields;
  // Before the checks: a double submit must not pass them twice while the first one waits.
  await mockDelay(150);
  if (v.match !== "SELECT" && v.match !== "AMOUNT") return { status: "INVALID", message: "매칭 규칙을 확인해 주세요." };
  if (typeof v.active !== "boolean") return { status: "INVALID", message: "사용 여부를 확인해 주세요." };

  const items = mockSignatures.items;
  const id = typeof v.id === "string" ? v.id : null;
  if (!id) {
    if (!isRequestId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
    const done = mockSignatures.requests[v.requestId];
    if (done) return { status: "SAVED", id: done };
  }
  const existing = id ? items.find((s) => s.id === id) : undefined;
  if (id && !existing) return { status: "INVALID", message: "시그니처를 찾을 수 없어요." };
  if (items.some((s) => s.id !== id && s.name === name)) return { status: "INVALID", message: "같은 이름의 시그니처가 있어요." };
  // Two AMOUNT matches on one price would be ambiguous.
  if (v.match === "AMOUNT" && v.active && items.some((s) => s.id !== id && s.active && s.match === "AMOUNT" && s.price === price)) {
    return { status: "INVALID", message: "같은 가격으로 금액 매칭 중인 시그니처가 있어요." };
  }
  const next = { ...fields, match: v.match, active: v.active } as const;
  if (existing) {
    Object.assign(existing, next);
    return { status: "SAVED", id: existing.id };
  }
  if (items.length >= SIGNATURE_LIMITS.max) return { status: "INVALID", message: `시그니처는 ${SIGNATURE_LIMITS.max}개까지 만들 수 있어요.` };
  const newId = newSignatureId(items.length);
  items.push({ id: newId, ...next });
  mockSignatures.requests[v.requestId as string] = newId;
  return { status: "SAVED", id: newId };
}

/**
 * 시그니처 일괄 만들기 (funnation "시그니처 일괄 생성", code-first 2026-10-06): `rows` (name · price · image · sound,
 * usually one per library image) share one 매칭 규칙 and 표시 setting. Every row is checked first — names unique,
 * one AMOUNT match per price — and then all are added at the end of the list, or none. A repeated `requestId`
 * returns the first result.
 */
export async function createSignatures(input: unknown): Promise<SignatureBulkResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (!isRequestId(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  await mockDelay(150);
  const bulk = (mockSignatures.bulk ??= {});
  const done = bulk[v.requestId];
  if (done) return { status: "SAVED", ids: [...done] };
  if (v.match !== "SELECT" && v.match !== "AMOUNT") return { status: "INVALID", message: "매칭 규칙을 확인해 주세요." };
  if (typeof v.active !== "boolean") return { status: "INVALID", message: "사용 여부를 확인해 주세요." };
  const items = mockSignatures.items;
  const room = SIGNATURE_LIMITS.max - items.length;
  if (!Array.isArray(v.rows) || v.rows.length === 0) return { status: "INVALID", message: "만들 시그니처를 골라 주세요." };
  if (v.rows.length > room) return { status: "INVALID", message: `시그니처는 ${SIGNATURE_LIMITS.max}개까지 만들 수 있어요. 지금은 ${Math.max(0, room)}개 더 만들 수 있어요.` };

  const amountMatched = v.match === "AMOUNT" && v.active;
  const rows: Fields[] = [];
  for (const [i, raw] of v.rows.entries()) {
    const fields = readFields(typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {});
    if (typeof fields === "string") return { status: "INVALID", message: fields, row: i };
    if (items.some((s) => s.name === fields.name) || rows.some((r) => r.name === fields.name)) return { status: "INVALID", message: "같은 이름의 시그니처가 있어요.", row: i };
    if (amountMatched && (items.some((s) => s.active && s.match === "AMOUNT" && s.price === fields.price) || rows.some((r) => r.price === fields.price))) {
      return { status: "INVALID", message: "같은 가격으로 금액 매칭 중인 시그니처가 있어요.", row: i };
    }
    rows.push(fields);
  }

  // No await between the checks and the write, so a double submit cannot pass the checks twice.
  const match = v.match;
  const active = v.active;
  const created = rows.map((r, i): ManagedSignature => ({ id: newSignatureId(items.length + i), ...r, match, active }));
  items.push(...created);
  const ids = created.map((s) => s.id);
  bulk[v.requestId] = ids;
  return { status: "SAVED", ids: [...ids] };
}

export async function deleteSignature(id: unknown): Promise<SignatureResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const i = mockSignatures.items.findIndex((s) => s.id === id);
  if (i >= 0) mockSignatures.items.splice(i, 1);
  return { status: "SAVED", id: String(id) };
}

/** Moves a signature one step up or down (the panel shows them in this order). */
export async function moveSignature(input: unknown): Promise<SignatureResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const items = mockSignatures.items;
  const i = items.findIndex((s) => s.id === v.id);
  const j = v.dir === "up" ? i - 1 : v.dir === "down" ? i + 1 : -1;
  if (i < 0 || j < 0 || j >= items.length) return { status: "INVALID", message: "더 이상 옮길 수 없어요." };
  [items[i], items[j]] = [items[j], items[i]];
  return { status: "SAVED", id: String(v.id) };
}
