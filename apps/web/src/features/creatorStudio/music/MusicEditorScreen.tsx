"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
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
  formatSec,
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
  type MusicQuality,
  type MusicSource,
  type MusicTrack
} from "./musicProject";
import local from "./musicEditor.module.css";

type Drag = { clipId: string; trackId: string; mode: "move" | "left" | "right"; x: number; clip: MusicClip };
const PPS_STEPS = [10, 20, 40, 80, 160];
const MIC_MESSAGE: Record<MicError, string> = {
  DENIED: "마이크 권한이 필요해요. 브라우저 주소창의 권한 설정에서 마이크를 허용해 주세요.",
  NO_MIC: "마이크를 찾을 수 없어요. 연결을 확인해 주세요.",
  FAILED: "녹음하지 못했어요. 이 브라우저에서는 녹음을 지원하지 않을 수 있어요."
};
const newId = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;
const firstTrack = (): MusicTrack => ({ id: "t-1", name: "트랙 1", gain: 1, muted: false, clips: [] });

/**
 * 음악 편집기 — code-first (no Figma frame; StreamDonate "음악 제작" 참고, P3). Route `/creator/widgets/music`. Tracks (4)
 * of clips on one timeline: add audio from the 라이브러리, a file or 녹음 at the playhead on the chosen track; drag a clip to
 * move it, its edges to 트림; 분할 at the playhead; 볼륨 · 페이드 per clip, 볼륨 · 음소거 per track; 재생 from the playhead.
 * The mix (mono WAV) is saved to the 이미지·사운드 library or downloaded. All editing stays in this browser tab.
 * 2026-10-28 (StreamDonate 음악 제작): 되돌리기 · 다시 실행, 클립 복사 · 붙여넣기 (at the playhead, on the chosen track), 루프 재생
 * and their 단축키 (not while typing in a field).
 */
export function MusicEditorScreen({ sounds }: { sounds: Asset[] }) {
  const router = useRouter();
  const [sources, setSources] = useState<MusicSource[]>([]);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const envelopes = useRef(new Map<string, Float32Array>());
  const [tracks, setTracks] = useState<MusicTrack[]>(() => [firstTrack()]);
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
      setMessage({ tone: "error", text: `클립은 ${MUSIC_CLIPS_MAX}개까지 놓을 수 있어요.` });
      return;
    }
    setBusy("오디오를 읽고 있어요…");
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
      setMessage({ tone: "error", text: "이 파일은 읽을 수 없어요. MP3 · WAV · OGG 같은 오디오 파일을 골라 주세요." });
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
    setBusy("라이브러리에서 불러오는 중…");
    try {
      const res = await fetch(a.url);
      if (!res.ok) throw new Error(String(res.status));
      await addSource(a.name, await res.arrayBuffer());
    } catch {
      setBusy(null);
      setMessage({ tone: "error", text: "라이브러리 파일을 불러오지 못했어요. 잠시 후 다시 시도해 주세요." });
    }
  };
  const fileInput = useRef<HTMLInputElement>(null);
  const addFromFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MUSIC_FILE_MAX) {
      setMessage({ tone: "error", text: `파일은 ${MUSIC_FILE_MAX / 1024 / 1024}MB까지 불러올 수 있어요.` });
      return;
    }
    await addSource(file.name.replace(/\.[^.]+$/, "").slice(0, ASSET_LIMITS.nameMax) || "내 파일", await file.arrayBuffer());
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
    await addSourceRef.current(`녹음 ${recordNo.current}`, await blob.arrayBuffer());
  };
  const record = async () => {
    if (recording) return stopRecording();
    setMessage(null);
    try {
      recorder.current = await startRecording(() => void stopRecording());
      setRecording(true);
    } catch (e) {
      setMessage({ tone: "error", text: MIC_MESSAGE[(e as MicError) ?? "FAILED"] ?? MIC_MESSAGE.FAILED });
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
    if (length > MUSIC_LENGTH_MAX) return setMessage({ tone: "error", text: `음악은 ${MUSIC_LENGTH_MAX}초까지 만들 수 있어요. 클립을 줄이거나 옮겨 주세요.` });
    setBusy("재생할 소리를 섞는 중…");
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
      setMessage({ tone: "error", text: "재생하지 못했어요. 잠시 후 다시 시도해 주세요." });
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
    if (!parts) return setMessage({ tone: "error", text: "재생 위치를 고른 클립 안에 두고 분할해 주세요." });
    if (clipCount(tracks) >= MUSIC_CLIPS_MAX) return setMessage({ tone: "error", text: `클립은 ${MUSIC_CLIPS_MAX}개까지 놓을 수 있어요.` });
    edit((ts) => ts.map((t) => ({ ...t, clips: t.clips.flatMap((c) => (c.id === selected.clip.id ? parts : [c])) })));
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
    setMessage({ tone: "ok", text: "클립을 복사했어요. 재생 위치에 붙여넣을 수 있어요." });
  };
  const paste = () => {
    const c = copied;
    if (!c) return;
    if (clipCount(tracks) >= MUSIC_CLIPS_MAX) return setMessage({ tone: "error", text: `클립은 ${MUSIC_CLIPS_MAX}개까지 놓을 수 있어요.` });
    const pasted = copyClip(c, newId("clip"), playhead);
    edit((ts) => ts.map((t) => (t.id === trackSel ? { ...t, clips: [...t.clips, pasted] } : t)));
    setClipSel(pasted.id);
    setMessage(null);
  };
  const addTrack = () => {
    if (tracks.length >= MUSIC_TRACKS_MAX) return;
    const t: MusicTrack = { id: newId("t"), name: `트랙 ${tracks.length + 1}`, gain: 1, muted: false, clips: [] };
    edit((ts) => [...ts, t]);
    setTrackSel(t.id);
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
  const [name, setName] = useState("편집한 음악");
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
    if (!n) return setMessage({ tone: "error", text: "이름을 입력해 주세요." });
    setBusy("저장하는 중…");
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
        setMessage({ tone: "ok", text: `'${res.asset.name}' 파일을 라이브러리에 저장했어요. 시그니처 · 알림 소리로 고를 수 있어요.`, link: true });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/music");
      else {
        saveId.current = null;
        setMessage({ tone: "error", text: res.status === "INVALID" ? res.message : "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    } catch {
      setMessage({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
    } finally {
      setBusy(null);
    }
  };
  const download = async () => {
    setBusy("파일을 만드는 중…");
    try {
      const url = URL.createObjectURL(await exportWav());
      const a = document.createElement("a");
      a.href = url;
      a.download = `${name.trim() || "음악"}.wav`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setDirty(false);
    } catch {
      setMessage({ tone: "error", text: "파일을 만들지 못했어요. 잠시 후 다시 시도해 주세요." });
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
        <h1 className={crew.title}>음악 편집기</h1>
        <p className={crew.subtitle}>시그니처 · 알림 소리를 직접 다듬어요. 여러 트랙에 오디오를 놓고 자르고 이어 붙여 하나로 섞어요.</p>
        <p className={crew.note}>
          편집은 이 브라우저 안에서만 해요. 페이지를 떠나면 편집 내용은 사라지고, 저장한 결과만 <Link href="/creator/widgets/assets">이미지·사운드</Link> 라이브러리에 남아요.
        </p>
      </header>

      {message && (
        <p className={message.tone === "ok" ? crew.ok : crew.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text} {message.link && <Link href="/creator/widgets/assets">라이브러리 보기</Link>}
        </p>
      )}
      {busy && (
        <p className={crew.muted} role="status">
          {busy}
        </p>
      )}

      <section className={crew.card} aria-labelledby="music-add-title">
        <h2 id="music-add-title" className={crew.cardTitle}>
          오디오 추가 <span className={crew.muted}>→ {tracks.find((t) => t.id === trackSel)?.name} · {formatSec(playhead)}</span>
        </h2>
        <div className={local.addRow}>
          <select className={crew.select} aria-label="라이브러리 사운드" value={pick} onChange={(e) => setLibraryPick(e.target.value)} disabled={sounds.length === 0}>
            {sounds.length === 0 && <option value="">라이브러리에 사운드가 없어요</option>}
            {sounds.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button type="button" className={crew.ghost} disabled={working || !pick} onClick={() => void addFromLibrary()}>
            라이브러리에서 추가
          </button>
          <button type="button" className={crew.ghost} disabled={working} onClick={() => fileInput.current?.click()}>
            내 파일 추가
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="audio/*"
            hidden
            aria-label="오디오 파일"
            onChange={(e) => {
              void addFromFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <button type="button" className={recording ? crew.danger : crew.ghost} disabled={working && !recording} onClick={() => void record()}>
            {recording ? "■ 녹음 멈추기" : "● 녹음"}
          </button>
        </div>
        <p className={crew.note}>
          고른 트랙의 재생 위치에 놓여요. 파일은 {MUSIC_FILE_MAX / 1024 / 1024}MB까지, 녹음은 {MUSIC_RECORD_MAX}초까지예요. 클립 {clipCount(tracks)} / {MUSIC_CLIPS_MAX}
        </p>
      </section>

      <section className={crew.card} aria-labelledby="music-timeline-title">
        <div className={crew.cardHead}>
          <h2 id="music-timeline-title" className={crew.cardTitle}>
            타임라인 <span className={crew.muted}>{formatSec(playhead)} / {formatSec(length)}</span>
          </h2>
          <div className={local.tools}>
            <button type="button" className={crew.primary} disabled={working || length === 0} onClick={() => void play()}>
              {playing ? "■ 정지" : "▶ 재생"}
            </button>
            <button type="button" className={crew.ghost} disabled={playing} onClick={() => setPlayhead(0)} aria-label="처음으로">
              ⏮
            </button>
            <button type="button" className={crew.ghost} disabled={!selected || playing} onClick={split}>
              분할
            </button>
            <button type="button" className={crew.ghost} disabled={!selected || playing} onClick={removeClip}>
              클립 삭제
            </button>
            <button type="button" className={crew.ghost} disabled={!past.length || playing} onClick={undo} title="Ctrl+Z">
              되돌리기
            </button>
            <button type="button" className={crew.ghost} disabled={!future.length || playing} onClick={redo} title="Ctrl+Shift+Z">
              다시 실행
            </button>
            <button type="button" className={crew.ghost} disabled={!selected || playing} onClick={copy} title="Ctrl+C">
              복사
            </button>
            <button type="button" className={crew.ghost} disabled={playing || copied === null} onClick={paste} title="Ctrl+V">
              붙여넣기
            </button>
            <button type="button" className={crew.ghost} aria-pressed={loop} onClick={() => setLoop((l) => !l)} title="Ctrl+L">
              {loop ? "🔁 루프 켬" : "🔁 루프"}
            </button>
            <button type="button" className={crew.ghost} aria-label="축소" disabled={pps <= PPS_STEPS[0]} onClick={() => setPps(PPS_STEPS[Math.max(0, PPS_STEPS.indexOf(pps) - 1)])}>
              −
            </button>
            <button type="button" className={crew.ghost} aria-label="확대" disabled={pps >= PPS_STEPS.at(-1)!} onClick={() => setPps(PPS_STEPS[Math.min(PPS_STEPS.length - 1, PPS_STEPS.indexOf(pps) + 1)])}>
              +
            </button>
          </div>
        </div>
        <p className={crew.note}>단축키 · {MUSIC_SHORTCUTS.map((s) => `${s.label} ${s.keys}`).join(" · ")} (입력 칸에서는 꺼져요)</p>
        {tooLong && (
          <p className={crew.error} role="alert">
            음악은 {MUSIC_LENGTH_MAX}초까지 만들 수 있어요. 지금 {formatSec(length)} — 클립을 줄이거나 옮겨 주세요.
          </p>
        )}
        <div className={local.timeline}>
          <div className={local.heads}>
            <div className={local.rulerHead} />
            {tracks.map((t) => (
              <div key={t.id} className={local.trackHead} data-selected={trackSel === t.id || undefined} onClick={() => setTrackSel(t.id)}>
                <input className={local.trackName} aria-label="트랙 이름" maxLength={12} value={t.name} onChange={(e) => edit((ts) => ts.map((x) => (x.id === t.id ? { ...x, name: e.target.value } : x)))} />
                <label className={local.trackGain}>
                  <span className={crew.muted}>볼륨</span>
                  <input
                    type="range"
                    aria-label={`${t.name} 볼륨`}
                    min={0}
                    max={MUSIC_GAIN_MAX * 100}
                    step={5}
                    value={Math.round(t.gain * 100)}
                    onChange={(e) => edit((ts) => ts.map((x) => (x.id === t.id ? { ...x, gain: Number(e.target.value) / 100 } : x)))}
                  />
                </label>
                <span className={local.trackButtons}>
                  <label className={crew.checkRow}>
                    <input type="checkbox" checked={t.muted} onChange={(e) => edit((ts) => ts.map((x) => (x.id === t.id ? { ...x, muted: e.target.checked } : x)))} />
                    음소거
                  </label>
                  <button type="button" className={local.mini} aria-label={`${t.name} 삭제`} disabled={tracks.length <= 1} onClick={() => removeTrack(t.id)}>
                    ✕
                  </button>
                </span>
              </div>
            ))}
            <button type="button" className={`${crew.ghost} ${local.addTrack}`} disabled={tracks.length >= MUSIC_TRACKS_MAX} onClick={addTrack}>
              + 트랙
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
              {tracks.map((t) => (
                <div key={t.id} className={local.lane} data-muted={t.muted || undefined} data-selected={trackSel === t.id || undefined} onPointerDown={(e) => {
                    setTrackSel(t.id);
                    seek(e);
                  }}>
                  {t.clips.map((c) => {
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
                        aria-label={`${src?.name ?? "클립"} — ${formatSec(c.start)}부터 ${formatSec(clipLength(c))}`}
                        className={local.clip}
                        style={{ left: c.start * pps, width: w }}
                        onPointerDown={startDrag(t.id, c, "move")}
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
                        <span className={`${local.edge} ${local.edgeLeft}`} onPointerDown={startDrag(t.id, c, "left")} onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag} aria-hidden />
                        <span className={`${local.edge} ${local.edgeRight}`} onPointerDown={startDrag(t.id, c, "right")} onPointerMove={onDrag} onPointerUp={endDrag} onPointerCancel={endDrag} aria-hidden />
                      </div>
                    );
                  })}
                </div>
              ))}
              <span className={local.playhead} style={{ left: playhead * pps }} aria-hidden />
            </div>
          </div>
        </div>
        {clipCount(tracks) === 0 && <p className={crew.empty}>아직 오디오가 없어요. 위에서 라이브러리 · 내 파일 · 녹음으로 추가해 보세요.</p>}
        <p className={crew.note}>
          눈금(초)이나 빈 곳을 눌러 재생 위치를 정해요. 클립을 끌어 옮기고, 양 끝을 끌어 앞뒤를 잘라요(트림). 고른 클립은 ← → 로 0.1초(Shift 1초)씩 옮겨요.
        </p>
      </section>

      <section className={crew.card} aria-labelledby="music-clip-title">
        <h2 id="music-clip-title" className={crew.cardTitle}>
          {selected ? `클립 · ${sourceOf(selected.clip.sourceId)?.name ?? ""}` : "고른 클립"}
        </h2>
        {!selected ? (
          <p className={crew.empty}>타임라인에서 클립을 골라 주세요.</p>
        ) : (
          <div className={local.fields}>
            <NumberField label="시작 (초)" value={selected.clip.start} step={0.1} min={0} max={MUSIC_LENGTH_MAX} onChange={(v) => editClip(selected.clip.id, (c) => moveClip(c, v))} />
            <NumberField label="볼륨 (%)" value={Math.round(selected.clip.gain * 100)} step={5} min={0} max={MUSIC_GAIN_MAX * 100} onChange={(v) => editClip(selected.clip.id, (c) => ({ ...c, gain: Math.min(MUSIC_GAIN_MAX, Math.max(0, v / 100)) }))} />
            <NumberField label="페이드 인 (초)" value={selected.clip.fadeIn} step={0.1} min={0} max={clipLength(selected.clip)} onChange={(v) => editClip(selected.clip.id, (c) => fitFades({ ...c, fadeIn: v }))} />
            <NumberField label="페이드 아웃 (초)" value={selected.clip.fadeOut} step={0.1} min={0} max={clipLength(selected.clip)} onChange={(v) => editClip(selected.clip.id, (c) => fitFades({ ...c, fadeOut: v }))} />
            <p className={crew.muted}>
              길이 {formatSec(clipLength(selected.clip))} · {formatSec(selected.clip.start)} ~ {formatSec(clipEnd(selected.clip))} · 원본의 {formatSec(selected.clip.in)} ~ {formatSec(selected.clip.out)}
            </p>
          </div>
        )}
      </section>

      <section className={crew.card} aria-labelledby="music-export-title">
        <h2 id="music-export-title" className={crew.cardTitle}>
          저장
        </h2>
        <div className={local.fields}>
          <label className={local.field}>
            <span className={crew.muted}>이름</span>
            <input className={crew.input} aria-label="저장할 이름" maxLength={ASSET_LIMITS.nameMax} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <div className={local.field} role="group" aria-label="음질">
            <span className={crew.muted}>음질</span>
            <span className={crew.segment}>
              {MUSIC_QUALITIES.map((q) => (
                <button key={q.key} type="button" aria-pressed={quality === q.key} onClick={() => setQuality(q.key)}>
                  {q.label}
                </button>
              ))}
            </span>
          </div>
        </div>
        <p className={tooBig ? crew.error : crew.note}>
          모노 WAV · {formatSec(length)} · 약 {(size / 1024 / 1024).toFixed(2)}MB
          {tooBig && ` — 라이브러리 사운드는 ${ASSET_LIMITS.bytes.SOUND / 1024 / 1024}MB까지예요. 길이를 줄이거나 '작게'를 골라 주세요.`}
        </p>
        <div className={crew.actions}>
          <button type="button" className={crew.ghost} disabled={working || length === 0 || tooLong} onClick={() => void download()}>
            WAV 내려받기
          </button>
          <button type="button" className={crew.primary} disabled={working || length === 0 || tooLong || tooBig} onClick={() => void save()}>
            라이브러리에 저장
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
