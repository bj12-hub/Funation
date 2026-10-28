"use client";

import { formatNumber } from "@/lib/format";
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
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const setSpace = (i: number, patch: Partial<EditSpace>) => edit({ spaces: draft.spaces.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setKey = (i: number, patch: Partial<EditKey>) => edit({ keys: draft.keys.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const setTier = (i: number, patch: Partial<EditTier>) => edit({ tiers: draft.tiers.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const known = new Set(signatures.map((s) => s.id));
  const n = draft.spaces.length;
  const totalWeight = draft.keys.reduce((s, k) => s + (Number(k.weight) > 0 ? Number(k.weight) : 0), 0);
  const sudopoly = live?.sudopoly;
  const spaceName = (pos: number) => settings.spaces[pos]?.label ?? "출발";
  const playable = members.filter((m) => m.active);
  const setCharacter = (id: string, key: string) => {
    const rest = Object.fromEntries(Object.entries(draft.characters).filter(([x]) => x !== id));
    edit({ characters: key ? { ...rest, [id]: key } : rest });
  };

  return (
    <section id="game-sudopoly" className={styles.card} aria-labelledby="game-sudopoly-title">
      <h2 id="game-sudopoly-title" className={styles.cardTitle}>
        🎲 스도폴리
      </h2>
      <p className={styles.note}>
        부루마불처럼 말이 판을 돌아요. 멤버에게 시그니처 후원이 들어오면 금액 구간만큼 주사위 두 개를 굴려 칸을 움직이고, 칸 · 황금열쇠 · 출발 보너스 점수가 그 멤버에게 들어가요. 더블이면 한 번
        더, 세 번 연속이면 무인도예요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveSudopoly({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), "스도폴리 설정을 저장했어요.");
        }}
      >
        <TitleField name="스도폴리" placeholder={SUDOPOLY_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label="말">
          <span className={styles.muted}>말</span>
          <span className={styles.segment}>
            {SUDOPOLY_PIECE_MODES.map((m) => (
              <button key={m.key} type="button" aria-pressed={draft.pieceMode === m.key} onClick={() => edit({ pieceMode: m.key })}>
                {m.label}
              </button>
            ))}
          </span>
        </div>
        {draft.pieceMode === "MEMBER" && (
          <div className={prize.field} role="group" aria-label="참여 BJ · 캐릭터">
            <span className={styles.muted}>
              참여 BJ · 캐릭터 ({playable.filter((m) => !draft.sitOut.includes(m.id)).length}/{playable.length})
            </span>
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
                      <select className={styles.select} aria-label={`${m.name} 캐릭터`} value={draft.characters[m.id] ?? ""} disabled={!playing} onChange={(e) => setCharacter(m.id, e.target.value)}>
                        <option value="">이름 첫 글자</option>
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
            <span className={styles.note}>참여하지 않는 BJ는 판에 말이 나오지 않고, 그 BJ에게 온 시그니처 후원은 굴리지 않아요. 캐릭터는 OBS 판의 말에 보여요.</span>
          </div>
        )}

        <div className={prize.field}>
          <span className={styles.muted}>
            칸 ({n}개 — {SUDOPOLY_SPACES_MIN} ~ {SUDOPOLY_SPACES_MAX}개, 4의 배수, 첫 칸은 출발)
          </span>
          {n > 0 && (
            <ul className={games.tiers}>
              {draft.spaces.map((x, i) => (
                <li key={x.id}>
                  <span className={games.tierRow}>
                    <span className={styles.muted}>{i + 1}</span>
                    <select
                      className={styles.select}
                      aria-label={`${i + 1}번 칸 종류`}
                      value={x.kind}
                      disabled={i === 0}
                      onChange={(e) => setSpace(i, { kind: e.target.value as SudopolySpaceKind, value: "" })}
                    >
                      {SUDOPOLY_SPACE_KINDS.filter((k) => (i === 0) === (k.key === "START")).map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className={styles.inputSmall}
                      aria-label={`${i + 1}번 칸 이름`}
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
                          aria-label={`${i + 1}번 칸 점수`}
                          value={x.value}
                          onChange={(e) => setSpace(i, { value: e.target.value })}
                        />
                        <span className={styles.muted}>점</span>
                      </>
                    )}
                    {i > 0 && (
                      <button type="button" className={styles.ghost} onClick={() => edit({ spaces: draft.spaces.filter((_, j) => j !== i) })}>
                        삭제
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
              + 칸 추가
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
                예시 판으로 채우기
              </button>
            )}
          </span>
          <span className={styles.note}>
            {n > 0 && n % 4 !== 0 ? `칸이 ${n}개예요. 4의 배수로 맞춰 주세요.` : "판은 정사각형으로 돌아요. 예시 값은 일반적인 기준이니 방송에 맞게 바꿔 주세요."}
          </span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>규칙</span>
          <span className={games.tierRow}>
            <span className={styles.muted}>출발 보너스</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label="출발 보너스"
              min={0}
              value={draft.startBonus}
              onChange={(e) => edit({ startBonus: e.target.value })}
            />
            <span className={styles.muted}>점 · 무인도</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label="무인도에서 쉬는 횟수"
              min={1}
              max={SUDOPOLY_ISLAND_MAX}
              value={draft.islandTurns}
              onChange={(e) => edit({ islandTurns: e.target.value })}
            />
            <span className={styles.muted}>번 쉬기 · 목표</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label="목표 바퀴"
              min={0}
              max={SUDOPOLY_LAPS_MAX}
              value={draft.goalLaps}
              onChange={(e) => edit({ goalLaps: e.target.value })}
            />
            <span className={styles.muted}>바퀴 →</span>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              inputMode="numeric"
              aria-label="완주 보너스"
              min={0}
              value={draft.goalBonus}
              onChange={(e) => edit({ goalBonus: e.target.value })}
            />
            <span className={styles.muted}>점</span>
          </span>
          <span className={styles.note}>목표 바퀴를 0으로 두면 완주 보너스가 없어요. 목표에 닿으면 보너스를 받고 바퀴 수를 다시 세요.</span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>
            황금열쇠 카드 ({draft.keys.length}/{SUDOPOLY_KEYS_MAX})
          </span>
          {draft.keys.length > 0 && (
            <ul className={games.tiers}>
              {draft.keys.map((k, i) => (
                <li key={k.id}>
                  <span className={games.tierRow}>
                    <input
                      className={styles.inputSmall}
                      aria-label={`황금열쇠 ${i + 1} 문구`}
                      maxLength={SUDOPOLY_KEY_LABEL_MAX}
                      value={k.label}
                      onChange={(e) => setKey(i, { label: e.target.value })}
                    />
                    <select className={styles.select} aria-label={`황금열쇠 ${i + 1} 종류`} value={k.kind} onChange={(e) => setKey(i, { kind: e.target.value as SudopolyKeyKind, value: "" })}>
                      {SUDOPOLY_KEY_KINDS.map((x) => (
                        <option key={x.key} value={x.key}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                    {valued(k.kind) && (
                      <>
                        <input
                          className={`${styles.inputSmall} ${games.short}`}
                          type="number"
                          inputMode="numeric"
                          aria-label={`황금열쇠 ${i + 1} ${k.kind === "MOVE" ? "칸 수" : "점수"}`}
                          value={k.value}
                          onChange={(e) => setKey(i, { value: e.target.value })}
                        />
                        <span className={styles.muted}>{k.kind === "MOVE" ? "칸" : "점"}</span>
                      </>
                    )}
                    <span className={styles.muted}>· 가중치</span>
                    <input
                      className={`${styles.inputSmall} ${games.short}`}
                      type="number"
                      inputMode="numeric"
                      aria-label={`황금열쇠 ${i + 1} 가중치`}
                      min={1}
                      max={SUDOPOLY_WEIGHT_MAX}
                      value={k.weight}
                      onChange={(e) => setKey(i, { weight: e.target.value })}
                    />
                    <span className={styles.muted}>{Number(k.weight) > 0 && totalWeight ? `${Math.round((Number(k.weight) / totalWeight) * 1000) / 10}%` : "-"}</span>
                    <button type="button" className={styles.ghost} onClick={() => edit({ keys: draft.keys.filter((_, j) => j !== i) })}>
                      삭제
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
              + 카드 추가
            </button>
          </span>
          <span className={styles.note}>이동은 앞(+) · 뒤(−) 칸 수예요. 카드로 옮겨 간 칸의 효과는 다시 받지 않아요.</span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>
            금액 구간별 굴림 ({draft.tiers.length}/{SUDOPOLY_TIERS_MAX})
          </span>
          {draft.tiers.length > 0 && (
            <ul className={games.tiers}>
              {draft.tiers.map((t, i) => (
                <li key={t.id}>
                  <span className={games.tierRow}>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={`금액 구간 ${i + 1} 최소 금액`}
                      min={0}
                      value={t.min}
                      onChange={(e) => setTier(i, { min: e.target.value })}
                    />
                    <span className={styles.muted}>FN 이상 →</span>
                    <input
                      className={`${styles.inputSmall} ${games.short}`}
                      type="number"
                      inputMode="numeric"
                      aria-label={`금액 구간 ${i + 1} 굴림 수`}
                      min={1}
                      max={SUDOPOLY_ROLLS_MAX}
                      value={t.rolls}
                      onChange={(e) => setTier(i, { rolls: e.target.value })}
                    />
                    <span className={styles.muted}>번</span>
                    <button type="button" className={styles.ghost} onClick={() => edit({ tiers: draft.tiers.filter((_, j) => j !== i) })}>
                      삭제
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
              + 구간 추가
            </button>
          </span>
          <span className={styles.note}>시그니처 후원 금액이 닿은 가장 높은 구간만큼 굴려요. 가장 낮은 구간보다 적으면 굴리지 않아요.</span>
        </div>

        <AutoFields
          name="스도폴리"
          verb="굴리기"
          copy={{
            auto: "멤버에게 시그니처 후원이 들어오면 금액 구간만큼 굴리기",
            excluded: "굴리지 않을 시그니처 (누르면 제외)",
            note: "후원자가 멤버를 고른 시그니처 후원(금액 일치 · 금액범위 · 랜덤시그 포함)마다 굴려요. 멤버를 고르지 않은 후원은 수동으로 굴려 주세요."
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
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 주사위는 저장한 판으로 굴러가요.</p>}
          <ManualPlay game="SUDOPOLY" name="스도폴리" verb="굴리기" withSource={false} live={live} members={members} disabled={!settings.spaces.length} pending={pending} run={run} />
          {!settings.spaces.length && <p className={styles.note}>판을 저장하면 굴릴 수 있어요.</p>}
          {settings.spaces.length > 0 && (
            <>
              <ul className={games.lanes} aria-label="스도폴리 말">
                {sudopoly.pieces.map((p) => (
                  <li key={p.key}>
                    <span className={styles.boardName}>
                      {p.color && <span className={styles.dot} style={{ background: p.color }} aria-hidden="true" />}
                      {p.name}
                    </span>
                    <span>
                      {p.pos + 1}번 칸 · {spaceName(p.pos)}
                    </span>
                    <span className={styles.muted}>
                      {formatNumber(p.laps)}바퀴{p.island > 0 ? ` · 무인도 ${p.island}번 남음` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <span className={prize.inline}>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => resetSudopoly({ broadcastId: live.id }), "모든 말을 출발로 돌렸어요.")}>
                  판 다시 시작 (모든 말 출발로)
                </button>
              </span>
            </>
          )}
          <RunList name="스도폴리" runs={sudopoly.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="sudopoly" label="스도폴리" />
      <p className={styles.note}>상태 텍스트 (진행 · 말마다 칸과 바퀴를 한 줄로)</p>
      <OverlayAddress overlayPath={overlayPath} param="sudopolystatus" label="스도폴리 상태 텍스트" />
    </section>
  );
}
