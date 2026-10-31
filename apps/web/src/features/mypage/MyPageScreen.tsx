import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PlayOutlineIcon, VideoIcon, YoutubeLogoIcon } from "@/components/icons";
import { ChargeTrigger } from "@/features/walletCharge";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import type { LoginProvider, MyAccount } from "@/services/account/myAccount";
import { GRADE_MONTHS, gradeLabel, type SupporterIdentity } from "@/services/supporter/identityTypes";
import type { Platform } from "@/types/platform";
import { SsumnationIdEditor, NicknameEditor, PasswordEditor, PhotoEditor } from "./editors";
import { IdentityVerification, PlatformConnect, PlatformDisconnect, ProviderLinkEditor } from "./linking";
import { MarketingConsentSetting, RankingVisibilitySettings } from "./SettingToggles";
import styles from "./mypage.module.css";

// Profile changes live in ./editors; provider, identity and platform links in ./linking; 회원 탈퇴 in ./WithdrawScreen.

const PROVIDERS: { key: LoginProvider; label: MessageKey; logo: ReactNode }[] = [
  { key: "NAVER", label: "myLink.naver", logo: <span className={styles.providerLetter}>N</span> },
  { key: "GOOGLE", label: "myLink.google", logo: <Image src="/images/social/google-round.png" alt="" width={28} height={28} className={styles.providerLogo} /> },
  { key: "KAKAO", label: "myLink.kakao", logo: <Image src="/images/social/kakao-round.png" alt="" width={28} height={28} className={styles.providerLogo} /> }
];

/** `labelKey`: a name that differs by language (치지직 · CHZZK); the others are written the same everywhere. */
const PLATFORMS: Record<Platform, { label: string; labelKey?: MessageKey; icon: ReactNode }> = {
  YOUTUBE: { label: "YouTube", icon: <YoutubeLogoIcon /> },
  FLEXTV: { label: "FLEX TV", icon: <PlayOutlineIcon /> },
  SOOP: { label: "SOOP", icon: <VideoIcon /> },
  CHZZK: { label: "치지직", labelKey: "my.chzzk", icon: <VideoIcon /> }
};

/**
 * My page.
 * Figma: ssumnation-my-page 735:4119 (622:4 is the same screen with Naver linked)
 */
export async function MyPageScreen({ account, grade, creator }: { account: MyAccount; grade: SupporterIdentity["grade"] | null; creator: boolean }) {
  const t = await getT();
  const platformLabel = (platform: Platform) => {
    const p = PLATFORMS[platform];
    return p.labelKey ? t(p.labelKey) : p.label;
  };
  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("my.title")}</h1>
        <p className={styles.subtitle}>{t("my.subtitle")}</p>
      </header>

      {/* Code-first (funnation 내 프로필): grade card with the next grade and the studio entry. */}
      {grade && (
        <section className={styles.gradeCard} aria-labelledby="mypage-grade">
          <div className={styles.gradeMain}>
            <span className={styles.gradeLabel} id="mypage-grade">
              {t("my.grade")}
            </span>
            <strong className={styles.gradeName}>{gradeLabel(grade.key)}</strong>
            <span className={styles.gradeMeta}>
              {t("my.gradeRecent", { months: GRADE_MONTHS, fn: formatNumber(grade.recentFn) })}
              {grade.kept ? t("my.gradeKept") : ""}
            </span>
          </div>
          <div className={styles.gradeProgress}>
            {grade.progress.nextLabel ? (
              <>
                <span className={styles.gradeMeta}>
                  {t("my.gradeNextBefore")}
                  <strong>{grade.progress.nextLabel}</strong>
                  {t("my.gradeNextAfter", { fn: formatNumber(Math.max(0, (grade.progress.nextMinFn ?? 0) - grade.progress.currentFn)) })}
                </span>
                <span className={styles.gradeBar} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={grade.progress.percent} aria-label={t("my.gradeProgress")}>
                  <span style={{ width: `${grade.progress.percent}%` }} />
                </span>
              </>
            ) : (
              <span className={styles.gradeMeta}>{t("my.gradeTop")}</span>
            )}
          </div>
          <div className={styles.gradeActions}>
            <Link href="/mypage/titles" className={styles.actionButton}>
              {t("my.gradePreview")}
            </Link>
            <Link href={creator ? "/creator" : "/channel/new"} className={styles.actionButton}>
              {creator ? t("my.toStudio") : t("my.createChannel")}
            </Link>
          </div>
        </section>
      )}

      <section className={styles.section} aria-labelledby="mypage-account">
        <h2 id="mypage-account" className={styles.sectionTitle}>
          👤 {t("my.basicInfo")}
        </h2>
        <div className={styles.accountCard}>
          <Row label={t("my.photo")}>
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
                <p className={styles.hint}>{t("my.photoHint")}</p>
              </div>
            </div>
          </Row>

          <div className={styles.row}>
            <div className={styles.pair}>
              <Label text={t("my.nickname")} info />
              <span className={styles.value}>{account.nickname}</span>
              <NicknameEditor triggerClassName={styles.actionButton} />
            </div>
            <div className={styles.pair}>
              <Label text={t("my.ssumnationId")} info />
              <span className={styles.value}>@{account.ssumnationId}</span>
              <SsumnationIdEditor triggerClassName={styles.actionButton} />
              <PasswordEditor triggerClassName={styles.actionButton} />
            </div>
          </div>

          <Row label={t("my.loginProviders")}>
            <ul className={styles.providers}>
              {PROVIDERS.map((p) => {
                const linked = account.linkedLoginProviders[p.key];
                return (
                  <li key={p.key} className={styles.provider}>
                    {p.logo}
                    <span className={styles.providerName}>{t(p.label)}</span>
                    <span className={styles.statusBadge}>{linked ? t("my.linked") : t("my.notLinked")}</span>
                    <ProviderLinkEditor provider={p.key} link={linked} triggerClassName={styles.smallButton} />
                  </li>
                );
              })}
            </ul>
          </Row>

          <Row label={t("my.identity")}>
            <div className={styles.valueGroup}>
              {account.identity ? (
                <span className={styles.verified}>{t("my.verified")}</span>
              ) : (
                <>
                  <span className={styles.unverified}>{t("my.unverified")}</span>
                  <span className={styles.note}>{t("my.unverifiedNote")}</span>
                </>
              )}
            </div>
            {!account.identity && <IdentityVerification triggerClassName={`${styles.actionButton} ${styles.actionPrimary}`} />}
          </Row>

          <Row label={t("my.fnBalance")}>
            <span className={styles.value}>{formatNumber(account.fnBalance)} FN</span>
            <Link href="/wallet/charges" className={styles.actionButton}>
              {t("my.fnHistory")}
            </Link>
            <ChargeTrigger className={styles.actionButton} />
          </Row>
        </div>
      </section>

      {/* Code-first (no Figma frame): supporter identity entry points. */}
      <section className={styles.section} aria-labelledby="mypage-identity">
        <h2 id="mypage-identity" className={styles.sectionTitle}>
          🎖️ {t("my.supporterProfile")}
        </h2>
        <div className={styles.identityLinks}>
          <Link href="/mypage/titles" className={styles.identityLink}>
            <strong>{t("my.titles")}</strong>
            <span>{t("my.titlesDesc")}</span>
          </Link>
          <Link href="/mypage/nicknames" className={styles.identityLink}>
            <strong>{t("my.nicknames")}</strong>
            <span>{t("my.nicknamesDesc")}</span>
          </Link>
          <Link href="/mypage/ranking" className={styles.identityLink}>
            <strong>{t("my.ranking")}</strong>
            <span>{t("my.rankingDesc")}</span>
          </Link>
          <Link href="/mypage/blocks" className={styles.identityLink}>
            <strong>{t("my.blocks")}</strong>
            <span>{t("my.blocksDesc")}</span>
          </Link>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="mypage-ranking">
        <h2 id="mypage-ranking" className={styles.sectionTitle}>
          🏆 {t("my.rankingVisibility")}
        </h2>
        <RankingVisibilitySettings initial={account.rankingVisibility} />
      </section>

      <section className={styles.section} aria-labelledby="mypage-platforms">
        <div className={styles.sectionHeader}>
          <h2 id="mypage-platforms" className={styles.sectionTitle}>
            🔗 {t("my.platforms")}
          </h2>
          <p className={styles.sectionNote}>{t("my.platformsNote")}</p>
        </div>
        <ul className={styles.platforms}>
          {account.connectedPlatforms.map(({ platform, handle }) => (
            <li key={platform} className={styles.platformCard}>
              <div className={styles.platformInfo}>
                <span className={styles.platformLogo}>{PLATFORMS[platform].icon}</span>
                <span className={styles.platformMeta}>
                  <strong>{platformLabel(platform)}</strong>
                  {handle && <span>{handle}</span>}
                </span>
              </div>
              {handle ? (
                <PlatformDisconnect platform={platform} label={platformLabel(platform)} handle={handle} triggerClassName={styles.disconnectButton} />
              ) : (
                <PlatformConnect platform={platform} label={platformLabel(platform)} triggerClassName={styles.connectButton} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-label={t("my.marketing")}>
        <MarketingConsentSetting initial={account.marketingConsent} />
      </section>

      <div className={styles.footerActions}>
        <Link href="/mypage/withdraw" className={styles.withdrawButton}>
          {t("my.withdraw")}
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
