"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { formatNumber } from "@/lib/format";
import { saveEquipSettings } from "@/services/supporter/identity";
import {
  GLOBAL_TITLES,
  GRADES,
  STORE_TITLES,
  globalTitleLabel,
  gradeLabel,
  storeTitleLabel,
  type EquipSettings,
  type Progress,
  type SupporterIdentity
} from "@/services/supporter/identityTypes";
import styles from "./supporter.module.css";

/**
 * 칭호·등급 — code-first (no Figma frame). Route `/mypage/titles`. Grade, titles and progress are
 * server values; the preview only combines the labels the server returned with the chosen slots.
 * Thresholds are placeholders (TBD).
 */
export function TitlesScreen({ identity }: { identity: SupporterIdentity }) {
  const router = useRouter();
  const [equip, setEquip] = useState<EquipSettings>(identity.equip);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = JSON.stringify(equip) !== JSON.stringify(identity.equip);
  const def = identity.nicknames.find((n) => n.isDefault)!;
  const topStore = identity.stores.find((s) => s.title);

  const globalShown = equip.globalTitle === "OFF" ? null : equip.globalTitle === "AUTO" ? identity.global.best : equip.globalTitle;
  const badges = [
    equip.showGrade && identity.grade.key !== "FRIEND" ? gradeLabel(identity.grade.key) : null,
    globalShown ? globalTitleLabel(globalShown) : null,
    equip.showStoreTitle && topStore?.title ? storeTitleLabel(topStore.title) : null
  ].filter(Boolean) as string[];

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const res = await saveEquipSettings(equip);
      if (res.status === "SAVED") {
        setMessage({ tone: "ok", text: "표시 설정을 저장했어요." });
        router.refresh();
      } else if (res.status === "UNAUTHORIZED") router.push("/login?next=/mypage/titles");
      else setMessage({ tone: "error", text: res.message });
    });
  };

  return (
    <div className={styles.content}>
      <nav className={styles.breadcrumb} aria-label="현재 위치">
        <Link href="/mypage">마이페이지</Link> <span aria-hidden="true">›</span> <span aria-current="page">칭호·등급</span>
      </nav>
      <header className={styles.header}>
        <h1 className={styles.title}>칭호·등급</h1>
        <p className={styles.subtitle}>후원 알림과 랭킹에 붙는 등급과 칭호를 확인하고, 어떻게 보일지 정하세요.</p>
      </header>

      <section className={styles.card} aria-labelledby="st-preview">
        <div className={styles.cardHead}>
          <h2 id="st-preview" className={styles.cardTitle}>
            후원 알림 미리보기
          </h2>
          <span className={styles.segment} role="group" aria-label="미리보기 배경">
            {(["dark", "light"] as const).map((t) => (
              <button key={t} type="button" aria-pressed={theme === t} onClick={() => setTheme(t)}>
                {t === "dark" ? "어두움" : "밝음"}
              </button>
            ))}
          </span>
        </div>
        <div className={styles.preview} data-theme={theme}>
          <span className={styles.previewBadges}>
            {badges.map((b) => (
              <span key={b} className={styles.badge}>
                {b}
              </span>
            ))}
          </span>
          <strong>{def.name} 님 10,000 FN 후원!</strong>
          <span className={styles.previewMsg}>오늘 방송도 응원합니다!</span>
        </div>
        {badges.length === 0 && <p className={styles.note}>표시할 등급·칭호가 없어서 닉네임만 나가요.</p>}
      </section>

      <section className={styles.card} aria-labelledby="st-equip">
        <h2 id="st-equip" className={styles.cardTitle}>
          표시 설정
        </h2>
        <label className={styles.switchRow}>
          <span>등급 배지 표시</span>
          <input type="checkbox" checked={equip.showGrade} onChange={(e) => setEquip({ ...equip, showGrade: e.target.checked })} />
        </label>
        <label className={styles.switchRow}>
          <span>글로벌 칭호</span>
          <select className={styles.select} value={equip.globalTitle} onChange={(e) => setEquip({ ...equip, globalTitle: e.target.value as EquipSettings["globalTitle"] })}>
            <option value="AUTO">자동 — 항상 최고 칭호</option>
            <option value="OFF">표시 안 함</option>
            {identity.global.earned.map((k) => (
              <option key={k} value={k}>
                {globalTitleLabel(k)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.switchRow}>
          <span>크리에이터 칭호 표시 (크리에이터마다 자동)</span>
          <input type="checkbox" checked={equip.showStoreTitle} onChange={(e) => setEquip({ ...equip, showStoreTitle: e.target.checked })} />
        </label>
        {message && (
          <p className={message.tone === "error" ? styles.error : styles.ok} role={message.tone === "error" ? "alert" : "status"}>
            {message.text}
          </p>
        )}
        <div className={styles.actions}>
          <button type="button" className={styles.primary} onClick={save} disabled={!dirty || pending} aria-busy={pending || undefined}>
            {pending ? "저장 중..." : "저장"}
          </button>
        </div>
      </section>

      <section className={styles.card} aria-labelledby="st-grade">
        <h2 id="st-grade" className={styles.cardTitle}>
          내 등급 · {gradeLabel(identity.grade.key)}
        </h2>
        <p className={styles.muted}>최근 30일 후원 {formatNumber(identity.grade.last30Fn)} FN 기준으로 자동 계산돼요. 누적이 아니라서 후원이 줄면 등급이 내려갈 수 있어요.</p>
        <ProgressBar progress={identity.grade.progress} />
        <ol className={styles.ladder}>
          {GRADES.map((g) => (
            <li key={g.key} data-on={identity.grade.key === g.key || undefined}>
              <strong>{g.label}</strong>
              <span>{formatNumber(g.minFn)} FN~</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.card} aria-labelledby="st-global">
        <h2 id="st-global" className={styles.cardTitle}>
          글로벌 칭호 · {identity.global.earned.length} / {GLOBAL_TITLES.length}
        </h2>
        <p className={styles.muted}>Funation 전체 누적 후원 {formatNumber(identity.global.lifetimeFn)} FN 기준이에요. 어느 크리에이터에게 후원해도 붙어요.</p>
        <ProgressBar progress={identity.global.progress} />
        <ol className={styles.ladder}>
          {GLOBAL_TITLES.map((t) => (
            <li key={t.key} data-on={identity.global.earned.includes(t.key) || undefined}>
              <strong>{t.label}</strong>
              <span>{formatNumber(t.minFn)} FN~</span>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.card} aria-labelledby="st-store">
        <h2 id="st-store" className={styles.cardTitle}>
          크리에이터 칭호
        </h2>
        <p className={styles.muted}>크리에이터마다 따로 쌓여요. 후원한 적이 있는 크리에이터만 보여요.</p>
        {identity.stores.length === 0 ? (
          <p className={styles.empty}>아직 후원한 크리에이터가 없어요.</p>
        ) : (
          <ul className={styles.list}>
            {identity.stores.map((s) => (
              <li key={s.creatorId} className={styles.row}>
                <div className={styles.rowMain}>
                  <strong className={styles.rowTitle}>
                    {s.creatorName} {s.title && <span className={styles.chip}>{storeTitleLabel(s.title)}</span>}
                  </strong>
                  <span className={styles.muted}>누적 {formatNumber(s.totalFn)} FN</span>
                </div>
                <div className={styles.rowProgress}>
                  <ProgressBar progress={s.progress} compact />
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={styles.note}>칭호 단계: {STORE_TITLES.map((t) => `${t.label} ${formatNumber(t.minFn)} FN`).join(" · ")} (기준은 확정 전)</p>
      </section>
    </div>
  );
}

function ProgressBar({ progress, compact = false }: { progress: Progress; compact?: boolean }) {
  return (
    <div className={compact ? styles.progressCompact : styles.progress}>
      <span className={styles.bar} aria-hidden="true">
        <span style={{ width: `${progress.percent}%` }} />
      </span>
      <span className={styles.muted}>
        {progress.nextLabel && progress.nextMinFn !== null
          ? `다음 ${progress.nextLabel}까지 ${formatNumber(progress.nextMinFn - progress.currentFn)} FN`
          : "최고 단계예요"}
      </span>
    </div>
  );
}
