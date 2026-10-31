import Link from "next/link";
import { ChargeTrigger } from "@/features/walletCharge";
import type { FlextvMyAccount, FlextvSignUpProvider } from "@/lib/flextv/member";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import { NicknameEditor, PasswordEditor, PhotoEditor } from "./editors";
import { Label, Row } from "./MyPageScreen";
import styles from "./mypage.module.css";

const PROVIDER_LABEL: Record<FlextvSignUpProvider, string> = {
  kakao: "카카오",
  naver: "네이버",
  google: "Google",
  twitch: "Twitch",
  other: "다른 서비스"
};

/**
 * 내 정보 with FLEXTV (phase 7, docs/development/flextv-backend.md "7단계") — the 기본 정보 card of Figma 735:4119 with
 * what FLEXTV keeps: 사진 · 닉네임 · 비밀번호 change here; the 아이디 stays; 본인인증 and 회원 탈퇴 open FLEXTV's site.
 * Ssumnation's own sections (활동 등급, 후원자 프로필, 랭킹 노출, 연결 플랫폼, 마케팅 수신) have no FLEXTV backend yet.
 */
export function FlextvMyPageScreen({ account, creator }: { account: FlextvMyAccount; creator: boolean }) {
  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>내 정보</h1>
        <p className={styles.subtitle}>안녕하세요, 나의 회원 정보를 한 눈에 파악하고 관리하세요.</p>
      </header>

      <section className={styles.section} aria-labelledby="mypage-account">
        <h2 id="mypage-account" className={styles.sectionTitle}>
          👤 기본 정보
        </h2>
        <div className={styles.accountCard}>
          <Row label="프로필 사진">
            <div className={styles.avatarRow}>
              {account.thumbUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- FLEXTV's CDN, not one of the image optimizer's hosts
                <img src={account.thumbUrl} alt="" width={80} height={80} className={styles.avatar} />
              ) : (
                <span className={`${styles.avatar} ${styles.avatarFallback}`} aria-hidden="true">
                  {account.nickname.slice(0, 1)}
                </span>
              )}
              <div className={styles.avatarActions}>
                <PhotoEditor triggerClassName={styles.primaryButton} currentUrl={account.thumbUrl} nickname={account.nickname} />
                <p className={styles.hint}>JPG, PNG 형식의 이미지만 업로드 가능합니다 (최대 5MB)</p>
              </div>
            </div>
          </Row>

          <div className={styles.row}>
            <div className={styles.pair}>
              <Label text="닉네임" />
              <span className={styles.value}>{account.nickname}</span>
              <NicknameEditor triggerClassName={styles.actionButton} />
            </div>
            <div className={styles.pair}>
              <Label text="아이디" />
              <span className={styles.value}>@{account.loginId}</span>
              {account.hasPassword && <PasswordEditor triggerClassName={styles.actionButton} />}
            </div>
          </div>

          <Row label="가입 방법">
            <span className={styles.value}>{account.provider ? `${PROVIDER_LABEL[account.provider]} 간편 가입` : "아이디 가입"}</span>
          </Row>

          <Row label="본인인증 여부">
            <div className={styles.valueGroup}>
              {account.verified ? (
                <span className={styles.verified}>본인인증 완료</span>
              ) : (
                <>
                  <span className={styles.unverified}>본인인증 미완료</span>
                  <span className={styles.note}>(본인인증은 FLEXTV에서 진행돼요. 마치면 이 페이지를 새로고침해 주세요.)</span>
                </>
              )}
            </div>
            {!account.verified && (
              <a href={`${FLEXTV_WEB_URL}/my/personal-auth`} target="_blank" rel="noopener noreferrer" className={`${styles.actionButton} ${styles.actionPrimary}`}>
                본인인증 하기
              </a>
            )}
          </Row>

          <Row label="보유 FN">
            <span className={styles.value}>{formatNumber(account.balance)} FN</span>
            <Link href="/wallet/charges" className={styles.actionButton}>
              FN 내역
            </Link>
            <ChargeTrigger className={styles.actionButton} />
          </Row>

          <Row label="크리에이터">
            <Link href={creator ? "/creator" : "/channel/new"} className={styles.actionButton}>
              {creator ? "크리에이터 스튜디오로" : "내 채널 만들기"}
            </Link>
          </Row>
        </div>
      </section>

      <div className={styles.footerActions}>
        <a href={`${FLEXTV_WEB_URL}/my/expire`} target="_blank" rel="noopener noreferrer" className={styles.withdrawButton}>
          회원 탈퇴 (FLEXTV)
        </a>
      </div>
    </div>
  );
}
