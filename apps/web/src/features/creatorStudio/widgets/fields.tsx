"use client";

import { useId, type ReactNode } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { FONT_FAMILIES, FONT_LEVELS, FONT_SIZES, isHexColor, type ColorFont, type FontFamily, type LeveledFont } from "@/services/creator/widgetSettingsTypes";
import styles from "./widgets.module.css";

/** Popup section title: 4×16 purple bar + 14px bold (Figma 372:7). */
export function Section({ title, children, aside }: { title: string; children: ReactNode; aside?: ReactNode }) {
  const id = useId();
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <h3 id={id} className={styles.sectionTitle}>
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Preview({ children, light = false }: { children: ReactNode; light?: boolean }) {
  return (
    <Section title="미리보기">
      <div className={`${styles.preview} ${light ? styles.previewLight : ""}`} aria-label="위젯 미리보기">
        {children}
      </div>
    </Section>
  );
}

/** Label-left row (140 / rest) used by 채팅창 · QR · 후원목표; `stacked` puts the label on top (후원누적금액). */
export function Row({ label, children, stacked = false, htmlFor }: { label: ReactNode; children: ReactNode; stacked?: boolean; htmlFor?: string }) {
  return (
    <div className={stacked ? styles.rowStacked : styles.row}>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={styles.rowLabel}>
          {label}
        </label>
      ) : (
        <span className={styles.rowLabel}>{label}</span>
      )}
      <div className={styles.rowControl}>{children}</div>
    </div>
  );
}

export function Radios<T extends string>({
  name,
  label,
  options,
  value,
  onChange
}: {
  name: string;
  label: string;
  options: readonly { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-label={label} className={styles.radios}>
      {options.map((o) => (
        <label key={o.key} className={styles.radio}>
          <input type="radio" name={`${name}-${id}`} checked={value === o.key} onChange={() => onChange(o.key)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}

export function Select<T extends string | number>({
  label,
  value,
  options,
  onChange,
  width,
  format
}: {
  label: string;
  value: T;
  options: readonly T[];
  onChange: (v: T) => void;
  width?: number;
  format?: (v: T) => string;
}) {
  return (
    <span className={styles.selectWrap} style={width ? { width } : undefined}>
      <select
        aria-label={label}
        className={styles.select}
        value={String(value)}
        onChange={(e) => onChange(options.find((o) => String(o) === e.target.value) ?? value)}
      >
        {options.map((o) => (
          <option key={String(o)} value={String(o)}>
            {format ? format(o) : String(o)}
          </option>
        ))}
      </select>
    </span>
  );
}

export function ColorField({ label, value, onChange, width = 160 }: { label: string; value: string; onChange: (v: string) => void; width?: number }) {
  const valid = isHexColor(value);
  return (
    <span className={`${styles.color} ${valid ? "" : styles.invalid}`} style={{ width }}>
      <input
        type="color"
        aria-label={`${label} 선택`}
        className={styles.swatch}
        value={valid ? value.toLowerCase() : "#000000"}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
      <input
        type="text"
        aria-label={label}
        aria-invalid={!valid || undefined}
        className={styles.hex}
        value={value}
        maxLength={7}
        spellCheck={false}
        onChange={(e) => {
          const v = e.target.value.trim();
          onChange(v.startsWith("#") ? v : `#${v}`);
        }}
      />
    </span>
  );
}

type FontValue = { family: FontFamily; size: number; color?: string };

export function FontFields<V extends FontValue>({ label, value, onChange }: { label: string; value: V; onChange: (v: V) => void }) {
  return (
    <div className={styles.inline}>
      <Select label={`${label} 서체`} value={value.family} options={FONT_FAMILIES} width={140} onChange={(family) => onChange({ ...value, family })} />
      <Select label={`${label} 크기`} value={value.size} options={FONT_SIZES} width={100} format={(s) => `${s}px`} onChange={(size) => onChange({ ...value, size })} />
      {value.color !== undefined && <ColorField label={`${label} 색상`} value={value.color} onChange={(color) => onChange({ ...value, color })} />}
    </div>
  );
}

/** Digits-only input kept as a number; `suffix` is the trailing unit text. */
export function NumberField({
  label,
  value,
  onChange,
  suffix,
  width = 80,
  max,
  grouped = false,
  id
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  width?: number;
  max?: number;
  grouped?: boolean;
  id?: string;
}) {
  return (
    <span className={styles.inline}>
      <input
        id={id}
        aria-label={id ? undefined : label}
        className={styles.input}
        style={{ width }}
        inputMode="numeric"
        value={grouped ? value.toLocaleString("ko-KR") : String(value)}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, "").slice(0, 10) || 0);
          onChange(max === undefined ? n : Math.min(n, max));
        }}
      />
      {suffix && <span className={styles.suffix}>{suffix}</span>}
    </span>
  );
}

export function SwitchText({ label, checked, onChange, text }: { label: string; checked: boolean; onChange: (v: boolean) => void; text?: string }) {
  return (
    <span className={styles.inline}>
      <Toggle label={label} checked={checked} onChange={onChange} />
      {text && <span className={styles.hint}>{text}</span>}
    </span>
  );
}

export function LeveledFontFields({ label, value, onChange }: { label: string; value: LeveledFont; onChange: (v: LeveledFont) => void }) {
  return (
    <div className={styles.inline}>
      <Select label={`${label} 서체`} value={value.family} options={FONT_FAMILIES} width={128} onChange={(family) => onChange({ ...value, family })} />
      <Select
        label={`${label} 크기`}
        value={value.level}
        options={FONT_LEVELS.map((l) => l.key)}
        width={140}
        format={(k) => FONT_LEVELS.find((l) => l.key === k)?.label ?? k}
        onChange={(level) => onChange({ ...value, level })}
      />
      <ColorField label={`${label} 색상`} value={value.color} width={130} onChange={(color) => onChange({ ...value, color })} />
    </div>
  );
}

export function ColorFontFields({ label, value, onChange }: { label: string; value: ColorFont; onChange: (v: ColorFont) => void }) {
  return (
    <div className={styles.inline}>
      <Select label={`${label} 서체`} value={value.family} options={FONT_FAMILIES} width={140} onChange={(family) => onChange({ ...value, family })} />
      <ColorField label={`${label} 색상`} value={value.color} onChange={(color) => onChange({ ...value, color })} />
    </div>
  );
}

export function PercentSlider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className={styles.slider}>
      <input type="range" aria-label={label} min={0} max={100} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <div className={styles.sliderScale} aria-hidden="true">
        <span>0%</span>
        <span>{value}%</span>
        <span>100%</span>
      </div>
    </div>
  );
}

/** Tip badge for fields whose rule the design explains only with a "?" icon. */
export function Help({ text }: { text: string }) {
  return (
    <span className={styles.help} title={text} aria-label={text} role="img">
      ?
    </span>
  );
}
