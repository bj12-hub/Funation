"use client";

import { useEffect, useState } from "react";
import { formatKstTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
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
import { optionText, translatedOptions } from "./widgetFormLabels";
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
  const { t } = useI18n();
  const named = (field: string) => t("widgetFormSigWall.named", { name, field });
  return (
    <div className={styles.rows}>
      <Row label={t("widgetForm.textSize")}>
        <NumberField label={named(t("widgetForm.textSize"))} value={value.size} max={SIG_WALL_TEXT_MAX} suffix="px" onChange={(x) => set("size", x)} />
      </Row>
      <Row label={t("widgetFormSigWall.stroke")}>
        <NumberField label={named(t("widgetFormSigWall.stroke"))} value={value.stroke} max={SIG_WALL_STROKE_MAX} suffix="px" onChange={(x) => set("stroke", x)} />
      </Row>
      <Row label={t("widgetFormSigWall.color")}>
        <ColorField label={named(t("widgetFormSigWall.color"))} value={value.color} onChange={(x) => set("color", x)} />
      </Row>
      <Row label={t("widgetFormSigWall.strokeColor")}>
        <ColorField label={named(t("widgetFormSigWall.strokeColor"))} value={value.strokeColor} onChange={(x) => set("strokeColor", x)} />
      </Row>
      <Row label={accent}>
        <ColorField label={named(accent)} value={value.accent} onChange={(x) => set("accent", x)} />
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
  const { t } = useI18n();
  return (
    <>
      <Section title={t("widgetForm.preview")}>
        <PreviewStage width={size.w} minHeight={size.h} label={t("widgetFormSigWall.previewAria")}>
          <SigWallpaperView settings={v} card={card} theme={resolveTheme(live.appearance, "INHERIT")} />
        </PreviewStage>
        <p className={styles.hint}>
          {latest ? t("widgetFormSigWall.previewLatest") : t("widgetFormSigWall.previewSample")} {t("widgetFormSigWall.sizeHint", { w: size.w, h: size.h })}
        </p>
      </Section>

      <Section title={t("widgetFormSigWall.style")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormSigWall.bg")}>
            <ColorField label={t("widgetFormSigWall.bg")} value={v.bgColor} onChange={(x) => set("bgColor", x)} />
          </Row>
          <Row label={t("widgetFormSigWall.bgOpacity")}>
            <NumberField label={t("widgetFormSigWall.bgOpacity")} value={v.bgOpacity} max={100} suffix="%" onChange={(x) => set("bgOpacity", x)} />
          </Row>
          <Row label={t("widgetFormSigWall.imageSize")}>
            <span className={styles.inline}>
              <NumberField label={t("widgetFormSigWall.imageW")} value={v.imageWidth} max={SIG_WALL_IMAGE_MAX} suffix="px" onChange={(x) => set("imageWidth", x)} />
              <span className={styles.suffix}>×</span>
              <NumberField label={t("widgetFormSigWall.imageH")} value={v.imageHeight} max={SIG_WALL_IMAGE_MAX} suffix="px" onChange={(x) => set("imageHeight", x)} />
            </span>
          </Row>
          <Row label={t("widgetFormSigWall.gapImage")}>
            <SignedField label={t("widgetFormSigWall.gapImageAria")} value={v.gapImage} min={SIG_WALL_GAP_MIN} max={SIG_WALL_GAP_MAX} onChange={(x) => set("gapImage", x)} />
          </Row>
          <Row label={t("widgetFormSigWall.gapLines")}>
            <SignedField label={t("widgetFormSigWall.gapLinesAria")} value={v.gapLines} min={SIG_WALL_GAP_MIN} max={SIG_WALL_GAP_MAX} onChange={(x) => set("gapLines", x)} />
          </Row>
          <Row label={t("widgetFormSigWall.gapBottom")}>
            <SignedField label={t("widgetFormSigWall.gapBottom")} value={v.gapBottom} min={SIG_WALL_GAP_MIN} max={SIG_WALL_GAP_MAX} onChange={(x) => set("gapBottom", x)} />
          </Row>
        </div>
        <p className={styles.hint}>{t("widgetFormSigWall.gapHint")}</p>
      </Section>

      <Section title={t("widgetFormSigWall.options")}>
        <div className={styles.rows}>
          <Row label={t("widgetFormSigWall.imagePad")}>
            <Radios
              name="sigwall-pad"
              label={t("widgetFormSigWall.imagePad")}
              options={[
                { key: "ON", label: t("widgetFormSigWall.padOn") },
                { key: "OFF", label: t("widgetForm.none") }
              ]}
              value={v.imagePad ? "ON" : "OFF"}
              onChange={(x) => set("imagePad", x === "ON")}
            />
          </Row>
          <Row label={t("widgetFormSigWall.radius")}>
            <NumberField label={t("widgetFormSigWall.radius")} value={v.radius} max={SIG_WALL_RADIUS_MAX} suffix={t("widgetFormSigWall.radiusSuffix")} onChange={(x) => set("radius", x)} />
          </Row>
          <Row label={t("widgetFormSigWall.topLineRow")}>
            <Radios name="sigwall-top" label={t("widgetFormSigWall.topLineLabel")} options={translatedOptions(SIG_WALL_TOP_LINES, t)} value={v.topLine} onChange={(x) => set("topLine", x)} />
          </Row>
          <Row label={t("widgetFormSigWall.prefix")}>
            <input
              className={styles.input}
              aria-label={t("widgetFormSigWall.prefix")}
              maxLength={SIG_WALL_PREFIX_MAX}
              placeholder={t("widgetFormSigWall.prefixPlaceholder")}
              value={v.amountPrefix}
              onChange={(e) => set("amountPrefix", e.target.value)}
            />
          </Row>
          <Row label={t("widgetFormSigWall.font")}>
            <Select label={t("widgetFormSigWall.fontLabel")} value={v.font} options={FONT_FAMILIES} width={160} format={(f) => optionText(f, t)} onChange={(x) => set("font", x)} />
          </Row>
        </div>
        <p className={styles.hint}>{t("widgetFormSigWall.prefixHint")}</p>
      </Section>

      <Section title={t("widgetFormSigWall.topSection")}>
        <LineFields name={t("widgetFormSigWall.topName")} accent={t("widgetFormSigWall.donorColor")} value={v.top} onChange={(x) => set("top", x)} />
      </Section>

      <Section title={t("widgetFormSigWall.bottomSection")}>
        <LineFields name={t("widgetFormSigWall.bottomName")} accent={t("widgetFormSigWall.amountColor")} value={v.bottom} onChange={(x) => set("bottom", { ...x, bold: v.bottom.bold })} />
        <div className={styles.rows}>
          <Row label={t("widgetFormSigWall.bold")}>
            <Radios
              name="sigwall-bold"
              label={t("widgetFormSigWall.bold")}
              options={[
                { key: "NORMAL", label: t("widgetFormSigWall.normal") },
                { key: "BOLD", label: t("widgetFormSigWall.boldOpt") }
              ]}
              value={v.bottom.bold ? "BOLD" : "NORMAL"}
              onChange={(x) => set("bottom", { ...v.bottom, bold: x === "BOLD" })}
            />
          </Row>
        </div>
      </Section>

      <Section title={t("widgetFormSigWall.list", { count: live.sigWalls.length })}>
        <p className={styles.hint}>{t("widgetFormSigWall.listHint")}</p>
        <Row label={t("widgetFormSigWall.filter")}>
          <NumberField label={t("widgetFormSigWall.filterLabel")} value={min} grouped width={120} suffix={t("widgetFormSigWall.filterSuffix")} onChange={setMin} />
        </Row>
        {rows.length === 0 ? (
          <p className={styles.hint}>{live.sigWalls.length ? t("widgetFormSigWall.noneAbove") : t("widgetFormSigWall.none")}</p>
        ) : (
          <div className={w.listWrap}>
            <table className={w.list} aria-label={t("widgetFormSigWall.tableAria")}>
              <thead>
                <tr>
                  <th scope="col">{t("widgetFormSigWall.colTime")}</th>
                  <th scope="col">{t("widgetFormSigWall.colDonor")}</th>
                  <th scope="col">{t("widgetFormSigWall.colAmount")}</th>
                  <th scope="col">{t("widgetFormSigWall.colSignature")}</th>
                  <th scope="col">BJ</th>
                  <th scope="col">{t("widgetFormSigWall.colWallpaper")}</th>
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
                      <CopyButton value={`${origin}${live.sigWallPath}?d=${encodeURIComponent(r.id)}`} label={t("widgetForm.copyUrl")} className={styles.smallButton} />
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
