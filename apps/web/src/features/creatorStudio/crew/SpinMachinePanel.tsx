"use client";

import { saveSpinMachine } from "@/services/crew/crewGames";
import {
  SPIN_EXAMPLE_ITEMS,
  SPIN_ITEMS_MAX,
  SPIN_KINDS,
  SPIN_LABEL_MAX,
  SPIN_MULTIPLIER_MAX,
  SPIN_TITLE_DEFAULT,
  SPIN_WEIGHT_MAX,
  type CrewMember,
  type GamesView,
  type SpinKind,
  type SpinSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, ManualPlay, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps numbers as typed ("1." while typing 1.5); they are converted when saved. */
type EditItem = { id: string; label: string; kind: SpinKind; value: string; weight: string };
type Draft = Omit<SpinSettings, "items"> & { items: EditItem[] };

const valued = (kind: SpinKind) => kind === "MULTIPLY" || kind === "ADD";
const toDraft = (s: SpinSettings): Draft => ({ ...s, items: s.items.map((i) => ({ ...i, value: valued(i.kind) ? String(i.value) : "", weight: String(i.weight) })) });
const fromDraft = (d: Draft) => ({ ...d, items: d.items.map((i) => ({ ...i, label: i.label.trim(), value: valued(i.kind) ? Number(i.value) : 0, weight: Number(i.weight) })) });
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;

/**
 * 스핀머신 — code-first (no Figma frame; StreamDonate 스핀머신 · BJ별 집계 참고), inside `/creator/crew/games`. The reel's
 * items (배수 · 점수 더하기 · 문구 · 꽝 with 가중치), 자동 on 시그니처 후원 (제외 시그니처), and while live a 수동 spin with
 * an optional 기준 후원, the runs (result hidden until the OBS reel stops) and the 문구 tally.
 */
export function SpinMachinePanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: SpinSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const setItem = (i: number, patch: Partial<EditItem>) => edit({ items: draft.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const totalWeight = draft.items.reduce((s, i) => s + (Number.isInteger(Number(i.weight)) && Number(i.weight) > 0 ? Number(i.weight) : 0), 0);
  const known = new Set(signatures.map((s) => s.id));
  const tally = live?.spin.tally;

  return (
    <section id="game-spin" className={styles.card} aria-labelledby="game-spin-title">
      <h2 id="game-spin-title" className={styles.cardTitle}>
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
        <TitleField name="스핀머신" placeholder={SPIN_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />

        <div className={prize.field}>
          <span className={styles.muted}>
            릴 칸 ({draft.items.length}/{SPIN_ITEMS_MAX})
          </span>
          {draft.items.length > 0 && (
            <ul className={games.items}>
              {draft.items.map((item, i) => {
                const weight = Number(item.weight);
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
                      disabled={!valued(item.kind)}
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
                onClick={() => edit({ items: SPIN_EXAMPLE_ITEMS.map((x) => ({ ...x, id: newId(), value: valued(x.kind) ? String(x.value) : "", weight: String(x.weight) })) })}
              >
                예시로 채우기
              </button>
            )}
          </span>
          <span className={styles.note}>확률 = 가중치 ÷ 전체 가중치. 문구 칸은 BJ별 집계에 횟수로 쌓여요. 예시 값은 일반적인 기준이니 방송에 맞게 바꿔 주세요.</span>
        </div>

        <AutoFields name="스핀머신" verb="돌리기" auto={draft.auto} excluded={draft.excluded} showIdle={draft.showIdle} signatures={signatures} onChange={edit} />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 스핀은 저장한 칸으로 돌아가요.</p>}
          <ManualPlay game="SPIN" name="스핀머신" verb="돌리기" live={live} members={members} disabled={!settings.items.length} pending={pending} run={run} />
          {!settings.items.length && <p className={styles.note}>칸을 저장하면 돌릴 수 있어요.</p>}
          <RunList name="스핀머신" runs={live.spin.runs} now={now} />
          {tally && tally.rows.length > 0 && (
            <div className={games.tally}>
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

      <OverlayAddress overlayPath={overlayPath} param="spin" label="스핀머신" />
      <OverlayAddress overlayPath={overlayPath} param="spintally" label="BJ별 집계" />
    </section>
  );
}
