import type { CSSProperties } from "react";
import { OverlayThemeRoot, ov } from "@/features/overlayTheme/OverlayThemeRoot";
import { ROLE_LABEL, type ChatOverlayLine } from "@/services/broadcast/chatTypes";
import { leaveForEffect, motionForEffect, nameColor, readableInk, type ResolvedTheme } from "@/services/creator/overlayThemeTypes";
import type { ChatSettings } from "@/services/creator/widgetSettingsTypes";
import { PlatformMark } from "./PlatformMark";
import c from "./chatLines.module.css";

/** How long a line takes to leave once 자동으로 감추기 time is up (the overlay ticks every second). */
export const CHAT_LEAVE_MS = 900;

/**
 * 통합 채팅 lines in the 채팅창 widget settings (code-first, 2026-10-08 오버레이 테마): 위젯 스타일 × theme, 폰트,
 * 닉네임 컬러 · 배경, 최대 줄, 자동으로 감추기 and the In/Out effects. Drawn by the OBS overlay and, with sample
 * lines, by the 채팅창 settings preview. `now` (server time) null = nothing hides (the preview).
 */
export function ChatLines({ lines, settings: s, theme, now }: { lines: ChatOverlayLine[]; settings: ChatSettings; theme: ResolvedTheme; now: number | null }) {
  const shown = lines
    .slice(-s.maxLines)
    .map((l) => ({ l, age: now === null || !s.autoHide ? 0 : now - Date.parse(l.at) }))
    .filter(({ age }) => age < s.hideAfterSec * 1000 + CHAT_LEAVE_MS);
  const boxed = s.style !== "LINE_PLAIN";
  const panel = s.style === "BOX_SIMPLE" || s.style === "BOX_ALIGNED";
  const motion = motionForEffect(s.effectIn);
  const leave = leaveForEffect(s.effectOut);

  const items = shown.map(({ l, age }) => {
    // 닉네임 컬러: one color per name (크리에이터 지정 고유 컬러) or the theme's accent; 닉네임 배경 for dark ones or always.
    const color = s.creatorNicknameColor ? nameColor(l.name) : theme.accent;
    const ink = readableInk(color);
    const nameBg = s.nicknameBackground === "ALWAYS" || (s.nicknameBackground === "DARK_ONLY" && ink === "#FFFFFF");
    return (
      <li
        key={l.id}
        className={`${ov.enter} ${c.line} ${boxed && !panel ? ov.card : ""}`}
        data-motion={motion}
        data-leave={age >= s.hideAfterSec * 1000 ? leave : undefined}
        style={{ "--name": color, "--name-ink": ink } as CSSProperties}
      >
        <span className={c.head}>
          {!s.hidePlatformIcon && <PlatformMark platform={l.platform} size="sm" />}
          <span className={c.name} data-bg={nameBg || undefined}>
            {l.name}
          </span>
          {l.roles
            .filter((r) => r !== "MEMBER")
            .map((r) => (
              <span key={r} className={`${ov.chip} ${c.role}`}>
                {ROLE_LABEL[r]}
              </span>
            ))}
        </span>
        <span className={c.text}>{l.text}</span>
      </li>
    );
  });

  return (
    <OverlayThemeRoot
      theme={theme}
      as="ol"
      className={`${c.list} ${panel && shown.length > 0 ? ov.card : ""}`}
      data-style={s.style}
      aria-live="polite"
      aria-label="통합 채팅"
      style={{ fontSize: s.font.size, fontFamily: `"${s.font.family}", var(--ov-body-font)`, "--chat-color": s.font.color } as CSSProperties}
    >
      {items}
    </OverlayThemeRoot>
  );
}
