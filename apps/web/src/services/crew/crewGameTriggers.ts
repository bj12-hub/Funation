import { alphabetForSignature } from "./crewAlphabetCore";
import { diceForSignature } from "./crewDiceCore";
import { goStopForSignature } from "./crewGoStopCore";
import { gridDrawForDonation } from "./crewGridDrawCore";
import { jupjupForSignature } from "./crewJupjupCore";
import { relayForSignature } from "./crewRelayCore";
import { sigBingoForSignature } from "./crewSigBingoCore";
import { sigDosanForSignature } from "./crewSigDosanCore";
import { sigHunterForSignature } from "./crewSigHunterCore";
import { spinForSignature } from "./crewSpinCore";
import { territoryForDonation } from "./crewTerritoryCore";
import { twoWheelForSignature } from "./crewTwoWheelCore";

/**
 * 점수 게임 자동 (server-only) — called by the Donation Core once a completed donation is credited to a member. Each game
 * with 자동 on plays once for a 시그니처 후원 (or a 일반 후원 that alerted as a signature by 금액 일치 · 금액범위) while a crew
 * broadcast is live; several games add up (each adds its own points). The donation is the 기준 후원. 기여도 릴레이 sets its
 * 배수 from the 트리거 BJ's 시그니처 후원 and hands it to the next one another member receives. 줍줍 runs last: its 스핀머신 연계
 * reads the spin of the same donation. 시그 빙고 opens the signature's cell (공용 판 also for a donation without a member);
 * 복불복 뽑기판 opens a random cell (also for a donation that is no signature, on 모든 후원); 시그니처 헌터 sells the signature's
 * slot (also for a donation without a member); 시그니처 두산 climbs a lane when the signature is its next step; 알파벳 모으기
 * spins for the member; 고스톱 adds to the 풀 and rolls (not for a 제외 BJ); 땅따먹기 gives the member 하트 (also for a
 * donation that is no signature).
 */
export function gamesForSignature(channelId: string, input: { donationId: string; memberId: string | null; signatureId: string | undefined; fnAmount: number }) {
  spinForSignature(channelId, input);
  diceForSignature(channelId, input);
  twoWheelForSignature(channelId, input);
  relayForSignature(channelId, input);
  jupjupForSignature(channelId, input);
  sigBingoForSignature(channelId, input);
  gridDrawForDonation(channelId, input);
  sigHunterForSignature(channelId, input);
  sigDosanForSignature(channelId, input);
  alphabetForSignature(channelId, input);
  goStopForSignature(channelId, input);
  territoryForDonation(channelId, input);
}
