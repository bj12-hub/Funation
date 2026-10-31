"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { addCrewMember, removeCrewMember, updateCrewMember } from "@/services/crew/crew";
import { CREW_ROLES, MAX_CREW_MEMBERS, type CrewRole, type CrewSaveResult, type CrewStudioView } from "@/services/crew/crewTypes";
import { CrewTabs } from "./CrewTabs";
import { GradesCard } from "./GradesCard";
import styles from "./crew.module.css";

/** 역할 labels (대표 · 멤버) as message keys; the constant in crewTypes stays as written. */
const CREW_ROLE_KEY: Record<CrewRole, MessageKey> = { LEADER: "crewOps.roleLeader", MEMBER: "crewOps.roleMember" };

/**
 * 크루 관리 — code-first (no Figma frame). Route `/creator/crew`. Members can be targeted by
 * supporters when donating; the ranking is this month's member-attributed donations (server).
 */
export function CrewScreen({ view }: { view: CrewStudioView }) {
  const router = useRouter();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [role, setRole] = useState<CrewRole>("MEMBER");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const addId = useRef<string | null>(null);

  const run = (action: () => Promise<CrewSaveResult>, ok: string, after?: () => void) => {
    setMessage(null);
    startTransition(async () => {
      const res = await action();
      if (res.status === "SAVED") {
        setMessage({ tone: "ok", text: ok });
        after?.();
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/crew");
      else setMessage({ tone: "error", text: res.message });
    });
  };

  const maxFn = Math.max(1, ...view.ranking.map((r) => r.totalFn));

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("crewOps.title")}</h1>
        <p className={styles.subtitle}>{t("crewOps.subtitle", { channel: view.channelName })}</p>
      </header>
      <CrewTabs active="members" />

      <section className={styles.card} aria-labelledby="crew-members">
        <div className={styles.cardHead}>
          <h2 id="crew-members" className={styles.cardTitle}>
            {t("crewOps.membersHeading", { count: view.members.length, max: MAX_CREW_MEMBERS })}
          </h2>
        </div>
        <form
          className={styles.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            // One request id per intended add: a double click or retry is not a second member.
            addId.current ??= crypto.randomUUID();
            const requestId = addId.current;
            run(() => addCrewMember({ requestId, name, role }), t("crewOps.memberAdded"), () => {
              addId.current = null;
              setName("");
            });
          }}
        >
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder={t("crewOps.namePlaceholder")} maxLength={12} aria-label={t("crewOps.nameAria")} />
          <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as CrewRole)} aria-label={t("crewOps.roleAria")}>
            {CREW_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {t(CREW_ROLE_KEY[r.key])}
              </option>
            ))}
          </select>
          <button type="submit" className={styles.primary} disabled={pending || !name.trim()}>
            {t("crewOps.add")}
          </button>
        </form>
        {message && (
          <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}
        {view.members.length === 0 ? (
          <p className={styles.empty}>{t("crewOps.empty")}</p>
        ) : (
          <ul className={styles.list}>
            {view.members.map((mem) => (
              <li key={mem.id} className={styles.row} data-inactive={!mem.active || undefined}>
                <span className={styles.dot} style={{ background: mem.color }} aria-hidden="true" />
                <div className={styles.rowMain}>
                  {editing?.id === mem.id ? (
                    <input className={styles.input} value={editing.name} maxLength={12} onChange={(e) => setEditing({ id: mem.id, name: e.target.value })} aria-label={t("crewOps.renameAria", { name: mem.name })} autoFocus />
                  ) : (
                    <strong className={styles.rowTitle}>
                      {mem.name} <span className={styles.chip}>{t(CREW_ROLE_KEY[mem.role])}</span>
                      {!mem.active && <span className={styles.chipOff}>{t("crewOps.resting")}</span>}
                      {view.grades.find((g) => g.id === mem.gradeId) && <span className={styles.chip}>{view.grades.find((g) => g.id === mem.gradeId)!.name}</span>}
                    </strong>
                  )}
                </div>
                <div className={styles.rowActions}>
                  {editing?.id === mem.id ? (
                    <>
                      <button type="button" className={styles.ghost} onClick={() => setEditing(null)}>
                        {t("crewOps.cancel")}
                      </button>
                      <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => updateCrewMember(mem.id, { name: editing.name }), t("crewOps.renamed"), () => setEditing(null))}>
                        {t("crewOps.save")}
                      </button>
                    </>
                  ) : (
                    <>
                      {view.grades.length > 0 && (
                        <select
                          className={styles.select}
                          aria-label={t("crewOps.gradeAria", { name: mem.name })}
                          value={view.grades.some((g) => g.id === mem.gradeId) ? (mem.gradeId as string) : ""}
                          disabled={pending}
                          onChange={(e) => run(() => updateCrewMember(mem.id, { gradeId: e.target.value || null }), t("crewOps.gradeChanged"))}
                        >
                          <option value="">{t("crewOps.noGrade")}</option>
                          {view.grades.map((g) => (
                            <option key={g.id} value={g.id}>
                              {g.name} (×{g.multiplier})
                            </option>
                          ))}
                        </select>
                      )}
                      <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => updateCrewMember(mem.id, { active: !mem.active }), mem.active ? t("crewOps.setResting") : t("crewOps.setActive"))}>
                        {mem.active ? t("crewOps.resting") : t("crewOps.active")}
                      </button>
                      <button type="button" className={styles.ghost} onClick={() => setEditing({ id: mem.id, name: mem.name })}>
                        {t("crewOps.rename")}
                      </button>
                      <button type="button" className={styles.danger} disabled={pending} onClick={() => run(() => removeCrewMember(mem.id), t("crewOps.memberRemoved"))}>
                        {t("crewOps.delete")}
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>{t("crewOps.restNote")}</p>
      </section>

      <GradesCard grades={view.grades} pending={pending} run={run} />

      <section className={styles.card} aria-labelledby="crew-rank">
        <h2 id="crew-rank" className={styles.cardTitle}>
          {t("crewOps.rankTitle", { month: view.month })}
        </h2>
        {view.ranking.every((r) => r.totalFn === 0) ? (
          <p className={styles.empty}>{t("crewOps.rankEmpty")}</p>
        ) : (
          <ol className={styles.rank}>
            {view.ranking.map((r, i) => (
              <li key={r.memberId}>
                <span className={styles.rankNo}>{i + 1}</span>
                <span className={styles.rankName}>
                  {r.name} <span className={styles.muted}>{t(CREW_ROLE_KEY[r.role])}</span>
                </span>
                <span className={styles.rankBar} aria-hidden="true">
                  <span style={{ width: `${(r.totalFn / maxFn) * 100}%` }} />
                </span>
                <span className={styles.rankValue}>
                  {t("crewOps.rankValue", { fn: formatNumber(r.totalFn), count: r.count, share: r.sharePercent })}
                </span>
              </li>
            ))}
          </ol>
        )}
        <p className={styles.note}>멤버 간 수익 배분 방식은 아직 정해지지 않았어요(TBD). 후원 금액은 채널 수익으로 집계돼요.</p>
      </section>
    </div>
  );
}
