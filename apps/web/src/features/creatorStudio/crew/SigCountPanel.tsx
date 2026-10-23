"use client";

import { useEffect, useRef, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { resetSigCount, saveSigCount, setSigCountVisible } from "@/services/crew/crewSigCount";
import {
  SIG_COUNT_COLUMNS_MAX,
  SIG_COUNT_ROWS,
  SIG_COUNT_SORTS,
  SIG_COUNT_TITLE_DEFAULT,
  SIG_COUNT_TITLE_MAX,
  type BroadcastResult,
  type BroadcastView,
  type SigCountLive,
  type SigCountSettings
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import { shownOverlayAddress } from "./overlayAddress";
import styles from "./crew.module.css";
import prize from "./prize.module.css";
import sig from "./sigCount.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });

/**
 * 시그 카운트 — code-first (no Figma frame; StreamDonate 시그 카운트 참고), inside `/creator/crew/broadcast`. Pick up to 8
 * signatures; the table counts how many of each every member received (멤버 지정 of the donation, none = 미지정).
 * Settings are saved with 설정 저장; OBS에 표시 and 다시 세기 work while live. The preview is the server's table under the
 * saved settings.
 */
export function SigCountPanel({
  settings,
  signatures,
  live,
  overlayPath,
  pending,
  run
}: {
  settings: SigCountSettings;
  signatures: BroadcastView["signatures"];
  live: { broadcastId: string; table: SigCountLive } | null;
  overlayPath: string;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const synced = useRef(JSON.stringify(settings));
  useEffect(() => {
    const next = JSON.stringify(settings);
    if (next !== synced.current) {
      synced.current = next;
      setDraft(settings);
    }
  }, [settings]);
  const resetId = useRef<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const edit = (patch: Partial<SigCountSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const dirty = JSON.stringify(draft) !== synced.current;
  const picked = draft.signatureIds;
  const full = picked.length >= SIG_COUNT_COLUMNS_MAX;
  const toggle = (id: string) => edit({ signatureIds: picked.includes(id) ? picked.filter((x) => x !== id) : [...picked, id] });
  const known = new Set(signatures.map((s) => s.id));
  // A signature deleted since stays picked until saved again (the table shows it as 삭제된 시그니처).
  const gone = picked.filter((id) => !known.has(id));
  const groups = [...new Set(signatures.map((s) => s.group))];

  const table = live?.table;

  const reset = () => {
    if (!live) return;
    // One request id per intended 다시 세기: a double click or retry never resets twice.
    resetId.current ??= crypto.randomUUID();
    const requestId = resetId.current;
    run(async () => {
      const res = await resetSigCount({ broadcastId: live.broadcastId, requestId });
      if (res.status === "SAVED") resetId.current = null;
      return res;
    }, "지금부터 다시 셀게요.");
  };

  const chip = (s: { id: string; name: string; active: boolean } | { id: string; name: string; active?: undefined }) => {
    const order = picked.indexOf(s.id);
    return (
      <button
        key={s.id}
        type="button"
        className={sig.chip}
        aria-pressed={order >= 0}
        disabled={order < 0 && full}
        onClick={() => toggle(s.id)}
      >
        {order >= 0 && <span className={sig.order}>{order + 1}</span>}
        {s.name}
        {s.active === false && <span className={styles.muted}>숨김</span>}
      </button>
    );
  };

  return (
    <section className={styles.card} aria-labelledby="bc-sigcount">
      <div className={styles.cardHead}>
        <h2 id="bc-sigcount" className={styles.cardTitle}>
          시그 카운트
        </h2>
        {live && (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!table?.visible}
              disabled={pending}
              onChange={(e) =>
                run(() => setSigCountVisible({ broadcastId: live.broadcastId, on: e.target.checked }), e.target.checked ? "OBS에 시그 카운트를 띄웠어요." : "시그 카운트를 내렸어요.")
              }
            />
            OBS에 표시
          </label>
        )}
      </div>
      <p className={styles.note}>
        멤버마다 받은 시그니처 개수를 세어 표로 띄워요. 시그니처 후원과 금액이 맞아 시그니처로 나간 일반 후원을 후원자가 고른 멤버 앞으로 세고, 멤버를 고르지 않은 후원은
        &quot;미지정&quot; 줄에 모아요.
      </p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveSigCount({ ...draft, signatureIds: picked.filter((id) => known.has(id)) }), "시그 카운트 설정을 저장했어요.");
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>제목</span>
          <input
            className={styles.input}
            aria-label="시그 카운트 제목"
            placeholder={SIG_COUNT_TITLE_DEFAULT}
            maxLength={SIG_COUNT_TITLE_MAX}
            value={draft.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </div>
        <div className={prize.field} role="group" aria-label="셀 시그니처">
          <span className={styles.muted}>
            셀 시그니처 ({picked.length}/{SIG_COUNT_COLUMNS_MAX})
          </span>
          {signatures.length === 0 && <span className={styles.note}>만든 시그니처가 없어요. 위젯 › 시그니처에서 먼저 만들어 주세요.</span>}
          {groups.map((g) => (
            <span key={g} className={sig.group}>
              {groups.length > 1 && <span className={sig.groupName}>{g}</span>}
              <span className={prize.chips}>{signatures.filter((s) => s.group === g).map(chip)}</span>
            </span>
          ))}
          {gone.length > 0 && <span className={prize.chips}>{gone.map((id) => chip({ id, name: "삭제된 시그니처" }))}</span>}
          <span className={styles.note}>고른 순서대로 표의 열이 돼요. 숨긴 시그니처도 숨기기 전에 받은 건 세요.</span>
        </div>
        <div className={prize.field} role="group" aria-label="표시">
          <span className={styles.muted}>표시</span>
          <span className={prize.inline}>
            <span className={styles.segment} role="group" aria-label="줄">
              {SIG_COUNT_ROWS.map((r) => (
                <button key={r.key} type="button" aria-pressed={draft.rows === r.key} onClick={() => edit({ rows: r.key })}>
                  {r.label}
                </button>
              ))}
            </span>
            <span className={styles.segment} role="group" aria-label="정렬">
              {SIG_COUNT_SORTS.map((r) => (
                <button key={r.key} type="button" aria-pressed={draft.sort === r.key} onClick={() => edit({ sort: r.key })}>
                  {r.label}
                </button>
              ))}
            </span>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.showTotal} onChange={(e) => edit({ showTotal: e.target.checked })} />
              하단 합계
            </label>
          </span>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(settings)}>
            되돌리기
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            설정 저장
          </button>
        </div>
      </form>

      {!live || !table ? (
        <p className={styles.note}>방송을 시작하면 실시간 미리보기와 OBS 표시 · 다시 세기 버튼이 나와요.</p>
      ) : (
        <>
          <div className={prize.window} role="group" aria-label="세는 구간">
            <span className={styles.muted}>{time(table.since)}부터 세는 중</span>
            <button type="button" className={styles.ghost} disabled={pending} onClick={reset}>
              다시 세기
            </button>
          </div>
          {dirty && <p className={styles.note}>저장하지 않은 설정이 있어요. 미리보기와 OBS는 저장한 설정으로 보여요.</p>}
          {table.columns.length === 0 ? (
            <p className={styles.empty}>셀 시그니처를 골라 저장해 주세요.</p>
          ) : table.rows.length === 0 ? (
            <p className={styles.empty}>아직 받은 시그니처가 없어요.</p>
          ) : (
            <div className={sig.scroll}>
              <table className={sig.table} aria-label="시그 카운트 미리보기">
                <thead>
                  <tr>
                    <th scope="col">멤버</th>
                    {table.columns.map((c) => (
                      <th key={c.id} scope="col">
                        {c.name}
                      </th>
                    ))}
                    <th scope="col">합계</th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows.map((r) => (
                    <tr key={r.memberId ?? "none"}>
                      <th scope="row">
                        <span className={styles.boardName}>
                          {r.color && <span className={styles.dot} style={{ background: r.color }} aria-hidden="true" />}
                          {r.name}
                        </span>
                      </th>
                      {r.counts.map((n, i) => (
                        <td key={table.columns[i].id} data-zero={n === 0 || undefined}>
                          {formatNumber(n)}
                        </td>
                      ))}
                      <td>
                        <strong>{formatNumber(r.total)}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {table.settings.showTotal && (
                  <tfoot>
                    <tr>
                      <th scope="row">합계</th>
                      {table.totals.map((n, i) => (
                        <td key={table.columns[i].id}>{formatNumber(n)}</td>
                      ))}
                      <td>
                        <strong>{formatNumber(table.totals.reduce((s, n) => s + n, 0))}</strong>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}

      <div className={styles.addRow}>
        <input className={styles.input} value={shownOverlayAddress(origin, overlayPath, "?sigcount")} readOnly aria-label="시그 카운트 오버레이 주소" onFocus={(e) => e.target.select()} />
        <CopyButton value={`${origin}${overlayPath}?sigcount`} label="복사" className={styles.ghost} />
      </div>
    </section>
  );
}
