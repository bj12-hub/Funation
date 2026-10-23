"use client";

import { useEffect, useRef, useState } from "react";
import { useServerClock } from "@/hooks/useServerClock";
import { formatKstTime, formatNumber } from "@/lib/format";
import { saveSpinMachine, spinMachine } from "@/services/crew/crewGames";
import {
  SPIN_EXAMPLE_ITEMS,
  SPIN_ITEMS_MAX,
  SPIN_KINDS,
  SPIN_LABEL_MAX,
  SPIN_MULTIPLIER_MAX,
  SPIN_TITLE_DEFAULT,
  SPIN_TITLE_MAX,
  SPIN_WEIGHT_MAX,
  type BroadcastResult,
  type CrewMember,
  type GamesView,
  type SpinKind,
  type SpinSettings
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import { spinEffect } from "./SpinOverlay";
import { shownOverlayAddress } from "./overlayAddress";
import styles from "./crew.module.css";
import prize from "./prize.module.css";
import spin from "./spin.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit", second: "2-digit" });

/** The editor keeps numbers as typed ("1." while typing 1.5); they are converted when saved. */
type EditItem = { id: string; label: string; kind: SpinKind; value: string; weight: string };
type Draft = Omit<SpinSettings, "items"> & { items: EditItem[] };

const toDraft = (s: SpinSettings): Draft => ({ ...s, items: s.items.map((i) => ({ ...i, value: i.kind === "MULTIPLY" || i.kind === "ADD" ? String(i.value) : "", weight: String(i.weight) })) });
const fromDraft = (d: Draft) => ({ ...d, items: d.items.map((i) => ({ ...i, label: i.label.trim(), value: i.kind === "MULTIPLY" || i.kind === "ADD" ? Number(i.value) : 0, weight: Number(i.weight) })) });
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;

/**
 * 스핀머신 — code-first (no Figma frame; StreamDonate 스핀머신 · BJ별 집계 참고), inside `/creator/crew/games`. The reel's
 * items (배수 · 점수 더하기 · 문구 · 꽝 with 가중치), 자동 스핀 on 시그니처 후원 (제외 시그니처), and while live a 수동 스핀
 * with an optional 기준 후원, the runs (result hidden until the OBS reel stops) and the 문구 tally.
 */
export function SpinMachinePanel({
  settings,
  signatures,
  members,
  live,
  overlayPath,
  pending,
  run
}: {
  settings: SpinSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: GamesView["live"];
  overlayPath: string;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const [draft, setDraft] = useState(() => toDraft(settings));
  const synced = useRef(JSON.stringify(settings));
  useEffect(() => {
    const next = JSON.stringify(settings);
    if (next !== synced.current) {
      synced.current = next;
      setDraft(toDraft(settings));
    }
  }, [settings]);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const now = useServerClock(live?.serverNow ?? null);

  const edit = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const setItem = (i: number, patch: Partial<EditItem>) => edit({ items: draft.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const dirty = JSON.stringify(fromDraft(draft)) !== synced.current;
  const totalWeight = draft.items.reduce((s, i) => s + (Number.isInteger(Number(i.weight)) && Number(i.weight) > 0 ? Number(i.weight) : 0), 0);
  const known = new Set(signatures.map((s) => s.id));

  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const [sourceId, setSourceId] = useState<string | null>(null);
  const spinId = useRef<string | null>(null);
  const picked = active.some((m) => m.id === memberId) ? memberId : (active[0]?.id ?? "");
  const sources = live?.sources[picked] ?? [];
  // The newest unused donation by default; "" = 기준 후원 없음.
  const source = sourceId === null ? (sources[0]?.id ?? "") : sources.some((x) => x.id === sourceId) ? sourceId : "";

  const spinNow = () => {
    if (!live || !picked) return;
    // One request id per intended spin: a double click or retry never spins twice.
    spinId.current ??= crypto.randomUUID();
    const requestId = spinId.current;
    run(async () => {
      const res = await spinMachine({ broadcastId: live.id, requestId, memberId: picked, sourceId: source || null });
      if (res.status !== "SPUN") return res;
      spinId.current = null;
      setSourceId(null);
      return { status: "SAVED" };
    }, "스핀을 돌렸어요. 결과는 OBS 릴이 멈춘 뒤 보여요.");
  };

  const runs = live?.spin.runs ?? [];
  const tally = live?.spin.tally;

  return (
    <section className={styles.card} aria-labelledby="game-spin">
      <h2 id="game-spin" className={styles.cardTitle}>
        🎰 스핀머신
      </h2>
      <p className={styles.note}>
        슬롯머신 릴을 돌려 배수 · 점수 더하기 · 문구(벌칙 · 미션) · 꽝 중 하나가 나와요. 배수는 그 스핀의 기준 후원 점수에 곱해져요(×2면 그 후원 점수만큼 더해져요). 칸과 확률은
        직접 정해요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          // A signature deleted since may still be excluded: drop it instead of failing the save.
          const next = fromDraft(draft);
          run(() => saveSpinMachine({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), "스핀머신 설정을 저장했어요.");
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>제목</span>
          <input
            className={styles.input}
            aria-label="스핀머신 제목"
            placeholder={SPIN_TITLE_DEFAULT}
            maxLength={SPIN_TITLE_MAX}
            value={draft.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>
            릴 칸 ({draft.items.length}/{SPIN_ITEMS_MAX})
          </span>
          {draft.items.length > 0 && (
            <ul className={spin.items}>
              {draft.items.map((item, i) => {
                const weight = Number(item.weight);
                const valued = item.kind === "MULTIPLY" || item.kind === "ADD";
                return (
                  <li key={item.id}>
                    <input
                      className={styles.inputSmall}
                      aria-label={`칸 ${i + 1} 이름`}
                      placeholder="이름"
                      maxLength={SPIN_LABEL_MAX}
                      value={item.label}
                      onChange={(e) => setItem(i, { label: e.target.value })}
                    />
                    <select className={styles.select} aria-label={`칸 ${i + 1} 종류`} value={item.kind} onChange={(e) => setItem(i, { kind: e.target.value as SpinKind, value: "" })}>
                      {SPIN_KINDS.map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.label}
                        </option>
                      ))}
                    </select>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="decimal"
                      aria-label={`칸 ${i + 1} ${item.kind === "MULTIPLY" ? "배수" : "점수"}`}
                      placeholder={item.kind === "MULTIPLY" ? `배수 (≤ ${SPIN_MULTIPLIER_MAX})` : item.kind === "ADD" ? "점수" : "—"}
                      step={item.kind === "MULTIPLY" ? 0.01 : 1}
                      min={item.kind === "MULTIPLY" ? 1.01 : 1}
                      disabled={!valued}
                      value={item.value}
                      onChange={(e) => setItem(i, { value: e.target.value })}
                    />
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={`칸 ${i + 1} 가중치`}
                      placeholder="가중치"
                      min={1}
                      max={SPIN_WEIGHT_MAX}
                      value={item.weight}
                      onChange={(e) => setItem(i, { weight: e.target.value })}
                    />
                    <span className={styles.muted}>{weight > 0 && totalWeight ? `${Math.round((weight / totalWeight) * 1000) / 10}%` : "-"}</span>
                    <button type="button" className={styles.ghost} onClick={() => edit({ items: draft.items.filter((_, j) => j !== i) })}>
                      삭제
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.items.length >= SPIN_ITEMS_MAX}
              onClick={() => edit({ items: [...draft.items, { id: newId(), label: "", kind: "MULTIPLY", value: "", weight: "10" }] })}
            >
              + 칸 추가
            </button>
            {draft.items.length === 0 && (
              <button
                type="button"
                className={styles.ghost}
                onClick={() => edit({ items: SPIN_EXAMPLE_ITEMS.map((x) => ({ ...x, id: newId(), value: x.kind === "MULTIPLY" || x.kind === "ADD" ? String(x.value) : "", weight: String(x.weight) })) })}
              >
                예시로 채우기
              </button>
            )}
          </span>
          <span className={styles.note}>확률 = 가중치 ÷ 전체 가중치. 문구 칸은 BJ별 집계에 횟수로 쌓여요. 예시 값은 일반적인 기준이니 방송에 맞게 바꿔 주세요.</span>
        </div>

        <div className={prize.field} role="group" aria-label="자동 스핀">
          <label className={styles.checkRow}>
            <input type="checkbox" checked={draft.auto} onChange={(e) => edit({ auto: e.target.checked })} />
            멤버에게 시그니처 후원이 들어오면 자동으로 돌리기
          </label>
          {draft.auto && (
            <>
              <span className={styles.muted}>돌리지 않을 시그니처 (누르면 제외)</span>
              <span className={prize.chips}>
                {signatures.length === 0 && <span className={styles.note}>만든 시그니처가 없어요.</span>}
                {signatures.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={prize.chip}
                    aria-pressed={draft.excluded.includes(s.id)}
                    onClick={() => edit({ excluded: draft.excluded.includes(s.id) ? draft.excluded.filter((x) => x !== s.id) : [...draft.excluded, s.id] })}
                  >
                    {s.name}
                    {!s.active && <span className={styles.muted}>숨김</span>}
                  </button>
                ))}
              </span>
              <span className={styles.note}>후원자가 멤버를 고른 시그니처 후원(금액 일치 · 금액범위 포함)마다 한 번 돌고, 그 후원이 기준 후원이 돼요. 멤버를 고르지 않은 후원은 수동으로 돌려 주세요.</span>
            </>
          )}
        </div>

        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.showIdle} onChange={(e) => edit({ showIdle: e.target.checked })} />
          스핀이 없을 때도 OBS에 머신 보이기
        </label>

        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(toDraft(settings))}>
            되돌리기
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            설정 저장
          </button>
        </div>
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 스핀은 저장한 칸으로 돌아가요.</p>}
          <div className={spin.manual} role="group" aria-label="수동 스핀">
            <select className={styles.select} aria-label="돌릴 멤버" value={picked} onChange={(e) => {
                setMemberId(e.target.value);
                setSourceId(null);
              }}>
              {active.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <select className={styles.select} aria-label="기준 후원" value={source} onChange={(e) => setSourceId(e.target.value)}>
              <option value="">기준 후원 없음</option>
              {sources.map((x) => (
                <option key={x.id} value={x.id}>
                  {formatKstTime(x.at, { hour: "2-digit", minute: "2-digit" })} · {x.label} · {formatNumber(x.points)}점
                </option>
              ))}
            </select>
            <button type="button" className={styles.primary} disabled={pending || !picked || !settings.items.length} onClick={spinNow}>
              돌리기
            </button>
          </div>
          {!settings.items.length && <p className={styles.note}>칸을 저장하면 돌릴 수 있어요.</p>}

          {runs.length === 0 ? (
            <p className={styles.empty}>아직 돌린 스핀이 없어요.</p>
          ) : (
            <ol className={spin.runs} aria-label="스핀 기록">
              {runs.map((r) => {
                const shown = now !== null && now >= Date.parse(r.revealAt);
                const waitSec = now === null ? 0 : Math.ceil((Date.parse(r.showAt) - now) / 1000);
                return (
                  <li key={r.id}>
                    <span className={styles.muted}>{time(r.at)}</span>
                    <span className={styles.chip}>{r.trigger.kind === "SIGNATURE" ? `자동 · ${r.trigger.signatureName}` : "수동"}</span>
                    <span className={styles.boardName}>
                      {r.memberColor && <span className={styles.dot} style={{ background: r.memberColor }} aria-hidden="true" />}
                      {r.memberName}
                    </span>
                    {shown ? (
                      <span className={spin.result}>
                        <strong>{r.label}</strong>
                        {spinEffect(r) && <span className={styles.muted}>{spinEffect(r)}</span>}
                      </span>
                    ) : (
                      <span className={styles.muted}>{waitSec > 0 ? `OBS 대기 ${waitSec}초` : "돌리는 중…"}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {tally && tally.rows.length > 0 && (
            <div className={spin.tally}>
              <span className={styles.muted}>BJ별 집계 (문구 결과)</span>
              <table>
                <thead>
                  <tr>
                    <th scope="col">멤버</th>
                    {tally.columns.map((c) => (
                      <th key={c} scope="col">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tally.rows.map((r) => (
                    <tr key={r.memberId}>
                      <th scope="row">{r.name}</th>
                      {r.counts.map((n, i) => (
                        <td key={tally.columns[i]} data-zero={n === 0 || undefined}>
                          {n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className={styles.addRow}>
        <input className={styles.input} value={shownOverlayAddress(origin, overlayPath, "?spin")} readOnly aria-label="스핀머신 오버레이 주소" onFocus={(e) => e.target.select()} />
        <CopyButton value={`${origin}${overlayPath}?spin`} label="복사" className={styles.ghost} />
      </div>
      <div className={styles.addRow}>
        <input className={styles.input} value={shownOverlayAddress(origin, overlayPath, "?spintally")} readOnly aria-label="BJ별 집계 오버레이 주소" onFocus={(e) => e.target.select()} />
        <CopyButton value={`${origin}${overlayPath}?spintally`} label="복사" className={styles.ghost} />
      </div>
    </section>
  );
}
