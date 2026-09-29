"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { changeFunationId } from "@/services/account/profileActions";
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

const IMAGE_ERRORS: Record<string, string> = {
  UNSUPPORTED: "JPG, PNG, WEBP 이미지만 올릴 수 있어요.",
  TOO_LARGE: "5MB 이하의 이미지만 올릴 수 있어요.",
  FAILED: "이미지를 올리지 못했습니다. 다시 시도해 주세요."
};

const ID_ERRORS: Record<string, string> = {
  INVALID: "5~20자의 영문 소문자와 숫자만 사용할 수 있어요.",
  DUPLICATE: "이미 사용 중인 FUN ID예요.",
  FORBIDDEN: "사용할 수 없는 단어가 포함되어 있어요."
};

/**
 * Figma 326:496 프로필 수정. Nickname (channel name), FUN ID and images save on their own actions
 * ("수정" / picking a file, like the design); dates, visibility, anniversaries and categories save with 저장.
 */
export function ProfileEditModal({ settings }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);

  return (
    <>
      <button type="button" className={styles.detailButton} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        자세히보기
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="프로필 수정" width={580} className={styles.dialog}>
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
  const [images, setImages] = useState(settings.images);
  const [imageError, setImageError] = useState<string | null>(null);
  const [channelName, setChannelName] = useState(settings.channelName);
  const [nameError, setNameError] = useState<string | null>(null);
  const [funId, setFunId] = useState(settings.funationId);
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
          onSaved("프로필 이미지를 변경했습니다.", false);
        } else if (r.status === "UNAUTHORIZED") onUnauthorized();
        else setImageError(IMAGE_ERRORS[r.status]);
      } catch {
        setImageError(IMAGE_ERRORS.FAILED);
      }
    });
  };

  const saveName = () =>
    startTransition(async () => {
      setNameError(null);
      try {
        const r = await changeChannelName(channelName);
        if (r.status === "SAVED") onSaved("닉네임을 변경했습니다.", false);
        else if (r.status === "UNAUTHORIZED") onUnauthorized();
        else setNameError(r.message ?? "닉네임을 확인해 주세요.");
      } catch {
        setNameError("저장하지 못했습니다. 다시 시도해 주세요.");
      }
    });

  const saveId = () =>
    startTransition(async () => {
      setIdError(null);
      try {
        const r = await changeFunationId(funId.trim());
        if (r.status === "CHANGED") onSaved("FUN ID를 변경했습니다.", false);
        else if (r.status === "UNAUTHORIZED") onUnauthorized();
        else if (r.status === "LIMITED") setIdError(`${new Date(r.availableFrom).toLocaleDateString("ko-KR")}부터 다시 변경할 수 있어요.`);
        else setIdError(ID_ERRORS[r.status]);
      } catch {
        setIdError("저장하지 못했습니다. 다시 시도해 주세요.");
      }
    });

  const save = () =>
    startTransition(async () => {
      setFormError(null);
      try {
        const r = await saveCreatorProfile(form);
        if (r.status === "SAVED") onSaved("프로필을 저장했습니다.", true);
        else if (r.status === "UNAUTHORIZED") onUnauthorized();
        else setFormError(r.message ?? "입력 내용을 확인해 주세요.");
      } catch {
        setFormError("저장하지 못했습니다. 다시 시도해 주세요.");
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
          프로필 이미지 <span>(최대 3개)</span>
        </h3>
        <div className={styles.slots}>
          {images.map((src, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.slot} ${i === 0 ? styles.slotMain : ""}`}
              disabled={pending}
              aria-label={`${i === 0 ? "대표 " : ""}프로필 이미지 ${i + 1} ${src ? "변경" : "추가"}`}
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
              {i === 0 && <span className={styles.mainBadge}>대표</span>}
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
          닉네임
        </label>
        <div className={styles.fieldRow}>
          <input id="creator-name" className={styles.input} value={channelName} maxLength={20} onChange={(e) => setChannelName(e.target.value)} />
          <button type="button" className={styles.secondaryButton} disabled={pending || channelName.trim() === settings.channelName} onClick={saveName}>
            수정
          </button>
        </div>
        {nameError && (
          <p className={styles.error} role="alert">
            {nameError}
          </p>
        )}
      </section>

      <section className={styles.modalSection}>
        <label className={styles.modalLabel} htmlFor="creator-funid">
          FUN ID
        </label>
        <div className={styles.fieldRow}>
          <span className={`${styles.input} ${styles.prefixed}`}>
            @
            <input id="creator-funid" value={funId} maxLength={20} onChange={(e) => setFunId(e.target.value.toLowerCase())} />
          </span>
          <button type="button" className={styles.secondaryButton} disabled={pending || funId.trim() === settings.funationId} onClick={saveId}>
            수정
          </button>
        </div>
        {idError && (
          <p className={styles.error} role="alert">
            {idError}
          </p>
        )}
      </section>

      <DateRow
        label="생일"
        value={form.birthday}
        visible={form.birthdayPublic}
        onChange={(birthday) => setForm((f) => ({ ...f, birthday }))}
        onVisible={(birthdayPublic) => setForm((f) => ({ ...f, birthdayPublic }))}
      />
      <DateRow
        label="방송 데뷔일"
        value={form.debutDate}
        visible={form.debutPublic}
        onChange={(debutDate) => setForm((f) => ({ ...f, debutDate }))}
        onVisible={(debutPublic) => setForm((f) => ({ ...f, debutPublic }))}
      />

      <section className={styles.modalSection}>
        <h3 className={styles.modalLabel}>기타 기념일</h3>
        {form.anniversaries.map((a, i) => (
          <div key={i} className={styles.fieldRow}>
            <input
              className={styles.input}
              placeholder="기념일명"
              maxLength={20}
              aria-label={`기념일 ${i + 1} 이름`}
              value={a.name}
              onChange={(e) => setForm((f) => ({ ...f, anniversaries: f.anniversaries.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) }))}
            />
            <input
              type="date"
              className={`${styles.input} ${styles.dateInput}`}
              aria-label={`기념일 ${i + 1} 날짜`}
              value={a.date}
              onChange={(e) => setForm((f) => ({ ...f, anniversaries: f.anniversaries.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)) }))}
            />
            <button
              type="button"
              className={styles.removeButton}
              aria-label={`기념일 ${i + 1} 삭제`}
              onClick={() => setForm((f) => ({ ...f, anniversaries: f.anniversaries.filter((_, j) => j !== i) }))}
            >
              ×
            </button>
          </div>
        ))}
        {form.anniversaries.length < MAX_ANNIVERSARIES && (
          <button type="button" className={styles.addLink} onClick={() => setForm((f) => ({ ...f, anniversaries: [...f.anniversaries, { name: "", date: "" }] }))}>
            + 항목 추가
          </button>
        )}
      </section>

      <section className={styles.modalSection}>
        <h3 className={styles.modalLabel}>
          내 방송 정보 <span>* 최대 {MAX_CATEGORIES}개 선택 가능</span>
        </h3>
        <div className={styles.chips} role="group" aria-label="내 방송 정보">
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
        {pending ? "저장 중..." : "저장"}
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
  return (
    <section className={styles.modalSection}>
      <div className={styles.dateHead}>
        <span className={styles.modalLabel}>{label}</span>
        <span className={styles.publicToggle}>
          공개
          <Toggle label={`${label} 공개`} checked={visible} onChange={onVisible} />
        </span>
      </div>
      <input type="date" className={`${styles.input} ${styles.dateInput}`} aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} />
    </section>
  );
}
