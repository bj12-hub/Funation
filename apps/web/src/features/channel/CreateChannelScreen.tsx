"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { checkChannelSlug, createChannel } from "@/services/channel/channel";
import { CHANNEL_INTRO_MAX, CHANNEL_SLUG_RULE, type SlugCheck } from "@/services/channel/channelTypes";
import styles from "./channel.module.css";

const BENEFITS = [
  { title: "후원 받기", text: "팬들에게 FN 후원과 다양한 후원 콘텐츠를 받을 수 있어요." },
  { title: "크루 운영", text: "크루 멤버를 등록하고 멤버별 후원과 방송 점수판을 운영해요." },
  { title: "위젯·오버레이", text: "후원 알림과 점수판을 방송 화면에 띄울 수 있어요." },
  { title: "정산", text: "받은 후원을 정산 등록 후 신청할 수 있어요." }
];

/**
 * 채널 만들기 — code-first (no Figma frame). Route `/channel/new`. The slug check is advisory; the
 * server validates everything again and grants the Creator role.
 */
export function CreateChannelScreen() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [intro, setIntro] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [slugState, setSlugState] = useState<SlugCheck["status"] | "CHECKING" | null>(null);
  const [error, setError] = useState<{ field?: string; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // Debounced availability check while typing.
  useEffect(() => {
    if (!slug) return setSlugState(null);
    if (!CHANNEL_SLUG_RULE.test(slug)) return setSlugState("INVALID");
    setSlugState("CHECKING");
    const t = setTimeout(() => checkChannelSlug(slug).then((r) => setSlugState(r.status)), 350);
    return () => clearTimeout(t);
  }, [slug]);

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createChannel({ slug, name, intro, agreed });
      if (res.status === "CREATED") {
        router.push("/creator");
        router.refresh();
      } else if (res.status === "SLUG_TAKEN") {
        setSlugState("TAKEN");
        setError({ field: "slug", text: "이미 사용 중인 주소예요." });
      } else if (res.status === "INVALID") setError({ field: res.field, text: res.message });
      else if (res.status === "ALREADY_CREATOR") router.push("/creator");
      else router.push("/login?next=/channel/new");
    });
  };

  const slugHint =
    slugState === "INVALID"
      ? "영문 소문자, 숫자, 하이픈으로 3~30자 (하이픈으로 시작·끝 불가)"
      : slugState === "TAKEN"
        ? "이미 사용 중인 주소예요."
        : slugState === "AVAILABLE"
          ? "사용할 수 있는 주소예요."
          : slugState === "CHECKING"
            ? "확인 중..."
            : "영문 소문자, 숫자, 하이픈 (3~30자)";

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>내 채널 만들기</h1>
        <p className={styles.subtitle}>채널을 만들면 크리에이터 스튜디오를 쓸 수 있어요.</p>
      </header>

      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label className={styles.field}>
          <span className={styles.label}>
            채널 주소 <span className={styles.req}>*</span>
          </span>
          <span className={styles.prefixInput}>
            <span className={styles.prefix}>ssumnation.com/c/</span>
            <input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 30))} maxLength={30} aria-describedby="ch-slug-hint" />
          </span>
          <span id="ch-slug-hint" className={styles.hint} data-tone={slugState === "AVAILABLE" ? "ok" : slugState === "TAKEN" || slugState === "INVALID" ? "error" : undefined}>
            {slugHint}
          </span>
        </label>

        <label className={styles.field}>
          <span className={styles.label}>
            채널 이름 <span className={styles.req}>*</span>
          </span>
          <input className={styles.input} value={name} onChange={(e) => setName(e.target.value)} maxLength={20} placeholder="2~20자" />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>소개</span>
          <textarea className={styles.textarea} value={intro} onChange={(e) => setIntro(e.target.value)} maxLength={CHANNEL_INTRO_MAX} placeholder="어떤 방송을 하는지 알려 주세요." />
          <span className={styles.hint}>
            {intro.length} / {CHANNEL_INTRO_MAX}
          </span>
        </label>

        <label className={styles.agree}>
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
          <span>
            <Link href="/terms/creator" target="_blank" className={styles.link}>
              크리에이터 이용약관
            </Link>
            에 동의합니다 (필수)
          </span>
        </label>

        {error && (
          <p className={styles.error} role="alert">
            {error.text}
          </p>
        )}

        <button type="submit" className={styles.submit} disabled={pending || !agreed || slugState !== "AVAILABLE" || !name.trim()} aria-busy={pending || undefined}>
          {pending ? "만드는 중..." : "채널 만들기"}
        </button>
        <p className={styles.note}>채널 승인 절차와 후원 수령 전 인증 요건은 아직 정해지지 않았어요(TBD).</p>
      </form>

      <section aria-labelledby="ch-benefits">
        <h2 id="ch-benefits" className={styles.subTitle}>
          채널을 만들면
        </h2>
        <ul className={styles.benefits}>
          {BENEFITS.map((b) => (
            <li key={b.title}>
              <strong>{b.title}</strong>
              <span>{b.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
