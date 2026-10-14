/**
 * Ssumnation 도우미 menu — code-first (no Figma frame), 2026-10-14 결정. Layout follows the legacy FlexTV 도우미
 * (docs/research/flextv-livehelper.md): a left menu of feature pages, and the 리모컨 as a separate button at the
 * bottom. Only the creator's OBS (방송 화면) features and the 리모컨 are here; the rest of the studio stays on the site.
 * Paths are the helper domain's own (`/chat` is served from `app/helper/chat`).
 */
export const HELPER_BRAND = { name: "Ssumnation", product: "도우미" } as const;
export const HELPER_TITLE = `${HELPER_BRAND.name} ${HELPER_BRAND.product}`;

export type HelperNavItem = { label: string; emoji: string; href: string; description: string };
export type HelperNavGroup = { title: string | null; items: HelperNavItem[] };

export const HELPER_HOME: HelperNavItem = { label: "시작하기", emoji: "🏠", href: "/", description: "OBS 연결 순서와 도우미 기능을 한눈에 봐요." };

export const HELPER_NAV: HelperNavGroup[] = [
  { title: null, items: [HELPER_HOME] },
  {
    // Legacy FlexTV 도우미 order: 채팅창 · 알림 · 목표치 · 후원자막 · 시계.
    title: "방송 화면",
    items: [
      { label: "후원 알림", emoji: "🔔", href: "/alert", description: "후원 알림의 모양 · 문구 · 소리와 미니 후원 알림을 꾸며요." },
      { label: "채팅창", emoji: "💬", href: "/chat", description: "방송 화면에 띄우는 채팅창의 스타일을 정해요." },
      { label: "통합 채팅", emoji: "🗨️", href: "/chat/manage", description: "유튜브 · FlexTV · SOOP · 치지직 채팅을 한곳에서 보고 답하고 관리해요." },
      { label: "목표치", emoji: "🎯", href: "/goal", description: "후원 목표 금액과 진행 모양을 정해요." },
      { label: "후원 자막", emoji: "🏆", href: "/subtitles", description: "후원 랭킹 · 누적 금액 · 최근 후원 · 이벤트 목록을 띄워요." },
      { label: "시계", emoji: "🕐", href: "/clock", description: "플립 · 디지털 · 아날로그 시계를 띄워요." },
      { label: "QR 코드", emoji: "🔲", href: "/qr", description: "후원 QR 코드를 방송 화면에 항상 띄워 둬요." },
      { label: "방송 도구", emoji: "🛠️", href: "/tools", description: "자막 · 전광판 · 타이머 · 엔딩 크레딧 · 빙고를 띄우고 제어해요." }
    ]
  },
  {
    title: "후원 콘텐츠",
    items: [
      { label: "시그니처", emoji: "⭐", href: "/signatures", description: "후원 금액에 맞춰 나오는 시그니처 이미지와 소리를 만들어요." },
      { label: "영상 · 음성 후원", emoji: "📹", href: "/video", description: "영상 · 음성 후원 대기열을 관리하고 방송 화면에서 재생해요." },
      { label: "그림 후원", emoji: "🖌️", href: "/drawing", description: "받은 그림 후원을 방송 화면에 전시해요." },
      { label: "이펙트", emoji: "✨", href: "/effects", description: "후원에 맞춰 이모지 리액션과 화면 효과를 띄워요." },
      { label: "배너", emoji: "🖼️", href: "/banner", description: "이미지 슬라이드 배너를 화면 위 · 아래 · 가운데에 띄워요." },
      { label: "벽지", emoji: "🧱", href: "/wallpaper", description: "시청자가 후원으로 흔적을 남기는 배경 위젯이에요." }
    ]
  },
  {
    // Legacy "게임센터".
    title: "게임센터",
    items: [
      { label: "퀘스트", emoji: "⚔️", href: "/quest", description: "진행 중인 후원 미션 · 퀘스트 목록을 띄워요." },
      { label: "투표", emoji: "📊", href: "/vote", description: "투표 항목과 방송 화면 모양을 정해요." },
      { label: "룰렛", emoji: "🎡", href: "/roulette", description: "후원으로 참여하는 룰렛 항목과 확률을 정해요." },
      { label: "뽑기", emoji: "🧸", href: "/gacha", description: "뽑기 후원 상품과 확률을 정해요." }
    ]
  },
  {
    // funnation "엑셀방송".
    title: "크루 방송",
    items: [
      { label: "크루 관리", emoji: "👥", href: "/crew", description: "함께 방송하는 크루 멤버와 직급을 관리해요." },
      { label: "방송 운영", emoji: "📋", href: "/crew/broadcast", description: "점수판 · 배틀 · 강탈 · 시나리오를 방송 중에 운영해요." }
    ]
  },
  {
    title: "연결 · 설정",
    items: [
      { label: "전체 테마", emoji: "🎨", href: "/theme", description: "모든 위젯이 기본으로 쓰는 테마와 포인트 색을 골라요." },
      { label: "오버레이 주소", emoji: "🔗", href: "/overlays", description: "OBS에 넣을 오버레이 주소를 한곳에서 복사하고 미리 봐요." },
      { label: "이미지 · 사운드", emoji: "🎵", href: "/assets", description: "위젯이 쓰는 이미지와 사운드를 올리고 관리해요." },
      { label: "후원 연동", emoji: "🔌", href: "/link", description: "방송 플랫폼에서 받은 후원을 후원 알림에 함께 띄워요." },
      { label: "유튜브 연동", emoji: "▶️", href: "/youtube", description: "유튜브 채널을 연결해 채팅과 슈퍼챗을 받아요." },
      { label: "후원 필터링", emoji: "🛡️", href: "/filtering", description: "방송 화면 알림과 TTS에서 가릴 닉네임 · 문구를 정해요." }
    ]
  }
];

/** The 리모컨 sits below the menu (legacy "도우미 웹 버전 열기 · 라이브 방송 리모컨"). */
export const HELPER_REMOTE = { href: "/remote", label: "리모컨 열기", sub: "라이브 방송 리모컨 · 작은 창" } as const;
export const HELPER_REMOTE_GUIDE = "/remote/guide";

const PATHS = HELPER_NAV.flatMap((g) => g.items.map((i) => i.href));

/** The menu entry for `pathname`: the most specific path that contains it ("/" only on itself). */
export function helperActiveHref(pathname: string): string | null {
  return PATHS.filter((h) => (h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(`${h}/`))).sort((a, b) => b.length - a.length)[0] ?? null;
}
