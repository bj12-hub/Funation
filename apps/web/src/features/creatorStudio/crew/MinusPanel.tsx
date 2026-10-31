"use client";

import { saveMinusSignatures } from "@/services/crew/crewMinus";
import { MINUS_SIGNATURES_MAX, type BroadcastResult, type BroadcastView, type CrewMember, type MinusSettings } from "@/services/crew/crewTypes";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
  const { t } = useI18n();
  const { draft, edit, dirty, reset } = useSettingsDraft(settings, same, same);
  const known = new Set(signatures.map((s) => s.id));
  const picked = draft.signatureIds;
  const toggle = (id: string) => edit({ signatureIds: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });
  const toggleMember = (id: string) =>
    edit({ excludedMembers: draft.excludedMembers.includes(id) ? draft.excludedMembers.filter((x) => x !== id) : [...draft.excludedMembers, id] });

  return (
    <section className={styles.card} aria-labelledby="bc-minus">
      <h2 id="bc-minus" className={styles.cardTitle}>
        {t("crewOpsBoards.minusTitle")}
      </h2>
      <p className={styles.note}>{t("crewOpsBoards.minusNote")}</p>
      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveMinusSignatures({ ...draft, signatureIds: draft.signatureIds.filter((id) => known.has(id)) }), t("crewOpsBoards.minusSaved"));
        }}
      >
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.minusAria")}>
          <span className={styles.muted}>
            {t("crewOpsBoards.minusPicked", { count: picked.length, max: MINUS_SIGNATURES_MAX })}
          </span>
          <span className={prize.chips}>
            {signatures.length === 0 && <span className={styles.note}>{t("crewOpsBoards.noSignatures")}</span>}
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
                {!s.active && <span className={styles.muted}>{t("crewOpsBoards.hidden")}</span>}
              </button>
            ))}
          </span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewOpsBoards.minusExcludeAria")}>
          <span className={styles.muted}>{t("crewOpsBoards.minusExcludeLabel")}</span>
          <span className={prize.chips}>
            {members.map((m) => (
              <button key={m.id} type="button" className={prize.chip} aria-pressed={draft.excludedMembers.includes(m.id)} onClick={() => toggleMember(m.id)}>
                {m.name}
                {!m.active && <span className={styles.muted}>{t("crewOps.resting")}</span>}
              </button>
            ))}
          </span>
        </div>
        <FormActions pending={pending} dirty={dirty} onReset={reset} />
      </form>
    </section>
  );
}
