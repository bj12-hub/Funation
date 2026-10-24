"use client";

import { useRef, useState, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { adjustTerritory, assignTerritory, clearTerritory, saveTerritory, startTerritory } from "@/services/crew/crewGames";
import {
  TERRITORY_CELL_POINTS_MAX,
  TERRITORY_HEART_MODES,
  TERRITORY_HEART_POINTS_MAX,
  TERRITORY_SIZES,
  TERRITORY_TITLE_DEFAULT,
  territoryCoord,
  type GamesView,
  type TerritorySettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps the numbers as typed. */
type Draft = Omit<TerritorySettings, "heartPoints" | "cellPoints"> & { heartPoints: string; cellPoints: string };
const toDraft = (s: TerritorySettings): Draft => ({ ...s, heartPoints: String(s.heartPoints), cellPoints: String(s.cellPoints) });
const fromDraft = (d: Draft) => ({ ...d, heartPoints: Number(d.heartPoints), cellPoints: Number(d.cellPoints || 0) });

/**
 * 땅따먹기 — code-first (no Figma frame; StreamDonate 땅따먹기 참고), inside `/creator/crew/games`. 판 크기, 하트 받는 방식
 * (후원 점수마다 · 시그니처 후원 1건마다), 칸 점수, 후원으로 하트 주기 · 제외 시그; while live 판 시작 / 판 비우기, each
 * member's 하트 (+1 · −1) and 점유, the board (조정실: click a cell to give it to the picked member) and the runs.
 */
export function TerritoryPanel({
  settings,
  signatures,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: TerritorySettings;
  signatures: GamesView["signatures"];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const startId = useRef<string | null>(null);
  const territory = live?.territory;
  const board = territory?.board ?? null;
  const members = territory?.members ?? [];
  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const picked = active.some((m) => m.memberId === memberId) ? memberId : (active[0]?.memberId ?? "");
  const owner = (i: number) => board?.cells[i].owners.at(-1)?.memberId ?? null;
  const owned = (id: string) => (board ? board.cells.filter((c) => c.owners.at(-1)?.memberId === id).length : 0);
  const taken = board ? board.cells.filter((c) => c.owners.length).length : 0;

  const start = () => {
    if (!live) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startTerritory({ broadcastId: live.id, requestId });
      if (res.status !== "UNAUTHORIZED") startId.current = null;
      return res;
    }, "땅따먹기 판을 만들었어요.");
  };

  return (
    <section id="game-territory" className={styles.card} aria-labelledby="game-territory-title">
      <h2 id="game-territory-title" className={styles.cardTitle}>
        🗺️ 땅따먹기
      </h2>
      <p className={styles.note}>
        멤버가 후원을 받으면 하트가 쌓여요. 하트가 있는 BJ가 칸(A1 같은 좌표)을 고르면 여기서 그 칸을 눌러 할당해요(하트 1개). 다른 멤버의 칸도 빼앗을 수 있어요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveTerritory({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), "땅따먹기 설정을 저장했어요.");
        }}
      >
        <TitleField name="땅따먹기" placeholder={TERRITORY_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label="판 크기">
          <span className={styles.muted}>판 크기</span>
          <span className={styles.segment}>
            {TERRITORY_SIZES.map((n) => (
              <button key={n} type="button" aria-pressed={draft.size === n} onClick={() => edit({ size: n })}>
                {n}×{n}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label="하트 받는 방식">
          <span className={styles.muted}>하트 받는 방식</span>
          <span className={prize.inline}>
            <span className={styles.segment}>
              {TERRITORY_HEART_MODES.map((h) => (
                <button key={h.key} type="button" aria-pressed={draft.heartMode === h.key} onClick={() => edit({ heartMode: h.key })}>
                  {h.label}
                </button>
              ))}
            </span>
            {draft.heartMode === "AMOUNT" && (
              <span className={games.unit}>
                <input
                  className={styles.inputSmall}
                  type="number"
                  inputMode="numeric"
                  aria-label="하트 기준 점수"
                  min={1}
                  max={TERRITORY_HEART_POINTS_MAX}
                  value={draft.heartPoints}
                  onChange={(e) => edit({ heartPoints: e.target.value })}
                />
                <span className={styles.muted}>점마다 하트 1개</span>
              </span>
            )}
          </span>
        </div>
        <label className={games.unit}>
          <span className={styles.muted}>칸 점수</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label="칸 점수"
            min={0}
            max={TERRITORY_CELL_POINTS_MAX}
            value={draft.cellPoints}
            onChange={(e) => edit({ cellPoints: e.target.value })}
          />
          <span className={styles.muted}>점 — 칸을 차지하면 받고, 빼앗기면 그만큼 넘어가요(0이면 순위만)</span>
        </label>
        <AutoFields
          name="땅따먹기"
          verb="하트 주기"
          copy={{
            auto: "멤버에게 후원이 들어오면 하트 주기",
            excluded: "하트를 주지 않을 시그니처 (누르면 제외)",
            note: "후원자가 멤버를 고른 후원(시그니처 · 일반)마다 한 번 하트를 줘요. 멤버를 고르지 않은 후원은 하트 +1로 직접 주세요."
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <p className={styles.note}>판 크기는 다음 판 시작부터 적용돼요. 새 판은 하트도 0부터예요.</p>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && territory && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 판 시작은 저장한 크기로 판을 만들어요.</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {board ? `${board.size}×${board.size} · 점령 ${taken}/${board.cells.length}칸` : `판이 없어요. 판 시작을 누르면 ${settings.size}×${settings.size} 빈 판을 만들어요.`}
            </span>
            <button type="button" className={styles.primary} disabled={pending} onClick={start}>
              {board ? "새 판으로 다시 시작" : "판 시작"}
            </button>
            {board && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearTerritory({ broadcastId: live.id }), "땅따먹기 판을 비웠어요.")}>
                판 비우기
              </button>
            )}
          </div>
          {board && (
            <>
              <ul className={games.lanes} aria-label="땅따먹기 하트">
                {members.map((m) => (
                  <li key={m.memberId}>
                    <span className={styles.boardName}>
                      {m.color && <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />}
                      {m.name}
                    </span>
                    <span>♥ {formatNumber(m.hearts)}</span>
                    <span className={styles.muted}>점유 {owned(m.memberId)}칸</span>
                    <button
                      type="button"
                      className={styles.ghost}
                      aria-label={`${m.name} 하트 +1`}
                      disabled={pending || !m.active}
                      onClick={() => run(() => adjustTerritory({ broadcastId: live.id, requestId: crypto.randomUUID(), memberId: m.memberId, delta: 1 }))}
                    >
                      ♥ +1
                    </button>
                    <button
                      type="button"
                      className={styles.ghost}
                      aria-label={`${m.name} 하트 −1`}
                      disabled={pending || !m.active || m.hearts < 1}
                      onClick={() => run(() => adjustTerritory({ broadcastId: live.id, requestId: crypto.randomUUID(), memberId: m.memberId, delta: -1 }))}
                    >
                      −1
                    </button>
                  </li>
                ))}
              </ul>
              <span className={prize.inline}>
                <span className={styles.muted}>칸을 누르면 이 멤버에게 할당해요(하트 1개)</span>
                <select className={styles.select} aria-label="칸을 받을 멤버" value={picked} onChange={(e) => setMemberId(e.target.value)}>
                  {active.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.name} (♥ {m.hearts})
                    </option>
                  ))}
                </select>
              </span>
              <ol className={games.territory} style={{ "--terr-size": board.size } as CSSProperties} aria-label="땅따먹기 판">
                {board.cells.map((c, i) => {
                  const o = members.find((m) => m.memberId === owner(i));
                  const coord = territoryCoord(board.size, i);
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={games.territoryCell}
                        data-owned={o ? "" : undefined}
                        style={o?.color ? ({ "--cell-color": o.color } as CSSProperties) : undefined}
                        disabled={pending || !picked || owner(i) === picked}
                        aria-label={`${coord}${o ? ` — ${o.name}` : ""}`}
                        onClick={() => run(() => assignTerritory({ broadcastId: live.id, boardId: board.boardId, requestId: crypto.randomUUID(), index: i, memberId: picked }))}
                      >
                        {coord}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          <RunList name="땅따먹기" runs={territory.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="territory" label="땅따먹기" />
    </section>
  );
}
