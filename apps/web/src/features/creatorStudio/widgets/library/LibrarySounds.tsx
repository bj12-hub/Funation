"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { listAssets } from "@/services/creator/assets";
import type { Asset } from "@/services/creator/assetTypes";
import styles from "./librarySounds.module.css";

type SoundsState = { status: "LOADING" } | { status: "ERROR" } | { status: "READY"; sounds: Asset[] };

/** The creator's SOUND files from the 이미지·사운드 library (code-first). `reload` fetches them again. */
export function useLibrarySounds() {
  const [state, setState] = useState<SoundsState>({ status: "LOADING" });
  const [seq, setSeq] = useState(0);
  useEffect(() => {
    let alive = true;
    listAssets("SOUND")
      .then((list) => alive && setState(list ? { status: "READY", sounds: list } : { status: "ERROR" }))
      .catch(() => alive && setState({ status: "ERROR" }));
    return () => {
      alive = false;
    };
  }, [seq]);
  const reload = () => {
    setState({ status: "LOADING" });
    setSeq((n) => n + 1);
  };
  return { state, reload };
}

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("ko-KR")}KB`;

/** Pick one sound from the library: listen first, then 선택. Empty and error states point to 이미지·사운드. */
export function LibrarySoundList({
  state,
  reload,
  selectedId,
  onPick
}: {
  state: SoundsState;
  reload: () => void;
  selectedId: string | null;
  onPick: (sound: Asset) => void;
}) {
  const { t } = useI18n();
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  const toggle = (sound: Asset) => {
    audio.current?.pause();
    if (playing === sound.id) return setPlaying(null);
    const el = new Audio(sound.url);
    el.onended = () => setPlaying(null);
    audio.current = el;
    el.play().then(
      () => setPlaying(sound.id),
      () => setPlaying(null)
    );
  };

  if (state.status === "LOADING") {
    return (
      <p className={styles.note} role="status">
        {t("studioToolsLibrary.loading")}
      </p>
    );
  }
  if (state.status === "ERROR") {
    return (
      <p className={styles.error} role="alert">
        {t("studioToolsLibrary.loadFailed")}{" "}
        <button type="button" className={styles.link} onClick={reload}>
          {t("studioTools.retry")}
        </button>
      </p>
    );
  }
  if (state.sounds.length === 0) {
    return (
      <p className={styles.note}>
        {t("studioToolsLibrary.noSoundsBefore")}
        <Link href="/creator/widgets/assets">{t("studioTools.assetsLink")}</Link>
        {t("studioToolsLibrary.uploadFirstAfter")}
      </p>
    );
  }
  return (
    <div className={styles.box}>
      <ul className={styles.list} aria-label={t("studioToolsLibrary.soundsAria")}>
        {state.sounds.map((s) => (
          <li key={s.id} className={styles.item} data-selected={s.id === selectedId ? "" : undefined}>
            <span className={styles.name}>{s.name}</span>
            <span className={styles.size}>{kb(s.size)}</span>
            <button
              type="button"
              className={styles.listen}
              aria-label={t(playing === s.id ? "studioToolsLibrary.stopAria" : "studioToolsLibrary.playAria", { name: s.name })}
              aria-pressed={playing === s.id}
              onClick={() => toggle(s)}
            >
              {playing === s.id ? t("studioToolsLibrary.stop") : t("studioToolsLibrary.play")}
            </button>
            <button type="button" className={styles.pick} disabled={s.id === selectedId} onClick={() => onPick(s)}>
              {s.id === selectedId ? t("studioToolsLibrary.selected") : t("studioToolsLibrary.select")}
            </button>
          </li>
        ))}
      </ul>
      <Link href="/creator/widgets/assets" className={styles.manage}>
        {t("studioToolsLibrary.manage")}
      </Link>
    </div>
  );
}

/** One library sound as a setting (e.g. 뽑기 당첨 효과음): shows the current choice, opens the list, 빼기 clears it. */
export function LibrarySoundField({
  value,
  onChange,
  label,
  buttonClassName
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label: string;
  buttonClassName?: string;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const { state, reload } = useLibrarySounds();
  const current = value && state.status === "READY" ? (state.sounds.find((s) => s.id === value) ?? null) : null;
  const currentText = !value ? t("studioToolsLibrary.noneSelected") : current ? current.name : state.status === "LOADING" ? "…" : t("studioToolsLibrary.deletedSound");

  return (
    <div className={styles.field}>
      <div className={styles.inline}>
        <button type="button" className={buttonClassName} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          🔊 {label}
        </button>
        <span className={styles.current}>{currentText}</span>
        {value && (
          <button type="button" className={styles.link} onClick={() => onChange(null)}>
            {t("studioTools.remove")}
          </button>
        )}
      </div>
      {open && (
        <LibrarySoundList
          state={state}
          reload={reload}
          selectedId={value}
          onPick={(s) => {
            onChange(s.id);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
