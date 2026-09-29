/**
 * Every OBS browser-source overlay the app serves, for the 오버레이 주소 page (code-first).
 * Sizes are recommended OBS source sizes (placeholders until designs exist).
 */
export type OverlayEntry = { id: string; group: string; title: string; description: string; size: string; path: (key: string) => string; manage: string };

export const OVERLAYS: OverlayEntry[] = [
  {
    id: "alert",
    group: "알림",
    title: "후원 알림",
    description: "후원이 들어오면 알림 카드와 TTS를 띄워요.",
    size: "800 × 600",
    path: (k) => `/overlay/alert/${k}`,
    manage: "/creator/remote"
  },
  {
    id: "effects",
    group: "알림",
    title: "이펙트 · 효과",
    description: "후원 알림과 함께 이모지 리액션 · 레이어 효과를 띄워요.",
    size: "1920 × 1080",
    path: (k) => `/overlay/effects/${k}`,
    manage: "/creator/widgets/effects"
  },
  {
    id: "video",
    group: "알림",
    title: "영상 후원",
    description: "영상 후원 대기열에서 재생 중인 영상을 띄워요.",
    size: "1280 × 720",
    path: (k) => `/overlay/video/${k}`,
    manage: "/creator/widgets/video"
  },
  {
    id: "drawing",
    group: "알림",
    title: "그림후원",
    description: "받은 그림을 전시 시간 동안 띄워요.",
    size: "800 × 700",
    path: (k) => `/overlay/drawing/${k}`,
    manage: "/creator/widgets/drawing"
  },
  {
    id: "crew",
    group: "점수·순위",
    title: "크루 점수판",
    description: "방송 중 멤버별 점수와 팀 게이지를 보여 줘요.",
    size: "480 × 600",
    path: (k) => `/overlay/crew/${k}`,
    manage: "/creator/crew/broadcast"
  },
  {
    id: "subtitle",
    group: "표시·자막",
    title: "자막",
    description: "리모컨에서 입력한 문구를 띄워요.",
    size: "1920 × 200",
    path: (k) => `/overlay/tool/subtitle/${k}`,
    manage: "/creator/widgets/tools"
  },
  {
    id: "marquee",
    group: "표시·자막",
    title: "전광판",
    description: "공지 문구를 가로로 흘려요.",
    size: "1920 × 100",
    path: (k) => `/overlay/tool/marquee/${k}`,
    manage: "/creator/widgets/tools"
  },
  {
    id: "timer",
    group: "타이머",
    title: "타이머",
    description: "카운트다운 / 스톱워치를 표시해요.",
    size: "600 × 200",
    path: (k) => `/overlay/tool/timer/${k}`,
    manage: "/creator/widgets/tools"
  },
  {
    id: "credits",
    group: "기타",
    title: "엔딩 크레딧",
    description: "방송 마무리에 감사 문구와 크루 순위를 흘려요.",
    size: "1920 × 1080",
    path: (k) => `/overlay/tool/credits/${k}`,
    manage: "/creator/widgets/tools"
  }
];
