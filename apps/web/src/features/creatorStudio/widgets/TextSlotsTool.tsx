"use client";

import { useEffect, useState } from "react";
import { saveTextSlot } from "@/services/creator/broadcastTools";
import {
  TEXT_ALIGNS,
  TEXT_BACKGROUNDS,
  TEXT_LINE_HEIGHT,
  TEXT_OUTLINE_MAX,
  TEXT_PADDING_MAX,
  TEXT_RADIUS_MAX,
  TEXT_SCROLL_SEC,
  TEXT_SIZES,
  TEXT_SLOT_NAME_MAX,
  TEXT_SLOT_TEXT_MAX,
  type TextSlot,
  type ToolResult
} from "@/services/creator/broadcastToolTypes";
import { FONT_FAMILIES } from "@/services/creator/widgetSettingsTypes";
import { CopyButton } from "../settings/SettingsCards";
import styles from "../crew/crew.module.css";
import tools from "./broadcastTools.module.css";

type Run = (action: () => Promise<ToolResult>, ok?: string) => void;

/**
 * 텍스트 슬롯 (code-first, 2026-10-23 — StreamDonate 텍스트 오버레이 참고): pick one of the 20 slots, write its text and look,
 * save, and put that slot's own address (`?slot=N`) in OBS. Saving an empty text takes the slot off the stream. 스타일
 * (2026-10-28): 폰트 · 줄 간격 · 테두리 두께 · 색 · 그림자 · 색 지정 배경 (안쪽 여백 · 모서리).
 */
export function TextSlotsTool({ slots, overlayUrl, pending, run }: { slots: TextSlot[]; overlayUrl: (slot: number) => string; pending: boolean; run: Run }) {
  const [slot, setSlot] = useState(1);
  const [draft, setDraft] = useState<TextSlot>(slots[0]);
  const saved = slots[slot - 1];
  // Another slot (or a saved change from the server) refills the form.
  const savedJson = JSON.stringify(saved);
  useEffect(() => setDraft(JSON.parse(savedJson) as TextSlot), [slot, savedJson]);
  const set = <K extends keyof TextSlot>(k: K, v: TextSlot[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== savedJson;
  const save = (next: TextSlot, ok: string) => run(() => saveTextSlot({ slot, ...next }), ok);

  return (
    <div className={styles.startForm}>
      <div className={tools.slotChips} role="listbox" aria-label="텍스트 슬롯">
        {slots.map((x, i) => (
          <button key={i} type="button" role="option" aria-selected={slot === i + 1} className={tools.slotChip} data-filled={x.text ? "" : undefined} onClick={() => setSlot(i + 1)}>
            <b>#{i + 1}</b> {x.name || (x.text ? x.text.split("\n")[0].slice(0, 8) : "비어 있음")}
          </button>
        ))}
      </div>

      <div className={styles.addRow}>
        <input className={styles.input} aria-label="슬롯 이름" placeholder={`슬롯 이름 (관리용, 예: 공지 ${slot})`} maxLength={TEXT_SLOT_NAME_MAX} value={draft.name} onChange={(e) => set("name", e.target.value)} />
      </div>
      <textarea
        className={`${styles.input} ${styles.textarea}`}
        aria-label={`#${slot} 문구`}
        rows={4}
        maxLength={TEXT_SLOT_TEXT_MAX}
        placeholder="방송 화면에 띄울 문구 — 줄바꿈 그대로 보여요"
        value={draft.text}
        onChange={(e) => set("text", e.target.value)}
        style={{ fontWeight: draft.bold ? 800 : 500, textAlign: draft.align === "LEFT" ? "left" : draft.align === "RIGHT" ? "right" : "center" }}
      />

      <div className={tools.textLook}>
        <label className={tools.field}>
          <span className={styles.muted}>크기</span>
          <select className={styles.select} value={draft.size} onChange={(e) => set("size", Number(e.target.value))}>
            {TEXT_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
        </label>
        <label className={tools.field}>
          <span className={styles.muted}>글자색</span>
          <input type="color" className={tools.color} aria-label="글자색" value={draft.color} disabled={draft.background === "CARD"} onChange={(e) => set("color", e.target.value.toUpperCase())} />
        </label>
        <label className={tools.field}>
          <span className={styles.muted}>폰트</span>
          <select className={styles.select} aria-label="폰트" value={draft.font ?? ""} onChange={(e) => set("font", (FONT_FAMILIES.find((f) => f === e.target.value) ?? null) as TextSlot["font"])}>
            <option value="">테마 글꼴</option>
            {FONT_FAMILIES.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </label>
        <label className={tools.field}>
          <span className={styles.muted}>줄 간격</span>
          <input
            className={styles.inputSmall}
            type="number"
            step={0.05}
            min={TEXT_LINE_HEIGHT.min}
            max={TEXT_LINE_HEIGHT.max}
            aria-label="줄 간격"
            value={draft.lineHeight}
            onChange={(e) => set("lineHeight", Math.max(TEXT_LINE_HEIGHT.min, Math.min(TEXT_LINE_HEIGHT.max, Math.round((Number(e.target.value) || 1) * 100) / 100)))}
          />
        </label>
        <span className={styles.segment} role="group" aria-label="배경">
          {TEXT_BACKGROUNDS.map((x) => (
            <button key={x.key} type="button" aria-pressed={draft.background === x.key} onClick={() => set("background", x.key)}>
              {x.label}
            </button>
          ))}
        </span>
        {draft.background === "COLOR" && (
          <>
            <label className={tools.field}>
              <span className={styles.muted}>배경색</span>
              <input type="color" className={tools.color} aria-label="배경색" value={draft.bgColor} onChange={(e) => set("bgColor", e.target.value.toUpperCase())} />
            </label>
            <label className={tools.field}>
              <span className={styles.muted}>안쪽 여백</span>
              <input
                className={styles.inputSmall}
                type="number"
                min={0}
                max={TEXT_PADDING_MAX}
                aria-label="안쪽 여백(px)"
                value={draft.padding}
                onChange={(e) => set("padding", Math.max(0, Math.min(TEXT_PADDING_MAX, Math.trunc(Number(e.target.value) || 0))))}
              />
            </label>
            <label className={tools.field}>
              <span className={styles.muted}>모서리</span>
              <input
                className={styles.inputSmall}
                type="number"
                min={0}
                max={TEXT_RADIUS_MAX}
                aria-label="모서리 둥글기(px)"
                value={draft.radius}
                onChange={(e) => set("radius", Math.max(0, Math.min(TEXT_RADIUS_MAX, Math.trunc(Number(e.target.value) || 0))))}
              />
            </label>
          </>
        )}
        <span className={styles.segment} role="group" aria-label="정렬">
          {TEXT_ALIGNS.map((x) => (
            <button key={x.key} type="button" aria-pressed={draft.align === x.key} onClick={() => set("align", x.key)}>
              {x.label}
            </button>
          ))}
        </span>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.bold} onChange={(e) => set("bold", e.target.checked)} />
          굵게
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.outline} disabled={draft.background === "CARD"} onChange={(e) => set("outline", e.target.checked)} />
          글자 테두리
        </label>
        {draft.outline && draft.background !== "CARD" && (
          <>
            <label className={tools.field}>
              <input
                className={styles.inputSmall}
                type="number"
                min={1}
                max={TEXT_OUTLINE_MAX}
                aria-label="테두리 두께(px)"
                value={draft.outlineWidth}
                onChange={(e) => set("outlineWidth", Math.max(1, Math.min(TEXT_OUTLINE_MAX, Math.trunc(Number(e.target.value) || 1))))}
              />
              <span className={styles.muted}>px</span>
            </label>
            <input type="color" className={tools.color} aria-label="테두리 색" value={draft.outlineColor} onChange={(e) => set("outlineColor", e.target.value.toUpperCase())} />
          </>
        )}
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.shadow} onChange={(e) => set("shadow", e.target.checked)} />
          그림자
        </label>
        <label className={styles.checkRow}>
          <input type="checkbox" checked={draft.scroll} onChange={(e) => set("scroll", e.target.checked)} />
          세로 스크롤
        </label>
        {draft.scroll && (
          <label className={tools.field}>
            <input
              className={styles.inputSmall}
              type="number"
              min={TEXT_SCROLL_SEC.min}
              max={TEXT_SCROLL_SEC.max}
              aria-label="스크롤 한 바퀴 시간(초)"
              value={draft.scrollSec}
              onChange={(e) => set("scrollSec", Math.max(TEXT_SCROLL_SEC.min, Math.min(TEXT_SCROLL_SEC.max, Math.floor(Number(e.target.value) || TEXT_SCROLL_SEC.min))))}
            />
            <span className={styles.muted}>초에 한 바퀴</span>
          </label>
        )}
      </div>
      <p className={styles.note}>테마 카드는 방송 도구 테마의 카드와 글자색을 써요. 색 지정은 고른 배경색에 안쪽 여백 · 모서리를 줘요. 세로 스크롤은 아래에서 위로 끝없이 흘러요. 텍스트 슬롯은 기능 제어의 &quot;자막&quot; 스위치를 같이 써요.</p>

      <div className={styles.actions}>
        <span className={styles.muted}>{saved.text ? `#${slot} 방송 화면에 표시 중` : `#${slot} 비어 있음`}</span>
        <CopyButton value={overlayUrl(slot)} label={`#${slot} OBS 주소 복사`} className={styles.ghost} />
        <button type="button" className={styles.ghost} disabled={pending || !saved.text} onClick={() => save({ ...saved, text: "" }, `#${slot}을 비웠어요.`)}>
          비우기
        </button>
        <button type="button" className={styles.primary} disabled={pending || !dirty} onClick={() => save(draft, draft.text.trim() ? `#${slot}을 저장했어요.` : `#${slot}을 비웠어요.`)}>
          저장
        </button>
      </div>
    </div>
  );
}
