"use client";

import { useRef, useState, type CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { clearSigHunter, nextSigHunter, saveSigHunter, setSigHunter, startSigHunter } from "@/services/crew/crewGames";
import {
  SIG_HUNTER_MULTIPLIER_MAX,
  SIG_HUNTER_ROUNDS_MAX,
  SIG_HUNTER_SLOTS_MAX,
  SIG_HUNTER_TITLE_DEFAULT,
  sigHunterColumns,
  type CrewMember,
  type GamesView,
  type SigHunterSettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps a 라운드's numbers as typed ("" = no end for the 금액 범위). */
type EditRound = { id: string; slots: string; priceMin: string; priceMax: string; multiplier: string; forfeits: string };
type Draft = Omit<SigHunterSettings, "rounds"> & { rounds: EditRound[] };

const optional = (v: string) => (v.trim() === "" ? null : Number(v));
const toDraft = (s: SigHunterSettings): Draft => ({
  ...s,
  rounds: s.rounds.map((r) => ({
    id: r.id,
    slots: String(r.slots),
    priceMin: r.priceMin === null ? "" : String(r.priceMin),
    priceMax: r.priceMax === null ? "" : String(r.priceMax),
    multiplier: String(r.multiplier),
    forfeits: String(r.forfeits)
  }))
});
const fromDraft = (d: Draft) => ({
  ...d,
  rounds: d.rounds.map((r) => ({ id: r.id, slots: Number(r.slots), priceMin: optional(r.priceMin), priceMax: optional(r.priceMax), multiplier: Number(r.multiplier), forfeits: Number(r.forfeits || 0) }))
});
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;

/**
 * 시그니처 헌터 — code-first (no Figma frame; StreamDonate 시그니처 헌터 참고), inside `/creator/crew/games`. 라운드 (슬롯 ·
 * 금액 범위 · 배수 · 몰수권), 시그니처 후원으로 SOLD OUT · 제외 시그; while live 헌트 시작 / 다음 라운드 / 판 비우기, the board
 * (a slot sells or a 수동 SOLD OUT is restored on click — the studio sees the 몰수권) and the runs.
 */
export function SigHunterPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: SigHunterSettings;
  signatures: GamesView["signatures"];
  members: CrewMember[];
  live: LiveGames | null;
  now: number | null;
  overlayPath: string;
  pending: boolean;
  run: RunAction;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, toDraft, fromDraft);
  const setRound = (i: number, patch: Partial<EditRound>) => edit({ rounds: draft.rounds.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const known = new Set(signatures.map((s) => s.id));
  const startId = useRef<string | null>(null);
  const active = members.filter((m) => m.active);
  const [memberId, setMemberId] = useState("");
  const picked = active.some((m) => m.id === memberId) ? memberId : "";
  const hunter = live?.sigHunter;
  const board = hunter?.board ?? null;
  const sold = board ? board.slots.filter((x) => x.sold).length : 0;
  const forfeitsLeft = board ? board.slots.filter((x) => x.forfeit && !x.sold).length : 0;

  // What each 라운드 would draw from under the draft settings.
  const eligible = (r: EditRound) => {
    const min = optional(r.priceMin);
    const max = optional(r.priceMax);
    return signatures.filter((s) => s.active && !draft.excluded.includes(s.id) && (min === null || s.price >= min) && (max === null || s.price <= max)).length;
  };

  const start = () => {
    if (!live) return;
    startId.current ??= crypto.randomUUID();
    const requestId = startId.current;
    run(async () => {
      const res = await startSigHunter({ broadcastId: live.id, requestId });
      if (res.status !== "UNAUTHORIZED") startId.current = null;
      return res;
    }, "1라운드 판을 만들었어요.");
  };

  return (
    <section id="game-sighunter" className={styles.card} aria-labelledby="game-sighunter-title">
      <h2 id="game-sighunter-title" className={styles.cardTitle}>
        🏹 시그니처 헌터
      </h2>
      <p className={styles.note}>
        라운드마다 시그니처를 슬롯에 무작위로 깔고, 시그니처 후원이 들어오면 그 슬롯이 SOLD OUT 돼요. 라운드 배수만큼 멤버 점수가 더해지고, 숨은 몰수권을 산 멤버는 다른 멤버들의 SOLD OUT
        기여도를 가져가요. 모든 슬롯이 팔리면 다음 라운드로 넘어가요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          run(() => saveSigHunter({ ...next, excluded: next.excluded.filter((id) => known.has(id)) }), "시그니처 헌터 설정을 저장했어요.");
        }}
      >
        <TitleField name="시그니처 헌터" placeholder={SIG_HUNTER_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field}>
          <span className={styles.muted}>
            라운드 ({draft.rounds.length}/{SIG_HUNTER_ROUNDS_MAX})
          </span>
          <ul className={games.tiers}>
            {draft.rounds.map((r, i) => {
              const n = eligible(r);
              const name = `${i + 1}라운드`;
              return (
                <li key={r.id}>
                  <span className={games.tierRow}>
                    <strong>{name}</strong>
                    <input
                      className={`${styles.inputSmall} ${games.short}`}
                      type="number"
                      inputMode="numeric"
                      aria-label={`${name} 슬롯 수`}
                      min={1}
                      max={SIG_HUNTER_SLOTS_MAX}
                      value={r.slots}
                      onChange={(e) => setRound(i, { slots: e.target.value })}
                    />
                    <span className={styles.muted}>칸 ·</span>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={`${name} 최소 금액`}
                      placeholder="최소"
                      value={r.priceMin}
                      onChange={(e) => setRound(i, { priceMin: e.target.value })}
                    />
                    <span className={styles.muted}>~</span>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={`${name} 최대 금액`}
                      placeholder="최대"
                      value={r.priceMax}
                      onChange={(e) => setRound(i, { priceMax: e.target.value })}
                    />
                    <span className={styles.muted}>FN · ×</span>
                    <input
                      className={`${styles.inputSmall} ${games.short}`}
                      type="number"
                      inputMode="decimal"
                      aria-label={`${name} 배수`}
                      step={0.01}
                      min={1}
                      max={SIG_HUNTER_MULTIPLIER_MAX}
                      value={r.multiplier}
                      onChange={(e) => setRound(i, { multiplier: e.target.value })}
                    />
                    <span className={styles.muted}>· 몰수권</span>
                    <input
                      className={`${styles.inputSmall} ${games.short}`}
                      type="number"
                      inputMode="numeric"
                      aria-label={`${name} 몰수권 수`}
                      min={0}
                      value={r.forfeits}
                      onChange={(e) => setRound(i, { forfeits: e.target.value })}
                    />
                    <span className={styles.muted}>개</span>
                    <button type="button" className={styles.ghost} disabled={draft.rounds.length <= 1} onClick={() => edit({ rounds: draft.rounds.filter((_, j) => j !== i) })}>
                      삭제
                    </button>
                  </span>
                  <span className={n === 0 ? styles.error : styles.note}>
                    후보 시그니처 {n}개{n === 0 ? " — 이 라운드에 넣을 시그니처가 없어요." : Number(r.slots) > n ? " — 슬롯보다 적어 같은 시그니처가 여러 슬롯에 들어가요." : ""}
                  </span>
                </li>
              );
            })}
          </ul>
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.rounds.length >= SIG_HUNTER_ROUNDS_MAX}
              onClick={() => edit({ rounds: [...draft.rounds, { ...(draft.rounds.at(-1) ?? { slots: "10", priceMin: "", priceMax: "", multiplier: "1", forfeits: "0" }), id: newId() }] })}
            >
              + 라운드 추가
            </button>
          </span>
          <span className={styles.note}>
            금액 범위를 비우면 끝이 없어요. 배수 1은 배수 없음이고, 몰수권은 슬롯보다 적게 숨길 수 있어요. 마지막 라운드가 끝나면 마지막 라운드 설정으로 계속돼요.
          </span>
        </div>
        <AutoFields
          name="시그니처 헌터"
          verb="SOLD OUT"
          copy={{
            auto: "시그니처 후원으로 SOLD OUT",
            excluded: "헌터 판에서 뺄 시그니처 (누르면 제외)",
            note: "시그니처 후원(금액 일치 · 금액범위 · 랜덤시그 · 메들리 포함)이 그 시그니처의 남은 첫 슬롯을 SOLD OUT 해요. 멤버를 고르지 않은 후원도 SOLD OUT 되지만 기여도는 없어요."
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <p className={styles.note}>라운드 설정은 다음 라운드부터(지금 라운드는 그대로) 적용돼요.</p>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && hunter && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 헌트 시작 · 다음 라운드는 저장한 설정으로 판을 만들어요.</p>}
          <div className={prize.window}>
            <span className={styles.muted}>
              {board
                ? `${board.round}라운드 · ×${board.multiplier} · SOLD OUT ${sold}/${board.slots.length} · 몰수권 ${forfeitsLeft}개 남음${board.advanceAt ? " · 결과 연출 뒤 다음 라운드" : ""}`
                : "헌트가 없어요. 헌트 시작을 누르면 저장한 1라운드로 판을 만들어요."}
            </span>
            <button type="button" className={styles.primary} disabled={pending} onClick={start}>
              {board ? "처음부터 다시 시작" : "헌트 시작"}
            </button>
            {board && (
              <>
                <button
                  type="button"
                  className={styles.ghost}
                  disabled={pending}
                  onClick={() => run(() => nextSigHunter({ broadcastId: live.id, round: board.round }), `${board.round + 1}라운드로 넘어갔어요.`)}
                >
                  다음 라운드
                </button>
                <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearSigHunter({ broadcastId: live.id }), "헌터 판을 비웠어요.")}>
                  판 비우기
                </button>
              </>
            )}
          </div>
          {board && (
            <>
              {sold === board.slots.length && !board.advanceAt && (
                <p className={styles.note}>모든 슬롯이 SOLD OUT이에요. 다음 라운드에 넣을 시그니처가 없으면 설정을 확인한 뒤 다음 라운드를 눌러 주세요.</p>
              )}
              <span className={prize.inline}>
                <span className={styles.muted}>슬롯을 누르면 SOLD OUT 처리해요(기여도 없음, 수동 SOLD OUT은 다시 누르면 되돌려요) — 멤버(선택)</span>
                <select className={styles.select} aria-label="SOLD OUT 처리할 멤버" value={picked} onChange={(e) => setMemberId(e.target.value)}>
                  <option value="">멤버 없음</option>
                  {active.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </span>
              <ol className={games.hunter} style={{ "--hunter-cols": sigHunterColumns(board.slots.length) } as CSSProperties} aria-label="시그니처 헌터 판">
                {board.slots.map((x, i) => (
                  <li key={i}>
                    <button
                      type="button"
                      className={games.hunterSlot}
                      data-sold={x.sold ? "" : undefined}
                      data-absorbed={x.sold?.absorbedBy ? "" : undefined}
                      style={x.sold?.memberColor ? ({ "--cell-color": x.sold.memberColor } as CSSProperties) : undefined}
                      disabled={pending || (!!x.sold && (!x.sold.manual || x.forfeit || !!x.sold.absorbedBy))}
                      aria-pressed={!!x.sold}
                      aria-label={`${i + 1}번 슬롯 ${x.signatureName}${x.forfeit ? " (몰수권)" : ""}${x.sold ? ` — SOLD OUT${x.sold.memberName ? ` · ${x.sold.memberName}` : ""}` : ""}`}
                      onClick={() => run(() => setSigHunter({ broadcastId: live.id, requestId: crypto.randomUUID(), index: i, round: board.round, sold: !x.sold, memberId: picked || null }))}
                    >
                      {x.forfeit && <span className={games.forfeit}>몰수권</span>}
                      <span>{x.signatureName}</span>
                      <small>{formatNumber(x.price)} FN</small>
                      {x.sold && (
                        <small>
                          SOLD OUT · {x.sold.memberName ?? (x.sold.manual ? "수동" : "멤버 없음")}
                          {x.sold.absorbedBy && ` → ${x.sold.absorbedBy}`}
                        </small>
                      )}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
          <RunList name="시그니처 헌터" runs={hunter.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="sighunter" label="시그니처 헌터" />
    </section>
  );
}
