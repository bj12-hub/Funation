import { drawIndex, effectPoints, gameRunsView, parseGameCommon, recordRun, signatureTrigger, type RunStart, type StoredRun } from "./crewGameCore";
import { DEFAULT_DICE, DICE_PROJECT_RULES_MAX, DICE_RULES, PROJECT_NAME_MAX, diceMultiplier, diceRuleFor, type DiceLive, type DiceSettings } from "./crewTypes";
import { mockCrew, type MockBroadcast } from "./mockCrewStore";

/**
 * 주사위 게임 (server-only) — code-first, StreamDonate 주사위 게임 참고 (P2, a game on crewGameCore). Two dice per run,
 * rolled on the server; the chosen rule (룰 1 · 룰 2 — the broadcast's 프로젝트's when it has one, 2026-10-28) turns them
 * into a 배수 on the 기준 후원's points.
 */

const rec = (input: unknown) => (typeof input === "object" && input !== null ? input : {}) as Record<string, unknown>;

/** The channel's 주사위 게임 settings (defaults until saved; saved before 프로젝트별 룰 (2026-10-28) with none). */
export const diceSettingsOf = (channelId: string): DiceSettings => ({ ...DEFAULT_DICE, ...mockCrew.diceGames?.[channelId] });

export function parseDiceSettings(input: unknown, forbidden: string[], signatureIds: string[]): DiceSettings | { message: string } {
  const common = parseGameCommon(input, forbidden, signatureIds);
  if ("message" in common) return common;
  const v = rec(input);
  const rule = DICE_RULES.find((r) => r.key === v.rule)?.key;
  if (!rule) return { message: "룰을 골라 주세요." };
  // 프로젝트별 룰 (2026-10-28): a screen from before sends none.
  const raw = v.projectRules === undefined ? [] : v.projectRules;
  if (!Array.isArray(raw) || raw.length > DICE_PROJECT_RULES_MAX) return { message: `프로젝트별 룰은 ${DICE_PROJECT_RULES_MAX}개까지예요.` };
  const projectRules: DiceSettings["projectRules"] = [];
  for (const x of raw) {
    const p = rec(x);
    const project = typeof p.project === "string" ? p.project.trim() : "";
    const r = DICE_RULES.find((d) => d.key === p.rule)?.key;
    if (!project || project.length > PROJECT_NAME_MAX) return { message: `프로젝트 이름을 1~${PROJECT_NAME_MAX}자로 입력해 주세요.` };
    if (!r) return { message: "프로젝트의 룰을 골라 주세요." };
    if (projectRules.some((y) => y.project === project)) return { message: `'${project}' 프로젝트가 두 번 있어요.` };
    projectRules.push({ project, rule: r });
  }
  return { ...common, rule, projectRules };
}

/** One die, 1 ~ 6. */
const rollDie = () => drawIndex([1, 1, 1, 1, 1, 1]) + 1;

/** Rolls two dice and queues the run on OBS `?dice`. */
export function runDice(b: MockBroadcast, start: RunStart, now = Date.now()): StoredRun {
  const dice: [number, number] = [rollDie(), rollDie()];
  const m = diceMultiplier(diceRuleFor(diceSettingsOf(b.channelId), b.project ?? null), ...dice);
  const label = `${dice[0]} + ${dice[1]}${dice[0] === dice[1] ? " 더블" : ""}`;
  return recordRun(b, { ...start, game: "DICE", itemId: null, dice, label, kind: "MULTIPLY", value: m, points: effectPoints("MULTIPLY", m, start.basePoints) }, now);
}

/** 자동 (crewGameTriggers): once per 시그니처 후원 to a member while 자동 is on. */
export function diceForSignature(channelId: string, input: Parameters<typeof signatureTrigger>[3]) {
  const t = signatureTrigger(channelId, "DICE", diceSettingsOf(channelId), input);
  if (t) runDice(t.live, t.start);
}

export const diceLive = (b: MockBroadcast): DiceLive => {
  const settings = diceSettingsOf(b.channelId);
  return { settings: structuredClone(settings), runs: gameRunsView(b, "DICE"), rule: diceRuleFor(settings, b.project ?? null) };
};
