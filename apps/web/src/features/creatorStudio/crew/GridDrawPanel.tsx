"use client";

import { useRef, useState, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { clearGridDraw, openGridDraw, saveGridDraw, startGridDraw } from "@/services/crew/crewGames";
import {
  GRID_DRAW_LABEL_MAX,
  GRID_DRAW_POINTS_MAX,
  GRID_DRAW_PRIZES_MAX,
  GRID_DRAW_SIZES,
  GRID_DRAW_TITLE_DEFAULT,
  GRID_DRAW_TRIGGERS,
  GRID_PRIZE_KINDS,
  type CrewMember,
  type GamesView,
  type GridDrawSettings,
  type GridDrawTrigger,
  type GridPrizeKind
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps numbers as typed; a SIGNATURE prize's label is the picked signature's name. */
type EditPrize = { id: string; kind: GridPrizeKind; label: string; signatureId: string; points: string; count: string };
type Draft = Omit<GridDrawSettings, "minAmount" | "prizes"> & { minAmount: string; prizes: EditPrize[] };

const toDraft = (s: GridDrawSettings): Draft => ({
  ...s,
  minAmount: String(s.minAmount),
  prizes: s.prizes.map((p) => ({ ...p, signatureId: p.signatureId ?? "", points: p.kind === "POINTS" ? String(p.points) : "", count: String(p.count) }))
});
const fromDraft = (d: Draft) => ({
  ...d,
  minAmount: Number(d.minAmount || 0),
  prizes: d.prizes.map((p) => ({
    id: p.id,
    kind: p.kind,
    label: p.label.trim(),
    signatureId: p.kind === "SIGNATURE" ? p.signatureId || null : null,
    points: p.kind === "POINTS" ? Number(p.points) : 0,
    count: Number(p.count)
  }))
});
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;
/** `GRID_PRIZE_KINDS` · `GRID_DRAW_TRIGGERS` labels as message keys. */
const KIND_KEY: Record<GridPrizeKind, MessageKey> = {
  TEXT: "crewGameGridDraw.kindText",
  SIGNATURE: "crewGameGridDraw.kindSignature",
  POINTS: "crewGameGridDraw.kindPoints"
};
const TRIGGER_KEY: Record<GridDrawTrigger, MessageKey> = { SIGNATURE: "crewGameGridDraw.triggerSignature", ANY: "crewGameGridDraw.triggerAny" };

/**
 * 복불복 뽑기판 — code-first (no Figma frame; StreamDonate 복불복 뽑기판 참고), inside `/creator/crew/games`. 칸 개수, 당첨
 * 목록 (문구 · 시그니처 · 점수 × 칸 수; the rest is 꽝), 후원 시 자동 랜덤 오픈 (시그니처 후원만 / 모든 후원 · 최소 금액 · 제외
 * 시그) and 자동 리셋; while live 뽑기판 시작 / 판 비우기, a random or picked opening for a member, the board (the studio sees
 * the hidden prizes) and the runs.
 */
export function GridDrawPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: GridDrawSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameGridDraw");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const setPrize = (i: number, patch: Partial<EditPrize>) => edit({ prizes: draft.prizes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const known = new Set(signatures.map((s) => s.id));
  const startId = useRef<string | null>(null);
  const openId = useRef<string | null>(null);
  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const picked = active.some((m) => m.id === memberId) ? memberId : "";
  const draw = live?.gridDraw;
  const board = draw?.board ?? null;

  const cells = draft.size * draft.size;
  const used = draft.prizes.reduce((s, p) => s + (Number.isInteger(Number(p.count)) && Number(p.count) > 0 ? Number(p.count) : 0), 0);
  const opened = board ? board.cells.filter((c) => c.opened).length : 0;
  const prizesLeft = board ? board.cells.filter((c) => !c.opened && c.kind !== "MISS").length : 0;

  const start = () => {
    if (!live) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startGridDraw({ broadcastId: live.id, requestId });
      if (res.status === "SAVED") startId.current = null;
      return res;
    }, t("crewGameGridDraw.started"));
  };

  // One request id per intended opening (a random one is retried with the same id); a picked cell is refused once open.
  const open = (index: number | null) => {
    if (!live || !board) return;
    const requestId = index === null ? (openId.current ??= crypto.randomUUID()) : crypto.randomUUID();
    run(async () => {
      const res = await openGridDraw({ broadcastId: live.id, requestId, index, round: board.round, memberId: picked || null });
      if (index === null) openId.current = null;
      return res;
    }, t("crewGameGridDraw.opened"));
  };

  return (
    <section id="game-griddraw" className={styles.card} aria-labelledby="game-griddraw-title">
      <h2 id="game-griddraw-title" className={styles.cardTitle}>
        🎟️ {name}
      </h2>
      <p className={styles.note}>{t("crewGameGridDraw.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveGridDraw({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={GRID_DRAW_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label={t("crewGameGridDraw.size")}>
          <span className={styles.muted}>{t("crewGameGridDraw.size")}</span>
          <span className={styles.segment}>
            {GRID_DRAW_SIZES.map((n) => (
              <button key={n} type="button" aria-pressed={draft.size === n} onClick={() => edit({ size: n })}>
                {n}×{n}
              </button>
            ))}
          </span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameGridDraw.prizes", { count: draft.prizes.length, max: GRID_DRAW_PRIZES_MAX })}</span>
          {draft.prizes.length > 0 && (
            <ul className={games.items}>
              {draft.prizes.map((p, i) => (
                <li key={p.id}>
                  {p.kind === "SIGNATURE" ? (
                    <select
                      className={styles.select}
                      aria-label={t("crewGameGridDraw.prizeSigAria", { n: i + 1 })}
                      value={p.signatureId}
                      onChange={(e) => setPrize(i, { signatureId: e.target.value, label: signatures.find((s) => s.id === e.target.value)?.name ?? "" })}
                    >
                      <option value="">{t("crewGameGridDraw.sigPlaceholder")}</option>
                      {signatures.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.active ? "" : ` (${t("crewGame.hidden")})`}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={styles.inputSmall}
                      aria-label={t("crewGameGridDraw.prizeTextAria", { n: i + 1 })}
                      placeholder={p.kind === "POINTS" ? t("crewGameGridDraw.pointsNamePlaceholder") : t("crewGameGridDraw.textPlaceholder")}
                      maxLength={GRID_DRAW_LABEL_MAX}
                      value={p.label}
                      onChange={(e) => setPrize(i, { label: e.target.value })}
                    />
                  )}
                  <select
                    className={styles.select}
                    aria-label={t("crewGameGridDraw.prizeKindAria", { n: i + 1 })}
                    value={p.kind}
                    onChange={(e) => setPrize(i, { kind: e.target.value as GridPrizeKind, label: "", signatureId: "", points: "" })}
                  >
                    {GRID_PRIZE_KINDS.map((k) => (
                      <option key={k.key} value={k.key}>
                        {t(KIND_KEY[k.key])}
                      </option>
                    ))}
                  </select>
                  <input
                    className={styles.inputSmall}
                    type="number"
                    inputMode="numeric"
                    aria-label={t("crewGameGridDraw.prizePointsAria", { n: i + 1 })}
                    placeholder={p.kind === "POINTS" ? t("crewGameGridDraw.pointsPlaceholder") : "—"}
                    min={1}
                    max={GRID_DRAW_POINTS_MAX}
                    disabled={p.kind !== "POINTS"}
                    value={p.points}
                    onChange={(e) => setPrize(i, { points: e.target.value })}
                  />
                  <input
                    className={styles.inputSmall}
                    type="number"
                    inputMode="numeric"
                    aria-label={t("crewGameGridDraw.prizeCountAria", { n: i + 1 })}
                    placeholder={t("crewGameGridDraw.countPlaceholder")}
                    min={1}
                    max={cells}
                    value={p.count}
                    onChange={(e) => setPrize(i, { count: e.target.value })}
                  />
                  <span className={styles.muted}>{t("crewGameGridDraw.cellsUnit")}</span>
                  <button type="button" className={styles.ghost} onClick={() => edit({ prizes: draft.prizes.filter((_, j) => j !== i) })}>
                    {t("crewGame.delete")}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.prizes.length >= GRID_DRAW_PRIZES_MAX}
              onClick={() => edit({ prizes: [...draft.prizes, { id: newId(), kind: "TEXT", label: "", signatureId: "", points: "", count: "1" }] })}
            >
              {t("crewGameGridDraw.addPrize")}
            </button>
          </span>
          <span className={used > cells ? styles.error : styles.note}>
            {used > cells
              ? t("crewGameGridDraw.tooMany", { used, cells })
              : t("crewGameGridDraw.odds", { used, miss: cells - used, cells, percent: Math.round((used / cells) * 1000) / 10 })}
          </span>
        </div>

        <div className={prize.field} role="group" aria-label={t("crewGameGridDraw.triggerAria")}>
          <span className={styles.muted}>{t("crewGameGridDraw.triggerLabel")}</span>
          <span className={prize.inline}>
            <span className={styles.segment}>
              {GRID_DRAW_TRIGGERS.map((x) => (
                <button key={x.key} type="button" aria-pressed={draft.trigger === x.key} onClick={() => edit({ trigger: x.key })}>
                  {t(TRIGGER_KEY[x.key])}
                </button>
              ))}
            </span>
            <span className={games.unit}>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label={t("crewGameGridDraw.minAria")}
                min={0}
                value={draft.minAmount}
                onChange={(e) => edit({ minAmount: e.target.value })}
              />
              <span className={styles.muted}>{t("crewGameGridDraw.fnOrMore")}</span>
            </span>
          </span>
        </div>
        <AutoFields
          name={name}
          verb={t("crewGameGridDraw.verb")}
          copy={{
            auto: t("crewGameGridDraw.autoCopy"),
            excluded: t("crewGameGridDraw.excludedCopy"),
            note: t("crewGameGridDraw.noteCopy")
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.autoReset} onChange={(e) => edit({ autoReset: e.target.checked })} />
          {t("crewGameGridDraw.autoReset")}
        </label>
        <p className={styles.note}>{t("crewGameGridDraw.applyNote")}</p>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && draw && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameGridDraw.unsaved")}</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {board
                ? `${board.size}×${board.size} · ${t("crewGameGridDraw.status", { round: board.round, opened, total: board.cells.length, left: prizesLeft })}${board.resetAt ? ` · ${t("crewGameGridDraw.resetPending")}` : ""}`
                : t("crewGameGridDraw.noBoard", { size: settings.size })}
            </span>
            <button type="button" className={styles.primary} disabled={pending} onClick={start}>
              {board ? t("crewGameGridDraw.restart") : t("crewGameGridDraw.start")}
            </button>
            {board && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearGridDraw({ broadcastId: live.id }), t("crewGameGridDraw.cleared"))}>
                {t("crewGameGridDraw.clear")}
              </button>
            )}
          </div>
          {board && (
            <>
              <div className={games.manual} role="group" aria-label={t("crewGameGridDraw.manualAria", { name })}>
                <select className={styles.select} aria-label={t("crewGameGridDraw.memberAria")} value={picked} onChange={(e) => setMemberId(e.target.value)}>
                  <option value="">{t("crewGame.noMember")}</option>
                  {active.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button type="button" className={styles.primary} disabled={pending || opened === board.cells.length} onClick={() => open(null)}>
                  {t("crewGameGridDraw.openRandom")}
                </button>
                <span className={styles.muted}>{t("crewGameGridDraw.clickHint")}</span>
              </div>
              {!board.resetAt && opened === board.cells.length && <p className={styles.note}>{t("crewGameGridDraw.allOpen")}</p>}
              <ol className={games.bingo} style={{ "--bingo-size": board.size } as CSSProperties} aria-label={name}>
                {board.cells.map((c, i) => {
                  const what =
                    c.kind === "MISS"
                      ? t("crewGameGridDraw.miss")
                      : c.kind === "POINTS"
                        ? `${c.label} +${t("crewGame.points", { n: formatNumber(c.points) })}`
                        : `${t(KIND_KEY[c.kind as GridPrizeKind])} · ${c.label}`;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={games.drawCell}
                        data-open={c.opened ? "" : undefined}
                        data-miss={c.kind === "MISS" || undefined}
                        style={c.opened?.memberColor ? ({ "--cell-color": c.opened.memberColor } as CSSProperties) : undefined}
                        disabled={pending || !!c.opened}
                        aria-label={`${t("crewGame.cellAria", { n: i + 1, name: what })}${
                          c.opened ? ` — ${c.opened.memberName ? t("crewGame.cellOpenBy", { name: c.opened.memberName }) : t("crewGame.cellOpen")}` : ""
                        }`}
                        onClick={() => open(i)}
                      >
                        <span className={games.drawNo}>{i + 1}</span>
                        <span>{c.kind === "MISS" ? t("crewGameGridDraw.miss") : c.label}</span>
                        {c.kind === "POINTS" && <small>+{t("crewGame.points", { n: formatNumber(c.points) })}</small>}
                        {c.opened && <small>{c.opened.memberName ?? (c.opened.manual ? t("crewGame.manual") : t("crewGameGridDraw.byDonation"))}</small>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          <RunList name={name} runs={draw.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="griddraw" label={name} />
    </section>
  );
}
