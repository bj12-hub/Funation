"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { formatNumber } from "@/lib/format";
import {
  AUTO_REFUND_MINUTES,
  PLAY_GAMES,
  PRIZE_MAX,
  QUEST_STYLES,
  type ColorFont,
  type LeveledFont,
  type QueueDisplay
} from "@/services/creator/widgetSettingsTypes";
import { ColorField, ColorFontFields, Help, LeveledFontFields, NumberField, PercentSlider, Preview, Radios, Row, Section, SwitchText } from "./fields";
import type { FormProps } from "./forms";
import styles from "./widgets.module.css";

const LEVEL_PX = { SMALL: 13, NORMAL: 16, LARGE: 20 } as const;
const lf = (f: LeveledFont): CSSProperties => ({ fontFamily: `"${f.family}", var(--font-sans)`, fontSize: LEVEL_PX[f.level], color: f.color });
const cf = (f: ColorFont, size = 15): CSSProperties => ({ fontFamily: `"${f.family}", var(--font-sans)`, fontSize: size, color: f.color });
const alpha = (hex: string, pct: number) => {
  const n = Number.parseInt(hex.slice(1), 16);
  return Number.isNaN(n) ? hex : `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${pct / 100})`;
};

const refundOptions = AUTO_REFUND_MINUTES.map((m) => ({ key: String(m), label: `${m}분` }));

function RefundRow({ value, onChange }: { value: number; onChange: (m: (typeof AUTO_REFUND_MINUTES)[number]) => void }) {
  return (
    <Row
      label={
        <>
          자동환불시간 <Help text="설정한 시간 안에 진행되지 않은 후원은 자동으로 환불됩니다. 환불 처리 기준은 TBD입니다." />
        </>
      }
    >
      <Radios
        name="refund"
        label="자동환불시간"
        options={refundOptions}
        value={String(value)}
        onChange={(k) => onChange(Number(k) as (typeof AUTO_REFUND_MINUTES)[number])}
      />
    </Row>
  );
}

function QueueSection({ title, value, onChange, children }: { title: string; value: QueueDisplay; onChange: (q: QueueDisplay) => void; children?: ReactNode }) {
  return (
    <Section title={title}>
      <div className={styles.rows}>
        {children}
        <Row label="배경 색상">
          <ColorField label="대기열 배경 색상" value={value.bgColor} onChange={(bgColor) => onChange({ ...value, bgColor })} />
        </Row>
        <Row label="배경 투명도">
          <PercentSlider label="대기열 배경 투명도" value={value.bgOpacity} onChange={(bgOpacity) => onChange({ ...value, bgOpacity })} />
        </Row>
        <Row label="닉네임 폰트">
          <LeveledFontFields label="대기열 닉네임" value={value.nicknameFont} onChange={(nicknameFont) => onChange({ ...value, nicknameFont })} />
        </Row>
        <Row label="상금 폰트">
          <LeveledFontFields label="대기열 상금" value={value.prizeFont} onChange={(prizeFont) => onChange({ ...value, prizeFont })} />
        </Row>
        <Row label="남은시간 폰트">
          <LeveledFontFields label="대기열 남은시간" value={value.timeFont} onChange={(timeFont) => onChange({ ...value, timeFont })} />
        </Row>
      </div>
    </Section>
  );
}

function QueueRow({ q, amount, label, useDefaultBg = false }: { q: QueueDisplay; amount: number; label: string; useDefaultBg?: boolean }) {
  return (
    <div className={styles.queueRow} style={{ background: useDefaultBg ? undefined : alpha(q.bgColor, q.bgOpacity) }}>
      <span style={lf(q.nicknameFont)}>김태훈</span>
      <span style={lf(q.prizeFont)}>
        {formatNumber(amount)} FN {label}
      </span>
      <span className={styles.timeBadge} style={lf(q.timeFont)}>
        29:18 남음
      </span>
    </div>
  );
}

// ── 럭키박스 (373:1356) ────────────────────────────────────────────────────────

export function LuckyboxForm({ value: v, onChange }: FormProps<"LUCKYBOX">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const amount = Math.max(5_000, v.minPrize);
  return (
    <>
      <Preview>
        <div className={styles.gamePreview}>
          <div className={styles.luckyCard} style={{ background: `rgba(18, 18, 37, ${v.bgOpacity / 100})`, opacity: v.enabled ? 1 : 0.4 }}>
            <p>
              <b style={lf(v.nicknameFont)}>김태훈</b>님의 <b style={lf(v.prizeFont)}>{formatNumber(amount)}FN</b> 럭키박스
            </p>
            <div className={styles.boxes} aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i}>📦</span>
              ))}
            </div>
          </div>
          <QueueRow q={v.queue} amount={amount} label="럭키박스" />
        </div>
      </Preview>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <Row label="사용하기">
            <SwitchText label="럭키박스 위젯 사용하기" checked={v.enabled} onChange={(x) => set("enabled", x)} />
          </Row>
          <Row label="배경 투명도">
            <PercentSlider label="배경 투명도" value={v.bgOpacity} onChange={(x) => set("bgOpacity", x)} />
          </Row>
          <Row label="닉네임 폰트">
            <LeveledFontFields label="닉네임" value={v.nicknameFont} onChange={(x) => set("nicknameFont", x)} />
          </Row>
          <Row label="상금 폰트">
            <LeveledFontFields label="상금" value={v.prizeFont} onChange={(x) => set("prizeFont", x)} />
          </Row>
        </div>
      </Section>
      <QueueSection title="럭키박스 대기열 노출 설정" value={v.queue} onChange={(x) => set("queue", x)} />
      <Section title="럭키박스 추가설정">
        <div className={styles.rows}>
          <Row
            label={
              <>
                최소 당첨 상금 <Help text="럭키박스 한 칸에 들어가는 최소 상금입니다. 허용 범위는 TBD입니다." />
              </>
            }
          >
            <NumberField label="최소 당첨 상금" value={v.minPrize} max={PRIZE_MAX} grouped width={140} suffix="FN" onChange={(x) => set("minPrize", x)} />
          </Row>
          <Row
            label={
              <>
                최소 팡 금액 비율 <Help text="꽝(팡)일 때 지급되는 최소 금액의 비율입니다. 적용 방식은 TBD입니다." />
              </>
            }
          >
            <NumberField label="최소 팡 금액 비율" value={v.minPangPercent} max={100} suffix="%" onChange={(x) => set("minPangPercent", x)} />
          </Row>
          <RefundRow value={v.autoRefundMinutes} onChange={(x) => set("autoRefundMinutes", x)} />
        </div>
      </Section>
    </>
  );
}

// ── 퀘스트 (373:1598) ──────────────────────────────────────────────────────────

const AUTHORITY_TABLE = [
  ["성공결정권한 메뉴노출 ON", "성공결정권한 ON", "크리에이터/도네이터 둘다"],
  ["성공결정권한 메뉴노출 ON", "성공결정권한 OFF", "도네이터만 가능"],
  ["성공결정권한 메뉴노출 OFF", "-", "크리에이터/도네이터 둘다"]
];

export function QuestForm({ value: v, onChange }: FormProps<"QUEST">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const prize = Math.max(3_000, v.minAmount);
  const percent = (key: "cancelPenaltyPercent" | "failPenaltyCreatorPercent" | "failPenaltyDonorPercent", label: string, help: string) => (
    <Row
      label={
        <>
          {label} <Help text={help} />
        </>
      }
    >
      <NumberField label={label} value={v[key]} max={100} suffix="%" onChange={(x) => set(key, x)} />
    </Row>
  );

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
          {percent("cancelPenaltyPercent", "취소 패널티 비율", "크리에이터가 퀘스트를 취소할 때 적용되는 비율입니다. 정산 방식은 TBD입니다.")}
          {percent("failPenaltyCreatorPercent", "실패 패널티 비율 (크리에이터 결정시)", "크리에이터가 실패로 결정할 때 적용되는 비율입니다. 정산 방식은 TBD입니다.")}
          {percent("failPenaltyDonorPercent", "실패 패널티 비율 (도네이터 결정시)", "도네이터가 실패로 결정할 때 적용되는 비율입니다. 정산 방식은 TBD입니다.")}
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

// ── 플레이 (373:1785) ──────────────────────────────────────────────────────────

type Game = (typeof PLAY_GAMES)[number]["key"];

export function PlayForm({ value: v, onChange }: FormProps<"PLAY">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const setGames = (patch: Partial<typeof v.games>) => set("games", { ...v.games, ...patch });
  const [game, setGame] = useState<Game>("CHOICE");
  const amount = Math.max(5_000, v.minPrize);
  const gameLabel = PLAY_GAMES.find((g) => g.key === game)?.label ?? "";

  return (
    <>
      <div className={styles.playTabs} role="tablist" aria-label="미리보기 게임">
        {PLAY_GAMES.map((g) => (
          <button key={g.key} type="button" role="tab" aria-selected={game === g.key} className={game === g.key ? styles.playTabOn : undefined} onClick={() => setGame(g.key)}>
            {g.label}
          </button>
        ))}
      </div>
      <Preview>
        <div className={styles.gamePreview}>
          <div className={styles.playCard} style={{ background: `rgba(18, 18, 37, ${v.opacity / 100})`, opacity: v.enabled ? 1 : 0.4 }}>
            <div className={styles.playHead}>
              <span>
                🏆 <b style={lf(v.nicknameFont)}>김태훈</b>님의 <b style={lf(v.prizeFont)}>{formatNumber(amount)}FN</b> {gameLabel}
              </span>
              <span className={styles.timeBadge}>⏱ 59:49 남음</span>
            </div>
            {game === "CHOICE" && (
              <>
                <p className={styles.playQuestion} style={lf(v.games.CHOICE.questionFont)}>
                  Q. 크리에이터를 지원하고, 즐거운 방송 문화를 만드는 최적의 소통 서비스는?
                </p>
                <ol className={styles.playOptions}>
                  {["도네이션", "토네이션", "썸네이션"].map((o) => (
                    <li key={o} style={lf(v.games.CHOICE.optionFont)}>
                      {o}
                    </li>
                  ))}
                </ol>
              </>
            )}
            {game === "INITIAL" && (
              <>
                <p className={styles.playQuestion} style={lf(v.games.INITIAL.questionFont)}>
                  Q. 초성을 보고 정답을 맞혀 주세요.
                </p>
                <p className={styles.playHint} style={lf(v.games.INITIAL.hintFont)}>
                  ㅎ ㅇ ㅌ
                </p>
              </>
            )}
            {game === "DRAWING" && (
              <>
                <p className={styles.playQuestion} style={lf(v.games.DRAWING.questionFont)}>
                  Q. 그림을 보고 정답을 맞혀 주세요.
                </p>
                <div className={styles.playCanvas} aria-hidden="true">
                  🎨
                </div>
              </>
            )}
          </div>
          <QueueRow q={v.queue} amount={amount} label={gameLabel} useDefaultBg={v.queue.useDefaultBg} />
        </div>
      </Preview>
      <Section title="기본 설정">
        <div className={styles.rows}>
          <Row label="사용하기">
            <SwitchText label="플레이 위젯 사용하기" checked={v.enabled} onChange={(x) => set("enabled", x)} />
          </Row>
          <Row label="BGM 사용하기">
            <SwitchText label="BGM 사용하기" checked={v.bgm} onChange={(x) => set("bgm", x)} />
          </Row>
          <Row label="위젯 투명도 조절">
            <PercentSlider label="위젯 투명도" value={v.opacity} onChange={(x) => set("opacity", x)} />
          </Row>
          <Row label="닉네임 폰트">
            <LeveledFontFields label="닉네임" value={v.nicknameFont} onChange={(x) => set("nicknameFont", x)} />
          </Row>
          <Row label="상금 폰트">
            <LeveledFontFields label="상금" value={v.prizeFont} onChange={(x) => set("prizeFont", x)} />
          </Row>
        </div>
      </Section>
      <QueueSection title="플레이 대기열 노출 설정" value={v.queue} onChange={(q) => set("queue", { ...v.queue, ...q })}>
        <Row label="대기열 배경">
          <Radios
            name="play-queue-bg"
            label="대기열 배경"
            options={[
              { key: "DEFAULT", label: "기본 배경" },
              { key: "COLOR", label: "색상 지정" }
            ]}
            value={v.queue.useDefaultBg ? "DEFAULT" : "COLOR"}
            onChange={(k) => set("queue", { ...v.queue, useDefaultBg: k === "DEFAULT" })}
          />
        </Row>
      </QueueSection>
      <Section title="추가 설정">
        <div className={styles.rows}>
          <Row
            label={
              <>
                최소 정답 상금 <Help text="정답자에게 지급되는 최소 상금입니다. 허용 범위는 TBD입니다." />
              </>
            }
          >
            <NumberField label="최소 정답 상금" value={v.minPrize} max={PRIZE_MAX} grouped width={140} suffix="FN" onChange={(x) => set("minPrize", x)} />
          </Row>
          <Row
            label={
              <>
                최소 오답 금액 비율 <Help text="오답일 때 적용되는 최소 금액 비율입니다. 적용 방식은 TBD입니다." />
              </>
            }
          >
            <NumberField label="최소 오답 금액 비율" value={v.minWrongPercent} max={100} suffix="%" onChange={(x) => set("minWrongPercent", x)} />
          </Row>
          <RefundRow value={v.autoRefundMinutes} onChange={(x) => set("autoRefundMinutes", x)} />
        </div>
      </Section>
      <Section title="각 게임별 설정">
        <div className={styles.rows}>
          <p className={styles.rowLabel}>객관식 퀴즈 설정</p>
          <Row label="문제 폰트">
            <LeveledFontFields label="객관식 문제" value={v.games.CHOICE.questionFont} onChange={(f) => setGames({ CHOICE: { ...v.games.CHOICE, questionFont: f } })} />
          </Row>
          <Row label="보기 폰트">
            <LeveledFontFields label="객관식 보기" value={v.games.CHOICE.optionFont} onChange={(f) => setGames({ CHOICE: { ...v.games.CHOICE, optionFont: f } })} />
          </Row>
          <p className={styles.rowLabel}>초성 퀴즈 설정</p>
          <Row label="문제 폰트">
            <LeveledFontFields label="초성 문제" value={v.games.INITIAL.questionFont} onChange={(f) => setGames({ INITIAL: { ...v.games.INITIAL, questionFont: f } })} />
          </Row>
          <Row label="힌트(보기) 폰트">
            <LeveledFontFields label="초성 힌트" value={v.games.INITIAL.hintFont} onChange={(f) => setGames({ INITIAL: { ...v.games.INITIAL, hintFont: f } })} />
          </Row>
          <p className={styles.rowLabel}>그림 퀴즈 설정</p>
          <Row label="문제 폰트">
            <LeveledFontFields label="그림 문제" value={v.games.DRAWING.questionFont} onChange={(f) => setGames({ DRAWING: { questionFont: f } })} />
          </Row>
        </div>
      </Section>
    </>
  );
}
