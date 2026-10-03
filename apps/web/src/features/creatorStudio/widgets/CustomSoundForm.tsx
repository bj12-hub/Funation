"use client";

import { useId, useRef, useState } from "react";
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
 * 라이브러리 picks a sound from 이미지·사운드 (code-first; the sound is copied into the card).
 * TBD: file size/format policy, content review of uploads.
 */
export function CustomSoundForm({ value }: FormProps<"CUSTOM_SOUND">) {
  // Sounds are persisted per card, so this list is local UI state; reopening the popup reloads it.
  const [cards, setCards] = useState<Card[]>(() => value.sounds.map((s) => ({ key: s.id, saved: s })));
  const count = cards.length;
  const library = useLibrarySounds();

  const replace = (key: string, next: Card | null) =>
    setCards((prev) => (next ? prev.map((c) => (c.key === key ? next : c)) : prev.filter((c) => c.key !== key)));

  return (
    <div className={styles.rows}>
      <p className={styles.noticePink}>※ 커스텀 사운드 기능은 크리에이터가 지정한 음성으로 특정 단어에 대해 보이스 기능 대신 재생되는 기능입니다.</p>
      <div className={styles.inline}>
        <button
          type="button"
          className={styles.blueButton}
          disabled={count >= CUSTOM_SOUND_MAX}
          onClick={() => setCards((c) => [...c, { key: `new-${Date.now().toString(36)}`, saved: null }])}
        >
          + 커스텀 사운드 추가
        </button>
        <button
          type="button"
          className={styles.smallButton}
          disabled={count >= CUSTOM_SOUND_MAX}
          onClick={() => setCards((c) => [...c, { key: `new-${Date.now().toString(36)}`, saved: null, fromLibrary: true }])}
        >
          라이브러리
        </button>
        <span className={styles.help} title={`음성 후원 메시지에 '교체할 단어'가 나오면 등록한 효과음이 대신 재생됩니다. 최대 ${CUSTOM_SOUND_MAX}개.`}>
          ?
        </span>
      </div>
      {count === 0 && <p className={styles.hint}>등록된 커스텀 사운드가 없습니다.</p>}
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
  const fileName = file?.name ?? (picked ? `${picked.name} (라이브러리)` : (card.saved?.fileName ?? ""));
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
        setMessage({ tone: "ok", text: "저장했습니다." });
        onSaved(r.sound);
      } else setMessage({ tone: "error", text: r.status === "INVALID" ? r.message : "로그인이 필요합니다." });
    } catch {
      setMessage({ tone: "error", text: "저장하지 못했습니다. 잠시 후 다시 시도해 주세요." });
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
      else setMessage({ tone: "error", text: "로그인이 필요합니다." });
    } catch {
      setMessage({ tone: "error", text: "삭제하지 못했습니다. 잠시 후 다시 시도해 주세요." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className={styles.soundCard} aria-label={card.saved ? `커스텀 사운드: ${card.saved.word}` : "커스텀 사운드 추가"} aria-busy={busy}>
      <div className={styles.sectionHead}>
        <strong>{card.saved ? card.saved.word : "커스텀 사운드 추가"}</strong>
        <button type="button" className={styles.iconButton} aria-label={card.saved ? "사운드 삭제" : "추가 취소"} onClick={remove} disabled={busy}>
          ⊗
        </button>
      </div>
      <label htmlFor={`${id}-word`} className={styles.rowLabel}>
        교체할 단어
      </label>
      <input
        id={`${id}-word`}
        className={styles.input}
        maxLength={CUSTOM_SOUND_WORD_MAX}
        placeholder="교체할 단어를 입력해주세요."
        value={word}
        onChange={(e) => setWord(e.target.value)}
      />
      <span className={styles.rowLabel}>효과음 선택</span>
      <div className={styles.inline}>
        <input
          ref={fileRef}
          type="file"
          accept={CUSTOM_SOUND_TYPES.join(",")}
          className={styles.srOnly}
          aria-label="효과음 파일"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPicked(null);
          }}
        />
        <button type="button" className={styles.smallButton} onClick={() => fileRef.current?.click()}>
          파일선택
        </button>
        <button type="button" className={styles.smallButton} aria-expanded={libraryOpen} onClick={() => setLibraryOpen((o) => !o)}>
          라이브러리
        </button>
        <span className={styles.fileName}>{fileName || "선택된 파일 없음"}</span>
        {(file || picked) && (
          <button type="button" className={styles.dangerIcon} aria-label="선택한 파일 취소" onClick={clearChoice}>
            🗑️
          </button>
        )}
        {card.saved && !file && !picked && <audio controls src={card.saved.fileUrl} className={styles.audio} aria-label={`${card.saved.word} 효과음 미리듣기`} />}
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
        알림 효과음 볼륨
      </label>
      <div className={styles.slider}>
        <input id={`${id}-vol`} type="range" min={0} max={100} step={1} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
        <div className={styles.sliderScale} aria-hidden="true">
          <span>0%</span>
          <span>{volume}%</span>
          <span>100%</span>
        </div>
      </div>
      <p className={styles.warningBox}>
        ※알림※ 업로드한 음원에 대한 모든 책임은 게시자(크리에이터)에게 있으며, 썸네이션은 이로 인해 발생할 수 있는 모든 민/형사상 분쟁에 대해 일절 책임지지 않습니다.
      </p>
      {message && (
        <p className={message.tone === "error" ? styles.error : styles.okText} role={message.tone === "error" ? "alert" : "status"}>
          {message.text}
        </p>
      )}
      <button type="button" className={styles.saveWide} onClick={save} disabled={busy}>
        {busy ? "저장 중…" : "저장"}
      </button>
    </section>
  );
}
