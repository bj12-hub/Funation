"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatNumber, kstIsoString } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { importToonationCsv, previewToonationCsv, remapToonationCsv } from "@/services/creator/donationImport";
import {
  CSV_FILE_ERROR_MESSAGE,
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  IMPORT_FIELDS,
  IMPORT_PROBLEM_ROWS,
  SAMPLE_CSV,
  type ColumnMapping,
  type CsvImportResult,
  type CsvPreview,
  type CsvPreviewResult,
  type ImportField,
  type PreviewRow,
  type RowErrorCode,
  type RowStatus
} from "@/services/creator/donationImportTypes";
import styles from "./donations.module.css";
import local from "./importTab.module.css";

/** "2026.10.08 15:04:05" in Korea time. */
const formatAt = (iso: string) => kstIsoString(iso).replaceAll("-", ".").replace("T", " ");
const won = (n: number) => `${formatNumber(n)}원`;
type Translate = ReturnType<typeof useI18n>["t"];

/** "A열 · 날짜" (an empty header shows only the column letter). */
const columnName = (headers: string[], i: number, tr: Translate) => {
  let n = i;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return headers[i] ? tr("studioDonationsImport.columnNamed", { letters, header: headers[i] }) : tr("studioDonationsImport.column", { letters });
};
const STATUS_CLASS: Record<PreviewRow["status"], string> = { OK: local.rowOk, INVALID: local.rowBad, DUPLICATE_IN_FILE: local.rowSkip, ALREADY_IMPORTED: local.rowSkip };
/** The services' row labels (`ROW_STATUS_LABEL`, `ROW_ERROR_LABEL`, `IMPORT_FIELDS`) as message keys. */
const ROW_STATUS_KEY: Record<RowStatus, MessageKey> = {
  OK: "studioDonationsImport.rowOk",
  INVALID: "studioDonationsImport.rowInvalid",
  DUPLICATE_IN_FILE: "studioDonationsImport.rowDupInFile",
  ALREADY_IMPORTED: "studioDonationsImport.rowAlready"
};
const ROW_ERROR_KEY: Record<RowErrorCode, MessageKey> = {
  BAD_DATE: "studioDonationsImport.errBadDate",
  FUTURE_DATE: "studioDonationsImport.errFutureDate",
  BAD_AMOUNT: "studioDonationsImport.errBadAmount",
  NON_POSITIVE_AMOUNT: "studioDonationsImport.errNonPositive",
  NON_INTEGER_AMOUNT: "studioDonationsImport.errNonInteger",
  AMOUNT_TOO_LARGE: "studioDonationsImport.errTooLarge",
  EMPTY_NICKNAME: "studioDonationsImport.errEmptyNickname"
};
const FIELD_KEY: Record<ImportField, MessageKey> = {
  at: "studioDonationsImport.fieldAt",
  nickname: "studioDonationsImport.fieldNickname",
  amount: "studioDonationsImport.fieldAmount",
  message: "studioDonationsImport.fieldMessage",
  type: "studioDonationsImport.fieldType"
};
const reasonOf = (r: PreviewRow, tr: Translate) =>
  r.status === "INVALID" ? r.errors.map((e) => tr(ROW_ERROR_KEY[e])).join(" · ") : r.status === "DUPLICATE_IN_FILE" ? tr("studioDonationsImport.dupInFile") : tr("studioDonationsImport.alreadyImported");
const mappingKey = (m: ColumnMapping) => JSON.stringify(IMPORT_FIELDS.map((f) => m[f.key]));

type Busy = null | "reading" | "remapping" | "importing";

/**
 * 투네이션 CSV 가져오기 — code-first (no Figma frame). The file goes to the server, which reads it and answers with a
 * preview (totals, the first rows, every problem row up to 100); nothing is imported until "n건 가져오기". Columns found
 * by header name can be changed; when a required one is missing the creator picks it. Text from the file is shown as
 * text only. `tr` translates (`t` is the preview totals here); the services' file messages (CSV_FILE_ERROR_MESSAGE, the
 * server's answers) show as written.
 */
export function ToonationImportCard() {
  const { t: tr } = useI18n();
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<CsvImportResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  /** One request id per preview and column choice: a retry of the same import is the same request. */
  const requestId = useRef<{ key: string; id: string } | null>(null);
  const lock = useRef(false);

  const run = async <T,>(kind: Exclude<Busy, null>, call: () => Promise<T>, fallback: string): Promise<T | null> => {
    if (lock.current) return null;
    lock.current = true;
    setBusy(kind);
    setError(null);
    try {
      return await call();
    } catch {
      setError(fallback);
      return null;
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };

  const showPreview = (r: CsvPreviewResult | null) => {
    if (!r) return;
    if (r.status === "OK") setPreview(r.preview);
    else if (r.status === "UNAUTHORIZED") setError(tr("studioDonationsImport.loginRequired"));
    else {
      setError(r.message);
      if (r.code === "EXPIRED") setPreview(null);
    }
  };

  const read = async () => {
    setDone(null);
    if (!file) return setError(CSV_FILE_ERROR_MESSAGE.NO_FILE);
    if (file.size > CSV_MAX_BYTES) return setError(CSV_FILE_ERROR_MESSAGE.TOO_LARGE);
    const form = new FormData();
    form.append("file", file);
    showPreview(await run("reading", () => previewToonationCsv(form), tr("studioDonationsImport.readFailed")));
  };

  const remap = async (field: ImportField, value: string) => {
    if (!preview) return;
    const mapping: ColumnMapping = { ...preview.mapping, [field]: value === "" ? null : Number(value) };
    // A column picked for this field leaves the field that had it.
    for (const f of IMPORT_FIELDS) if (f.key !== field && mapping[f.key] !== null && mapping[f.key] === mapping[field]) mapping[f.key] = null;
    showPreview(await run("remapping", () => remapToonationCsv({ previewId: preview.previewId, mapping }), tr("studioDonationsImport.remapFailed")));
  };

  const doImport = async () => {
    if (!preview) return;
    const key = `${preview.previewId}:${mappingKey(preview.mapping)}`;
    if (requestId.current?.key !== key) requestId.current = { key, id: crypto.randomUUID() };
    const id = requestId.current.id;
    const r = await run("importing", () => importToonationCsv({ previewId: preview.previewId, mapping: preview.mapping, requestId: id }), tr("studioDonationsImport.importFailed"));
    if (!r) return;
    if (r.status === "IMPORTED" || r.status === "NOTHING_TO_IMPORT") {
      setDone(r);
      setPreview(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } else if (r.status === "INVALID") {
      setError(r.message);
      if (r.code === "EXPIRED") setPreview(null);
    } else if (r.status === "IN_PROGRESS") setError(tr("studioDonationsImport.inProgress"));
    else if (r.status === "CONFLICT") setError(tr("studioDonationsImport.conflict"));
    else setError(tr("studioDonationsImport.loginRequired"));
  };

  const reset = () => {
    setPreview(null);
    setFile(null);
    setError(null);
    setDone(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadSample = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + SAMPLE_CSV], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "ssumnation-toonation-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const t = preview?.totals;
  const missingLabels = preview?.missing.map((k) => tr(FIELD_KEY[k])) ?? [];

  return (
    <section className={styles.card} aria-labelledby="import-toonation">
      <div className={local.cardHead}>
        <h2 className={styles.cardTitle} id="import-toonation">
          {tr("studioDonationsImport.toonationTitle")}
        </h2>
        <button type="button" className={styles.ghostButton} onClick={downloadSample}>
          {tr("studioDonationsImport.sampleFile")}
        </button>
      </div>
      <p className={styles.desc}>{tr("studioDonationsImport.toonationDesc")}</p>

      {!preview && (
        <div className={local.fileRow}>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,text/csv"
            aria-label={tr("studioDonationsImport.fileAria")}
            className={local.fileInput}
            disabled={busy !== null}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
          <button type="button" className={styles.solidPurple} onClick={read} disabled={!file || busy !== null}>
            {busy === "reading" ? tr("studioDonationsImport.reading") : tr("studioDonationsImport.preview")}
          </button>
        </div>
      )}
      <p className={local.limits}>
        {tr("studioDonationsImport.limits", { mb: CSV_MAX_BYTES / 1024 / 1024, rows: formatNumber(CSV_MAX_ROWS) })}
      </p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {done?.status === "IMPORTED" && (
        <p className={styles.ok} role="status">
          {tr("studioDonationsImport.imported", { count: formatNumber(done.batch.imported) })}
          {done.batch.invalid + done.batch.duplicates > 0 &&
            tr("studioDonationsImport.importedSkipped", { invalid: formatNumber(done.batch.invalid), duplicates: formatNumber(done.batch.duplicates) })}{" "}
          <Link href="/creator/donations?tab=import&sub=records">{tr("studioDonationsImport.viewImported")}</Link>
        </p>
      )}
      {done?.status === "NOTHING_TO_IMPORT" && (
        <p className={styles.error} role="status">
          {tr("studioDonationsImport.nothingNew", { invalid: formatNumber(done.invalid), duplicates: formatNumber(done.duplicates) })}
        </p>
      )}

      {preview && t && (
        <>
          <p className={local.meta}>
            <strong>{preview.fileName}</strong> · {preview.encoding === "CP949" ? tr("studioDonationsImport.excelCsv") : preview.encoding} ·{" "}
            {tr("studioDonationsImport.previewUntil", { time: formatAt(preview.expiresAt).slice(11, 16) })}
          </p>

          <div className={local.section}>
            <h3 className={local.sectionTitle}>{tr("studioDonationsImport.mappingTitle")}</h3>
            {preview.missing.length > 0 ? (
              <p className={styles.error} role="alert">
                {tr("studioDonationsImport.missing", { labels: missingLabels.join(" · ") })}
              </p>
            ) : (
              <p className={local.meta}>{preview.detected ? tr("studioDonationsImport.detected") : tr("studioDonationsImport.picked")}</p>
            )}
            <div className={local.mappingGrid}>
              {IMPORT_FIELDS.map((f) => (
                <label key={f.key} className={local.mappingField}>
                  <span>
                    {tr(FIELD_KEY[f.key])}
                    {f.required && <span className={local.required}> *</span>}
                  </span>
                  <select className={styles.select} value={preview.mapping[f.key] ?? ""} disabled={busy !== null} onChange={(e) => remap(f.key, e.target.value)}>
                    <option value="">{f.required ? tr("studioDonationsImport.pickColumn") : tr("studioDonationsImport.noColumn")}</option>
                    {preview.headers.map((_, i) => (
                      <option key={i} value={i}>
                        {columnName(preview.headers, i, tr)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {preview.missing.length > 0 && preview.sample.length > 0 && (
              <div className={local.wrapTable}>
                <table>
                  <caption className={styles.srOnly}>{tr("studioDonationsImport.fileHead")}</caption>
                  <thead>
                    <tr>
                      {preview.headers.map((_, i) => (
                        <th key={i} scope="col">
                          {columnName(preview.headers, i, tr)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((cells, r) => (
                      <tr key={r}>
                        {cells.map((c, i) => (
                          <td key={i}>
                            <span className={local.clip}>{c}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {preview.missing.length === 0 && (
            <>
              <dl className={styles.listStats} aria-label={tr("studioDonationsImport.summaryAria")}>
                <div>
                  <dt>{tr("studioDonationsImport.toImport")}</dt>
                  <dd className={styles.teal}>
                    {tr("studioDonationsImport.count", { count: formatNumber(t.valid) })} <span className={styles.listStatsCount}>{tr("studioDonationsImport.rowsOfTotal", { rows: formatNumber(t.rows) })}</span>
                  </dd>
                </div>
                <div>
                  <dt>{tr("studioDonationsImport.total")}</dt>
                  <dd>{won(t.amount)}</dd>
                </div>
                <div>
                  <dt>{tr("studioDonationsImport.errors")}</dt>
                  <dd>{tr("studioDonationsImport.count", { count: formatNumber(t.invalid) })}</dd>
                </div>
                <div>
                  <dt>{tr("studioDonationsImport.duplicates")}</dt>
                  <dd>
                    {tr("studioDonationsImport.count", { count: formatNumber(t.duplicateInFile + t.alreadyImported) })}{" "}
                    <span className={styles.listStatsCount}>
                      {tr("studioDonationsImport.dupBreakdown", { inFile: formatNumber(t.duplicateInFile), already: formatNumber(t.alreadyImported) })}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className={local.section}>
                <h3 className={local.sectionTitle}>{tr("studioDonationsImport.headPreview")}</h3>
                <RowsTable rows={preview.rows} caption={tr("studioDonationsImport.headPreviewCaption")} />
              </div>

              {preview.problems.length > 0 && (
                <div className={local.section}>
                  <h3 className={local.sectionTitle}>
                    {tr("studioDonationsImport.skippedRows")} {t.invalid + t.duplicateInFile + t.alreadyImported > IMPORT_PROBLEM_ROWS && tr("studioDonationsImport.firstN", { n: IMPORT_PROBLEM_ROWS })}
                  </h3>
                  <div className={local.wrapTable}>
                    <table>
                      <caption className={styles.srOnly}>{tr("studioDonationsImport.skippedCaption")}</caption>
                      <thead>
                        <tr>
                          <th scope="col" style={{ width: 70 }}>
                            {tr("studioDonationsImport.colRow")}
                          </th>
                          <th scope="col" style={{ width: 110 }}>
                            {tr("studioDonationsImport.colStatus")}
                          </th>
                          <th scope="col">{tr("studioDonationsImport.colReason")}</th>
                          <th scope="col" style={{ width: 160 }}>
                            {tr("studioDonationsImport.colNickname")}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.problems.map((r) => (
                          <tr key={r.row}>
                            <td>{formatNumber(r.row)}</td>
                            <td className={STATUS_CLASS[r.status]}>{tr(ROW_STATUS_KEY[r.status])}</td>
                            <td>{reasonOf(r, tr)}</td>
                            <td>
                              <span className={local.clip}>{r.nickname || "-"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          <div className={local.actions}>
            <button type="button" className={styles.ghostButton} onClick={reset} disabled={busy !== null}>
              {tr("studioDonationsImport.pickAnother")}
            </button>
            <button type="button" className={styles.solidPurple} onClick={doImport} disabled={busy !== null || preview.missing.length > 0 || t.valid === 0}>
              {busy === "importing" ? tr("studioDonationsImport.importing") : busy === "remapping" ? tr("studioDonationsImport.rereading") : tr("studioDonationsImport.importN", { count: formatNumber(t.valid) })}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function RowsTable({ rows, caption }: { rows: PreviewRow[]; caption: string }) {
  const { t } = useI18n();
  return (
    <div className={local.wrapTable}>
      <table>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" style={{ width: 60 }}>
              {t("studioDonationsImport.colRow")}
            </th>
            <th scope="col" style={{ width: 100 }}>
              {t("studioDonationsImport.colStatus")}
            </th>
            <th scope="col" style={{ width: 160 }}>
              {t("studioDonationsImport.colDonatedAt")}
            </th>
            <th scope="col" style={{ width: 140 }}>
              {t("studioDonationsImport.colNickname")}
            </th>
            <th scope="col" style={{ width: 110 }}>
              {t("studioDonationsImport.colAmount")}
            </th>
            <th scope="col">{t("studioDonationsImport.colMessage")}</th>
            <th scope="col" style={{ width: 80 }}>
              {t("studioDonationsImport.colType")}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.row}>
              <td>{formatNumber(r.row)}</td>
              <td className={STATUS_CLASS[r.status]}>{t(ROW_STATUS_KEY[r.status])}</td>
              <td>{r.at ? formatAt(r.at) : <span className={local.rowBad}>-</span>}</td>
              <td>
                <span className={local.clip}>{r.nickname || "-"}</span>
              </td>
              <td>{r.amount === null ? <span className={local.rowBad}>-</span> : won(r.amount)}</td>
              <td>
                <span className={local.clip} title={r.message}>
                  {r.message}
                </span>
              </td>
              <td>
                <span className={local.clip}>{r.type ?? ""}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
