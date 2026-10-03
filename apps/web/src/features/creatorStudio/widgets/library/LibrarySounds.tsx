"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
        라이브러리를 불러오는 중…
      </p>
    );
  }
  if (state.status === "ERROR") {
    return (
      <p className={styles.error} role="alert">
        라이브러리를 불러오지 못했어요.{" "}
        <button type="button" className={styles.link} onClick={reload}>
          다시 시도
        </button>
      </p>
    );
  }
  if (state.sounds.length === 0) {
    return (
      <p className={styles.note}>
        라이브러리에 사운드가 없어요. <Link href="/creator/widgets/assets">이미지·사운드</Link>에서 먼저 올려 주세요.
      </p>
    );
  }
  return (
    <div className={styles.box}>
      <ul className={styles.list} aria-label="라이브러리 사운드">
        {state.sounds.map((s) => (
          <li key={s.id} className={styles.item} data-selected={s.id === selectedId ? "" : undefined}>
            <span className={styles.name}>{s.name}</span>
            <span className={styles.size}>{kb(s.size)}</span>
            <button type="button" className={styles.listen} aria-label={`${s.name} ${playing === s.id ? "멈춤" : "듣기"}`} aria-pressed={playing === s.id} onClick={() => toggle(s)}>
              {playing === s.id ? "■ 멈춤" : "▶ 듣기"}
            </button>
            <button type="button" className={styles.pick} disabled={s.id === selectedId} onClick={() => onPick(s)}>
              {s.id === selectedId ? "선택됨" : "선택"}
            </button>
          </li>
        ))}
      </ul>
      <Link href="/creator/widgets/assets" className={styles.manage}>
        라이브러리 관리 ›
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
  const [open, setOpen] = useState(false);
  const { state, reload } = useLibrarySounds();
  const current = value && state.status === "READY" ? (state.sounds.find((s) => s.id === value) ?? null) : null;
  const currentText = !value ? "선택 안 함" : current ? current.name : state.status === "LOADING" ? "…" : "라이브러리에서 지워진 효과음";

  return (
    <div className={styles.field}>
      <div className={styles.inline}>
        <button type="button" className={buttonClassName} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          🔊 {label}
        </button>
        <span className={styles.current}>{currentText}</span>
        {value && (
          <button type="button" className={styles.link} onClick={() => onChange(null)}>
            빼기
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
