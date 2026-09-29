"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { pollDonationLinks, setDonationLink, simulateExternalDonation } from "@/services/creator/donationLink";
import { SIM_CURRENCIES, type DonationLinkResult, type DonationLinkView, type SimCurrency } from "@/services/creator/donationLinkTypes";
import { PLATFORM_LABEL } from "@/types/platform";
import styles from "../crew/crew.module.css";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—");

/**
 * 후원 연동 — code-first (no Figma frame). Route `/creator/widgets/link`.
 * Broadcast-platform donations appear in 후원 알림 in their own currency; they are not Somnation payments.
 */
export function DonationLinkScreen({ view }: { view: DonationLinkView }) {
  const router = useRouter();
  const [sim, setSim] = useState({ donor: "시청자", message: "응원해요!", value: 5_000, currency: "KRW" as SimCurrency, redeliver: false });
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);

  const run = (action: () => Promise<DonationLinkResult>, ok: (r: Extract<DonationLinkResult, { status: "OK" }>) => string, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") {
          setNote({ tone: "ok", text: ok(res) });
          after?.();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
        router.refresh();
      } catch {
        setNote({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  const counts = (r: { ingested?: number; duplicates?: number }) => `알림 ${r.ingested ?? 0}건${r.duplicates ? ` · 중복 ${r.duplicates}건 무시` : ""}`;
  const send = () => {
    requestId.current ??= crypto.randomUUID();
    run(() => simulateExternalDonation({ platform: "YOUTUBE", ...sim, requestId: requestId.current }), (r) => `테스트 슈퍼챗을 보냈어요. ${counts(r)}`, () => (requestId.current = null));
  };
  const yt = view.links.find((l) => l.platform === "YOUTUBE")!;

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>후원 연동</h1>
        <p className={styles.subtitle}>방송 플랫폼에서 받은 후원을 썸네이션 후원 알림에 함께 띄워요. 금액은 플랫폼 통화 그대로 보여 줘요.</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">← 위젯</Link> · 연동 후원은 썸네이션 결제가 아니라서 FN · 수익 · 정산에 포함되지 않아요 (FN 환산 · 집계 방식 TBD).
        </p>
      </header>

      <section className={styles.card} aria-labelledby="ln-platforms">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="ln-platforms">
            🔌 플랫폼
          </h2>
          <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(pollDonationLinks, (r) => `새로 가져왔어요. ${counts(r)}`)}>
            지금 가져오기
          </button>
        </div>
        <ul className={styles.list}>
          {view.links.map((l) => (
            <li key={l.platform} className={styles.row} data-inactive={l.supported ? undefined : ""}>
              <div className={styles.rowMain}>
                <span className={styles.rowTitle}>{PLATFORM_LABEL[l.platform]}</span>
                <span className={styles.muted}>
                  {!l.supported
                    ? "후원 이벤트 연동 확인 중 (API 지원 TBD)"
                    : !l.connected
                      ? "채널 연결이 필요해요"
                      : `받은 후원 ${l.received}건 · 중복 무시 ${l.duplicates}건 · 마지막 ${when(l.lastEventAt)}`}
                </span>
              </div>
              {l.supported && !l.connected && l.platform === "YOUTUBE" && (
                <Link href="/creator/youtube" className={styles.ghost}>
                  유튜브 연동
                </Link>
              )}
              <label className={styles.checkRow}>
                <input
                  type="checkbox"
                  checked={l.enabled}
                  disabled={pending || !l.supported || !l.connected}
                  onChange={(e) => run(() => setDonationLink({ platform: l.platform, enabled: e.target.checked }), () => (e.target.checked ? `${PLATFORM_LABEL[l.platform]} 후원을 알림에 띄워요.` : "연동을 껐어요."))}
                />
                알림에 표시
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="ln-sim">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="ln-sim">
            🧪 테스트 슈퍼챗 (개발용)
          </h2>
        </div>
        <div className={styles.addRow}>
          <input className={styles.input} aria-label="보낸 사람" maxLength={40} value={sim.donor} onChange={(e) => setSim({ ...sim, donor: e.target.value })} />
          <input className={styles.input} aria-label="메시지" maxLength={200} value={sim.message} onChange={(e) => setSim({ ...sim, message: e.target.value })} />
          <input className={styles.inputSmall} type="number" min={1} aria-label="금액" value={sim.value} onChange={(e) => setSim({ ...sim, value: Number(e.target.value) || 0 })} />
          <select className={styles.select} aria-label="통화" value={sim.currency} onChange={(e) => setSim({ ...sim, currency: e.target.value as SimCurrency })}>
            {SIM_CURRENCIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className={styles.addRow}>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={sim.redeliver} onChange={(e) => setSim({ ...sim, redeliver: e.target.checked })} />
            같은 이벤트를 두 번 전달 (중복 방지 확인)
          </label>
          <button type="button" className={styles.primary} disabled={pending || !yt.connected} onClick={send}>
            보내기
          </button>
        </div>
        <p className={styles.note}>유튜브 채널에 슈퍼챗이 들어온 것처럼 흉내 내요. &ldquo;알림에 표시&rdquo;가 켜져 있어야 리모컨 대기열에 들어가요.</p>
      </section>

      <section className={styles.card} aria-labelledby="ln-recent">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="ln-recent">
            🕘 최근 연동 후원
          </h2>
          <Link href="/creator/remote" className={styles.ghost}>
            리모컨
          </Link>
        </div>
        {view.recent.length === 0 ? (
          <p className={styles.empty}>아직 연동된 후원이 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {view.recent.map((d) => (
              <li key={d.key} className={styles.row}>
                <div className={styles.rowMain}>
                  <span className={styles.rowTitle}>
                    {d.donor} · {d.amountLabel}
                  </span>
                  <span className={styles.muted}>
                    {d.kindLabel} · {when(d.receivedAt)}
                    {d.message ? ` · ${d.message}` : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
