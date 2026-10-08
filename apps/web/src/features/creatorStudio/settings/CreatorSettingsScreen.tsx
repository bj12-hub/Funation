import type { CreatorSettings } from "@/services/creator/creatorSettingsTypes";
import { ProfileEditModal } from "./ProfileEditModal";
import { SetupGuides } from "./SetupGuides";
import { CopyButton, SsumnationSettingsCard, IntegrationKey, MainPlatformCard, SnsCard } from "./SettingsCards";
import styles from "./settings.module.css";

const dotted = (iso: string) => iso.replaceAll("-", ".");

/** Figma 315:405 · 315:2 계정설정 (route `/creator/settings`). */
export function CreatorSettingsScreen({ settings }: { settings: CreatorSettings }) {
  const avatar = settings.images[0];
  return (
    <div className={styles.content}>
      <h1 className={styles.srOnly}>계정설정</h1>

      <section className={styles.section} aria-labelledby="set-basic">
        <h2 id="set-basic" className={styles.sectionTitle}>
          기본 설정
        </h2>
        <div className={styles.rowTop}>
          <section className={`${styles.card} ${styles.profileCard}`} aria-labelledby="set-profile">
            <div className={styles.cardHead}>
              <h3 id="set-profile" className={styles.cardTitle}>
                프로필 수정
              </h3>
              <ProfileEditModal settings={settings} />
            </div>
            <div className={styles.profileBody}>
              <span className={styles.avatarWrap}>
                {avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element -- data URL / arbitrary-host upload
                  <img src={avatar} alt="" className={styles.avatar} />
                ) : (
                  <span className={styles.avatar} aria-hidden="true" />
                )}
                <span className={styles.editBadge} aria-hidden="true">
                  ✏
                </span>
              </span>
              <dl className={styles.readonly}>
                <div>
                  <dt>닉네임</dt>
                  <dd>{settings.channelName}</dd>
                </div>
                <div>
                  <dt>썸네이션 ID</dt>
                  <dd>@{settings.ssumnationId}</dd>
                </div>
                <div>
                  <dt>방송 데뷔일</dt>
                  <dd>{dotted(settings.debutDate)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <SsumnationSettingsCard live={settings.liveProfileVisible} marketing={settings.marketingConsent} languages={settings.languages} />

          <section className={`${styles.card} ${styles.donateCard}`} aria-labelledby="set-donate">
            <h3 id="set-donate" className={styles.cardTitle}>
              썸네이션 후원 세팅
            </h3>
            <p className={styles.urlLabel}>[{settings.channelName}]의 썸네이션 URL</p>
            <div className={styles.fieldRow}>
              <span className={`${styles.input} ${styles.urlText}`}>{settings.donateUrl}</span>
              <span className={styles.urlButtons}>
                <CopyButton value={settings.donateUrl} label="URL 복사" className={styles.blueMini} />
                <a href={settings.donateUrl} target="_blank" rel="noopener noreferrer" className={styles.purpleMini}>
                  열기
                </a>
              </span>
            </div>
            <SetupGuides channelName={settings.channelName} widgetUrl={settings.alertWidgetUrl} />
          </section>
        </div>

        <div className={styles.rowBottom}>
          <MainPlatformCard initial={settings.mainPlatform} />
          <SnsCard initial={settings.sns} />
        </div>
      </section>

      <section className={styles.section} aria-labelledby="set-channel">
        <h2 id="set-channel" className={styles.sectionTitle}>
          채널 관리
        </h2>
        <div className={`${styles.card} ${styles.channelCard}`}>
          <div className={styles.channelItem}>
            <h3 className={styles.cardTitle}>후원 페이지 링크 설정</h3>
            <p className={styles.help}>시청자들이 후원할 수 있는 고유 링크입니다.</p>
            <div className={styles.fieldRow}>
              <span className={styles.input}>{settings.donateUrl}</span>
              <CopyButton value={settings.donateUrl} />
              <a href={settings.donateUrl} target="_blank" rel="noopener noreferrer" className={styles.primaryButton}>
                열기
              </a>
            </div>
          </div>
          <div className={styles.channelItem}>
            <h3 className={styles.cardTitle}>송출 채널 주소 확인</h3>
            <p className={styles.help}>방송 소프트웨어에서 사용하는 서버 주소입니다.</p>
            <div className={styles.fieldRow}>
              <span className={styles.input}>{settings.rtmpUrl}</span>
              <CopyButton value={settings.rtmpUrl} />
            </div>
          </div>
          <div className={styles.channelItem}>
            <h3 className={styles.cardTitle}>연동키 발급</h3>
            <p className={styles.help}>외부 서비스와 연동하기 위한 고유 키입니다.</p>
            <IntegrationKey masked={settings.integrationKeyMasked} />
          </div>
        </div>
      </section>
    </div>
  );
}
