"use client";

import { useRef, useState, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { adjustTerritory, assignTerritory, clearTerritory, saveTerritory, startTerritory } from "@/services/crew/crewGames";
import {
  TERRITORY_CELL_POINTS_MAX,
  TERRITORY_HEART_MODES,
  TERRITORY_HEART_POINTS_MAX,
  TERRITORY_SIZE_MAX,
  TERRITORY_SIZE_MIN,
  TERRITORY_TICKERS,
  TERRITORY_TITLE_DEFAULT,
  territoryCoord,
  type CrewMember,
  type GamesView,
  type TerritoryHeartMode,
  type TerritorySettings,
  type TerritoryTicker
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps the numbers as typed. */
type Draft = Omit<TerritorySettings, "size" | "heartPoints" | "cellPoints"> & { size: string; heartPoints: string; cellPoints: string };
const toDraft = (s: TerritorySettings): Draft => ({ ...s, size: String(s.size), heartPoints: String(s.heartPoints), cellPoints: String(s.cellPoints) });
const fromDraft = (d: Draft) => ({ ...d, size: Number(d.size), heartPoints: Number(d.heartPoints), cellPoints: Number(d.cellPoints || 0) });
/** Past this many cells a side the studio board drops the coordinates in its cells (still on hover and for screen readers). */
const DENSE_FROM = 13;
/** `TERRITORY_HEART_MODES` · `TERRITORY_TICKERS` labels as message keys. */
const HEART_KEY: Record<TerritoryHeartMode, MessageKey> = { AMOUNT: "crewGameTerritory.heartAmount", SIGNATURE: "crewGameTerritory.heartSignature" };
const TICKER_KEY: Record<TerritoryTicker, MessageKey> = { TOP: "crewGameTerritory.tickerTop", BOTTOM: "crewGameTerritory.tickerBottom", OFF: "crewGameTerritory.tickerOff" };

/**
 * 땅따먹기 — code-first (no Figma frame; StreamDonate 땅따먹기 참고), inside `/creator/crew/games`. 판 크기, 하트 받는 방식
 * (후원 점수마다 · 시그니처 후원 1건마다), 칸 점수, 후원으로 하트 주기 · 제외 시그; while live 판 시작 / 판 비우기, each
 * member's 하트 (+1 · −1) and 점유, the board (조정실: click a cell to give it to the picked member) and the runs. 점유 롤링
 * 표시 · 땅따먹기 전용 BJ 색상 (2026-10-28).
 */
export function TerritoryPanel({
  settings,
  signatures,
  members: crew,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: TerritorySettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameTerritory");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  // 땅따먹기 전용 BJ 색상: a color only while it differs from the crew color (the same color is no override).
  const setColor = (m: CrewMember, color: string | null) => {
    const rest = Object.fromEntries(Object.entries(draft.colors).filter(([id]) => id !== m.id));
    edit({ colors: color && color.toLowerCase() !== m.color.toLowerCase() ? { ...rest, [m.id]: color.toLowerCase() } : rest });
  };
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
    }, t("crewGameTerritory.started"));
  };

  return (
    <section id="game-territory" className={styles.card} aria-labelledby="game-territory-title">
      <h2 id="game-territory-title" className={styles.cardTitle}>
        🗺️ {name}
      </h2>
      <p className={styles.note}>{t("crewGameTerritory.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveTerritory({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={TERRITORY_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <label className={games.unit}>
          <span className={styles.muted}>{t("crewGameTerritory.size")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            min={TERRITORY_SIZE_MIN}
            max={TERRITORY_SIZE_MAX}
            value={draft.size}
            onChange={(e) => edit({ size: e.target.value })}
          />
          <span className={styles.muted}>
            {t("crewGameTerritory.sizeRange", { min: TERRITORY_SIZE_MIN, max: TERRITORY_SIZE_MAX })}
            {/^\d+$/.test(draft.size) ? ` — ${draft.size}×${draft.size}` : ""}
          </span>
        </label>
        <div className={prize.field} role="group" aria-label={t("crewGameTerritory.heartModeAria")}>
          <span className={styles.muted}>{t("crewGameTerritory.heartModeAria")}</span>
          <span className={prize.inline}>
            <span className={styles.segment}>
              {TERRITORY_HEART_MODES.map((h) => (
                <button key={h.key} type="button" aria-pressed={draft.heartMode === h.key} onClick={() => edit({ heartMode: h.key })}>
                  {t(HEART_KEY[h.key])}
                </button>
              ))}
            </span>
            {draft.heartMode === "AMOUNT" && (
              <span className={games.unit}>
                <input
                  className={styles.inputSmall}
                  type="number"
                  inputMode="numeric"
                  aria-label={t("crewGameTerritory.heartPointsAria")}
                  min={1}
                  max={TERRITORY_HEART_POINTS_MAX}
                  value={draft.heartPoints}
                  onChange={(e) => edit({ heartPoints: e.target.value })}
                />
                <span className={styles.muted}>{t("crewGameTerritory.heartPointsNote")}</span>
              </span>
            )}
          </span>
        </div>
        <label className={games.unit}>
          <span className={styles.muted}>{t("crewGameTerritory.cellPoints")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label={t("crewGameTerritory.cellPoints")}
            min={0}
            max={TERRITORY_CELL_POINTS_MAX}
            value={draft.cellPoints}
            onChange={(e) => edit({ cellPoints: e.target.value })}
          />
          <span className={styles.muted}>{t("crewGameTerritory.cellPointsNote")}</span>
        </label>
        <div className={prize.field} role="group" aria-label={t("crewGameTerritory.tickerAria")}>
          <span className={styles.muted}>{t("crewGameTerritory.ticker")}</span>
          <span className={styles.segment}>
            {TERRITORY_TICKERS.map((x) => (
              <button key={x.key} type="button" aria-pressed={draft.ticker === x.key} onClick={() => edit({ ticker: x.key })}>
                {t(TICKER_KEY[x.key])}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameTerritory.colorsAria")}>
          <span className={styles.muted}>{t("crewGameTerritory.colors")}</span>
          <ul className={games.tiers}>
            {crew
              .filter((m) => m.active || draft.colors[m.id])
              .map((m) => (
                <li key={m.id}>
                  <span className={games.tierRow}>
                    <input
                      className={games.color}
                      type="color"
                      aria-label={t("crewGameTerritory.colorAria", { name: m.name })}
                      value={draft.colors[m.id] ?? m.color}
                      onChange={(e) => setColor(m, e.target.value)}
                    />
                    <span className={styles.boardName}>{m.name}</span>
                    {draft.colors[m.id] ? (
                      <button type="button" className={styles.ghost} onClick={() => setColor(m, null)}>
                        {t("crewGameTerritory.toCrewColor")}
                      </button>
                    ) : (
                      <span className={styles.muted}>{t("crewGameTerritory.crewColor")}</span>
                    )}
                  </span>
                </li>
              ))}
          </ul>
          <span className={styles.note}>{t("crewGameTerritory.colorsNote")}</span>
        </div>
        <AutoFields
          name={name}
          verb={t("crewGameTerritory.verb")}
          copy={{
            auto: t("crewGameTerritory.autoCopy"),
            excluded: t("crewGameTerritory.excludedCopy"),
            note: t("crewGameTerritory.noteCopy")
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <p className={styles.note}>{t("crewGameTerritory.sizeNote")}</p>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && territory && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameTerritory.unsaved")}</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {board
                ? `${board.size}×${board.size} · ${t("crewGameTerritory.taken", { taken, total: board.cells.length })}`
                : t("crewGameTerritory.noBoard", { size: settings.size })}
            </span>
            <button type="button" className={styles.primary} disabled={pending} onClick={start}>
              {board ? t("crewGameTerritory.restart") : t("crewGameTerritory.start")}
            </button>
            {board && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearTerritory({ broadcastId: live.id }), t("crewGameTerritory.cleared"))}>
                {t("crewGameTerritory.clear")}
              </button>
            )}
          </div>
          {board && (
            <>
              <ul className={games.lanes} aria-label={t("crewGameTerritory.heartsAria")}>
                {members.map((m) => (
                  <li key={m.memberId}>
                    <span className={styles.boardName}>
                      {m.color && <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />}
                      {m.name}
                    </span>
                    <span>♥ {formatNumber(m.hearts)}</span>
                    <span className={styles.muted}>{t("crewGameTerritory.owned", { n: owned(m.memberId) })}</span>
                    <button
                      type="button"
                      className={styles.ghost}
                      aria-label={t("crewGameTerritory.plusAria", { name: m.name })}
                      disabled={pending || !m.active}
                      onClick={() => run(() => adjustTerritory({ broadcastId: live.id, requestId: crypto.randomUUID(), memberId: m.memberId, delta: 1 }))}
                    >
                      ♥ +1
                    </button>
                    <button
                      type="button"
                      className={styles.ghost}
                      aria-label={t("crewGameTerritory.minusAria", { name: m.name })}
                      disabled={pending || !m.active || m.hearts < 1}
                      onClick={() => run(() => adjustTerritory({ broadcastId: live.id, requestId: crypto.randomUUID(), memberId: m.memberId, delta: -1 }))}
                    >
                      −1
                    </button>
                  </li>
                ))}
              </ul>
              <span className={prize.inline}>
                <span className={styles.muted}>{t("crewGameTerritory.assignHint")}</span>
                <select className={styles.select} aria-label={t("crewGameTerritory.assignAria")} value={picked} onChange={(e) => setMemberId(e.target.value)}>
                  {active.map((m) => (
                    <option key={m.memberId} value={m.memberId}>
                      {m.name} (♥ {m.hearts})
                    </option>
                  ))}
                </select>
              </span>
              <ol
                className={games.territory}
                data-dense={board.size >= DENSE_FROM || undefined}
                style={{ "--terr-size": board.size } as CSSProperties}
                aria-label={t("crewGameTerritory.boardAria")}
              >
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
                        title={board.size >= DENSE_FROM ? `${coord}${o ? ` — ${o.name}` : ""}` : undefined}
                        onClick={() => run(() => assignTerritory({ broadcastId: live.id, boardId: board.boardId, requestId: crypto.randomUUID(), index: i, memberId: picked }))}
                      >
                        {board.size >= DENSE_FROM ? null : coord}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          <RunList name={name} runs={territory.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="territory" label={name} />
      <p className={styles.note}>{t("crewGameTerritory.rankNote")}</p>
      <OverlayAddress overlayPath={overlayPath} param="territoryrank" label={t("crewGameTerritory.rankLabel", { name })} />
    </section>
  );
}
