"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatKst, formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { reissueBankSmsKey, setBankSms, simulateBankSms } from "@/services/bankSms/bankSms";
import { SAMPLE_BANK_SMS, type BankSmsResult, type BankSmsView } from "@/services/bankSms/bankSmsTypes";
import styles from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";

const time = (iso: string) => formatKst(iso, { dateStyle: "short", timeStyle: "short" });
/** The secret part of the address, as on 오버레이 주소. */
const masked = (path: string) => path.replace(/[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/, (k) => `${k.slice(0, 4)}-····-····-····`);

/**
 * SMS 계좌후원 — code-first mock (funnation "SMS 계좌후원 연결", 2026-10-06 결정), a card on `/creator/widgets/link`.
 * A text-forwarding app sends bank deposit SMS to the address; recognised deposits show as "계좌 후원" alerts in 원
 * (and in the crew broadcast 후원 리스트). 테스트 문자 runs a pasted SMS through the same steps.
 */
export function BankSmsCard({ view }: { view: BankSmsView }) {
  const router = useRouter();
  const { t } = useI18n();
  const [text, setText] = useState(SAMPLE_BANK_SMS);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  const run = (action: () => Promise<BankSmsResult>, ok: (r: BankSmsResult) => { tone: "ok" | "error"; text: string } | null, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "UNAUTHORIZED") setNote({ tone: "error", text: t("studioTools.loginRequired") });
        else if (res.status === "INVALID") setNote({ tone: "error", text: res.message });
        else {
          setNote(ok(res));
          after?.();
        }
        router.refresh();
      } catch {
        setNote({ tone: "error", text: t("studioTools.processFailed") });
      }
    });
  };
  const test = () => {
    requestId.current ??= crypto.randomUUID();
    run(
      () => simulateBankSms({ text, requestId: requestId.current }),
      (r) =>
        r.status === "OK"
          ? { tone: "ok", text: t("studioToolsLink.depositSent", { name: r.deposit.depositor, amount: formatNumber(r.deposit.amount) }) }
          : r.status === "UNPARSED"
            ? { tone: "error", text: t("studioToolsLink.unparsed") }
            : r.status === "OFF"
              ? { tone: "error", text: t("studioToolsLink.smsOff") }
              : { tone: "ok", text: t("studioToolsLink.duplicate") },
      () => (requestId.current = null)
    );
  };

  return (
    <section className={styles.card} aria-labelledby="ln-bank">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="ln-bank">
          {t("studioToolsLink.bankTitle")} <span className={styles.chipOff}>{t("studioToolsLink.mock")}</span>
        </h2>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={view.enabled}
            disabled={pending}
            onChange={(e) => {
              const on = e.target.checked;
              run(() => setBankSms({ enabled: on }), () => ({ tone: "ok", text: on ? t("studioToolsLink.bankOn") : t("studioToolsLink.bankOff") }));
            }}
          />
          {t("studioTools.on")}
        </label>
      </div>
      <p className={styles.note}>{t("studioToolsLink.bankNote")}</p>
      <div className={styles.addRow}>
        <input className={styles.input} readOnly aria-label={t("studioToolsLink.hookAddress")} value={`${origin}${masked(view.hookPath)}`} />
        <CopyButton value={`${origin}${view.hookPath}`} label={t("studioTools.copyAddress")} className={styles.ghost} />
        <button
          type="button"
          className={styles.ghost}
          disabled={pending}
          onClick={() => window.confirm(t("studioToolsLink.reissueConfirm")) && run(reissueBankSmsKey, () => ({ tone: "ok", text: t("studioToolsLink.reissued") }))}
        >
          {t("studioTools.reissue")}
        </button>
      </div>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={view.maskNames}
          disabled={pending}
          onChange={(e) => {
            const on = e.target.checked;
            run(() => setBankSms({ maskNames: on }), () => ({ tone: "ok", text: on ? t("studioToolsLink.maskOn") : t("studioToolsLink.maskOff") }));
          }}
        />
        {t("studioToolsLink.maskLabel")}
      </label>

      <details>
        <summary className={styles.muted}>{t("studioToolsLink.testSummary")}</summary>
        <div className={styles.startForm}>
          <textarea className={`${styles.input} ${styles.textarea}`} rows={7} aria-label={t("studioToolsLink.testAria")} value={text} onChange={(e) => setText(e.target.value)} />
          <div className={styles.actions}>
            <span className={styles.muted}>{t("studioToolsLink.noRealData")}</span>
            <button type="button" className={styles.primary} disabled={pending || !text.trim()} onClick={test}>
              {pending ? t("studioTools.sending") : t("studioToolsLink.testSummary")}
            </button>
          </div>
        </div>
      </details>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}

      <p className={styles.muted}>
        {t("studioToolsLink.bankStats", { received: formatNumber(view.received), duplicates: formatNumber(view.duplicates), unparsed: formatNumber(view.unparsed) })}
      </p>
      {view.recent.length === 0 ? (
        <p className={styles.empty}>{t("studioToolsLink.bankEmpty")}</p>
      ) : (
        <ul className={styles.list} aria-label={t("studioToolsLink.bankRecentAria")}>
          {view.recent.map((d) => (
            <li key={d.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{d.depositor}</span>
                <span className={styles.muted}>{time(d.receivedAt)}</span>
              </div>
              <strong>{t("studioToolsLink.won", { amount: formatNumber(d.amount) })}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
