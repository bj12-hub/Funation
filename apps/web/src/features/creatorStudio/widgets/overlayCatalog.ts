/**
 * Every OBS browser-source overlay the app serves, for the 오버레이 주소 page (code-first).
 * Sizes are recommended OBS source sizes (placeholders until designs exist).
 */
import type { OverlayTarget } from "@/services/creator/alertTypes";
import { widgetOverlayPath } from "@/services/creator/widgetOverlayTypes";

/** `target` is the 리모컨 기능 제어 switch (the 후원 위젯 share one), so the page can show which overlays are OFF. */
export type OverlayEntry = { id: string; target: OverlayTarget; group: string; title: string; description: string; size: string; path: (key: string) => string; manage: string };

export const OVERLAYS: OverlayEntry[] = [
  {
    id: "chat",
    target: "chat",
    group: "채팅",
    title: "통합 채팅",
    description: "YouTube · 치지직 · SOOP · FlexTV 채팅을 플랫폼 표시와 함께 한 창에 모아 보여 줘요.",
    size: "400 × 600",
    path: (k) => `/overlay/chat/${k}`,
    manage: "/creator/chat"
  },
  {
    id: "alert",
    target: "alert",
    group: "알림",
    title: "후원 알림",
    description: "후원이 들어오면 알림 카드와 TTS를 띄워요.",
    size: "800 × 600",
    path: (k) => `/overlay/alert/${k}`,
    manage: "/creator/remote"
  },
  {
    id: "effects",
    target: "effects",
    group: "알림",
    title: "이펙트 · 효과",
    description: "후원 알림과 함께 이모지 리액션 · 레이어 효과를 띄워요.",
    size: "1920 × 1080",
    path: (k) => `/overlay/effects/${k}`,
    manage: "/creator/widgets/effects"
  },
  {
    id: "video",
    target: "video",
    group: "알림",
    title: "영상 후원",
    description: "영상 후원 대기열에서 재생 중인 영상을 띄워요.",
    size: "1280 × 720",
    path: (k) => `/overlay/video/${k}`,
    manage: "/creator/widgets/video"
  },
  {
    id: "drawing",
    target: "drawing",
    group: "알림",
    title: "그림후원",
    description: "받은 그림을 전시 시간 동안 띄워요.",
    size: "800 × 700",
    path: (k) => `/overlay/drawing/${k}`,
    manage: "/creator/widgets/drawing"
  },
  {
    id: "crew",
    target: "crew",
    group: "점수·순위",
    title: "크루 점수판",
    description: "방송 중 멤버별 점수와 팀 게이지를 보여 줘요.",
    size: "480 × 600",
    path: (k) => `/overlay/crew/${k}`,
    manage: "/creator/crew/broadcast"
  },
  {
    id: "banner",
    target: "banner",
    group: "표시·자막",
    title: "배너",
    description: "라이브러리 이미지를 슬라이드쇼로 띄워요.",
    size: "1920 × 1080",
    path: (k) => `/overlay/banner/${k}`,
    manage: "/creator/widgets/banner"
  },
  {
    id: "subtitle",
    target: "subtitle",
    group: "표시·자막",
    title: "자막",
    description: "리모컨에서 입력한 문구를 띄워요.",
    size: "1920 × 200",
    path: (k) => `/overlay/tool/subtitle/${k}`,
    manage: "/creator/widgets/tools"
  },
  {
    id: "marquee",
    target: "marquee",
    group: "표시·자막",
    title: "전광판",
    description: "공지 문구를 가로로 흘려요.",
    size: "1920 × 100",
    path: (k) => `/overlay/tool/marquee/${k}`,
    manage: "/creator/widgets/tools"
  },
  {
    id: "timer",
    target: "timer",
    group: "타이머",
    title: "타이머",
    description: "카운트다운 / 스톱워치를 표시해요.",
    size: "600 × 200",
    path: (k) => `/overlay/tool/timer/${k}`,
    manage: "/creator/widgets/tools"
  },
  {
    id: "credits",
    target: "credits",
    group: "기타",
    title: "엔딩 크레딧",
    description: "방송 마무리에 감사 문구와 크루 순위를 흘려요.",
    size: "1920 × 1080",
    path: (k) => `/overlay/tool/credits/${k}`,
    manage: "/creator/widgets/tools"
  },
  {
    id: "widget-goal",
    target: "widgets",
    group: "점수·순위",
    title: "후원목표",
    description: "목표 금액까지 모인 후원을 진행 바로 보여 줘요.",
    size: "800 × 200",
    path: (k) => widgetOverlayPath("goal", k),
    manage: "/creator/widgets"
  },
  {
    id: "widget-total",
    target: "widgets",
    group: "점수·순위",
    title: "후원누적금액",
    description: "정한 기간 동안 모인 후원 금액을 보여 줘요.",
    size: "600 × 120",
    path: (k) => widgetOverlayPath("total", k),
    manage: "/creator/widgets"
  },
  {
    id: "widget-ranking",
    target: "widgets",
    group: "점수·순위",
    title: "후원랭킹",
    description: "기간별 후원자 순위를 보여 줘요.",
    size: "400 × 500",
    path: (k) => widgetOverlayPath("ranking", k),
    manage: "/creator/widgets"
  },
  {
    id: "widget-recent",
    target: "widgets",
    group: "알림",
    title: "최근알림",
    description: "최근 후원을 한 줄씩 보여 줘요.",
    size: "800 × 200",
    path: (k) => widgetOverlayPath("recent", k),
    manage: "/creator/widgets"
  },
  {
    id: "widget-event",
    target: "widgets",
    group: "알림",
    title: "이벤트",
    description: "후원 내역을 목록으로 쌓아 보여 줘요.",
    size: "500 × 600",
    path: (k) => widgetOverlayPath("event", k),
    manage: "/creator/widgets"
  },
  {
    id: "widget-qr",
    target: "widgets",
    group: "표시·자막",
    title: "후원 QR코드",
    description: "후원 페이지로 가는 QR코드를 항상 띄워요.",
    size: "300 × 360",
    path: (k) => widgetOverlayPath("qr", k),
    manage: "/creator/widgets"
  },
  {
    id: "widget-quest",
    target: "widgets",
    group: "알림",
    title: "퀘스트",
    description: "진행 중인 퀘스트 후원과 남은 시간 · 상금을 보여 줘요.",
    size: "600 × 400",
    path: (k) => widgetOverlayPath("quest", k),
    manage: "/creator/widgets"
  },
  {
    id: "widget-vote",
    target: "widgets",
    group: "알림",
    title: "투표",
    description: "리모컨에서 시작한 무료 투표의 항목별 표 수와 남은 시간을 보여 줘요.",
    size: "600 × 500",
    path: (k) => widgetOverlayPath("vote", k),
    manage: "/creator/remote"
  }
];
