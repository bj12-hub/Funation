"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { setStealRules, setStealSlots, spinSteal } from "@/services/crew/crewSteal";
import {
  PLATFORM_STEAL_RULES,
  STEAL_BASES,
  STEAL_COOLDOWN_STEPS,
  STEAL_LABEL_MAX,
  STEAL_SLOTS_MAX,
  type Battle,
  type BroadcastResult,
  type CrewMember,
  type StealKind,
  type StealRecord,
  type StealRules,
  type StealSlot
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import styles from "./crew.module.css";
import steal from "./steal.module.css";

const KIND_LABEL: Record<StealKind, string> = { PERCENT: "비율(%)", POINTS: "점수", MISS: "꽝" };
const WHEEL = ["#8b5cf6", "#ec4899", "#3b82f6", "#f59e0b", "#10b981", "#ef4444"];
const SPIN_MS = 3200;
type Row = { id: string; label: string; kind: StealKind; value: string; weight: string };
const toRow = (s: StealSlot): Row => ({ id: s.id, label: s.label, kind: s.kind, value: s.kind === "MISS" ? "" : String(s.value), weight: String(s.weight) });
export const stealText = (r: StealRecord) =>
  r.points > 0 ? `${r.thiefName}님이 ${r.targetName}님의 기여도 ${formatNumber(r.points)}점을 빼앗았어요` : `${r.slotLabel} — ${r.targetName}님의 기여도는 그대로예요`;

/**
 * 기여도 강탈 룰렛 — code-first (no Figma frame), inside `/creator/crew/broadcast` while live. The
 * creator makes the slots; the server draws the slot and moves the points. 강탈 기준 · 쿨다운 (2026-10-05 결정)
 * start from the platform defaults (방송 전체 점수 · 쿨다운 없음) and save as soon as they change.
 */
export function StealPanel({
  broadcastId,
  members,
  slots,
  rules,
  records,
  battle,
  overlayPath,
  pending,
  run
}: {
  broadcastId: string;
  members: CrewMember[];
  slots: StealSlot[];
  rules: StealRules;
  records: StealRecord[];
  battle: Battle | undefined;
  overlayPath: string;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const router = useRouter();
  const active = members.filter((m) => m.active);
  const [rows, setRows] = useState<Row[]>(() => slots.map(toRow));
  const synced = useRef(JSON.stringify(slots));
  useEffect(() => {
    const next = JSON.stringify(slots);
    if (next !== synced.current) {
      synced.current = next;
      setRows(slots.map(toRow));
    }
  }, [slots]);
  // In a BJ 1:1 battle the two BJs are the natural pair.
  const pair = battle?.mode === "MEMBERS" ? [battle.sides[0].memberIds[0], battle.sides[1].memberIds[0]] : ["", ""];
  const [thief, setThief] = useState(pair[0]);
  const [target, setTarget] = useState(pair[1]);
  const [spin, setSpin] = useState<{ deg: number; result: StealRecord | null; spinning: boolean }>({ deg: 0, result: null, spinning: false });
  const spinId = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const valid = (r: Row) => r.label.trim() && Number(r.weight) >= 1 && (r.kind === "MISS" || Number(r.value) >= 1);
  const save = (next: Row[]) => {
    setRows(next);
    if (!next.every(valid)) return;
    run(() =>
      setStealSlots({ slots: next.map((r) => ({ id: r.id, label: r.label.trim(), kind: r.kind, value: r.kind === "MISS" ? 0 : Number(r.value), weight: Number(r.weight) })) })
    );
  };
  const edit = (i: number, patch: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const totalWeight = slots.reduce((s, x) => s + x.weight, 0);

  const doSpin = async () => {
    setError(null);
    spinId.current ??= crypto.randomUUID();
    const res = await spinSteal({ broadcastId, requestId: spinId.current, thiefId: thief, targetId: target });
    if (res.status !== "SPUN") {
      setError(res.status === "INVALID" ? res.message : "다시 로그인해 주세요.");
      if (res.status === "INVALID") spinId.current = null;
      return;
    }
    spinId.current = null;
    const seg = 360 / Math.max(1, slots.length);
    const land = 360 - (Math.max(0, res.slotIndex) + 0.5) * seg;
    setSpin((s) => ({ deg: s.deg - (s.deg % 360) + 360 * 5 + land, result: null, spinning: true }));
    setTimeout(() => {
      setSpin((s) => ({ ...s, result: res.record, spinning: false }));
      router.refresh();
    }, SPIN_MS);
  };

  const seg = 360 / Math.max(1, slots.length);
  const wheel = slots.length
    ? `conic-gradient(${slots.map((_, i) => `${WHEEL[i % WHEEL.length]} ${i * seg}deg ${(i + 1) * seg}deg`).join(", ")})`
    : "var(--color-neutral-soft)";

  return (
    <section className={styles.card} aria-labelledby="bc-steal">
      <h2 id="bc-steal" className={styles.cardTitle}>
        기여도 강탈 룰렛
      </h2>
      <p className={styles.note}>룰렛을 돌려 상대 BJ의 기여도를 빼앗아 와요. 칸과 확률은 직접 정해요. 빼앗는 점수는 상대가 가진 점수보다 클 수 없어요.</p>
      <div className={steal.rules} role="group" aria-label="강탈 기준">
        <span className={styles.muted}>기준 점수</span>
        <span className={styles.segment}>
          {STEAL_BASES.map((b) => (
            <button
              key={b.key}
              type="button"
              aria-pressed={rules.basis === b.key}
              disabled={pending}
              onClick={() => rules.basis !== b.key && run(() => setStealRules({ basis: b.key, cooldownSec: rules.cooldownSec }))}
            >
              {b.label}
            </button>
          ))}
        </span>
        <label className={steal.cooldown}>
          <span className={styles.muted}>쿨다운</span>
          <select
            className={styles.select}
            value={rules.cooldownSec}
            disabled={pending}
            onChange={(e) => run(() => setStealRules({ basis: rules.basis, cooldownSec: Number(e.target.value) }))}
          >
            {[...new Set([...STEAL_COOLDOWN_STEPS, rules.cooldownSec])].sort((a, b) => a - b).map((s) => (
              <option key={s} value={s}>
                {s === 0 ? "없음" : s >= 60 ? `${s / 60}분` : `${s}초`}
              </option>
            ))}
          </select>
        </label>
        {rules.basis === PLATFORM_STEAL_RULES.basis && rules.cooldownSec === PLATFORM_STEAL_RULES.cooldownSec ? (
          <span className={styles.muted}>플랫폼 기본값</span>
        ) : (
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => setStealRules({ reset: true }), "플랫폼 기본값(방송 전체 점수 · 쿨다운 없음)으로 되돌렸어요.")}>
            플랫폼 기본값으로
          </button>
        )}
      </div>

      <div className={steal.layout}>
        <div className={steal.wheelBox}>
          <span className={steal.pointer} aria-hidden="true">
            ▼
          </span>
          <div
            className={steal.wheel}
            style={{ background: wheel, transform: `rotate(${spin.deg}deg)`, transitionDuration: spin.spinning ? `${SPIN_MS}ms` : "0ms" }}
            aria-hidden="true"
          >
            {slots.map((s, i) => (
              <span key={s.id} className={steal.wheelLabel} style={{ transform: `rotate(${(i + 0.5) * seg}deg) translateY(-62px)` }}>
                {s.label}
              </span>
            ))}
          </div>
          <p className={steal.result} role="status" aria-live="polite">
            {spin.spinning ? "돌리는 중…" : spin.result ? stealText(spin.result) : slots.length ? "BJ를 고르고 룰렛을 돌려 보세요." : "아래에서 룰렛 칸을 먼저 만들어 주세요."}
          </p>
        </div>

        <div className={steal.controls}>
          <div className={styles.addRow}>
            <select className={styles.select} aria-label="가져올 BJ" value={thief} onChange={(e) => setThief(e.target.value)}>
              <option value="">가져올 BJ</option>
              {active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <span className={styles.muted}>←</span>
            <select className={styles.select} aria-label="빼앗길 BJ" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">빼앗길 BJ</option>
              {active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={styles.primary}
            disabled={pending || spin.spinning || !slots.length || !thief || !target || thief === target || (rules.basis === "BATTLE" && !battle)}
            onClick={() => void doSpin()}
          >
            룰렛 돌리기
          </button>
          {rules.basis === "BATTLE" && !battle && <p className={styles.note}>기준 점수가 배틀 점수라서 배틀이 진행 중일 때만 돌릴 수 있어요.</p>}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <details className={styles.logs} open={!slots.length}>
            <summary>룰렛 칸 {slots.length}개</summary>
            <ul className={steal.slots}>
              {rows.map((r, i) => {
                const weight = slots.find((s) => s.id === r.id)?.weight;
                return (
                  <li key={r.id}>
                    <input className={styles.inputSmall} aria-label={`칸 ${i + 1} 이름`} placeholder="이름" value={r.label} maxLength={STEAL_LABEL_MAX} onChange={(e) => edit(i, { label: e.target.value })} onBlur={() => save(rows)} />
                    <select className={styles.select} aria-label={`칸 ${i + 1} 종류`} value={r.kind} onChange={(e) => save(rows.map((x, j) => (j === i ? { ...x, kind: e.target.value as StealKind } : x)))}>
                      {(Object.keys(KIND_LABEL) as StealKind[]).map((k) => (
                        <option key={k} value={k}>
                          {KIND_LABEL[k]}
                        </option>
                      ))}
                    </select>
                    {r.kind !== "MISS" && (
                      <input
                        className={styles.inputSmall}
                        inputMode="numeric"
                        aria-label={`칸 ${i + 1} ${r.kind === "PERCENT" ? "비율" : "점수"}`}
                        placeholder={r.kind === "PERCENT" ? "%" : "점"}
                        value={r.value}
                        onChange={(e) => edit(i, { value: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                        onBlur={() => save(rows)}
                      />
                    )}
                    <input
                      className={styles.inputSmall}
                      inputMode="numeric"
                      aria-label={`칸 ${i + 1} 가중치`}
                      placeholder="가중치"
                      value={r.weight}
                      onChange={(e) => edit(i, { weight: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                      onBlur={() => save(rows)}
                    />
                    <span className={styles.muted}>{weight && totalWeight ? `${Math.round((weight / totalWeight) * 1000) / 10}%` : "-"}</span>
                    <button type="button" className={styles.ghost} disabled={pending} onClick={() => save(rows.filter((_, j) => j !== i))}>
                      삭제
                    </button>
                  </li>
                );
              })}
            </ul>
            {rows.length < STEAL_SLOTS_MAX && (
              <button type="button" className={styles.ghost} onClick={() => setRows([...rows, { id: `st-new-${rows.length}-${Date.now().toString(36)}`, label: "", kind: "PERCENT", value: "", weight: "" }])}>
                + 칸 추가
              </button>
            )}
            <p className={styles.note}>이름 · 값 · 가중치를 모두 채우면 바로 저장돼요. 확률 = 가중치 ÷ 전체 가중치.</p>
          </details>
        </div>
      </div>

      {records.length > 0 && (
        <details className={styles.logs}>
          <summary>강탈 기록 {records.length}건</summary>
          <ul>
            {records.map((r) => (
              <li key={r.id}>
                <span className={styles.muted}>{new Date(r.at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span> [{r.slotLabel}] {stealText(r)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className={styles.addRow}>
        <input className={styles.input} value={`${origin}${overlayPath}?steal`} readOnly aria-label="강탈 오버레이 주소" onFocus={(e) => e.target.select()} />
        <CopyButton value={`${origin}${overlayPath}?steal`} label="복사" className={styles.ghost} />
      </div>
    </section>
  );
}
