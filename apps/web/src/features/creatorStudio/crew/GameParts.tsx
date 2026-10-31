"use client";

import { useEffect, useRef, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { playGame } from "@/services/crew/crewGames";
import {
  AMOUNT_TIERS_MAX,
  AMOUNT_TIER_MULTIPLIER_MAX,
  GAME_TITLE_MAX,
  type AmountTier,
  type BroadcastResult,
  type CrewMember,
  type GameKey,
  type GameRunView,
  type GamesView
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import { gameEffect, signedPoints } from "./GameOverlayParts";
import { shownOverlayAddress } from "./overlayAddress";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** Shared pieces of the 점수 게임 cards (code-first, `/creator/crew/games`). */

export type RunAction = (action: () => Promise<BroadcastResult>, ok?: string) => void;
export type LiveGames = NonNullable<GamesView["live"]>;

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * A settings form's draft: edits stay local until saved, and a newer saved value (another remote, a refresh) replaces
 * it. `fromDraft` gives what would be saved; the form is dirty when that differs from the saved settings.
 */
export function useSettingsDraft<S, D>(settings: S, toDraft: (s: S) => D, fromDraft: (d: D) => unknown) {
  const [draft, setDraft] = useState(() => toDraft(settings));
  const synced = useRef(JSON.stringify(settings));
  useEffect(() => {
    const next = JSON.stringify(settings);
    if (next !== synced.current) {
      synced.current = next;
      setDraft(toDraft(settings));
    }
  }, [settings, toDraft]);
  return {
    draft,
    edit: (patch: Partial<D>) => setDraft((d) => ({ ...d, ...patch })),
    dirty: JSON.stringify(fromDraft(draft)) !== synced.current,
    reset: () => setDraft(toDraft(settings))
  };
}

export function TitleField({ name, placeholder, value, onChange }: { name: string; placeholder: string; value: string; onChange: (title: string) => void }) {
  const { t } = useI18n();
  return (
    <div className={prize.field}>
      <span className={styles.muted}>{t("crewGame.titleLabel")}</span>
      <input className={styles.input} aria-label={t("crewGame.titleAria", { name })} placeholder={placeholder} maxLength={GAME_TITLE_MAX} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/**
 * 자동 (+ the signatures it skips — pressed = 제외) and whether OBS shows the game between runs. `copy`: a game's own wording;
 * `withExcluded` false hides 제외 (a game with its own signature list).
 */
export function AutoFields({
  name,
  verb,
  copy,
  withExcluded = true,
  auto,
  excluded,
  showIdle,
  signatures,
  onChange
}: {
  name: string;
  /** "돌리기" · "굴리기" */
  verb: string;
  copy?: { auto: string; excluded: string; note: string };
  withExcluded?: boolean;
  auto: boolean;
  excluded: string[];
  showIdle: boolean;
  signatures: GamesView["signatures"];
  onChange: (patch: { auto?: boolean; excluded?: string[]; showIdle?: boolean }) => void;
}) {
  const { t } = useI18n();
  return (
    <>
      <div className={prize.field} role="group" aria-label={t("crewGame.autoAria", { name })}>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={auto} onChange={(e) => onChange({ auto: e.target.checked })} />
          {copy?.auto ?? t("crewGame.autoDefault", { verb })}
        </label>
        {auto && withExcluded && (
          <>
            <span className={styles.muted}>{copy?.excluded ?? t("crewGame.excludedDefault")}</span>
            <span className={prize.chips}>
              {signatures.length === 0 && <span className={styles.note}>{t("crewGame.noSignatures")}</span>}
              {signatures.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={prize.chip}
                  aria-pressed={excluded.includes(s.id)}
                  onClick={() => onChange({ excluded: excluded.includes(s.id) ? excluded.filter((x) => x !== s.id) : [...excluded, s.id] })}
                >
                  {s.name}
                  {!s.active && <span className={styles.muted}>{t("crewGame.hidden")}</span>}
                </button>
              ))}
            </span>
            <span className={styles.note}>{copy?.note ?? t("crewGame.autoNoteDefault")}</span>
          </>
        )}
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={showIdle} onChange={(e) => onChange({ showIdle: e.target.checked })} />
        {t("crewGame.showIdle")}
      </label>
    </>
  );
}

export function FormActions({ pending, dirty, onReset }: { pending: boolean; dirty: boolean; onReset: () => void }) {
  const { t } = useI18n();
  return (
    <div className={styles.actions}>
      <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={onReset}>
        {t("crewGame.revert")}
      </button>
      <button type="submit" className={styles.primary} disabled={pending || !dirty}>
        {t("crewGame.saveSettings")}
      </button>
    </div>
  );
}

/**
 * 수동: an active member and one of their donations in this broadcast as the 기준 후원 (by default the newest one this game
 * has not used), or none. One request id per intended run, so a double click or retry never plays twice.
 */
export function ManualPlay({
  game,
  name,
  verb,
  withSource = true,
  live,
  members,
  disabled,
  pending,
  run
}: {
  game: GameKey;
  name: string;
  verb: string;
  /** false: no 기준 후원 to pick (a game whose results do not use it). */
  withSource?: boolean;
  live: LiveGames;
  members: CrewMember[];
  disabled?: boolean;
  pending: boolean;
  run: RunAction;
}) {
  const { t } = useI18n();
  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const picked = active.some((m) => m.id === memberId) ? memberId : (active[0]?.id ?? "");
  const sources = live.sources[game][picked] ?? [];
  const source = !withSource ? "" : sourceId === null ? (sources[0]?.id ?? "") : sources.some((x) => x.id === sourceId) ? sourceId : "";

  const play = () => {
    if (!picked) return;
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    run(async () => {
      const res = await playGame({ game, broadcastId: live.id, requestId: id, memberId: picked, sourceId: source || null });
      if (res.status !== "PLAYED") return res;
      requestId.current = null;
      setSourceId(null);
      return { status: "SAVED" };
    }, t("crewGame.playedOk", { name }));
  };

  return (
    <div className={games.manual} role="group" aria-label={t("crewGame.manualAria", { name })}>
      <select
        className={styles.select}
        aria-label={t("crewGame.memberAria", { name })}
        value={picked}
        onChange={(e) => {
          setMemberId(e.target.value);
          setSourceId(null);
        }}
      >
        {active.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {withSource && (
        <select className={styles.select} aria-label={t("crewGame.sourceAria", { name })} value={source} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">{t("crewGame.noSource")}</option>
          {sources.map((x) => (
            <option key={x.id} value={x.id}>
              {formatKstTime(x.at, { hour: "2-digit", minute: "2-digit" })} · {x.label} · {t("crewGame.points", { n: formatNumber(x.points) })}
            </option>
          ))}
        </select>
      )}
      <button type="button" className={styles.primary} disabled={pending || disabled || !picked} onClick={play}>
        {verb}
      </button>
    </div>
  );
}

/** The latest runs, newest first; a result stays hidden until OBS shows it. */
export function RunList({ name, runs, now }: { name: string; runs: GameRunView[]; now: number | null }) {
  const { t } = useI18n();
  if (!runs.length) return <p className={styles.empty}>{t("crewGame.noRuns")}</p>;
  return (
    <ol className={games.runs} aria-label={t("crewGame.runsAria", { name })}>
      {runs.map((r) => {
        const shown = now !== null && now >= Date.parse(r.revealAt);
        const waitSec = now === null ? 0 : Math.ceil((Date.parse(r.showAt) - now) / 1000);
        const effect = gameEffect(r);
        return (
          <li key={r.id}>
            <span className={styles.muted}>{time(r.at)}</span>
            <span className={styles.chip}>
              {r.trigger.kind === "SIGNATURE"
                ? t("crewGame.triggerSignature", { name: r.trigger.signatureName })
                : r.trigger.kind === "AMOUNT"
                  ? t("crewGame.triggerAmount", { amount: formatNumber(r.trigger.amount) })
                  : r.trigger.kind === "DONATION"
                    ? t("crewGame.triggerDonation", { amount: formatNumber(r.trigger.amount) })
                    : t("crewGame.manual")}
            </span>
            <span className={styles.boardName}>
              {r.memberColor && <span className={styles.dot} style={{ background: r.memberColor }} aria-hidden="true" />}
              {r.memberName || <span className={styles.muted}>{t("crewGame.noMember")}</span>}
            </span>
            {shown ? (
              <span className={games.result}>
                <strong>{r.label}</strong>
                {effect && effect !== r.label && <span className={styles.muted}>{effect}</span>}
                {r.shares.length > 0 && <span className={styles.muted}>{r.shares.map((x) => `${x.memberName} ${signedPoints(x.points)}`).join(" · ")}</span>}
              </span>
            ) : (
              <span className={styles.muted}>{waitSec > 0 ? t("crewGame.obsWait", { sec: waitSec }) : t("crewGame.running")}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OverlayAddress({ overlayPath, param, label }: { overlayPath: string; param: string; label: string }) {
  const { t } = useI18n();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <div className={styles.addRow}>
      <input className={styles.input} value={shownOverlayAddress(origin, overlayPath, `?${param}`)} readOnly aria-label={t("crewGame.overlayAria", { label })} onFocus={(e) => e.target.select()} />
      <CopyButton value={`${origin}${overlayPath}?${param}`} label={t("crewGame.copy")} className={styles.ghost} />
    </div>
  );
}

/** The editor keeps 금액 구간 numbers as typed; a blank 최대 = 이상 (no upper end). */
export type EditAmountTier = { id: string; min: string; max: string; multiplier: string };
export const toEditTiers = (tiers: AmountTier[]): EditAmountTier[] =>
  tiers.map((t) => ({ id: t.id, min: String(t.min), max: t.max === null ? "" : String(t.max), multiplier: String(t.multiplier) }));
export const fromEditTiers = (tiers: EditAmountTier[]) => tiers.map((t) => ({ id: t.id, min: Number(t.min), max: t.max.trim() === "" ? null : Number(t.max), multiplier: Number(t.multiplier) }));
const newTierId = () => `new-${crypto.randomUUID().slice(0, 8)}`;

/**
 * 금액 구간 editor (기여도 릴레이 · 줍줍 배수 모드): [최소] FN 이상 ~ [최대 — 비우면 이상] FN → [배수] 배, matched top-down.
 * `example`: offered while empty (예시로 채우기).
 */
export function AmountTiersField({
  name,
  tiers,
  onChange,
  example,
  note
}: {
  name: string;
  tiers: EditAmountTier[];
  onChange: (tiers: EditAmountTier[]) => void;
  example?: Omit<AmountTier, "id">[];
  note: string;
}) {
  const { t: tr } = useI18n();
  const setTier = (i: number, patch: Partial<EditAmountTier>) => onChange(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className={prize.field}>
      <span className={styles.muted}>{tr("crewGame.tiersLabel", { count: tiers.length, max: AMOUNT_TIERS_MAX })}</span>
      {tiers.length > 0 && (
        <ul className={games.tiers}>
          {tiers.map((t, i) => (
            <li key={t.id}>
              <span className={games.tierRow}>
                <input
                  className={styles.inputSmall}
                  type="number"
                  inputMode="numeric"
                  aria-label={tr("crewGame.tierMinAria", { name, n: i + 1 })}
                  placeholder={tr("crewGame.min")}
                  value={t.min}
                  onChange={(e) => setTier(i, { min: e.target.value })}
                />
                <span className={styles.muted}>{tr("crewGame.tierFrom")}</span>
                <input
                  className={styles.inputSmall}
                  type="number"
                  inputMode="numeric"
                  aria-label={tr("crewGame.tierMaxAria", { name, n: i + 1 })}
                  placeholder={tr("crewGame.tierMaxPlaceholder")}
                  value={t.max}
                  onChange={(e) => setTier(i, { max: e.target.value })}
                />
                <span className={styles.muted}>FN →</span>
                <input
                  className={styles.inputSmall}
                  type="number"
                  inputMode="decimal"
                  aria-label={tr("crewGame.tierMultiplierAria", { name, n: i + 1 })}
                  step={0.01}
                  min={1.01}
                  max={AMOUNT_TIER_MULTIPLIER_MAX}
                  value={t.multiplier}
                  onChange={(e) => setTier(i, { multiplier: e.target.value })}
                />
                <span className={styles.muted}>{tr("crewGame.times")}</span>
                <button type="button" className={styles.ghost} onClick={() => onChange(tiers.filter((_, j) => j !== i))}>
                  {tr("crewGame.delete")}
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
          disabled={tiers.length >= AMOUNT_TIERS_MAX}
          onClick={() => onChange([...tiers, { id: newTierId(), min: "", max: "", multiplier: "2" }])}
        >
          {tr("crewGame.addTier")}
        </button>
        {example && tiers.length === 0 && (
          <button type="button" className={styles.ghost} onClick={() => onChange(toEditTiers(example.map((t) => ({ ...t, id: newTierId() }))))}>
            {tr("crewGame.fillExample")}
          </button>
        )}
      </span>
      <span className={styles.note}>{note}</span>
    </div>
  );
}

/**
 * 설정 프리셋 (랜덤시그 2026-10-26 · 기여도 릴레이 2026-10-28): the saved 프리셋 (불러오기 fills the card — 설정 저장 applies it — and
 * 삭제) and 지금 설정 저장 under a name (the same name replaces that 프리셋). `summary`: a line about each one.
 */
export function PresetField<P extends { id: string; name: string }>({
  game,
  presets,
  max,
  nameMax,
  summary,
  note,
  dirty,
  pending,
  onLoad,
  onSave,
  onDelete
}: {
  game: string;
  presets: P[];
  max: number;
  nameMax: number;
  summary: (p: P) => string;
  note: string;
  dirty: boolean;
  pending: boolean;
  onLoad: (p: P) => void;
  onSave: (name: string) => void;
  onDelete: (p: P) => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [loaded, setLoaded] = useState<string | null>(null);
  return (
    <div className={prize.field} role="group" aria-label={t("crewGame.presetAria", { game })}>
      <span className={styles.muted}>{t("crewGame.presetLabel", { count: presets.length, max })}</span>
      {presets.length > 0 ? (
        <ul className={games.tiers} aria-label={t("crewGame.presetsAria")}>
          {presets.map((p) => (
            <li key={p.id}>
              <span className={games.tierRow}>
                <strong>{p.name}</strong>
                <span className={styles.muted}>{summary(p)}</span>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={pending}
                  onClick={() => {
                    onLoad(p);
                    setLoaded(p.name);
                  }}
                >
                  {t("crewGame.load")}
                </button>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => onDelete(p)}>
                  {t("crewGame.delete")}
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <span className={styles.note}>{t("crewGame.noPresets")}</span>
      )}
      <span className={prize.inline}>
        <input
          className={styles.input}
          aria-label={t("crewGame.presetName")}
          placeholder={t("crewGame.presetNamePlaceholder")}
          maxLength={nameMax}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="button" className={styles.ghost} disabled={pending || !name.trim()} onClick={() => onSave(name.trim())}>
          {t("crewGame.saveCurrent")}
        </button>
      </span>
      {loaded && dirty && (
        <span className={styles.note} role="status">
          {t("crewGame.presetLoaded", { name: loaded, game })}
        </span>
      )}
      <span className={styles.note}>{note}</span>
    </div>
  );
}
