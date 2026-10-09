import type { AlertItem } from "@/services/creator/alertTypes";

/**
 * Sample donations for the 위젯 popup previews (fictional names; display only, never stored). The previews run them
 * through the same functions the overlays use (recentLines · eventLines), oldest first like the alert history.
 */
const at = (minAgo: number) => new Date(Date.now() - minAgo * 60_000).toISOString();

export const SAMPLE_ALERTS: AlertItem[] = [
  { id: "sample-1", kind: "EXTERNAL", donor: "새벽감성", message: "", fnAmount: 0, amountLabel: "1,000 치즈", typeLabel: "치지직 후원", platform: "CHZZK", createdAt: at(9), status: "DONE" },
  { id: "sample-2", kind: "EXTERNAL", donor: "밤톨게임", message: "", fnAmount: 0, amountLabel: "100개", typeLabel: "별풍선", platform: "SOOP", createdAt: at(7), status: "DONE" },
  { id: "sample-3", kind: "EXTERNAL", donor: "먹깨비소이", message: "", fnAmount: 0, amountLabel: "₩5,000", typeLabel: "슈퍼챗", platform: "YOUTUBE", createdAt: at(4), status: "DONE" },
  { id: "sample-4", kind: "DONATION", donor: "도도쭈", message: "", fnAmount: 10_000, typeLabel: "텍스트 후원", createdAt: at(2), status: "DONE" },
  { id: "sample-5", kind: "DONATION", donor: "하루봄", message: "", fnAmount: 50_000, typeLabel: "시그니처 후원", createdAt: at(1), status: "DONE" }
];

/** 미니후원 popup preview: mini donations, oldest first. */
export const SAMPLE_MINI_ALERTS: AlertItem[] = [
  { id: "mini-1", kind: "DONATION", donationType: "MINI", donor: "밤톨게임", message: "ㅋㅋㅋ 오늘 텐션 최고", fnAmount: 100, typeLabel: "미니 후원", createdAt: at(6), status: "DONE" },
  { id: "mini-2", kind: "DONATION", donationType: "MINI", donor: "새벽감성", message: "노래 한 곡 더 불러 주세요", fnAmount: 300, typeLabel: "미니 후원", createdAt: at(3), status: "DONE" },
  { id: "mini-3", kind: "DONATION", donationType: "MINI", donor: "도도쭈", message: "항상 응원해요!", fnAmount: 500, typeLabel: "미니 후원", createdAt: at(1), status: "DONE" }
];
