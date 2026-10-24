import { overlayLines } from "@/services/broadcast/chatCore";
import { readWidget } from "./widgetStore";
import { advance, mockAlerts } from "./alertCore";
import { CUSTOM_CHAT_HISTORY, CUSTOM_CODE_MAX, CUSTOM_NAME_MAX, CUSTOM_SLOTS, emptySlot, type CustomChat, type CustomDonation, type CustomSlot } from "./customOverlayTypes";

/**
 * 커스텀 오버레이 (server-only) — code-first. The creator's slots (stored as written: the code only ever runs in the
 * sandboxed frame, never on the site), and the public feed a custom overlay reads.
 */

type CustomStore = { slots: CustomSlot[] };
const g = globalThis as typeof globalThis & { __ssumnationMockCustomOverlayV1?: CustomStore };
export const customStore = (): CustomStore => (g.__ssumnationMockCustomOverlayV1 ??= { slots: Array.from({ length: CUSTOM_SLOTS }, (_, i) => emptySlot(i + 1)) });

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

/** A slot as saved from the studio, checked. */
export function parseCustomSlot(input: unknown, forbidden: string[]): { no: number; slot: CustomSlot } | { message: string } {
  const v = rec(input);
  const no = v.no;
  if (typeof no !== "number" || !Number.isInteger(no) || no < 1 || no > CUSTOM_SLOTS) return { message: "잘못된 요청입니다." };
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!name || name.length > CUSTOM_NAME_MAX) return { message: `이름은 1~${CUSTOM_NAME_MAX}자로 입력해 주세요.` };
  if (forbidden.some((w) => name.toLowerCase().includes(w))) return { message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (typeof v.enabled !== "boolean") return { message: "설정을 확인해 주세요." };
  const code: Record<"html" | "css" | "js", string> = { html: "", css: "", js: "" };
  for (const [key, label] of [
    ["html", "HTML은"],
    ["css", "CSS는"],
    ["js", "JS는"]
  ] as const) {
    const text = v[key];
    if (typeof text !== "string") return { message: "설정을 확인해 주세요." };
    if (text.length > CUSTOM_CODE_MAX) return { message: `${label} ${CUSTOM_CODE_MAX.toLocaleString("ko-KR")}자까지 넣을 수 있어요.` };
    code[key] = text;
  }
  return { no, slot: { name, enabled: v.enabled, ...code } };
}

/** The donation alert showing now, as a custom overlay gets it (null when none). */
export function showingDonation(now = Date.now()): CustomDonation | null {
  advance(now);
  const a = mockAlerts.items.find((x) => x.status === "SHOWING");
  if (!a || mockAlerts.shownAt === null) return null;
  return {
    id: a.id,
    kind: a.kind,
    nickname: a.donor,
    message: a.message,
    amount: a.kind === "EXTERNAL" ? 0 : a.fnAmount,
    amountLabel: a.amountLabel ?? `${a.fnAmount.toLocaleString("ko-KR")} FN`,
    typeLabel: a.typeLabel,
    platform: a.platform ?? null,
    imageUrl: a.imageUrl ?? null,
    endsAt: new Date(mockAlerts.shownAt + mockAlerts.controls.displaySec * 1000).toISOString()
  };
}

/** The latest 통합 채팅 lines, oldest first, without the 필터링 닉네임 (as on the chat overlay). */
export function customChat(): CustomChat[] {
  const blocked = new Set(readWidget("CHAT").filteredNicknames.map((n) => n.trim().toLowerCase()));
  return overlayLines(CUSTOM_CHAT_HISTORY, (name) => !blocked.has(name.trim().toLowerCase())).map((l) => ({ id: l.id, platform: l.platform, nickname: l.name, text: l.text, at: l.at }));
}
