"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { pollDonationLinks, setDonationLink, simulateExternalDonation } from "@/services/creator/donationLink";
import { SIM_CURRENCIES, type DonationLinkResult, type DonationLinkView, type SimCurrency } from "@/services/creator/donationLinkTypes";
import type { BankSmsView } from "@/services/bankSms/bankSmsTypes";
import { PLATFORM_ERROR_LABEL } from "@/services/platforms/platformTypes";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import styles from "../crew/crew.module.css";
import { BankSmsCard } from "./BankSmsCard";

/** Platform-native units for the simulator (YouTube picks a currency). FlexTV's unit is TBD. */
const UNIT: Record<Platform, string> = { YOUTUBE: "", CHZZK: "치즈", SOOP: "별풍선 개수", FLEXTV: "후원 단위 (TBD)" };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—");

/**
 * 후원 연동 — code-first (no Figma frame). Route `/creator/widgets/link`.
 * Broadcast-platform donations appear in 후원 알림 in their own currency; they are not Somnation payments.
 * Every platform feeds the same single queue (통합 후원 알림), so simulcast alerts never play on top of each other.
 * SMS 계좌후원 (mock, 2026-10-06) feeds the same queue in 원.
 */
export function DonationLinkScreen({ view, bank }: { view: DonationLinkView; bank: BankSmsView }) {
  const router = useRouter();
  const [sim, setSim] = useState({ platform: "YOUTUBE" as Platform, donor: "시청자", message: "응원해요!", value: 5_000, currency: "KRW" as SimCurrency, redeliver: false });
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
    run(() => simulateExternalDonation({ ...sim, platform: simPlatform, requestId: requestId.current }), (r) => `${PLATFORM_LABEL[simPlatform]} 테스트 후원을 보냈어요. ${counts(r)}`, () => (requestId.current = null));
  };
  const ready = view.links.filter((l) => l.supported && l.connected).map((l) => l.platform);
  const simPlatform = ready.includes(sim.platform) ? sim.platform : (ready[0] ?? sim.platform);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>후원 연동</h1>
        <p className={styles.subtitle}>여러 플랫폼에 동시 송출할 때 플랫폼마다 들어온 후원을 대기열 하나에 모아, 겹치지 않게 하나씩 띄워요. 금액은 플랫폼 단위 그대로 보여 줘요.</p>
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
                <span className={styles.rowTitle}>
                  {PLATFORM_LABEL[l.platform]} {l.supported && l.unverified && <span className={styles.chipOff}>API 확인 중</span>}
                </span>
                <span className={styles.muted}>
                  {!l.supported
                    ? "후원 이벤트 연동 확인 중 (API 지원 TBD)"
                    : !l.connected
                      ? "채널 연결이 필요해요"
                      : `받은 후원 ${l.received}건 · 중복 무시 ${l.duplicates}건${l.skipped ? ` · 읽을 수 없어 건너뜀 ${l.skipped}건` : ""} · 마지막 ${when(l.lastEventAt)}`}
                </span>
                {l.enabled && l.lastError && <span className={styles.muted}>⚠ {PLATFORM_ERROR_LABEL[l.lastError]}</span>}
              </div>
              {l.supported && !l.connected && (
                <Link href={l.platform === "YOUTUBE" ? "/creator/youtube" : "/creator/chat"} className={styles.ghost}>
                  {l.platform === "YOUTUBE" ? "유튜브 연동" : "채널 연결"}
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
            🧪 테스트 후원 (개발용)
          </h2>
        </div>
        <div className={styles.addRow}>
          <select className={styles.select} aria-label="플랫폼" value={simPlatform} onChange={(e) => setSim({ ...sim, platform: e.target.value as Platform })}>
            {ready.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
          <input className={styles.input} aria-label="보낸 사람" maxLength={40} value={sim.donor} onChange={(e) => setSim({ ...sim, donor: e.target.value })} />
          <input className={styles.input} aria-label="메시지" maxLength={200} value={sim.message} onChange={(e) => setSim({ ...sim, message: e.target.value })} />
          <input className={styles.inputSmall} type="number" min={1} step={simPlatform === "YOUTUBE" ? "any" : 1} aria-label={simPlatform === "YOUTUBE" ? "금액" : UNIT[simPlatform]} value={sim.value} onChange={(e) => setSim({ ...sim, value: Number(e.target.value) || 0 })} />
          {simPlatform === "YOUTUBE" ? (
            <select className={styles.select} aria-label="통화" value={sim.currency} onChange={(e) => setSim({ ...sim, currency: e.target.value as SimCurrency })}>
              {SIM_CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          ) : (
            <span className={styles.muted}>{UNIT[simPlatform]}</span>
          )}
        </div>
        <div className={styles.addRow}>
          <label className={styles.checkRow}>
            <input type="checkbox" checked={sim.redeliver} onChange={(e) => setSim({ ...sim, redeliver: e.target.checked })} />
            같은 이벤트를 두 번 전달 (중복 방지 확인)
          </label>
          <button type="button" className={styles.primary} disabled={pending || ready.length === 0} onClick={send}>
            보내기
          </button>
        </div>
        <p className={styles.note}>연결된 플랫폼에 후원(슈퍼챗 · 치즈 · 별풍선 등)이 들어온 것처럼 흉내 내요. &ldquo;알림에 표시&rdquo;가 켜져 있어야 리모컨 대기열에 들어가요.</p>
      </section>

      <BankSmsCard view={bank} />

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
