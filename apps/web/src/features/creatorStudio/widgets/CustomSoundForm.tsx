"use client";

import { useId, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { deleteCustomSound, saveCustomSound } from "@/services/creator/widgetSettings";
import { CUSTOM_SOUND_MAX, CUSTOM_SOUND_TYPES, CUSTOM_SOUND_WORD_MAX, type CustomSound } from "@/services/creator/widgetSettingsTypes";
import type { FormProps } from "./forms";
import { LibrarySoundList, useLibrarySounds } from "./library/LibrarySounds";
import styles from "./widgets.module.css";

/** `fromLibrary`: a card added with 라이브러리 opens with the library list. */
type Card = { key: string; saved: CustomSound | null; fromLibrary?: boolean };
type Library = ReturnType<typeof useLibrarySounds>;

/**
 * 커스텀 사운드 설정 — Figma 373:1307. Each card saves on its own (the popup footer has no save here).
 * 라이브러리 picks a sound from 이미지·사운드 (code-first; the sound is copied into the card). The sounds play in the
 * 후원 알림 overlay while TTS reads a message (`remote/useSpeechQueue.ts`), so this popup has no address of its own.
 * TBD: file size/format policy, content review of uploads.
 */
export function CustomSoundForm({ value }: FormProps<"CUSTOM_SOUND">) {
  // Sounds are persisted per card, so this list is local UI state; reopening the popup reloads it.
  const [cards, setCards] = useState<Card[]>(() => value.sounds.map((s) => ({ key: s.id, saved: s })));
  const count = cards.length;
  const library = useLibrarySounds();
  const { t } = useI18n();

  const replace = (key: string, next: Card | null) =>
    setCards((prev) => (next ? prev.map((c) => (c.key === key ? next : c)) : prev.filter((c) => c.key !== key)));

  return (
    <div className={styles.rows}>
      <p className={styles.noticePink}>{t("widgetFormSound.notice")}</p>
      <div className={styles.inline}>
        <button
          type="button"
          className={styles.blueButton}
          disabled={count >= CUSTOM_SOUND_MAX}
          onClick={() => setCards((c) => [...c, { key: `new-${Date.now().toString(36)}`, saved: null }])}
        >
          {t("widgetFormSound.add")}
        </button>
        <button
          type="button"
          className={styles.smallButton}
          disabled={count >= CUSTOM_SOUND_MAX}
          onClick={() => setCards((c) => [...c, { key: `new-${Date.now().toString(36)}`, saved: null, fromLibrary: true }])}
        >
          {t("widgetFormSound.library")}
        </button>
        <span className={styles.help} title={t("widgetFormSound.help", { max: CUSTOM_SOUND_MAX })}>
          ?
        </span>
      </div>
      <p className={styles.hint}>{t("widgetFormSound.hint")}</p>
      {count === 0 && <p className={styles.hint}>{t("widgetFormSound.empty")}</p>}
      {cards.map((c) => (
        <SoundCard key={c.key} card={c} library={library} onSaved={(s) => replace(c.key, { key: c.key, saved: s })} onRemoved={() => replace(c.key, null)} />
      ))}
    </div>
  );
}

function SoundCard({ card, library, onSaved, onRemoved }: { card: Card; library: Library; onSaved: (s: CustomSound) => void; onRemoved: () => void }) {
  const id = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [word, setWord] = useState(card.saved?.word ?? "");
  const [volume, setVolume] = useState(card.saved?.volume ?? 50);
  const [file, setFile] = useState<File | null>(null);
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null);
  const [libraryOpen, setLibraryOpen] = useState(card.fromLibrary === true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const { t } = useI18n();
  const fileName = file?.name ?? (picked ? t("widgetFormSound.fromLibrary", { name: picked.name }) : (card.saved?.fileName ?? ""));
  const clearChoice = () => {
    setFile(null);
    setPicked(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("id", card.saved?.id ?? "");
    fd.set("word", word);
    fd.set("volume", String(volume));
    if (file) fd.set("file", file);
    else if (picked) fd.set("assetId", picked.id);
    try {
      const r = await saveCustomSound(fd);
      if (r.status === "SAVED") {
        clearChoice();
        setMessage({ tone: "ok", text: t("widgetFormSound.saved") });
        onSaved(r.sound);
      } else setMessage({ tone: "error", text: r.status === "INVALID" ? r.message : t("widgetForm.loginRequired") });
    } catch {
      setMessage({ tone: "error", text: t("widgetForm.saveFailed") });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (busy) return;
    if (!card.saved) return onRemoved();
    setBusy(true);
    try {
      const r = await deleteCustomSound(card.saved.id);
      if (r.status === "DELETED") onRemoved();
      else setMessage({ tone: "error", text: t("widgetForm.loginRequired") });
    } catch {
      setMessage({ tone: "error", text: t("widgetFormSound.deleteFailed") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className={styles.soundCard}
      aria-label={card.saved ? t("widgetFormSound.cardAria", { word: card.saved.word }) : t("widgetFormSound.newCard")}
      aria-busy={busy}
    >
      <div className={styles.sectionHead}>
        <strong>{card.saved ? card.saved.word : t("widgetFormSound.newCard")}</strong>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={card.saved ? t("widgetFormSound.deleteSound") : t("widgetFormSound.cancelAdd")}
          onClick={remove}
          disabled={busy}
        >
          ⊗
        </button>
      </div>
      <label htmlFor={`${id}-word`} className={styles.rowLabel}>
        {t("widgetFormSound.word")}
      </label>
      <input
        id={`${id}-word`}
        className={styles.input}
        maxLength={CUSTOM_SOUND_WORD_MAX}
        placeholder={t("widgetFormSound.wordPlaceholder")}
        value={word}
        onChange={(e) => setWord(e.target.value)}
      />
      <span className={styles.rowLabel}>{t("widgetFormSound.effect")}</span>
      <div className={styles.inline}>
        <input
          ref={fileRef}
          type="file"
          accept={CUSTOM_SOUND_TYPES.join(",")}
          className={styles.srOnly}
          aria-label={t("widgetFormSound.file")}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPicked(null);
          }}
        />
        <button type="button" className={styles.smallButton} onClick={() => fileRef.current?.click()}>
          {t("widgetFormSound.chooseFile")}
        </button>
        <button type="button" className={styles.smallButton} aria-expanded={libraryOpen} onClick={() => setLibraryOpen((o) => !o)}>
          {t("widgetFormSound.library")}
        </button>
        <span className={styles.fileName}>{fileName || t("widgetFormSound.noFile")}</span>
        {(file || picked) && (
          <button type="button" className={styles.dangerIcon} aria-label={t("widgetFormSound.clearFile")} onClick={clearChoice}>
            🗑️
          </button>
        )}
        {card.saved && !file && !picked && (
          <audio controls src={card.saved.fileUrl} className={styles.audio} aria-label={t("widgetFormSound.listen", { word: card.saved.word })} />
        )}
      </div>
      {libraryOpen && (
        <LibrarySoundList
          state={library.state}
          reload={library.reload}
          selectedId={picked?.id ?? null}
          onPick={(s) => {
            setPicked({ id: s.id, name: s.name });
            setFile(null);
            if (fileRef.current) fileRef.current.value = "";
            setLibraryOpen(false);
          }}
        />
      )}
      <label htmlFor={`${id}-vol`} className={styles.rowLabel}>
        {t("widgetFormSound.volume")}
      </label>
      <div className={styles.slider}>
        <input id={`${id}-vol`} type="range" min={0} max={100} step={1} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        <div className={styles.sliderScale} aria-hidden="true">
          <span>0%</span>
          <span>{volume}%</span>
          <span>100%</span>
        </div>
      </div>
      {/* Liability wording: stays Korean until an approved translation exists (2026-11-01). */}
      <p className={styles.warningBox}>
        ※알림※ 업로드한 음원에 대한 모든 책임은 게시자(크리에이터)에게 있으며, 썸네이션은 이로 인해 발생할 수 있는 모든 민/형사상 분쟁에 대해 일절 책임지지 않습니다.
      </p>
      {message && (
        <p className={message.tone === "error" ? styles.error : styles.okText} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
      <button type="button" className={styles.saveWide} onClick={save} disabled={busy}>
        {busy ? t("widgetForm.saving") : t("widgetFormSound.save")}
      </button>
    </section>
  );
}
