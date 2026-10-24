"use client";

import { useEffect, useRef, useState } from "react";
import { formatKstTime } from "@/lib/format";
import { claimBridgeRule, reportBridgeRule } from "@/services/creator/bridge";
import { BRIDGE_OUTCOME_LABEL, type BridgeData, type BridgeOutcome } from "@/services/creator/bridgeTypes";
import { useOverlayPage } from "../crew/CrewScoreOverlay";
import local from "./bridgeOverlay.module.css";

type Sent = { at: string; url: string; outcome: BridgeOutcome };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 외부 프로그램 연동 페이지 (`/overlay/bridge/[key]`, `?status` shows what it sends) — code-first. Kept open on the streaming
 * PC as an OBS browser source or a browser tab. Every refresh it reads the alert showing now and the rules it matches; for
 * each it claims the send (only the first page to ask gets it), waits the rule's 지연, sends the request from this PC and
 * reports whether it got through. The browser cannot read the program's answer (no-cors), only whether it connected; the
 * request carries no cookies and no Referer (the page's address holds the key). Nothing on screen without `?status`.
 */
export function BridgeOverlay({ overlayKey, data, status }: { overlayKey: string; data: BridgeData; status: boolean }) {
  useOverlayPage(data.reloadSeq);
  const handled = useRef<{ alertId: string | null; keys: Set<string> }>({ alertId: null, keys: new Set() });
  const [sent, setSent] = useState<Sent[]>([]);

  useEffect(() => {
    const event = data.event;
    if (!data.on || !event) return;
    // Only the alert showing now matters; the server keeps every claim, so forgetting older ones never resends.
    if (handled.current.alertId !== event.id) handled.current = { alertId: event.id, keys: new Set() };
    for (const ruleId of data.fire) {
      if (handled.current.keys.has(ruleId)) continue;
      handled.current.keys.add(ruleId);
      void (async () => {
        const claim = await claimBridgeRule(overlayKey, { alertId: event.id, ruleId });
        if (claim.status !== "FIRE") return;
        if (claim.delaySec > 0) await sleep(claim.delaySec * 1000);
        const { method, url, body } = claim.request;
        let outcome: BridgeOutcome = "SENT";
        try {
          await fetch(url, { method, body: method === "POST" ? body : undefined, mode: "no-cors", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
        } catch {
          outcome = "FAILED";
        }
        await reportBridgeRule(overlayKey, { claimId: claim.claimId, outcome });
        setSent((s) => [{ at: new Date().toISOString(), url, outcome }, ...s].slice(0, 8));
      })();
    }
  }, [data, overlayKey]);

  if (!status) return null;
  return (
    <div className={local.panel} role="status">
      <p className={local.head}>
        🔌 외부 프로그램 연동 · {data.on ? `켜진 규칙 ${data.rules}개 · 후원을 기다리는 중` : "리모컨에서 꺼져 있어요"}
      </p>
      {sent.length === 0 ? (
        <p className={local.empty}>이 페이지에서 보낸 요청이 아직 없어요.</p>
      ) : (
        <ol className={local.list}>
          {sent.map((s, i) => (
            <li key={`${s.at}-${i}`} data-outcome={s.outcome}>
              <span>{formatKstTime(s.at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
              <span className={local.url}>{s.url}</span>
              <b>{BRIDGE_OUTCOME_LABEL[s.outcome]}</b>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
