import { formatNumber } from "@/lib/format";
import { toUnitCode, type AmountUnit } from "@/types/donationUnit";
import type { Platform } from "@/types/platform";
import type { ResolvedTheme } from "./overlayThemeTypes";
import type { AlertSettings } from "./widgetSettingsTypes";

/**
 * 후원 알림 대기열 + 리모컨 — code-first, no Figma frame (docs/figma/code-first-screens.md).
 * Reference: docs/research/funnation-reference.md §3 (리모컨). The server owns the queue: the OBS
 * overlay only shows what the server says is on screen, so a reload never replays or skips alerts.
 * Test alerts are display-only — they never touch FN balances, ledgers or earnings.
 */

export type NativeAmount = { value: number; unit: AmountUnit };

/**
 * An EXTERNAL alert's amount by unit code. Alerts stored before the codes (until 2026-10-08) carry `currency` — the
 * label (별풍선 · 치즈 · FlexTV 후원) or an ISO code — which is mapped here, so old and new alerts group together.
 */
export function nativeAmount(n: NativeAmount | { value: number; currency: string }): NativeAmount {
  return "unit" in n ? n : { value: n.value, unit: toUnitCode(n.currency) ?? n.currency };
}

/** EXTERNAL = a donation made on a broadcast platform (후원 연동); shown in its own currency, never converted to FN. */
export type AlertKind = "DONATION" | "TEST" | "EXTERNAL";
/** QUEUED → SHOWING → DONE; SKIPPED (리모컨) and FILTERED (below the minimum) are never shown. */
export type AlertStatus = "QUEUED" | "SHOWING" | "DONE" | "SKIPPED" | "FILTERED";

export type AlertItem = {
  id: string;
  kind: AlertKind;
  donor: string;
  /**
   * DONATION: who sent it, as an opaque per-channel key (never the member id — overlays are public); null = sent with
   * 프로필 숨기기. 후원랭킹 groups by it, so a name copied from another supporter never joins their row. Absent on
   * older and seed alerts (grouped by the name shown).
   */
  donorKey?: string | null;
  /** 등급·칭호 labels resolved on the server when the donation completed (DONATION only). */
  badges?: string[];
  message: string;
  fnAmount: number;
  /** Set for EXTERNAL alerts, e.g. "₩5,000" (the FN exchange rate is TBD, so no conversion). */
  amountLabel?: string;
  typeLabel: string;
  /** Broadcast platform an EXTERNAL alert came from (통합 후원 알림 shows its mark). */
  platform?: Platform;
  /** The signature's image for a 시그니처 후원 (or a 일반 후원 matched to a signature by amount); 벽지 "후원 이미지 우선" uses it. */
  imageUrl?: string;
  /**
   * EXTERNAL: the amount in the platform's own unit, by unit code (KRW, SOOP_BALLOON, CHZZK_CHEESE …), summed per
   * platform on 수단별 보드, which shows the unit's label. Read it through `nativeAmount` (older alerts carry a label).
   */
  native?: NativeAmount;
  /** The signature's sound (library), played by the overlay at 시그니처 볼륨 (code-first, 2026-10-06). */
  soundUrl?: string;
  /** DONATION: the 썸네이션 donation type it came from (TEXT · MINI · VIDEO …); the 미니후원 overlay reads MINI. Absent on older alerts. */
  donationType?: string;
  /**
   * 퀘스트 후원: the quest (= donation) id. The FN is held until the quest succeeds and refunded if it fails or is
   * cancelled (2026-10-04 결정), so 목표 · 누적 · 랭킹 count the alert only once `questSucceeded`.
   */
  questId?: string;
  questSucceeded?: boolean;
  /** When the quest succeeded: 목표 · 누적 · 랭킹 count it at this time (2026-10-08 결정; older alerts: `createdAt`). */
  questSucceededAt?: string;
  /** 다시 보내기 copy: the id of the alert it repeats. Shown again on stream, never counted as another donation. */
  replayOf?: string;
  createdAt: string;
  status: AlertStatus;
};

export type AlertControls = {
  paused: boolean;
  muted: boolean;
  /** Alerts below this FN amount are recorded but not shown. 0 = show all. */
  minFn: number;
  /** 0–100 */
  alertVolume: number;
  ttsVolume: number;
  /** 시그니처 소리 (0–100). */
  signatureVolume: number;
  /** Seconds an alert stays on screen. Default is a placeholder (TBD). */
  displaySec: number;
};

export const ALERT_DISPLAY_SEC = { min: 3, max: 30 } as const;
export const ALERT_MIN_FN_MAX = 10_000_000;
export const TEST_DONOR_MAX = 20;
export const TEST_MESSAGE_MAX = 100;
export const TEST_AMOUNT_PRESETS = [1_000, 5_000, 10_000, 50_000, 100_000] as const;
export const TEST_AMOUNT_MAX = 10_000_000;

export type RemoteView = {
  controls: AlertControls;
  showing: AlertItem | null;
  queued: AlertItem[];
  /** Newest first, excluding queued. */
  recent: AlertItem[];
  /** 기능 제어: ON/OFF per overlay and the video donation volume (alert volumes live in `controls`). */
  overlays: { on: Record<OverlayTarget, boolean>; videoVolume: number };
};

/** 커스텀 사운드 for the 후원 알림 overlay: TTS plays `url` in place of `word` (`volume` 0–100, the sound's own). */
export type OverlayCustomSound = { word: string; url: string; volume: number };

export type OverlayAlert = {
  alert: (AlertItem & { endsAt: string }) | null;
  controls: Pick<AlertControls, "muted" | "alertVolume" | "ttsVolume" | "signatureVolume">;
  ttsSkipSeq: number;
  /** 커스텀 사운드 (위젯 → 커스텀 사운드), played while TTS reads the message. */
  customSounds: OverlayCustomSound[];
  reloadSeq: number;
  /** 기능 제어 ON/OFF: false = the overlay shows (and speaks) nothing. */
  on: boolean;
  /** 후원 알림 디자인 (위젯 → 후원 알림) and the theme it resolves to. */
  design: AlertSettings;
  theme: ResolvedTheme;
};

export type RemoteResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/** 기능별 새로고침: each OBS overlay can be reloaded on its own (or all at once). */
export const OVERLAY_TARGETS = [
  { key: "alert", label: "후원 알림" },
  { key: "effects", label: "이펙트 · 효과" },
  { key: "video", label: "영상 후원" },
  { key: "drawing", label: "그림 후원" },
  { key: "banner", label: "배너" },
  { key: "subtitle", label: "자막" },
  { key: "marquee", label: "전광판" },
  { key: "timer", label: "타이머" },
  { key: "credits", label: "엔딩 크레딧" },
  { key: "bingo", label: "빙고" },
  { key: "widgets", label: "후원 위젯 (목표 · 누적 · 랭킹 · 최근알림 · 이벤트 · QR · 퀘스트 · 투표 · 룰렛 · 뽑기 · 벽지 · 시계)" },
  { key: "chat", label: "통합 채팅" },
  { key: "crew", label: "크루 점수판 · 배틀 · 강탈 · 시나리오" }
] as const;
export type OverlayTarget = (typeof OVERLAY_TARGETS)[number]["key"];
export const isOverlayTarget = (v: unknown): v is OverlayTarget => OVERLAY_TARGETS.some((t) => t.key === v);

/** The overlays among `targets` (default: all) switched OFF in 기능 제어, in 기능 제어 order. */
export const offOverlayTargets = (switches: Record<OverlayTarget, boolean>, targets?: readonly OverlayTarget[]) =>
  OVERLAY_TARGETS.filter((t) => (!targets || targets.includes(t.key)) && !switches[t.key]);

/** What every overlay reads besides its own data: 기능별 새로고침 and 기능 제어 ON/OFF. */
export type OverlaySignal = { reloadSeq: number; on: boolean };

/** How an alert's amount reads on screen. */
export const alertAmount = (a: { fnAmount: number; amountLabel?: string }) => a.amountLabel ?? `${formatNumber(a.fnAmount)} FN`;
