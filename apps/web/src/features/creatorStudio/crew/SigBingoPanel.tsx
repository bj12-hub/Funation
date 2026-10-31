"use client";

import { useRef, useState, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { clearSigBingo, saveSigBingo, setSigBingo, startSigBingo } from "@/services/crew/crewGames";
import {
  SIG_BINGO_BONUS_MAX,
  SIG_BINGO_MODES,
  SIG_BINGO_REMAINING_AT,
  SIG_BINGO_REVEALS,
  SIG_BINGO_SIZES,
  SIG_BINGO_TITLE_DEFAULT,
  sigBingoLines,
  type CrewMember,
  type GamesView,
  type SigBingoGrid,
  type SigBingoMode,
  type SigBingoRemainingAt,
  type SigBingoReveal,
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

/** `SIG_BINGO_MODES` · `SIG_BINGO_REVEALS` · `SIG_BINGO_REMAINING_AT` labels as message keys. */
const MODE_KEY: Record<SigBingoMode, { label: MessageKey; note: MessageKey }> = {
  SHARED: { label: "crewGameSigBingo.modeShared", note: "crewGameSigBingo.modeSharedNote" },
  TEAM: { label: "crewGameSigBingo.modeTeam", note: "crewGameSigBingo.modeTeamNote" },
  SOLO: { label: "crewGameSigBingo.modeSolo", note: "crewGameSigBingo.modeSoloNote" },
  TERRITORY: { label: "crewGameSigBingo.modeTerritory", note: "crewGameSigBingo.modeTerritoryNote" }
};
const REVEAL_KEY: Record<SigBingoReveal, MessageKey> = { SHOWN: "crewGameSigBingo.revealShown", HIDDEN: "crewGameSigBingo.revealHidden" };
const REMAINING_AT_KEY: Record<SigBingoRemainingAt, MessageKey> = { TOP: "crewGameSigBingo.remainingTop", BOTTOM: "crewGameSigBingo.remainingBottom" };

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
  const { t } = useI18n();
  const name = t("crewGame.nameSigBingo");
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
    }, t("crewGameSigBingo.started"));
  };

  return (
    <section id="game-sigbingo" className={styles.card} aria-labelledby="game-sigbingo-title">
      <h2 id="game-sigbingo-title" className={styles.cardTitle}>
        🎯 {name}
      </h2>
      <p className={styles.note}>{t("crewGameSigBingo.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveSigBingo({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={SIG_BINGO_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label={t("crewGameSigBingo.boardAria")}>
          <span className={styles.muted}>{t("crewGameSigBingo.board")}</span>
          <span className={prize.inline}>
            <span className={styles.segment} role="group" aria-label={t("crewGameSigBingo.sizeAria")}>
              {SIG_BINGO_SIZES.map((n) => (
                <button key={n} type="button" aria-pressed={draft.size === n} onClick={() => edit({ size: n })}>
                  {n}×{n}
                </button>
              ))}
            </span>
            <span className={styles.segment} role="group" aria-label={t("crewGameSigBingo.revealAria")}>
              {SIG_BINGO_REVEALS.map((r) => (
                <button key={r.key} type="button" aria-pressed={draft.reveal === r.key} onClick={() => edit({ reveal: r.key })}>
                  {t(REVEAL_KEY[r.key])}
                </button>
              ))}
            </span>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.showRemaining} onChange={(e) => edit({ showRemaining: e.target.checked })} />
              {t("crewGameSigBingo.showRemaining")}
            </label>
            {draft.showRemaining && (
              <span className={styles.segment} role="group" aria-label={t("crewGameSigBingo.remainingAtAria")}>
                {SIG_BINGO_REMAINING_AT.map((x) => (
                  <button key={x.key} type="button" aria-pressed={draft.remainingAt === x.key} onClick={() => edit({ remainingAt: x.key })}>
                    {t(REMAINING_AT_KEY[x.key])}
                  </button>
                ))}
              </span>
            )}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameSigBingo.modeAria")}>
          <span className={styles.muted}>{t("crewGameSigBingo.mode")}</span>
          <span className={games.rules}>
            {SIG_BINGO_MODES.map((m) => (
              <button key={m.key} type="button" className={games.rule} aria-pressed={draft.mode === m.key} onClick={() => edit({ mode: m.key })}>
                <strong>{t(MODE_KEY[m.key].label)}</strong>
                <span>{t(MODE_KEY[m.key].note)}</span>
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameSigBingo.priceRange")}</span>
          <span className={games.unit}>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameSigBingo.minAria")}
              placeholder={t("crewGame.min")}
              value={draft.priceMin}
              onChange={(e) => edit({ priceMin: e.target.value })}
            />
            <span className={styles.muted}>~</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameSigBingo.maxAria")}
              placeholder={t("crewGame.max")}
              value={draft.priceMax}
              onChange={(e) => edit({ priceMax: e.target.value })}
            />
            <span className={styles.muted}>FN</span>
          </span>
          <span className={styles.note}>
            {t("crewGameSigBingo.eligible", { eligible, cells })}
            {eligible > 0 && eligible < cells && ` — ${t("crewGameSigBingo.fewer")}`}
            {eligible === 0 && ` — ${t("crewGameSigBingo.none")}`}
          </span>
        </div>
        <label className={games.unit}>
          <span className={styles.muted}>{t("crewGameSigBingo.bonus")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label={t("crewGameSigBingo.bonusAria")}
            min={0}
            max={SIG_BINGO_BONUS_MAX}
            value={draft.bonus}
            onChange={(e) => edit({ bonus: e.target.value })}
          />
          <span className={styles.muted}>{t("crewGameSigBingo.bonusNote")}</span>
        </label>
        <AutoFields
          name={name}
          verb={t("crewGame.spin")}
          copy={{ auto: t("crewGameSigBingo.autoCopy"), excluded: t("crewGameSigBingo.excludedCopy"), note: t("crewGameSigBingo.noteCopy") }}
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
          {dirty && <p className={styles.note}>{t("crewGameSigBingo.unsaved")}</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {board
                ? `${board.size}×${board.size} · ${t(MODE_KEY[board.mode].label)}${multi ? ` · ${t("crewGameSigBingo.boards", { n: grids.length })}` : ""} · ${t("crewGameSigBingo.progress", { opened, cells: allCells.length, lines })}`
                : t("crewGameSigBingo.noBoard", { n: bingo.eligible })}
            </span>
            <button type="button" className={styles.primary} disabled={pending || bingo.eligible === 0} onClick={start}>
              {board ? t("crewGameSigBingo.restart") : t("crewGameSigBingo.start")}
            </button>
            {board && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearSigBingo({ broadcastId: live.id }), t("crewGameSigBingo.cleared"))}>
                {t("crewGameSigBingo.clear")}
              </button>
            )}
          </div>
          {board && (
            <>
              {board.mode !== "SOLO" && (
                <span className={prize.inline}>
                  <span className={styles.muted}>
                    {board.mode === "TERRITORY" ? t("crewGameSigBingo.hintTerritory") : board.mode === "TEAM" ? t("crewGameSigBingo.hintTeam") : t("crewGameSigBingo.hintMember")}
                  </span>
                  <select className={styles.select} aria-label={t("crewGameSigBingo.memberAria")} value={picked} onChange={(e) => setMemberId(e.target.value)}>
                    <option value="">{board.mode === "TERRITORY" ? t("crewGameSigBingo.pickMember") : t("crewGame.noMember")}</option>
                    {active.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </span>
              )}
              {board.mode === "SOLO" && <span className={styles.muted}>{t("crewGameSigBingo.hintSolo")}</span>}
              <div className={multi ? games.bingoBoards : undefined}>
                {grids.map((g) => (
                  <section key={g.key} className={games.bingoBoard} aria-label={g.label ? t("crewGameSigBingo.gridAria", { label: g.label }) : undefined}>
                    {multi && (
                      <h3 className={games.bingoBoardName}>
                        {g.color && <span className={styles.dot} style={{ background: g.color }} aria-hidden="true" />}
                        {g.label}
                        <span className={styles.muted}>{t("crewGameSigBingo.progress", { opened: g.cells.filter((c) => c.opened).length, cells: g.cells.length, lines: g.lines.length })}</span>
                      </h3>
                    )}
                    <BingoCells
                      grid={g}
                      size={board.size}
                      label={g.label ? t("crewGameSigBingo.cellsAriaNamed", { label: g.label }) : t("crewGameSigBingo.cellsAria")}
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
                <div className={games.remaining} aria-label={t("crewGameSigBingo.remainingAria")}>
                  <span className={styles.muted}>
                    {t("crewGameSigBingo.remaining", { kinds: bingo.remaining.length, cells: bingo.remaining.reduce((s, r) => s + r.cells, 0) })}
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
                <p className={styles.note}>{t("crewGameSigBingo.allOpen")}</p>
              )}
            </>
          )}
          <RunList name={name} runs={bingo.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="sigbingo" label={name} />
    </section>
  );
}

/** One board's cells: a click opens or closes the cell. */
function BingoCells({ grid, size, label, pending, onToggle }: { grid: SigBingoGrid; size: number; label: string; pending: boolean; onToggle: (index: number, open: boolean) => void }) {
  const { t } = useI18n();
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
            aria-label={`${t("crewGame.cellAria", { n: i + 1, name: c.signatureName })}${
              c.opened ? ` — ${c.opened.memberName ? t("crewGame.cellOpenBy", { name: c.opened.memberName }) : t("crewGame.cellOpen")}` : ""
            }`}
            onClick={() => onToggle(i, !c.opened)}
          >
            <span>{c.signatureName}</span>
            {c.opened && <small>{c.opened.memberName ?? (c.opened.manual ? t("crewGame.manual") : t("crewGame.cellOpen"))}</small>}
          </button>
        </li>
      ))}
    </ol>
  );
}
