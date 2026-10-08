"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deleteAsset, renameAsset, uploadAsset } from "@/services/creator/assets";
import { ASSET_LIMITS, ASSET_SORTS, ASSET_TYPES, filterAssets, pairOf, type Asset, type AssetKind, type AssetResult, type AssetSort } from "@/services/creator/assetTypes";
import styles from "../../crew/crew.module.css";
import local from "./library.module.css";

const KIND_LABEL: Record<AssetKind, string> = { IMAGE: "이미지", SOUND: "사운드" };
const size = (bytes: number) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`);

/**
 * 이미지·사운드 라이브러리 — code-first (no Figma frame). Route `/creator/widgets/assets`.
 * Files here are used by 배너 (slides) and 시그니처 후원 (images, and sounds — an image and a sound with the same
 * name pair up, 자동 매칭 2026-10-06). Name search, 정렬 and a 짝 filter (funnation "정렬·필터") work on the loaded
 * list. Upload policy and review are TBD.
 */
export function AssetsScreen({ items }: { items: Asset[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<AssetKind>("IMAGE");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<AssetSort>("NEW");
  const [pairedOnly, setPairedOnly] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [note, setNote] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (action: () => Promise<AssetResult>, okText: string, after?: () => void) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "SAVED" || res.status === "DELETED") {
          setNote({ tone: "ok", text: okText });
          after?.();
          router.refresh();
        } else setNote({ tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
      } catch {
        setNote({ tone: "error", text: "처리하지 못했어요. 파일 크기를 확인하고 다시 시도해 주세요." });
      }
    });
  };

  const upload = (files: FileList | null) => {
    const list = [...(files ?? [])];
    if (!list.length) return;
    setNote(null);
    startTransition(async () => {
      let ok = 0;
      let error: string | null = null;
      for (const file of list) {
        const fd = new FormData();
        fd.set("requestId", crypto.randomUUID());
        fd.set("file", file);
        try {
          const res = await uploadAsset(fd);
          if (res.status === "SAVED") ok++;
          else error = res.status === "INVALID" ? `${file.name}: ${res.message}` : "로그인이 필요합니다.";
        } catch {
          error = `${file.name}: 올리지 못했어요.`;
        }
      }
      if (fileRef.current) fileRef.current.value = "";
      setNote(error ? { tone: "error", text: ok ? `${ok}개를 올렸어요. ${error}` : error } : { tone: "ok", text: `${ok}개를 올렸어요.` });
      router.refresh();
    });
  };

  const ofKind = items.filter((a) => a.kind === tab).length;
  const shown = filterAssets(items, { kind: tab, query, sort, pairedOnly });
  const used = items.reduce((sum, a) => sum + a.size, 0);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>이미지·사운드</h1>
        <p className={styles.subtitle}>위젯이 쓰는 이미지와 사운드를 올리고 관리해요. 배너 슬라이드와 시그니처 이미지에서 골라 쓸 수 있어요.</p>
        <p className={styles.note}>
          <Link href="/creator/widgets">← 위젯</Link> · 사용 {size(used)} / {ASSET_LIMITS.totalBytes / 1024 / 1024}MB · {items.length}/{ASSET_LIMITS.max}개
        </p>
      </header>

      <section className={styles.card} aria-labelledby="asset-upload">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="asset-upload">
            ⬆️ 파일 올리기
          </h2>
          <button type="button" className={styles.primary} disabled={pending} onClick={() => fileRef.current?.click()}>
            {pending ? "처리 중…" : "파일 선택"}
          </button>
          <input
            ref={fileRef}
            className={local.hiddenInput}
            type="file"
            multiple
            accept={[...ASSET_TYPES.IMAGE, ...ASSET_TYPES.SOUND].join(",")}
            aria-label="올릴 파일"
            onChange={(e) => upload(e.target.files)}
          />
        </div>
        <p className={styles.note}>
          이미지 PNG · JPG · GIF · WEBP ({ASSET_LIMITS.bytes.IMAGE / 1024 / 1024}MB 이하), 사운드 MP3 · WAV · OGG ({ASSET_LIMITS.bytes.SOUND / 1024 / 1024}MB 이하). 저작권이 있는 파일은 올리지
          마세요 (검수 정책 TBD).
        </p>
        <p className={styles.note}>
          이미지와 사운드의 이름이 같으면(예: 축하.png · 축하.mp3) 짝으로 묶여요. <Link href="/creator/widgets/signatures">시그니처</Link>에 그 이미지를 고르면 사운드가 소리로 함께 붙어요.
        </p>
        <p className={styles.note}>
          올린 이미지 여러 장을 <Link href="/creator/widgets/signatures?bulk=1">시그니처로 한 번에 만들 수</Link> 있어요. 파일 이름에 가격을 넣어 두면(예: 1004 하트.png) 가격 칸이
          채워져요.
        </p>
      </section>

      <section className={styles.card} aria-labelledby="asset-list">
        <div className={styles.cardHead}>
          <h2 className={styles.cardTitle} id="asset-list">
            📁 라이브러리
          </h2>
          <div className={styles.tabs} role="tablist" aria-label="파일 종류">
            {(Object.keys(KIND_LABEL) as AssetKind[]).map((k) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} aria-current={tab === k ? "page" : undefined} className={styles.tab} onClick={() => setTab(k)}>
                {KIND_LABEL[k]} {items.filter((a) => a.kind === k).length}
              </button>
            ))}
          </div>
        </div>
        {ofKind > 0 && (
          <div className={local.filters}>
            <input
              className={styles.input}
              type="search"
              placeholder="이름으로 찾기"
              aria-label="이름으로 찾기"
              maxLength={ASSET_LIMITS.nameMax}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <select className={styles.select} aria-label="정렬" value={sort} onChange={(e) => setSort(e.target.value as AssetSort)}>
              {ASSET_SORTS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className={styles.checkRow}>
              <input type="checkbox" checked={pairedOnly} onChange={(e) => setPairedOnly(e.target.checked)} />
              짝 있는 파일만
            </label>
            <span className={styles.muted} role="status">
              {shown.length === ofKind ? `${ofKind}개` : `${ofKind}개 중 ${shown.length}개`}
            </span>
          </div>
        )}
        {ofKind === 0 ? (
          <p className={styles.empty}>아직 올린 {KIND_LABEL[tab]}가 없어요.</p>
        ) : shown.length === 0 ? (
          <p className={styles.empty}>조건에 맞는 {KIND_LABEL[tab]}가 없어요. 검색어나 필터를 바꿔 보세요.</p>
        ) : (
          <ul className={tab === "IMAGE" ? local.grid : styles.list}>
            {shown.map((a) => (
              <li key={a.id} className={tab === "IMAGE" ? local.tile : styles.row}>
                {a.kind === "IMAGE" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={local.preview} src={a.url} alt={a.name} />
                ) : (
                  <audio className={local.audio} src={a.url} controls preload="none" aria-label={`${a.name} 미리 듣기`} />
                )}
                <div className={styles.rowMain}>
                  {editing?.id === a.id ? (
                    <input
                      className={styles.input}
                      aria-label="새 이름"
                      maxLength={ASSET_LIMITS.nameMax}
                      value={editing.name}
                      onChange={(e) => setEditing({ id: a.id, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Enter" && run(() => renameAsset(editing), "이름을 바꿨어요.", () => setEditing(null))}
                    />
                  ) : (
                    <span className={styles.rowTitle}>{a.name}</span>
                  )}
                  <span className={styles.muted}>
                    {a.mime.split("/")[1].toUpperCase()} · {size(a.size)}
                    {pairOf(a, items) && ` · 🔗 ${a.kind === "IMAGE" ? "사운드" : "이미지"} 짝`}
                  </span>
                </div>
                <div className={styles.rowActions}>
                  {editing?.id === a.id ? (
                    <button type="button" className={styles.ghost} disabled={pending} onClick={() => run(() => renameAsset(editing), "이름을 바꿨어요.", () => setEditing(null))}>
                      저장
                    </button>
                  ) : (
                    <button type="button" className={styles.ghost} disabled={pending} onClick={() => setEditing({ id: a.id, name: a.name })}>
                      이름 변경
                    </button>
                  )}
                  <button
                    type="button"
                    className={styles.danger}
                    disabled={pending}
                    onClick={() => window.confirm(`'${a.name}'을(를) 지울까요? 이 파일을 쓰는 배너 슬라이드는 건너뛰고, 시그니처는 기본 이미지로 바뀌어요.`) && run(() => deleteAsset(a.id), "파일을 지웠어요.")}
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {note && (
        <p className={note.tone === "error" ? styles.error : styles.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
