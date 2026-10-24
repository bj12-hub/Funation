"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { CustomCode } from "@/services/creator/customOverlayTypes";

/** A short stable key for `code`: a new key gives a fresh sandbox frame (its code is sent only once). */
export function codeKey(code: CustomCode) {
  let h = 7;
  for (const c of `${code.html}\u0000${code.css}\u0000${code.js}`) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${h.toString(36)}-${code.html.length + code.css.length + code.js.length}`;
}

/** Messages go to "*": an opaque origin has no name to target, and they carry only what the overlay shows on stream. */
const post = (frame: HTMLIFrameElement | null, message: unknown) => frame?.contentWindow?.postMessage(message, "*");

/**
 * The 커스텀 오버레이 handshake with a sandboxed frame (`sandbox="allow-scripts"`, opaque origin): when the frame says it is
 * ready, its code goes in once, then `send(type, data)` reaches the creator's `onData` (queued until then). Only messages
 * from this frame count, and once the frame has loaded a second page (the code navigated it away) nothing more is sent.
 * Render the frame with `key` so new code (or a new `run`, to start the same code over) gets a new frame.
 */
export function useSandbox(code: CustomCode | null, run = 0) {
  const frame = useRef<HTMLIFrameElement>(null);
  const ready = useRef(false);
  const loads = useRef(0);
  const queue = useRef<[string, unknown][]>([]);
  const key = useMemo(() => (code ? `${codeKey(code)}.${run}` : ""), [code, run]);
  const latest = useRef(code);
  useEffect(() => {
    latest.current = code;
  });

  useEffect(() => {
    ready.current = false;
    loads.current = 0;
    queue.current = [];
    const onMessage = (e: MessageEvent) => {
      const win = frame.current?.contentWindow;
      if (!win || e.source !== win || ready.current || (e.data as { type?: unknown } | null)?.type !== "ssumnation:ready") return;
      const c = latest.current;
      if (!c) return;
      ready.current = true;
      post(frame.current, { type: "ssumnation:code", html: c.html, css: c.css, js: c.js });
      for (const [event, data] of queue.current.splice(0)) post(frame.current, { type: "ssumnation:data", event, data });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [key]);

  const send = useCallback((event: string, data: unknown) => {
    if (loads.current > 1) return;
    if (ready.current) post(frame.current, { type: "ssumnation:data", event, data });
    else queue.current.push([event, data]);
  }, []);
  const onLoad = useCallback(() => {
    loads.current += 1;
  }, []);
  return { frame, key, send, onLoad };
}
