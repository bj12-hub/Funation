"use client";

import { useEffect, useState } from "react";
import { Toggle } from "@/components/ui/Toggle";
import { formatNumber } from "@/lib/format";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { ThemeChoiceField } from "@/features/overlayTheme/ThemeChoiceField";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import {
  GACHA_BOARD_PERIODS,
  GACHA_BOARD_SPEEDS,
  GACHA_BOARD_TYPES,
  GACHA_MAX,
  GACHA_NAME_MAX,
  GACHA_PRIZES_MAX,
  GACHA_PRIZE_MODES,
  GACHA_STYLES,
  GACHA_THEMES,
  PRIZE_MAX,
  TEMPLATE_MAX,
  type Gacha,
  type GachaPrize,
  type GachaStyle
} from "@/services/creator/widgetSettingsTypes";
import { CopyButton } from "../settings/SettingsCards";
import { ColorField, NumberField, Radios, Row, Section, Select, SwitchText } from "./fields";
import { GachaView } from "./GameViews";
import type { FormProps } from "./forms";
import { LibrarySoundField } from "./library/LibrarySounds";
import styles from "./widgets.module.css";

const uid = (p: string) => `${p}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const newGacha = (n: number): Gacha => ({
  id: uid("gacha"),
  name: `뽑기 후원 ${n}`,
  price: 3_000,
  enabled: true,
  style: "CAPSULE",
  theme: "BASIC",
  spinSec: 5,
  messageTemplate: "{닉네임}님이 {금액} 뽑기 후원을 하였습니다!",
  pointColor: "#519CFF",
  limitEnabled: false,
  limitCount: 1,
  prizeMode: "PROBABILITY",
  prizes: [{ id: uid("prize"), name: "뽑기1", kind: "BLANK", value: 100 }],
  winSoundId: null
});

/**
 * 뽑기 후원 위젯 설정 — Figma 373:3675. Viewers draw from the creator room (뽑기 donation type); prizes are the
 * creator's (2026-10-04 결정: FN 지급 없음). 당첨 내역 and the 전광판 read the real draws. Odds disclosure and
 * legal review for paid draws are TBD.
 */
export function GachaForm({ value: v, onChange, live }: FormProps<"GACHA">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const [previewStyle, setPreviewStyle] = useState<GachaStyle>(v.gachas[0]?.style ?? "CAPSULE");
  const [selectedId, setSelectedId] = useState<string | null>(v.gachas[0]?.id ?? null);
  const [checked, setChecked] = useState<string[]>([]);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  // The board URL is a path; the key is masked on screen and copied in full.
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const selected = v.gachas.find((g) => g.id === selectedId) ?? null;
  const updateGacha = (id: string, patch: Partial<Gacha>) => set("gachas", v.gachas.map((g) => (g.id === id ? { ...g, ...patch } : g)));
  const sample = selected ?? v.gachas[0];

  return (
    <>
      <div className={styles.playTabs} role="tablist" aria-label="미리보기 스타일">
        {GACHA_STYLES.map((s) => (
          <button key={s.key} type="button" role="tab" aria-selected={previewStyle === s.key} className={previewStyle === s.key ? styles.playTabOn : undefined} onClick={() => setPreviewStyle(s.key)}>
            {s.tab}
          </button>
        ))}
      </div>
      <PreviewStage width={640} minHeight={300} label="뽑기 미리보기">
        <GachaView
          stage={{
            id: "sample",
            no: "G-0001",
            status: "RESULT",
            gachaName: sample?.name ?? "뽑기 후원",
            style: previewStyle,
            pointColor: sample?.pointColor ?? "#519CFF",
            donor: "하루봄",
            amount: sample?.price ?? 3_000,
            message: (sample?.messageTemplate ?? "{닉네임}님이 {금액} 뽑기 후원을 하였습니다!").replaceAll("{닉네임}", "하루봄").replaceAll("{금액}", `${formatNumber(sample?.price ?? 3_000)} FN`),
            prize: sample?.prizes.find((p) => p.kind === "PRIZE")?.name ?? "상품",
            blank: false,
            endsAt: ""
          }}
          history={live.gachaWins.slice(0, v.credit.historyCount).map((w) => ({ donor: "하루봄", prize: w.prize }))}
          theme={resolveTheme(live.appearance, v.overlayTheme)}
        />
      </PreviewStage>
      <Section title="테마">
        <ThemeChoiceField value={v.overlayTheme} onChange={(x) => set("overlayTheme", x)} appearance={live.appearance} />
      </Section>

      <Section
        title="뽑기 후원 리스트"
        aside={
          <div className={styles.inline}>
            <button
              type="button"
              className={styles.dangerButton}
              disabled={checked.length === 0}
              onClick={() => {
                set("gachas", v.gachas.filter((g) => !checked.includes(g.id)));
                if (selectedId && checked.includes(selectedId)) setSelectedId(null);
                setChecked([]);
              }}
            >
              🗑️ 삭제
            </button>
            <button
              type="button"
              className={styles.blueButton}
              disabled={v.gachas.length >= GACHA_MAX}
              onClick={() => {
                const g = newGacha(v.gachas.length + 1);
                set("gachas", [...v.gachas, g]);
                setSelectedId(g.id);
              }}
            >
              + 뽑기 추가
            </button>
          </div>
        }
      >
        {v.gachas.length === 0 && <p className={styles.hint}>뽑기가 없습니다. 뽑기를 추가해 주세요.</p>}
        <ul className={styles.presetList}>
          {v.gachas.map((g) => (
            <li key={g.id} className={`${styles.preset} ${g.id === selectedId ? styles.presetOn : ""}`}>
              <div className={styles.presetHead}>
                <label className={styles.radio}>
                  <input
                    type="checkbox"
                    checked={checked.includes(g.id)}
                    onChange={(e) => setChecked((c) => (e.target.checked ? [...c, g.id] : c.filter((x) => x !== g.id)))}
                  />
                  {g.name}
                </label>
                <span className={styles.suffix}>{formatNumber(g.price)}FN</span>
                <Toggle label={`${g.name} 사용`} checked={g.enabled} onChange={(x) => updateGacha(g.id, { enabled: x })} />
                <button type="button" className={styles.linkButton} aria-expanded={g.id === selectedId} onClick={() => setSelectedId(g.id === selectedId ? null : g.id)}>
                  설정 {g.id === selectedId ? "▲" : "▼"}
                </button>
                <button type="button" className={styles.purpleSmall} aria-expanded={historyFor === g.id} onClick={() => setHistoryFor(historyFor === g.id ? null : g.id)}>
                  당첨 내역 확인
                </button>
              </div>
              {historyFor === g.id && <WinTable wins={live.gachaWins.filter((w) => w.gacha === g.name)} />}
            </li>
          ))}
        </ul>
      </Section>

      {selected && <GachaDetail key={selected.id} gacha={selected} onChange={(patch) => updateGacha(selected.id, patch)} />}

      <Section title="크레딧 스타일 세부 설정">
        <div className={styles.rows}>
          <Row label="당첨 내역 개수">
            <Select
              label="당첨 내역 개수"
              value={v.credit.historyCount}
              options={[1, 3, 5, 10, 20]}
              width={120}
              onChange={(x) => set("credit", { ...v.credit, historyCount: x })}
            />
          </Row>
          <Row label="화면 노출 시간">
            <NumberField label="화면 노출 시간" value={v.credit.displaySec} max={60} suffix="초" onChange={(x) => set("credit", { ...v.credit, displaySec: x })} />
          </Row>
        </div>
      </Section>

      <Section title="🏆 당첨 리스트 위젯 (전광판)">
        <div className={styles.rows}>
          <div className={styles.urlBox}>
            <span className={styles.urlLabel}>당첨 리스트 위젯 URL</span>
            <div className={styles.urlRow}>
              <span className={styles.urlField}>{`${origin}${live.gachaBoardUrl.replace(/[^/]+$/, (k) => `${k.slice(0, 4)}-····-····-····`)}`}</span>
              <CopyButton value={`${origin}${live.gachaBoardUrl}`} label="복사" className={styles.copyButton} />
            </div>
          </div>
          <div className={styles.subCard}>
            <strong>미확인 상품 실시간 전광판 미리보기</strong>
            <WinTable wins={live.gachaWins} unclaimed={live.gachaUnclaimed} />
          </div>
          <Row label="상품 타입">
            <Radios name="board-type" label="상품 타입" options={GACHA_BOARD_TYPES} value={v.board.productType} onChange={(x) => set("board", { ...v.board, productType: x })} />
          </Row>
          <Row label="위젯 타이틀" htmlFor="board-title">
            <input id="board-title" className={styles.input} maxLength={20} value={v.board.title} onChange={(e) => set("board", { ...v.board, title: e.target.value })} />
          </Row>
          <Row label="산정 기간">
            <Select label="산정 기간" value={v.board.period} options={GACHA_BOARD_PERIODS} width={180} onChange={(x) => set("board", { ...v.board, period: x })} />
          </Row>
          <Row label="흐르는 속도">
            <Radios name="board-speed" label="흐르는 속도" options={GACHA_BOARD_SPEEDS} value={v.board.speed} onChange={(x) => set("board", { ...v.board, speed: x })} />
          </Row>
        </div>
      </Section>
    </>
  );
}

function WinTable({ wins, unclaimed }: { wins: { gacha: string; prize: string; claimed: boolean | null }[]; unclaimed?: number }) {
  if (wins.length === 0) return <p className={styles.hint}>당첨 내역이 없습니다.</p>;
  return (
    <table className={styles.noteTable}>
      <thead>
        <tr>
          <th scope="col">뽑기 이름</th>
          <th scope="col">당첨 상품명</th>
          <th scope="col">{unclaimed === undefined ? "수령" : `미확인 (${unclaimed})`}</th>
        </tr>
      </thead>
      <tbody>
        {wins.map((w, i) => (
          <tr key={i}>
            <td>{w.gacha}</td>
            <td>{w.prize}</td>
            <td className={w.claimed === false ? styles.unclaimed : undefined}>{w.claimed === null ? "-" : w.claimed ? "수령" : "미수령"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function GachaDetail({ gacha: g, onChange }: { gacha: Gacha; onChange: (patch: Partial<Gacha>) => void }) {
  const probability = g.prizeMode === "PROBABILITY";
  const total = g.prizes.reduce((s, p) => s + p.value, 0);
  const setPrize = (id: string, patch: Partial<GachaPrize>) => onChange({ prizes: g.prizes.map((p) => (p.id === id ? { ...p, ...patch } : p)) });

  return (
    <>
      <Section title={`뽑기 기본 설정 · ${g.name}`}>
        <div className={styles.rows}>
          <Row label="뽑기 이름" htmlFor={`${g.id}-name`}>
            <input id={`${g.id}-name`} className={styles.input} maxLength={GACHA_NAME_MAX} value={g.name} onChange={(e) => onChange({ name: e.target.value })} />
          </Row>
          <Row label="뽑기 가격">
            <NumberField label="뽑기 가격" value={g.price} max={PRIZE_MAX} grouped width={160} suffix="FN" onChange={(x) => onChange({ price: x })} />
          </Row>
          <Row label="뽑기 스타일">
            <div className={styles.filterBox}>
              <Radios name={`${g.id}-style`} label="뽑기 스타일" options={GACHA_STYLES} value={g.style} onChange={(x) => onChange({ style: x })} />
              <div className={styles.gachaThumbs}>
                {GACHA_STYLES.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={g.style === s.key}
                    aria-label={`${s.label} 스타일 선택`}
                    className={`${styles.gachaThumb} ${g.style === s.key ? styles.thumbOn : ""}`}
                    onClick={() => onChange({ style: s.key })}
                  >
                    {s.tab}
                  </button>
                ))}
              </div>
            </div>
          </Row>
          <Row label="뽑기 테마">
            <Radios name={`${g.id}-theme`} label="뽑기 테마" options={GACHA_THEMES} value={g.theme} onChange={(x) => onChange({ theme: x })} />
          </Row>
        </div>
      </Section>

      <Section title="효과음 및 디테일 연출">
        <div className={styles.rows}>
          <Row label="당첨 연출 효과음">
            {/* Code-first: the sound comes from 이미지·사운드 (the draw overlay that plays it is TBD). */}
            <LibrarySoundField label="효과음 설정" buttonClassName={styles.purpleSmall} value={g.winSoundId ?? null} onChange={(id) => onChange({ winSoundId: id })} />
          </Row>
          <Row label="기계 회전 시간">
            <NumberField label="기계 회전 시간" value={g.spinSec} max={30} suffix="초" onChange={(x) => onChange({ spinSec: x })} />
          </Row>
          <Row label="알림 메시지 템플릿" htmlFor={`${g.id}-tpl`}>
            <input id={`${g.id}-tpl`} className={styles.input} maxLength={TEMPLATE_MAX} value={g.messageTemplate} onChange={(e) => onChange({ messageTemplate: e.target.value })} />
          </Row>
          <Row label="포인트 폰트 컬러">
            <ColorField label="포인트 폰트 컬러" value={g.pointColor} onChange={(x) => onChange({ pointColor: x })} />
          </Row>
          <Row label="후원 횟수 한도 제한">
            <div className={styles.inline}>
              <SwitchText label="후원 횟수 한도 제한" checked={g.limitEnabled} onChange={(x) => onChange({ limitEnabled: x })} />
              {g.limitEnabled && (
                <NumberField label="1인당 최대 횟수" value={g.limitCount} max={1000} suffix="회 (1인당, 기준 기간 TBD)" onChange={(x) => onChange({ limitCount: Math.max(1, x) })} />
              )}
            </div>
          </Row>
        </div>
      </Section>

      <Section
        title="상품 목록 및 확률 설정"
        aside={
          <button
            type="button"
            className={styles.blueButton}
            disabled={g.prizes.length >= GACHA_PRIZES_MAX}
            onClick={() => onChange({ prizes: [...g.prizes, { id: uid("prize"), name: `뽑기${g.prizes.length + 1}`, kind: "PRIZE", value: 0 }] })}
          >
            + 상품 추가
          </button>
        }
      >
        <div className={styles.rows}>
          <Radios name={`${g.id}-mode`} label="상품 방식" options={GACHA_PRIZE_MODES} value={g.prizeMode} onChange={(x) => onChange({ prizeMode: x })} />
          <ul className={styles.prizeList}>
            {g.prizes.map((p, i) => (
              <li key={p.id}>
                <input aria-label={`상품 ${i + 1} 이름`} className={styles.input} maxLength={GACHA_NAME_MAX} value={p.name} onChange={(e) => setPrize(p.id, { name: e.target.value })} />
                <Select
                  label={`상품 ${i + 1} 종류`}
                  value={p.kind}
                  options={["PRIZE", "BLANK"] as const}
                  format={(k) => (k === "BLANK" ? "꽝" : "상품")}
                  onChange={(kind) => setPrize(p.id, { kind })}
                />
                <NumberField
                  label={`상품 ${i + 1} ${probability ? "확률" : "수량"}`}
                  value={p.value}
                  max={probability ? 100 : 100_000}
                  width={90}
                  suffix={probability ? "%" : "개"}
                  onChange={(x) => setPrize(p.id, { value: x })}
                />
                {g.prizes.length > 1 && (
                  <button type="button" className={styles.iconButton} aria-label={`상품 ${i + 1} 삭제`} onClick={() => onChange({ prizes: g.prizes.filter((x) => x.id !== p.id) })}>
                    ✕
                  </button>
                )}
              </li>
            ))}
          </ul>
          {probability && (
            <p className={total === 100 ? styles.okText : styles.warnText} role="status">
              확률 합계 {total}% {total === 100 ? "" : "— 합계가 100%가 되어야 저장할 수 있어요."}
            </p>
          )}
        </div>
      </Section>
    </>
  );
}
