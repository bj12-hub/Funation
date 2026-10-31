"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { clearSigDosan, saveSigDosan, startSigDosan, stepSigDosan } from "@/services/crew/crewGames";
import {
  SIG_DOSAN_BONUS_MAX,
  SIG_DOSAN_DISPLAYS,
  SIG_DOSAN_MODES,
  SIG_DOSAN_STEPS_MAX,
  SIG_DOSAN_STEPS_MIN,
  SIG_DOSAN_TITLE_DEFAULT,
  type CrewMember,
  type GamesView,
  type SigDosanDisplay,
  type SigDosanMode,
  type SigDosanSettings
} from "@/services/crew/crewTypes";
import { DOSAN_SORTS, paintPick, pickDosanSignatures, sortDosanSignatures, type DosanSort } from "./dosanPick";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps the bonus as typed. */
type Draft = Omit<SigDosanSettings, "bonus"> & { bonus: string };
const toDraft = (s: SigDosanSettings): Draft => ({ ...s, bonus: String(s.bonus) });
const fromDraft = (d: Draft) => ({ ...d, bonus: Number(d.bonus || 0) });
/** `SIG_DOSAN_MODES` · `SIG_DOSAN_DISPLAYS` · `DOSAN_SORTS` labels as message keys. */
const MODE_KEY: Record<SigDosanMode, { label: MessageKey; note: MessageKey }> = {
  ALL: { label: "crewGameSigDosan.modeAll", note: "crewGameSigDosan.modeAllNote" },
  VS: { label: "crewGameSigDosan.modeVs", note: "crewGameSigDosan.modeVsNote" },
  SOLO: { label: "crewGameSigDosan.modeSolo", note: "crewGameSigDosan.modeSoloNote" }
};
const DISPLAY_KEY: Record<SigDosanDisplay, { label: MessageKey; note: MessageKey }> = {
  ROLLER: { label: "crewGameSigDosan.displayRoller", note: "crewGameSigDosan.displayRollerNote" },
  LADDER: { label: "crewGameSigDosan.displayLadder", note: "crewGameSigDosan.displayLadderNote" }
};
const SORT_KEY: Record<DosanSort, MessageKey> = {
  PRICE_ASC: "crewGameSigDosan.sortPriceAsc",
  PRICE_DESC: "crewGameSigDosan.sortPriceDesc",
  NEWEST: "crewGameSigDosan.sortNewest",
  OLDEST: "crewGameSigDosan.sortOldest",
  LIST: "crewGameSigDosan.sortList"
};

/**
 * 시그니처 두산 — code-first (no Figma frame; StreamDonate 시그니처 두산 참고), inside `/creator/crew/games`. 모드 (전체 · VS ·
 * 개인전), 두산 시그니처 (the ladder, the lowest price first), 완주 보너스, 시그니처 후원으로 올리기; while live 두산 시작 /
 * 판 비우기, each lane with 한 단 올리기 · 내리기, the ladder and the runs.
 */
export function SigDosanPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: SigDosanSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const name = t("crewGame.nameSigDosan");
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const startId = useRef<string | null>(null);
  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const picked = active.some((m) => m.id === memberId) ? memberId : "";
  const dosan = live?.sigDosan;
  const board = dosan?.board ?? null;
  const byPrice = [...signatures].sort((x, y) => x.price - y.price);
  // 랜덤 선택 · 정렬 (2026-10-28): helpers for the selection below (설정 저장 keeps it).
  const [sort, setSort] = useState<DosanSort>("PRICE_ASC");
  const [pick, setPick] = useState({ min: "", max: "", count: "5" });
  const [pickNote, setPickNote] = useState<string | null>(null);
  // 이미지+음악 있는 것만 (2026-10-30, StreamDonate "이미지+음악 있는 항목만 표시"): the picker and 랜덤 선택 leave the rest out —
  // but the picker keeps the ones already picked, so they can still be taken out (they count toward the 20).
  const [completeOnly, setCompleteOnly] = useState(false);
  const pool = completeOnly ? signatures.filter((s) => s.complete) : signatures;
  const shown = sortDosanSignatures(completeOnly ? signatures.filter((s) => s.complete || draft.signatureIds.includes(s.id)) : signatures, sort);
  const randomPick = () => {
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const count = Math.min(SIG_DOSAN_STEPS_MAX, Math.max(1, Math.floor(Number(pick.count) || 0)));
    const res = pickDosanSignatures(pool, { min: num(pick.min), max: num(pick.max), count });
    if (!res.found) return setPickNote(t("crewGameSigDosan.pickNone"));
    edit({ signatureIds: res.ids });
    setPickNote(res.found > count ? t("crewGameSigDosan.pickSome", { found: res.found, picked: res.ids.length }) : t("crewGameSigDosan.pickAll", { found: res.found }));
  };
  const ladder = byPrice.filter((s) => s.active && draft.signatureIds.includes(s.id));
  const toggle = (id: string) => edit({ signatureIds: draft.signatureIds.includes(id) ? draft.signatureIds.filter((x) => x !== id) : [...draft.signatureIds, id] });
  // 끌어서 고르기 (2026-10-30): press on a chip and drag across others — they all take the first one's new state.
  const ids = useRef(draft.signatureIds);
  useEffect(() => {
    ids.current = draft.signatureIds;
  });
  const painting = useRef<boolean | null>(null);
  /** The chip a mouse press just chose: the click that follows the release is not another toggle. */
  const pressed = useRef<string | null>(null);
  useEffect(() => {
    const done = () => {
      painting.current = null;
      // After the click this release fires (same task), however long the press or wherever the drag ended.
      setTimeout(() => (pressed.current = null));
    };
    window.addEventListener("pointerup", done);
    window.addEventListener("pointercancel", done);
    return () => {
      window.removeEventListener("pointerup", done);
      window.removeEventListener("pointercancel", done);
    };
  }, []);
  const paint = (id: string, on: boolean) => {
    ids.current = paintPick(ids.current, id, on, SIG_DOSAN_STEPS_MAX);
    edit({ signatureIds: ids.current });
  };
  // A fast drag moves the pointer more than a chip between two events (2026-11-01): the chips on the line between them
  // count too, not only the ones the pointer was seen over.
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const paintRef = useRef(paint);
  useEffect(() => {
    paintRef.current = paint;
  });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const from = lastPoint.current;
      if (painting.current === null || !from || !(e.buttons & 1)) return;
      lastPoint.current = { x: e.clientX, y: e.clientY };
      for (const id of chipsAlong(from, lastPoint.current)) paintRef.current(id, painting.current);
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  const start = () => {
    if (!live) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startSigDosan({ broadcastId: live.id, requestId });
      if (res.status !== "UNAUTHORIZED") startId.current = null;
      return res;
    }, t("crewGameSigDosan.started"));
  };

  return (
    <section id="game-sigdosan" className={styles.card} aria-labelledby="game-sigdosan-title">
      <h2 id="game-sigdosan-title" className={styles.cardTitle}>
        🚀 {name}
      </h2>
      <p className={styles.note}>{t("crewGameSigDosan.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveSigDosan({ ...next, excluded: [], signatureIds: next.signatureIds.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <TitleField name={name} placeholder={SIG_DOSAN_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label={t("crewGameSigDosan.modeAria")}>
          <span className={styles.muted}>{t("crewGameSigDosan.mode")}</span>
          <span className={games.rules}>
            {SIG_DOSAN_MODES.map((m) => (
              <button key={m.key} type="button" className={games.rule} aria-pressed={draft.mode === m.key} onClick={() => edit({ mode: m.key })}>
                <strong>{t(MODE_KEY[m.key].label)}</strong>
                <span>{t(MODE_KEY[m.key].note)}</span>
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameSigDosan.displayAria")}>
          <span className={styles.muted}>{t("crewGameSigDosan.display")}</span>
          <span className={games.rules}>
            {SIG_DOSAN_DISPLAYS.map((d) => (
              <button key={d.key} type="button" className={games.rule} aria-pressed={draft.display === d.key} onClick={() => edit({ display: d.key })}>
                <strong>{t(DISPLAY_KEY[d.key].label)}</strong>
                <span>{t(DISPLAY_KEY[d.key].note)}</span>
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGameSigDosan.sigs", { count: draft.signatureIds.length, max: SIG_DOSAN_STEPS_MAX })}</span>
          <span className={games.unit} role="group" aria-label={t("crewGameSigDosan.randomAria")}>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameSigDosan.randomMinAria")}
              placeholder={t("crewGame.min")}
              value={pick.min}
              onChange={(e) => setPick({ ...pick, min: e.target.value })}
            />
            <span className={styles.muted}>~</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameSigDosan.randomMaxAria")}
              placeholder={t("crewGame.max")}
              value={pick.max}
              onChange={(e) => setPick({ ...pick, max: e.target.value })}
            />
            <span className={styles.muted}>FN ·</span>
            <input
              className={styles.inputSmall}
              type="number"
              inputMode="numeric"
              aria-label={t("crewGameSigDosan.randomCountAria")}
              min={1}
              max={SIG_DOSAN_STEPS_MAX}
              value={pick.count}
              onChange={(e) => setPick({ ...pick, count: e.target.value })}
            />
            <span className={styles.muted}>{t("crewGameSigDosan.countUnit")}</span>
            <button type="button" className={styles.ghost} onClick={randomPick}>
              {t("crewGameSigDosan.random")}
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.signatureIds.length === 0}
              onClick={() => {
                edit({ signatureIds: [] });
                setPickNote(null);
              }}
            >
              {t("crewGameSigDosan.clearPick")}
            </button>
          </span>
          {pickNote && (
            <span className={styles.note} role="status">
              {pickNote} {t("crewGameSigDosan.pickApply")}
            </span>
          )}
          <span className={prize.inline}>
            <span className={styles.segment} role="group" aria-label={t("crewGameSigDosan.sortAria")}>
              {DOSAN_SORTS.map((x) => (
                <button key={x.key} type="button" aria-pressed={sort === x.key} onClick={() => setSort(x.key)}>
                  {t(SORT_KEY[x.key])}
                </button>
              ))}
            </span>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={completeOnly} onChange={(e) => setCompleteOnly(e.target.checked)} />
              {t("crewGameSigDosan.completeOnly")}
            </label>
          </span>
          <span className={prize.chips}>
            {shown.length === 0 && <span className={styles.note}>{completeOnly ? t("crewGameSigDosan.noComplete") : t("crewGame.noSignatures")}</span>}
            {shown.map((s) => (
              <button
                key={s.id}
                type="button"
                className={games.pick}
                data-dosan-sig={s.id}
                aria-pressed={draft.signatureIds.includes(s.id)}
                disabled={!draft.signatureIds.includes(s.id) && draft.signatureIds.length >= SIG_DOSAN_STEPS_MAX}
                onPointerDown={(e) => {
                  if (e.button !== 0 || e.pointerType !== "mouse") return;
                  e.preventDefault();
                  painting.current = !ids.current.includes(s.id);
                  pressed.current = s.id;
                  lastPoint.current = { x: e.clientX, y: e.clientY };
                  paint(s.id, painting.current);
                }}
                onPointerEnter={(e) => {
                  if (painting.current !== null && e.buttons === 1) paint(s.id, painting.current);
                }}
                // A mouse press already chose; keys and touch choose here.
                onClick={() => {
                  if (pressed.current !== s.id) toggle(s.id);
                }}
              >
                {s.name}
                <span className={styles.muted}>{formatNumber(s.price)}</span>
                {!s.active && <span className={styles.muted}>{t("crewGame.hidden")}</span>}
              </button>
            ))}
          </span>
          <span className={styles.note}>
            {ladder.length < SIG_DOSAN_STEPS_MIN
              ? t("crewGameSigDosan.tooFew", { min: SIG_DOSAN_STEPS_MIN })
              : t("crewGameSigDosan.ladder", { n: ladder.length, names: ladder.map((s) => s.name).join(" → ") })}
          </span>
        </div>
        <label className={games.unit}>
          <span className={styles.muted}>{t("crewGameSigDosan.bonus")}</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label={t("crewGameSigDosan.bonusAria")}
            min={0}
            max={SIG_DOSAN_BONUS_MAX}
            value={draft.bonus}
            onChange={(e) => edit({ bonus: e.target.value })}
          />
          <span className={styles.muted}>{t("crewGameSigDosan.bonusNote")}</span>
        </label>
        <AutoFields
          name={name}
          verb={t("crewGameSigDosan.verb")}
          copy={{ auto: t("crewGameSigDosan.autoCopy"), excluded: "", note: "" }}
          withExcluded={false}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <p className={styles.note}>{t("crewGameSigDosan.rulesNote")}</p>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && dosan && (
        <>
          {dirty && <p className={styles.note}>{t("crewGameSigDosan.unsaved")}</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {board
                ? `${t(MODE_KEY[board.mode].label)} · ${t("crewGameSigDosan.steps", { n: board.ladder.length })}${
                    board.winner
                      ? ` · 🏁 ${
                          board.winner.memberName
                            ? t("crewGameSigDosan.winnerBy", { label: board.winner.label, name: board.winner.memberName })
                            : t("crewGameSigDosan.winner", { label: board.winner.label })
                        }`
                      : ""
                  }`
                : t("crewGameSigDosan.noBoard")}
            </span>
            <button type="button" className={styles.primary} disabled={pending} onClick={start}>
              {board ? t("crewGameSigDosan.restart") : t("crewGameSigDosan.start")}
            </button>
            {board && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearSigDosan({ broadcastId: live.id }), t("crewGameSigDosan.cleared"))}>
                {t("crewGameSigDosan.clear")}
              </button>
            )}
          </div>
          {board && (
            <>
              <ol className={games.ladder} aria-label={t("crewGameSigDosan.ladderAria")}>
                {board.ladder.map((x, i) => (
                  <li key={x.signatureId}>
                    <span className={styles.muted}>{t("crewGameSigDosan.steps", { n: i + 1 })}</span> {x.signatureName} <span className={styles.muted}>{formatNumber(x.price)} FN</span>
                  </li>
                ))}
              </ol>
              {board.mode !== "SOLO" && (
                <span className={prize.inline}>
                  <span className={styles.muted}>{board.mode === "VS" ? t("crewGameSigDosan.stepMemberVs") : t("crewGameSigDosan.stepMember")}</span>
                  <select className={styles.select} aria-label={t("crewGameSigDosan.stepMemberAria")} value={picked} onChange={(e) => setMemberId(e.target.value)}>
                    <option value="">{t("crewGame.noMember")}</option>
                    {active.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </span>
              )}
              <ul className={games.lanes} aria-label={t("crewGameSigDosan.lanesAria")}>
                {board.lanes.map((lane) => {
                  const next = board.ladder[lane.steps.length];
                  return (
                    <li key={lane.key} data-win={board.winner?.lane === lane.key || undefined}>
                      <span className={styles.boardName}>
                        {lane.color && <span className={styles.dot} style={{ background: lane.color }} aria-hidden="true" />}
                        {lane.label}
                      </span>
                      <span>{t("crewGameSigDosan.laneSteps", { done: lane.steps.length, all: board.ladder.length })}</span>
                      <span className={styles.muted}>
                        {next
                          ? t("crewGameSigDosan.next", { name: next.signatureName, price: formatNumber(next.price) })
                          : board.winner?.lane === lane.key
                            ? `🏁 ${t("crewGameSigDosan.finished")}`
                            : t("crewGameSigDosan.finished")}
                      </span>
                      <button
                        type="button"
                        className={styles.ghost}
                        aria-label={t("crewGameSigDosan.upAria", { label: lane.label })}
                        disabled={pending || !!board.winner}
                        onClick={() =>
                          run(() => stepSigDosan({ broadcastId: live.id, lane: lane.key, up: true, requestId: crypto.randomUUID(), memberId: board.mode === "SOLO" ? null : picked || null }))
                        }
                      >
                        ▲ {t("crewGameSigDosan.oneStep")}
                      </button>
                      <button
                        type="button"
                        className={styles.ghost}
                        aria-label={t("crewGameSigDosan.downAria", { label: lane.label })}
                        disabled={pending || !!board.winner || lane.steps.length === 0}
                        onClick={() => run(() => stepSigDosan({ broadcastId: live.id, lane: lane.key, up: false, requestId: crypto.randomUUID(), count: lane.steps.length }))}
                      >
                        ▼
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <RunList name={name} runs={dosan.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="sigdosan" label={name} />
    </section>
  );
}

/** The 두산 chips under the line from `a` to `b` (every 6px), in order, each once. */
function chipsAlong(a: { x: number; y: number }, b: { x: number; y: number }) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
  const ids: string[] = [];
  for (let i = 1; i <= steps; i++) {
    const at = document.elementFromPoint(a.x + ((b.x - a.x) * i) / steps, a.y + ((b.y - a.y) * i) / steps);
    const id = at?.closest<HTMLElement>("[data-dosan-sig]")?.dataset.dosanSig;
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
