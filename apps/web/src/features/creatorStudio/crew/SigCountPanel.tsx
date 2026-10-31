"use client";

import { useEffect, useRef, useState } from "react";
import { formatKstTime, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { moveSigCountStart, resetSigCount, saveSigCount, setSigCountVisible } from "@/services/crew/crewSigCount";
import { StartPointPicker } from "./StartPointPicker";
import {
  SIG_COUNT_COLUMNS_MAX,
  SIG_COUNT_ROWS,
  SIG_COUNT_SORTS,
  SIG_COUNT_TITLE_DEFAULT,
  SIG_COUNT_TITLE_MAX,
  type BroadcastResult,
  type BroadcastView,
  type CrewMember,
  type SigCountLive,
  type SigCountRows,
  type SigCountSettings,
  type SigCountSort
} from "@/services/crew/crewTypes";
import { CopyButton } from "../settings/SettingsCards";
import { shownOverlayAddress } from "./overlayAddress";
import styles from "./crew.module.css";
import prize from "./prize.module.css";
import sig from "./sigCount.module.css";

const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });
/** `SIG_COUNT_ROWS` · `SIG_COUNT_SORTS` labels as message keys. */
const ROWS_KEY: Record<SigCountRows, MessageKey> = {
  RECEIVED: "crewGameSigCount.rowsReceived",
  ALL: "crewGameSigCount.rowsAll",
  SELECTED: "crewGameSigCount.rowsSelected"
};
const SORT_KEY: Record<SigCountSort, MessageKey> = { TOTAL: "crewGameSigCount.sortTotal", ORDER: "crewGameSigCount.sortOrder" };

/**
 * 시그 카운트 — code-first (no Figma frame; StreamDonate 시그 카운트 참고), inside `/creator/crew/broadcast`. Pick up to 8
 * signatures; the table counts how many of each every member received (멤버 지정 of the donation, none = 미지정).
 * Settings are saved with 설정 저장; OBS에 표시 and 다시 세기 work while live. The preview is the server's table under the
 * saved settings.
 */
export function SigCountPanel({
  settings,
  signatures,
  members,
  live,
  overlayPath,
  pending,
  run
}: {
  settings: SigCountSettings;
  signatures: BroadcastView["signatures"];
  members: CrewMember[];
  live: { broadcastId: string; table: SigCountLive } | null;
  overlayPath: string;
  pending: boolean;
  run: (action: () => Promise<BroadcastResult>, ok?: string) => void;
}) {
  const { t } = useI18n();
  const name = t("crewGameSigCount.name");
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
    }, t("crewGameSigCount.recounting"));
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
        {s.active === false && <span className={styles.muted}>{t("crewGame.hidden")}</span>}
      </button>
    );
  };

  return (
    <section className={styles.card} aria-labelledby="bc-sigcount">
      <div className={styles.cardHead}>
        <h2 id="bc-sigcount" className={styles.cardTitle}>
          {name}
        </h2>
        {live && (
          <label className={styles.checkRow}>
            <input
              type="checkbox"
              checked={!!table?.visible}
              disabled={pending}
              onChange={(e) =>
                run(
                  () => setSigCountVisible({ broadcastId: live.broadcastId, on: e.target.checked }),
                  e.target.checked ? t("crewGameSigCount.shown") : t("crewGameSigCount.hiddenNow")
                )
              }
            />
            {t("crewGameSigCount.showOnObs")}
          </label>
        )}
      </div>
      <p className={styles.note}>{t("crewGameSigCount.intro")}</p>

      <form
        className={prize.form}
        onSubmit={(e) => {
          e.preventDefault();
          run(() => saveSigCount({ ...draft, signatureIds: picked.filter((id) => known.has(id)) }), t("crewGame.saved", { name }));
        }}
      >
        <div className={prize.field}>
          <span className={styles.muted}>{t("crewGame.titleLabel")}</span>
          <input
            className={styles.input}
            aria-label={t("crewGame.titleAria", { name })}
            placeholder={SIG_COUNT_TITLE_DEFAULT}
            maxLength={SIG_COUNT_TITLE_MAX}
            value={draft.title}
            onChange={(e) => edit({ title: e.target.value })}
          />
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameSigCount.columnsAria")}>
          <span className={styles.muted}>{t("crewGameSigCount.columns", { count: picked.length, max: SIG_COUNT_COLUMNS_MAX })}</span>
          {signatures.length === 0 && <span className={styles.note}>{t("crewGameSigCount.noSignatures")}</span>}
          {groups.map((g) => (
            <span key={g} className={sig.group}>
              {groups.length > 1 && <span className={sig.groupName}>{g}</span>}
              <span className={prize.chips}>{signatures.filter((s) => s.group === g).map(chip)}</span>
            </span>
          ))}
          {gone.length > 0 && <span className={prize.chips}>{gone.map((id) => chip({ id, name: t("crewGameSigCount.deletedSignature") }))}</span>}
          <span className={styles.note}>{t("crewGameSigCount.columnsNote")}</span>
        </div>
        <div className={prize.field} role="group" aria-label={t("crewGameSigCount.display")}>
          <span className={styles.muted}>{t("crewGameSigCount.display")}</span>
          <span className={prize.inline}>
            <span className={styles.segment} role="group" aria-label={t("crewGameSigCount.rowsAria")}>
              {SIG_COUNT_ROWS.map((r) => (
                <button key={r.key} type="button" aria-pressed={draft.rows === r.key} onClick={() => edit({ rows: r.key })}>
                  {t(ROWS_KEY[r.key])}
                </button>
              ))}
            </span>
            <span className={styles.segment} role="group" aria-label={t("crewGameSigCount.sortAria")}>
              {SIG_COUNT_SORTS.map((r) => (
                <button key={r.key} type="button" aria-pressed={draft.sort === r.key} onClick={() => edit({ sort: r.key })}>
                  {t(SORT_KEY[r.key])}
                </button>
              ))}
            </span>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.activeOnly} onChange={(e) => edit({ activeOnly: e.target.checked })} />
              {t("crewGameSigCount.activeOnly")}
            </label>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={draft.showTotal} onChange={(e) => edit({ showTotal: e.target.checked })} />
              {t("crewGameSigCount.showTotal")}
            </label>
          </span>
        </div>
        {draft.rows === "SELECTED" && (
          <div className={prize.field} role="group" aria-label={t("crewGameSigCount.membersLabel")}>
            <span className={styles.muted}>{t("crewGameSigCount.membersLabel")}</span>
            <span className={prize.chips}>
              {members
                .filter((m) => m.active || draft.memberIds.includes(m.id))
                .map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={sig.chip}
                    aria-pressed={draft.memberIds.includes(m.id)}
                    onClick={() => edit({ memberIds: draft.memberIds.includes(m.id) ? draft.memberIds.filter((id) => id !== m.id) : [...draft.memberIds, m.id] })}
                  >
                    <span className={styles.dot} style={{ background: m.color }} aria-hidden="true" />
                    {m.name}
                  </button>
                ))}
            </span>
            <span className={styles.note}>{t("crewGameSigCount.membersNote")}</span>
          </div>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} disabled={pending || !dirty} onClick={() => setDraft(settings)}>
            {t("crewGame.revert")}
          </button>
          <button type="submit" className={styles.primary} disabled={pending || !dirty}>
            {t("crewGame.saveSettings")}
          </button>
        </div>
      </form>

      {!live || !table ? (
        <p className={styles.note}>{t("crewGameSigCount.notLive")}</p>
      ) : (
        <>
          <div className={prize.window} role="group" aria-label={t("crewGameSigCount.windowAria")}>
            <span className={styles.muted}>{t("crewGameSigCount.countingSince", { time: time(table.since) })}</span>
            <button type="button" className={styles.ghost} disabled={pending} onClick={reset}>
              {t("crewGameSigCount.recount")}
            </button>
            <StartPointPicker
              current={table.since}
              pending={pending}
              onMove={(at) => run(() => moveSigCountStart({ broadcastId: live.broadcastId, at }), t("crewGameSigCount.recountFrom", { time: time(at) }))}
            />
          </div>
          {dirty && <p className={styles.note}>{t("crewGameSigCount.unsaved")}</p>}
          {table.columns.length === 0 ? (
            <p className={styles.empty}>{t("crewGameSigCount.noColumns")}</p>
          ) : table.rows.length === 0 ? (
            <p className={styles.empty}>{t("crewGameSigCount.noRows")}</p>
          ) : (
            <div className={sig.scroll}>
              <table className={sig.table} aria-label={t("crewGameSigCount.previewAria")}>
                <thead>
                  <tr>
                    <th scope="col">{t("crewGame.member")}</th>
                    {table.columns.map((c) => (
                      <th key={c.id} scope="col">
                        {c.name}
                      </th>
                    ))}
                    <th scope="col">{t("crewGameSigCount.total")}</th>
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
                      <th scope="row">{t("crewGameSigCount.total")}</th>
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
        <input
          className={styles.input}
          value={shownOverlayAddress(origin, overlayPath, "?sigcount")}
          readOnly
          aria-label={t("crewGame.overlayAria", { label: name })}
          onFocus={(e) => e.target.select()}
        />
        <CopyButton value={`${origin}${overlayPath}?sigcount`} label={t("crewGame.copy")} className={styles.ghost} />
      </div>
    </section>
  );
}
