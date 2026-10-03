/**
 * 룰렛 (code-first; 2026-10-04 결정: 당첨은 크리에이터 상품이고 FN으로 지급하지 않는다). The server draws the
 * result when the participation is paid; it is revealed when the wheel spins on the broadcast.
 * Figma 펀페이 1009:510 (참여) · 1009:222 (대기) · 1009:473 (결과) · 1009:355 (Web Remote) · 1009:199/181
 * (방송 위젯). Client-safe types only.
 */

export type RouletteSpinStatus = "QUEUED" | "SPINNING" | "RESULT" | "DONE";

export const ROULETTE_STATUS_LABEL: Record<RouletteSpinStatus, string> = {
  QUEUED: "대기 중",
  SPINNING: "회전 중",
  RESULT: "결과 확인",
  DONE: "완료"
};

/** How long a result stays on the broadcast widget before the spin is done (UI timing). */
export const ROULETTE_RESULT_SEC = 8;

/** An item named 꽝 is a blank: "아쉽게도 꽝" instead of "당첨". */
export const isBlankPrize = (name: string) => name.trim() === "꽝";

/** 결과 번호 shown to the viewer and on the 리모컨. */
export const rouletteNo = (seq: number) => `#RLT-${String(seq).padStart(5, "0")}`;

/** Wheel colors by item position; a blank is always grey. */
const COLORS = ["#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#eab308", "#10b981", "#06b6d4", "#ef4444", "#a3e635", "#f472b6"];
export const rouletteColor = (name: string, index: number) => (isBlankPrize(name) ? "#64748b" : COLORS[index % COLORS.length]);

/** CSS conic-gradient for a wheel with these items (percent slices, in order). */
export function wheelGradient(items: { name: string; percent: number }[]) {
  let at = 0;
  const stops = items.map((it, i) => {
    const from = at;
    at += it.percent;
    return `${rouletteColor(it.name, i)} ${from}% ${at}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

/** One participation as its viewer sees it: the result only once it is revealed on the broadcast. */
export type MyRouletteSpin = {
  id: string;
  no: string;
  amount: number;
  createdAt: string;
  status: RouletteSpinStatus;
  /** 1-based place among the waiting participations (QUEUED only). */
  position: number | null;
  result: string | null;
};

/** The room's 룰렛 panel: counts for everyone, `usedToday` / `mine` for the signed-in viewer. */
export type RoomRoulette = { waiting: number; participantsToday: number; usedToday: number | null; mine: MyRouletteSpin[] };

/** The spin on the broadcast widget; `result` only once it is revealed. */
export type RouletteStage = {
  id: string;
  no: string;
  status: "SPINNING" | "RESULT";
  donor: string;
  amount: number;
  items: { name: string; percent: number }[];
  /** The donor's participation count today and the daily limit (0 = 제한 없음). */
  nth: number;
  limit: number;
  result: string | null;
  /** When the current state ends (spin end, or the result leaving the screen). */
  endsAt: string;
};

export type RouletteRemoteRow = {
  id: string;
  no: string;
  donor: string;
  amount: number;
  createdAt: string;
  nth: number;
  status: RouletteSpinStatus;
  /** Shown once revealed — the 리모컨 never shows a result before the spin. */
  result: string | null;
};

export type RouletteRemoteView = {
  enabled: boolean;
  autoStart: boolean;
  paused: boolean;
  dailyLimit: number;
  items: { name: string; percent: number }[];
  stage: RouletteStage | null;
  queue: RouletteRemoteRow[];
  recent: RouletteRemoteRow[];
  participantsToday: number;
};

export type RouletteControlResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };
