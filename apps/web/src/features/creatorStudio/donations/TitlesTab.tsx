"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { formatNumber } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { PROFILE_PHOTO_TYPES } from "@/lib/validation";
import { saveTitleTier, setTitleEnabled } from "@/services/creator/donationManagement";
import { TITLE_DESCRIPTION_MAX, TITLE_NAME_MAX, type TitleSaveResult, type TitleTier } from "@/services/creator/donationManagementTypes";
import styles from "./donations.module.css";

type Translate = ReturnType<typeof useI18n>["t"];
const messageOf = (r: TitleSaveResult, t: Translate) => (r.status === "INVALID" ? r.message : r.status === "UNAUTHORIZED" ? t("studioDonations.loginRequired") : null);
const isHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

/**
 * 칭호 설정 — Figma 539:690. Donors earn a creator-defined title when their cumulative donations reach a
 * threshold. Thresholds are the design's fixed list; whether creators can change them is TBD.
 */
export function TitlesTab({ initial }: { initial: TitleTier[] }) {
  const { t } = useI18n();
  const [tiers, setTiers] = useState(initial);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const replace = (tier: TitleTier) => setTiers((list) => list.map((x) => (x.threshold === tier.threshold ? tier : x)));

  return (
    <div className={styles.stack}>
      <div>
        <h2 className={styles.sectionHeading}>{t("studioDonations.titlesHeading")}</h2>
        <p className={styles.desc}>{t("studioDonations.titlesDesc")}</p>
        {/* 2026-10-09 결정: 익명 donations do not count toward the 크리에이터 칭호 (code-first line under the Figma copy). */}
        <p className={styles.desc}>{t("studioDonations.titlesAnonymous")}</p>
      </div>
      <ul className={styles.tierList}>
        {tiers.map((tier) => (
          <TierCard
            key={tier.threshold}
            tier={tier}
            open={openAt === tier.threshold}
            onToggleOpen={() => setOpenAt(openAt === tier.threshold ? null : tier.threshold)}
            onSaved={(next, msg) => {
              replace(next);
              setToast(msg);
            }}
            onError={setToast}
            onClose={() => setOpenAt(null)}
          />
        ))}
      </ul>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

function TierCard({
  tier,
  open,
  onToggleOpen,
  onSaved,
  onError,
  onClose
}: {
  tier: TitleTier;
  open: boolean;
  onToggleOpen: () => void;
  onSaved: (t: TitleTier, message: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const label = t("studioDonations.tierLabel", { amount: formatNumber(tier.threshold) });

  const toggle = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await setTitleEnabled(tier.threshold, enabled);
      if (r.status === "SAVED") onSaved(r.tier, enabled ? t("studioDonations.titleOn") : t("studioDonations.titleOff"));
      else onError(messageOf(r, t) ?? t("studioDonations.saveFailed"));
    } catch {
      onError(t("studioDonations.saveFailedRetry"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`${styles.tierCard} ${open ? styles.tierOpen : ""}`}>
      <div className={styles.tierHead}>
        <div className={styles.tierSummary}>
          <strong>{label}</strong>
          {open ? (
            <span className={styles.editing}>{t("studioDonations.editing")}</span>
          ) : tier.name ? (
            <span className={styles.tierName} style={{ color: tier.color }}>
              {tier.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded icons are data URLs in the mock
                <img src={tier.iconUrl} alt="" className={styles.tierIconSmall} />
              ) : (
                <span aria-hidden="true">👑</span>
              )}
              {tier.name}
            </span>
          ) : (
            <span className={styles.helper}>{t("studioDonations.setTitleHint")}</span>
          )}
        </div>
        <div className={styles.inline}>
          <Toggle label={t("studioDonations.useTitle", { label })} checked={tier.enabled} onChange={toggle} busy={busy} />
          <button type="button" className={open ? styles.solidPurple : styles.ghostButton} aria-expanded={open} onClick={onToggleOpen}>
            {open ? t("studioDonations.collapse") : t("studioDonations.expand")}
          </button>
        </div>
      </div>
      {open && (
        <TierEditor
          tier={tier}
          onCancel={onClose}
          onSaved={(next) => {
            onSaved(next, t("studioDonations.changesSaved"));
            onClose();
          }}
        />
      )}
    </li>
  );
}

function TierEditor({ tier, onCancel, onSaved }: { tier: TitleTier; onCancel: () => void; onSaved: (t: TitleTier) => void }) {
  const { t } = useI18n();
  const id = useId();
  const [name, setName] = useState(tier.name);
  const [description, setDescription] = useState(tier.description);
  const [color, setColor] = useState(tier.color);
  const [file, setFile] = useState<File | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [preview, setPreview] = useState<string | null>(tier.iconUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs created for the local preview.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("threshold", String(tier.threshold));
    fd.set("name", name);
    fd.set("description", description);
    fd.set("color", color);
    if (file) fd.set("icon", file);
    if (removeIcon && !file) fd.set("removeIcon", "1");
    try {
      const r = await saveTitleTier(fd);
      if (r.status === "SAVED") onSaved(r.tier);
      else setError(messageOf(r, t));
    } catch {
      setError(t("studioDonations.saveFailedRetry"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.tierBody} aria-busy={busy}>
      <label className={styles.field} htmlFor={`${id}-name`}>
        <span className={styles.lineLabel}>{t("studioDonations.nameLabel", { max: TITLE_NAME_MAX })}</span>
        <input
          id={`${id}-name`}
          className={styles.input}
          maxLength={TITLE_NAME_MAX}
          placeholder={t("studioDonations.namePlaceholder", { max: TITLE_NAME_MAX })}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className={styles.field} htmlFor={`${id}-desc`}>
        <span className={styles.lineLabel}>{t("studioDonations.descLabel")}</span>
        <input
          id={`${id}-desc`}
          className={styles.input}
          maxLength={TITLE_DESCRIPTION_MAX}
          placeholder={t("studioDonations.descPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className={styles.field}>
        <span className={styles.lineLabel}>{t("studioDonations.iconLabel")}</span>
        <div className={styles.inline}>
          <input
            ref={fileRef}
            type="file"
            accept={PROFILE_PHOTO_TYPES.join(",")}
            className={styles.srOnly}
            aria-label={t("studioDonations.iconFile")}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setRemoveIcon(false);
            }}
          />
          <button type="button" className={styles.uploadTile} aria-label={t("studioDonations.iconUpload")} onClick={() => fileRef.current?.click()}>
            +
          </button>
          <span className={styles.iconPreview} aria-label={t("studioDonations.iconPreview")} role="img">
            {preview && !removeIcon ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL / data URL preview
              <img src={preview} alt="" />
            ) : (
              <span aria-hidden="true">👑</span>
            )}
          </span>
          {(file || (tier.iconUrl && !removeIcon)) && (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => {
                setFile(null);
                setPreview(null);
                setRemoveIcon(true);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              {t("studioDonations.defaultIcon")}
            </button>
          )}
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.lineLabel}>{t("studioDonations.colorLabel")}</span>
        <span className={`${styles.colorField} ${isHex(color) ? "" : styles.colorInvalid}`}>
          <input
            aria-label={t("studioDonations.color")}
            value={color}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              const v = e.target.value.trim();
              setColor(v.startsWith("#") ? v : `#${v}`);
            }}
          />
          <input type="color" aria-label={t("studioDonations.colorPick")} value={isHex(color) ? color.toLowerCase() : "#ffffff"} onChange={(e) => setColor(e.target.value.toUpperCase())} />
        </span>
        <span className={styles.helper}>{t("studioDonations.colorHelp")}</span>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.editorActions}>
        <button type="button" className={styles.ghostButton} onClick={onCancel} disabled={busy}>
          {t("studioDonations.cancel")}
        </button>
        <button type="button" className={styles.solidPurple} onClick={save} disabled={busy}>
          {busy ? t("studioDonations.saving") : t("studioDonations.saveChanges")}
        </button>
      </div>
    </div>
  );
}
