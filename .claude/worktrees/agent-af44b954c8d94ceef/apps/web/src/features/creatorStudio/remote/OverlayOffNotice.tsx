"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setOverlaySwitch } from "@/services/creator/alertRemote";
import { offOverlayTargets, type OverlayTarget } from "@/services/creator/alertTypes";
import styles from "../crew/crew.module.css";
import local from "./overlayOffNotice.module.css";

/**
 * Shown above a studio page whose OBS overlay is switched OFF in the 리모컨 기능 제어 (code-first): the
 * creator sees at once why nothing appears on stream, and can switch it back on here. Nothing renders
 * while every listed overlay is ON.
 */
export function OverlayOffNotice({ targets, switches }: { targets: OverlayTarget[]; switches: Record<OverlayTarget, boolean> }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const off = offOverlayTargets(switches, targets);
  if (off.length === 0) return null;

  const turnOn = () =>
    startTransition(async () => {
      setError(null);
      for (const t of off) {
        const res = await setOverlaySwitch({ target: t.key, on: true });
        if (res.status !== "SAVED") {
          setError(res.status === "INVALID" ? res.message : "다시 로그인해 주세요.");
          return;
        }
      }
      router.refresh();
    });

  return (
    <div className={local.wrap}>
      <div className={local.box} role="status">
        <span>
          <strong>{off.map((t) => t.label).join(", ")}</strong> 오버레이가 리모컨 기능 제어에서 꺼져 있어요. OBS 소스는 그대로지만 방송 화면에 나오지 않아요.{" "}
          <Link href="/creator/remote#switch-title">리모컨에서 보기</Link>
        </span>
        <button type="button" className={styles.primary} disabled={pending} onClick={turnOn}>
          켜기
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
