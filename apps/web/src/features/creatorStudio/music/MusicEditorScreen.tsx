"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { uploadAsset } from "@/services/creator/assets";
import { ASSET_LIMITS, type Asset } from "@/services/creator/assetTypes";
import crew from "../crew/crew.module.css";
import { ENVELOPE_RATE, decodeAudio, envelopeOf, renderMix, startRecording, type MicError } from "./musicAudio";
import {
  MUSIC_CLIPS_MAX,
  MUSIC_FILE_MAX,
  MUSIC_GAIN_MAX,
  MUSIC_SHORTCUTS,
  MUSIC_LENGTH_MAX,
  MUSIC_QUALITIES,
  MUSIC_RECORD_MAX,
  MUSIC_TRACKS_MAX,
  clipCount,
  clipEnd,
  clipLength,
  copyClip,
  encodeWav,
  fitFades,
  moveClip,
  musicCommandOf,
  newClip,
  peaks,
  playPosition,
  projectLength,
  pushHistory,
  splitClip,
  trimClip,
  wavBytes,
  type MusicClip,
  type MusicCommand,
  type MusicQuality,
  type MusicSource,
  type MusicTrack
} from "./musicProject";
import local from "./musicEditor.module.css";

type Drag = { clipId: string; trackId: string; mode: "move" | "left" | "right"; x: number; clip: MusicClip };
const PPS_STEPS = [10, 20, 40, 80, 160];
const MIC_MESSAGE: Record<MicError, MessageKey> = {
  DENIED: "studioMusic.micDenied",
  NO_MIC: "studioMusic.micMissing",
  FAILED: "studioMusic.micFailed"
};
/** MUSIC_SHORTCUTS · MUSIC_QUALITIES labels in the viewer's language (2026-11-01). */
const SHORTCUT_KEYS: Record<MusicCommand, MessageKey> = {
  PLAY: "studioMusic.playStop",
  UNDO: "studioMusic.undo",
  REDO: "studioMusic.redo",
  LOOP: "studioMusic.loopLabel",
  SPLIT: "studioMusic.split",
  COPY: "studioMusic.copy",
  PASTE: "studioMusic.paste",
  DELETE: "studioMusic.deleteClip"
};
const QUALITY_KEYS: Record<MusicQuality, MessageKey> = { STANDARD: "studioMusic.qualityStandard", SMALL: "studioMusic.qualitySmall" };
const newId = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;
const firstTrack = (name: string): MusicTrack => ({ id: "t-1", name, gain: 1, muted: false, clips: [] });

/**
 * 음악 편집기 — code-first (no Figma frame; StreamDonate "음악 제작" 참고, P3). Route `/creator/widgets/music`. Tracks (4)
 * of clips on one timeline: add audio from the 라이브러리, a file or 녹음 at the playhead on the chosen track; drag a clip to
 * move it, its edges to 트림; 분할 at the playhead; 볼륨 · 페이드 per clip, 볼륨 · 음소거 per track; 재생 from the playhead.
 * The mix (mono WAV) is saved to the 이미지·사운드 library or downloaded. All editing stays in this browser tab.
 * 2026-10-28 (StreamDonate 음악 제작): 되돌리기 · 다시 실행, 클립 복사 · 붙여넣기 (at the playhead, on the chosen track), 루프 재생
 * and their 단축키 (not while typing in a field).
 */
export function MusicEditorScreen({ sounds }: { sounds: Asset[] }) {
  const { t } = useI18n();
  /** Seconds as read ("12.3초" · "1분 5.0초"), like formatSec, in the viewer's language. */
  const sec = (s: number) => (s >= 60 ? t("studioMusic.minSec", { m: Math.floor(s / 60), s: (s % 60).toFixed(1) }) : t("studioMusic.sec", { s: s.toFixed(1) }));
  const router = useRouter();
  const [sources, setSources] = useState<MusicSource[]>([]);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const envelopes = useRef(new Map<string, Float32Array>());
  const [tracks, setTracks] = useState<MusicTrack[]>(() => [firstTrack(t("studioMusic.trackName", { n: 1 }))]);
  const [trackSel, setTrackSel] = useState("t-1");
  const [clipSel, setClipSel] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [pps, setPps] = useState(40);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string; link?: boolean } | null>(null);
  const [dirty, setDirty] = useState(false);
  const length = projectLength(tracks);

  // 되돌리기 · 다시 실행: the timeline before each edit (a drag is one edit).
  const [past, setPast] = useState<MusicTrack[][]>([]);
  const [future, setFuture] = useState<MusicTrack[][]>([]);
  const tracksRef = useRef(tracks);
  useEffect(() => {
    tracksRef.current = tracks;
  });
  const remember = () => {
    setPast((p) => pushHistory(p, tracksRef.current));
    setFuture([]);
  };
  const edit = (fn: (ts: MusicTrack[]) => MusicTrack[], record = true) => {
    if (record) remember();
    setTracks(fn);
    setDirty(true);
  };
  const undo = () => {
    const prev = past.at(-1);
    if (!prev) return;
    setFuture((f) => [tracksRef.current, ...f]);
    setPast((p) => p.slice(0, -1));
    setTracks(prev);
    setDirty(true);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setPast((p) => pushHistory(p, tracksRef.current));
    setFuture((f) => f.slice(1));
    setTracks(next);
    setDirty(true);
  };
  const editClip = (clipId: string, fn: (c: MusicClip) => MusicClip, record = true) =>
    edit((ts) => ts.map((t) => ({ ...t, clips: t.clips.map((c) => (c.id === clipId ? fn(c) : c)) })), record);
  const selected = (() => {
    for (const t of tracks) for (const c of t.clips) if (c.id === clipSel) return { track: t, clip: c };
    return null;
  })();
  const sourceOf = (id: string) => sources.find((s) => s.id === id);

  // Leaving with edits that were not saved or downloaded asks first (nothing is kept between visits).
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // ── Adding audio ────────────────────────────────────────────────────────────
  const addSource = async (name: string, bytes: ArrayBuffer) => {
    if (clipCount(tracks) >= MUSIC_CLIPS_MAX) {
      setMessage({ tone: "error", text: t("studioMusic.clipsMax", { max: MUSIC_CLIPS_MAX }) });
      return;
    }
    setBusy(t("studioMusic.reading"));
    setMessage(null);
    try {
      const buffer = await decodeAudio(bytes);
      const source: MusicSource = { id: newId("src"), name, duration: Math.round(buffer.duration * 1000) / 1000 };
      buffers.current.set(source.id, buffer);
      envelopes.current.set(source.id, envelopeOf(buffer));
      setSources((s) => [...s, source]);
      const clip = newClip(newId("clip"), source, playhead);
      edit((ts) => ts.map((t) => (t.id === trackSel ? { ...t, clips: [...t.clips, clip] } : t)));
      setClipSel(clip.id);
    } catch {
      setMessage({ tone: "error", text: t("studioMusic.unreadable") });
    } finally {
      setBusy(null);
    }
  };
  const [libraryPick, setLibraryPick] = useState(sounds[0]?.id ?? "");
  // The library can change under the screen (a save adds a sound): the pick falls back to the first one.
  const pick = sounds.some((s) => s.id === libraryPick) ? libraryPick : (sounds[0]?.id ?? "");
  const addFromLibrary = async () => {
    const a = sounds.find((s) => s.id === pick);
    if (!a) return;
    setBusy(t("studioMusic.loadingLibrary"));
    try {
      const res = await fetch(a.url);
      if (!res.ok) throw new Error(String(res.status));
      await addSource(a.name, await res.arrayBuffer());
    } catch {
      setBusy(null);
      setMessage({ tone: "error", text: t("studioMusic.libraryFailed") });
    }
  };
  const fileInput = useRef<HTMLInputElement>(null);
  const addFromFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MUSIC_FILE_MAX) {
      setMessage({ tone: "error", text: t("studioMusic.fileMax", { mb: MUSIC_FILE_MAX / 1024 / 1024 }) });
      return;
    }
    await addSource(file.name.replace(/\.[^.]+$/, "").slice(0, ASSET_LIMITS.nameMax) || t("studioMusic.myFile"), await file.arrayBuffer());
  };
  const recorder = useRef<{ stop: () => Promise<Blob> } | null>(null);
  const [recording, setRecording] = useState(false);
  const recordNo = useRef(0);
  // The recording may stop by itself later: it adds with the latest track and playhead.
  const addSourceRef = useRef(addSource);
  useEffect(() => {
    addSourceRef.current = addSource;
  });
  const stopRecording = async () => {
    const r = recorder.current;
    recorder.current = null;
    setRecording(false);
    if (!r) return;
    const blob = await r.stop();
    recordNo.current += 1;
    await addSourceRef.current(t("studioMusic.recordingName", { n: recordNo.current }), await blob.arrayBuffer());
  };
  const record = async () => {
    if (recording) return stopRecording();
    setMessage(null);
    try {
      recorder.current = await startRecording(() => void stopRecording());
      setRecording(true);
    } catch (e) {
      setMessage({ tone: "error", text: t(MIC_MESSAGE[(e as MicError) ?? "FAILED"] ?? MIC_MESSAGE.FAILED) });
    }
  };

  // ── Playing ─────────────────────────────────────────────────────────────────
  const player = useRef<{ ctx: AudioContext; src: AudioBufferSourceNode; from: number; at: number; length: number } | null>(null);
  const [playing, setPlaying] = useState(false);
  /** 루프 재생: playback goes around the whole mix until 정지. */
  const [loop, setLoop] = useState(false);
  const loopRef = useRef(loop);
  useEffect(() => {
    loopRef.current = loop;
    if (player.current) player.current.src.loop = loop;
  }, [loop]);
  const stop = useCallback(() => {
    const p = player.current;
    player.current = null;
    setPlaying(false);
    if (p) {
      p.src.onended = null;
      p.src.stop();
      void p.ctx.close();
    }
  }, []);
  useEffect(() => stop, [stop]);
  useEffect(() => {
    if (!playing) return;
    let frame = requestAnimationFrame(function step() {
      const p = player.current;
      if (p) setPlayhead(playPosition(p.from, p.ctx.currentTime - p.at, p.length, loopRef.current));
      frame = requestAnimationFrame(step);
    });
    return () => cancelAnimationFrame(frame);
  }, [playing]);
  const play = async () => {
    if (playing) return stop();
    if (length === 0) return;
    if (length > MUSIC_LENGTH_MAX) return setMessage({ tone: "error", text: t("studioMusic.lengthMax", { max: MUSIC_LENGTH_MAX }) });
    setBusy(t("studioMusic.mixing"));
    try {
      const mix = await renderMix(tracks, buffers.current, 44_100);
      const ctx = new AudioContext();
      const src = ctx.createBufferSource();
      src.buffer = mix;
      src.connect(ctx.destination);
      src.loop = loop;
      src.loopStart = 0;
      src.loopEnd = mix.duration;
      const from = playhead >= length ? 0 : playhead;
      src.onended = () => {
        stop();
        setPlayhead(0);
      };
      src.start(0, from);
      player.current = { ctx, src, from, at: ctx.currentTime, length: mix.duration };
      setPlaying(true);
    } catch {
      setMessage({ tone: "error", text: t("studioMusic.playFailed") });
    } finally {
      setBusy(null);
    }
  };

  // ── Timeline editing ────────────────────────────────────────────────────────
  const drag = useRef<Drag | null>(null);
  const startDrag = (trackId: string, c: MusicClip, mode: Drag["mode"]) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setClipSel(c.id);
    setTrackSel(trackId);
    e.currentTarget.setPointerCapture(e.pointerId);
    remember();
    drag.current = { clipId: c.id, trackId, mode, x: e.clientX, clip: c };
  };
  const onDrag = (e: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const delta = (e.clientX - d.x) / pps;
    const duration = sourceOf(d.clip.sourceId)?.duration ?? clipLength(d.clip);
    editClip(d.clipId, () => (d.mode === "move" ? moveClip(d.clip, d.clip.start + delta) : trimClip(d.clip, d.mode, delta, duration)), false);
  };
  const endDrag = () => (drag.current = null);
  const nudge = (c: MusicClip) => (e: KeyboardEvent<HTMLElement>) => {
    const by = e.key === "ArrowLeft" ? -0.1 : e.key === "ArrowRight" ? 0.1 : 0;
    if (!by) return;
    e.preventDefault();
    editClip(c.id, (x) => moveClip(x, x.start + by * (e.shiftKey ? 10 : 1)));
  };
  const seek = (e: PointerEvent<HTMLElement>) => {
    if (playing) return;
    const box = e.currentTarget.getBoundingClientRect();
    setPlayhead(Math.max(0, Math.round(((e.clientX - box.left) / pps) * 100) / 100));
  };
  const split = () => {
    if (!selected) return;
    const parts = splitClip(selected.clip, playhead, newId("clip"));
    if (!parts) return setMessage({ tone: "error", text: t("studioMusic.splitOutside") });
    if (clipCount(tracks) >= MUSIC_CLIPS_MAX) return setMessage({ tone: "error", text: t("studioMusic.clipsMax", { max: MUSIC_CLIPS_MAX }) });
    edit((ts) => ts.map((tr) => ({ ...tr, clips: tr.clips.flatMap((c) => (c.id === selected.clip.id ? parts : [c])) })));
    setMessage(null);
  };
  const removeClip = () => {
    if (!selected) return;
    edit((ts) => ts.map((t) => ({ ...t, clips: t.clips.filter((c) => c.id !== selected.clip.id) })));
    setClipSel(null);
  };
  const [copied, setCopied] = useState<MusicClip | null>(null);
  const copy = () => {
    if (!selected) return;
    setCopied(selected.clip);
    setMessage({ tone: "ok", text: t("studioMusic.clipCopied") });
  };
  const paste = () => {
    const c = copied;
    if (!c) return;
    if (clipCount(tracks) >= MUSIC_CLIPS_MAX) return setMessage({ tone: "error", text: t("studioMusic.clipsMax", { max: MUSIC_CLIPS_MAX }) });
    const pasted = copyClip(c, newId("clip"), playhead);
    edit((ts) => ts.map((t) => (t.id === trackSel ? { ...t, clips: [...t.clips, pasted] } : t)));
    setClipSel(pasted.id);
    setMessage(null);
  };
  const addTrack = () => {
    if (tracks.length >= MUSIC_TRACKS_MAX) return;
    const track: MusicTrack = { id: newId("t"), name: t("studioMusic.trackName", { n: tracks.length + 1 }), gain: 1, muted: false, clips: [] };
    edit((ts) => [...ts, track]);
    setTrackSel(track.id);
  };
  const removeTrack = (id: string) => {
    if (tracks.length <= 1) return;
    edit((ts) => ts.filter((t) => t.id !== id));
    if (trackSel === id) setTrackSel(tracks.find((t) => t.id !== id)!.id);
    if (selected?.track.id === id) setClipSel(null);
  };

  // ── 단축키 (2026-10-28) ────────────────────────────────────────────────────────
  // Not while typing in a field (or an IME is composing); the handler reads this render's state.
  const commands = useRef<(e: globalThis.KeyboardEvent) => void>(() => {});
  useEffect(() => {
    commands.current = (e) => {
      const target = e.target as HTMLElement | null;
      if (e.isComposing || target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const command = musicCommandOf(e);
      if (!command || busy !== null) return;
      if (command === "PLAY" && target?.closest("button")) return; // Space on a focused button presses it
      e.preventDefault();
      if (command === "PLAY") void play();
      else if (command === "LOOP") setLoop((l) => !l);
      else if (playing) return;
      else if (command === "UNDO") undo();
      else if (command === "REDO") redo();
      else if (command === "SPLIT") split();
      else if (command === "COPY") copy();
      else if (command === "PASTE") paste();
      else if (command === "DELETE") removeClip();
    };
  });
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => commands.current(e);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Export ──────────────────────────────────────────────────────────────────
  const [name, setName] = useState(() => t("studioMusic.defaultName"));
  const [quality, setQuality] = useState<MusicQuality>("STANDARD");
  const sampleRate = MUSIC_QUALITIES.find((q) => q.key === quality)!.sampleRate;
  const size = wavBytes(length, sampleRate);
  const tooBig = size > ASSET_LIMITS.bytes.SOUND;
  const tooLong = length > MUSIC_LENGTH_MAX;
  const saveId = useRef<string | null>(null);
  const exportWav = async () => {
    const mix = await renderMix(tracks, buffers.current, sampleRate);
    return new Blob([encodeWav([mix.getChannelData(0)], sampleRate)], { type: "audio/wav" });
  };
  const save = async () => {
    const n = name.trim();
    if (!n) return setMessage({ tone: "error", text: t("studioMusic.nameRequired") });
    setBusy(t("studioMusic.saving"));
    setMessage(null);
    try {
      const wav = await exportWav();
      saveId.current ??= crypto.randomUUID();
      const form = new FormData();
      form.set("requestId", saveId.current);
      form.set("name", n);
      form.set("file", new File([wav], `${n}.wav`, { type: "audio/wav" }));
      const res = await uploadAsset(form);
      if (res.status === "SAVED") {
        saveId.current = null;
        setDirty(false);
        setMessage({ tone: "ok", text: t("studioMusic.savedToLibrary", { name: res.asset.name }), link: true });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/music");
      else {
        saveId.current = null;
        setMessage({ tone: "error", text: res.status === "INVALID" ? res.message : t("studioMusic.saveFailed") });
      }
    } catch {
      setMessage({ tone: "error", text: t("studioMusic.saveFailed") });
    } finally {
      setBusy(null);
    }
  };
  const download = async () => {
    setBusy(t("studioMusic.building"));
    try {
      const url = URL.createObjectURL(await exportWav());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.trim() || t("studioMusic.fileFallback")}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDirty(false);
    } catch {
      setMessage({ tone: "error", text: t("studioMusic.buildFailed") });
    } finally {
      setBusy(null);
    }
  };

  const seconds = Math.max(30, Math.ceil(length) + 5);
  const width = seconds * pps;
  const ticks = Array.from({ length: seconds + 1 }, (_, s) => s).filter((s) => s % (pps >= 40 ? 1 : pps >= 20 ? 2 : 5) === 0);
  const working = busy !== null;

  return (
    <div className={crew.content}>
      <header className={crew.header}>
        <h1 className={crew.title}>{t("studioMusic.title")}</h1>
        <p className={crew.subtitle}>{t("studioMusic.subtitle")}</p>
        <p className={crew.note}>
          {t("studioMusic.noteBefore")}
          <Link href="/creator/widgets/assets">{t("studioMusic.assetsLink")}</Link>
          {t("studioMusic.noteAfter")}
        </p>
      </header>

      {message && (
        <p className={message.tone === "ok" ? crew.ok : crew.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text} {message.link && <Link href="/creator/widgets/assets">{t("studioMusic.viewLibrary")}</Link>}
        </p>
      )}
      {busy && (
        <p className={crew.muted} role="status">
          {busy}
        </p>
      )}

      <section className={crew.card} aria-labelledby="music-add-title">
        <h2 id="music-add-title" className={crew.cardTitle}>
          {t("studioMusic.addTitle")} <span className={crew.muted}>→ {tracks.find((tr) => tr.id === trackSel)?.name} · {sec(playhead)}</span>
        </h2>
        <div className={local.addRow}>
          <select className={crew.select} aria-label={t("studioMusic.librarySound")} value={pick} onChange={(e) => setLibraryPick(e.target.value)} disabled={sounds.length === 0}>
            {sounds.length === 0 && <option value="">{t("studioMusic.libraryEmpty")}</option>}
            {sounds.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="button" className={crew.ghost} disabled={working || !pick} onClick={() => void addFromLibrary()}>
            {t("studioMusic.addFromLibrary")}
          </button>
          <button type="button" className={crew.ghost} disabled={working} onClick={() => fileInput.current?.click()}>
            {t("studioMusic.addFile")}
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            hidden
            aria-label={t("studioMusic.audioFile")}
            onChange={(e) => {
              void addFromFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button type="button" className={recording ? crew.danger : crew.ghost} disabled={working && !recording} onClick={() => void record()}>
            {recording ? t("studioMusic.stopRecording") : t("studioMusic.record")}
          </button>
        </div>
        <p className={crew.note}>{t("studioMusic.addNote", { mb: MUSIC_FILE_MAX / 1024 / 1024, sec: MUSIC_RECORD_MAX, count: clipCount(tracks), max: MUSIC_CLIPS_MAX })}</p>
      </section>

      <section className={crew.card} aria-labelledby="music-timeline-title">
        <div className={crew.cardHead}>
          <h2 id="music-timeline-title" className={crew.cardTitle}>
            {t("studioMusic.timeline")} <span className={crew.muted}>{sec(playhead)} / {sec(length)}</span>
          </h2>
          <div className={local.tools}>
            <button type="button" className={crew.primary} disabled={working || length === 0} onClick={() => void play()}>
              {playing ? t("studioMusic.stop") : t("studioMusic.play")}
            </button>
            <button type="button" className={crew.ghost} disabled={playing} onClick={() => setPlayhead(0)} aria-label={t("studioMusic.toStart")}>
              ⏮
            </button>
            <button type="button" className={crew.ghost} disabled={!selected || playing} onClick={split}>
              {t("studioMusic.split")}
            </button>
            <button type="button" className={crew.ghost} disabled={!selected || playing} onClick={removeClip}>
              {t("studioMusic.deleteClip")}
            </button>
            <button type="button" className={crew.ghost} disabled={!past.length || playing} onClick={undo} title="Ctrl+Z">
              {t("studioMusic.undo")}
            </button>
            <button type="button" className={crew.ghost} disabled={!future.length || playing} onClick={redo} title="Ctrl+Shift+Z">
              {t("studioMusic.redo")}
            </button>
            <button type="button" className={crew.ghost} disabled={!selected || playing} onClick={copy} title="Ctrl+C">
              {t("studioMusic.copy")}
            </button>
            <button type="button" className={crew.ghost} disabled={playing || copied === null} onClick={paste} title="Ctrl+V">
              {t("studioMusic.paste")}
            </button>
            <button type="button" className={crew.ghost} aria-pressed={loop} onClick={() => setLoop((l) => !l)} title="Ctrl+L">
              {loop ? t("studioMusic.loopOn") : t("studioMusic.loop")}
            </button>
            <button type="button" className={crew.ghost} aria-label={t("studioMusic.zoomOut")} disabled={pps <= PPS_STEPS[0]} onClick={() => setPps(PPS_STEPS[Math.max(0, PPS_STEPS.indexOf(pps) - 1)])}>
              −
            </button>
            <button type="button" className={crew.ghost} aria-label={t("studioMusic.zoomIn")} disabled={pps >= PPS_STEPS.at(-1)!} onClick={() => setPps(PPS_STEPS[Math.min(PPS_STEPS.length - 1, PPS_STEPS.indexOf(pps) + 1)])}>
              +
            </button>
          </div>
        </div>
        <p className={crew.note}>{t("studioMusic.shortcuts", { list: MUSIC_SHORTCUTS.map((s) => `${t(SHORTCUT_KEYS[s.command])} ${s.keys}`).join(" · ") })}</p>
        {tooLong && (
          <p className={crew.error} role="alert">
            {t("studioMusic.tooLong", { max: MUSIC_LENGTH_MAX, length: sec(length) })}
          </p>
        )}
        <div className={local.timeline}>
          <div className={local.heads}>
            <div className={local.rulerHead} />
            {tracks.map((tr) => (
              <div key={tr.id} className={local.trackHead} data-selected={trackSel === tr.id || undefined} onClick={() => setTrackSel(tr.id)}>
                <input className={local.trackName} aria-label={t("studioMusic.trackNameAria")} maxLength={12} value={tr.name} onChange={(e) => edit((ts) => ts.map((x) => (x.id === tr.id ? { ...x, name: e.target.value } : x)))} />
                <label className={local.trackGain}>
                  <span className={crew.muted}>{t("studioMusic.volume")}</span>
                  <input
                    type="range"
                    aria-label={t("studioMusic.trackVolumeAria", { name: tr.name })}
                    min={0}
                    max={MUSIC_GAIN_MAX * 100}
                    step={5}
                    value={Math.round(tr.gain * 100)}
                    onChange={(e) => edit((ts) => ts.map((x) => (x.id === tr.id ? { ...x, gain: Number(e.target.value) / 100 } : x)))}
                  />
                </label>
                <span className={local.trackButtons}>
                  <label className={crew.checkRow}>
                    <input type="checkbox" checked={tr.muted} onChange={(e) => edit((ts) => ts.map((x) => (x.id === tr.id ? { ...x, muted: e.target.checked } : x)))} />
                    {t("studioMusic.mute")}
                  </label>
                  <button type="button" className={local.mini} aria-label={t("studioMusic.trackRemoveAria", { name: tr.name })} disabled={tracks.length <= 1} onClick={() => removeTrack(tr.id)}>
                    ✕
                  </button>
                </span>
              </div>
            ))}
            <button type="button" className={`${crew.ghost} ${local.addTrack}`} disabled={tracks.length >= MUSIC_TRACKS_MAX} onClick={addTrack}>
              {t("studioMusic.addTrack")}
            </button>
          </div>
          <div className={local.scroll}>
            <div className={local.lanes} style={{ width }}>
              <div className={local.ruler} onPointerDown={seek}>
                {ticks.map((s) => (
                  <span key={s} style={{ left: s * pps }}>
                    {s}
                  </span>
                ))}
              </div>
              {tracks.map((tr) => (
                <div key={tr.id} className={local.lane} data-muted={tr.muted || undefined} data-selected={trackSel === tr.id || undefined} onPointerDown={(e) => {
                    setTrackSel(tr.id);
                    seek(e);
                  }}>
                  {tr.clips.map((c) => {
                    const src = sourceOf(c.sourceId);
                    const w = Math.max(6, clipLength(c) * pps);
                    const env = envelopes.current.get(c.sourceId);
                    const bars = env ? peaks(env, ENVELOPE_RATE, c.in, c.out, Math.max(4, Math.floor(w / 3))) : [];
                    return (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={clipSel === c.id}
                        aria-label={t("studioMusic.clipAria", { name: src?.name ?? t("studioMusic.clipFallback"), start: sec(c.start), length: sec(clipLength(c)) })}
                        className={local.clip}
                        style={{ left: c.start * pps, width: w }}
                        onPointerDown={startDrag(tr.id, c, "move")}
                        onPointerMove={onDrag}
                        onPointerUp={endDrag}
                        onPointerCancel={endDrag}
                        onKeyDown={nudge(c)}
                        onFocus={() => setClipSel(c.id)}
                      >
                        <svg className={local.wave} viewBox={`0 0 ${bars.length} 2`} preserveAspectRatio="none" aria-hidden>
                          {bars.map((b, i) => (
                            <rect key={i} x={i + 0.15} y={1 - b} width={0.7} height={Math.max(0.04, b * 2)} />
                          ))}
                        </svg>
                        {c.fadeIn > 0 && <span className={local.fadeIn} style={{ width: c.fadeIn * pps }} aria-hidden />}
                        {c.fadeOut > 0 && <span className={local.fadeOut} style={{ width: c.fadeOut * pps }} aria-hidden />}
                        <span className={local.clipName}>{src?.name}</span>
                        <span className={`${local.edge} ${local.edgeLeft}`} onPointerDown={startDrag(tr.id, c, "left")} onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag} aria-hidden />
                        <span className={`${local.edge} ${local.edgeRight}`} onPointerDown={startDrag(tr.id, c, "right")} onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag} aria-hidden />
                      </div>
                    );
                  })}
                </div>
              ))}
              <span className={local.playhead} style={{ left: playhead * pps }} aria-hidden />
            </div>
          </div>
        </div>
        {clipCount(tracks) === 0 && <p className={crew.empty}>{t("studioMusic.timelineEmpty")}</p>}
        <p className={crew.note}>{t("studioMusic.timelineHelp")}</p>
      </section>

      <section className={crew.card} aria-labelledby="music-clip-title">
        <h2 id="music-clip-title" className={crew.cardTitle}>
          {selected ? t("studioMusic.clipTitle", { name: sourceOf(selected.clip.sourceId)?.name ?? "" }) : t("studioMusic.selectedClip")}
        </h2>
        {!selected ? (
          <p className={crew.empty}>{t("studioMusic.pickClip")}</p>
        ) : (
          <div className={local.fields}>
            <NumberField label={t("studioMusic.startSec")} value={selected.clip.start} step={0.1} min={0} max={MUSIC_LENGTH_MAX} onChange={(v) => editClip(selected.clip.id, (c) => moveClip(c, v))} />
            <NumberField label={t("studioMusic.volumePct")} value={Math.round(selected.clip.gain * 100)} step={5} min={0} max={MUSIC_GAIN_MAX * 100} onChange={(v) => editClip(selected.clip.id, (c) => ({ ...c, gain: Math.min(MUSIC_GAIN_MAX, Math.max(0, v / 100)) }))} />
            <NumberField label={t("studioMusic.fadeIn")} value={selected.clip.fadeIn} step={0.1} min={0} max={clipLength(selected.clip)} onChange={(v) => editClip(selected.clip.id, (c) => fitFades({ ...c, fadeIn: v }))} />
            <NumberField label={t("studioMusic.fadeOut")} value={selected.clip.fadeOut} step={0.1} min={0} max={clipLength(selected.clip)} onChange={(v) => editClip(selected.clip.id, (c) => fitFades({ ...c, fadeOut: v }))} />
            <p className={crew.muted}>
              {t("studioMusic.clipInfo", {
                length: sec(clipLength(selected.clip)),
                start: sec(selected.clip.start),
                end: sec(clipEnd(selected.clip)),
                from: sec(selected.clip.in),
                to: sec(selected.clip.out)
              })}
            </p>
          </div>
        )}
      </section>

      <section className={crew.card} aria-labelledby="music-export-title">
        <h2 id="music-export-title" className={crew.cardTitle}>
          {t("studioMusic.save")}
        </h2>
        <div className={local.fields}>
          <label className={local.field}>
            <span className={crew.muted}>{t("studioMusic.name")}</span>
            <input className={crew.input} aria-label={t("studioMusic.nameAria")} maxLength={ASSET_LIMITS.nameMax} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className={local.field} role="group" aria-label={t("studioMusic.quality")}>
            <span className={crew.muted}>{t("studioMusic.quality")}</span>
            <span className={crew.segment}>
              {MUSIC_QUALITIES.map((q) => (
                <button key={q.key} type="button" aria-pressed={quality === q.key} onClick={() => setQuality(q.key)}>
                  {t(QUALITY_KEYS[q.key])}
                </button>
              ))}
            </span>
          </div>
        </div>
        <p className={tooBig ? crew.error : crew.note}>
          {t("studioMusic.wavInfo", { length: sec(length), mb: (size / 1024 / 1024).toFixed(2) })}
          {tooBig && t("studioMusic.tooBig", { max: ASSET_LIMITS.bytes.SOUND / 1024 / 1024 })}
        </p>
        <div className={crew.actions}>
          <button type="button" className={crew.ghost} disabled={working || length === 0 || tooLong} onClick={() => void download()}>
            {t("studioMusic.download")}
          </button>
          <button type="button" className={crew.primary} disabled={working || length === 0 || tooLong || tooBig} onClick={() => void save()}>
            {t("studioMusic.saveToLibrary")}
          </button>
        </div>
      </section>
    </div>
  );
}

/** A number input that applies a value as soon as it reads as a number. */
function NumberField({ label, value, step, min, max, onChange }: { label: string; value: number; step: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <label className={local.field}>
      <span className={crew.muted}>{label}</span>
      <input
        className={crew.inputSmall}
        type="number"
        inputMode="decimal"
        aria-label={label}
        step={step}
        min={min}
        max={max}
        value={Math.round(value * 100) / 100}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
    </label>
  );
}
