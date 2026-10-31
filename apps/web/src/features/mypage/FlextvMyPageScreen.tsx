import Link from "next/link";
import { ChargeTrigger } from "@/features/walletCharge";
import type { FlextvMyAccount, FlextvSignUpProvider } from "@/lib/flextv/member";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { formatNumber } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { NicknameEditor, PasswordEditor, PhotoEditor } from "./editors";
import { Label, Row } from "./MyPageScreen";
import styles from "./mypage.module.css";

const PROVIDER_LABEL: Record<FlextvSignUpProvider, MessageKey> = {
  kakao: "myLink.kakao",
  naver: "myLink.naver",
  google: "myLink.google",
  twitch: "flextvMyPage.providerTwitch",
  other: "flextvMyPage.providerOther"
};

/**
 * 내 정보 with FLEXTV (phase 7, docs/development/flextv-backend.md "7단계") — the 기본 정보 card of Figma 735:4119 with
 * what FLEXTV keeps: 사진 · 닉네임 · 비밀번호 change here; the 아이디 stays; 본인인증 and 회원 탈퇴 open FLEXTV's site.
 * Ssumnation's own sections (활동 등급, 후원자 프로필, 랭킹 노출, 연결 플랫폼, 마케팅 수신) have no FLEXTV backend yet.
 */
export async function FlextvMyPageScreen({ account, creator }: { account: FlextvMyAccount; creator: boolean }) {
  const t = await getT();
  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("my.title")}</h1>
        <p className={styles.subtitle}>{t("flextvMyPage.subtitle")}</p>
      </header>

      <section className={styles.section} aria-labelledby="mypage-account">
        <h2 id="mypage-account" className={styles.sectionTitle}>
          👤 {t("my.basicInfo")}
        </h2>
        <div className={styles.accountCard}>
          <Row label={t("my.photo")}>
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
                <p className={styles.hint}>{t("my.photoHint")}</p>
              </div>
            </div>
          </Row>

          <div className={styles.row}>
            <div className={styles.pair}>
              <Label text={t("my.nickname")} />
              <span className={styles.value}>{account.nickname}</span>
              <NicknameEditor triggerClassName={styles.actionButton} />
            </div>
            <div className={styles.pair}>
              <Label text={t("flextvMyPage.loginId")} />
              <span className={styles.value}>@{account.loginId}</span>
              {account.hasPassword && <PasswordEditor triggerClassName={styles.actionButton} />}
            </div>
          </div>

          <Row label={t("flextvMyPage.signUp")}>
            <span className={styles.value}>
              {account.provider ? t("flextvMyPage.signUpProvider", { provider: t(PROVIDER_LABEL[account.provider]) }) : t("flextvMyPage.signUpId")}
            </span>
          </Row>

          <Row label={t("my.identity")}>
            <div className={styles.valueGroup}>
              {account.verified ? (
                <span className={styles.verified}>{t("my.verified")}</span>
              ) : (
                <>
                  <span className={styles.unverified}>{t("my.unverified")}</span>
                  <span className={styles.note}>{t("flextvMyPage.unverifiedNote")}</span>
                </>
              )}
            </div>
            {!account.verified && (
              <a href={`${FLEXTV_WEB_URL}/my/personal-auth`} target="_blank" rel="noopener noreferrer" className={`${styles.actionButton} ${styles.actionPrimary}`}>
                {t("flextvMyPage.verify")}
              </a>
            )}
          </Row>

          <Row label={t("my.fnBalance")}>
            <span className={styles.value}>{formatNumber(account.balance)} FN</span>
            <Link href="/wallet/charges" className={styles.actionButton}>
              {t("my.fnHistory")}
            </Link>
            <ChargeTrigger className={styles.actionButton} />
          </Row>

          <Row label={t("messages.title")}>
            <Link href="/messages" className={styles.actionButton}>
              {t("flextvMyPage.messageBox")}
            </Link>
            <Link href="/mypage/blocks" className={styles.actionButton}>
              {t("my.blocks")}
            </Link>
          </Row>

          <Row label={t("flextvMyPage.creator")}>
            <Link href={creator ? "/creator" : "/channel/new"} className={styles.actionButton}>
              {creator ? t("my.toStudio") : t("my.createChannel")}
            </Link>
          </Row>
        </div>
      </section>

      <div className={styles.footerActions}>
        <a href={`${FLEXTV_WEB_URL}/my/expire`} target="_blank" rel="noopener noreferrer" className={styles.withdrawButton}>
          {t("flextvMyPage.withdraw")}
        </a>
      </div>
    </div>
  );
}
