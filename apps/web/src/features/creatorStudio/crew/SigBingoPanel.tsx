"use client";

import { useRef, useState, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { clearSigBingo, saveSigBingo, setSigBingo, startSigBingo } from "@/services/crew/crewGames";
import {
  SIG_BINGO_BONUS_MAX,
  SIG_BINGO_MODES,
  SIG_BINGO_REVEALS,
  SIG_BINGO_SIZES,
  SIG_BINGO_TITLE_DEFAULT,
  sigBingoLines,
  type CrewMember,
  type GamesView,
  type SigBingoGrid,
  type SigBingoSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps the numbers as typed ("" = no end / 0 for the bonus). */
type Draft = Omit<SigBingoSettings, "priceMin" | "priceMax" | "bonus"> & { priceMin: string; priceMax: string; bonus: string };
const toDraft = (s: SigBingoSettings): Draft => ({ ...s, priceMin: s.priceMin === null ? "" : String(s.priceMin), priceMax: s.priceMax === null ? "" : String(s.priceMax), bonus: String(s.bonus) });
const fromDraft = (d: Draft) => ({
  ...d,
  priceMin: d.priceMin.trim() === "" ? null : Number(d.priceMin),
  priceMax: d.priceMax.trim() === "" ? null : Number(d.priceMax),
  bonus: Number(d.bonus || 0)
});

/**
 * 시그 빙고 — code-first (no Figma frame; StreamDonate 시그니처 빙고 참고), inside `/creator/crew/games`. Board settings (크기 ·
 * 모드 · 칸 표시 · 금액 범위), 빙고 보너스, 후원으로 칸 열기 · 제외 시그; while live 빙고 시작 / 판 비우기, the board (a cell
 * opens or closes on click — 땅따먹기 for the picked member), the 남은 시그 (2026-10-25, also on OBS when chosen) and the 빙고
 * runs. BJ(팀) · BJ(개인) (2026-10-28): every board under its team or member (a click there opens it for the picked member
 * of that team, or the board's member).
 */
export function SigBingoPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: SigBingoSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const startId = useRef<string | null>(null);
  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const picked = active.some((m) => m.id === memberId) ? memberId : "";
  const bingo = live?.sigBingo;
  const board = bingo?.board ?? null;

  // What a new board would draw from under the draft settings.
  const min = draft.priceMin.trim() === "" ? null : Number(draft.priceMin);
  const max = draft.priceMax.trim() === "" ? null : Number(draft.priceMax);
  const eligible = signatures.filter((s) => s.active && !draft.excluded.includes(s.id) && (min === null || s.price >= min) && (max === null || s.price <= max)).length;
  const cells = draft.size * draft.size;
  const grids = board?.grids ?? [];
  const allCells = grids.flatMap((g) => g.cells);
  const opened = allCells.filter((c) => c.opened).length;
  const lines = grids.reduce((s, g) => s + g.lines.length, 0);
  const multi = grids.length > 1 || grids.some((g) => g.label);

  const start = () => {
    if (!live) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startSigBingo({ broadcastId: live.id, requestId });
      if (res.status === "SAVED") startId.current = null;
      return res;
    }, "빙고판을 새로 만들었어요.");
  };

  return (
    <section id="game-sigbingo" className={styles.card} aria-labelledby="game-sigbingo-title">
      <h2 id="game-sigbingo-title" className={styles.cardTitle}>
        🎯 시그 빙고
      </h2>
      <p className={styles.note}>
        시그니처를 빙고판에 무작위로 배치하고, 시그니처 후원이 들어오면 그 시그니처 칸이 열려요. 한 줄(가로 · 세로 · 대각선)을 채우면 빙고예요. 방송 도구의 미션 빙고와 달리 후원으로
        칸이 열려요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveSigBingo({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), "시그 빙고 설정을 저장했어요.");
        }}
      >
        <TitleField name="시그 빙고" placeholder={SIG_BINGO_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label="판 크기 · 칸 표시">
          <span className={styles.muted}>판</span>
          <span className={prize.inline}>
            <span className={styles.segment} role="group" aria-label="판 크기">
              {SIG_BINGO_SIZES.map((n) => (
                <button key={n} type="button" aria-pressed={draft.size === n} onClick={() => edit({ size: n })}>
                  {n}×{n}
                </button>
              ))}
            </span>
            <span className={styles.segment} role="group" aria-label="칸 표시">
              {SIG_BINGO_REVEALS.map((r) => (
                <button key={r.key} type="button" aria-pressed={draft.reveal === r.key} onClick={() => edit({ reveal: r.key })}>
                  {r.label}
                </button>
              ))}
            </span>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.showRemaining} onChange={(e) => edit({ showRemaining: e.target.checked })} />
              OBS에 남은 시그 목록
            </label>
          </span>
        </div>
        <div className={prize.field} role="group" aria-label="시그 빙고 모드">
          <span className={styles.muted}>모드</span>
          <span className={games.rules}>
            {SIG_BINGO_MODES.map((m) => (
              <button key={m.key} type="button" className={games.rule} aria-pressed={draft.mode === m.key} onClick={() => edit({ mode: m.key })}>
                <strong>{m.label}</strong>
                <span>{m.note}</span>
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field}>
          <span className={styles.muted}>금액 범위 (비우면 끝 없음)</span>
          <span className={games.unit}>
            <input className={styles.inputSmall} type="number" inputMode="numeric" aria-label="시그 빙고 최소 금액" placeholder="최소" value={draft.priceMin} onChange={(e) => edit({ priceMin: e.target.value })} />
            <span className={styles.muted}>~</span>
            <input className={styles.inputSmall} type="number" inputMode="numeric" aria-label="시그 빙고 최대 금액" placeholder="최대" value={draft.priceMax} onChange={(e) => edit({ priceMax: e.target.value })} />
            <span className={styles.muted}>FN</span>
          </span>
          <span className={styles.note}>
            판에 들어갈 시그니처 {eligible}개 · 칸 {cells}개
            {eligible > 0 && eligible < cells && " — 시그니처가 칸보다 적어 같은 시그니처가 여러 칸에 들어가요."}
            {eligible === 0 && " — 넣을 시그니처가 없어 빙고를 시작할 수 없어요."}
          </span>
        </div>
        <label className={games.unit}>
          <span className={styles.muted}>빙고 보너스</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label="빙고 보너스 점수"
            min={0}
            max={SIG_BINGO_BONUS_MAX}
            value={draft.bonus}
            onChange={(e) => edit({ bonus: e.target.value })}
          />
          <span className={styles.muted}>점 — 한 줄마다, 0이면 점수 없음</span>
        </label>
        <AutoFields
          name="시그 빙고"
          verb="돌리기"
          copy={{ auto: "시그니처 후원으로 칸 열기", excluded: "빙고 제외 시그 (누르면 제외)", note: "판 크기 · 모드 · 칸 표시 · 금액 범위는 다음 빙고 시작부터 적용돼요. 제외 시그는 판에 들어가지 않아요." }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && bingo && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 빙고 시작은 저장한 설정으로 판을 만들어요.</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {board
                ? `${board.size}×${board.size} · ${SIG_BINGO_MODES.find((m) => m.key === board.mode)!.label}${multi ? ` · 판 ${grids.length}개` : ""} · 열린 칸 ${opened}/${allCells.length} · 빙고 ${lines}줄`
                : `판이 없어요. 빙고 시작을 누르면 시그니처 ${bingo.eligible}개로 판을 만들어요.`}
            </span>
            <button type="button" className={styles.primary} disabled={pending || bingo.eligible === 0} onClick={start}>
              {board ? "새 판으로 다시 시작" : "빙고 시작"}
            </button>
            {board && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearSigBingo({ broadcastId: live.id }), "빙고판을 비웠어요.")}>
                판 비우기
              </button>
            )}
          </div>
          {board && (
            <>
              {board.mode !== "SOLO" && (
                <span className={prize.inline}>
                  <span className={styles.muted}>
                    칸을 누르면 열고 닫아요
                    {board.mode === "TERRITORY" ? " — 차지할 멤버" : board.mode === "TEAM" ? " — 멤버(선택, 그 팀 판에만)" : " — 멤버(선택)"}
                  </span>
                  <select className={styles.select} aria-label="칸을 열 멤버" value={picked} onChange={(e) => setMemberId(e.target.value)}>
                    <option value="">{board.mode === "TERRITORY" ? "— 멤버 선택 —" : "멤버 없음"}</option>
                    {active.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </span>
              )}
              {board.mode === "SOLO" && <span className={styles.muted}>칸을 누르면 그 판 멤버로 열고 닫아요</span>}
              <div className={multi ? games.bingoBoards : undefined}>
                {grids.map((g) => (
                  <section key={g.key} className={games.bingoBoard} aria-label={g.label ? `${g.label} 빙고판` : undefined}>
                    {multi && (
                      <h3 className={games.bingoBoardName}>
                        {g.color && <span className={styles.dot} style={{ background: g.color }} aria-hidden="true" />}
                        {g.label}
                        <span className={styles.muted}>
                          열린 칸 {g.cells.filter((c) => c.opened).length}/{g.cells.length} · 빙고 {g.lines.length}줄
                        </span>
                      </h3>
                    )}
                    <BingoCells
                      grid={g}
                      size={board.size}
                      label={g.label ? `${g.label} 시그 빙고판` : "시그 빙고판"}
                      pending={pending}
                      onToggle={(i, open) =>
                        run(() =>
                          setSigBingo({
                            broadcastId: live.id,
                            grid: g.key,
                            index: i,
                            open,
                            // BJ(팀): only a member of that team (anyone else opens it with none).
                            memberId: board.mode === "TEAM" ? (g.members.includes(picked) ? picked : null) : picked || null
                          })
                        )
                      }
                    />
                  </section>
                ))}
              </div>
              {bingo.remaining.length > 0 ? (
                <div className={games.remaining} aria-label="남은 시그">
                  <span className={styles.muted}>
                    남은 시그 {bingo.remaining.length}종 · {bingo.remaining.reduce((s, r) => s + r.cells, 0)}칸
                  </span>
                  <ul>
                    {bingo.remaining.map((r) => (
                      <li key={r.signatureId}>
                        {r.name} <span className={styles.muted}>{formatNumber(r.price)} FN</span>
                        {r.cells > 1 && <strong> ×{r.cells}</strong>}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className={styles.note}>모든 칸이 열렸어요.</p>
              )}
            </>
          )}
          <RunList name="시그 빙고" runs={bingo.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="sigbingo" label="시그 빙고" />
    </section>
  );
}

/** One board's cells: a click opens or closes the cell. */
function BingoCells({ grid, size, label, pending, onToggle }: { grid: SigBingoGrid; size: number; label: string; pending: boolean; onToggle: (index: number, open: boolean) => void }) {
  const inLine = new Set(grid.lines.flatMap((l) => sigBingoLines(size)[l]));
  return (
    <ol className={games.bingo} style={{ "--bingo-size": size } as CSSProperties} aria-label={label}>
      {grid.cells.map((c, i) => (
        <li key={i}>
          <button
            type="button"
            className={games.bingoCell}
            data-open={c.opened ? "" : undefined}
            data-line={inLine.has(i) || undefined}
            style={c.opened?.memberColor ? ({ "--cell-color": c.opened.memberColor } as CSSProperties) : undefined}
            disabled={pending}
            aria-pressed={!!c.opened}
            aria-label={`${i + 1}번 칸 ${c.signatureName}${c.opened ? ` — 열림${c.opened.memberName ? ` · ${c.opened.memberName}` : ""}` : ""}`}
            onClick={() => onToggle(i, !c.opened)}
          >
            <span>{c.signatureName}</span>
            {c.opened && <small>{c.opened.memberName ?? (c.opened.manual ? "수동" : "열림")}</small>}
          </button>
        </li>
      ))}
    </ol>
  );
}
