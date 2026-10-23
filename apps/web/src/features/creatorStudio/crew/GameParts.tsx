"use client";

import { useEffect, useRef, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { playGame } from "@/services/crew/crewGames";
import { GAME_TITLE_MAX, type BroadcastResult, type CrewMember, type GameKey, type GameRunView, type GamesView } from "@/services/crew/crewTypes";
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

/** 자동 (+ the signatures it skips — pressed = 제외) and whether OBS shows the game between runs. `copy`: a game's own wording. */
export function AutoFields({
  name,
  verb,
  copy,
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
        {auto && (
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
              {r.trigger.kind === "SIGNATURE" ? `자동 · ${r.trigger.signatureName}` : r.trigger.kind === "AMOUNT" ? `자동 · ${formatNumber(r.trigger.amount)} FN 발동` : "수동"}
            </span>
            <span className={styles.boardName}>
              {r.memberColor && <span className={styles.dot} style={{ background: r.memberColor }} aria-hidden="true" />}
              {r.memberName}
            </span>
            {shown ? (
              <span className={games.result}>
                <strong>{r.label}</strong>
                {effect && <span className={styles.muted}>{effect}</span>}
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
