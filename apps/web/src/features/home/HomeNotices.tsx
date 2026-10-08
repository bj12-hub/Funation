"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AlertTriangleIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import { kstDateString } from "@/lib/period";
import type { HomeNotice } from "@/services/home/homeFeed";
import styles from "./homeNotices.module.css";

// Per-viewer display preferences only (not account data).
const HIDE_KEY = "ssumnation.homeNotices.hiddenOn";
const CLOSED_KEY = "ssumnation.homeNotices.closed";

/** "오늘" is the Korean day: the notices come back at 00:00 KST (the UTC day would turn over at 09:00). */
const today = () => kstDateString();

function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) === today() || sessionStorage.getItem(CLOSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Arrival notices over the home page — Figma 200:115 (ID 연결 안내) · 200:223 (사칭/사기 주의).
 * "오늘 하루 열지 않음" hides them until tomorrow; "닫기" hides them for this browser session.
 * Opens after mount so server and client HTML match.
 */
export function HomeNotices({ notices }: { notices: HomeNotice[] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [hideToday, setHideToday] = useState(false);

  useEffect(() => {
    // Reading browser storage has to wait for mount; the notice then opens once.
    if (notices.length > 0 && !readHidden()) setOpen(true);
  }, [notices.length]);

  if (notices.length === 0) return null;

  const close = () => {
    try {
      if (hideToday) localStorage.setItem(HIDE_KEY, today());
      sessionStorage.setItem(CLOSED_KEY, "1");
    } catch {
      // Storage unavailable (private mode): the notice simply shows again next time.
    }
    setOpen(false);
  };

  const notice = notices[index];
  const go = (delta: number) => setIndex((i) => (i + delta + notices.length) % notices.length);

  return (
    <Modal open={open} onClose={close} title="공지사항" width={664} className={styles.dialog} customHeader={<span className={styles.srOnly}>공지사항</span>}>
      {/* Figma notice popups are dark-only: keep dark tokens in the light theme. */}
      <div className={styles.stage} data-theme="dark">
        {notices.length > 1 && (
          <button type="button" className={styles.arrow} onClick={() => go(-1)} aria-label="이전 공지">
            ‹
          </button>
        )}
        <article className={`${styles.card} ${notice.kind === "ID_CONNECT" ? styles.light : styles.warning}`} aria-roledescription="공지" aria-label={`${index + 1} / ${notices.length}`}>
          {notice.kind === "ID_CONNECT" ? <IdConnect notice={notice} /> : <FraudWarning notice={notice} />}
          {notices.length > 1 && (
            <div className={styles.dots} role="tablist" aria-label="공지 선택">
              {notices.map((n, i) => (
                <button
                  key={n.id}
                  type="button"
                  role="tab"
                  aria-selected={i === index}
                  aria-label={`${i + 1}번째 공지`}
                  className={i === index ? styles.dotOn : styles.dot}
                  onClick={() => setIndex(i)}
                />
              ))}
            </div>
          )}
          <div className={styles.bar}>
            <label className={styles.hideToday}>
              <input type="checkbox" checked={hideToday} onChange={(e) => setHideToday(e.target.checked)} />
              <span className={styles.box} aria-hidden="true">
                {hideToday ? "✓" : ""}
              </span>
              오늘 하루 열지 않음
            </label>
            <button type="button" className={styles.closeText} onClick={close}>
              닫기 ✕
            </button>
          </div>
        </article>
        {notices.length > 1 && (
          <button type="button" className={styles.arrow} onClick={() => go(1)} aria-label="다음 공지">
            ›
          </button>
        )}
      </div>
    </Modal>
  );
}

/** 200:157 — white card. The design's illustration shows unconfirmed platforms (Naver, Twitch);
 *  it is redrawn with the confirmed YouTube · SOOP · FlexTV logos. */
function IdConnect({ notice }: { notice: Extract<HomeNotice, { kind: "ID_CONNECT" }> }) {
  return (
    <div className={styles.lightBody}>
      <header className={styles.lightHeader}>
        <span className={styles.miniBrand}>
          <span aria-hidden="true" />
          썸네이션
        </span>
        <span className={styles.noticeLabel}>NOTICE</span>
      </header>
      <span className={styles.badge}>{notice.badge}</span>
      <h2 className={styles.lightTitle}>
        <span>{notice.titleAccent}</span>
        {notice.title}
      </h2>
      <div className={styles.illustration} aria-hidden="true">
        <div className={styles.laptop}>
          <div className={styles.screen}>
            <span className={styles.screenLogo} />
            <span className={styles.screenLine} />
            <span className={styles.screenLine} />
            <span className={styles.screenButton} />
          </div>
          <div className={styles.base} />
        </div>
        {["youtube", "soop", "flextv"].map((p, i) => (
          <span key={p} className={`${styles.bubble} ${styles[`bubble${i}`]}`}>
            <Image src={`/mock/room/logo-${p}.png`} alt="" width={30} height={30} />
          </span>
        ))}
      </div>
    </div>
  );
}

/** 200:274 — dark card with a red border. */
function FraudWarning({ notice }: { notice: Extract<HomeNotice, { kind: "FRAUD_WARNING" }> }) {
  return (
    <div className={styles.warningBody}>
      <header className={styles.warningHeader}>
        <span className={styles.wordmark}>
          FUN<span>ATION</span>
        </span>
        <span className={styles.tag}>{notice.tag}</span>
      </header>
      <span className={styles.warningIcon} aria-hidden="true">
        <AlertTriangleIcon />
      </span>
      <h2 className={styles.warningTitle}>{notice.title}</h2>
      <div className={styles.paragraphs}>
        <p>{notice.lead}</p>
        <p className={styles.emphasis}>{notice.emphasis}</p>
      </div>
      <p className={styles.callout}>{notice.callout}</p>
      <ul className={styles.bullets}>
        {notice.bullets.map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}
