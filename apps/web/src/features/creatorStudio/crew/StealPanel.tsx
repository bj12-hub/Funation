"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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
  type StealBasis,
  type StealRecord,
  type StealRules,
  type StealSlot
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import { shownOverlayAddress } from "./overlayAddress";
import styles from "./crew.module.css";
import steal from "./steal.module.css";

const KIND_LABEL: Record<StealKind, MessageKey> = { PERCENT: "crewOpsSteal.kindPercent", POINTS: "crewOpsSteal.kindPoints", MISS: "crewOpsSteal.kindMiss" };
/** 기준 점수 labels as message keys (STEAL_BASES in crewTypes stays as written). */
const BASIS_KEY: Record<StealBasis, MessageKey> = { BROADCAST: "crewOpsSteal.basisBroadcast", BATTLE: "crewOpsSteal.basisBattle" };
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
  const { t } = useI18n();
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
  const sides = battle?.mode === "MEMBERS" ? battle.matches[0].sides : null;
  const pair = sides ? [sides[0].memberIds[0], sides[1].memberIds[0]] : ["", ""];
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
      setError(res.status === "INVALID" ? res.message : t("crewOpsSteal.loginAgain"));
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
        {t("crewOpsSteal.title")}
      </h2>
      <p className={styles.note}>{t("crewOpsSteal.note")}</p>
      <div className={steal.rules} role="group" aria-label={t("crewOpsSteal.basisAria")}>
        <span className={styles.muted}>{t("crewOpsSteal.basisLabel")}</span>
        <span className={styles.segment}>
          {STEAL_BASES.map((b) => (
            <button
              key={b.key}
              type="button"
              aria-pressed={rules.basis === b.key}
              disabled={pending}
              onClick={() => rules.basis !== b.key && run(() => setStealRules({ basis: b.key, cooldownSec: rules.cooldownSec }))}
            >
              {t(BASIS_KEY[b.key])}
            </button>
          ))}
        </span>
        <label className={steal.cooldown}>
          <span className={styles.muted}>{t("crewOpsSteal.cooldown")}</span>
          <select
            className={styles.select}
            value={rules.cooldownSec}
            disabled={pending}
            onChange={(e) => run(() => setStealRules({ basis: rules.basis, cooldownSec: Number(e.target.value) }))}
          >
            {[...new Set([...STEAL_COOLDOWN_STEPS, rules.cooldownSec])].sort((a, b) => a - b).map((s) => (
              <option key={s} value={s}>
                {s === 0 ? t("crewOpsBroadcast.noTeam") : s >= 60 ? t("crewOpsBattle.minutes", { n: s / 60 }) : t("crewOpsBattle.seconds", { n: s })}
              </option>
            ))}
          </select>
        </label>
        {rules.basis === PLATFORM_STEAL_RULES.basis && rules.cooldownSec === PLATFORM_STEAL_RULES.cooldownSec ? (
          <span className={styles.muted}>{t("crewOpsSteal.platformDefault")}</span>
        ) : (
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => setStealRules({ reset: true }), t("crewOpsSteal.rulesReset"))}>
            {t("crewOpsBattle.resetDefaults")}
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
            {spin.spinning ? t("crewOpsSteal.spinning") : spin.result ? stealText(spin.result) : slots.length ? t("crewOpsSteal.pickAndSpin") : t("crewOpsSteal.makeSlotsFirst")}
          </p>
        </div>

        <div className={steal.controls}>
          <div className={styles.addRow}>
            <select className={styles.select} aria-label={t("crewOpsSteal.thief")} value={thief} onChange={(e) => setThief(e.target.value)}>
              <option value="">{t("crewOpsSteal.thief")}</option>
              {active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <span className={styles.muted}>←</span>
            <select className={styles.select} aria-label={t("crewOpsSteal.target")} value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{t("crewOpsSteal.target")}</option>
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
            {t("crewOpsSteal.spin")}
          </button>
          {rules.basis === "BATTLE" && !battle && <p className={styles.note}>{t("crewOpsSteal.battleOnly")}</p>}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <details className={styles.logs} open={!slots.length}>
            <summary>{t("crewOpsSteal.slotsTitle", { count: slots.length })}</summary>
            <ul className={steal.slots}>
              {rows.map((r, i) => {
                const weight = slots.find((s) => s.id === r.id)?.weight;
                return (
                  <li key={r.id}>
                    <input className={styles.inputSmall} aria-label={t("crewOpsSteal.slotNameAria", { n: i + 1 })} placeholder={t("crewOpsSteal.slotNamePlaceholder")} value={r.label} maxLength={STEAL_LABEL_MAX} onChange={(e) => edit(i, { label: e.target.value })} onBlur={() => save(rows)} />
                    <select className={styles.select} aria-label={t("crewOpsSteal.slotKindAria", { n: i + 1 })} value={r.kind} onChange={(e) => save(rows.map((x, j) => (j === i ? { ...x, kind: e.target.value as StealKind } : x)))}>
                      {(Object.keys(KIND_LABEL) as StealKind[]).map((k) => (
                        <option key={k} value={k}>
                          {t(KIND_LABEL[k])}
                        </option>
                      ))}
                    </select>
                    {r.kind !== "MISS" && (
                      <input
                        className={styles.inputSmall}
                        inputMode="numeric"
                        aria-label={t(r.kind === "PERCENT" ? "crewOpsSteal.slotPercentAria" : "crewOpsSteal.slotPointsAria", { n: i + 1 })}
                        placeholder={r.kind === "PERCENT" ? "%" : t("crewOpsSteal.pointsUnit")}
                        value={r.value}
                        onChange={(e) => edit(i, { value: e.target.value.replace(/\D/g, "").slice(0, 8) })}
                        onBlur={() => save(rows)}
                      />
                    )}
                    <input
                      className={styles.inputSmall}
                      inputMode="numeric"
                      aria-label={t("crewOpsSteal.slotWeightAria", { n: i + 1 })}
                      placeholder={t("crewOpsSteal.weight")}
                      value={r.weight}
                      onChange={(e) => edit(i, { weight: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                      onBlur={() => save(rows)}
                    />
                    <span className={styles.muted}>{weight && totalWeight ? `${Math.round((weight / totalWeight) * 1000) / 10}%` : "-"}</span>
                    <button type="button" className={styles.ghost} disabled={pending} onClick={() => save(rows.filter((_, j) => j !== i))}>
                      {t("crewOps.delete")}
                    </button>
                  </li>
                );
              })}
            </ul>
            {rows.length < STEAL_SLOTS_MAX && (
              <button type="button" className={styles.ghost} onClick={() => setRows([...rows, { id: `st-new-${rows.length}-${Date.now().toString(36)}`, label: "", kind: "PERCENT", value: "", weight: "" }])}>
                {t("crewOpsSteal.addSlot")}
              </button>
            )}
            <p className={styles.note}>{t("crewOpsSteal.slotsNote")}</p>
          </details>
        </div>
      </div>

      {records.length > 0 && (
        <details className={styles.logs}>
          <summary>{t("crewOpsSteal.logs", { count: records.length })}</summary>
          <ul>
            {records.map((r) => (
              <li key={r.id}>
                <span className={styles.muted}>{formatKstTime(r.at, { hour: "2-digit", minute: "2-digit" })}</span> [{r.slotLabel}] {stealText(r)}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className={styles.addRow}>
        <input className={styles.input} value={shownOverlayAddress(origin, overlayPath, "?steal")} readOnly aria-label={t("crewOpsSteal.overlayAddressAria")} onFocus={(e) => e.target.select()} />
        <CopyButton value={`${origin}${overlayPath}?steal`} label={t("crewOpsBroadcast.copy")} className={styles.ghost} />
      </div>
    </section>
  );
}
