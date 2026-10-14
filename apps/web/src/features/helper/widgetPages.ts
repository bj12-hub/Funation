import type { OverlayTarget } from "@/services/creator/alertTypes";
import type { EditableWidgetKey } from "@/services/creator/widgetSettingsTypes";

/**
 * 도우미 feature pages for the 후원 위젯 (code-first, 2026-10-14): one menu page per feature, like the legacy FlexTV 도우미
 * (채팅창 · 알림 · 목표치 · 후원자막 · 시계 …), instead of the studio's catalog of popups. A page with several widgets shows
 * them as tabs (`?tab=`). Served by `app/helper/[feature]/page.tsx`. Pure data — the middleware imports it too.
 */
export type WidgetPageTab = { key: EditableWidgetKey; slug: string; label: string };
export type WidgetPage = { title: string; description: string; tabs: WidgetPageTab[]; target: OverlayTarget };

export const WIDGET_PAGES = {
  alert: {
    title: "후원 알림",
    description: "후원이 들어오면 방송 화면에 띄우는 알림의 모양 · 문구 · 소리를 정해요. 표시 시간 · 볼륨 · 대기열은 리모컨에서 제어해요.",
    tabs: [
      { key: "ALERT", slug: "design", label: "알림 디자인" },
      { key: "CUSTOM_SOUND", slug: "sound", label: "커스텀 사운드" },
      { key: "MINI", slug: "mini", label: "미니 후원" }
    ],
    target: "alert"
  },
  chat: {
    title: "채팅창",
    description: "방송 화면에 띄우는 채팅창의 스타일을 정하고 OBS 주소를 복사해요. 채팅 보기 · 보내기 · 관리는 통합 채팅에서 해요.",
    tabs: [{ key: "CHAT", slug: "design", label: "채팅창" }],
    target: "chat"
  },
  goal: {
    title: "목표치",
    description: "후원 목표 금액과 진행 모양(막대 · 원 · 반원 · 하트 · 별)을 정해요. 두 목표를 번갈아 보여 줄 수도 있어요.",
    tabs: [{ key: "GOAL", slug: "goal", label: "후원 목표" }],
    target: "widgets"
  },
  subtitles: {
    title: "후원 자막",
    description: "후원 랭킹 · 누적 금액 · 최근 후원 · 이벤트 목록을 방송 화면에 자막처럼 띄워요.",
    tabs: [
      { key: "RANKING", slug: "ranking", label: "후원 랭킹" },
      { key: "TOTAL", slug: "total", label: "누적 금액" },
      { key: "RECENT", slug: "recent", label: "최근 후원" },
      { key: "EVENT", slug: "event", label: "이벤트 목록" }
    ],
    target: "widgets"
  },
  clock: {
    title: "시계",
    description: "방송 화면에 지금 시각(한국 시간)을 띄워요. 플립 · 디지털 · 아날로그 중에서 골라요.",
    tabs: [{ key: "CLOCK", slug: "clock", label: "시계" }],
    target: "widgets"
  },
  qr: {
    title: "QR 코드",
    description: "후원 QR 코드를 방송 화면에 항상 띄워 둬요.",
    tabs: [{ key: "QR", slug: "qr", label: "QR 코드" }],
    target: "widgets"
  },
  wallpaper: {
    title: "벽지",
    description: "시청자가 후원으로 흔적을 남기는 배경 위젯이에요. 진행은 리모컨에서 제어해요.",
    tabs: [{ key: "WALLPAPER", slug: "wallpaper", label: "벽지" }],
    target: "widgets"
  },
  quest: {
    title: "퀘스트",
    description: "진행 중인 후원 미션 · 퀘스트 목록을 방송 화면에 띄워요.",
    tabs: [{ key: "QUEST", slug: "quest", label: "퀘스트" }],
    target: "widgets"
  },
  vote: {
    title: "투표",
    description: "투표 항목과 방송 화면 모양을 정해요. 시작 · 종료는 리모컨에서 해요.",
    tabs: [{ key: "VOTE", slug: "vote", label: "투표" }],
    target: "widgets"
  },
  roulette: {
    title: "룰렛",
    description: "후원으로 참여하는 룰렛 항목과 확률을 정하고 방송 화면에 돌려요. 진행은 리모컨에서 제어해요.",
    tabs: [{ key: "ROULETTE", slug: "roulette", label: "룰렛" }],
    target: "widgets"
  },
  gacha: {
    title: "뽑기",
    description: "뽑기 후원 상품과 확률, 방송 화면 모양을 정해요. 수령 처리는 리모컨에서 해요.",
    tabs: [{ key: "GACHA", slug: "gacha", label: "뽑기" }],
    target: "widgets"
  }
} satisfies Record<string, WidgetPage>;

export type WidgetFeature = keyof typeof WIDGET_PAGES;

export const widgetPageOf = (feature: string): WidgetPage | null => (Object.hasOwn(WIDGET_PAGES, feature) ? WIDGET_PAGES[feature as WidgetFeature] : null);

/** The page (and tab) that edits each widget, e.g. TOTAL → `/subtitles?tab=total`. The first tab has no `?tab=`. */
export const WIDGET_HELPER_PATH = Object.fromEntries(
  Object.entries(WIDGET_PAGES).flatMap(([feature, page]) => (page.tabs as WidgetPageTab[]).map((t, i) => [t.key, i === 0 ? `/${feature}` : `/${feature}?tab=${t.slug}`]))
) as Record<EditableWidgetKey, string>;
