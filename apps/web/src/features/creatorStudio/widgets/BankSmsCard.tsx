"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatKst, formatNumber } from "@/lib/format";
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
        if (res.status === "UNAUTHORIZED") setNote({ tone: "error", text: "로그인이 필요합니다." });
        else if (res.status === "INVALID") setNote({ tone: "error", text: res.message });
        else {
          setNote(ok(res));
          after?.();
        }
        router.refresh();
      } catch {
        setNote({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  const test = () => {
    requestId.current ??= crypto.randomUUID();
    run(
      () => simulateBankSms({ text, requestId: requestId.current }),
      (r) =>
        r.status === "OK"
          ? { tone: "ok", text: `${r.deposit.depositor} 님 ${formatNumber(r.deposit.amount)}원 입금을 알림으로 보냈어요.` }
          : r.status === "UNPARSED"
            ? { tone: "error", text: "입금 문자로 인식하지 못했어요. 금액과 입금자명이 들어 있는지 확인해 주세요." }
            : r.status === "OFF"
              ? { tone: "error", text: "SMS 계좌후원이 꺼져 있어요. 먼저 켜 주세요." }
              : { tone: "ok", text: "이미 받은 문자예요. 알림은 한 번만 떠요." },
      () => (requestId.current = null)
    );
  };

  return (
    <section className={styles.card} aria-labelledby="ln-bank">
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle} id="ln-bank">
          🏦 SMS 계좌후원 <span className={styles.chipOff}>목업</span>
        </h2>
        <label className={styles.checkRow}>
          <input
            type="checkbox"
            checked={view.enabled}
            disabled={pending}
            onChange={(e) => {
              const on = e.target.checked;
              run(() => setBankSms({ enabled: on }), () => ({ tone: "ok", text: on ? "SMS 계좌후원을 켰어요." : "SMS 계좌후원을 껐어요." }));
            }}
          />
          사용
        </label>
      </div>
      <p className={styles.note}>
        휴대폰의 문자 전달 앱에서 은행 입금 문자를 아래 주소로 보내도록 설정하면, 입금이 &lsquo;계좌 후원&rsquo; 알림으로 떠요. 금액과 입금자명만 읽고 문자 내용 · 계좌번호 · 잔액은
        저장하지 않아요. 썸네이션 결제가 아니라서 FN · 수익 · 정산에 포함되지 않아요. 은행별 문자 형식과 전달 앱 연동은 TBD예요.
      </p>
      <div className={styles.addRow}>
        <input className={styles.input} readOnly aria-label="문자 전달 주소" value={`${origin}${masked(view.hookPath)}`} />
        <CopyButton value={`${origin}${view.hookPath}`} label="주소 복사" className={styles.ghost} />
        <button
          type="button"
          className={styles.ghost}
          disabled={pending}
          onClick={() => window.confirm("주소를 새로 만들까요? 지금 주소로 오는 문자는 더 이상 받지 않아요.") && run(reissueBankSmsKey, () => ({ tone: "ok", text: "새 주소를 만들었어요. 문자 전달 앱에 새 주소를 넣어 주세요." }))}
        >
          재발급
        </button>
      </div>
      <label className={styles.checkRow}>
        <input
          type="checkbox"
          checked={view.maskNames}
          disabled={pending}
          onChange={(e) => {
            const on = e.target.checked;
            run(() => setBankSms({ maskNames: on }), () => ({ tone: "ok", text: on ? "입금자명을 가려서 보여 줘요." : "입금자명을 그대로 보여 줘요." }));
          }}
        />
        입금자명 가리기 (예: 별***타)
      </label>

      <details>
        <summary className={styles.muted}>테스트 문자 보내기</summary>
        <div className={styles.startForm}>
          <textarea className={`${styles.input} ${styles.textarea}`} rows={7} aria-label="테스트 문자 내용" value={text} onChange={(e) => setText(e.target.value)} />
          <div className={styles.actions}>
            <span className={styles.muted}>실제 계좌번호 · 잔액은 넣지 마세요.</span>
            <button type="button" className={styles.primary} disabled={pending || !text.trim()} onClick={test}>
              {pending ? "보내는 중…" : "테스트 문자 보내기"}
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
        받은 입금 {formatNumber(view.received)}건 · 중복 {formatNumber(view.duplicates)}건 무시 · 인식 못 한 문자 {formatNumber(view.unparsed)}건
      </p>
      {view.recent.length === 0 ? (
        <p className={styles.empty}>아직 받은 입금이 없어요.</p>
      ) : (
        <ul className={styles.list} aria-label="최근 계좌 후원">
          {view.recent.map((d) => (
            <li key={d.id} className={styles.row}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{d.depositor}</span>
                <span className={styles.muted}>{time(d.receivedAt)}</span>
              </div>
              <strong>{formatNumber(d.amount)}원</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
