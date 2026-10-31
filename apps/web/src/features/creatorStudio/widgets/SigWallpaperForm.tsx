"use client";

import { useEffect, useState } from "react";
import { formatKstTime } from "@/lib/format";
import { PreviewStage } from "@/features/overlayTheme/PreviewStage";
import { resolveTheme } from "@/services/creator/overlayThemeTypes";
import type { SigWallCard } from "@/services/creator/widgetOverlayTypes";
import {
  FONT_FAMILIES,
  SIG_WALL_GAP_MAX,
  SIG_WALL_GAP_MIN,
  SIG_WALL_IMAGE_MAX,
  SIG_WALL_PREFIX_MAX,
  SIG_WALL_RADIUS_MAX,
  SIG_WALL_STROKE_MAX,
  SIG_WALL_TEXT_MAX,
  SIG_WALL_TOP_LINES,
  sigWallSize,
  type SigWallLine
} from "@/services/creator/widgetSettingsTypes";
import { CopyButton } from "../settings/SettingsCards";
import { ColorField, NumberField, Radios, Row, Section, Select } from "./fields";
import type { FormProps } from "./forms";
import { SigWallpaperView } from "./SigWallpaperView";
import w from "./sigWallpaper.module.css";
import styles from "./widgets.module.css";

/**
 * 시그 벽지 설정 (code-first, 2026-10-28 — StreamDonate 시그 벽지 참고): one style for every card, and the latest 시그니처
 * 후원 each with its own address (`?d=`) to put in OBS. The preview draws the latest one (a sample when there is none).
 */

const SAMPLE: SigWallCard = { imageUrl: "/mock/room/signatures/sig-1.png", donor: "익명", amount: "400,000 FN" };
const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });

/** A whole number that may be negative (여백), kept within its range. */
function SignedField({ label, value, onChange, min, max }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number }) {
  return (
    <span className={styles.inline}>
      <input
        aria-label={label}
        className={styles.input}
        style={{ width: 80 }}
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Math.trunc(Number(e.target.value) || 0))))}
      />
      <span className={styles.suffix}>px</span>
    </span>
  );
}

/** 글자 크기 · 테두리 굵기 · 기본 글자색 · 테두리 색 · `accent` of one line. */
function LineFields({ name, accent, value, onChange }: { name: string; accent: string; value: SigWallLine; onChange: (v: SigWallLine) => void }) {
  const set = <P extends keyof SigWallLine>(k: P, x: SigWallLine[P]) => onChange({ ...value, [k]: x });
  return (
    <div className={styles.rows}>
      <Row label="글자 크기">
        <NumberField label={`${name} 글자 크기`} value={value.size} max={SIG_WALL_TEXT_MAX} suffix="px" onChange={(x) => set("size", x)} />
      </Row>
      <Row label="테두리 굵기">
        <NumberField label={`${name} 테두리 굵기`} value={value.stroke} max={SIG_WALL_STROKE_MAX} suffix="px" onChange={(x) => set("stroke", x)} />
      </Row>
      <Row label="기본 글자색">
        <ColorField label={`${name} 기본 글자색`} value={value.color} onChange={(x) => set("color", x)} />
      </Row>
      <Row label="테두리 색">
        <ColorField label={`${name} 테두리 색`} value={value.strokeColor} onChange={(x) => set("strokeColor", x)} />
      </Row>
      <Row label={accent}>
        <ColorField label={`${name} ${accent}`} value={value.accent} onChange={(x) => set("accent", x)} />
      </Row>
    </div>
  );
}

export function SigWallpaperForm({ value: v, onChange, live }: FormProps<"SIG_WALLPAPER">) {
  const set = <P extends keyof typeof v>(k: P, x: (typeof v)[P]) => onChange({ ...v, [k]: x });
  const size = sigWallSize(v);
  const latest = live.sigWalls[0];
  const card = latest ? { imageUrl: latest.imageUrl, donor: latest.donor, amount: latest.amount } : SAMPLE;
  const [min, setMin] = useState(0);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const rows = live.sigWalls.filter((r) => r.fnAmount >= min);
  return (
    <>
      <Section title="미리보기">
        <PreviewStage width={size.w} minHeight={size.h} label="시그 벽지 미리보기">
          <SigWallpaperView settings={v} card={card} theme={resolveTheme(live.appearance, "INHERIT")} />
        </PreviewStage>
        <p className={styles.hint}>
          {latest ? "목록의 최근 시그니처 후원으로 보여 줘요." : "아직 시그니처 후원이 없어 샘플로 보여 줘요."} OBS 브라우저 소스 크기는 {size.w} × {size.h}로 맞춰 주세요 (글자 크기 ·
          여백을 바꾸면 이 값도 바뀌어요).
        </p>
      </Section>

      <Section title="스타일 (모든 벽지 공통)">
        <div className={styles.rows}>
          <Row label="배경색">
            <ColorField label="배경색" value={v.bgColor} onChange={(x) => set("bgColor", x)} />
          </Row>
          <Row label="배경 불투명도">
            <NumberField label="배경 불투명도" value={v.bgOpacity} max={100} suffix="%" onChange={(x) => set("bgOpacity", x)} />
          </Row>
          <Row label="이미지 크기">
            <span className={styles.inline}>
              <NumberField label="이미지 너비" value={v.imageWidth} max={SIG_WALL_IMAGE_MAX} suffix="px" onChange={(x) => set("imageWidth", x)} />
              <span className={styles.suffix}>×</span>
              <NumberField label="이미지 높이" value={v.imageHeight} max={SIG_WALL_IMAGE_MAX} suffix="px" onChange={(x) => set("imageHeight", x)} />
            </span>
          </Row>
          <Row label="이미지 ↔ 윗줄 여백">
            <SignedField label="이미지와 윗줄 사이 여백" value={v.gapImage} min={SIG_WALL_GAP_MIN} max={SIG_WALL_GAP_MAX} onChange={(x) => set("gapImage", x)} />
          </Row>
          <Row label="윗줄 ↔ 아랫줄 여백">
            <SignedField label="윗줄과 아랫줄 사이 여백" value={v.gapLines} min={SIG_WALL_GAP_MIN} max={SIG_WALL_GAP_MAX} onChange={(x) => set("gapLines", x)} />
          </Row>
          <Row label="맨 아래 여백">
            <SignedField label="맨 아래 여백" value={v.gapBottom} min={SIG_WALL_GAP_MIN} max={SIG_WALL_GAP_MAX} onChange={(x) => set("gapBottom", x)} />
          </Row>
        </div>
        <p className={styles.hint}>윗줄 ↔ 아랫줄 여백은 기본 줄 간격에 더하거나(양수) 빼는(음수) 값이에요.</p>
      </Section>

      <Section title="표시 옵션">
        <div className={styles.rows}>
          <Row label="이미지 좌우 · 위 여백">
            <Radios
              name="sigwall-pad"
              label="이미지 좌우 · 위 여백"
              options={[
                { key: "ON", label: "있음 (15px)" },
                { key: "OFF", label: "없음" }
              ]}
              value={v.imagePad ? "ON" : "OFF"}
              onChange={(x) => set("imagePad", x === "ON")}
            />
          </Row>
          <Row label="모서리 둥글기">
            <NumberField label="모서리 둥글기" value={v.radius} max={SIG_WALL_RADIUS_MAX} suffix="px (0 = 각지게)" onChange={(x) => set("radius", x)} />
          </Row>
          <Row label="윗줄 '님, 후원 감사합니다.'">
            <Radios name="sigwall-top" label="윗줄 문구" options={SIG_WALL_TOP_LINES} value={v.topLine} onChange={(x) => set("topLine", x)} />
          </Row>
          <Row label="금액 앞 문구">
            <input
              className={styles.input}
              aria-label="금액 앞 문구"
              maxLength={SIG_WALL_PREFIX_MAX}
              placeholder="비우면 없음 (예: 후원 )"
              value={v.amountPrefix}
              onChange={(e) => set("amountPrefix", e.target.value)}
            />
          </Row>
          <Row label="폰트">
            <Select label="시그 벽지 폰트" value={v.font} options={FONT_FAMILIES} width={160} onChange={(x) => set("font", x)} />
          </Row>
        </div>
        <p className={styles.hint}>금액 앞 문구는 금액 숫자와 띄우려면 끝에 공백을 넣어 주세요. 색은 아랫줄 기본 글자색을 따라요.</p>
      </Section>

      <Section title='윗줄 — "○○○님, 후원 감사합니다."'>
        <LineFields name="윗줄" accent="후원자명 색" value={v.top} onChange={(x) => set("top", x)} />
      </Section>

      <Section title="아랫줄 — 금액">
        <LineFields name="아랫줄" accent="금액 색" value={v.bottom} onChange={(x) => set("bottom", { ...x, bold: v.bottom.bold })} />
        <div className={styles.rows}>
          <Row label="금액 숫자 굵기">
            <Radios
              name="sigwall-bold"
              label="금액 숫자 굵기"
              options={[
                { key: "NORMAL", label: "기본" },
                { key: "BOLD", label: "굵게" }
              ]}
              value={v.bottom.bold ? "BOLD" : "NORMAL"}
              onChange={(x) => set("bottom", { ...v.bottom, bold: x === "BOLD" })}
            />
          </Row>
        </div>
      </Section>

      <Section title={`시그니처 후원 목록 · 최근 ${live.sigWalls.length}건`}>
        <p className={styles.hint}>벽지 주소를 OBS 브라우저 소스에 넣으면 그 후원의 벽지가 계속 보여요 (저절로 사라지지 않아요). 스타일을 바꾸면 모든 벽지에 바로 반영돼요.</p>
        <Row label="금액 필터">
          <NumberField label="금액 필터 (이상)" value={min} grouped width={120} suffix="FN 이상" onChange={setMin} />
        </Row>
        {rows.length === 0 ? (
          <p className={styles.hint}>{live.sigWalls.length ? "이 금액 이상인 시그니처 후원이 없어요." : "아직 시그니처 후원이 없어요."}</p>
        ) : (
          <div className={w.listWrap}>
            <table className={w.list} aria-label="시그니처 후원 목록">
              <thead>
                <tr>
                  <th scope="col">시간</th>
                  <th scope="col">후원자</th>
                  <th scope="col">금액</th>
                  <th scope="col">시그니처</th>
                  <th scope="col">BJ</th>
                  <th scope="col">벽지</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{time(r.at)}</td>
                    <td className={w.wrap}>{r.donor}</td>
                    <td>{r.amount}</td>
                    <td className={w.wrap}>{r.signature}</td>
                    <td>{r.member}</td>
                    <td>
                      <CopyButton value={`${origin}${live.sigWallPath}?d=${encodeURIComponent(r.id)}`} label="URL 복사" className={styles.smallButton} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
