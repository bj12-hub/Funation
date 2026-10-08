import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PlayOutlineIcon, VideoIcon, YoutubeLogoIcon } from "@/components/icons";
import { ChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import type { LoginProvider, MyAccount } from "@/services/account/myAccount";
import { gradeLabel, type SupporterIdentity } from "@/services/supporter/identityTypes";
import type { Platform } from "@/types/platform";
import { FunationIdEditor, NicknameEditor, PasswordEditor, PhotoEditor } from "./editors";
import { IdentityVerification, PlatformConnect, PlatformDisconnect, ProviderLinkEditor } from "./linking";
import { MarketingConsentSetting, RankingVisibilitySettings } from "./SettingToggles";
import styles from "./mypage.module.css";

// Profile changes live in ./editors; provider, identity and platform links in ./linking; 회원 탈퇴 in ./WithdrawScreen.

const PROVIDERS: { key: LoginProvider; label: string; logo: ReactNode }[] = [
  { key: "NAVER", label: "네이버", logo: <span className={styles.providerLetter}>N</span> },
  { key: "GOOGLE", label: "Google", logo: <Image src="/images/social/google-round.png" alt="" width={28} height={28} className={styles.providerLogo} /> },
  { key: "KAKAO", label: "카카오", logo: <Image src="/images/social/kakao-round.png" alt="" width={28} height={28} className={styles.providerLogo} /> }
];

const PLATFORMS: Record<Platform, { label: string; icon: ReactNode }> = {
  YOUTUBE: { label: "YouTube", icon: <YoutubeLogoIcon /> },
  FLEXTV: { label: "FLEX TV", icon: <PlayOutlineIcon /> },
  SOOP: { label: "SOOP", icon: <VideoIcon /> },
  CHZZK: { label: "치지직", icon: <VideoIcon /> }
};

/**
 * My page.
 * Figma: funation-my-page 735:4119 (622:4 is the same screen with Naver linked)
 */
export function MyPageScreen({ account, grade, creator }: { account: MyAccount; grade: SupporterIdentity["grade"] | null; creator: boolean }) {
  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>내 정보</h1>
        <p className={styles.subtitle}>안녕하세요, 나의 회원 정보와 후원 등급을 한 눈에 파악하고 관리하세요.</p>
      </header>

      {/* Code-first (funnation 내 프로필): grade card with the next grade and the studio entry. */}
      {grade && (
        <section className={styles.gradeCard} aria-labelledby="mypage-grade">
          <div className={styles.gradeMain}>
            <span className={styles.gradeLabel} id="mypage-grade">
              내 등급
            </span>
            <strong className={styles.gradeName}>{gradeLabel(grade.key)}</strong>
            <span className={styles.gradeMeta}>최근 30일 후원 {formatNumber(grade.last30Fn)} FN</span>
          </div>
          <div className={styles.gradeProgress}>
            {grade.progress.nextLabel ? (
              <>
                <span className={styles.gradeMeta}>
                  다음 등급 <strong>{grade.progress.nextLabel}</strong>까지 {formatNumber(Math.max(0, (grade.progress.nextMinFn ?? 0) - grade.progress.currentFn))} FN
                </span>
                <span className={styles.gradeBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={grade.progress.percent} aria-label="다음 등급 진행률">
                  <span style={{ width: `${grade.progress.percent}%` }} />
                </span>
              </>
            ) : (
              <span className={styles.gradeMeta}>최고 등급이에요.</span>
            )}
          </div>
          <div className={styles.gradeActions}>
            <Link href="/mypage/titles" className={styles.actionButton}>
              다음 등급 미리보기
            </Link>
            <Link href={creator ? "/creator" : "/channel/new"} className={styles.actionButton}>
              {creator ? "크리에이터 스튜디오로" : "내 채널 만들기"}
            </Link>
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="mypage-account">
        <h2 id="mypage-account" className={styles.sectionTitle}>
          👤 기본 정보
        </h2>
        <div className={styles.accountCard}>
          <Row label="프로필 사진">
            <div className={styles.avatarRow}>
              {account.avatarUrl ? (
                <Image
                  src={account.avatarUrl}
                  alt=""
                  width={80}
                  height={80}
                  className={styles.avatar}
                  // Mock uploads are data URLs, which the image optimizer does not handle.
                  unoptimized={account.avatarUrl.startsWith("data:")}
                />
              ) : (
                <span className={`${styles.avatar} ${styles.avatarFallback}`} aria-hidden="true">
                  {account.nickname.slice(0, 1)}
                </span>
              )}
              <div className={styles.avatarActions}>
                <PhotoEditor triggerClassName={styles.primaryButton} currentUrl={account.avatarUrl} nickname={account.nickname} />
                <p className={styles.hint}>JPG, PNG 형식의 이미지만 업로드 가능합니다 (최대 5MB)</p>
              </div>
            </div>
          </Row>

          <div className={styles.row}>
            <div className={styles.pair}>
              <Label text="닉네임" info />
              <span className={styles.value}>{account.nickname}</span>
              <NicknameEditor triggerClassName={styles.actionButton} />
            </div>
            <div className={styles.pair}>
              <Label text="썸네이션 ID" info />
              <span className={styles.value}>@{account.funationId}</span>
              <FunationIdEditor triggerClassName={styles.actionButton} />
              <PasswordEditor triggerClassName={styles.actionButton} />
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
                    <ProviderLinkEditor provider={p.key} link={linked} triggerClassName={styles.smallButton} />
                  </li>
                );
              })}
            </ul>
          </Row>

          <Row label="본인인증 여부">
            <div className={styles.valueGroup}>
              {account.identity ? (
                <span className={styles.verified}>본인인증 완료</span>
              ) : (
                <>
                  <span className={styles.unverified}>본인인증 미완료</span>
                  <span className={styles.note}>(본인인증 후 서비스 이용이 원활합니다)</span>
                </>
              )}
            </div>
            {!account.identity && <IdentityVerification triggerClassName={`${styles.actionButton} ${styles.actionPrimary}`} />}
          </Row>

          <Row label="보유 FN">
            <span className={styles.value}>{formatNumber(account.fnBalance)} FN</span>
            <Link href="/wallet/charges" className={styles.actionButton}>
              FN 내역
            </Link>
            <ChargeTrigger className={styles.actionButton} />
          </Row>
        </div>
      </section>

      {/* Code-first (no Figma frame): supporter identity entry points. */}
      <section className={styles.section} aria-labelledby="mypage-identity">
        <h2 id="mypage-identity" className={styles.sectionTitle}>
          🎖️ 후원자 프로필
        </h2>
        <div className={styles.identityLinks}>
          <Link href="/mypage/titles" className={styles.identityLink}>
            <strong>칭호·등급</strong>
            <span>등급, 글로벌·크리에이터 칭호와 후원 알림 표시</span>
          </Link>
          <Link href="/mypage/nicknames" className={styles.identityLink}>
            <strong>별명 관리</strong>
            <span>후원할 때 쓰는 별명과 별명별 누적 후원</span>
          </Link>
          <Link href="/mypage/ranking" className={styles.identityLink}>
            <strong>내 랭킹</strong>
            <span>전체·크리에이터별 내 후원 순위</span>
          </Link>
          <Link href="/mypage/blocks" className={styles.identityLink}>
            <strong>차단 관리</strong>
            <span>차단한 사용자와 차단 해제</span>
          </Link>
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
                <PlatformDisconnect platform={platform} label={PLATFORMS[platform].label} handle={handle} triggerClassName={styles.disconnectButton} />
              ) : (
                <PlatformConnect platform={platform} label={PLATFORMS[platform].label} triggerClassName={styles.connectButton} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="마케팅 수신 동의">
        <MarketingConsentSetting initial={account.marketingConsent} />
      </section>

      <div className={styles.footerActions}>
        <Link href="/mypage/withdraw" className={styles.withdrawButton}>
          회원 탈퇴
        </Link>
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
