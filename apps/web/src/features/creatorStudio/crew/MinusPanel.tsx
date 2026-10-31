"use client";

import { saveMinusSignatures } from "@/services/crew/crewMinus";
import { MINUS_SIGNATURES_MAX, type BroadcastResult, type BroadcastView, type CrewMember, type MinusSettings } from "@/services/crew/crewTypes";
import { formatNumber } from "@/lib/format";
import { FormActions, useSettingsDraft } from "./GameParts";
import styles from "./crew.module.css";
import games from "./games.module.css";
import prize from "./prize.module.css";

const same = (s: MinusSettings) => s;

/**
 * 마이너스 시그니처 — code-first (2026-11-01; policy-decisions 6 (a) "점수를 깎는 후원" as the crew option it lists), inside
 * `/creator/crew/broadcast`. The signatures whose 시그니처 후원 to a member takes its points off that member's crew score
 * (none = off), and the members it never lowers. Only the crew score changes — the donor's FN, rankings and grades, and the
 * FN members received, count it as usual; 점수 게임 do not play for it.
 */
export function MinusPanel({
  settings,
  signatures,
  members,
  pending,
  run
}: {
  settings: MinusSettings;
  signatures: BroadcastView["signatures"];
  members: CrewMember[];
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, same, same);
  const known = new Set(signatures.map((s) => s.id));
  const picked = draft.signatureIds;
  const toggle = (id: string) => edit({ signatureIds: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });
  const toggleMember = (id: string) =>
    edit({ excludedMembers: draft.excludedMembers.includes(id) ? draft.excludedMembers.filter((x) => x !== id) : [...draft.excludedMembers, id] });

  return (
    <section className={styles.card} aria-labelledby="bc-minus">
      <h2 id="bc-minus" className={styles.cardTitle}>
        ➖ 마이너스 시그니처
      </h2>
      <p className={styles.note}>
        고른 시그니처로 멤버에게 들어온 시그니처 후원은 그 멤버의 크루 점수에서 그 후원 점수만큼 빠져요. 후원자의 FN · 랭킹 · 등급과 멤버가 받은 FN(월간 순위 · 누적 금액)은 평소처럼
        세고, 점수 게임은 돌지 않아요. 고른 시그니처가 없으면 꺼져 있어요. 바꿔도 이미 들어온 후원은 그대로예요.
      </p>
      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveMinusSignatures({ ...draft, signatureIds: draft.signatureIds.filter((id) => known.has(id)) }), "마이너스 시그니처를 저장했어요.");
        }}
      >
        <div className={prize.field} role="group" aria-label="마이너스 시그니처">
          <span className={styles.muted}>
            마이너스 시그니처 ({picked.length}/{MINUS_SIGNATURES_MAX}, 누르면 넣고 빼요)
          </span>
          <span className={prize.chips}>
            {signatures.length === 0 && <span className={styles.note}>만든 시그니처가 없어요.</span>}
            {signatures.map((s) => (
              <button
                key={s.id}
                type="button"
                className={games.pick}
                aria-pressed={picked.includes(s.id)}
                disabled={!picked.includes(s.id) && picked.length >= MINUS_SIGNATURES_MAX}
                onClick={() => toggle(s.id)}
              >
                {s.name}
                <span className={styles.muted}>{formatNumber(s.price)}</span>
                {!s.active && <span className={styles.muted}>숨김</span>}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label="마이너스를 받지 않을 멤버">
          <span className={styles.muted}>마이너스를 받지 않을 멤버 (누르면 제외 — 그 멤버의 후원은 평소처럼 더해져요)</span>
          <span className={prize.chips}>
            {members.map((m) => (
              <button key={m.id} type="button" className={prize.chip} aria-pressed={draft.excludedMembers.includes(m.id)} onClick={() => toggleMember(m.id)}>
                {m.name}
                {!m.active && <span className={styles.muted}>휴식</span>}
              </button>
            ))}
          </span>
        </div>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>
    </section>
  );
}
