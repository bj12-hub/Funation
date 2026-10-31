"use client";

import { useEffect, useState } from "react";
import { formatKstTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { clearWheel, saveWheel, spinWheel, stopWheel } from "@/services/creator/broadcastTools";
import {
  WHEEL_COLORS,
  WHEEL_ITEMS_MAX,
  WHEEL_ITEM_TEXT_MAX,
  WHEEL_QTY_MAX,
  WHEEL_STOP_MODES,
  WHEEL_TITLE_MAX,
  type ToolResult,
  type WheelItem,
  type WheelSettings,
  type WheelState,
  type WheelStopMode
} from "@/services/creator/broadcastToolTypes";
import styles from "../crew/crew.module.css";
import { WheelDisc } from "./WheelView";
import tools from "./broadcastTools.module.css";

type Run = (action: () => Promise<ToolResult>, ok?: string) => void;
const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
/** 멈춤 모드 label and hint by key (the service's WHEEL_STOP_MODES stay as written, 2026-11-01). */
const STOP_MODE_TEXT: Record<WheelStopMode, [MessageKey, MessageKey]> = {
  AUTO: ["studioTools.stopAuto", "studioTools.stopAutoHint"],
  MANUAL: ["studioTools.stopManual", "studioTools.stopManualHint"]
};

/**
 * 원형 룰렛 (code-first, 2026-10-30 — StreamDonate 원형 룰렛 참고): the 칸 (a 문구 or a signature, ×수량), 멈춤 모드 and 후원 시
 * 자동 스핀, saved with 저장; 스핀! queues a spin (the server draws the result), 멈춤 stops a 수동 멈춤 one, 비우기 clears the
 * queue. The result shows here once the wheel has stopped on stream.
 */
export function WheelTool({ state, signatures, pending, run }: { state: WheelState; signatures: { id: string; name: string }[]; pending: boolean; run: Run }) {
  const { t } = useI18n();
  const savedJson = JSON.stringify(state.settings);
  const [draft, setDraft] = useState<WheelSettings>(state.settings);
  useEffect(() => setDraft(JSON.parse(savedJson) as WheelSettings), [savedJson]);
  const dirty = JSON.stringify(draft) !== savedJson;
  const setItem = (i: number, patch: Partial<WheelItem>) => setDraft((d) => ({ ...d, items: d.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) }));
  const add = (kind: WheelItem["kind"]) =>
    setDraft((d) => ({ ...d, items: [...d.items, kind === "TEXT" ? { kind, label: "", signatureId: null, qty: 1 } : { kind, label: signatures[0]?.name ?? "", signatureId: signatures[0]?.id ?? null, qty: 1 }] }));

  // What is on stream now, by this screen's clock (the 방송 도구 screen refreshes after each action).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, []);
  const started = now === null ? [] : state.spins.filter((s) => s.startAt && Date.parse(s.startAt) <= now);
  const current = started.at(-1) ?? null;
  const waiting = state.spins.length - started.length;
  const spinning = !!current && !current.stopAt;
  const results = state.spins.filter((s) => s.result !== null && s.stopAt && now !== null && Date.parse(s.stopAt) <= now).reverse().slice(0, 5);

  return (
    <div className={styles.startForm}>
      <div className={tools.wheelRow}>
        <WheelDisc slices={draft.items.map((it, i) => ({ label: it.label || t("studioTools.emptySlice"), qty: it.qty, color: WHEEL_COLORS[i % WHEEL_COLORS.length] }))} size={180} />
        <div className={tools.wheelSide}>
          <p className={styles.muted} role="status">
            {current
              ? spinning
                ? `${t("studioTools.wheelSpinning")}${current.stopMode === "MANUAL" ? t("studioTools.wheelPressStop") : ""}`
                : current.result !== null
                  ? t("studioTools.wheelResult", { label: current.slices[current.result].label })
                  : t("studioTools.wheelStopping")
              : t("studioTools.wheelIdle")}
            {waiting > 0 && t("studioTools.wheelWaiting", { count: waiting })}
          </p>
          <span className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={pending || !state.settings.items.length}
              onClick={() => run(() => spinWheel({ requestId: crypto.randomUUID() }), waiting > 0 || spinning ? t("studioTools.wheelQueued") : t("studioTools.wheelSpun"))}
            >
              {t("studioTools.spin")}
            </button>
            {spinning && current.stopMode === "MANUAL" && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => stopWheel(), t("studioTools.wheelStopped"))}>
                {t("studioTools.stop")}
              </button>
            )}
            <button type="button" className={styles.ghost} disabled={pending || !state.spins.length} onClick={() => run(() => clearWheel(), t("studioTools.wheelCleared"))}>
              {t("studioTools.clear")}
            </button>
          </span>
          {results.length > 0 && (
            <ol className={tools.wheelResults} aria-label={t("studioTools.recentResults")}>
              {results.map((s) => (
                <li key={s.id}>
                  <b>{s.slices[s.result!].label}</b>{" "}
                  <span className={styles.muted}>
                    {s.donor ? t("studioTools.byDonor", { name: s.donor }) : t("studioTools.bySpin")}
                    {time(s.stopAt!)}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      <form
        className={styles.startForm}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveWheel(draft), t("studioTools.wheelSaved"));
        }}
      >
        <input
          className={styles.input}
          aria-label={t("studioTools.wheelName")}
          placeholder={t("studioTools.wheelNamePlaceholder")}
          maxLength={WHEEL_TITLE_MAX}
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
        <div className={styles.addRow}>
          <span className={styles.segment} role="group" aria-label={t("studioTools.stopModeAria")}>
            {WHEEL_STOP_MODES.map((m) => (
              <button key={m.key} type="button" aria-pressed={draft.stopMode === m.key} title={t(STOP_MODE_TEXT[m.key][1])} onClick={() => setDraft({ ...draft, stopMode: m.key })}>
                {t(STOP_MODE_TEXT[m.key][0])}
              </button>
            ))}
          </span>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.autoSpin} onChange={(e) => setDraft({ ...draft, autoSpin: e.target.checked })} />
            {t("studioTools.autoSpin")}
          </label>
        </div>
        <ul className={tools.wheelItems} aria-label={t("studioTools.slicesAria")}>
          {draft.items.map((it, i) => (
            <li key={i}>
              <i className={tools.wheelSwatch} style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} aria-hidden="true" />
              {it.kind === "TEXT" ? (
                <input
                  className={styles.input}
                  aria-label={t("studioTools.sliceText", { n: i + 1 })}
                  placeholder={t("studioTools.textPlaceholder")}
                  maxLength={WHEEL_ITEM_TEXT_MAX}
                  value={it.label}
                  onChange={(e) => setItem(i, { label: e.target.value })}
                />
              ) : (
                <select
                  className={styles.select}
                  aria-label={t("studioTools.sliceSignature", { n: i + 1 })}
                  value={it.signatureId ?? ""}
                  onChange={(e) => setItem(i, { signatureId: e.target.value, label: signatures.find((s) => s.id === e.target.value)?.name ?? "" })}
                >
                  {!signatures.some((s) => s.id === it.signatureId) && (
                    <option value={it.signatureId ?? ""}>
                      {it.label || t("studioTools.pickSignature")}
                      {t("studioTools.missingSuffix")}
                    </option>
                  )}
                  {signatures.map((s) => (
                    <option key={s.id} value={s.id}>
                      ⭐ {s.name}
                    </option>
                  ))}
                </select>
              )}
              <span className={styles.muted}>×</span>
              <input
                className={styles.inputSmall}
                type="number"
                min={1}
                max={WHEEL_QTY_MAX}
                aria-label={t("studioTools.sliceQty", { n: i + 1 })}
                value={it.qty}
                onChange={(e) => setItem(i, { qty: Math.max(1, Math.min(WHEEL_QTY_MAX, Math.trunc(Number(e.target.value) || 1))) })}
              />
              <button type="button" className={styles.ghost} onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))}>
                {t("studioTools.delete")}
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.addRow}>
          <button type="button" className={styles.ghost} disabled={draft.items.length >= WHEEL_ITEMS_MAX} onClick={() => add("TEXT")}>
            {t("studioTools.addTextSlice")}
          </button>
          <button type="button" className={styles.ghost} disabled={draft.items.length >= WHEEL_ITEMS_MAX || !signatures.length} onClick={() => add("SIGNATURE")}>
            {t("studioTools.addSignatureSlice")}
          </button>
          <span className={styles.muted}>{t("studioTools.sliceCount", { count: draft.items.length, max: WHEEL_ITEMS_MAX })}</span>
        </div>
        <p className={styles.note}>{t("studioTools.wheelNote")}</p>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(JSON.parse(savedJson) as WheelSettings)}>
            {t("studioTools.revert")}
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            {t("studioTools.save")}
          </button>
        </div>
      </form>
    </div>
  );
}
