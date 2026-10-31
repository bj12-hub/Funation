"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { formatKstDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { changeSsumnationId, type IdChangeResult } from "@/services/account/profileActions";
import { changeChannelName, saveCreatorProfile, uploadCreatorImage } from "@/services/creator/creatorSettings";
import {
  BROADCAST_CATEGORIES,
  MAX_ANNIVERSARIES,
  MAX_CATEGORIES,
  type Anniversary,
  type CreatorSettings
} from "@/services/creator/creatorSettingsTypes";
import styles from "./settings.module.css";

type Props = { settings: CreatorSettings };

const IMAGE_ERRORS: Record<string, MessageKey> = {
  UNSUPPORTED: "studioSettings.imageUnsupported",
  TOO_LARGE: "studioSettings.imageTooLarge",
  FAILED: "studioSettings.imageFailed"
};

// Keyed by every failure the action can return (LIMITED and UNAUTHORIZED are handled on their own), so a new status fails tsc here.
const ID_ERRORS: Record<Exclude<IdChangeResult["status"], "CHANGED" | "LIMITED" | "UNAUTHORIZED">, MessageKey> = {
  INVALID: "studioSettings.idInvalid",
  DUPLICATE: "studioSettings.idDuplicate",
  FORBIDDEN: "studioSettings.idForbidden",
  RESERVED: "studioSettings.idReserved"
};

/**
 * Figma 326:496 프로필 수정. Nickname (channel name), 썸네이션 ID and images save on their own actions
 * ("수정" / picking a file, like the design); dates, visibility, anniversaries and categories save with 저장.
 */
export function ProfileEditModal({ settings }: Props) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  return (
    <>
      <button type="button" className={styles.detailButton} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        {t("studioSettings.details")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("studioSettings.profile")} width={580} className={styles.dialog}>
        {open && (
          <ProfileEditBody
            settings={settings}
            onSaved={(message, close) => {
              setToast(message);
              router.refresh();
              if (close) setOpen(false);
            }}
            onUnauthorized={() => router.push("/login?role=creator&next=/creator/settings")}
          />
        )}
      </Modal>
      <Toast message={toast} tone="neutral" onDone={clearToast} />
    </>
  );
}

function ProfileEditBody({
  settings,
  onSaved,
  onUnauthorized
}: Props & { onSaved: (message: string, close: boolean) => void; onUnauthorized: () => void }) {
  const { t } = useI18n();
  const [images, setImages] = useState(settings.images);
  const [imageError, setImageError] = useState<string | null>(null);
  const [channelName, setChannelName] = useState(settings.channelName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [ssumId, setSsumId] = useState(settings.ssumnationId);
  const [idError, setIdError] = useState<string | null>(null);
  const [form, setForm] = useState({
    birthday: settings.birthday,
    birthdayPublic: settings.birthdayPublic,
    debutDate: settings.debutDate,
    debutPublic: settings.debutPublic,
    anniversaries: settings.anniversaries as Anniversary[],
    categories: settings.categories
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(0);

  const upload = (file: File) => {
    const slot = slotRef.current;
    setImageError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("slot", String(slot));
      data.set("image", file);
      try {
        const r = await uploadCreatorImage(data);
        if (r.status === "UPLOADED") {
          setImages((list) => list.map((x, i) => (i === slot ? r.url : x)));
          onSaved(t("studioSettings.imageChanged"), false);
        } else if (r.status === "UNAUTHORIZED") onUnauthorized();
        else setImageError(t(IMAGE_ERRORS[r.status]));
      } catch {
        setImageError(t(IMAGE_ERRORS.FAILED));
      }
    });
  };

  const saveName = () =>
    startTransition(async () => {
      setNameError(null);
      try {
        const r = await changeChannelName(channelName);
        if (r.status === "SAVED") onSaved(t("studioSettings.nameChanged"), false);
        else if (r.status === "UNAUTHORIZED") onUnauthorized();
        else setNameError(r.message ?? t("studioSettings.nameCheck"));
      } catch {
        setNameError(t("studioSettings.saveFailed"));
      }
    });

  const saveId = () =>
    startTransition(async () => {
      setIdError(null);
      try {
        const r = await changeSsumnationId(ssumId.trim());
        if (r.status === "CHANGED") onSaved(t("studioSettings.idChanged"), false);
        else if (r.status === "UNAUTHORIZED") onUnauthorized();
        else if (r.status === "LIMITED") setIdError(t("studioSettings.idLimited", { date: formatKstDate(r.availableFrom) }));
        else setIdError(t(ID_ERRORS[r.status]));
      } catch {
        setIdError(t("studioSettings.saveFailed"));
      }
    });

  const save = () =>
    startTransition(async () => {
      setFormError(null);
      try {
        const r = await saveCreatorProfile(form);
        if (r.status === "SAVED") onSaved(t("studioSettings.profileSaved"), true);
        else if (r.status === "UNAUTHORIZED") onUnauthorized();
        else setFormError(r.message ?? t("studioSettings.formCheck"));
      } catch {
        setFormError(t("studioSettings.saveFailed"));
      }
    });

  const toggleCategory = (c: string) =>
    setForm((f) =>
      f.categories.includes(c) ? { ...f, categories: f.categories.filter((x) => x !== c) } : f.categories.length >= MAX_CATEGORIES ? f : { ...f, categories: [...f.categories, c] }
    );

  return (
    <div className={styles.modalBody}>
      <section className={styles.modalSection}>
        <h3 className={styles.modalLabel}>
          {t("studioSettings.images")} <span>{t("studioSettings.imagesMax")}</span>
        </h3>
        <div className={styles.slots}>
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.slot} ${i === 0 ? styles.slotMain : ""}`}
              disabled={pending}
              aria-label={t(i === 0 ? (src ? "studioSettings.mainSlotChange" : "studioSettings.mainSlotAdd") : src ? "studioSettings.slotChange" : "studioSettings.slotAdd", { n: i + 1 })}
              onClick={() => {
                slotRef.current = i;
                fileRef.current?.click();
              }}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element -- data URL / arbitrary-host upload preview
                <img src={src} alt="" />
              ) : (
                <span aria-hidden="true">{i === 0 ? "📷" : "+"}</span>
              )}
              {i === 0 && <span className={styles.mainBadge}>{t("studioSettings.main")}</span>}
            </button>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) upload(file);
            }}
          />
        </div>
        {imageError && (
          <p className={styles.error} role="alert">
            {imageError}
          </p>
        )}
      </section>

      <section className={styles.modalSection}>
        <label className={styles.modalLabel} htmlFor="creator-name">
          {t("studioSettings.nickname")}
        </label>
        <div className={styles.fieldRow}>
          <input id="creator-name" className={styles.input} value={channelName} maxLength={20} onChange={(e) => setChannelName(e.target.value)} />
          <button type="button" className={styles.secondaryButton} disabled={pending || channelName.trim() === settings.channelName} onClick={saveName}>
            {t("studioSettings.edit")}
          </button>
        </div>
        {nameError && (
          <p className={styles.error} role="alert">
            {nameError}
          </p>
        )}
      </section>

      <section className={styles.modalSection}>
        <label className={styles.modalLabel} htmlFor="creator-ssumid">
          {t("studioSettings.ssumId")}
        </label>
        <div className={styles.fieldRow}>
          <span className={`${styles.input} ${styles.prefixed}`}>
            @
            <input id="creator-ssumid" value={ssumId} maxLength={20} onChange={(e) => setSsumId(e.target.value.toLowerCase())} />
          </span>
          <button type="button" className={styles.secondaryButton} disabled={pending || ssumId.trim() === settings.ssumnationId} onClick={saveId}>
            {t("studioSettings.edit")}
          </button>
        </div>
        {idError && (
          <p className={styles.error} role="alert">
            {idError}
          </p>
        )}
      </section>

      <DateRow
        label={t("studioSettings.birthday")}
        value={form.birthday}
        visible={form.birthdayPublic}
        onChange={(birthday) => setForm((f) => ({ ...f, birthday }))}
        onVisible={(birthdayPublic) => setForm((f) => ({ ...f, birthdayPublic }))}
      />
      <DateRow
        label={t("studioSettings.debut")}
        value={form.debutDate}
        visible={form.debutPublic}
        onChange={(debutDate) => setForm((f) => ({ ...f, debutDate }))}
        onVisible={(debutPublic) => setForm((f) => ({ ...f, debutPublic }))}
      />

      <section className={styles.modalSection}>
        <h3 className={styles.modalLabel}>{t("studioSettings.anniversaries")}</h3>
        {form.anniversaries.map((a, i) => (
          <div key={i} className={styles.fieldRow}>
            <input
              className={styles.input}
              placeholder={t("studioSettings.anniversaryName")}
              maxLength={20}
              aria-label={t("studioSettings.anniversaryNameAria", { n: i + 1 })}
              value={a.name}
              onChange={(e) => setForm((f) => ({ ...f, anniversaries: f.anniversaries.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))}
            />
            <input
              type="date"
              className={`${styles.input} ${styles.dateInput}`}
              aria-label={t("studioSettings.anniversaryDateAria", { n: i + 1 })}
              value={a.date}
              onChange={(e) => setForm((f) => ({ ...f, anniversaries: f.anniversaries.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) }))}
            />
            <button
              type="button"
              className={styles.removeButton}
              aria-label={t("studioSettings.anniversaryRemoveAria", { n: i + 1 })}
              onClick={() => setForm((f) => ({ ...f, anniversaries: f.anniversaries.filter((_, j) => j !== i) }))}
            >
              ×
            </button>
          </div>
        ))}
        {form.anniversaries.length < MAX_ANNIVERSARIES && (
          <button type="button" className={styles.addLink} onClick={() => setForm((f) => ({ ...f, anniversaries: [...f.anniversaries, { name: "", date: "" }] }))}>
            {t("studioSettings.addItem")}
          </button>
        )}
      </section>

      <section className={styles.modalSection}>
        <h3 className={styles.modalLabel}>
          {t("studioSettings.broadcastInfo")} <span>{t("studioSettings.categoriesMax", { max: MAX_CATEGORIES })}</span>
        </h3>
        <div className={styles.chips} role="group" aria-label={t("studioSettings.broadcastInfo")}>
          {BROADCAST_CATEGORIES.map((c) => {
            const on = form.categories.includes(c);
            return (
              <button
                key={c}
                type="button"
                aria-pressed={on}
                disabled={!on && form.categories.length >= MAX_CATEGORIES}
                className={`${styles.chip} ${on ? styles.chipOn : ""}`}
                onClick={() => toggleCategory(c)}
              >
                <span className={styles.chipBox} aria-hidden="true">
                  {on ? "✓" : ""}
                </span>
                {c}
              </button>
            );
          })}
        </div>
      </section>

      {formError && (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      )}
      <button type="button" className={styles.saveButton} disabled={pending} onClick={save}>
        {pending ? t("studioSettings.saving") : t("studioSettings.save")}
      </button>
    </div>
  );
}

function DateRow({
  label,
  value,
  visible,
  onChange,
  onVisible
}: {
  label: string;
  value: string;
  visible: boolean;
  onChange: (v: string) => void;
  onVisible: (v: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <section className={styles.modalSection}>
      <div className={styles.dateHead}>
        <span className={styles.modalLabel}>{label}</span>
        <span className={styles.publicToggle}>
          {t("studioSettings.public")}
          <Toggle label={t("studioSettings.publicAria", { label })} checked={visible} onChange={onVisible} />
        </span>
      </div>
      <input type="date" className={`${styles.input} ${styles.dateInput}`} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </section>
  );
}
