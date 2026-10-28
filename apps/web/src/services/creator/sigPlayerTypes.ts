import type { ResolvedTheme } from "./overlayThemeTypes";
import type { SigFetchMode } from "./widgetSettingsTypes";

/**
 * 시그니처 플레이어 — code-first (no Figma frame; StreamDonate 시그니처 플레이어 참고, 2026-10-25). An OBS overlay of its own for
 * signature alerts: first a 대기 단계 (노래 전 대기) with the member the supporter picked (BJ 매치) or the donor and message
 * (메시지), then the signature image big — with its sound when chosen. It follows the 후원 알림 queue (the alert on screen).
 */

export type SigPlayerMode = "MEMBER" | "MESSAGE";
export const SIG_PLAYER_MODES: { key: SigPlayerMode; label: string; note: string }[] = [
  { key: "MEMBER", label: "BJ 매치", note: "멤버를 고른 시그니처 후원은 그 멤버 배너를 먼저 보여 줘요. 멤버가 없으면 후원자 이름을 보여 줘요." },
  { key: "MESSAGE", label: "메시지", note: "후원자 이름과 메시지를 먼저 보여 줘요." }
];
/** 노래 전 대기: seconds of the 대기 단계 before the image (0 = none). The alert's 표시 시간 still ends it. */
export const SIG_PLAYER_WAIT_MAX = 10;

/** `sound`: play the signature's sound here after the wait — off by default, as the 후원 알림 overlay plays it already. */
export type SigPlayerSettings = { mode: SigPlayerMode; waitSec: number; sound: boolean };
export const DEFAULT_SIG_PLAYER: SigPlayerSettings = { mode: "MEMBER", waitSec: 3, sound: false };

export type SigPlayerResult = { status: "SAVED" } | { status: "INVALID"; message: string } | { status: "UNAUTHORIZED" };

/**
 * What the overlay shows: the signature alert on screen (null when the alert on screen is not a signature, or none is),
 * with the member the supporter picked; `shownAt` · `endsAt` bound its time; `volume` is the 리모컨 시그니처 볼륨 (0 when
 * 전체 음소거).
 */
export type OverlaySigPlayer = {
  alert: {
    id: string;
    donor: string;
    message: string;
    signatureName: string;
    imageUrl: string | null;
    soundUrl: string | null;
    member: { name: string; color: string } | null;
    shownAt: string;
    endsAt: string;
  } | null;
  settings: SigPlayerSettings;
  volume: number;
  /** 시그니처 음원 받는 방식 (후원 알림 디자인, 2026-10-28). */
  sigFetch: SigFetchMode;
  serverNow: string;
  theme: ResolvedTheme;
  reloadSeq: number;
  on: boolean;
};
