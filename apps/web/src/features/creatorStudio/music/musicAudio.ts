"use client";

import { MUSIC_RECORD_MAX, mixPlan, projectLength, type MusicTrack } from "./musicProject";

/**
 * 음악 편집기 audio (browser only, Web Audio): decoding a file into samples, mixing the tracks offline into one mono
 * buffer, and recording from the microphone. Nothing is sent anywhere until the creator saves the result.
 */

/** Waveform envelope resolution: peak values per second kept for drawing. */
export const ENVELOPE_RATE = 200;

/** The file's audio, decoded (any format the browser plays). Throws when it is not audio it can read. */
export async function decodeAudio(bytes: ArrayBuffer): Promise<AudioBuffer> {
  return new OfflineAudioContext(1, 1, 44_100).decodeAudioData(bytes);
}

/** A short peak envelope (ENVELOPE_RATE per second, channels mixed) for drawing the waveform without walking every sample. */
export function envelopeOf(buffer: AudioBuffer): Float32Array {
  const per = Math.max(1, Math.floor(buffer.sampleRate / ENVELOPE_RATE));
  const out = new Float32Array(Math.ceil(buffer.length / per));
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < data.length; i++) {
      const v = Math.abs(data[i]);
      const k = Math.floor(i / per);
      if (v > out[k]) out[k] = v;
    }
  }
  return out;
}

/** The tracks mixed into one mono buffer at `sampleRate`: every clip at its place, its piece, its fades and volumes. */
export async function renderMix(tracks: MusicTrack[], buffers: Map<string, AudioBuffer>, sampleRate: number): Promise<AudioBuffer> {
  const length = Math.max(1, Math.ceil(projectLength(tracks) * sampleRate));
  const ctx = new OfflineAudioContext(1, length, sampleRate);
  for (const p of mixPlan(tracks)) {
    const buffer = buffers.get(p.sourceId);
    if (!buffer) continue;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    const [a, b, c, d] = p.envelope;
    gain.gain.setValueAtTime(a.v, a.t);
    gain.gain.linearRampToValueAtTime(b.v, Math.max(a.t, b.t));
    gain.gain.setValueAtTime(c.v, c.t);
    gain.gain.linearRampToValueAtTime(d.v, Math.max(c.t, d.t));
    src.connect(gain).connect(ctx.destination);
    src.start(p.when, p.offset, p.duration);
  }
  return ctx.startRendering();
}

export type MicError = "DENIED" | "NO_MIC" | "FAILED";

/**
 * Starts recording from the microphone. `stop()` ends it and gives the recording; it also stops by itself after
 * MUSIC_RECORD_MAX seconds (then `onAutoStop` runs). Throws a MicError when the microphone cannot be used.
 */
export async function startRecording(onAutoStop: () => void): Promise<{ stop: () => Promise<Blob> }> {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw "FAILED" satisfies MicError;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    const name = (e as { name?: string })?.name;
    throw (name === "NotAllowedError" || name === "SecurityError" ? "DENIED" : name === "NotFoundError" ? "NO_MIC" : "FAILED") satisfies MicError;
  }
  const recorder = new MediaRecorder(stream);
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => chunks.push(e.data);
  const done = new Promise<Blob>((resolve) => {
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunks, { type: recorder.mimeType }));
    };
  });
  recorder.start();
  const timer = setTimeout(() => {
    if (recorder.state === "recording") {
      recorder.stop();
      onAutoStop();
    }
  }, MUSIC_RECORD_MAX * 1000);
  return {
    stop: () => {
      clearTimeout(timer);
      if (recorder.state === "recording") recorder.stop();
      return done;
    }
  };
}
