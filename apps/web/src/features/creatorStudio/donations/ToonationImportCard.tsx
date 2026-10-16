"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { formatNumber, kstIsoString } from "@/lib/format";
import { importToonationCsv, previewToonationCsv, remapToonationCsv } from "@/services/creator/donationImport";
import {
  CSV_FILE_ERROR_MESSAGE,
  CSV_MAX_BYTES,
  CSV_MAX_ROWS,
  IMPORT_FIELDS,
  IMPORT_PROBLEM_ROWS,
  ROW_ERROR_LABEL,
  ROW_STATUS_LABEL,
  SAMPLE_CSV,
  type ColumnMapping,
  type CsvImportResult,
  type CsvPreview,
  type CsvPreviewResult,
  type ImportField,
  type PreviewRow
} from "@/services/creator/donationImportTypes";
import styles from "./donations.module.css";
import local from "./importTab.module.css";

/** "2026.10.08 15:04:05" in Korea time. */
const formatAt = (iso: string) => kstIsoString(iso).replaceAll("-", ".").replace("T", " ");
const won = (n: number) => `${formatNumber(n)}원`;
/** "A열 · 날짜" (an empty header shows only the column letter). */
const columnName = (headers: string[], i: number) => {
  let n = i;
  let letters = "";
  do {
    letters = String.fromCharCode(65 + (n % 26)) + letters;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return headers[i] ? `${letters}열 · ${headers[i]}` : `${letters}열`;
};
const STATUS_CLASS: Record<PreviewRow["status"], string> = { OK: local.rowOk, INVALID: local.rowBad, DUPLICATE_IN_FILE: local.rowSkip, ALREADY_IMPORTED: local.rowSkip };
const reasonOf = (r: PreviewRow) => (r.status === "INVALID" ? r.errors.map((e) => ROW_ERROR_LABEL[e]).join(" · ") : r.status === "DUPLICATE_IN_FILE" ? "위에 같은 후원이 있어요" : "전에 가져온 후원이에요");
const mappingKey = (m: ColumnMapping) => JSON.stringify(IMPORT_FIELDS.map((f) => m[f.key]));

type Busy = null | "reading" | "remapping" | "importing";

/**
 * 투네이션 CSV 가져오기 — code-first (no Figma frame). The file goes to the server, which reads it and answers with a
 * preview (totals, the first rows, every problem row up to 100); nothing is imported until "n건 가져오기". Columns found
 * by header name can be changed; when a required one is missing the creator picks it. Text from the file is shown as
 * text only.
 */
export function ToonationImportCard() {
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
    else if (r.status === "UNAUTHORIZED") setError("로그인이 필요합니다.");
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
    showPreview(await run("reading", () => previewToonationCsv(form), "파일을 읽지 못했어요. 잠시 후 다시 시도해 주세요."));
  };

  const remap = async (field: ImportField, value: string) => {
    if (!preview) return;
    const mapping: ColumnMapping = { ...preview.mapping, [field]: value === "" ? null : Number(value) };
    // A column picked for this field leaves the field that had it.
    for (const f of IMPORT_FIELDS) if (f.key !== field && mapping[f.key] !== null && mapping[f.key] === mapping[field]) mapping[f.key] = null;
    showPreview(await run("remapping", () => remapToonationCsv({ previewId: preview.previewId, mapping }), "열을 바꾸지 못했어요. 잠시 후 다시 시도해 주세요."));
  };

  const doImport = async () => {
    if (!preview) return;
    const key = `${preview.previewId}:${mappingKey(preview.mapping)}`;
    if (requestId.current?.key !== key) requestId.current = { key, id: crypto.randomUUID() };
    const id = requestId.current.id;
    const r = await run("importing", () => importToonationCsv({ previewId: preview.previewId, mapping: preview.mapping, requestId: id }), "가져오지 못했어요. 잠시 후 다시 시도해 주세요.");
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
    } else if (r.status === "IN_PROGRESS") setError("가져오는 중이에요. 잠시 후 다시 확인해 주세요.");
    else if (r.status === "CONFLICT") setError("같은 요청이 다른 내용으로 이미 처리됐어요. 파일을 다시 올려 주세요.");
    else setError("로그인이 필요합니다.");
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
  const missingLabels = preview?.missing.map((k) => IMPORT_FIELDS.find((f) => f.key === k)!.label) ?? [];

  return (
    <section className={styles.card} aria-labelledby="import-toonation">
      <div className={local.cardHead}>
        <h2 className={styles.cardTitle} id="import-toonation">
          투네이션 CSV 가져오기
        </h2>
        <button type="button" className={styles.ghostButton} onClick={downloadSample}>
          예시 파일 받기
        </button>
      </div>
      <p className={styles.desc}>투네이션에서 내려받은 받은 후원 내역 CSV 파일을 올려 주세요. 가져오기 전에 어떤 내역이 들어가는지 먼저 보여 드려요.</p>

      {!preview && (
        <div className={local.fileRow}>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.txt,text/csv"
            aria-label="투네이션 후원 내역 CSV 파일"
            className={local.fileInput}
            disabled={busy !== null}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setError(null);
            }}
          />
          <button type="button" className={styles.solidPurple} onClick={read} disabled={!file || busy !== null}>
            {busy === "reading" ? "파일을 읽고 있어요…" : "미리보기"}
          </button>
        </div>
      )}
      <p className={local.limits}>
        CSV(UTF-8 또는 엑셀의 &apos;CSV (쉼표로 분리)&apos;) · {CSV_MAX_BYTES / 1024 / 1024}MB · {formatNumber(CSV_MAX_ROWS)}행까지 (예시 값). 제목 줄에 후원 일시 · 닉네임 · 금액 열이
        있어야 해요. 시간은 한국 시간, 금액은 원으로 읽어요.
      </p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {done?.status === "IMPORTED" && (
        <p className={styles.ok} role="status">
          {formatNumber(done.batch.imported)}건을 가져왔어요.
          {done.batch.invalid + done.batch.duplicates > 0 && ` 오류 ${formatNumber(done.batch.invalid)}건 · 중복 ${formatNumber(done.batch.duplicates)}건은 건너뛰었어요.`}{" "}
          <Link href="/creator/donations?tab=import&sub=records">가져온 내역 보기</Link>
        </p>
      )}
      {done?.status === "NOTHING_TO_IMPORT" && (
        <p className={styles.error} role="status">
          가져올 새 내역이 없어요. 오류 {formatNumber(done.invalid)}건 · 중복 {formatNumber(done.duplicates)}건이에요.
        </p>
      )}

      {preview && t && (
        <>
          <p className={local.meta}>
            <strong>{preview.fileName}</strong> · {preview.encoding === "CP949" ? "엑셀 CSV (CP949)" : preview.encoding} · 미리보기는 {formatAt(preview.expiresAt).slice(11, 16)}까지 유지돼요
          </p>

          <div className={local.section}>
            <h3 className={local.sectionTitle}>열 선택</h3>
            {preview.missing.length > 0 ? (
              <p className={styles.error} role="alert">
                {missingLabels.join(" · ")} 열을 찾지 못했어요. 아래에서 직접 골라 주세요.
              </p>
            ) : (
              <p className={local.meta}>{preview.detected ? "제목 줄 이름으로 열을 찾았어요. 다르면 직접 바꿔 주세요." : "고른 열로 읽었어요."}</p>
            )}
            <div className={local.mappingGrid}>
              {IMPORT_FIELDS.map((f) => (
                <label key={f.key} className={local.mappingField}>
                  <span>
                    {f.label}
                    {f.required && <span className={local.required}> *</span>}
                  </span>
                  <select className={styles.select} value={preview.mapping[f.key] ?? ""} disabled={busy !== null} onChange={(e) => remap(f.key, e.target.value)}>
                    <option value="">{f.required ? "열을 골라 주세요" : "선택 안 함"}</option>
                    {preview.headers.map((_, i) => (
                      <option key={i} value={i}>
                        {columnName(preview.headers, i)}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {preview.missing.length > 0 && preview.sample.length > 0 && (
              <div className={local.wrapTable}>
                <table>
                  <caption className={styles.srOnly}>파일 앞부분</caption>
                  <thead>
                    <tr>
                      {preview.headers.map((_, i) => (
                        <th key={i} scope="col">
                          {columnName(preview.headers, i)}
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
              <dl className={styles.listStats} aria-label="미리보기 요약">
                <div>
                  <dt>가져올 내역</dt>
                  <dd className={styles.teal}>
                    {formatNumber(t.valid)}건 <span className={styles.listStatsCount}>/ 전체 {formatNumber(t.rows)}행</span>
                  </dd>
                </div>
                <div>
                  <dt>합계</dt>
                  <dd>{won(t.amount)}</dd>
                </div>
                <div>
                  <dt>오류</dt>
                  <dd>{formatNumber(t.invalid)}건</dd>
                </div>
                <div>
                  <dt>중복</dt>
                  <dd>
                    {formatNumber(t.duplicateInFile + t.alreadyImported)}건{" "}
                    <span className={styles.listStatsCount}>
                      · 파일 안 {formatNumber(t.duplicateInFile)} · 이미 가져옴 {formatNumber(t.alreadyImported)}
                    </span>
                  </dd>
                </div>
              </dl>

              <div className={local.section}>
                <h3 className={local.sectionTitle}>앞부분 미리보기</h3>
                <RowsTable rows={preview.rows} caption="파일 앞부분 미리보기" />
              </div>

              {preview.problems.length > 0 && (
                <div className={local.section}>
                  <h3 className={local.sectionTitle}>가져오지 않는 행 {t.invalid + t.duplicateInFile + t.alreadyImported > IMPORT_PROBLEM_ROWS && `(앞의 ${IMPORT_PROBLEM_ROWS}개)`}</h3>
                  <div className={local.wrapTable}>
                    <table>
                      <caption className={styles.srOnly}>가져오지 않는 행과 이유</caption>
                      <thead>
                        <tr>
                          <th scope="col" style={{ width: 70 }}>
                            행
                          </th>
                          <th scope="col" style={{ width: 110 }}>
                            상태
                          </th>
                          <th scope="col">이유</th>
                          <th scope="col" style={{ width: 160 }}>
                            닉네임
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.problems.map((r) => (
                          <tr key={r.row}>
                            <td>{formatNumber(r.row)}</td>
                            <td className={STATUS_CLASS[r.status]}>{ROW_STATUS_LABEL[r.status]}</td>
                            <td>{reasonOf(r)}</td>
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
              다른 파일 고르기
            </button>
            <button type="button" className={styles.solidPurple} onClick={doImport} disabled={busy !== null || preview.missing.length > 0 || t.valid === 0}>
              {busy === "importing" ? "가져오는 중…" : busy === "remapping" ? "다시 읽는 중…" : `${formatNumber(t.valid)}건 가져오기`}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function RowsTable({ rows, caption }: { rows: PreviewRow[]; caption: string }) {
  return (
    <div className={local.wrapTable}>
      <table>
        <caption className={styles.srOnly}>{caption}</caption>
        <thead>
          <tr>
            <th scope="col" style={{ width: 60 }}>
              행
            </th>
            <th scope="col" style={{ width: 100 }}>
              상태
            </th>
            <th scope="col" style={{ width: 160 }}>
              후원 일시
            </th>
            <th scope="col" style={{ width: 140 }}>
              닉네임
            </th>
            <th scope="col" style={{ width: 110 }}>
              금액
            </th>
            <th scope="col">메시지</th>
            <th scope="col" style={{ width: 80 }}>
              유형
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.row}>
              <td>{formatNumber(r.row)}</td>
              <td className={STATUS_CLASS[r.status]}>{ROW_STATUS_LABEL[r.status]}</td>
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
