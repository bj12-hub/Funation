"use client";

import Image from "next/image";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import {
  RANKING_BOARDS,
  RANKING_MAX_RANKS,
  RANKING_NAME_TYPES,
  RANKING_SPEEDS,
  RANKING_STYLES,
  RANKING_WIDGET_PERIODS,
  type RankTierStyle
} from "@/services/creator/widgetSettingsTypes";
import { ColorField, FontFields, NumberField, Radios, Row, Section, Select, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import styles from "./widgets.module.css";
import { RankingView } from "./WidgetViews";

/** 후원랭킹 위젯 설정 — Figma 315:650. 랭킹 종류 (크루 후원 순위 · 수단별 보드) is code-first (2026-10-06). */
export function RankingForm({ value: v, onChange, live }: FormProps<"RANKING">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const source: { name: string; amount: number; amountLabel?: string }[] = v.board === "CREW" ? live.crewRanking[v.period] : v.board === "SOURCE" ? live.sourceBoard : live.ranking;
  const rows = source.slice(0, v.ranks);

  return (
    <>
      <Section title="미리보기">
        <PreviewStage width={400} minHeight={200} label="후원랭킹 미리보기">
          <RankingView
            settings={v}
            rows={rows.map((r, i) => ({ rank: i + 1, name: r.name, fnAmount: r.amount, amountLabel: r.amountLabel }))}
            theme={resolveTheme(live.appearance, v.theme)}
            empty="이 기간에 크루 멤버에게 지정된 후원이 아직 없어요."
          />
        </PreviewStage>
      </Section>
      <Section title="테마">
        <div className={styles.rows}>
          <ThemeChoiceField value={v.theme} onChange={(x) => set("theme", x)} appearance={live.appearance} />
          <SwitchText label="배경 카드" checked={v.card} onChange={(x) => set("card", x)} text="테마 카드 위에 순위 배지와 함께 그려요. 끄면 글자만 (아래 1등 · 2등 이하 색 사용)" />
        </div>
      </Section>

      <Section title="기본 설정">
        <div className={styles.rows}>
          <Row label="랭킹 종류">
            <Radios name="rank-board" label="랭킹 종류" options={RANKING_BOARDS} value={v.board} onChange={(x) => set("board", x)} />
          </Row>
          {v.board !== "DONOR" && (
            <p className={styles.hint}>
              {v.board === "CREW"
                ? "크루 멤버에게 지정된 후원(멤버 지정)을 멤버별로 합쳐 순위를 보여 줘요."
                : "썸네이션 FN과 플랫폼 후원을 수단마다 그 단위로 합쳐 후원 건수가 많은 순으로 보여 줘요. 금액 표시 형식 대신 각 단위가 그대로 나와요."}
            </p>
          )}
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
