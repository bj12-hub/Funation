"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { saveEquipSettings } from "@/services/supporter/identity";
import {
  GLOBAL_TITLES,
  GRADES,
  GRADE_MONTHS,
  STORE_TITLES,
  TITLE_LINE_LABEL,
  globalTitleLabel,
  gradeLabel,
  hasGrade,
  storeTitleLabel,
  type TitleLine,
  type EquipSettings,
  type Progress,
  type SupporterIdentity
} from "@/services/supporter/identityTypes";
import styles from "./supporter.module.css";

/**
 * 칭호·등급 — code-first (no Figma frame). Route `/mypage/titles`. Grade, titles and progress are
 * server values; the preview only combines the labels the server returned with the chosen slots.
 * 활동 등급 (최근 6개월) · 누적 등급 (다이아 · 블랙) follow the 2026-10-08 structure; thresholds are placeholders (TBD).
 */
export function TitlesScreen({ identity }: { identity: SupporterIdentity }) {
  const { t } = useI18n();
  const router = useRouter();
  const [equip, setEquip] = useState<EquipSettings>(identity.equip);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(equip) !== JSON.stringify(identity.equip);
  const def = identity.nicknames.find((n) => n.isDefault)!;
  const topStore = identity.stores.find((s) => s.title);

  const globalShown = equip.globalTitle === "OFF" ? null : equip.globalTitle === "AUTO" ? identity.global.best : equip.globalTitle;
  const badges = [
    equip.showGrade && hasGrade(identity.grade.key) ? gradeLabel(identity.grade.key) : null,
    globalShown ? globalTitleLabel(globalShown) : null,
    equip.showStoreTitle && topStore?.title ? storeTitleLabel(topStore.title) : null
  ].filter(Boolean) as string[];

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await saveEquipSettings(equip);
        if (res.status === "SAVED") {
          setMessage({ tone: "ok", text: t("myTitles.saved") });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?next=/mypage/titles");
        else setMessage({ tone: "error", text: res.message });
      } catch {
        // The chosen settings stay selected, so 저장 can be pressed again.
        setMessage({ tone: "error", text: t("my.genericError") });
      }
    });
  };

  return (
    <div className={styles.content}>
      <nav className={styles.breadcrumb} aria-label={t("my.breadcrumb")}>
        <Link href="/mypage">{t("common.myPage")}</Link> <span aria-hidden="true">›</span> <span aria-current="page">{t("myTitles.title")}</span>
      </nav>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("myTitles.title")}</h1>
        <p className={styles.subtitle}>{t("myTitles.subtitle")}</p>
      </header>

      <section className={styles.card} aria-labelledby="st-preview">
        <div className={styles.cardHead}>
          <h2 id="st-preview" className={styles.cardTitle}>
            {t("myTitles.preview")}
          </h2>
          <span className={styles.segment} role="group" aria-label={t("myTitles.previewBg")}>
            {(["dark", "light"] as const).map((mode) => (
              <button key={mode} type="button" aria-pressed={theme === mode} onClick={() => setTheme(mode)}>
                {mode === "dark" ? t("myTitles.dark") : t("myTitles.light")}
              </button>
            ))}
          </span>
        </div>
        <div className={styles.preview} data-theme={theme}>
          <span className={styles.previewBadges}>
            {badges.map((b) => (
              <span key={b} className={styles.badge}>
                {b}
              </span>
            ))}
          </span>
          <strong>{t("myTitles.previewAlert", { name: def.name })}</strong>
          <span className={styles.previewMsg}>{t("myTitles.previewMessage")}</span>
        </div>
        {badges.length === 0 && <p className={styles.note}>{t("myTitles.noBadges")}</p>}
      </section>

      <section className={styles.card} aria-labelledby="st-equip">
        <h2 id="st-equip" className={styles.cardTitle}>
          {t("myTitles.display")}
        </h2>
        <label className={styles.switchRow}>
          <span>{t("myTitles.showGrade")}</span>
          <input type="checkbox" checked={equip.showGrade} onChange={(e) => setEquip({ ...equip, showGrade: e.target.checked })} />
        </label>
        <label className={styles.switchRow}>
          <span>{t("myTitles.globalGrade")}</span>
          <select className={styles.select} value={equip.globalTitle} onChange={(e) => setEquip({ ...equip, globalTitle: e.target.value as EquipSettings["globalTitle"] })}>
            <option value="AUTO">{t("myTitles.auto")}</option>
            <option value="OFF">{t("myTitles.off")}</option>
            {identity.global.earned.map((k) => (
              <option key={k} value={k}>
                {globalTitleLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.switchRow}>
          <span>{t("myTitles.showStore")}</span>
          <input type="checkbox" checked={equip.showStoreTitle} onChange={(e) => setEquip({ ...equip, showStoreTitle: e.target.checked })} />
        </label>
        {message && (
          <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={save} disabled={!dirty || pending} aria-busy={pending || undefined}>
            {pending ? t("myTitles.saving") : t("my.save")}
          </button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="st-grade">
        <h2 id="st-grade" className={styles.cardTitle}>
          {t("myTitles.activity", { grade: gradeLabel(identity.grade.key) })}
        </h2>
        <p className={styles.muted}>{t("myTitles.activityNote", { months: GRADE_MONTHS, fn: formatNumber(identity.grade.recentFn) })}</p>
        {identity.grade.kept && <p className={styles.note}>{t("myTitles.kept", { months: GRADE_MONTHS, grade: gradeLabel(identity.grade.key) })}</p>}
        <ProgressBar progress={identity.grade.progress} />
        <ol className={styles.ladder}>
          {GRADES.map((g) => (
            <li key={g.key} data-on={identity.grade.key === g.key || undefined}>
              <strong>{g.label}</strong>
              <span>{formatNumber(g.minFn)} FN~</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.card} aria-labelledby="st-global">
        <h2 id="st-global" className={styles.cardTitle}>
          {t("myTitles.global", { grade: identity.global.best ? globalTitleLabel(identity.global.best) : t("myTitles.none") })}
        </h2>
        <p className={styles.muted}>{t("myTitles.globalNote", { fn: formatNumber(identity.global.lifetimeFn) })}</p>
        <ProgressBar progress={identity.global.progress} />
        {(Object.keys(TITLE_LINE_LABEL) as TitleLine[]).map((line) => (
          <div key={line} className={styles.ladderGroup}>
            <h3 className={styles.ladderTitle}>{TITLE_LINE_LABEL[line]}</h3>
            <ol className={styles.ladder}>
              {GLOBAL_TITLES.filter((t) => t.line === line).map((t) => (
                <li key={t.key} data-on={identity.global.earned.includes(t.key) || undefined}>
                  <strong>{t.label}</strong>
                  <span>{formatNumber(t.minFn)} FN~</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      <section className={styles.card} aria-labelledby="st-store">
        <h2 id="st-store" className={styles.cardTitle}>
          {t("myTitles.store")}
        </h2>
        <p className={styles.muted}>{t("myTitles.storeNote")}</p>
        {identity.stores.length === 0 ? (
          <p className={styles.empty}>{t("myTitles.storeEmpty")}</p>
        ) : (
          <ul className={styles.list}>
            {identity.stores.map((s) => (
              <li key={s.creatorId} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong className={styles.rowTitle}>
                    {s.creatorName} {s.title && <span className={styles.chip}>{storeTitleLabel(s.title)}</span>}
                  </strong>
                  <span className={styles.muted}>{t("myTitles.storeTotal", { fn: formatNumber(s.totalFn) })}</span>
                </div>
                <div className={styles.rowProgress}>
                  <ProgressBar progress={s.progress} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>{t("myTitles.steps", { steps: STORE_TITLES.map((s) => `${s.label} ${formatNumber(s.minFn)} FN`).join(" · ") })}</p>
      </section>
    </div>
  );
}

function ProgressBar({ progress, compact = false }: { progress: Progress; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <div className={compact ? styles.progressCompact : styles.progress}>
      <span className={styles.bar} aria-hidden="true">
        <span style={{ width: `${progress.percent}%` }} />
      </span>
      <span className={styles.muted}>
        {progress.nextLabel && progress.nextMinFn !== null
          ? t("myTitles.nextStep", { label: progress.nextLabel, fn: formatNumber(progress.nextMinFn - progress.currentFn) })
          : t("myTitles.topStep")}
      </span>
    </div>
  );
}
