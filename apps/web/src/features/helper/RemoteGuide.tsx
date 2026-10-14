"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { REMOTE_WINDOW_PATH, openRemoteWindow } from "@/features/creatorStudio/remote/remoteWindow";
import { CopyButton } from "@/features/creatorStudio/settings/SettingsCards";
import styles from "./helper.module.css";

const CAN_DO = [
  { emoji: "🔔", title: "후원 알림", text: "전체 일시정지 · 음소거, 지금 알림 건너뛰기, 대기열 취소, 지난 알림 다시 보내기" },
  { emoji: "🔊", title: "볼륨 · 표시", text: "후원 알림음 · TTS · 시그니처 소리 · 영상 후원 볼륨, 알림 표시 시간, 최소 알림 금액" },
  { emoji: "🧪", title: "테스트 후원", text: "방송 화면에 알림이 잘 나오는지 확인해요. 화면에만 보이고 FN은 움직이지 않아요." },
  { emoji: "🎚️", title: "기능 제어", text: "오버레이마다 켜고 끄고, 방송 화면을 새로고침해요." },
  { emoji: "🎲", title: "게임 · 도구", text: "투표 · 룰렛 · 뽑기 · 벽지 진행, 타이머 · 엔딩 크레딧 · 빙고" }
];

/** 라이브 방송 리모컨 가이드 — code-first (no Figma frame), after the legacy FlexTV 도우미 guide page. */
export function RemoteGuide() {
  const [origin, setOrigin] = useState("");
  const [blocked, setBlocked] = useState(false);
  useEffect(() => setOrigin(window.location.origin), []);
  const address = `${origin}${REMOTE_WINDOW_PATH}`;

  return (
    <div className={styles.content}>
      <header className={styles.pageHeader}>
        <h1>라이브 방송 리모컨 가이드</h1>
        <p>방송 중 OBS 화면에 나가는 후원 알림과 위젯을 한곳에서 제어하는 방법이에요. 리모컨은 작은 창, OBS 독, 휴대폰 어디서든 열 수 있어요.</p>
      </header>

      <section className={styles.section} aria-labelledby="guide-can">
        <h2 id="guide-can" className={styles.sectionTitle}>
          리모컨으로 할 수 있는 것
        </h2>
        <ul className={styles.cards}>
          {CAN_DO.map((c) => (
            <li key={c.title} className={styles.card}>
              <span className={styles.cardEmoji} aria-hidden="true">
                {c.emoji}
              </span>
              <span className={styles.cardText}>
                <strong>{c.title}</strong>
                <span>{c.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section} aria-labelledby="guide-open">
        <h2 id="guide-open" className={styles.sectionTitle}>
          여는 방법
        </h2>
        <div className={styles.addressBox}>
          <span className={styles.addressLabel}>리모컨 주소</span>
          <div className={styles.addressRow}>
            <input className={styles.addressField} value={address} readOnly aria-label="리모컨 주소" onFocus={(e) => e.target.select()} />
            <CopyButton value={address} label="주소 복사" className={styles.stepLink} />
          </div>
        </div>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <strong>작은 창으로</strong>
            <p>왼쪽 메뉴 아래 ‘리모컨 열기’를 누르면 1000 × 800 창이 열려요. 방송 화면 옆에 띄워 두고 쓰세요. 창이 열리지 않으면 브라우저의 팝업 차단을 풀어 주세요.</p>
            <button type="button" className={styles.stepLink} onClick={() => setBlocked(!openRemoteWindow())}>
              리모컨 열기 ↗
            </button>
            {blocked && (
              <p role="alert">
                브라우저가 새 창을 막았어요. 팝업을 허용하거나 <Link href="/remote">이 창에서 열기</Link>로 보세요.
              </p>
            )}
          </li>
          <li className={styles.step}>
            <strong>OBS 안에 넣기</strong>
            <p>
              OBS 상단 메뉴 ‘독’ → ‘사용자 지정 브라우저 독’에서 이름(예: 리모컨)과 위 주소를 넣어요. OBS 버전에 따라 ‘보기 → 독’ 안에 있어요. 독 안에서 처음 한 번
              썸네이션 계정으로 로그인해요.
            </p>
          </li>
          <li className={styles.step}>
            <strong>휴대폰으로</strong>
            <p>휴대폰 브라우저에서 같은 주소를 열고 로그인하면, 방송 중 자리에서 바로 알림을 넘기거나 멈출 수 있어요.</p>
          </li>
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="guide-note">
        <h2 id="guide-note" className={styles.sectionTitle}>
          알아 두기
        </h2>
        <ul className={styles.notes}>
          <li>리모컨 주소는 로그인한 크리에이터 본인만 열 수 있어요. 연동 키가 들어 있는 오버레이 주소와 달리 주소만으로는 열리지 않아요.</li>
          <li>리모컨을 여러 곳에서 열어도 같은 알림 대기열을 제어해요. 화면은 몇 초마다 서버의 상태로 새로 고쳐져요.</li>
          <li>기능 제어에서 끈 오버레이는 OBS 소스가 있어도 방송 화면에 나오지 않아요. 아무것도 안 나오면 기능 제어부터 확인하세요.</li>
          <li>테스트 후원은 방송 화면 확인용이라 FN이 움직이지 않고 수익에도 들어가지 않아요.</li>
        </ul>
      </section>
    </div>
  );
}
