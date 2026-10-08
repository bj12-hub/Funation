"use client";

import type { CSSProperties } from "react";
import { formatNumber } from "@/lib/format";
import { PRIZE_MAX, QUEST_STYLES, type ColorFont } from "@/services/creator/widgetSettingsTypes";
import { ColorFontFields, Help, NumberField, Preview, Radios, Row, Section, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import styles from "./widgets.module.css";

const cf = (f: ColorFont, size = 15): CSSProperties => ({ fontFamily: `"${f.family}", var(--font-sans)`, fontSize: size, color: f.color });
// ── 퀘스트 (373:1598) ──────────────────────────────────────────────────────────

const AUTHORITY_TABLE = [
  ["성공결정권한 메뉴노출 ON", "성공결정권한 ON", "크리에이터/도네이터 둘다"],
  ["성공결정권한 메뉴노출 ON", "성공결정권한 OFF", "도네이터만 가능"],
  ["성공결정권한 메뉴노출 OFF", "-", "크리에이터/도네이터 둘다"]
];

export function QuestForm({ value: v, onChange }: FormProps<"QUEST">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const prize = Math.max(3_000, v.minAmount);

  return (
    <>
      <Preview>
        <div className={v.style === "FANCY" ? styles.questFancy : styles.questSimple} style={{ opacity: v.enabled ? 1 : 0.4 }}>
          {v.style === "FANCY" && <span className={styles.questBadge}>QUEST</span>}
          <strong style={cf(v.titleFont, 18)}>노래 한 곡 불러주세요</strong>
          <div className={styles.questMeta}>
            <span style={cf(v.timeFont, 13)}>남은시간 04:59</span>
            <span style={cf(v.prizeFont, 13)}>상금 {formatNumber(prize)}FN</span>
          </div>
        </div>
      </Preview>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <Row label="사용하기">
            <SwitchText label="퀘스트 위젯 사용하기" checked={v.enabled} onChange={(x) => set("enabled", x)} />
          </Row>
          <Row label="위젯 스타일">
            <div className={styles.filterBox}>
              <Radios name="quest-style" label="위젯 스타일" options={QUEST_STYLES} value={v.style} onChange={(x) => set("style", x)} />
              <div className={styles.questThumbs}>
                {QUEST_STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={v.style === s.key}
                    aria-label={`${s.label} 스타일 선택`}
                    className={`${s.key === "FANCY" ? styles.questThumbFancy : styles.questThumbSimple} ${v.style === s.key ? styles.thumbOn : ""}`}
                    onClick={() => set("style", s.key)}
                  >
                    <b>QUEST</b>
                    {s.key === "FANCY" ? "화려한 이펙트형" : "깔끔한 텍스트형"}
                  </button>
                ))}
              </div>
            </div>
          </Row>
          <Row label="미션 확인 및 수락">
            <span className={styles.inline}>
              <span className={styles.remoteChip}>🟢 리모컨</span>
              <span className={styles.noticePink}>리모컨에서만 제어 할 수 있습니다.</span>
            </span>
          </Row>
          <Row label="제목 폰트 설정">
            <ColorFontFields label="제목" value={v.titleFont} onChange={(x) => set("titleFont", x)} />
          </Row>
          <Row label="남은시간 폰트 설정">
            <ColorFontFields label="남은시간" value={v.timeFont} onChange={(x) => set("timeFont", x)} />
          </Row>
          <Row label="상금 폰트 설정">
            <ColorFontFields label="상금" value={v.prizeFont} onChange={(x) => set("prizeFont", x)} />
          </Row>
        </div>
      </Section>
      <Section title="퀘스트 추가 설정">
        <div className={styles.rows}>
          <Row
            label={
              <>
                후원 최소 FN <Help text="퀘스트 후원에 필요한 최소 금액입니다. 허용 범위는 TBD입니다." />
              </>
            }
          >
            <NumberField label="후원 최소 FN" value={v.minAmount} max={PRIZE_MAX} grouped width={140} suffix="FN" onChange={(x) => set("minAmount", x)} />
          </Row>
          {/* 2026-10-04 결정: failed or cancelled quests refund everything (no 실패 · 취소 패널티); past the time limit a quest waits for a decision. */}
          <Row label="실패 · 취소한 퀘스트">
            <span className={styles.hint}>후원한 FN이 후원자에게 전액 환불돼요 (패널티 없음).</span>
          </Row>
          <Row label="제한 시간이 지나면">
            <span className={styles.hint}>결과를 정할 때까지 진행 중으로 남아요.</span>
          </Row>
          <Row
            label={
              <>
                최대 개수 <Help text="동시에 진행할 수 있는 퀘스트 수입니다." />
              </>
            }
          >
            <NumberField label="최대 개수" value={v.maxCount} max={50} suffix="개" onChange={(x) => set("maxCount", x)} />
          </Row>
          <Row
            label={
              <>
                등록 간격시간 <Help text="같은 도네이터가 다음 퀘스트를 등록하기까지 기다려야 하는 시간입니다." />
              </>
            }
          >
            <NumberField label="등록 간격시간" value={v.intervalSec} max={3600} suffix="초" onChange={(x) => set("intervalSec", x)} />
          </Row>
          <Row label="제한시간 연장 사용">
            <SwitchText label="제한시간 연장 사용" checked={v.allowExtension} onChange={(x) => set("allowExtension", x)} />
          </Row>
          <Row label="크리에이터 성공 결정 권한 메뉴 노출">
            <SwitchText label="크리에이터 성공 결정 권한 메뉴 노출" checked={v.showSuccessAuthorityMenu} onChange={(x) => set("showSuccessAuthorityMenu", x)} />
          </Row>
        </div>
      </Section>
      <div className={styles.subCard}>
        <strong>❖ 퀘스트 설정 유의사항</strong>
        <p className={styles.notice}>
          - 도네이터가 퀘스트 후원 등록 도중(후원하기 버튼 클릭 전), 크리에이터가 설정을 수정한 경우 후원등록이 되지 않습니다. 도네이터는 크리에이터의 새로운 설정값으로 다시 후원을 등록해야합니다.
        </p>
        <p className={styles.notice}>- &apos;크리에이터 성공결정권한 메뉴 노출 ON&apos;인 경우, 후원페이지에 크리에이터 성공결정권한 ON/OFF 메뉴가 노출됩니다.</p>
        <table className={styles.noteTable}>
          <thead>
            <tr>
              <th scope="col">크리에이터 페이지(설정)</th>
              <th scope="col">후원 페이지(도네이터 설정)</th>
              <th scope="col">성공결정 가능</th>
            </tr>
          </thead>
          <tbody>
            {AUTHORITY_TABLE.map((r, i) => (
              <tr key={i}>
                {r.map((c, j) => (
                  <td key={j}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
