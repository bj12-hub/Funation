"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition, type ReactNode } from "react";
import { Toast } from "@/components/ui/Toast";
import { saveDonationTypeSettings } from "@/services/creator/flextvDonationTypes";
import {
  MINI_MAX_FN,
  MINI_PALETTE,
  WISHLIST_MAX,
  WISHLIST_NAME_MAX,
  WISHLIST_NOTE_MAX,
  parseTypeSettings,
  type DonationTypeSettings,
  type GachaDraft
} from "@/services/creator/donationTypeSettings";
import { GACHA_MAX, GACHA_NAME_MAX, GACHA_PRIZES_MAX, ROULETTE_ITEMS_MAX, ROULETTE_ITEMS_MIN, ROULETTE_ITEM_MAX_CHARS } from "@/services/creator/widgetSettingsTypes";
import styles from "./donationTypes.module.css";

const num = (value: string) => (value === "" ? 0 : Math.max(0, Math.floor(Number(value)) || 0));

/**
 * 후원 종류 설정 (phase 6; code-first, no Figma frame). Route `/creator/donation-types`, with FLEXTV and its Ssumnation
 * endpoints. What a FLEXTV channel's room offers besides 일반 · 시그니처 · 영상: 미니 · 위시리스트 · 그림 · 룰렛 · 뽑기.
 * The screen shows the server's own check before saving; FLEXTV keeps the settings.
 */
export function DonationTypesScreen({ initial }: { initial: DonationTypeSettings }) {
  const router = useRouter();
  const [s, setS] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const clear = useCallback(() => setToast(null), []);
  const [pending, startTransition] = useTransition();
  const set = <K extends keyof DonationTypeSettings>(key: K, value: DonationTypeSettings[K]) => setS((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    const checked = parseTypeSettings(s);
    if ("invalid" in checked) return setError(checked.invalid);
    setError(null);
    startTransition(async () => {
      const r = await saveDonationTypeSettings(s);
      if (r.status === "SAVED") {
        setS(r.settings);
        setToast("저장했어요. 채널 방의 후원 종류에 바로 반영돼요.");
        router.refresh();
      } else if (r.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/donation-types");
      else setError(r.status === "INVALID" ? r.message : "FLEXTV가 응답하지 않았어요. 잠시 후 다시 저장해 주세요.");
    });
  };

  const rouletteSum = s.roulette.items.reduce((sum, i) => sum + i.percent, 0);

  return (
    <div className={styles.content}>
      <h1 className={styles.pageTitle}>후원 종류 설정</h1>
      <p className={styles.help}>채널 방에서 받을 썸네이션 후원을 켜고 조건을 정해요. 일반 · 시그니처 후원은 FLEXTV 설정 그대로, 영상 후원은 FLEXTV 도우미의 영상 후원 설정을 따라요.</p>

      <Section title="미니 후원" on={s.mini.enabled} onToggle={(enabled) => set("mini", { ...s.mini, enabled })} help={`화면에 짧은 글을 띄우는 후원이에요. ${MINI_MAX_FN.toLocaleString("ko-KR")} FN까지예요.`}>
        <div className={styles.row}>
          <NumberField label="최소 금액 (FN)" value={s.mini.minAmount} onChange={(minAmount) => set("mini", { ...s.mini, minAmount })} max={MINI_MAX_FN} />
          <NumberField label="최대 금액 (FN)" value={s.mini.maxAmount} onChange={(maxAmount) => set("mini", { ...s.mini, maxAmount })} max={MINI_MAX_FN} />
        </div>
        <fieldset className={styles.field}>
          <legend className={styles.label}>글자 색</legend>
          <div className={styles.chips}>
            {MINI_PALETTE.map((c) => (
              <label key={c.id} className={styles.check}>
                <input
                  type="checkbox"
                  checked={s.mini.colorIds.includes(c.id)}
                  onChange={(e) => set("mini", { ...s.mini, colorIds: e.target.checked ? [...s.mini.colorIds, c.id] : s.mini.colorIds.filter((id) => id !== c.id) })}
                />
                <span className={styles.swatch} style={{ background: c.hex }} aria-hidden="true" />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      </Section>

      <Section title="위시리스트" help={`시청자가 갖고 싶은 물건의 가격만큼 후원해요. ${WISHLIST_MAX}개까지, 판매 중인 것만 보여요.`}>
        {s.wishlist.length === 0 && <p className={styles.empty}>등록한 위시리스트가 없어요.</p>}
        {s.wishlist.map((w, i) => {
          const update = (patch: Partial<typeof w>) => set("wishlist", s.wishlist.map((x, j) => (j === i ? { ...x, ...patch } : x)));
          return (
            <div key={w.id ?? `new-${i}`} className={styles.itemRow}>
              <input className={`${styles.input} ${styles.emoji}`} value={w.emoji} onChange={(e) => update({ emoji: e.target.value.slice(0, 4) })} aria-label="이모지" />
              <input className={styles.input} value={w.name} onChange={(e) => update({ name: e.target.value })} maxLength={WISHLIST_NAME_MAX} placeholder="이름" aria-label="이름" />
              <input className={`${styles.input} ${styles.amount}`} inputMode="numeric" value={w.price || ""} onChange={(e) => update({ price: num(e.target.value) })} placeholder="가격 FN" aria-label="가격" />
              <input className={styles.input} value={w.note} onChange={(e) => update({ note: e.target.value })} maxLength={WISHLIST_NOTE_MAX} placeholder="메모 (선택)" aria-label="메모" />
              <label className={styles.check}>
                <input type="checkbox" checked={w.inStock} onChange={(e) => update({ inStock: e.target.checked })} />
                판매 중
              </label>
              <button type="button" className={styles.linkButton} onClick={() => set("wishlist", s.wishlist.filter((_, j) => j !== i))}>
                삭제
              </button>
            </div>
          );
        })}
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={s.wishlist.length >= WISHLIST_MAX}
          onClick={() => set("wishlist", [...s.wishlist, { id: null, emoji: "🎁", name: "", price: 0, note: "", inStock: true }])}
        >
          + 항목 추가
        </button>
      </Section>

      <Section title="그림 후원" on={s.drawing.enabled} onToggle={(enabled) => set("drawing", { ...s.drawing, enabled })} help="시청자가 그린 그림을 방송 화면에 띄워요.">
        <NumberField label="최소 금액 (FN)" value={s.drawing.minAmount} onChange={(minAmount) => set("drawing", { ...s.drawing, minAmount })} />
      </Section>

      <Section title="룰렛" on={s.roulette.enabled} onToggle={(enabled) => set("roulette", { ...s.roulette, enabled })} help="결과는 후원할 때 FLEXTV가 확률대로 정하고, 방송 화면에서 공개돼요. 당첨은 FN이 아닌 방송 속 상품 · 미션이에요.">
        <div className={styles.row}>
          <NumberField label="참여 금액 (FN 이상)" value={s.roulette.minAmount} onChange={(minAmount) => set("roulette", { ...s.roulette, minAmount })} />
          <NumberField label="1인 하루 참여 (0 = 제한 없음)" value={s.roulette.dailyLimit} onChange={(dailyLimit) => set("roulette", { ...s.roulette, dailyLimit })} max={100} />
        </div>
        {s.roulette.items.map((item, i) => (
          <div key={i} className={styles.itemRow}>
            <input
              className={styles.input}
              value={item.name}
              maxLength={ROULETTE_ITEM_MAX_CHARS}
              onChange={(e) => set("roulette", { ...s.roulette, items: s.roulette.items.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })}
              placeholder="항목 (꽝 = 꽝)"
              aria-label={`항목 ${i + 1}`}
            />
            <input
              className={`${styles.input} ${styles.amount}`}
              inputMode="numeric"
              value={item.percent || ""}
              onChange={(e) => set("roulette", { ...s.roulette, items: s.roulette.items.map((x, j) => (j === i ? { ...x, percent: num(e.target.value) } : x)) })}
              placeholder="%"
              aria-label={`항목 ${i + 1} 확률`}
            />
            <button type="button" className={styles.linkButton} disabled={s.roulette.items.length <= ROULETTE_ITEMS_MIN} onClick={() => set("roulette", { ...s.roulette, items: s.roulette.items.filter((_, j) => j !== i) })}>
              삭제
            </button>
          </div>
        ))}
        <div className={styles.inline}>
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={s.roulette.items.length >= ROULETTE_ITEMS_MAX}
            onClick={() => set("roulette", { ...s.roulette, items: [...s.roulette.items, { name: "", percent: 0 }] })}
          >
            + 항목 추가
          </button>
          <span className={styles.note} data-tone={rouletteSum === 100 ? undefined : "warn"}>
            확률 합계 {rouletteSum}%
          </span>
        </div>
      </Section>

      <Section title="뽑기" help={`가격만큼 후원하면 상품 하나를 뽑아요. ${GACHA_MAX}개까지 만들 수 있어요.`}>
        {s.gacha.length === 0 && <p className={styles.empty}>만든 뽑기가 없어요.</p>}
        {s.gacha.map((g, i) => (
          <GachaCard
            key={g.id ?? `new-${i}`}
            value={g}
            onChange={(next) => set("gacha", s.gacha.map((x, j) => (j === i ? next : x)))}
            onRemove={() => set("gacha", s.gacha.filter((_, j) => j !== i))}
          />
        ))}
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={s.gacha.length >= GACHA_MAX}
          onClick={() => set("gacha", [...s.gacha, { id: null, enabled: true, name: "", price: 1_000, mode: "PROBABILITY", limit: null, prizes: [{ name: "꽝", blank: true, percent: 50, left: null }, { name: "", blank: false, percent: 50, left: null }] }])}
        >
          + 뽑기 추가
        </button>
      </Section>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.saveBar}>
        <button type="button" className={styles.primaryButton} disabled={pending} aria-busy={pending || undefined} onClick={save}>
          {pending ? "저장하는 중..." : "저장"}
        </button>
      </div>
      <Toast message={toast} tone="neutral" onDone={clear} />
    </div>
  );
}

function Section({ title, help, on, onToggle, children }: { title: string; help: string; on?: boolean; onToggle?: (on: boolean) => void; children: ReactNode }) {
  return (
    <section className={styles.card} aria-label={title}>
      <div className={styles.cardHead}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {onToggle && (
          <label className={styles.check}>
            <input type="checkbox" checked={!!on} onChange={(e) => onToggle(e.target.checked)} aria-label={`${title} 받기`} />
            {on ? "받는 중" : "꺼짐"}
          </label>
        )}
      </div>
      <p className={styles.help}>{help}</p>
      {children}
    </section>
  );
}

function NumberField({ label, value, onChange, max }: { label: string; value: number; onChange: (value: number) => void; max?: number }) {
  return (
    <label className={styles.field}>
      <span className={styles.label}>{label}</span>
      <input className={styles.input} inputMode="numeric" value={String(value)} onChange={(e) => onChange(Math.min(max ?? Number.MAX_SAFE_INTEGER, num(e.target.value)))} />
    </label>
  );
}

function GachaCard({ value: g, onChange, onRemove }: { value: GachaDraft; onChange: (next: GachaDraft) => void; onRemove: () => void }) {
  const prize = (i: number, patch: Partial<GachaDraft["prizes"][number]>) => onChange({ ...g, prizes: g.prizes.map((p, j) => (j === i ? { ...p, ...patch } : p)) });
  const sum = g.prizes.reduce((s, p) => s + (p.percent ?? 0), 0);
  return (
    <div className={styles.subCard}>
      <div className={styles.cardHead}>
        <input className={styles.input} value={g.name} onChange={(e) => onChange({ ...g, name: e.target.value })} maxLength={GACHA_NAME_MAX} placeholder="뽑기 이름" aria-label="뽑기 이름" />
        <label className={styles.check}>
          <input type="checkbox" checked={g.enabled} onChange={(e) => onChange({ ...g, enabled: e.target.checked })} aria-label={`${g.name || "이 뽑기"} 받기`} />
          {g.enabled ? "받는 중" : "꺼짐"}
        </label>
        <button type="button" className={styles.linkButton} onClick={onRemove}>
          삭제
        </button>
      </div>
      <div className={styles.row}>
        <NumberField label="가격 (FN)" value={g.price} onChange={(price) => onChange({ ...g, price })} />
        <label className={styles.field}>
          <span className={styles.label}>1인 하루 횟수 (비우면 제한 없음)</span>
          <input className={styles.input} inputMode="numeric" value={g.limit ?? ""} onChange={(e) => onChange({ ...g, limit: e.target.value ? Math.min(100, num(e.target.value)) : null })} />
        </label>
        <label className={styles.field}>
          <span className={styles.label}>방식</span>
          <select
            className={styles.input}
            value={g.mode}
            onChange={(e) => {
              const mode = e.target.value === "STOCK" ? "STOCK" : "PROBABILITY";
              onChange({ ...g, mode, prizes: g.prizes.map((p) => (mode === "STOCK" ? { ...p, percent: null, left: p.left ?? 1 } : { ...p, left: null, percent: p.percent ?? 0 })) });
            }}
          >
            <option value="PROBABILITY">확률형</option>
            <option value="STOCK">재고형</option>
          </select>
        </label>
      </div>
      {g.prizes.map((p, i) => (
        <div key={i} className={styles.itemRow}>
          <input className={styles.input} value={p.name} onChange={(e) => prize(i, { name: e.target.value })} maxLength={GACHA_NAME_MAX} placeholder="상품" aria-label={`상품 ${i + 1}`} />
          {g.mode === "PROBABILITY" ? (
            <input className={`${styles.input} ${styles.amount}`} inputMode="numeric" value={p.percent || ""} onChange={(e) => prize(i, { percent: num(e.target.value) })} placeholder="%" aria-label={`상품 ${i + 1} 확률`} />
          ) : (
            <input className={`${styles.input} ${styles.amount}`} inputMode="numeric" value={p.left ?? ""} onChange={(e) => prize(i, { left: num(e.target.value) })} placeholder="재고" aria-label={`상품 ${i + 1} 재고`} />
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={p.blank} onChange={(e) => prize(i, { blank: e.target.checked })} />
            꽝
          </label>
          <button type="button" className={styles.linkButton} disabled={g.prizes.length <= 1} onClick={() => onChange({ ...g, prizes: g.prizes.filter((_, j) => j !== i) })}>
            삭제
          </button>
        </div>
      ))}
      <div className={styles.inline}>
        <button
          type="button"
          className={styles.secondaryButton}
          disabled={g.prizes.length >= GACHA_PRIZES_MAX}
          onClick={() => onChange({ ...g, prizes: [...g.prizes, { name: "", blank: false, percent: g.mode === "PROBABILITY" ? 0 : null, left: g.mode === "STOCK" ? 1 : null }] })}
        >
          + 상품 추가
        </button>
        {g.mode === "PROBABILITY" && (
          <span className={styles.note} data-tone={sum === 100 ? undefined : "warn"}>
            확률 합계 {sum}%
          </span>
        )}
      </div>
    </div>
  );
}
