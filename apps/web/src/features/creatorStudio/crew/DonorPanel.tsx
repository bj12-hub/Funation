"use client";

import { formatNumber } from "@/lib/format";
import { saveDonorMerges } from "@/services/crew/crewFeed";
import { DONOR_ALIASES_MAX, DONOR_MERGES_MAX, DONOR_NAME_MAX, type BroadcastResult, type DonorMerge, type DonorSummaryRow } from "@/services/crew/crewTypes";
import { useSettingsDraft } from "./PrizeBoardPanel";
import styles from "./crew.module.css";
import feed from "./feed.module.css";

type Row = { id: string | null; name: string; aliases: string };
const toRows = (merges: DonorMerge[]): Row[] => merges.map((g) => ({ id: g.id, name: g.name, aliases: g.aliases.join(", ") }));

/**
 * 후원자별 정리 · 후원자 이름 병합 — code-first (no Figma frame; StreamDonate 후원 및 통합 관리 참고, 2026-10-25), inside the
 * 후원 리스트. Donors of this broadcast under their merged name, and the merge groups (대표 이름 + names to merge, comma
 * separated), saved with 저장. Studio only: names on stream stay as sent.
 */
export function DonorPanel({ donors, merges, pending, run }: { donors: DonorSummaryRow[]; merges: DonorMerge[]; pending: boolean; run: (action: () => Promise<BroadcastResult>, ok?: string) => void }) {
  const { draft, setDraft, dirty } = useSettingsDraft(toRows(merges));
  const setRow = (i: number, patch: Partial<Row>) => setDraft(draft.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const save = () =>
    run(
      () => saveDonorMerges({ merges: draft.filter((r) => r.name.trim() || r.aliases.trim()).map((r) => ({ id: r.id, name: r.name, aliases: r.aliases.split(/[,\n]/) })) }),
      "후원자 이름 병합을 저장했어요."
    );

  return (
    <details className={feed.panel}>
      <summary>
        후원자별 정리 · 이름 병합 {merges.length > 0 && <span className={styles.muted}>(병합 {merges.length}개)</span>}
      </summary>
      <div className={feed.donors}>
        {donors.length === 0 ? (
          <p className={styles.note}>아직 이번 방송 후원이 없어요.</p>
        ) : (
          <div className={feed.tableWrap}>
            <table className={feed.table}>
              <caption>이번 방송 후원자 (점수순, 취소 건 제외 · 멤버 지정 후원 포함)</caption>
              <thead>
                <tr>
                  <th scope="col">후원자</th>
                  <th scope="col">받은 이름</th>
                  <th scope="col">건수</th>
                  <th scope="col">점수</th>
                </tr>
              </thead>
              <tbody>
                {donors.map((d) => (
                  <tr key={d.name}>
                    <th scope="row">{d.name}</th>
                    <td className={feed.names}>{d.names.join(", ")}</td>
                    <td>{formatNumber(d.count)}건</td>
                    <td>{formatNumber(d.points)}점</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <strong>이름 병합</strong>
        <p className={styles.note}>
          같은 사람이 다른 이름(다른 플랫폼 닉네임, 바뀐 닉네임)으로 후원하면 대표 이름으로 묶어 봐요. 후원 리스트 · 중복 의심 · 기여도 내역에 쓰이고, 방송 화면에 나가는 이름은 바뀌지
          않아요. 띄어쓰기와 대소문자는 구분하지 않아요.
        </p>
        {draft.length === 0 ? (
          <p className={styles.note}>병합한 이름이 없어요.</p>
        ) : (
          <ul className={feed.merges}>
            {draft.map((r, i) => (
              <li key={r.id ?? `new-${i}`}>
                <input className={styles.input} aria-label={`${i + 1}번 대표 이름`} placeholder="대표 이름" maxLength={DONOR_NAME_MAX} value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} />
                <input
                  className={styles.input}
                  aria-label={`${i + 1}번 합칠 이름`}
                  placeholder={`합칠 이름 (쉼표로 구분, ${DONOR_ALIASES_MAX}개까지)`}
                  value={r.aliases}
                  onChange={(e) => setRow(i, { aliases: e.target.value })}
                />
                <button type="button" className={styles.ghost} onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={draft.length >= DONOR_MERGES_MAX} onClick={() => setDraft([...draft, { id: null, name: "", aliases: "" }])}>
            병합 추가
          </button>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(toRows(merges))}>
            되돌리기
          </button>
          <button type="button" className={styles.primary} disabled={pending || !dirty} onClick={save}>
            저장
          </button>
        </div>
      </div>
    </details>
  );
}
