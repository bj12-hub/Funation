import Image from "next/image";
import type { ReactNode } from "react";
import { PlayOutlineIcon, PlusSmallIcon, VideoIcon, YoutubeLogoIcon } from "@/components/icons";
import { formatNumber } from "@/lib/format";
import type { LoginProvider, MyAccount } from "@/services/account/myAccount";
import type { Platform } from "@/types/platform";
import { MarketingConsentSetting, RankingVisibilitySettings } from "./SettingToggles";
import styles from "./mypage.module.css";

// Flows behind these buttons (photo upload, nickname/ID/password change, provider linking,
// identity verification, FN history/charge, platform connect/disconnect, withdrawal) are not
// designed or connected yet; they render as unavailable.
const UNAVAILABLE = { "aria-disabled": true, title: "준비 중인 기능입니다" } as const;

const PROVIDERS: { key: LoginProvider; label: string; logo: ReactNode }[] = [
  { key: "NAVER", label: "네이버", logo: <span className={styles.providerLetter}>N</span> },
  { key: "GOOGLE", label: "Google", logo: <Image src="/images/social/google-round.png" alt="" width={28} height={28} className={styles.providerLogo} /> },
  { key: "KAKAO", label: "카카오", logo: <Image src="/images/social/kakao-round.png" alt="" width={28} height={28} className={styles.providerLogo} /> }
];

const PLATFORMS: Record<Platform, { label: string; icon: ReactNode }> = {
  YOUTUBE: { label: "YouTube", icon: <YoutubeLogoIcon /> },
  FLEXTV: { label: "FLEX TV", icon: <PlayOutlineIcon /> },
  SOOP: { label: "SOOP", icon: <VideoIcon /> }
};

/**
 * My page.
 * Figma: funation-my-page 735:4119 (622:4 is the same screen with Naver linked)
 */
export function MyPageScreen({ account }: { account: MyAccount }) {
  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>마이페이지</h1>
        <p className={styles.subtitle}>안녕하세요, 마이페이지에서 나의 회원 정보를 한 눈에 파악하고 관리하세요.</p>
      </header>

      <section className={styles.section} aria-labelledby="mypage-account">
        <h2 id="mypage-account" className={styles.sectionTitle}>
          👤 기본 정보
        </h2>
        <div className={styles.accountCard}>
          <Row label="프로필 사진">
            <div className={styles.avatarRow}>
              {account.avatarUrl ? (
                <Image src={account.avatarUrl} alt="" width={80} height={80} className={styles.avatar} />
              ) : (
                <span className={`${styles.avatar} ${styles.avatarFallback}`} aria-hidden="true">
                  {account.nickname.slice(0, 1)}
                </span>
              )}
              <div className={styles.avatarActions}>
                <button type="button" className={styles.primaryButton} {...UNAVAILABLE}>
                  사진 변경
                </button>
                <p className={styles.hint}>JPG, PNG 형식의 이미지만 업로드 가능합니다 (최대 5MB)</p>
              </div>
            </div>
          </Row>

          <div className={styles.row}>
            <div className={styles.pair}>
              <Label text="닉네임" info />
              <span className={styles.value}>{account.nickname}</span>
              <button type="button" className={styles.actionButton} {...UNAVAILABLE}>
                수정
              </button>
            </div>
            <div className={styles.pair}>
              <Label text="Funation ID" info />
              <span className={styles.value}>@{account.funationId}</span>
              <button type="button" className={styles.actionButton} {...UNAVAILABLE}>
                수정
              </button>
              <button type="button" className={styles.actionButton} {...UNAVAILABLE}>
                비밀번호 변경
              </button>
            </div>
          </div>

          <Row label="로그인 연동 플랫폼">
            <ul className={styles.providers}>
              {PROVIDERS.map((p) => {
                const linked = account.linkedLoginProviders[p.key];
                return (
                  <li key={p.key} className={styles.provider}>
                    {p.logo}
                    <span className={styles.providerName}>{p.label}</span>
                    <span className={styles.statusBadge}>{linked ? "연결됨" : "미연결"}</span>
                    <button type="button" className={styles.smallButton} {...UNAVAILABLE}>
                      {linked ? "관리" : "연결하기"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </Row>

          <Row label="본인인증 여부">
            <div className={styles.valueGroup}>
              {account.identityVerified ? (
                <span className={styles.verified}>본인인증 완료</span>
              ) : (
                <>
                  <span className={styles.unverified}>본인인증 미완료</span>
                  <span className={styles.note}>(본인인증 후 서비스 이용이 원활합니다)</span>
                </>
              )}
            </div>
            {!account.identityVerified && (
              <button type="button" className={`${styles.actionButton} ${styles.actionPrimary}`} {...UNAVAILABLE}>
                인증하기
              </button>
            )}
          </Row>

          <Row label="보유 FN">
            <span className={styles.value}>{formatNumber(account.fnBalance)} FN</span>
            <button type="button" className={styles.actionButton} {...UNAVAILABLE}>
              FN 내역
            </button>
            <button type="button" className={styles.actionButton} {...UNAVAILABLE}>
              FN 충전
            </button>
          </Row>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="mypage-ranking">
        <h2 id="mypage-ranking" className={styles.sectionTitle}>
          🏆 내 랭킹 노출 설정
        </h2>
        <RankingVisibilitySettings initial={account.rankingVisibility} />
      </section>

      <section className={styles.section} aria-labelledby="mypage-platforms">
        <div className={styles.sectionHeader}>
          <h2 id="mypage-platforms" className={styles.sectionTitle}>
            🔗 연결 플랫폼 관리
          </h2>
          <p className={styles.sectionNote}>방송 플랫폼 계정을 연동해 특별 리워드를 획득하세요.</p>
        </div>
        <ul className={styles.platforms}>
          {account.connectedPlatforms.map(({ platform, handle }) => (
            <li key={platform} className={styles.platformCard}>
              <div className={styles.platformInfo}>
                <span className={styles.platformLogo}>{PLATFORMS[platform].icon}</span>
                <span className={styles.platformMeta}>
                  <strong>{PLATFORMS[platform].label}</strong>
                  {handle && <span>{handle}</span>}
                </span>
              </div>
              {handle ? (
                <button type="button" className={styles.disconnectButton} {...UNAVAILABLE}>
                  연결 해제
                </button>
              ) : (
                <button type="button" className={styles.connectButton} {...UNAVAILABLE}>
                  <PlusSmallIcon />
                  연결 추가
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="마케팅 수신 동의">
        <MarketingConsentSetting initial={account.marketingConsent} />
      </section>

      <div className={styles.footerActions}>
        <button type="button" className={styles.withdrawButton} {...UNAVAILABLE}>
          회원 탈퇴
        </button>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.row}>
      <Label text={label} />
      {children}
    </div>
  );
}

/** `info` shows the Figma "i" marker; its help text is not defined yet (TBD). */
function Label({ text, info = false }: { text: string; info?: boolean }) {
  return (
    <span className={styles.label}>
      {text}
      {info && (
        <span className={styles.info} aria-hidden="true">
          i
        </span>
      )}
    </span>
  );
}
