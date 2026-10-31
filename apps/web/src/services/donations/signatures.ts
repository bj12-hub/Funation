"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { ownEntry } from "@/lib/records";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { newIntegrationKey } from "@/services/creator/mockCreatorStore";
import { isSignatureImage, isSignatureSound, mockSignatures, signatureMedia, signaturePage, signaturePagePath } from "./signatureCore";
import {
  DEFAULT_SIGNATURE_GROUP,
  SIGNATURE_IMAGE_PRESETS,
  SIGNATURE_LIMITS,
  amountConflict,
  spanText,
  type ManagedSignature,
  type SignatureBulkResult,
  type SignaturePageSettings,
  type SignatureResult,
  type SignatureRow
} from "./signatureTypes";

/**
 * 시그니처 관리 Server Actions — code-first. Route `/creator/widgets/signatures`. Creator only; every
 * value is validated here. New signatures carry a `requestId` so a double submit creates one.
 */

type Fields = Pick<ManagedSignature, "name" | "price" | "imageUrl" | "soundUrl">;

const isRequestId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9-]{16,64}$/.test(v);

/**
 * Name, price, image and sound of one signature, or what is wrong with them. `kept` is the signature being edited:
 * its own image or sound that has since been deleted from the library falls back (first preset image / no sound,
 * as the room and the alert already show it) instead of blocking every later save such as 숨기기.
 */
function readFields(v: Record<string, unknown>, kept?: ManagedSignature): Fields | string {
  // NFC, like library names (일괄 만들기 names come from them): an NFD copy of a name is the same name.
  const name = typeof v.name === "string" ? v.name.normalize("NFC").trim() : "";
  if (!name || name.length > SIGNATURE_LIMITS.nameMax) return `이름을 1~${SIGNATURE_LIMITS.nameMax}자로 입력해 주세요.`;
  if (MOCK_FORBIDDEN_WORDS.some((w) => name.toLowerCase().includes(w))) return "사용할 수 없는 단어가 포함되어 있어요.";
  const price = v.price;
  if (typeof price !== "number" || !Number.isInteger(price) || price < SIGNATURE_LIMITS.priceMin || price > SIGNATURE_LIMITS.priceMax) {
    return `가격은 ${SIGNATURE_LIMITS.priceMin.toLocaleString()} ~ ${SIGNATURE_LIMITS.priceMax.toLocaleString()} FN이에요.`;
  }
  if (typeof v.imageUrl !== "string") return "이미지를 골라 주세요.";
  const imageUrl = isSignatureImage(v.imageUrl) ? v.imageUrl : kept && v.imageUrl === kept.imageUrl ? SIGNATURE_IMAGE_PRESETS[0] : null;
  if (!imageUrl) return "이미지를 골라 주세요.";
  // Optional; older clients send nothing (= none).
  let soundUrl: string | null = null;
  if (v.soundUrl !== undefined && v.soundUrl !== null) {
    if (typeof v.soundUrl !== "string") return "소리는 라이브러리의 사운드만 고를 수 있어요.";
    if (isSignatureSound(v.soundUrl)) soundUrl = v.soundUrl;
    else if (!kept || v.soundUrl !== kept.soundUrl) return "소리는 라이브러리의 사운드만 고를 수 있어요.";
  }
  return { name, price, imageUrl, soundUrl };
}

const newSignatureId = (n: number) => `sig-${Date.now().toString(36)}-${n}`;

/** 그룹: blank = 기본 (older clients send none). */
function readGroup(v: unknown): string | { message: string } {
  const group = typeof v === "string" ? v.normalize("NFC").trim() : "";
  if (group.length > SIGNATURE_LIMITS.groupMax) return { message: `그룹 이름은 ${SIGNATURE_LIMITS.groupMax}자 이내로 입력해 주세요.` };
  return group || DEFAULT_SIGNATURE_GROUP;
}

/** 금액범위: only with 금액 일치; from the lowest price up to just under the price (null = the price only). */
function readRange(v: unknown, match: unknown, price: number): number | null | { message: string } {
  if (match !== "AMOUNT" || v === null || v === undefined || v === "") return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < SIGNATURE_LIMITS.priceMin || v >= price) {
    return { message: `금액범위는 ${SIGNATURE_LIMITS.priceMin.toLocaleString()} FN부터 가격보다 작은 금액까지예요.` };
  }
  return v;
}

/** The message for two 금액 일치 signatures that would share an amount, naming the other one. */
function conflictMessage(pair: [ManagedSignature, ManagedSignature], own: string | null) {
  const other = pair[0].id === own ? pair[1] : pair[0];
  return `금액 매칭이 '${other.name}'(${spanText(other)})와 겹쳐요. 가격이나 금액범위를 바꿔 주세요.`;
}

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Signature API is not connected yet.");
};

/** The list in order, each with where its media stands (미디어 누락, 2026-10-25). */
export async function listSignatures(): Promise<SignatureRow[] | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return structuredClone(mockSignatures.items).map((s) => ({ ...s, media: signatureMedia(s) }));
}

export async function saveSignature(input: unknown): Promise<SignatureResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const fields = readFields(v, typeof v.id === "string" ? mockSignatures.items.find((s) => s.id === v.id) : undefined);
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
    const done = ownEntry(mockSignatures.requests, v.requestId);
    if (done) return { status: "SAVED", id: done };
  }
  const existing = id ? items.find((s) => s.id === id) : undefined;
  if (id && !existing) return { status: "INVALID", message: "시그니처를 찾을 수 없어요." };
  if (items.some((s) => s.id !== id && s.name === name)) return { status: "INVALID", message: "같은 이름의 시그니처가 있어요." };
  const rangeMin = readRange(v.rangeMin, v.match, price);
  if (rangeMin !== null && typeof rangeMin === "object") return { status: "INVALID", message: rangeMin.message };
  const group = readGroup(v.group);
  if (typeof group === "object") return { status: "INVALID", message: group.message };
  const next = { ...fields, match: v.match, active: v.active, rangeMin, group } as const;
  // Two 금액 일치 signatures taking one amount would be ambiguous (금액범위 included, 2026-10-23).
  const ownId = existing?.id ?? "(new)";
  const pair = amountConflict([...items.filter((s) => s.id !== ownId), { id: ownId, ...next }]);
  if (pair) return { status: "INVALID", message: conflictMessage(pair, ownId) };
  if (existing) {
    Object.assign(existing, next);
    return { status: "SAVED", id: existing.id };
  }
  if (items.length >= SIGNATURE_LIMITS.max) return { status: "INVALID", message: `시그니처는 ${SIGNATURE_LIMITS.max}개까지 만들 수 있어요.` };
  const newId = newSignatureId(items.length);
  items.push({ id: newId, ...next, createdAt: new Date().toISOString() });
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
  const done = ownEntry(bulk, v.requestId);
  if (done) return { status: "SAVED", ids: [...done] };
  if (v.match !== "SELECT" && v.match !== "AMOUNT") return { status: "INVALID", message: "매칭 규칙을 확인해 주세요." };
  if (typeof v.active !== "boolean") return { status: "INVALID", message: "사용 여부를 확인해 주세요." };
  const items = mockSignatures.items;
  const room = SIGNATURE_LIMITS.max - items.length;
  if (!Array.isArray(v.rows) || v.rows.length === 0) return { status: "INVALID", message: "만들 시그니처를 골라 주세요." };
  if (v.rows.length > room) return { status: "INVALID", message: `시그니처는 ${SIGNATURE_LIMITS.max}개까지 만들 수 있어요. 지금은 ${Math.max(0, room)}개 더 만들 수 있어요.` };

  const group = readGroup(v.group);
  if (typeof group === "object") return { status: "INVALID", message: group.message };
  const match = v.match;
  const active = v.active;
  const rows: Fields[] = [];
  const asSignature = (r: Fields, k: number): ManagedSignature => ({ id: `(row ${k})`, ...r, match, active, rangeMin: null, group });
  for (const [i, raw] of v.rows.entries()) {
    const fields = readFields(typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {});
    if (typeof fields === "string") return { status: "INVALID", message: fields, row: i };
    if (items.some((s) => s.name === fields.name) || rows.some((r) => r.name === fields.name)) return { status: "INVALID", message: "같은 이름의 시그니처가 있어요.", row: i };
    // Created rows take their price only (no 금액범위): a clash is another signature's price or range, or a row's price.
    const pair = amountConflict([...items, ...rows.map(asSignature), asSignature(fields, i)]);
    if (pair) return { status: "INVALID", message: conflictMessage(pair, `(row ${i})`), row: i };
    rows.push(fields);
  }

  // No await between the checks and the write, so a double submit cannot pass the checks twice.
  const createdAt = new Date().toISOString();
  const created = rows.map((r, i): ManagedSignature => ({ ...asSignature(r, i), id: newSignatureId(items.length + i), createdAt }));
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

/**
 * 선택 삭제 (2026-10-28, StreamDonate 시그니처 관리 "전체 선택 · 전체 삭제"): every signature in `ids` at once; ids no longer
 * there are skipped (a retry deletes nothing more). Answers how many went.
 */
export async function deleteSignatures(input: unknown): Promise<SignatureResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (!Array.isArray(v.ids) || v.ids.length === 0 || v.ids.length > SIGNATURE_LIMITS.max || v.ids.some((id) => typeof id !== "string")) {
    return { status: "INVALID", message: "삭제할 시그니처를 골라 주세요." };
  }
  const ids = new Set(v.ids as string[]);
  const items = mockSignatures.items;
  let removed = 0;
  for (let i = items.length - 1; i >= 0; i--) {
    if (ids.has(items[i].id)) {
      items.splice(i, 1);
      removed += 1;
    }
  }
  return { status: "SAVED", id: String(removed) };
}

/**
 * 그룹 보이기 · 숨기기 (2026-10-23): every signature of the group at once. Showing a group is refused when it would put two
 * 금액 일치 signatures on one amount (the message names them). Setting the same value again is a no-op.
 */
export async function setSignatureGroupActive(input: unknown): Promise<SignatureResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof v.active !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
  const items = mockSignatures.items;
  const group = typeof v.group === "string" ? v.group.normalize("NFC").trim() : "";
  if (!items.some((s) => s.group === group)) return { status: "INVALID", message: "그룹을 찾을 수 없어요." };
  const active = v.active;
  const pair = amountConflict(items.map((s) => (s.group === group ? { ...s, active } : s)));
  if (pair) return { status: "INVALID", message: `'${pair[0].name}'(${spanText(pair[0])})와 '${pair[1].name}'(${spanText(pair[1])})의 금액 매칭이 겹쳐서 켤 수 없어요.` };
  for (const s of items) if (s.group === group) s.active = active;
  return { status: "SAVED", id: group };
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

// ── 공개 시그니처 페이지 (2026-10-25, StreamDonate 참고) ─────────────────────────────────────────

/** The page's on/off and address (the studio shows the key masked, like the other links). */
export async function getSignaturePage(): Promise<SignaturePageSettings | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  const page = signaturePage();
  return { enabled: page.enabled, path: signaturePagePath(page.key) };
}

/** Turns the public page on or off (the address stays). Setting the same value again is a no-op. */
export async function setSignaturePageEnabled(input: unknown): Promise<SignatureResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const enabled = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  if (typeof enabled.enabled !== "boolean") return { status: "INVALID", message: "설정을 확인해 주세요." };
  signaturePage().enabled = enabled.enabled;
  return { status: "SAVED", id: "public-page" };
}

/** 주소 재발급: a new key — the old address stops at once; on/off stays. */
export async function reissueSignaturePageKey(): Promise<SignatureResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  signaturePage().key = newIntegrationKey();
  return { status: "SAVED", id: "public-page" };
}
