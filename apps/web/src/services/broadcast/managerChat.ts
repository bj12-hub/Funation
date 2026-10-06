"use server";

import { randomUUID } from "node:crypto";
import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { creatorAccessOpen } from "@/services/account/creatorAccess";
import { MOCK_FORBIDDEN_WORDS } from "@/services/account/mockStore";
import { banAction, chatView, deleteAction, hideAction, ingestChat, managerLinkByToken, managerLinks, newManagerToken, sendAction, type StoredManagerLink } from "./chatCore";
import {
  MANAGER_LINKS_MAX,
  MANAGER_NAME_MAX,
  isManagerPermission,
  type ChatActionResult,
  type ChatSendResult,
  type ManagerChatView,
  type ManagerPermission
} from "./chatTypes";

/**
 * 매니저 채팅창 링크 Server Actions — code-first. The creator makes a link per manager and picks what it
 * may do (보기 always; 숨김 · 삭제 · 차단 · 통합 입력 optional). Whoever has the link can use it without
 * logging in, so it carries a 192-bit random token; deleting the link stops it at once, and the 관리 기록
 * names the manager. Page: `/popout/chat/m/[token]`. TBD: expiry, manager accounts, per-manager audit export.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Manager chat API is not connected yet.");
};
const obj = (v: unknown) => (typeof v === "object" && v !== null ? v : {}) as Record<string, unknown>;
const forbidden: ChatActionResult = { status: "UNAUTHORIZED" };

function parsePermissions(v: unknown): ManagerPermission[] | null {
  if (!Array.isArray(v) || !v.every(isManagerPermission)) return null;
  return [...new Set(v)];
}

// ── Creator (studio) ─────────────────────────────────────────────────────────────

export async function createManagerLink(input: unknown): Promise<ChatActionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = obj(input);
  if (typeof v.requestId !== "string" || !/^[A-Za-z0-9-]{16,64}$/.test(v.requestId)) return { status: "INVALID", message: "잘못된 요청입니다." };
  const links = managerLinks();
  if (links.some((l) => l.requestId === v.requestId)) return { status: "OK" };
  if (links.length >= MANAGER_LINKS_MAX) return { status: "INVALID", message: `매니저 링크는 ${MANAGER_LINKS_MAX}개까지 만들 수 있어요.` };
  const name = typeof v.name === "string" ? v.name.trim() : "";
  if (!name || name.length > MANAGER_NAME_MAX) return { status: "INVALID", message: `매니저 이름을 1~${MANAGER_NAME_MAX}자로 입력해 주세요.` };
  if (MOCK_FORBIDDEN_WORDS.some((w) => name.toLowerCase().includes(w))) return { status: "INVALID", message: "사용할 수 없는 단어가 포함되어 있어요." };
  if (links.some((l) => l.name === name)) return { status: "INVALID", message: "같은 이름의 매니저 링크가 있어요." };
  const permissions = parsePermissions(v.permissions);
  if (!permissions) return { status: "INVALID", message: "권한을 확인해 주세요." };
  links.push({ id: randomUUID(), name, token: newManagerToken(), permissions, createdAt: new Date().toISOString(), lastUsedAt: null, requestId: v.requestId });
  return { status: "OK" };
}

/** 권한 바꾸기: applies to the open manager page on its next read. */
export async function setManagerLinkPermissions(input: unknown): Promise<ChatActionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = obj(input);
  const link = managerLinks().find((l) => l.id === v.id);
  if (!link) return { status: "INVALID", message: "매니저 링크를 찾을 수 없어요." };
  const permissions = parsePermissions(v.permissions);
  if (!permissions) return { status: "INVALID", message: "권한을 확인해 주세요." };
  link.permissions = permissions;
  return { status: "OK" };
}

/** 링크 삭제: the link stops working at once. Deleting twice is fine. */
export async function deleteManagerLink(input: unknown): Promise<ChatActionResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const links = managerLinks();
  const i = links.findIndex((l) => l.id === obj(input).id);
  if (i >= 0) links.splice(i, 1);
  return { status: "OK" };
}

// ── Manager page (token, no login) ──────────────────────────────────────────────

const linkWith = (token: unknown, permission?: ManagerPermission): StoredManagerLink | null => {
  // A link acts as the channel, so it stops while the creator is suspended or after they withdraw.
  if (!creatorAccessOpen()) return null;
  const link = managerLinkByToken(token);
  if (!link || (permission && !link.permissions.includes(permission))) return null;
  return link;
};

export async function getManagerChat(token: unknown): Promise<ManagerChatView | "FORBIDDEN"> {
  assertMock();
  const link = linkWith(token);
  if (!link) return "FORBIDDEN";
  link.lastUsedAt = new Date().toISOString();
  await ingestChat();
  const { platforms, messages } = chatView();
  return { name: link.name, permissions: [...link.permissions], platforms, messages };
}

export async function managerHideMessage(token: unknown, input: unknown): Promise<ChatActionResult> {
  assertMock();
  const link = linkWith(token, "HIDE");
  return link ? hideAction(input, link.name) : forbidden;
}

export async function managerDeleteMessage(token: unknown, input: unknown): Promise<ChatActionResult> {
  assertMock();
  const link = linkWith(token, "MODERATE");
  return link ? deleteAction(input, link.name) : forbidden;
}

export async function managerBanAuthor(token: unknown, input: unknown): Promise<ChatActionResult> {
  assertMock();
  const link = linkWith(token, "MODERATE");
  return link ? banAction(input, link.name) : forbidden;
}

export async function managerSendChat(token: unknown, input: unknown): Promise<ChatSendResult> {
  assertMock();
  return linkWith(token, "SEND") ? sendAction(input) : { status: "UNAUTHORIZED" };
}
