"use client";

import { useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { exportContributions } from "@/services/crew/crewHistory";
import type { ContributionExportFormat } from "@/services/crew/crewTypes";
import styles from "./crew.module.css";
import history from "./history.module.css";

/** The select's value for broadcasts started without a project. */
const NO_PROJECT = "__none__";
/** 파일 형식 (2026-10-25): CSV from the Server Action, 엑셀 from the download route (the same table). */
type FileKind = "CSV" | "XLSX";
const FILE_KINDS: { key: FileKind; label: MessageKey }[] = [
  { key: "CSV", label: "crewOpsHistory.fileCsv" },
  { key: "XLSX", label: "crewOpsHistory.fileXlsx" }
];
type ExportInput = { project?: string | null; broadcastId?: string; format: ContributionExportFormat };

/** Saves `blob` as `filename` through a temporary link. */
function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 엑셀: `GET /api/creator/crew/contributions` — the file, its name (Content-Disposition filename*), rows and truncation from
 * the X-Export headers; an error answer carries the message.
 */
async function fetchXlsx(input: ExportInput, failed: string): Promise<{ ok: true; blob: Blob; filename: string; rows: number; truncated: boolean } | { ok: false; message: string }> {
  const q = new URLSearchParams({ format: input.format });
  if (input.broadcastId !== undefined) q.set("broadcastId", input.broadcastId);
  else q.set("project", input.project ?? "");
  const res = await fetch(`/api/creator/crew/contributions?${q}`, { cache: "no-store" });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    return { ok: false, message: body?.message ?? failed };
  }
  const name = /filename\*=UTF-8''([^;]+)/.exec(res.headers.get("Content-Disposition") ?? "")?.[1];
  return { ok: true, blob: await res.blob(), filename: name ? decodeURIComponent(name) : "기여도.xlsx", rows: Number(res.headers.get("X-Export-Rows") ?? 0), truncated: res.headers.get("X-Export-Truncated") === "true" };
}

/** Runs one export on the server and saves the file; returns the line to show under the buttons. */
function useCsvDownload() {
  const { t } = useI18n();
  const busy = useRef(false);
  const [state, setState] = useState<{ busy: boolean; note: string | null; error: boolean }>({ busy: false, note: null, error: false });
  const download = async (input: ExportInput, kind: FileKind = "CSV") => {
    if (busy.current) return;
    busy.current = true;
    setState({ busy: true, note: null, error: false });
    try {
      let rows: number;
      let truncated: boolean;
      if (kind === "XLSX") {
        const res = await fetchXlsx(input, t("crewOpsHistory.downloadFailed"));
        if (!res.ok) {
          setState({ busy: false, note: res.message, error: true });
          return;
        }
        save(res.blob, res.filename);
        ({ rows, truncated } = res);
      } else {
        const res = await exportContributions(input);
        if (res.status !== "OK") {
          setState({ busy: false, note: res.status === "UNAUTHORIZED" ? t("crewOps.loginNeeded") : res.message, error: true });
          return;
        }
        save(new Blob([res.csv], { type: "text/csv;charset=utf-8" }), res.filename);
        ({ rows, truncated } = res);
      }
      const done = input.format === "ROUNDS" ? t("crewOpsHistory.doneRounds", { n: rows.toLocaleString() }) : t("crewOpsHistory.doneLines", { n: rows.toLocaleString() });
      setState({ busy: false, note: truncated ? t("crewOpsHistory.truncated", { n: rows.toLocaleString() }) : done, error: false });
    } catch {
      setState({ busy: false, note: t("crewOpsHistory.downloadFailed"), error: true });
    } finally {
      busy.current = false;
    }
  };
  return { ...state, download };
}

/**
 * 기여도 내보내기 — code-first (no Figma frame; StreamDonate 프리셋별 기여도 내역 참고, 2026-10-25), in 방송 이력. A project's
 * 회차 (프리셋 = 프로젝트) as one file — CSV or 엑셀 (.xlsx, 2026-10-25): 회차별 합계 (members × 회차, each 회차's final score)
 * or 상세 내역 (every 기여도 내역 line). The live 회차 is included with its current score.
 */
export function ContributionExportBar({ projects }: { projects: string[] }) {
  const { t } = useI18n();
  const [project, setProject] = useState(projects[0] ?? NO_PROJECT);
  const [kind, setKind] = useState<FileKind>("CSV");
  const kindLabel = t(FILE_KINDS.find((k) => k.key === kind)!.label);
  const { busy, note, error, download } = useCsvDownload();
  const chosen = project === NO_PROJECT ? null : project;
  return (
    <div className={history.export}>
      <span className={history.tools}>
        <select className={styles.select} aria-label={t("crewOpsHistory.projectAria")} value={project} onChange={(e) => setProject(e.target.value)}>
          {projects.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
          <option value={NO_PROJECT}>{t("crewOpsHistory.noProject")}</option>
        </select>
        <span className={styles.segment} role="group" aria-label={t("crewOpsHistory.fileKindAria")}>
          {FILE_KINDS.map((k) => (
            <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
              {t(k.label)}
            </button>
          ))}
        </span>
        <button type="button" className={styles.ghost} disabled={busy} onClick={() => void download({ project: chosen, format: "ROUNDS" }, kind)}>
          {t("crewOpsHistory.roundsButton", { kind: kindLabel })}
        </button>
        <button type="button" className={styles.ghost} disabled={busy} onClick={() => void download({ project: chosen, format: "LINES" }, kind)}>
          {t("crewOpsHistory.linesButton", { kind: kindLabel })}
        </button>
      </span>
      <span className={styles.note}>{t("crewOpsHistory.exportNote")}</span>
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
  const { t } = useI18n();
  const { busy, note, error, download } = useCsvDownload();
  return (
    <span className={history.rowExport}>
      <button type="button" className={styles.ghost} aria-label={t("crewOpsHistory.csvAria", { title })} disabled={busy} onClick={() => void download({ broadcastId, format: "LINES" })}>
        {t("crewOpsHistory.csvButton")}
      </button>
      {note && error && (
        <span className={styles.error} role="alert">
          {note}
        </span>
      )}
    </span>
  );
}
