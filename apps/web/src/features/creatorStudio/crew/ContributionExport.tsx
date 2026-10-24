"use client";

import { useRef, useState } from "react";
import { exportContributions } from "@/services/crew/crewHistory";
import type { ContributionExportFormat } from "@/services/crew/crewTypes";
import styles from "./crew.module.css";
import history from "./history.module.css";

/** The select's value for broadcasts started without a project. */
const NO_PROJECT = "__none__";

/** Runs one export on the server and saves the file; returns the line to show under the buttons. */
function useCsvDownload() {
  const busy = useRef(false);
  const [state, setState] = useState<{ busy: boolean; note: string | null; error: boolean }>({ busy: false, note: null, error: false });
  const download = async (input: { project?: string | null; broadcastId?: string; format: ContributionExportFormat }) => {
    if (busy.current) return;
    busy.current = true;
    setState({ busy: true, note: null, error: false });
    try {
      const res = await exportContributions(input);
      if (res.status !== "OK") {
        setState({ busy: false, note: res.status === "UNAUTHORIZED" ? "로그인이 필요해요." : res.message, error: true });
        return;
      }
      const url = URL.createObjectURL(new Blob([res.csv], { type: "text/csv;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
      const done = input.format === "ROUNDS" ? `멤버 ${res.rows.toLocaleString()}명의 회차별 합계를 내려받았어요.` : `${res.rows.toLocaleString()}줄을 내려받았어요.`;
      setState({ busy: false, note: res.truncated ? `앞의 ${res.rows.toLocaleString()}줄까지 내려받았어요. 회차를 나눠 내려받아 주세요.` : done, error: false });
    } catch {
      setState({ busy: false, note: "내려받지 못했어요. 잠시 후 다시 시도해 주세요.", error: true });
    } finally {
      busy.current = false;
    }
  };
  return { ...state, download };
}

/**
 * 기여도 내보내기 — code-first (no Figma frame; StreamDonate 프리셋별 기여도 내역 참고, 2026-10-25), in 방송 이력. A project's
 * 회차 (프리셋 = 프로젝트) as one CSV: 회차별 합계 (members × 회차, each 회차's final score) or 상세 내역 (every 기여도 내역
 * line). The live 회차 is included with its current score.
 */
export function ContributionExportBar({ projects }: { projects: string[] }) {
  const [project, setProject] = useState(projects[0] ?? NO_PROJECT);
  const { busy, note, error, download } = useCsvDownload();
  const chosen = project === NO_PROJECT ? null : project;
  return (
    <div className={history.export}>
      <span className={history.tools}>
        <select className={styles.select} aria-label="내보낼 프로젝트" value={project} onChange={(e) => setProject(e.target.value)}>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={NO_PROJECT}>프로젝트 없는 방송</option>
        </select>
        <button type="button" className={styles.ghost} disabled={busy} onClick={() => void download({ project: chosen, format: "ROUNDS" })}>
          회차별 합계 CSV
        </button>
        <button type="button" className={styles.ghost} disabled={busy} onClick={() => void download({ project: chosen, format: "LINES" })}>
          상세 내역 CSV
        </button>
      </span>
      <span className={styles.note}>
        회차별 합계는 회차가 끝날 때 고정된 점수예요. 상세 내역은 지금 자동엑셀 설정으로 다시 계산해서, 방송 뒤에 환산값 · 배수 규칙을 바꿨다면 합계와 다를 수 있어요.
      </span>
      {note && (
        <span className={error ? styles.error : styles.ok} role={error ? "alert" : "status"}>
          {note}
        </span>
      )}
    </div>
  );
}

/** One ended broadcast's 기여도 내역 as CSV (in its 방송 이력 row). */
export function BroadcastCsvButton({ broadcastId, title }: { broadcastId: string; title: string }) {
  const { busy, note, error, download } = useCsvDownload();
  return (
    <span className={history.rowExport}>
      <button type="button" className={styles.ghost} aria-label={`${title} 기여도 내역 CSV`} disabled={busy} onClick={() => void download({ broadcastId, format: "LINES" })}>
        내역 CSV
      </button>
      {note && error && (
        <span className={styles.error} role="alert">
          {note}
        </span>
      )}
    </span>
  );
}
