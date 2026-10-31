"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { checkChannelSlug, createChannel } from "@/services/channel/channel";
import { CHANNEL_INTRO_MAX, CHANNEL_SLUG_RULE, type SlugCheck } from "@/services/channel/channelTypes";
import styles from "./channel.module.css";

const BENEFITS: { title: MessageKey; text: MessageKey }[] = [
  { title: "channel.benefitDonations", text: "channel.benefitDonationsText" },
  { title: "channel.benefitCrew", text: "channel.benefitCrewText" },
  { title: "channel.benefitWidgets", text: "channel.benefitWidgetsText" },
  { title: "channel.benefitSettlement", text: "channel.benefitSettlementText" }
];

/**
 * 채널 만들기 — code-first (no Figma frame). Route `/channel/new`. The slug check is advisory; the
 * server validates everything again and grants the Creator role.
 */
export function CreateChannelScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [slugState, setSlugState] = useState<SlugCheck["status"] | "CHECKING" | null>(null);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Debounced availability check while typing.
  useEffect(() => {
    if (!slug) return setSlugState(null);
    if (!CHANNEL_SLUG_RULE.test(slug)) return setSlugState("INVALID");
    setSlugState("CHECKING");
    const timer = setTimeout(() => checkChannelSlug(slug).then((r) => setSlugState(r.status)), 350);
    return () => clearTimeout(timer);
  }, [slug]);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createChannel({ slug, name, intro, agreed });
      if (res.status === "CREATED") {
        router.push("/creator");
        router.refresh();
      } else if (res.status === "SLUG_TAKEN") {
        setSlugState("TAKEN");
        setError({ field: "slug", text: t("channel.slugTaken") });
      } else if (res.status === "INVALID") setError({ field: res.field, text: res.message });
      else if (res.status === "ALREADY_CREATOR") router.push("/creator");
      else router.push("/login?next=/channel/new");
    });
  };

  const slugHint =
    slugState === "INVALID"
      ? t("channel.slugInvalid")
      : slugState === "TAKEN"
        ? t("channel.slugTaken")
        : slugState === "AVAILABLE"
          ? t("channel.slugAvailable")
          : slugState === "CHECKING"
            ? t("channel.checking")
            : t("channel.slugHint");

  // "{terms}" marks where the terms link goes in the sentence.
  const agree = t("channel.agree").split("{terms}");

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>{t("channel.title")}</h1>
        <p className={styles.subtitle}>{t("channel.subtitle")}</p>
      </header>

      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>
            {t("channel.address")} <span className={styles.req}>*</span>
          </span>
          <span className={styles.prefixInput}>
            <span className={styles.prefix}>ssumnation.com/c/</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30))} maxLength={30} aria-describedby="ch-slug-hint" />
          </span>
          <span id="ch-slug-hint" className={styles.hint} data-tone={slugState === "AVAILABLE" ? "ok" : slugState === "TAKEN" || slugState === "INVALID" ? "error" : undefined}>
            {slugHint}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            {t("channel.name")} <span className={styles.req}>*</span>
          </span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder={t("channel.namePlaceholder")} />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>{t("channel.intro")}</span>
          <textarea className={styles.textarea} value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={CHANNEL_INTRO_MAX} placeholder={t("channel.introPlaceholder")} />
          <span className={styles.hint}>
            {intro.length} / {CHANNEL_INTRO_MAX}
          </span>
        </label>

        <label className={styles.agree}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            {agree[0]}
            <Link href="/terms/creator" target="_blank" className={styles.link}>
              {t("channel.terms")}
            </Link>
            {agree[1]}
          </span>
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error.text}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={pending || !agreed || slugState !== "AVAILABLE" || !name.trim()} aria-busy={pending || undefined}>
          {pending ? t("channel.creating") : t("channel.create")}
        </button>
        <p className={styles.note}>{t("channel.note")}</p>
      </form>

      <section aria-labelledby="ch-benefits">
        <h2 id="ch-benefits" className={styles.subTitle}>
          {t("channel.benefits")}
        </h2>
        <ul className={styles.benefits}>
          {BENEFITS.map((b) => (
            <li key={b.title}>
              <strong>{t(b.title)}</strong>
              <span>{t(b.text)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
