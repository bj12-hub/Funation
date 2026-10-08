"use client";

import { useState } from "react";
import { saveCrewGrades } from "@/services/crew/crew";
import { GRADES_MAX, GRADE_MULTIPLIER_MAX, GRADE_NAME_MAX, type CrewGrade, type CrewSaveResult } from "@/services/crew/crewTypes";
import styles from "./crew.module.css";

type Draft = { id?: string; name: string; multiplier: string };

/**
 * 직급 · 직급 배수 — code-first (엑셀방송 직급전, 2026-10-06 결정). The creator names the grades and sets each 배수
 * (default 1배 = no effect, like 배틀). Members pick a grade in the list above; on the 방송 운영 scoreboard what a
 * member receives counts × their 배수, shown as its own "직급 배수" part.
 */
export function GradesCard({ grades, pending, run }: { grades: CrewGrade[]; pending: boolean; run: (action: () => Promise<CrewSaveResult>, ok: string, after?: () => void) => void }) {
  const [draft, setDraft] = useState<Draft[] | null>(null);
  const list = draft ?? grades.map((g) => ({ id: g.id, name: g.name, multiplier: String(g.multiplier) }));
  const edit = (i: number, patch: Partial<Draft>) => setDraft(list.map((g, j) => (j === i ? { ...g, ...patch } : g)));

  const save = () =>
    run(
      () => saveCrewGrades({ grades: list.map((g) => ({ id: g.id, name: g.name, multiplier: Number(g.multiplier) })) }),
      "직급을 저장했어요.",
      () => setDraft(null)
    );

  return (
    <section className={styles.card} aria-labelledby="crew-grades">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="crew-grades">
          🎖️ 직급 · 직급 배수
        </h2>
        <span className={styles.muted}>
          {list.length} / {GRADES_MAX}
        </span>
      </div>
      <p className={styles.note}>
        방송 운영 점수판에서 멤버가 받은 후원 점수(후원 · 후원 리스트)에 직급 배수가 곱해져요. 기본 1배는 변화가 없어요. 강탈 · 보정 · 배틀 배수에는 곱하지 않아요. 진행 중인 방송은 시작할 때의 직급 · 배수로 계산하고, 바꾼 값은 다음 방송부터 적용돼요.
      </p>
      {list.length === 0 ? (
        <p className={styles.empty}>아직 직급이 없어요. 직급을 만들면 멤버마다 고를 수 있어요.</p>
      ) : (
        <ul className={styles.list}>
          {list.map((g, i) => (
            <li key={g.id ?? `new-${i}`} className={styles.row}>
              <div className={styles.rowMain}>
                <input className={styles.input} aria-label={`직급 ${i + 1} 이름`} placeholder="예: 부장" maxLength={GRADE_NAME_MAX} value={g.name} onChange={(e) => edit(i, { name: e.target.value })} />
              </div>
              <label className={styles.muted}>
                배수{" "}
                <input
                  className={styles.input}
                  style={{ width: 80 }}
                  type="number"
                  inputMode="decimal"
                  min={0.01}
                  max={GRADE_MULTIPLIER_MAX}
                  step={0.01}
                  aria-label={`직급 ${i + 1} 배수`}
                  value={g.multiplier}
                  onChange={(e) => edit(i, { multiplier: e.target.value })}
                />{" "}
                배
              </label>
              <div className={styles.rowActions}>
                <button type="button" className={styles.danger} disabled={pending} onClick={() => setDraft(list.filter((_, j) => j !== i))}>
                  삭제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.ghost} disabled={pending || list.length >= GRADES_MAX} onClick={() => setDraft([...list, { name: "", multiplier: "1" }])}>
          + 직급 추가
        </button>
        {draft && (
          <>
            <button type="button" className={styles.ghost} disabled={pending} onClick={() => setDraft(null)}>
              취소
            </button>
            <button type="button" className={styles.primary} disabled={pending} onClick={save}>
              {pending ? "저장 중…" : "저장"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
