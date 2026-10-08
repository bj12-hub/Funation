import { USE_MOCK, mockDelay } from "@/lib/mock";
import type { Notice } from "./supportTypes";

/**
 * 공지사항 (funnation 고객센터 공지 structure). Seeded with our own copy; operators edit it in the admin
 * console (`/admin/content`). Views are sample numbers.
 */
const g = globalThis as typeof globalThis & { __ssumnationMockNoticesV1?: { items: Notice[] } };
/** Server-only store shared with services/admin/content.ts. */
export const noticeStore = () => (g.__ssumnationMockNoticesV1 ??= { items: structuredClone(SEED_NOTICES) });

export async function getNotices(): Promise<Notice[]> {
  if (!USE_MOCK) throw new Error("Support API is not connected yet.");
  await mockDelay(150);
  return [...noticeStore().items].sort((a, b) => Number(b.important) - Number(a.important) || b.date.localeCompare(a.date));
}

export async function getNotice(id: string): Promise<Notice | null> {
  if (!USE_MOCK) throw new Error("Support API is not connected yet.");
  await mockDelay(100);
  return noticeStore().items.find((n) => n.id === id) ?? null;
}

const SEED_NOTICES: Notice[] = [
  {
    id: "brand",
    category: "GENERAL",
    important: true,
    title: "서비스 이름이 썸네이션(Ssumnation)으로 바뀌었어요",
    summary: "서비스 이름과 로고 표기가 썸네이션으로 바뀌었습니다. 계정과 후원 내역은 그대로 이용할 수 있어요.",
    body: ["서비스 이름과 로고 표기가 썸네이션(Ssumnation)으로 바뀌었습니다.", "계정, FN, 후원 내역, 크리에이터 채널은 모두 그대로 이용할 수 있어요."],
    date: "2026-09-29",
    views: 128
  },
  {
    id: "layout",
    category: "UPDATE",
    important: false,
    title: "메뉴 구성과 홈 화면이 새로워졌어요",
    summary: "모든 페이지에 사이드 메뉴가 생기고, 홈 · 크리에이터 찾기 · 전체 방송 화면이 바뀌었습니다.",
    body: [
      "모든 페이지에서 왼쪽 사이드 메뉴로 이동할 수 있어요. 휴대폰에서는 아래 탭과 ☰ 메뉴를 이용해 주세요.",
      "홈은 인기 크리에이터 · 전체 방송 · 인기 라이브 영상 순서로, 크리에이터 찾기는 인기순 · 라이브 · 최신순으로 볼 수 있어요."
    ],
    date: "2026-09-30",
    views: 64
  },
  {
    id: "theme",
    category: "UPDATE",
    important: false,
    title: "라이트 모드를 지원해요",
    summary: "상단의 ☀️ / 🌙 버튼으로 밝은 화면과 어두운 화면을 바꿀 수 있어요.",
    body: ["상단의 ☀️ / 🌙 버튼으로 라이트 · 다크 모드를 바꿀 수 있어요.", "크리에이터 스튜디오와 방송 오버레이는 어두운 화면으로 유지돼요."],
    date: "2026-09-30",
    views: 41
  },
  {
    id: "platform",
    category: "GENERAL",
    important: false,
    title: "SOOP · FlexTV 크리에이터 후원 안내",
    summary: "플랫폼 후원 메뉴에서 SOOP · FlexTV 크리에이터를 찾아 FN으로 후원할 수 있어요.",
    body: ["사이드 메뉴의 ‘플랫폼 후원’에서 SOOP · FlexTV 크리에이터를 검색해 후원할 수 있어요.", "플랫폼 후원 내역은 ‘플랫폼 후원 내역’에서 확인할 수 있어요."],
    date: "2026-09-28",
    views: 93
  }
];
