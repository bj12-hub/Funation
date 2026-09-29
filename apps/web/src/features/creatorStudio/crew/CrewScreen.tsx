"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { addCrewMember, removeCrewMember, updateCrewMember } from "@/services/crew/crew";
import { CREW_ROLES, MAX_CREW_MEMBERS, crewRoleLabel, type CrewRole, type CrewSaveResult, type CrewStudioView } from "@/services/crew/crewTypes";
import styles from "./crew.module.css";

/**
 * 크루 관리 — code-first (no Figma frame). Route `/creator/crew`. Members can be targeted by
 * supporters when donating; the ranking is this month's member-attributed donations (server).
 */
export function CrewScreen({ view }: { view: CrewStudioView }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [role, setRole] = useState<CrewRole>("MEMBER");
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

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
        <h1 className={styles.title}>크루 관리</h1>
        <p className={styles.subtitle}>
          {view.channelName}의 크루 멤버를 관리하세요. 후원자는 후원할 때 멤버를 지정할 수 있고, 멤버별 순위가 집계돼요.
        </p>
      </header>

      <section className={styles.card} aria-labelledby="crew-members">
        <div className={styles.cardHead}>
          <h2 id="crew-members" className={styles.cardTitle}>
            멤버 {view.members.length} / {MAX_CREW_MEMBERS}
          </h2>
        </div>
        <form
          className={styles.addRow}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => addCrewMember({ name, role }), "멤버를 추가했어요.", () => setName(""));
          }}
        >
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} placeholder="멤버 이름 (1~12자)" maxLength={12} aria-label="멤버 이름" />
          <select className={styles.select} value={role} onChange={(e) => setRole(e.target.value as CrewRole)} aria-label="역할">
            {CREW_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <button type="submit" className={styles.primary} disabled={pending || !name.trim()}>
            추가
          </button>
        </form>
        {message && (
          <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}
        {view.members.length === 0 ? (
          <p className={styles.empty}>아직 등록한 멤버가 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {view.members.map((mem) => (
              <li key={mem.id} className={styles.row} data-inactive={!mem.active || undefined}>
                <span className={styles.dot} style={{ background: mem.color }} aria-hidden="true" />
                <div className={styles.rowMain}>
                  {editing?.id === mem.id ? (
                    <input className={styles.input} value={editing.name} maxLength={12} onChange={(e) => setEditing({ id: mem.id, name: e.target.value })} aria-label={`${mem.name} 새 이름`} autoFocus />
                  ) : (
                    <strong className={styles.rowTitle}>
                      {mem.name} <span className={styles.chip}>{crewRoleLabel(mem.role)}</span>
                      {!mem.active && <span className={styles.chipOff}>휴식</span>}
                    </strong>
                  )}
                </div>
                <div className={styles.rowActions}>
                  {editing?.id === mem.id ? (
                    <>
                      <button type="button" className={styles.ghost} onClick={() => setEditing(null)}>
                        취소
                      </button>
                      <button type="button" className={styles.primary} disabled={pending} onClick={() => run(() => updateCrewMember(mem.id, { name: editing.name }), "이름을 바꿨어요.", () => setEditing(null))}>
                        저장
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => updateCrewMember(mem.id, { active: !mem.active }), mem.active ? "휴식으로 바꿨어요." : "활동으로 바꿨어요.")}>
                        {mem.active ? "휴식" : "활동"}
                      </button>
                      <button type="button" className={styles.ghost} onClick={() => setEditing({ id: mem.id, name: mem.name })}>
                        이름 변경
                      </button>
                      <button type="button" className={styles.danger} disabled={pending} onClick={() => run(() => removeCrewMember(mem.id), "멤버를 삭제했어요.")}>
                        삭제
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>휴식 중인 멤버는 후원 패널에서 지정할 수 없어요. 삭제해도 지난 후원 기록은 남아요.</p>
      </section>

      <section className={styles.card} aria-labelledby="crew-rank">
        <h2 id="crew-rank" className={styles.cardTitle}>
          멤버별 후원 순위 · {view.month}
        </h2>
        {view.ranking.every((r) => r.totalFn === 0) ? (
          <p className={styles.empty}>이번 달 멤버 지정 후원이 아직 없어요.</p>
        ) : (
          <ol className={styles.rank}>
            {view.ranking.map((r, i) => (
              <li key={r.memberId}>
                <span className={styles.rankNo}>{i + 1}</span>
                <span className={styles.rankName}>
                  {r.name} <span className={styles.muted}>{crewRoleLabel(r.role)}</span>
                </span>
                <span className={styles.rankBar} aria-hidden="true">
                  <span style={{ width: `${(r.totalFn / maxFn) * 100}%` }} />
                </span>
                <span className={styles.rankValue}>
                  {formatNumber(r.totalFn)} FN · {r.count}건 · {r.sharePercent}%
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
