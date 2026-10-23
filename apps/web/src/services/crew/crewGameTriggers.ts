import { diceForSignature } from "./crewDiceCore";
import { relayForSignature } from "./crewRelayCore";
import { spinForSignature } from "./crewSpinCore";
import { twoWheelForSignature } from "./crewTwoWheelCore";

/**
 * 점수 게임 자동 (server-only) — called by the Donation Core once a completed donation is credited to a member. Each game
 * with 자동 on plays once for a 시그니처 후원 (or a 일반 후원 that alerted as a signature by 금액 일치 · 금액범위) while a crew
 * broadcast is live; several games add up (each adds its own points). The donation is the 기준 후원. 기여도 릴레이 sets its
 * 배수 from the 트리거 BJ's 시그니처 후원 and hands it to the next one another member receives.
 */
export function gamesForSignature(channelId: string, input: { donationId: string; memberId: string | null; signatureId: string | undefined; fnAmount: number }) {
  spinForSignature(channelId, input);
  diceForSignature(channelId, input);
  twoWheelForSignature(channelId, input);
  relayForSignature(channelId, input);
}
