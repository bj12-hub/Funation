"use client";

import { formatKstTime, formatNumber } from "@/lib/format";
import { clearRelay, saveRelay } from "@/services/crew/crewGames";
import {
  RELAY_EXAMPLE_TIERS,
  RELAY_MULTIPLIER_MAX,
  RELAY_TIERS_MAX,
  RELAY_TITLE_DEFAULT,
  type CrewMember,
  type GamesView,
  type RelaySettings
} from "@/services/crew/crewTypes";
import { AutoFields, FormActions, OverlayAddress, RunList, TitleField, useSettingsDraft, type LiveGames, type RunAction } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

/** The editor keeps the numbers as typed; a blank 최대 = 이상 (no upper end). */
type EditTier = { id: string; min: string; max: string; multiplier: string };
type Draft = Omit<RelaySettings, "tiers"> & { tiers: EditTier[] };

const toDraft = (s: RelaySettings): Draft => ({
  ...s,
  tiers: s.tiers.map((t) => ({ id: t.id, min: String(t.min), max: t.max === null ? "" : String(t.max), multiplier: String(t.multiplier) }))
});
const fromDraft = (d: Draft) => ({
  ...d,
  tiers: d.tiers.map((t) => ({ id: t.id, min: Number(t.min), max: t.max.trim() === "" ? null : Number(t.max), multiplier: Number(t.multiplier) }))
});
const newId = () => `new-${crypto.randomUUID().slice(0, 8)}`;

/**
 * 기여도 릴레이 — code-first (no Figma frame; StreamDonate 기여도 릴레이 참고), inside `/creator/crew/games`. 트리거 BJ and
 * 금액 구간 (first match wins); a 시그니처 후원 the 트리거 BJ receives sets the 배수, the next one another member receives
 * takes it. While live: the waiting 배수 (대기 비우기) and the runs. There is no 수동 run.
 */
export function RelayPanel({
  settings,
  signatures,
  members,
  live,
  now,
  overlayPath,
  pending,
  run
}: {
  settings: RelaySettings;
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
  const active = members.filter((m) => m.active);
  const setTier = (i: number, patch: Partial<EditTier>) => edit({ tiers: draft.tiers.map((t, j) => (j === i ? { ...t, ...patch } : t)) });
  const relay = live?.relay;

  return (
    <section id="game-relay" className={styles.card} aria-labelledby="game-relay-title">
      <h2 id="game-relay-title" className={styles.cardTitle}>
        🔗 기여도 릴레이
      </h2>
      <p className={styles.note}>
        트리거 BJ가 받은 시그니처 후원 금액으로 배수가 정해지고, 다른 멤버가 받는 다음 시그니처 후원에 한 번 적용돼요(×3이면 그 후원 점수의 2배만큼 더해져요). 트리거 BJ가 다시 받으면
        배수가 새로 정해져요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          const next = fromDraft(draft);
          // A member removed since may still be the 트리거 BJ: drop it instead of failing the save.
          const memberId = next.memberId && active.some((m) => m.id === next.memberId) ? next.memberId : null;
          run(() => saveRelay({ ...next, memberId, excluded: next.excluded.filter((id) => known.has(id)) }), "기여도 릴레이 설정을 저장했어요.");
        }}
      >
        <TitleField name="기여도 릴레이" placeholder={RELAY_TITLE_DEFAULT} value={draft.title} onChange={(title) => edit({ title })} />
        <div className={prize.field}>
          <span className={styles.muted}>트리거 BJ</span>
          <select className={styles.select} aria-label="트리거 BJ" value={draft.memberId ?? ""} onChange={(e) => edit({ memberId: e.target.value || null })}>
            <option value="">— BJ 선택 —</option>
            {active.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className={prize.field}>
          <span className={styles.muted}>
            금액 구간 ({draft.tiers.length}/{RELAY_TIERS_MAX})
          </span>
          {draft.tiers.length > 0 && (
            <ul className={games.tiers}>
              {draft.tiers.map((t, i) => (
                <li key={t.id}>
                  <span className={games.tierRow}>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={`구간 ${i + 1} 최소 금액`}
                      placeholder="최소"
                      value={t.min}
                      onChange={(e) => setTier(i, { min: e.target.value })}
                    />
                    <span className={styles.muted}>FN 이상 ~</span>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={`구간 ${i + 1} 최대 금액`}
                      placeholder="비우면 이상"
                      value={t.max}
                      onChange={(e) => setTier(i, { max: e.target.value })}
                    />
                    <span className={styles.muted}>FN →</span>
                    <input
                      className={styles.inputSmall}
                      type="number"
                      inputMode="decimal"
                      aria-label={`구간 ${i + 1} 배수`}
                      step={0.01}
                      min={1.01}
                      max={RELAY_MULTIPLIER_MAX}
                      value={t.multiplier}
                      onChange={(e) => setTier(i, { multiplier: e.target.value })}
                    />
                    <span className={styles.muted}>배</span>
                    <button type="button" className={styles.ghost} onClick={() => edit({ tiers: draft.tiers.filter((_, j) => j !== i) })}>
                      삭제
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <span className={prize.inline}>
            <button
              type="button"
              className={styles.ghost}
              disabled={draft.tiers.length >= RELAY_TIERS_MAX}
              onClick={() => edit({ tiers: [...draft.tiers, { id: newId(), min: "", max: "", multiplier: "2" }] })}
            >
              + 구간 추가
            </button>
            {draft.tiers.length === 0 && (
              <button
                type="button"
                className={styles.ghost}
                onClick={() => edit({ tiers: RELAY_EXAMPLE_TIERS.map((t) => ({ id: newId(), min: String(t.min), max: t.max === null ? "" : String(t.max), multiplier: String(t.multiplier) })) })}
              >
                예시로 채우기
              </button>
            )}
          </span>
          <span className={styles.note}>
            위에서부터 맞는 첫 구간의 배수가 적용돼요. 어느 구간에도 안 맞으면 효과가 없어요(1배). 예시는 StreamDonate 기본값(원 단위)이라 채널 시그니처 가격에 맞게 바꿔 주세요.
          </span>
        </div>

        <AutoFields
          name="기여도 릴레이"
          verb="돌리기"
          copy={{
            auto: "기여도 릴레이 켜기",
            excluded: "릴레이에서 뺄 시그니처 (누르면 제외)",
            note: "후원자가 멤버를 고른 시그니처 후원(금액 일치 · 금액범위 · 랜덤시그 포함)만 이어져요. 제외한 시그니처는 배수를 정하지도, 받지도 않아요."
          }}
          auto={draft.auto}
          excluded={draft.excluded}
          showIdle={draft.showIdle}
          signatures={signatures}
          onChange={edit}
        />
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>

      {live && relay && (
        <>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 릴레이는 저장한 설정으로 이어져요.</p>}
          <div className={prize.window} role="status">
            <span className={styles.muted}>
              {relay.pending
                ? `대기 배수 ×${relay.pending.multiplier} — ${relay.triggerName ?? "트리거 BJ"}의 ${formatNumber(relay.pending.amount)} FN 시그에서 (${formatKstTime(relay.pending.at, { hour: "2-digit", minute: "2-digit" })})`
                : `대기 중인 배수가 없어요. ${relay.triggerName ?? "트리거 BJ"}의 시그니처 후원을 기다리는 중이에요.`}
            </span>
            {relay.pending && (
              <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => clearRelay({ broadcastId: live.id }), "대기 배수를 비웠어요.")}>
                대기 비우기
              </button>
            )}
          </div>
          <RunList name="기여도 릴레이" runs={relay.runs} now={now} />
        </>
      )}

      <OverlayAddress overlayPath={overlayPath} param="relay" label="기여도 릴레이" />
    </section>
  );
}
