"use client";

import Image from "next/image";
import { formatNumber } from "@/lib/format";
import {
  RANKING_MAX_RANKS,
  RANKING_NAME_TYPES,
  RANKING_SPEEDS,
  RANKING_STYLES,
  RANKING_WIDGET_PERIODS,
  type RankTierStyle
} from "@/services/creator/widgetSettingsTypes";
import { ColorField, FontFields, NumberField, Preview, Radios, Row, Section, Select, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import { fontStyle } from "./previewStyle";
import styles from "./widgets.module.css";

const fill = (t: string, rank: number, name: string, amount: number) =>
  t.replaceAll("{rank}", String(rank)).replaceAll("{name}", name).replaceAll("{amount}", formatNumber(amount));

/** 후원랭킹 위젯 설정 — Figma 315:650. */
export function RankingForm({ value: v, onChange, live }: FormProps<"RANKING">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const rows = live.ranking.slice(0, v.ranks);

  return (
    <>
      <Preview light>
        <div className={`${styles.rankPreview} ${styles[`rank_${v.style}`]}`}>
          <strong style={fontStyle(v.titleFont)}>{v.title}</strong>
          <ol className={v.style === "SCROLL_TEXT" ? styles.rankScroll : undefined} style={{ gap: v.style === "SCROLL_TEXT" ? Math.min(v.scrollGap, 40) : undefined }}>
            {rows.map((r, i) => {
              const tier = i === 0 ? v.first : v.others;
              return (
                <li key={r.name} style={fontStyle(tier.font)}>
                  <span>{fill(v.format.rank, i + 1, r.name, r.amount)}</span>
                  <span style={{ color: tier.accentColor }}>{fill(v.format.name, i + 1, r.name, r.amount)}</span>
                  {v.showAmount && <span style={{ color: tier.accentColor }}>{fill(v.format.amount, i + 1, r.name, r.amount)}</span>}
                </li>
              );
            })}
          </ol>
        </div>
      </Preview>

      <Section title="기본 설정">
        <div className={styles.rows}>
          <Row label="위젯 스타일">
            <div className={styles.filterBox}>
              <Radios name="rank-style" label="위젯 스타일" options={RANKING_STYLES} value={v.style} onChange={(x) => set("style", x)} />
              <div className={styles.thumbs}>
                {RANKING_STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`${styles.thumb} ${v.style === s.key ? styles.thumbOn : ""}`}
                    aria-label={`${s.label} 스타일 선택`}
                    aria-pressed={v.style === s.key}
                    onClick={() => set("style", s.key)}
                  >
                    <Image src={s.image} alt="" width={120} height={69} />
                  </button>
                ))}
              </div>
            </div>
          </Row>
          <Row label="위젯 제목" htmlFor="rank-title">
            <input id="rank-title" className={styles.input} value={v.title} maxLength={20} onChange={(e) => set("title", e.target.value)} />
          </Row>
          <Row label="제목 폰트 설정">
            <FontFields label="제목" value={v.titleFont} onChange={(x) => set("titleFont", x)} />
          </Row>
          <Row label="표시할 이름 유형">
            <Radios name="rank-name" label="표시할 이름 유형" options={RANKING_NAME_TYPES} value={v.nameType} onChange={(x) => set("nameType", x)} />
          </Row>
          <Row label="산정 기간">
            <Select label="산정 기간" value={v.period} options={RANKING_WIDGET_PERIODS} width={140} onChange={(x) => set("period", x)} />
          </Row>
          <Row label="금액 표시하기">
            <SwitchText label="금액 표시하기" checked={v.showAmount} onChange={(x) => set("showAmount", x)} />
          </Row>
          <Row label="표시 등수">
            <NumberField label="표시 등수" value={v.ranks} max={RANKING_MAX_RANKS} suffix="등까지 공개" onChange={(x) => set("ranks", Math.max(1, x))} />
          </Row>
          <Row label="표시 메시지 설정">
            <div className={styles.inline}>
              {(["rank", "name", "amount"] as const).map((k) => (
                <input
                  key={k}
                  aria-label={`표시 메시지 ${k === "rank" ? "등수" : k === "name" ? "이름" : "금액"}`}
                  className={styles.input}
                  style={{ width: 120 }}
                  maxLength={20}
                  value={v.format[k]}
                  onChange={(e) => set("format", { ...v.format, [k]: e.target.value })}
                />
              ))}
            </div>
          </Row>
        </div>
      </Section>

      <Section title="스크롤 되는 텍스트 세부 설정">
        <div className={styles.rows}>
          <Row label="표시 간격(px)">
            <NumberField label="표시 간격" value={v.scrollGap} max={200} suffix="px" onChange={(x) => set("scrollGap", x)} />
          </Row>
          <Row label="흐르는 속도">
            <Radios name="rank-speed" label="흐르는 속도" options={RANKING_SPEEDS} value={v.scrollSpeed} onChange={(x) => set("scrollSpeed", x)} />
          </Row>
        </div>
      </Section>

      <TierSection title="1등 설정" value={v.first} onChange={(x) => set("first", x)} />
      <TierSection title="2등 이하 설정" value={v.others} onChange={(x) => set("others", x)} />
    </>
  );
}

function TierSection({ title, value, onChange }: { title: string; value: RankTierStyle; onChange: (v: RankTierStyle) => void }) {
  return (
    <Section title={title}>
      <div className={styles.rows}>
        <Row label="폰트 설정">
          <FontFields label={title} value={value.font} onChange={(font) => onChange({ ...value, font })} />
        </Row>
        <Row label="닉네임, 금액 컬러">
          <ColorField label={`${title} 강조 색상`} value={value.accentColor} onChange={(accentColor) => onChange({ ...value, accentColor })} />
        </Row>
      </div>
    </Section>
  );
}
