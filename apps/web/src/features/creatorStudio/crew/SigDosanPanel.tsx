"use client";

import { useEffect, useRef, useState } from "react";
import { formatNumber } from "@/lib/format";
import { clearSigDosan, saveSigDosan, startSigDosan, stepSigDosan } from "@/services/crew/crewGames";
import {
  SIG_DOSAN_BONUS_MAX,
  SIG_DOSAN_DISPLAYS,
  SIG_DOSAN_MODES,
  SIG_DOSAN_STEPS_MAX,
  SIG_DOSAN_STEPS_MIN,
  SIG_DOSAN_TITLE_DEFAULT,
  type CrewMember,
  type GamesView,
  type SigDosanSettings
} from "@/services/crew/crewTypes";
import { DOSAN_SORTS, paintPick, pickDosanSignatures, sortDosanSignatures, type DosanSort } from "./dosanPick";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps the bonus as typed. */
type Draft = Omit<SigDosanSettings, "bonus"> & { bonus: string };
const toDraft = (s: SigDosanSettings): Draft => ({ ...s, bonus: String(s.bonus) });
const fromDraft = (d: Draft) => ({ ...d, bonus: Number(d.bonus || 0) });

/**
 * 시그니처 두산 — code-first (no Figma frame; StreamDonate 시그니처 두산 참고), inside `/creator/crew/games`. 모드 (전체 · VS ·
 * 개인전), 두산 시그니처 (the ladder, the lowest price first), 완주 보너스, 시그니처 후원으로 올리기; while live 두산 시작 /
 * 판 비우기, each lane with 한 단 올리기 · 내리기, the ladder and the runs.
 */
export function SigDosanPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: SigDosanSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const known = new Set(signatures.map((s) => s.id));
  const startId = useRef<string | null>(null);
  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const picked = active.some((m) => m.id === memberId) ? memberId : "";
  const dosan = live?.sigDosan;
  const board = dosan?.board ?? null;
  const byPrice = [...signatures].sort((x, y) => x.price - y.price);
  // 랜덤 선택 · 정렬 (2026-10-28): helpers for the selection below (설정 저장 keeps it).
  const [sort, setSort] = useState<DosanSort>("PRICE_ASC");
  const [pick, setPick] = useState({ min: "", max: "", count: "5" });
  const [pickNote, setPickNote] = useState<string | null>(null);
  // 이미지+음악 있는 것만 (2026-10-30, StreamDonate "이미지+음악 있는 항목만 표시"): the picker and 랜덤 선택 leave the rest out —
  // but the picker keeps the ones already picked, so they can still be taken out (they count toward the 20).
  const [completeOnly, setCompleteOnly] = useState(false);
  const pool = completeOnly ? signatures.filter((s) => s.complete) : signatures;
  const shown = sortDosanSignatures(completeOnly ? signatures.filter((s) => s.complete || draft.signatureIds.includes(s.id)) : signatures, sort);
  const randomPick = () => {
    const num = (v: string) => (v.trim() === "" ? null : Number(v));
    const count = Math.min(SIG_DOSAN_STEPS_MAX, Math.max(1, Math.floor(Number(pick.count) || 0)));
    const res = pickDosanSignatures(pool, { min: num(pick.min), max: num(pick.max), count });
    if (!res.found) return setPickNote("범위 안에 사용 중인 시그니처가 없어요.");
    edit({ signatureIds: res.ids });
    setPickNote(res.found > count ? `범위 안 ${res.found}개 중 ${res.ids.length}개를 골랐어요.` : `범위 안 ${res.found}개를 모두 넣었어요.`);
  };
  const ladder = byPrice.filter((s) => s.active && draft.signatureIds.includes(s.id));
  const toggle = (id: string) => edit({ signatureIds: draft.signatureIds.includes(id) ? draft.signatureIds.filter((x) => x !== id) : [...draft.signatureIds, id] });
  // 끌어서 고르기 (2026-10-30): press on a chip and drag across others — they all take the first one's new state.
  const ids = useRef(draft.signatureIds);
  useEffect(() => {
    ids.current = draft.signatureIds;
  });
  const painting = useRef<boolean | null>(null);
  /** The chip a mouse press just chose: the click that follows the release is not another toggle. */
  const pressed = useRef<string | null>(null);
  useEffect(() => {
    const done = () => {
      painting.current = null;
      // After the click this release fires (same task), however long the press or wherever the drag ended.
      setTimeout(() => (pressed.current = null));
    };
    window.addEventListener("pointerup", done);
    window.addEventListener("pointercancel", done);
    return () => {
      window.removeEventListener("pointerup", done);
      window.removeEventListener("pointercancel", done);
    };
  }, []);
  const paint = (id: string, on: boolean) => {
    ids.current = paintPick(ids.current, id, on, SIG_DOSAN_STEPS_MAX);
    edit({ signatureIds: ids.current });
  };

  const start = () => {
    if (!live) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startSigDosan({ broadcastId: live.id, requestId });
      if (res.status !== "UNAUTHORIZED") startId.current = null;
      return res;
    }, "두산 판을 만들었어요.");
  };

  return (
    <section id="game-sigdosan" className={styles.card} aria-labelledby="game-sigdosan-title">
      <h2 id="game-sigdosan-title" className={styles.cardTitle}>
        🚀 시그니처 두산
      </h2>
      <p className={styles.note}>
        고른 시그니처를 낮은 금액부터 높은 금액까지 한 줄로 세우고, 다음 단의 시그니처 후원이 들어올 때마다 한 단씩 쏘아 올려요. 맨 위까지 먼저 올라간 줄이 완주예요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveSigDosan({ ...next, excluded: [], signatureIds: next.signatureIds.filter((id) => known.has(id)) }), "시그니처 두산 설정을 저장했어요.");
        }}
      >
        <TitleField name="시그니처 두산" placeholder={SIG_DOSAN_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field} role="group" aria-label="시그니처 두산 모드">
          <span className={styles.muted}>모드</span>
          <span className={games.rules}>
            {SIG_DOSAN_MODES.map((m) => (
              <button key={m.key} type="button" className={games.rule} aria-pressed={draft.mode === m.key} onClick={() => edit({ mode: m.key })}>
                <strong>{m.label}</strong>
                <span>{m.note}</span>
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label="시그니처 두산 OBS 표시 방식">
          <span className={styles.muted}>OBS 표시 방식 (저장하면 진행 중인 두산에도 바로)</span>
          <span className={games.rules}>
            {SIG_DOSAN_DISPLAYS.map((d) => (
              <button key={d.key} type="button" className={games.rule} aria-pressed={draft.display === d.key} onClick={() => edit({ display: d.key })}>
                <strong>{d.label}</strong>
                <span>{d.note}</span>
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field}>
          <span className={styles.muted}>
            두산 시그니처 ({draft.signatureIds.length}/{SIG_DOSAN_STEPS_MAX}, 누르거나 끌어서 넣고 빼요)
          </span>
          <span className={games.unit} role="group" aria-label="두산 시그니처 랜덤 선택">
            <input className={styles.inputSmall} type="number" inputMode="numeric" aria-label="랜덤 선택 최소 금액" placeholder="최소" value={pick.min} onChange={(e) => setPick({ ...pick, min: e.target.value })} />
            <span className={styles.muted}>~</span>
            <input className={styles.inputSmall} type="number" inputMode="numeric" aria-label="랜덤 선택 최대 금액" placeholder="최대" value={pick.max} onChange={(e) => setPick({ ...pick, max: e.target.value })} />
            <span className={styles.muted}>FN ·</span>
            <input className={styles.inputSmall} type="number" inputMode="numeric" aria-label="랜덤 선택 개수" min={1} max={SIG_DOSAN_STEPS_MAX} value={pick.count} onChange={(e) => setPick({ ...pick, count: e.target.value })} />
            <span className={styles.muted}>개</span>
            <button type="button" className={styles.ghost} onClick={randomPick}>
              랜덤 선택
            </button>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.signatureIds.length === 0}
              onClick={() => {
                edit({ signatureIds: [] });
                setPickNote(null);
              }}
            >
              선택 해제
            </button>
          </span>
          {pickNote && (
            <span className={styles.note} role="status">
              {pickNote} 설정 저장을 눌러야 두산에 적용돼요.
            </span>
          )}
          <span className={prize.inline}>
            <span className={styles.segment} role="group" aria-label="두산 시그니처 정렬">
              {DOSAN_SORTS.map((x) => (
                <button key={x.key} type="button" aria-pressed={sort === x.key} onClick={() => setSort(x.key)}>
                  {x.label}
                </button>
              ))}
            </span>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={completeOnly} onChange={(e) => setCompleteOnly(e.target.checked)} />
              이미지+음악 있는 것만
            </label>
          </span>
          <span className={prize.chips}>
            {shown.length === 0 && <span className={styles.note}>{completeOnly ? "이미지와 음악이 모두 있는 시그니처가 없어요." : "만든 시그니처가 없어요."}</span>}
            {shown.map((s) => (
              <button
                key={s.id}
                type="button"
                className={games.pick}
                aria-pressed={draft.signatureIds.includes(s.id)}
                disabled={!draft.signatureIds.includes(s.id) && draft.signatureIds.length >= SIG_DOSAN_STEPS_MAX}
                onPointerDown={(e) => {
                  if (e.button !== 0 || e.pointerType !== "mouse") return;
                  e.preventDefault();
                  painting.current = !ids.current.includes(s.id);
                  pressed.current = s.id;
                  paint(s.id, painting.current);
                }}
                onPointerEnter={(e) => {
                  if (painting.current !== null && e.buttons === 1) paint(s.id, painting.current);
                }}
                // A mouse press already chose; keys and touch choose here.
                onClick={() => {
                  if (pressed.current !== s.id) toggle(s.id);
                }}
              >
                {s.name}
                <span className={styles.muted}>{formatNumber(s.price)}</span>
                {!s.active && <span className={styles.muted}>숨김</span>}
              </button>
            ))}
          </span>
          <span className={styles.note}>
            {ladder.length < SIG_DOSAN_STEPS_MIN
              ? `사용 중인 시그니처를 ${SIG_DOSAN_STEPS_MIN}개 이상 골라야 시작할 수 있어요. 숨긴 시그니처는 들어가지 않아요.`
              : `낮은 금액부터 ${ladder.length}단: ${ladder.map((s) => s.name).join(" → ")}`}
          </span>
        </div>
        <label className={games.unit}>
          <span className={styles.muted}>완주 보너스</span>
          <input
            className={styles.inputSmall}
            type="number"
            inputMode="numeric"
            aria-label="완주 보너스 점수"
            min={0}
            max={SIG_DOSAN_BONUS_MAX}
            value={draft.bonus}
            onChange={(e) => edit({ bonus: e.target.value })}
          />
          <span className={styles.muted}>점 — 완주한 후원의 멤버에게, 0이면 점수 없음</span>
        </label>
        <AutoFields
          name="시그니처 두산"
          verb="올리기"
          copy={{ auto: "시그니처 후원으로 한 단씩 올리기", excluded: "", note: "" }}
          withExcluded={false}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <p className={styles.note}>
          다음 단의 시그니처 후원(금액 일치 · 금액범위 · 랜덤시그 · 메들리 포함)만 그 줄을 올려요. 전체는 멤버를 고르지 않은 후원도, VS는 팀에 배정된 멤버를 고른 후원만, 개인전은 그 멤버를 고른 후원만
          올려요. 모드 · 시그니처는 다음 두산 시작부터 적용돼요.
        </p>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && dosan && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 두산 시작은 저장한 설정으로 판을 만들어요.</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {board
                ? `${SIG_DOSAN_MODES.find((m) => m.key === board.mode)!.label} · ${board.ladder.length}단${board.winner ? ` · 🏁 ${board.winner.label} 완주${board.winner.memberName ? `(${board.winner.memberName})` : ""}` : ""}`
                : "판이 없어요. 두산 시작을 누르면 저장한 시그니처로 판을 만들어요."}
            </span>
            <button type="button" className={styles.primary} disabled={pending} onClick={start}>
              {board ? "처음부터 다시 시작" : "두산 시작"}
            </button>
            {board && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearSigDosan({ broadcastId: live.id }), "두산 판을 비웠어요.")}>
                판 비우기
              </button>
            )}
          </div>
          {board && (
            <>
              <ol className={games.ladder} aria-label="두산 순서">
                {board.ladder.map((x, i) => (
                  <li key={x.signatureId}>
                    <span className={styles.muted}>{i + 1}단</span> {x.signatureName} <span className={styles.muted}>{formatNumber(x.price)} FN</span>
                  </li>
                ))}
              </ol>
              {board.mode !== "SOLO" && (
                <span className={prize.inline}>
                  <span className={styles.muted}>한 단 올리기는 이 멤버의 후원으로 쳐요(선택{board.mode === "VS" ? ", 그 팀 멤버" : ""})</span>
                  <select className={styles.select} aria-label="한 단 올릴 멤버" value={picked} onChange={(e) => setMemberId(e.target.value)}>
                    <option value="">멤버 없음</option>
                    {active.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </span>
              )}
              <ul className={games.lanes} aria-label="두산 줄">
                {board.lanes.map((lane) => {
                  const next = board.ladder[lane.steps.length];
                  return (
                    <li key={lane.key} data-win={board.winner?.lane === lane.key || undefined}>
                      <span className={styles.boardName}>
                        {lane.color && <span className={styles.dot} style={{ background: lane.color }} aria-hidden="true" />}
                        {lane.label}
                      </span>
                      <span>
                        {lane.steps.length}/{board.ladder.length}단
                      </span>
                      <span className={styles.muted}>
                        {next ? `다음: ${next.signatureName} (${formatNumber(next.price)} FN)` : board.winner?.lane === lane.key ? "🏁 완주" : "완주"}
                      </span>
                      <button
                        type="button"
                        className={styles.ghost}
                        aria-label={`${lane.label} 한 단 올리기`}
                        disabled={pending || !!board.winner}
                        onClick={() =>
                          run(() => stepSigDosan({ broadcastId: live.id, lane: lane.key, up: true, requestId: crypto.randomUUID(), memberId: board.mode === "SOLO" ? null : picked || null }))
                        }
                      >
                        ▲ 한 단
                      </button>
                      <button
                        type="button"
                        className={styles.ghost}
                        aria-label={`${lane.label} 한 단 내리기`}
                        disabled={pending || !!board.winner || lane.steps.length === 0}
                        onClick={() => run(() => stepSigDosan({ broadcastId: live.id, lane: lane.key, up: false, requestId: crypto.randomUUID(), count: lane.steps.length }))}
                      >
                        ▼
                      </button>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <RunList name="시그니처 두산" runs={dosan.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="sigdosan" label="시그니처 두산" />
    </section>
  );
}
