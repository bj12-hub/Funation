"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { checkPlatform, saveSiteBanner } from "@/lib/actions";
import { type PlatformStatusRow, type SystemView, PLATFORM_ERROR_LABEL, BANNER_MESSAGE_MAX, PLATFORM_LABEL } from "@/types/adminApi";
import styles from "../admin.module.css";

const CAP_LABEL: Record<string, string> = { CHANNEL_PROFILE: "채널 정보", VIDEO_LIST: "영상 목록", LIVE_STATUS: "방송 상태", CHAT_EVENTS: "채팅 읽기", CHAT_SEND: "채팅 보내기", CHAT_MODERATE: "채팅 관리", DONATION_EVENTS: "후원 이벤트" };
const at = (iso: string | null) => (iso ? new Date(iso).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "—");

/** 플랫폼 연동 — code-first. Route `/platforms`. Adapter capabilities, connections and a check. */
export function PlatformsScreen({ rows }: { rows: PlatformStatusRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const check = (p: PlatformStatusRow["platform"]) =>
    startTransition(async () => {
      await checkPlatform(p).catch(() => undefined);
      router.refresh();
    });
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>플랫폼 연동</h1>
        <p className={styles.muted}>플랫폼 어댑터가 지원하는 기능과 연동 상태예요. 치지직 · SOOP · FlexTV의 채팅 · 후원 API 지원 범위는 확인 중이에요 — 「확인 중」 표시는 mock에만 선언된 기능이에요 (TBD). 실서비스는 OAuth · 웹훅 · 할당량 모니터링이 필요해요.</p>
      </header>
      <div className={styles.tiles}>
        {rows.map((r) => (
          <section key={r.platform} className={styles.card} aria-label={PLATFORM_LABEL[r.platform]}>
            <div className={styles.cardHead}>
              <h2 className={styles.cardTitle}>{PLATFORM_LABEL[r.platform]}</h2>
              <button type="button" className={styles.button} disabled={pending} onClick={() => check(r.platform)}>
                연결 확인
              </button>
            </div>
            <p className={styles.muted}>지원 기능: {r.capabilities.map((c) => `${CAP_LABEL[c] ?? c}${r.unverified.includes(c) ? "(확인 중)" : ""}`).join(" · ")}</p>
            <dl className={styles.facts}>
              <div>
                <dt>스튜디오 연결</dt>
                <dd>{r.connection.connected ? `${r.connection.channelTitle} · 영상 ${r.connection.videoCount}개` : "연결 안 됨"}</dd>
              </div>
              <div>
                <dt>마지막 동기화</dt>
                <dd>
                  {at(r.connection.lastSyncedAt)}
                  {r.connection.lastError && <span className={styles.warn}> · {PLATFORM_ERROR_LABEL[r.connection.lastError]}</span>}
                </dd>
              </div>
              <div>
                <dt>후원 연동</dt>
                <dd>{r.donationLink.enabled ? `켜짐 · ${r.donationLink.received}건 (중복 ${r.donationLink.duplicates})` : "꺼짐"}</dd>
              </div>
              <div>
                <dt>연결 확인</dt>
                <dd>
                  {r.lastCheck ? (
                    <span className={r.lastCheck.ok ? styles.chipOk : styles.chipBad}>
                      {r.lastCheck.ok ? `정상 · ${r.lastCheck.latencyMs}ms` : PLATFORM_ERROR_LABEL[r.lastCheck.error ?? "UNAVAILABLE"]}
                    </span>
                  ) : (
                    "—"
                  )}
                  {r.lastCheck && <span className={styles.muted}> {at(r.lastCheck.at)}</span>}
                </dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

/** 시스템 — code-first. Route `/system`. Site notice banner and runtime info. */
export function SystemScreen({ view }: { view: SystemView }) {
  const router = useRouter();
  const [b, setB] = useState({ enabled: view.banner.enabled, level: view.banner.level, message: view.banner.message, href: view.banner.href ?? "" });
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const save = () => {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await saveSiteBanner(b);
        if (res.status === "OK") {
          setMsg({ tone: "ok", text: b.enabled ? "사이트에 배너를 띄웠어요." : "배너를 내렸어요." });
          router.refresh();
        } else setMsg({ tone: "error", text: res.status === "INVALID" ? res.message : "관리자 로그인이 필요합니다." });
      } catch {
        setMsg({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };
  return (
    <div className={styles.content}>
      <header className={styles.pageHead}>
        <h1 className={styles.title}>시스템</h1>
        <p className={styles.muted}>사이트 전체에 보이는 공지 배너(점검 · 장애 안내)와 실행 환경을 관리해요.</p>
      </header>
      <section className={styles.card} aria-labelledby="sys-banner">
        <div className={styles.cardHead}>
          <h2 id="sys-banner" className={styles.cardTitle}>
            사이트 공지 배너
          </h2>
          <label className={styles.check}>
            <input type="checkbox" checked={b.enabled} onChange={(e) => setB({ ...b, enabled: e.target.checked })} />
            사이트에 표시
          </label>
        </div>
        <div className={styles.segment} role="radiogroup" aria-label="배너 종류">
          {(["INFO", "WARNING"] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={b.level === l} className={styles.segmentItem} onClick={() => setB({ ...b, level: l })}>
              {l === "INFO" ? "안내" : "주의 (점검 · 장애)"}
            </button>
          ))}
        </div>
        <input className={styles.input} aria-label="배너 문구" placeholder="예: 10월 3일 02:00~04:00 정기 점검이 있어요" maxLength={BANNER_MESSAGE_MAX} value={b.message} onChange={(e) => setB({ ...b, message: e.target.value })} />
        <input className={styles.input} aria-label="배너 링크" placeholder="자세히 보기 링크 (선택, 예: /support/notices/…)" value={b.href} onChange={(e) => setB({ ...b, href: e.target.value })} />
        <div className={styles.filters}>
          <button type="button" className={styles.button} disabled={pending} onClick={save}>
            {pending ? "저장 중…" : "저장"}
          </button>
          <span className={styles.muted}>
            마지막 변경 {at(view.banner.updatedAt)} {view.banner.updatedBy ? `· ${view.banner.updatedBy}` : ""}
          </span>
        </div>
        {msg && (
          <p className={msg.tone === "error" ? styles.error : styles.ok} role={msg.tone === "error" ? "alert" : "status"}>
            {msg.text}
          </p>
        )}
      </section>
      <section className={styles.card} aria-labelledby="sys-runtime">
        <h2 id="sys-runtime" className={styles.cardTitle}>
          실행 환경
        </h2>
        <dl className={styles.facts}>
          <div>
            <dt>데이터</dt>
            <dd>{view.runtime.mock ? "mock (개발용 메모리 저장소)" : "백엔드 연결"}</dd>
          </div>
          <div>
            <dt>NODE_ENV</dt>
            <dd>{view.runtime.nodeEnv}</dd>
          </div>
          <div>
            <dt>감사 로그</dt>
            <dd>{view.runtime.auditEntries}건</dd>
          </div>
        </dl>
        <p className={styles.muted}>mock 데이터는 서버를 다시 시작하면 초기화돼요. 백엔드 · 데이터베이스는 아직 정해지지 않았어요 (TBD).</p>
      </section>
    </div>
  );
}
