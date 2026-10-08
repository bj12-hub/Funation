"use server";

import { USE_MOCK, mockDelay } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import type { UpdatePost, UpdatesView } from "./updatesTypes";

/**
 * 업데이트 소식 Server Actions — code-first. Route `/creator/updates` + 대시보드 "업데이트 소식" card.
 * Posts are static mock content until a CMS/admin editor exists (TBD). "Unread" is tracked per
 * user on the server: opening the page marks every post read.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Updates API is not connected yet.");
};

const POSTS: UpdatePost[] = [
  {
    id: "up-3",
    date: "2026-09-29",
    title: "방송 리모컨 · 크루 방송 운영 업데이트",
    summary: "리모컨과 후원 알림 오버레이, 크루 방송 후원 리스트 · 한방, 오버레이 주소 모음이 추가됐어요.",
    items: [
      { kind: "NEW", text: "리모컨: 알림 일시정지 · 음소거 · 건너뛰기 · 테스트 후원", href: "/creator/remote" },
      { kind: "NEW", text: "후원 알림 OBS 오버레이", href: "/creator/widgets/overlays" },
      { kind: "NEW", text: "방송 도구: 자막 · 전광판 · 타이머 · 엔딩 크레딧", href: "/creator/widgets/tools" },
      { kind: "NEW", text: "크루 방송 후원 리스트(키워드 자동 배정) · 한방 · 프로젝트 회차", href: "/creator/crew/broadcast" },
      { kind: "NEW", text: "오버레이 주소 모음", href: "/creator/widgets/overlays" },
      { kind: "NEW", text: "후원 리스트 CSV 다운로드", href: "/creator/donations?tab=list" },
      { kind: "IMPROVED", text: "서비스 이름이 썸네이션(Somnation)으로 바뀌었어요" },
      { kind: "FIX", text: "크루 방송 진행 시계가 처음 열 때 잘못 표시되던 문제" },
      { kind: "FIX", text: "좁은 화면에서 상단 메뉴가 넘치던 문제" }
    ]
  },
  {
    id: "up-2",
    date: "2026-09-29",
    title: "크루 · 커뮤니티 · 이벤트 업데이트",
    summary: "크루 멤버 관리와 점수판, 쪽지 · 커뮤니티 · 이벤트, 후원자 칭호와 내 랭킹이 추가됐어요.",
    items: [
      { kind: "NEW", text: "크루 멤버 관리와 멤버 지정 후원", href: "/creator/crew" },
      { kind: "NEW", text: "크루 방송 점수판 · 보정 · OBS 점수판", href: "/creator/crew/broadcast" },
      { kind: "NEW", text: "내 채널 만들기(크리에이터 권한)", href: "/channel/new" },
      { kind: "NEW", text: "쪽지 · 커뮤니티 · 이벤트" },
      { kind: "NEW", text: "후원자 별명 · 등급 · 칭호, 내 후원 랭킹" },
      { kind: "IMPROVED", text: "정산 준비 체크리스트", href: "/creator/settlement" }
    ]
  },
  {
    id: "up-1",
    date: "2026-09-29",
    title: "정산 · 플랫폼 후원 오픈",
    summary: "정산 등록 · 신청 · 관리와 SOOP · FlexTV 후원, FN Wallet이 열렸어요.",
    items: [
      { kind: "NEW", text: "정산 등록 · 신청 · 관리", href: "/creator/settlement" },
      { kind: "NEW", text: "SOOP · FlexTV 후원과 플랫폼 후원 내역" },
      { kind: "NEW", text: "FN Wallet, 충전 환불 요청" },
      { kind: "NEW", text: "후원관리+: 페이지 설정 · 리스트 · 순위 · 필터링 · 칭호", href: "/creator/donations" },
      { kind: "FIX", text: "후원 리스트 시간이 두 줄로 나뉘던 문제" }
    ]
  }
];

const g = globalThis as typeof globalThis & { __funationMockUpdatesV1?: { readIds: string[] } };
const store = (g.__funationMockUpdatesV1 ??= { readIds: [] });

function view(limit?: number): UpdatesView {
  const posts = POSTS.map((p) => ({ ...p, items: [...p.items], unread: !store.readIds.includes(p.id) }));
  return { posts: limit ? posts.slice(0, limit) : posts, unreadCount: posts.filter((p) => p.unread).length };
}

export async function getUpdates(): Promise<UpdatesView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  await mockDelay(100);
  return view();
}

/** Dashboard card: the latest posts (read state unchanged). */
export async function getLatestUpdates(limit = 3): Promise<UpdatesView | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return view(Math.min(Math.max(1, Math.floor(limit) || 3), 10));
}

/** Idempotent: marks every current post read. */
export async function markUpdatesRead(): Promise<{ status: "SAVED" } | { status: "UNAUTHORIZED" }> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  store.readIds = POSTS.map((p) => p.id);
  return { status: "SAVED" };
}
