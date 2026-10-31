import { getT } from "@/lib/i18n/server";
import type { CreatorSettings } from "@/services/creator/creatorSettingsTypes";
import { ProfileEditModal } from "./ProfileEditModal";
import { SetupGuides } from "./SetupGuides";
import { CopyButton, SsumnationSettingsCard, IntegrationKey, MainPlatformCard, SnsCard } from "./SettingsCards";
import styles from "./settings.module.css";

const dotted = (iso: string) => iso.replaceAll("-", ".");

/** Figma 315:405 · 315:2 계정설정 (route `/creator/settings`). */
export async function CreatorSettingsScreen({ settings }: { settings: CreatorSettings }) {
  const avatar = settings.images[0];
  const t = await getT();
  return (
    <div className={styles.content}>
      <h1 className={styles.srOnly}>{t("studioSettings.title")}</h1>

      <section className={styles.section} aria-labelledby="set-basic">
        <h2 id="set-basic" className={styles.sectionTitle}>
          {t("studioSettings.basic")}
        </h2>
        <div className={styles.rowTop}>
          <section className={`${styles.card} ${styles.profileCard}`} aria-labelledby="set-profile">
            <div className={styles.cardHead}>
              <h3 id="set-profile" className={styles.cardTitle}>
                {t("studioSettings.profile")}
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
                  <dt>{t("studioSettings.nickname")}</dt>
                  <dd>{settings.channelName}</dd>
                </div>
                <div>
                  <dt>{t("studioSettings.ssumId")}</dt>
                  <dd>@{settings.ssumnationId}</dd>
                </div>
                <div>
                  <dt>{t("studioSettings.debut")}</dt>
                  <dd>{dotted(settings.debutDate)}</dd>
                </div>
              </dl>
            </div>
          </section>

          <SsumnationSettingsCard live={settings.liveProfileVisible} marketing={settings.marketingConsent} languages={settings.languages} />

          <section className={`${styles.card} ${styles.donateCard}`} aria-labelledby="set-donate">
            <h3 id="set-donate" className={styles.cardTitle}>
              {t("studioSettings.donateSetup")}
            </h3>
            <p className={styles.urlLabel}>{t("studioSettings.donateUrlLabel", { name: settings.channelName })}</p>
            <div className={styles.fieldRow}>
              <span className={`${styles.input} ${styles.urlText}`}>{settings.donateUrl}</span>
              <span className={styles.urlButtons}>
                <CopyButton value={settings.donateUrl} label={t("studioSettings.copyUrl")} className={styles.blueMini} />
                <a href={settings.donateUrl} target="_blank" rel="noopener noreferrer" className={styles.purpleMini}>
                  {t("studioSettings.open")}
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
          {t("studioSettings.channel")}
        </h2>
        <div className={`${styles.card} ${styles.channelCard}`}>
          <div className={styles.channelItem}>
            <h3 className={styles.cardTitle}>{t("studioSettings.donateLink")}</h3>
            <p className={styles.help}>{t("studioSettings.donateLinkHelp")}</p>
            <div className={styles.fieldRow}>
              <span className={styles.input}>{settings.donateUrl}</span>
              <CopyButton value={settings.donateUrl} />
              <a href={settings.donateUrl} target="_blank" rel="noopener noreferrer" className={styles.primaryButton}>
                {t("studioSettings.open")}
              </a>
            </div>
          </div>
          <div className={styles.channelItem}>
            <h3 className={styles.cardTitle}>{t("studioSettings.rtmp")}</h3>
            <p className={styles.help}>{t("studioSettings.rtmpHelp")}</p>
            <div className={styles.fieldRow}>
              <span className={styles.input}>{settings.rtmpUrl}</span>
              <CopyButton value={settings.rtmpUrl} />
            </div>
          </div>
          <div className={styles.channelItem}>
            <h3 className={styles.cardTitle}>{t("studioSettings.key")}</h3>
            <p className={styles.help}>{t("studioSettings.keyHelp")}</p>
            <IntegrationKey masked={settings.integrationKeyMasked} />
          </div>
        </div>
      </section>
    </div>
  );
}
