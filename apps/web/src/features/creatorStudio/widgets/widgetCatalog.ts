import { WIDGET_CARDS, type WidgetKey } from "@/services/creator/widgetSettingsTypes";

/**
 * 위젯 catalog layout — structure follows the funnation 위젯 page (인기 · 전체 by group · 도구).
 * Items reuse the Figma widget popups (529:4 / 531:*) where they exist, link to our code-first screens
 * (리모컨, 방송 도구, 크루 방송, 오버레이 주소), or show 준비 중 (TBD features).
 */
export type CatalogAction = { type: "widget"; key: WidgetKey } | { type: "link"; href: string } | { type: "soon" };
export type CatalogItem = { id: string; emoji: string; title: string; description: string; action: CatalogAction };
export type CatalogGroup = { title: string; items: CatalogItem[] };

const widget = (key: WidgetKey, overrides?: Partial<Pick<CatalogItem, "title" | "description">>): CatalogItem => {
  const c = WIDGET_CARDS.find((w) => w.key === key)!;
  return { id: key, emoji: c.emoji, title: overrides?.title ?? c.title, description: overrides?.description ?? c.description, action: { type: "widget", key } };
};
const link = (id: string, emoji: string, title: string, description: string, href: string): CatalogItem => ({ id, emoji, title, description, action: { type: "link", href } });
const soon = (id: string, emoji: string, title: string, description: string): CatalogItem => ({ id, emoji, title, description, action: { type: "soon" } });

const ALERT = link("ALERT", "🔔", "후원 알림", "후원이 들어오면 화면에 알림을 표시합니다. 리모컨에서 제어해요.", "/creator/remote");
const SUBTITLE = link("SUBTITLE", "💬", "자막", "리모컨에서 입력하는 실시간 텍스트 자막을 표시합니다.", "/creator/widgets/tools");
const MARQUEE = link("MARQUEE", "📢", "전광판", "공지 문구를 가로로 흘려 보여 줍니다.", "/creator/widgets/tools");
const CREDITS = link("CREDITS", "🎬", "엔딩 크레딧", "방송 마무리에 순위와 감사 인사를 흘려 보여 줍니다.", "/creator/widgets/tools");
const TIMER = link("TIMER", "⏱️", "타이머", "카운트다운 / 스톱워치 오버레이를 표시합니다.", "/creator/widgets/tools");

export const POPULAR: CatalogItem[] = [ALERT, widget("RANKING", { title: "후원자 랭킹" }), widget("GOAL", { title: "목표" })];

export const GROUPS: CatalogGroup[] = [
  {
    title: "후원 알림",
    items: [
      ALERT,
      widget("QUEST", { title: "미션 · 퀘스트" }),
      soon("VIDEO", "📹", "영상", "영상 후원 요청을 관리하고 재생합니다."),
      soon("SIGNATURE", "⭐", "시그니처 후원", "후원에 붙는 시그니처를 만들고 매칭 규칙을 정합니다."),
      widget("CUSTOM_SOUND"),
      widget("MINI"),
      widget("RECENT"),
      widget("EVENT")
    ]
  },
  {
    title: "게이지 · 랭킹",
    items: [
      widget("RANKING", { title: "후원자 랭킹" }),
      widget("GOAL", { title: "목표" }),
      widget("TOTAL"),
      link("CREW_BOARD", "👥", "크루 점수판", "크루 방송의 멤버별 점수와 팀 게이지를 표시합니다.", "/creator/crew/broadcast")
    ]
  },
  {
    title: "표시 · 자막",
    items: [soon("BANNER", "🖼️", "배너", "이미지 슬라이드쇼 배너를 화면 상/하/중앙에 표시합니다."), SUBTITLE, MARQUEE, CREDITS, widget("CHAT"), widget("QR"), widget("WALLPAPER")]
  },
  {
    title: "이펙트 · 효과",
    items: [
      link("EMOJI", "😍", "이모지 리액션", "후원 시 이모지가 화면에 떠오르는 효과입니다.", "/creator/widgets/effects"),
      link("LAYER", "✨", "레이어 효과", "후원 금액 구간에 따라 화면 전체 효과를 표시합니다.", "/creator/widgets/effects")
    ]
  },
  {
    // Ours (funnation puts these under 엑셀방송).
    title: "게임 · 이벤트",
    items: [widget("VOTE"), widget("LUCKYBOX"), widget("PLAY"), widget("GACHA"), soon("DRAWING", "🖼️", "그림후원", "받은 그림 후원을 방송 화면에 전시합니다.")]
  },
  { title: "타이머", items: [TIMER] }
];

export const TOOLS: CatalogItem[] = [
  link("OVERLAYS", "🔗", "오버레이 주소", "OBS에 넣을 모든 오버레이 주소를 한곳에서 복사합니다.", "/creator/widgets/overlays"),
  link("REMOTE", "🎛️", "리모컨", "후원 알림 · 방송 도구를 한 화면에서 제어합니다.", "/creator/remote"),
  soon("ASSETS", "🎵", "이미지·사운드", "위젯이 쓰는 이미지와 사운드를 올리고 관리합니다."),
  soon("LINK", "🔌", "후원 연동", "외부 후원 플랫폼을 연결합니다.")
];

/** Distinct widgets across the 전체 groups (for the section count). */
export const ALL_COUNT = new Set(GROUPS.flatMap((g) => g.items.map((i) => i.id))).size;
