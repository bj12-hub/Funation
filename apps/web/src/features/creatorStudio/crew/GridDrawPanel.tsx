"use client";

import { useRef, useState, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { clearGridDraw, openGridDraw, saveGridDraw, startGridDraw } from "@/services/crew/crewGames";
import {
  GRID_DRAW_LABEL_MAX,
  GRID_DRAW_POINTS_MAX,
  GRID_DRAW_PRIZES_MAX,
  GRID_DRAW_SIZES,
  GRID_DRAW_TITLE_DEFAULT,
  GRID_DRAW_TRIGGERS,
  GRID_PRIZE_KINDS,
  type CrewMember,
  type GamesView,
  type GridDrawSettings,
  type GridPrizeKind
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps numbers as typed; a SIGNATURE prize's label is the picked signature's name. */
type EditPrize = { id: string; kind: GridPrizeKind; label: string; signatureId: string; points: string; count: string };
type Draft = Omit<GridDrawSettings, "minAmount" | "prizes"> & { minAmount: string; prizes: EditPrize[] };

const toDraft = (s: GridDrawSettings): Draft => ({
  ...s,
  minAmount: String(s.minAmount),
  prizes: s.prizes.map((p) => ({ ...p, signatureId: p.signatureId ?? "", points: p.kind === "POINTS" ? String(p.points) : "", count: String(p.count) }))
});
const fromDraft = (d: Draft) => ({
  ...d,
  minAmount: Number(d.minAmount || 0),
  prizes: d.prizes.map((p) => ({
    id: p.id,
    kind: p.kind,
    label: p.label.trim(),
    signatureId: p.kind === "SIGNATURE" ? p.signatureId || null : null,
    points: p.kind === "POINTS" ? Number(p.points) : 0,
    count: Number(p.count)
  }))
});
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;
const kindLabel = (kind: GridPrizeKind) => GRID_PRIZE_KINDS.find((k) => k.key === kind)!.label;

/**
 * 복불복 뽑기판 — code-first (no Figma frame; StreamDonate 복불복 뽑기판 참고), inside `/creator/crew/games`. 칸 개수, 당첨
 * 목록 (문구 · 시그니처 · 점수 × 칸 수; the rest is 꽝), 후원 시 자동 랜덤 오픈 (시그니처 후원만 / 모든 후원 · 최소 금액 · 제외
 * 시그) and 자동 리셋; while live 뽑기판 시작 / 판 비우기, a random or picked opening for a member, the board (the studio sees
 * the hidden prizes) and the runs.
 */
export function GridDrawPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: GridDrawSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const setPrize = (i: number, patch: Partial<EditPrize>) => edit({ prizes: draft.prizes.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const known = new Set(signatures.map((s) => s.id));
  const startId = useRef<string | null>(null);
  const openId = useRef<string | null>(null);
  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const picked = active.some((m) => m.id === memberId) ? memberId : "";
  const draw = live?.gridDraw;
  const board = draw?.board ?? null;

  const cells = draft.size * draft.size;
  const used = draft.prizes.reduce((s, p) => s + (Number.isInteger(Number(p.count)) && Number(p.count) > 0 ? Number(p.count) : 0), 0);
  const opened = board ? board.cells.filter((c) => c.opened).length : 0;
  const prizesLeft = board ? board.cells.filter((c) => !c.opened && c.kind !== "MISS").length : 0;

  const start = () => {
    if (!live) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startGridDraw({ broadcastId: live.id, requestId });
      if (res.status === "SAVED") startId.current = null;
      return res;
    }, "뽑기판을 새로 만들었어요.");
  };

  // One request id per intended opening (a random one is retried with the same id); a picked cell is refused once open.
  const open = (index: number | null) => {
    if (!live || !board) return;
    const requestId = index === null ? (openId.current ??= crypto.randomUUID()) : crypto.randomUUID();
    run(async () => {
      const res = await openGridDraw({ broadcastId: live.id, requestId, index, round: board.round, memberId: picked || null });
      if (index === null) openId.current = null;
      return res;
    }, "칸을 열었어요. 결과는 OBS에서 연출이 끝난 뒤 보여요.");
  };

  return (
    <section id="game-griddraw" className={styles.card} aria-labelledby="game-griddraw-title">
      <h2 id="game-griddraw-title" className={styles.cardTitle}>
        🎟️ 복불복 뽑기판
      </h2>
      <p className={styles.note}>
        격자 칸마다 당첨(문구 · 시그니처 · 점수)이나 꽝을 숨겨 두고, 후원이 들어오면 닫힌 칸 하나가 무작위로 열려요. 칸을 눌러 직접 열 수도 있어요. 점수 당첨은 연 멤버의 점수가 돼요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveGridDraw({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), "복불복 뽑기판 설정을 저장했어요.");
        }}
      >
        <TitleField name="복불복 뽑기판" placeholder={GRID_DRAW_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label="칸 개수">
          <span className={styles.muted}>칸 개수</span>
          <span className={styles.segment}>
            {GRID_DRAW_SIZES.map((n) => (
              <button key={n} type="button" aria-pressed={draft.size === n} onClick={() => edit({ size: n })}>
                {n}×{n}
              </button>
            ))}
          </span>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>
            당첨 목록 ({draft.prizes.length}/{GRID_DRAW_PRIZES_MAX})
          </span>
          {draft.prizes.length > 0 && (
            <ul className={games.items}>
              {draft.prizes.map((p, i) => (
                <li key={p.id}>
                  {p.kind === "SIGNATURE" ? (
                    <select
                      className={styles.select}
                      aria-label={`당첨 ${i + 1} 시그니처`}
                      value={p.signatureId}
                      onChange={(e) => setPrize(i, { signatureId: e.target.value, label: signatures.find((s) => s.id === e.target.value)?.name ?? "" })}
                    >
                      <option value="">— 시그니처 —</option>
                      {signatures.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                          {s.active ? "" : " (숨김)"}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      className={styles.inputSmall}
                      aria-label={`당첨 ${i + 1} 문구`}
                      placeholder={p.kind === "POINTS" ? "이름 (예: 보너스)" : "문구 (예: 애교 3종)"}
                      maxLength={GRID_DRAW_LABEL_MAX}
                      value={p.label}
                      onChange={(e) => setPrize(i, { label: e.target.value })}
                    />
                  )}
                  <select
                    className={styles.select}
                    aria-label={`당첨 ${i + 1} 종류`}
                    value={p.kind}
                    onChange={(e) => setPrize(i, { kind: e.target.value as GridPrizeKind, label: "", signatureId: "", points: "" })}
                  >
                    {GRID_PRIZE_KINDS.map((k) => (
                      <option key={k.key} value={k.key}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <input
                    className={styles.inputSmall}
                    type="number"
                    inputMode="numeric"
                    aria-label={`당첨 ${i + 1} 점수`}
                    placeholder={p.kind === "POINTS" ? "점수" : "—"}
                    min={1}
                    max={GRID_DRAW_POINTS_MAX}
                    disabled={p.kind !== "POINTS"}
                    value={p.points}
                    onChange={(e) => setPrize(i, { points: e.target.value })}
                  />
                  <input
                    className={styles.inputSmall}
                    type="number"
                    inputMode="numeric"
                    aria-label={`당첨 ${i + 1} 칸 수`}
                    placeholder="칸 수"
                    min={1}
                    max={cells}
                    value={p.count}
                    onChange={(e) => setPrize(i, { count: e.target.value })}
                  />
                  <span className={styles.muted}>칸</span>
                  <button type="button" className={styles.ghost} onClick={() => edit({ prizes: draft.prizes.filter((_, j) => j !== i) })}>
                    삭제
                  </button>
                </li>
              ))}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.prizes.length >= GRID_DRAW_PRIZES_MAX}
              onClick={() => edit({ prizes: [...draft.prizes, { id: newId(), kind: "TEXT", label: "", signatureId: "", points: "", count: "1" }] })}
            >
              + 당첨 추가
            </button>
          </span>
          <span className={used > cells ? styles.error : styles.note}>
            {used > cells
              ? `당첨 칸(${used}칸)이 전체 칸(${cells}칸)보다 많아요. 칸 수를 줄이거나 칸 개수를 늘려 주세요.`
              : `당첨 ${used}칸 · 꽝 ${cells - used}칸 / 전체 ${cells}칸 — 한 칸을 열 때 당첨 확률 ${Math.round((used / cells) * 1000) / 10}%`}
          </span>
        </div>

        <div className={prize.field} role="group" aria-label="자동 오픈 대상">
          <span className={styles.muted}>자동으로 여는 후원</span>
          <span className={prize.inline}>
            <span className={styles.segment}>
              {GRID_DRAW_TRIGGERS.map((t) => (
                <button key={t.key} type="button" aria-pressed={draft.trigger === t.key} onClick={() => edit({ trigger: t.key })}>
                  {t.label}
                </button>
              ))}
            </span>
            <span className={games.unit}>
              <input
                className={styles.inputSmall}
                type="number"
                inputMode="numeric"
                aria-label="자동 오픈 최소 금액"
                min={0}
                value={draft.minAmount}
                onChange={(e) => edit({ minAmount: e.target.value })}
              />
              <span className={styles.muted}>FN 이상</span>
            </span>
          </span>
        </div>
        <AutoFields
          name="복불복 뽑기판"
          verb="열기"
          copy={{
            auto: "후원이 들어오면 닫힌 칸 하나를 자동으로 열기",
            excluded: "칸을 열지 않을 시그니처 (누르면 제외)",
            note: "후원자가 멤버를 골랐으면 그 멤버가 연 칸이 돼요(점수 당첨은 그 멤버 점수). 멤버를 고르지 않은 후원도 칸은 열려요."
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.autoReset} onChange={(e) => edit({ autoReset: e.target.checked })} />
          모든 칸이 열리면 마지막 결과 뒤에 새 판으로 자동 리셋
        </label>
        <p className={styles.note}>칸 개수 · 당첨 목록은 다음 뽑기판 시작(또는 자동 리셋)부터 적용돼요.</p>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && draw && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 뽑기판 시작은 저장한 설정으로 판을 만들어요.</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {board
                ? `${board.size}×${board.size} · ${board.round}판째 · 열린 칸 ${opened}/${board.cells.length} · 남은 당첨 ${prizesLeft}칸${board.resetAt ? " · 결과 연출 뒤 새 판" : ""}`
                : `판이 없어요. 뽑기판 시작을 누르면 저장한 당첨 목록으로 ${settings.size}×${settings.size} 판을 만들어요.`}
            </span>
            <button type="button" className={styles.primary} disabled={pending} onClick={start}>
              {board ? "새 판으로 다시 시작" : "뽑기판 시작"}
            </button>
            {board && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearGridDraw({ broadcastId: live.id }), "뽑기판을 비웠어요.")}>
                판 비우기
              </button>
            )}
          </div>
          {board && (
            <>
              <div className={games.manual} role="group" aria-label="복불복 뽑기판 수동 열기">
                <select className={styles.select} aria-label="칸을 열 멤버" value={picked} onChange={(e) => setMemberId(e.target.value)}>
                  <option value="">멤버 없음</option>
                  {active.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <button type="button" className={styles.primary} disabled={pending || opened === board.cells.length} onClick={() => open(null)}>
                  랜덤으로 한 칸 열기
                </button>
                <span className={styles.muted}>칸을 누르면 그 칸을 열어요. 닫힌 칸의 당첨은 여기서만 보여요.</span>
              </div>
              {!board.resetAt && opened === board.cells.length && <p className={styles.note}>모든 칸이 열렸어요. 새 판으로 다시 시작해 주세요.</p>}
              <ol className={games.bingo} style={{ "--bingo-size": board.size } as CSSProperties} aria-label="복불복 뽑기판">
                {board.cells.map((c, i) => {
                  const what = c.kind === "MISS" ? "꽝" : c.kind === "POINTS" ? `${c.label} +${formatNumber(c.points)}점` : `${kindLabel(c.kind as GridPrizeKind)} · ${c.label}`;
                  return (
                    <li key={i}>
                      <button
                        type="button"
                        className={games.drawCell}
                        data-open={c.opened ? "" : undefined}
                        data-miss={c.kind === "MISS" || undefined}
                        style={c.opened?.memberColor ? ({ "--cell-color": c.opened.memberColor } as CSSProperties) : undefined}
                        disabled={pending || !!c.opened}
                        aria-label={`${i + 1}번 칸 ${what}${c.opened ? ` — 열림${c.opened.memberName ? ` · ${c.opened.memberName}` : ""}` : ""}`}
                        onClick={() => open(i)}
                      >
                        <span className={games.drawNo}>{i + 1}</span>
                        <span>{c.kind === "MISS" ? "꽝" : c.label}</span>
                        {c.kind === "POINTS" && <small>+{formatNumber(c.points)}점</small>}
                        {c.opened && <small>{c.opened.memberName ?? (c.opened.manual ? "수동" : "후원")}</small>}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          <RunList name="복불복 뽑기판" runs={draw.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="griddraw" label="복불복 뽑기판" />
    </section>
  );
}
