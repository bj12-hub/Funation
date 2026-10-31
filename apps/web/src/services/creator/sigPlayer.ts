"use server";

import { USE_MOCK } from "@/lib/mock";
import { getCreatorSession } from "@/lib/session";
import { overlayKeyOpen } from "@/services/account/creatorAccess";
import { mockCrew, STUDIO_CHANNEL } from "@/services/crew/mockCrewStore";
import { mockSignatures } from "@/services/donations/signatureCore";
import { advance, mockAlerts, overlaySignal } from "./alertCore";
import { overlayTheme } from "./overlayThemeStore";
import { DEFAULT_SIG_PLAYER, SIG_PLAYER_MODES, SIG_PLAYER_WAIT_MAX, type OverlaySigPlayer, type SigPlayerResult, type SigPlayerSettings } from "./sigPlayerTypes";
import { readWidget } from "./widgetStore";

/**
 * 시그니처 플레이어 Server Actions — code-first (no Figma frame; StreamDonate 시그니처 플레이어 참고, 2026-10-25). Settings on
 * `/creator/widgets/signatures`, overlay `/overlay/sigplayer/[key]`. The overlay reads the 후원 알림 queue: only a signature
 * alert (a 시그니처 후원, a 금액 일치 후원 or a 테스트 후원 sent as a signature) shows.
 */

const assertMock = () => {
  if (!USE_MOCK) throw new Error("Signature player API is not connected yet.");
};

const g = globalThis as typeof globalThis & { __ssumnationMockSigPlayerV1?: SigPlayerSettings };
const store = () => (g.__ssumnationMockSigPlayerV1 ??= { ...DEFAULT_SIG_PLAYER });

export async function getSigPlayerSettings(): Promise<SigPlayerSettings | null> {
  assertMock();
  if (!(await getCreatorSession())) return null;
  return { ...store() };
}

export async function saveSigPlayerSettings(input: unknown): Promise<SigPlayerResult> {
  assertMock();
  if (!(await getCreatorSession())) return { status: "UNAUTHORIZED" };
  const v = (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;
  const mode = SIG_PLAYER_MODES.find((m) => m.key === v.mode)?.key;
  if (!mode) return { status: "INVALID", message: "보여 줄 방식을 골라 주세요." };
  if (typeof v.waitSec !== "number" || !Number.isInteger(v.waitSec) || v.waitSec < 0 || v.waitSec > SIG_PLAYER_WAIT_MAX) {
    return { status: "INVALID", message: `노래 전 대기는 0 ~ ${SIG_PLAYER_WAIT_MAX}초예요.` };
  }
  if (typeof v.sound !== "boolean") return { status: "INVALID", message: "소리 설정을 확인해 주세요." };
  g.__ssumnationMockSigPlayerV1 = { mode, waitSec: v.waitSec, sound: v.sound };
  return { status: "SAVED" };
}

/** OBS overlay read — no login; the integration key is the secret (as for 후원 알림). */
export async function getOverlaySigPlayer(key: unknown): Promise<OverlaySigPlayer | "FORBIDDEN"> {
  assertMock();
  if (!overlayKeyOpen(key)) return "FORBIDDEN";
  advance();
  const { muted, signatureVolume, displaySec } = mockAlerts.controls;
  const showing = mockAlerts.items.find((a) => a.status === "SHOWING");
  const design = readWidget("ALERT");
  const base = { settings: { ...store() }, volume: muted ? 0 : signatureVolume, sigFetch: design.sigFetch, serverNow: new Date().toISOString(), theme: overlayTheme(design.theme), ...overlaySignal("sigplayer") };
  if (!showing || !showing.signatureId || showing.kind === "EXTERNAL" || mockAlerts.shownAt === null) return { ...base, alert: null };
  const sig = mockSignatures.items.find((s) => s.id === showing.signatureId);
  const member = showing.memberId ? (mockCrew.crews[STUDIO_CHANNEL] ?? []).find((m) => m.id === showing.memberId) : undefined;
  return {
    ...base,
    alert: {
      id: showing.id,
      donor: showing.donor,
      message: showing.message,
      // A signature deleted since keeps the name its alert was sent with.
      signatureName: sig?.name ?? showing.typeLabel.split(" · ").at(-1) ?? "시그니처",
      imageUrl: showing.imageUrl ?? null,
      soundUrl: showing.soundUrl ?? null,
      member: member ? { name: member.name, color: member.color } : null,
      shownAt: new Date(mockAlerts.shownAt).toISOString(),
      endsAt: new Date(mockAlerts.shownAt + displaySec * 1000).toISOString()
    }
  };
}
