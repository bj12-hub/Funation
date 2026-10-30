"use client";

import { useEffect, useState } from "react";
import { formatKstTime } from "@/lib/format";
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
  type WheelState
} from "@/services/creator/broadcastToolTypes";
import styles from "../crew/crew.module.css";
import { WheelDisc } from "./WheelView";
import tools from "./broadcastTools.module.css";

type Run = (action: () => Promise<ToolResult>, ok?: string) => void;
const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/**
 * 원형 룰렛 (code-first, 2026-10-30 — StreamDonate 원형 룰렛 참고): the 칸 (a 문구 or a signature, ×수량), 멈춤 모드 and 후원 시
 * 자동 스핀, saved with 저장; 스핀! queues a spin (the server draws the result), 멈춤 stops a 수동 멈춤 one, 비우기 clears the
 * queue. The result shows here once the wheel has stopped on stream.
 */
export function WheelTool({ state, signatures, pending, run }: { state: WheelState; signatures: { id: string; name: string }[]; pending: boolean; run: Run }) {
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
        <WheelDisc slices={draft.items.map((it, i) => ({ label: it.label || "(빈 칸)", qty: it.qty, color: WHEEL_COLORS[i % WHEEL_COLORS.length] }))} size={180} />
        <div className={tools.wheelSide}>
          <p className={styles.muted} role="status">
            {current
              ? spinning
                ? `돌아가는 중${current.stopMode === "MANUAL" ? " — 멈춤을 눌러 주세요" : ""}`
                : current.result !== null
                  ? `결과 · ${current.slices[current.result].label}`
                  : "멈추는 중"
              : "아직 돌리지 않았어요"}
            {waiting > 0 && ` · 대기 ${waiting}`}
          </p>
          <span className={styles.actions}>
            <button
              type="button"
              className={styles.primary}
              disabled={pending || !state.settings.items.length}
              onClick={() => run(() => spinWheel({ requestId: crypto.randomUUID() }), waiting > 0 || spinning ? "다음 스핀을 대기열에 넣었어요." : "룰렛을 돌렸어요.")}
            >
              스핀!
            </button>
            {spinning && current.stopMode === "MANUAL" && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => stopWheel(), "룰렛을 멈췄어요.")}>
                멈춤
              </button>
            )}
            <button type="button" className={styles.ghost} disabled={pending || !state.spins.length} onClick={() => run(() => clearWheel(), "룰렛을 비웠어요.")}>
              비우기
            </button>
          </span>
          {results.length > 0 && (
            <ol className={tools.wheelResults} aria-label="최근 결과">
              {results.map((s) => (
                <li key={s.id}>
                  <b>{s.slices[s.result!].label}</b> <span className={styles.muted}>{s.donor ? `${s.donor} 님 후원 · ` : "스핀! · "}{time(s.stopAt!)}</span>
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
          run(() => saveWheel(draft), "원형 룰렛을 저장했어요.");
        }}
      >
        <input className={styles.input} aria-label="룰렛 이름" placeholder="룰렛 이름 (비우면 원형 룰렛)" maxLength={WHEEL_TITLE_MAX} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
        <div className={styles.addRow}>
          <span className={styles.segment} role="group" aria-label="멈춤 모드">
            {WHEEL_STOP_MODES.map((m) => (
              <button key={m.key} type="button" aria-pressed={draft.stopMode === m.key} title={m.hint} onClick={() => setDraft({ ...draft, stopMode: m.key })}>
                {m.label}
              </button>
            ))}
          </span>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.autoSpin} onChange={(e) => setDraft({ ...draft, autoSpin: e.target.checked })} />
            후원 시 자동 스핀
          </label>
        </div>
        <ul className={tools.wheelItems} aria-label="룰렛 칸">
          {draft.items.map((it, i) => (
            <li key={i}>
              <i className={tools.wheelSwatch} style={{ background: WHEEL_COLORS[i % WHEEL_COLORS.length] }} aria-hidden="true" />
              {it.kind === "TEXT" ? (
                <input className={styles.input} aria-label={`${i + 1}번 칸 문구`} placeholder="문구" maxLength={WHEEL_ITEM_TEXT_MAX} value={it.label} onChange={(e) => setItem(i, { label: e.target.value })} />
              ) : (
                <select
                  className={styles.select}
                  aria-label={`${i + 1}번 칸 시그니처`}
                  value={it.signatureId ?? ""}
                  onChange={(e) => setItem(i, { signatureId: e.target.value, label: signatures.find((s) => s.id === e.target.value)?.name ?? "" })}
                >
                  {!signatures.some((s) => s.id === it.signatureId) && <option value={it.signatureId ?? ""}>{it.label || "시그니처를 골라 주세요"} (없음)</option>}
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
                aria-label={`${i + 1}번 칸 수량`}
                value={it.qty}
                onChange={(e) => setItem(i, { qty: Math.max(1, Math.min(WHEEL_QTY_MAX, Math.trunc(Number(e.target.value) || 1))) })}
              />
              <button type="button" className={styles.ghost} onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((_, j) => j !== i) }))}>
                삭제
              </button>
            </li>
          ))}
        </ul>
        <div className={styles.addRow}>
          <button type="button" className={styles.ghost} disabled={draft.items.length >= WHEEL_ITEMS_MAX} onClick={() => add("TEXT")}>
            + 문구 칸
          </button>
          <button type="button" className={styles.ghost} disabled={draft.items.length >= WHEEL_ITEMS_MAX || !signatures.length} onClick={() => add("SIGNATURE")}>
            + 시그니처 칸
          </button>
          <span className={styles.muted}>
            {draft.items.length}/{WHEEL_ITEMS_MAX}칸 · ×수량만큼 칸이 넓어지고 그만큼 잘 나와요
          </span>
        </div>
        <p className={styles.note}>
          결과는 서버가 정해요(자동 멈춤은 스핀! 누를 때, 수동 멈춤은 멈춤 누를 때). 후원 시 자동 스핀을 켜면 썸네이션 후원이 들어올 때마다 한 번씩 돌고, 돌고 있으면 차례로 기다려요. 이미 대기 중인
          스핀은 저장 전 칸으로 돌아요.
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(JSON.parse(savedJson) as WheelSettings)}>
            되돌리기
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            저장
          </button>
        </div>
      </form>
    </div>
  );
}
