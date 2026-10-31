"use client";

import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { resetSudopoly, saveSudopoly } from "@/services/crew/crewGames";
import {
  SUDOPOLY_ISLAND_MAX,
  SUDOPOLY_KEYS_MAX,
  SUDOPOLY_KEY_KINDS,
  SUDOPOLY_KEY_LABEL_MAX,
  SUDOPOLY_LABEL_MAX,
  SUDOPOLY_LAPS_MAX,
  SUDOPOLY_CHARACTERS,
  SUDOPOLY_PIECE_MODES,
  SUDOPOLY_ROLLS_MAX,
  SUDOPOLY_SPACES_MAX,
  SUDOPOLY_SPACES_MIN,
  SUDOPOLY_SPACE_KINDS,
  SUDOPOLY_TIERS_MAX,
  SUDOPOLY_TITLE_DEFAULT,
  SUDOPOLY_WEIGHT_MAX,
  type CrewMember,
  type GamesView,
  type SudopolyKeyKind,
  type SudopolyPieceMode,
  type SudopolySettings,
  type SudopolySpaceKind
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, ManualPlay, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps numbers as typed. */
type EditSpace = { id: string; kind: SudopolySpaceKind; label: string; value: string };
type EditKey = { id: string; label: string; kind: SudopolyKeyKind; value: string; weight: string };
type EditTier = { id: string; min: string; rolls: string };
type Draft = Omit<SudopolySettings, "spaces" | "keys" | "tiers" | "startBonus" | "islandTurns" | "goalLaps" | "goalBonus"> & {
  spaces: EditSpace[];
  keys: EditKey[];
  tiers: EditTier[];
  startBonus: string;
  islandTurns: string;
  goalLaps: string;
  goalBonus: string;
};

const valued = (kind: SudopolyKeyKind) => kind === "POINTS" || kind === "MOVE";
const toDraft = (s: SudopolySettings): Draft => ({
  ...s,
  spaces: s.spaces.map((x) => ({ ...x, value: x.kind === "POINTS" ? String(x.value) : "" })),
  keys: s.keys.map((x) => ({ ...x, value: valued(x.kind) ? String(x.value) : "", weight: String(x.weight) })),
  tiers: s.tiers.map((x) => ({ id: x.id, min: String(x.min), rolls: String(x.rolls) })),
  startBonus: String(s.startBonus),
  islandTurns: String(s.islandTurns),
  goalLaps: String(s.goalLaps),
  goalBonus: String(s.goalBonus)
});
const fromDraft = (d: Draft) => ({
  ...d,
  spaces: d.spaces.map((x) => ({ id: x.id, kind: x.kind, label: x.label.trim(), value: x.kind === "POINTS" ? Number(x.value) : 0 })),
  keys: d.keys.map((x) => ({ id: x.id, label: x.label.trim(), kind: x.kind, value: valued(x.kind) ? Number(x.value) : 0, weight: Number(x.weight) })),
  tiers: d.tiers.map((x) => ({ id: x.id, min: Number(x.min), rolls: Number(x.rolls) })),
  startBonus: Number(d.startBonus || 0),
  islandTurns: Number(d.islandTurns),
  goalLaps: Number(d.goalLaps || 0),
  goalBonus: Number(d.goalBonus || 0)
});
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;
/** `SUDOPOLY_PIECE_MODES` · `SUDOPOLY_SPACE_KINDS` · `SUDOPOLY_KEY_KINDS` labels as message keys. */
const PIECE_KEY: Record<SudopolyPieceMode, MessageKey> = { MEMBER: "crewGameSudopoly.pieceMember", SHARED: "crewGameSudopoly.pieceShared" };
const SPACE_KEY: Record<SudopolySpaceKind, MessageKey> = {
  START: "crewGameSudopoly.kindStart",
  POINTS: "crewGameSudopoly.kindPoints",
  TEXT: "crewGameSudopoly.kindText",
  ISLAND: "crewGameSudopoly.kindIsland",
  KEY: "crewGameSudopoly.kindKey"
};
const KEY_KIND_KEY: Record<SudopolyKeyKind, MessageKey> = {
  POINTS: "crewGameSudopoly.keyPoints",
  TEXT: "crewGameSudopoly.keyText",
  MOVE: "crewGameSudopoly.keyMove",
  START: "crewGameSudopoly.keyStart",
  ISLAND: "crewGameSudopoly.keyIsland"
};

/** 예시 판: 20 칸 and a 황금열쇠 deck — example values to change for the broadcast. */
const EXAMPLE_SPACES: [SudopolySpaceKind, string, number][] = [
  ["START", "출발", 0],
  ["POINTS", "+1,000", 1_000],
  ["TEXT", "애교", 0],
  ["KEY", "황금열쇠", 0],
  ["POINTS", "+2,000", 2_000],
  ["ISLAND", "무인도", 0],
  ["TEXT", "노래 한 소절", 0],
  ["POINTS", "−1,000", -1_000],
  ["KEY", "황금열쇠", 0],
  ["POINTS", "+3,000", 3_000],
  ["TEXT", "댄스", 0],
  ["POINTS", "+1,000", 1_000],
  ["KEY", "황금열쇠", 0],
  ["POINTS", "−2,000", -2_000],
  ["TEXT", "성대모사", 0],
  ["POINTS", "+5,000", 5_000],
  ["KEY", "황금열쇠", 0],
  ["POINTS", "+2,000", 2_000],
  ["TEXT", "벌칙", 0],
  ["POINTS", "+1,000", 1_000]
];
const EXAMPLE_KEYS: [string, SudopolyKeyKind, number, number][] = [
  ["+3,000점", "POINTS", 3_000, 3],
  ["−2,000점", "POINTS", -2_000, 2],
  ["3칸 앞으로", "MOVE", 3, 2],
  ["2칸 뒤로", "MOVE", -2, 2],
  ["출발로", "START", 0, 1],
  ["무인도로", "ISLAND", 0, 1],
  ["애교 한 번", "TEXT", 0, 2]
];

/**
 * 스도폴리 — code-first (no Figma frame; StreamDonate 스도폴리 참고), inside `/creator/crew/games`. 말 (BJ별 · 공용), 칸 (출발 ·
 * 점수 · 문구 · 무인도 · 황금열쇠), 출발 보너스 · 무인도 · 목표 바퀴, 황금열쇠 카드, 금액 구간별 굴림, 자동 (제외 시그),
 * 참여 BJ · 캐릭터 (BJ별 말, 2026-10-28); while live the pieces, 판 다시 시작, a 수동 roll and the runs.
 */
export function SudopolyPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: SudopolySettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameSudopoly");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const setSpace = (i: number, patch: Partial<EditSpace>) => edit({ spaces: draft.spaces.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setKey = (i: number, patch: Partial<EditKey>) => edit({ keys: draft.keys.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setTier = (i: number, patch: Partial<EditTier>) => edit({ tiers: draft.tiers.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const known = new Set(signatures.map((s) => s.id));
  const n = draft.spaces.length;
  const totalWeight = draft.keys.reduce((s, k) => s + (Number(k.weight) > 0 ? Number(k.weight) : 0), 0);
  const sudopoly = live?.sudopoly;
  const spaceName = (pos: number) => settings.spaces[pos]?.label ?? t("crewGameSudopoly.kindStart");
  const playable = members.filter((m) => m.active);
  const setCharacter = (id: string, key: string) => {
    const rest = Object.fromEntries(Object.entries(draft.characters).filter(([x]) => x !== id));
    edit({ characters: key ? { ...rest, [id]: key } : rest });
  };

  return (
    <section id="game-sudopoly" className={styles.card} aria-labelledby="game-sudopoly-title">
      <h2 id="game-sudopoly-title" className={styles.cardTitle}>
        🎲 {name}
      </h2>
      <p className={styles.note}>{t("crewGameSudopoly.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveSudopoly({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={SUDOPOLY_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label={t("crewGameSudopoly.piece")}>
          <span className={styles.muted}>{t("crewGameSudopoly.piece")}</span>
          <span className={styles.segment}>
            {SUDOPOLY_PIECE_MODES.map((m) => (
              <button key={m.key} type="button" aria-pressed={draft.pieceMode === m.key} onClick={() => edit({ pieceMode: m.key })}>
                {t(PIECE_KEY[m.key])}
              </button>
            ))}
          </span>
        </div>
        {draft.pieceMode === "MEMBER" && (
          <div className={prize.field} role="group" aria-label={t("crewGameSudopoly.playersAria")}>
            <span className={styles.muted}>{t("crewGameSudopoly.players", { playing: playable.filter((m) => !draft.sitOut.includes(m.id)).length, all: playable.length })}</span>
            <ul className={games.tiers}>
              {playable.map((m) => {
                const playing = !draft.sitOut.includes(m.id);
                return (
                  <li key={m.id}>
                    <span className={games.tierRow}>
                      <label className={styles.checkRow}>
                        <input
                          type="checkbox"
                          checked={playing}
                          onChange={(e) => edit({ sitOut: e.target.checked ? draft.sitOut.filter((x) => x !== m.id) : [...draft.sitOut, m.id] })}
                        />
                        <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                        {m.name}
                      </label>
                      <select
                        className={styles.select}
                        aria-label={t("crewGameSudopoly.characterAria", { name: m.name })}
                        value={draft.characters[m.id] ?? ""}
                        disabled={!playing}
                        onChange={(e) => setCharacter(m.id, e.target.value)}
                      >
                        <option value="">{t("crewGameSudopoly.initial")}</option>
                        {SUDOPOLY_CHARACTERS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.emoji} {c.label}
                          </option>
                        ))}
                      </select>
                    </span>
                  </li>
                );
              })}
            </ul>
            <span className={styles.note}>{t("crewGameSudopoly.playersNote")}</span>
          </div>
        )}

        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameSudopoly.spaces", { n, min: SUDOPOLY_SPACES_MIN, max: SUDOPOLY_SPACES_MAX })}</span>
          {n > 0 && (
            <ul className={games.tiers}>
              {draft.spaces.map((x, i) => (
                <li key={x.id}>
                  <span className={games.tierRow}>
                    <span className={styles.muted}>{i + 1}</span>
                    <select
                      className={styles.select}
                      aria-label={t("crewGameSudopoly.spaceKindAria", { n: i + 1 })}
                      value={x.kind}
                      disabled={i === 0}
                      onChange={(e) => setSpace(i, { kind: e.target.value as SudopolySpaceKind, value: "" })}
                    >
                      {SUDOPOLY_SPACE_KINDS.filter((k) => (i === 0) === (k.key === "START")).map((k) => (
                        <option key={k.key} value={k.key}>
                          {t(SPACE_KEY[k.key])}
                        </option>
                      ))}
                    </select>
                    <input
                      className={styles.inputSmall}
                      aria-label={t("crewGameSudopoly.spaceNameAria", { n: i + 1 })}
                      maxLength={SUDOPOLY_LABEL_MAX}
                      value={x.label}
                      onChange={(e) => setSpace(i, { label: e.target.value })}
                    />
                    {x.kind === "POINTS" && (
                      <>
                        <input
                          className={`${styles.inputSmall} ${games.short}`}
                          type="number"
                          inputMode="numeric"
                          aria-label={t("crewGameSudopoly.spacePointsAria", { n: i + 1 })}
                          value={x.value}
                          onChange={(e) => setSpace(i, { value: e.target.value })}
                        />
                        <span className={styles.muted}>{t("crewGameSudopoly.pointsUnit")}</span>
                      </>
                    )}
                    {i > 0 && (
                      <button type="button" className={styles.ghost} onClick={() => edit({ spaces: draft.spaces.filter((_, j) => j !== i) })}>
                        {t("crewGame.delete")}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={n >= SUDOPOLY_SPACES_MAX}
              onClick={() => edit({ spaces: [...draft.spaces, n ? { id: newId(), kind: "TEXT", label: "", value: "" } : { id: newId(), kind: "START", label: "출발", value: "" }] })}
            >
              {t("crewGameSudopoly.addSpace")}
            </button>
            {n === 0 && (
              <button
                type="button"
                className={styles.ghost}
                onClick={() =>
                  edit({
                    spaces: EXAMPLE_SPACES.map(([kind, label, value]) => ({ id: newId(), kind, label, value: kind === "POINTS" ? String(value) : "" })),
                    keys: draft.keys.length ? draft.keys : EXAMPLE_KEYS.map(([label, kind, value, weight]) => ({ id: newId(), label, kind, value: valued(kind) ? String(value) : "", weight: String(weight) }))
                  })
                }
              >
                {t("crewGameSudopoly.fillExample")}
              </button>
            )}
          </span>
          <span className={styles.note}>{n > 0 && n % 4 !== 0 ? t("crewGameSudopoly.notMultiple", { n }) : t("crewGameSudopoly.spacesNote")}</span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameSudopoly.rules")}</span>
          <span className={games.tierRow}>
            <span className={styles.muted}>{t("crewGameSudopoly.startBonus")}</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameSudopoly.startBonus")}
              min={0}
              value={draft.startBonus}
              onChange={(e) => edit({ startBonus: e.target.value })}
            />
            <span className={styles.muted}>{t("crewGameSudopoly.pointsIsland")}</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameSudopoly.islandAria")}
              min={1}
              max={SUDOPOLY_ISLAND_MAX}
              value={draft.islandTurns}
              onChange={(e) => edit({ islandTurns: e.target.value })}
            />
            <span className={styles.muted}>{t("crewGameSudopoly.restGoal")}</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameSudopoly.goalLapsAria")}
              min={0}
              max={SUDOPOLY_LAPS_MAX}
              value={draft.goalLaps}
              onChange={(e) => edit({ goalLaps: e.target.value })}
            />
            <span className={styles.muted}>{t("crewGameSudopoly.lapsArrow")}</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameSudopoly.goalBonusAria")}
              min={0}
              value={draft.goalBonus}
              onChange={(e) => edit({ goalBonus: e.target.value })}
            />
            <span className={styles.muted}>{t("crewGameSudopoly.pointsUnit")}</span>
          </span>
          <span className={styles.note}>{t("crewGameSudopoly.rulesNote")}</span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameSudopoly.keys", { count: draft.keys.length, max: SUDOPOLY_KEYS_MAX })}</span>
          {draft.keys.length > 0 && (
            <ul className={games.tiers}>
              {draft.keys.map((k, i) => (
                <li key={k.id}>
                  <span className={games.tierRow}>
                    <input
                      className={styles.inputSmall}
                      aria-label={t("crewGameSudopoly.keyTextAria", { n: i + 1 })}
                      maxLength={SUDOPOLY_KEY_LABEL_MAX}
                      value={k.label}
                      onChange={(e) => setKey(i, { label: e.target.value })}
                    />
                    <select
                      className={styles.select}
                      aria-label={t("crewGameSudopoly.keyKindAria", { n: i + 1 })}
                      value={k.kind}
                      onChange={(e) => setKey(i, { kind: e.target.value as SudopolyKeyKind, value: "" })}
                    >
                      {SUDOPOLY_KEY_KINDS.map((x) => (
                        <option key={x.key} value={x.key}>
                          {t(KEY_KIND_KEY[x.key])}
                        </option>
                      ))}
                    </select>
                    {valued(k.kind) && (
                      <>
                        <input
                          className={`${styles.inputSmall} ${games.short}`}
                          type="number"
                          inputMode="numeric"
                          aria-label={t(k.kind === "MOVE" ? "crewGameSudopoly.keyMoveAria" : "crewGameSudopoly.keyPointsAria", { n: i + 1 })}
                          value={k.value}
                          onChange={(e) => setKey(i, { value: e.target.value })}
                        />
                        <span className={styles.muted}>{k.kind === "MOVE" ? t("crewGameSudopoly.cellsUnit") : t("crewGameSudopoly.pointsUnit")}</span>
                      </>
                    )}
                    <span className={styles.muted}>{t("crewGameSudopoly.weightSep")}</span>
                    <input
                      className={`${styles.inputSmall} ${games.short}`}
                      type="number"
                      inputMode="numeric"
                      aria-label={t("crewGameSudopoly.keyWeightAria", { n: i + 1 })}
                      min={1}
                      max={SUDOPOLY_WEIGHT_MAX}
                      value={k.weight}
                      onChange={(e) => setKey(i, { weight: e.target.value })}
                    />
                    <span className={styles.muted}>{Number(k.weight) > 0 && totalWeight ? `${Math.round((Number(k.weight) / totalWeight) * 1000) / 10}%` : "-"}</span>
                    <button type="button" className={styles.ghost} onClick={() => edit({ keys: draft.keys.filter((_, j) => j !== i) })}>
                      {t("crewGame.delete")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.keys.length >= SUDOPOLY_KEYS_MAX}
              onClick={() => edit({ keys: [...draft.keys, { id: newId(), label: "", kind: "POINTS", value: "", weight: "1" }] })}
            >
              {t("crewGameSudopoly.addKey")}
            </button>
          </span>
          <span className={styles.note}>{t("crewGameSudopoly.keysNote")}</span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameSudopoly.tiers", { count: draft.tiers.length, max: SUDOPOLY_TIERS_MAX })}</span>
          {draft.tiers.length > 0 && (
            <ul className={games.tiers}>
              {draft.tiers.map((tier, i) => (
                <li key={tier.id}>
                  <span className={games.tierRow}>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={t("crewGameSudopoly.tierMinAria", { n: i + 1 })}
                      min={0}
                      value={tier.min}
                      onChange={(e) => setTier(i, { min: e.target.value })}
                    />
                    <span className={styles.muted}>{t("crewGameSudopoly.fnOrMoreArrow")}</span>
                    <input
                      className={`${styles.inputSmall} ${games.short}`}
                      type="number"
                      inputMode="numeric"
                      aria-label={t("crewGameSudopoly.tierRollsAria", { n: i + 1 })}
                      min={1}
                      max={SUDOPOLY_ROLLS_MAX}
                      value={tier.rolls}
                      onChange={(e) => setTier(i, { rolls: e.target.value })}
                    />
                    <span className={styles.muted}>{t("crewGameSudopoly.times")}</span>
                    <button type="button" className={styles.ghost} onClick={() => edit({ tiers: draft.tiers.filter((_, j) => j !== i) })}>
                      {t("crewGame.delete")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.tiers.length >= SUDOPOLY_TIERS_MAX}
              onClick={() => edit({ tiers: [...draft.tiers, { id: newId(), min: "", rolls: "1" }] })}
            >
              {t("crewGame.addTier")}
            </button>
          </span>
          <span className={styles.note}>{t("crewGameSudopoly.tiersNote")}</span>
        </div>

        <AutoFields
          name={name}
          verb={t("crewGame.roll")}
          copy={{
            auto: t("crewGameSudopoly.autoCopy"),
            excluded: t("crewGameSudopoly.excludedCopy"),
            note: t("crewGameSudopoly.noteCopy")
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && sudopoly && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameSudopoly.unsaved")}</p>}
          <ManualPlay game="SUDOPOLY" name={name} verb={t("crewGame.roll")} withSource={false} live={live} members={members} disabled={!settings.spaces.length} pending={pending} run={run} />
          {!settings.spaces.length && <p className={styles.note}>{t("crewGameSudopoly.needBoard")}</p>}
          {settings.spaces.length > 0 && (
            <>
              <ul className={games.lanes} aria-label={t("crewGameSudopoly.piecesAria", { name })}>
                {sudopoly.pieces.map((p) => (
                  <li key={p.key}>
                    <span className={styles.boardName}>
                      {p.color && <span className={styles.dot} style={{ background: p.color }} aria-hidden="true" />}
                      {p.name}
                    </span>
                    <span>{t("crewGameSudopoly.piecePos", { n: p.pos + 1, space: spaceName(p.pos) })}</span>
                    <span className={styles.muted}>
                      {t("crewGameSudopoly.laps", { n: formatNumber(p.laps) })}
                      {p.island > 0 ? ` · ${t("crewGameSudopoly.islandLeft", { n: p.island })}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <span className={prize.inline}>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => resetSudopoly({ broadcastId: live.id }), t("crewGameSudopoly.resetDone"))}>
                  {t("crewGameSudopoly.reset")}
                </button>
              </span>
            </>
          )}
          <RunList name={name} runs={sudopoly.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="sudopoly" label={name} />
      <p className={styles.note}>{t("crewGameSudopoly.statusNote")}</p>
      <OverlayAddress overlayPath={overlayPath} param="sudopolystatus" label={t("crewGameSudopoly.statusLabel", { name })} />
      <p className={styles.note}>{t("crewGameSudopoly.board3dNote")}</p>
      <OverlayAddress overlayPath={overlayPath} param="sudopoly3d" label={t("crewGameSudopoly.board3dLabel", { name })} />
    </section>
  );
}
