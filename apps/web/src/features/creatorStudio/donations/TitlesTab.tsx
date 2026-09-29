"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import { Toggle } from "@/components/ui/Toggle";
import { formatNumber } from "@/lib/format";
import { PROFILE_PHOTO_TYPES } from "@/lib/validation";
import { saveTitleTier, setTitleEnabled } from "@/services/creator/donationManagement";
import { TITLE_DESCRIPTION_MAX, TITLE_NAME_MAX, type TitleSaveResult, type TitleTier } from "@/services/creator/donationManagementTypes";
import styles from "./donations.module.css";

const messageOf = (r: TitleSaveResult) => (r.status === "INVALID" ? r.message : r.status === "UNAUTHORIZED" ? "로그인이 필요합니다." : null);
const isHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

/**
 * 칭호 설정 — Figma 539:690. Donors earn a creator-defined title when their cumulative donations reach a
 * threshold. Thresholds are the design's fixed list; whether creators can change them is TBD.
 */
export function TitlesTab({ initial }: { initial: TitleTier[] }) {
  const [tiers, setTiers] = useState(initial);
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clearToast = useCallback(() => setToast(null), []);
  const replace = (t: TitleTier) => setTiers((list) => list.map((x) => (x.threshold === t.threshold ? t : x)));

  return (
    <div className={styles.stack}>
      <div>
        <h2 className={styles.sectionHeading}>크리에이터 칭호 목록</h2>
        <p className={styles.lineLabel}>도네이터가 누적 후원 금액을 충족하면 획득하는 칭호 목록입니다. 우측의 &apos;설정&apos; 버튼으로 설정할 수 있습니다.</p>
      </div>
      <ul className={styles.tierList}>
        {tiers.map((t) => (
          <TierCard
            key={t.threshold}
            tier={t}
            open={openAt === t.threshold}
            onToggleOpen={() => setOpenAt(openAt === t.threshold ? null : t.threshold)}
            onSaved={(next, msg) => {
              replace(next);
              setToast(msg);
            }}
            onError={setToast}
            onClose={() => setOpenAt(null)}
          />
        ))}
      </ul>
      <Toast message={toast} onDone={clearToast} />
    </div>
  );
}

function TierCard({
  tier,
  open,
  onToggleOpen,
  onSaved,
  onError,
  onClose
}: {
  tier: TitleTier;
  open: boolean;
  onToggleOpen: () => void;
  onSaved: (t: TitleTier, message: string) => void;
  onError: (message: string) => void;
  onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const label = `누적 후원 금액 ${formatNumber(tier.threshold)}FN`;

  const toggle = async (enabled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await setTitleEnabled(tier.threshold, enabled);
      if (r.status === "SAVED") onSaved(r.tier, enabled ? "칭호를 사용합니다." : "칭호를 사용하지 않습니다.");
      else onError(messageOf(r) ?? "저장하지 못했습니다.");
    } catch {
      onError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className={`${styles.tierCard} ${open ? styles.tierOpen : ""}`}>
      <div className={styles.tierHead}>
        <div className={styles.tierSummary}>
          <strong>{label}</strong>
          {open ? (
            <span className={styles.editing}>[설정 편집 중]</span>
          ) : tier.name ? (
            <span className={styles.tierName} style={{ color: tier.color }}>
              {tier.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- uploaded icons are data URLs in the mock
                <img src={tier.iconUrl} alt="" className={styles.tierIconSmall} />
              ) : (
                <span aria-hidden="true">👑</span>
              )}
              {tier.name}
            </span>
          ) : (
            <span className={styles.helper}>설정 버튼을 눌러 칭호를 설정해 주세요.</span>
          )}
        </div>
        <div className={styles.inline}>
          <Toggle label={`${label} 칭호 사용`} checked={tier.enabled} onChange={toggle} busy={busy} />
          <button type="button" className={open ? styles.solidPurple : styles.ghostButton} aria-expanded={open} onClick={onToggleOpen}>
            {open ? "설정 접기 ▲" : "설정 ▼"}
          </button>
        </div>
      </div>
      {open && (
        <TierEditor
          tier={tier}
          onCancel={onClose}
          onSaved={(t) => {
            onSaved(t, "변경사항을 저장했습니다.");
            onClose();
          }}
        />
      )}
    </li>
  );
}

function TierEditor({ tier, onCancel, onSaved }: { tier: TitleTier; onCancel: () => void; onSaved: (t: TitleTier) => void }) {
  const id = useId();
  const [name, setName] = useState(tier.name);
  const [description, setDescription] = useState(tier.description);
  const [color, setColor] = useState(tier.color);
  const [file, setFile] = useState<File | null>(null);
  const [removeIcon, setRemoveIcon] = useState(false);
  const [preview, setPreview] = useState<string | null>(tier.iconUrl);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Revoke object URLs created for the local preview.
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const fd = new FormData();
    fd.set("threshold", String(tier.threshold));
    fd.set("name", name);
    fd.set("description", description);
    fd.set("color", color);
    if (file) fd.set("icon", file);
    if (removeIcon && !file) fd.set("removeIcon", "1");
    try {
      const r = await saveTitleTier(fd);
      if (r.status === "SAVED") onSaved(r.tier);
      else setError(messageOf(r));
    } catch {
      setError("저장하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.tierBody} aria-busy={busy}>
      <label className={styles.field} htmlFor={`${id}-name`}>
        <span className={styles.lineLabel}>칭호명 설정 (최대 {TITLE_NAME_MAX}자)</span>
        <input
          id={`${id}-name`}
          className={styles.input}
          maxLength={TITLE_NAME_MAX}
          placeholder={`미설정 칭호입니다. 칭호명을 입력해주세요. (최대 ${TITLE_NAME_MAX}자)`}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className={styles.field} htmlFor={`${id}-desc`}>
        <span className={styles.lineLabel}>칭호 설명 설정</span>
        <input
          id={`${id}-desc`}
          className={styles.input}
          maxLength={TITLE_DESCRIPTION_MAX}
          placeholder="도네이터에게 보여질 칭호 설명입니다."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>
      <div className={styles.field}>
        <span className={styles.lineLabel}>칭호 아이콘 / 배지 등록</span>
        <div className={styles.inline}>
          <input
            ref={fileRef}
            type="file"
            accept={PROFILE_PHOTO_TYPES.join(",")}
            className={styles.srOnly}
            aria-label="칭호 아이콘 파일"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setRemoveIcon(false);
            }}
          />
          <button type="button" className={styles.uploadTile} aria-label="칭호 아이콘 업로드" onClick={() => fileRef.current?.click()}>
            +
          </button>
          <span className={styles.iconPreview} aria-label="칭호 아이콘 미리보기" role="img">
            {preview && !removeIcon ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL / data URL preview
              <img src={preview} alt="" />
            ) : (
              <span aria-hidden="true">👑</span>
            )}
          </span>
          {(file || (tier.iconUrl && !removeIcon)) && (
            <button
              type="button"
              className={styles.ghostButton}
              onClick={() => {
                setFile(null);
                setPreview(null);
                setRemoveIcon(true);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              기본 아이콘 사용
            </button>
          )}
        </div>
      </div>
      <div className={styles.field}>
        <span className={styles.lineLabel}>칭호 표시 색상 (Hex 코드)</span>
        <span className={`${styles.colorField} ${isHex(color) ? "" : styles.colorInvalid}`}>
          <input
            aria-label="칭호 표시 색상"
            value={color}
            maxLength={7}
            spellCheck={false}
            onChange={(e) => {
              const v = e.target.value.trim();
              setColor(v.startsWith("#") ? v : `#${v}`);
            }}
          />
          <input type="color" aria-label="칭호 표시 색상 선택" value={isHex(color) ? color.toLowerCase() : "#ffffff"} onChange={(e) => setColor(e.target.value.toUpperCase())} />
        </span>
        <span className={styles.helper}>도네이션 메시지 팝업에서 이 색상으로 강조 표시됩니다.</span>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.editorActions}>
        <button type="button" className={styles.ghostButton} onClick={onCancel} disabled={busy}>
          취소
        </button>
        <button type="button" className={styles.solidPurple} onClick={save} disabled={busy}>
          {busy ? "저장 중…" : "변경사항 저장"}
        </button>
      </div>
    </div>
  );
}
