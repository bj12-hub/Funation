"use client";

import { useEffect, useRef, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
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
import { gameEffect } from "./GameOverlayParts";
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
  return (
    <div className={prize.field}>
      <span className={styles.muted}>제목</span>
      <input className={styles.input} aria-label={`${name} 제목`} placeholder={placeholder} maxLength={GAME_TITLE_MAX} value={value} onChange={(e) => onChange(e.target.value)} />
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
  return (
    <>
      <div className={prize.field} role="group" aria-label={`${name} 자동`}>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={auto} onChange={(e) => onChange({ auto: e.target.checked })} />
          {copy?.auto ?? `멤버에게 시그니처 후원이 들어오면 자동으로 ${verb}`}
        </label>
        {auto && withExcluded && (
          <>
            <span className={styles.muted}>{copy?.excluded ?? "자동으로 하지 않을 시그니처 (누르면 제외)"}</span>
            <span className={prize.chips}>
              {signatures.length === 0 && <span className={styles.note}>만든 시그니처가 없어요.</span>}
              {signatures.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={prize.chip}
                  aria-pressed={excluded.includes(s.id)}
                  onClick={() => onChange({ excluded: excluded.includes(s.id) ? excluded.filter((x) => x !== s.id) : [...excluded, s.id] })}
                >
                  {s.name}
                  {!s.active && <span className={styles.muted}>숨김</span>}
                </button>
              ))}
            </span>
            <span className={styles.note}>
              {copy?.note ??
                "후원자가 멤버를 고른 시그니처 후원(금액 일치 · 금액범위 · 랜덤시그 포함)마다 한 번 하고, 그 후원이 기준 후원이 돼요. 멤버를 고르지 않은 후원은 수동으로 해 주세요."}
            </span>
          </>
        )}
      </div>
      <label className={styles.checkRow}>
        <input type="checkbox" checked={showIdle} onChange={(e) => onChange({ showIdle: e.target.checked })} />
        진행 중인 게임이 없을 때도 OBS에 보이기
      </label>
    </>
  );
}

export function FormActions({ pending, dirty, onReset }: { pending: boolean; dirty: boolean; onReset: () => void }) {
  return (
    <div className={styles.actions}>
      <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={onReset}>
        되돌리기
      </button>
      <button type="submit" className={styles.primary} disabled={pending || !dirty}>
        설정 저장
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
  live,
  members,
  disabled,
  pending,
  run
}: {
  game: GameKey;
  name: string;
  verb: string;
  live: LiveGames;
  members: CrewMember[];
  disabled?: boolean;
  pending: boolean;
  run: RunAction;
}) {
  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);
  const picked = active.some((m) => m.id === memberId) ? memberId : (active[0]?.id ?? "");
  const sources = live.sources[game][picked] ?? [];
  const source = sourceId === null ? (sources[0]?.id ?? "") : sources.some((x) => x.id === sourceId) ? sourceId : "";

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
    }, `${name}: 결과는 OBS에서 연출이 끝난 뒤 보여요.`);
  };

  return (
    <div className={games.manual} role="group" aria-label={`${name} 수동`}>
      <select
        className={styles.select}
        aria-label={`${name} 멤버`}
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
      <select className={styles.select} aria-label={`${name} 기준 후원`} value={source} onChange={(e) => setSourceId(e.target.value)}>
        <option value="">기준 후원 없음</option>
        {sources.map((x) => (
          <option key={x.id} value={x.id}>
            {formatKstTime(x.at, { hour: "2-digit", minute: "2-digit" })} · {x.label} · {formatNumber(x.points)}점
          </option>
        ))}
      </select>
      <button type="button" className={styles.primary} disabled={pending || disabled || !picked} onClick={play}>
        {verb}
      </button>
    </div>
  );
}

/** The latest runs, newest first; a result stays hidden until OBS shows it. */
export function RunList({ name, runs, now }: { name: string; runs: GameRunView[]; now: number | null }) {
  if (!runs.length) return <p className={styles.empty}>아직 기록이 없어요.</p>;
  return (
    <ol className={games.runs} aria-label={`${name} 기록`}>
      {runs.map((r) => {
        const shown = now !== null && now >= Date.parse(r.revealAt);
        const waitSec = now === null ? 0 : Math.ceil((Date.parse(r.showAt) - now) / 1000);
        const effect = gameEffect(r);
        return (
          <li key={r.id}>
            <span className={styles.muted}>{time(r.at)}</span>
            <span className={styles.chip}>
              {r.trigger.kind === "SIGNATURE"
                ? `자동 · ${r.trigger.signatureName}`
                : r.trigger.kind === "AMOUNT"
                  ? `자동 · ${formatNumber(r.trigger.amount)} FN 발동`
                  : r.trigger.kind === "DONATION"
                    ? `자동 · ${formatNumber(r.trigger.amount)} FN 후원`
                    : "수동"}
            </span>
            <span className={styles.boardName}>
              {r.memberColor && <span className={styles.dot} style={{ background: r.memberColor }} aria-hidden="true" />}
              {r.memberName || <span className={styles.muted}>멤버 없음</span>}
            </span>
            {shown ? (
              <span className={games.result}>
                <strong>{r.label}</strong>
                {effect && effect !== r.label && <span className={styles.muted}>{effect}</span>}
              </span>
            ) : (
              <span className={styles.muted}>{waitSec > 0 ? `OBS 대기 ${waitSec}초` : "진행 중…"}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function OverlayAddress({ overlayPath, param, label }: { overlayPath: string; param: string; label: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <div className={styles.addRow}>
      <input className={styles.input} value={shownOverlayAddress(origin, overlayPath, `?${param}`)} readOnly aria-label={`${label} 오버레이 주소`} onFocus={(e) => e.target.select()} />
      <CopyButton value={`${origin}${overlayPath}?${param}`} label="복사" className={styles.ghost} />
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
  const setTier = (i: number, patch: Partial<EditAmountTier>) => onChange(tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  return (
    <div className={prize.field}>
      <span className={styles.muted}>
        금액 구간 ({tiers.length}/{AMOUNT_TIERS_MAX})
      </span>
      {tiers.length > 0 && (
        <ul className={games.tiers}>
          {tiers.map((t, i) => (
            <li key={t.id}>
              <span className={games.tierRow}>
                <input
                  className={styles.inputSmall}
                  type="number"
                  inputMode="numeric"
                  aria-label={`${name} 구간 ${i + 1} 최소 금액`}
                  placeholder="최소"
                  value={t.min}
                  onChange={(e) => setTier(i, { min: e.target.value })}
                />
                <span className={styles.muted}>FN 이상 ~</span>
                <input
                  className={styles.inputSmall}
                  type="number"
                  inputMode="numeric"
                  aria-label={`${name} 구간 ${i + 1} 최대 금액`}
                  placeholder="비우면 이상"
                  value={t.max}
                  onChange={(e) => setTier(i, { max: e.target.value })}
                />
                <span className={styles.muted}>FN →</span>
                <input
                  className={styles.inputSmall}
                  type="number"
                  inputMode="decimal"
                  aria-label={`${name} 구간 ${i + 1} 배수`}
                  step={0.01}
                  min={1.01}
                  max={AMOUNT_TIER_MULTIPLIER_MAX}
                  value={t.multiplier}
                  onChange={(e) => setTier(i, { multiplier: e.target.value })}
                />
                <span className={styles.muted}>배</span>
                <button type="button" className={styles.ghost} onClick={() => onChange(tiers.filter((_, j) => j !== i))}>
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
          disabled={tiers.length >= AMOUNT_TIERS_MAX}
          onClick={() => onChange([...tiers, { id: newTierId(), min: "", max: "", multiplier: "2" }])}
        >
          + 구간 추가
        </button>
        {example && tiers.length === 0 && (
          <button type="button" className={styles.ghost} onClick={() => onChange(toEditTiers(example.map((t) => ({ ...t, id: newTierId() }))))}>
            예시로 채우기
          </button>
        )}
      </span>
      <span className={styles.note}>{note}</span>
    </div>
  );
}
