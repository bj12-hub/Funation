"use client";

import { useRef, useState, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { clearSigHunter, nextSigHunter, saveSigHunter, setSigHunter, startSigHunter } from "@/services/crew/crewGames";
import {
  SIG_HUNTER_BANDS_MAX,
  SIG_HUNTER_MULTIPLIER_MAX,
  SIG_HUNTER_ROUNDS_MAX,
  SIG_HUNTER_SLOTS_MAX,
  SIG_HUNTER_TITLE_DEFAULT,
  sigHunterColumns,
  type CrewMember,
  type GamesView,
  type SigHunterSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps a 라운드's numbers as typed ("" = no end for the 금액 범위), with its 추가 금액 구간 the same way. */
type EditBand = { slots: string; priceMin: string; priceMax: string };
type EditRound = EditBand & { id: string; multiplier: string; forfeits: string; bands: EditBand[] };
type Draft = Omit<SigHunterSettings, "rounds"> & { rounds: EditRound[] };

const optional = (v: string) => (v.trim() === "" ? null : Number(v));
const price = (v: number | null) => (v === null ? "" : String(v));
const toDraft = (s: SigHunterSettings): Draft => ({
  ...s,
  rounds: s.rounds.map((r) => ({
    id: r.id,
    slots: String(r.slots),
    priceMin: price(r.priceMin),
    priceMax: price(r.priceMax),
    multiplier: String(r.multiplier),
    forfeits: String(r.forfeits),
    bands: (r.bands ?? []).map((b) => ({ slots: String(b.slots), priceMin: price(b.priceMin), priceMax: price(b.priceMax) }))
  }))
});
const fromBand = (b: EditBand) => ({ slots: Number(b.slots), priceMin: optional(b.priceMin), priceMax: optional(b.priceMax) });
// A 라운드 without 추가 금액 구간 is saved without `bands`, so the card compares equal to it (no false "저장하지 않은 설정").
const fromDraft = (d: Draft) => ({
  ...d,
  rounds: d.rounds.map((r) => ({
    id: r.id,
    ...fromBand(r),
    multiplier: Number(r.multiplier),
    forfeits: Number(r.forfeits || 0),
    ...(r.bands.length ? { bands: r.bands.map(fromBand) } : {})
  }))
});
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;

/**
 * 시그니처 헌터 — code-first (no Figma frame; StreamDonate 시그니처 헌터 참고), inside `/creator/crew/games`. 라운드 (슬롯 ·
 * 금액 범위 · 배수 · 몰수권), 시그니처 후원으로 SOLD OUT · 제외 시그; while live 헌트 시작 / 다음 라운드 / 판 비우기, the board
 * (a slot sells or a 수동 SOLD OUT is restored on click — the studio sees the 몰수권) and the runs.
 */
export function SigHunterPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: SigHunterSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameSigHunter");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const setRound = (i: number, patch: Partial<EditRound>) => edit({ rounds: draft.rounds.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const known = new Set(signatures.map((s) => s.id));
  const startId = useRef<string | null>(null);
  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  // 클릭해제 방지 (2026-10-30, StreamDonate 시그헌터): a sold slot cannot be restored by a stray click.
  const [keepSold, setKeepSold] = useState(false);
  const picked = active.some((m) => m.id === memberId) ? memberId : "";
  const hunter = live?.sigHunter;
  const board = hunter?.board ?? null;
  const sold = board ? board.slots.filter((x) => x.sold).length : 0;
  const forfeitsLeft = board ? board.slots.filter((x) => x.forfeit && !x.sold).length : 0;

  // What each 금액 범위 of a 라운드 would draw from under the draft settings.
  const eligible = (r: EditBand) => {
    const min = optional(r.priceMin);
    const max = optional(r.priceMax);
    return signatures.filter((s) => s.active && !draft.excluded.includes(s.id) && (min === null || s.price >= min) && (max === null || s.price <= max)).length;
  };
  const setBand = (i: number, k: number, patch: Partial<EditBand>) => setRound(i, { bands: draft.rounds[i].bands.map((b, j) => (j === k ? { ...b, ...patch } : b)) });

  const start = () => {
    if (!live) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startSigHunter({ broadcastId: live.id, requestId });
      if (res.status !== "UNAUTHORIZED") startId.current = null;
      return res;
    }, t("crewGameSigHunter.started"));
  };

  return (
    <section id="game-sighunter" className={styles.card} aria-labelledby="game-sighunter-title">
      <h2 id="game-sighunter-title" className={styles.cardTitle}>
        🏹 {name}
      </h2>
      <p className={styles.note}>{t("crewGameSigHunter.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveSigHunter({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={SIG_HUNTER_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameSigHunter.rounds", { count: draft.rounds.length, max: SIG_HUNTER_ROUNDS_MAX })}</span>
          <ul className={games.tiers}>
            {draft.rounds.map((r, i) => {
              const ranges = [r, ...r.bands];
              const counts = ranges.map(eligible);
              const empty = counts.findIndex((c) => c === 0);
              const repeats = ranges.some((x, k) => Number(x.slots) > counts[k]);
              const total = ranges.reduce((s, x) => s + (Number(x.slots) || 0), 0);
              const round = t("crewGameSigHunter.roundName", { n: i + 1 });
              const detail = r.bands.length
                ? [
                    t("crewGameSigHunter.candBase", { n: counts[0] }),
                    ...r.bands.map((_, k) => t("crewGameSigHunter.candBand", { k: k + 1, n: counts[k + 1] })),
                    t("crewGameSigHunter.candTotal", { n: total })
                  ].join(" · ")
                : t("crewGameSigHunter.candCount", { n: counts[0] });
              return (
                <li key={r.id}>
                  <span className={games.tierRow}>
                    <strong>{round}</strong>
                    <input
                      className={`${styles.inputSmall} ${games.short}`}
                      type="number"
                      inputMode="numeric"
                      aria-label={t("crewGameSigHunter.slotsAria", { round })}
                      min={1}
                      max={SIG_HUNTER_SLOTS_MAX}
                      value={r.slots}
                      onChange={(e) => setRound(i, { slots: e.target.value })}
                    />
                    <span className={styles.muted}>{t("crewGameSigHunter.cellsSep")}</span>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={t("crewGameSigHunter.minAria", { round })}
                      placeholder={t("crewGame.min")}
                      value={r.priceMin}
                      onChange={(e) => setRound(i, { priceMin: e.target.value })}
                    />
                    <span className={styles.muted}>~</span>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={t("crewGameSigHunter.maxAria", { round })}
                      placeholder={t("crewGame.max")}
                      value={r.priceMax}
                      onChange={(e) => setRound(i, { priceMax: e.target.value })}
                    />
                    <span className={styles.muted}>FN · ×</span>
                    <input
                      className={`${styles.inputSmall} ${games.short}`}
                      type="number"
                      inputMode="decimal"
                      aria-label={t("crewGameSigHunter.multiplierAria", { round })}
                      step={0.01}
                      min={1}
                      max={SIG_HUNTER_MULTIPLIER_MAX}
                      value={r.multiplier}
                      onChange={(e) => setRound(i, { multiplier: e.target.value })}
                    />
                    <span className={styles.muted}>{t("crewGameSigHunter.forfeitSep")}</span>
                    <input
                      className={`${styles.inputSmall} ${games.short}`}
                      type="number"
                      inputMode="numeric"
                      aria-label={t("crewGameSigHunter.forfeitsAria", { round })}
                      min={0}
                      value={r.forfeits}
                      onChange={(e) => setRound(i, { forfeits: e.target.value })}
                    />
                    <span className={styles.muted}>{t("crewGameSigHunter.countUnit")}</span>
                    <button type="button" className={styles.ghost} disabled={draft.rounds.length <= 1} onClick={() => edit({ rounds: draft.rounds.filter((_, j) => j !== i) })}>
                      {t("crewGame.delete")}
                    </button>
                  </span>
                  {r.bands.map((b, k) => (
                    <span key={k} className={games.tierRow}>
                      <span className={styles.muted}>{t("crewGameSigHunter.band", { n: k + 1 })}</span>
                      <input
                        className={`${styles.inputSmall} ${games.short}`}
                        type="number"
                        inputMode="numeric"
                        aria-label={t("crewGameSigHunter.bandSlotsAria", { round, n: k + 1 })}
                        min={1}
                        max={SIG_HUNTER_SLOTS_MAX}
                        value={b.slots}
                        onChange={(e) => setBand(i, k, { slots: e.target.value })}
                      />
                      <span className={styles.muted}>{t("crewGameSigHunter.cellsSep")}</span>
                      <input
                        className={styles.inputSmall}
                        type="number"
                        inputMode="numeric"
                        aria-label={t("crewGameSigHunter.bandMinAria", { round, n: k + 1 })}
                        placeholder={t("crewGame.min")}
                        value={b.priceMin}
                        onChange={(e) => setBand(i, k, { priceMin: e.target.value })}
                      />
                      <span className={styles.muted}>~</span>
                      <input
                        className={styles.inputSmall}
                        type="number"
                        inputMode="numeric"
                        aria-label={t("crewGameSigHunter.bandMaxAria", { round, n: k + 1 })}
                        placeholder={t("crewGame.max")}
                        value={b.priceMax}
                        onChange={(e) => setBand(i, k, { priceMax: e.target.value })}
                      />
                      <span className={styles.muted}>FN</span>
                      <button type="button" className={styles.ghost} onClick={() => setRound(i, { bands: r.bands.filter((_, j) => j !== k) })}>
                        {t("crewGameSigHunter.deleteBand")}
                      </button>
                    </span>
                  ))}
                  <span className={prize.inline}>
                    <button
                      type="button"
                      className={styles.ghost}
                      disabled={r.bands.length >= SIG_HUNTER_BANDS_MAX || total >= SIG_HUNTER_SLOTS_MAX}
                      onClick={() => setRound(i, { bands: [...r.bands, { slots: "5", priceMin: "", priceMax: "" }] })}
                    >
                      {t("crewGameSigHunter.addBand")}
                    </button>
                    <span className={empty >= 0 ? styles.error : styles.note}>
                      {empty === 0
                        ? t("crewGameSigHunter.noCandidates")
                        : empty > 0
                          ? t("crewGameSigHunter.bandEmpty", { n: empty })
                          : `${t("crewGameSigHunter.candidates", { detail })}${repeats ? ` — ${t("crewGameSigHunter.repeats")}` : ""}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.rounds.length >= SIG_HUNTER_ROUNDS_MAX}
              onClick={() => {
                const last = draft.rounds.at(-1) ?? { slots: "10", priceMin: "", priceMax: "", multiplier: "1", forfeits: "0", bands: [] };
                edit({ rounds: [...draft.rounds, { ...last, bands: last.bands.map((b) => ({ ...b })), id: newId() }] });
              }}
            >
              {t("crewGameSigHunter.addRound")}
            </button>
          </span>
          <span className={styles.note}>{t("crewGameSigHunter.roundsNote")}</span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameSigHunter.forfeit")}>
          <span className={styles.muted}>{t("crewGameSigHunter.forfeit")}</span>
          <span className={prize.inline}>
            <input
              className={`${styles.inputSmall} ${games.short}`}
              type="number"
              min={0}
              aria-label={t("crewGameSigHunter.forfeitMinAria")}
              style={{ width: 120, flex: "none" }}
              value={String(draft.forfeitMin)}
              onChange={(e) => edit({ forfeitMin: Math.max(0, Math.trunc(Number(e.target.value) || 0)) })}
            />
            <span className={styles.muted}>{t("crewGameSigHunter.forfeitMinNote")}</span>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.forfeitLock} onChange={(e) => edit({ forfeitLock: e.target.checked })} />
              {t("crewGameSigHunter.forfeitLock")}
            </label>
          </span>
          <span className={styles.note}>{t("crewGameSigHunter.forfeitNote")}</span>
        </div>
        <AutoFields
          name={name}
          verb="SOLD OUT"
          copy={{
            auto: t("crewGameSigHunter.autoCopy"),
            excluded: t("crewGameSigHunter.excludedCopy"),
            note: t("crewGameSigHunter.noteCopy")
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <p className={styles.note}>{t("crewGameSigHunter.applyNote")}</p>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && hunter && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameSigHunter.unsaved")}</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {board
                ? `${t("crewGameSigHunter.status", { round: board.round, multiplier: board.multiplier, sold, slots: board.slots.length, left: forfeitsLeft })}${board.advanceAt ? ` · ${t("crewGameSigHunter.advancePending")}` : ""}${board.locked ? ` · ${t("crewGameSigHunter.locked")}` : ""}`
                : t("crewGameSigHunter.noBoard")}
            </span>
            <button type="button" className={styles.primary} disabled={pending} onClick={start}>
              {board ? t("crewGameSigHunter.restart") : t("crewGameSigHunter.start")}
            </button>
            {board && (
              <>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={pending}
                  onClick={() => run(() => nextSigHunter({ broadcastId: live.id, round: board.round }), t("crewGameSigHunter.advanced", { n: board.round + 1 }))}
                >
                  {t("crewGameSigHunter.next")}
                </button>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearSigHunter({ broadcastId: live.id }), t("crewGameSigHunter.cleared"))}>
                  {t("crewGameSigHunter.clear")}
                </button>
              </>
            )}
          </div>
          {board && (
            <>
              {board.locked && <p className={styles.note}>{t("crewGameSigHunter.lockedNote")}</p>}
              {sold === board.slots.length && !board.advanceAt && <p className={styles.note}>{t("crewGameSigHunter.allSold")}</p>}
              <span className={prize.inline}>
                <span className={styles.muted}>{keepSold ? t("crewGameSigHunter.clickHintKeep") : t("crewGameSigHunter.clickHint")}</span>
                <select className={styles.select} aria-label={t("crewGameSigHunter.memberAria")} value={picked} onChange={(e) => setMemberId(e.target.value)}>
                  <option value="">{t("crewGame.noMember")}</option>
                  {active.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <label className={styles.checkRow}>
                  <input type="checkbox" checked={keepSold} onChange={(e) => setKeepSold(e.target.checked)} />
                  {t("crewGameSigHunter.keepSold")}
                </label>
              </span>
              <ol className={games.hunter} style={{ "--hunter-cols": sigHunterColumns(board.slots.length) } as CSSProperties} aria-label={t("crewGameSigHunter.boardAria")}>
                {board.slots.map((x, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className={games.hunterSlot}
                      data-sold={x.sold ? "" : undefined}
                      data-absorbed={x.sold?.absorbedBy ? "" : undefined}
                      style={x.sold?.memberColor ? ({ "--cell-color": x.sold.memberColor } as CSSProperties) : undefined}
                      disabled={pending || (!!x.sold && (keepSold || !x.sold.manual || x.forfeit || !!x.sold.absorbedBy))}
                      aria-pressed={!!x.sold}
                      aria-label={`${t("crewGameSigHunter.slotAria", { n: i + 1, name: x.signatureName })}${x.forfeit ? ` (${t("crewGameSigHunter.forfeit")})` : ""}${x.sold ? ` — SOLD OUT${x.sold.memberName ? ` · ${x.sold.memberName}` : ""}` : ""}`}
                      onClick={() => run(() => setSigHunter({ broadcastId: live.id, requestId: crypto.randomUUID(), index: i, round: board.round, sold: !x.sold, memberId: picked || null }))}
                    >
                      {x.forfeit && <span className={games.forfeit}>{t("crewGameSigHunter.forfeit")}</span>}
                      <span>{x.signatureName}</span>
                      <small>{formatNumber(x.price)} FN</small>
                      {x.sold && (
                        <small>
                          SOLD OUT · {x.sold.memberName ?? (x.sold.manual ? t("crewGame.manual") : t("crewGame.noMember"))}
                          {x.sold.absorbedBy && ` → ${x.sold.absorbedBy}`}
                        </small>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          <RunList name={name} runs={hunter.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="sighunter" label={name} />
    </section>
  );
}
