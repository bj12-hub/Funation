"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FLEXTV_WEB_URL } from "@/lib/flextv/mode";
import { becomeStreamer } from "@/services/channel/flextvStreamer";
import { STREAM_POLICY, type StreamerGate } from "@/services/channel/streamerTypes";
import styles from "./channel.module.css";

const BENEFITS = [
  { title: "방송하기", text: "OBS로 FLEXTV에 송출하고, 방송 시작 · 종료와 제목을 스튜디오에서 바꿔요." },
  { title: "후원 받기", text: "썸네이션과 FLEXTV에서 보낸 후원이 같은 렉스로 쌓여요." },
  { title: "수익 확인", text: "받은 후원과 후원자를 대시보드와 수익 현황에서 봐요." },
  { title: "정산", text: "받은 렉스를 FLEXTV 기준으로 환전 신청해요." }
];

const GATE: Record<Exclude<StreamerGate, "ELIGIBLE">, { title: string; text: string; href?: string; action?: string }> = {
  IDENTITY_REQUIRED: {
    title: "본인인증이 필요해요",
    text: "방송은 본인인증을 마친 회원만 할 수 있어요. FLEXTV에서 본인인증을 마친 뒤 이 페이지로 돌아와 주세요.",
    href: `${FLEXTV_WEB_URL}/my/personal-auth`,
    action: "FLEXTV에서 본인인증하기"
  },
  FOREIGNER: {
    title: "해외 스트리머는 문의로 등록해요",
    text: "해외 회원의 방송인 등록은 FLEXTV 고객센터 1:1 문의로 진행해요.",
    href: `${FLEXTV_WEB_URL}/cs/inquiry`,
    action: "FLEXTV 1:1 문의하기"
  },
  UNDER_AGE: { title: "만 14세부터 방송할 수 있어요", text: "본인인증 정보 기준으로 만 14세 이상 회원만 방송인으로 등록할 수 있어요." }
};

/**
 * 내 채널 만들기 with FLEXTV (phase 5; code-first, no Figma frame). Route `/channel/new`. A FLEXTV member's channel
 * already exists: becoming a streamer is FLEXTV's 방송인 등록, after its 방송 준수사항. The server checks everything again.
 */
export function FlextvStreamerScreen({ gate: initialGate }: { gate: StreamerGate }) {
  const router = useRouter();
  const [gate, setGate] = useState(initialGate);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await becomeStreamer({ agreed });
      if (res.status === "REGISTERED" || res.status === "ALREADY_CREATOR") {
        router.push("/creator/broadcast");
        router.refresh();
      } else if (res.status === "INVALID") setError(res.message);
      else if (res.status === "PENDING") setError("방송인 등록을 마무리하지 못했어요. FLEXTV 고객센터에 문의해 주세요.");
      else if (res.status === "UNKNOWN") setError("FLEXTV에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.");
      else if (res.status === "UNAUTHORIZED") router.push("/login?next=/channel/new");
      else setGate(res.status);
    });
  };

  const blocked = gate === "ELIGIBLE" ? null : GATE[gate];

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <h1 className={styles.title}>방송 시작하기</h1>
        <p className={styles.subtitle}>FLEXTV 방송인으로 등록하면 크리에이터 스튜디오를 쓸 수 있어요.</p>
      </header>

      {blocked ? (
        <section className={styles.card} aria-labelledby="streamer-gate">
          <h2 id="streamer-gate" className={styles.subTitle}>
            {blocked.title}
          </h2>
          <p className={styles.note}>{blocked.text}</p>
          {blocked.href && (
            <a className={styles.submit} href={blocked.href} target="_blank" rel="noopener noreferrer">
              {blocked.action}
            </a>
          )}
        </section>
      ) : (
        <form
          className={styles.card}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <section aria-labelledby="stream-policy">
            <h2 id="stream-policy" className={styles.subTitle}>
              FLEXTV 방송 준수사항
            </h2>
            <ul className={styles.benefits}>
              {STREAM_POLICY.map((line) => (
                <li key={line}>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          <label className={styles.agree}>
            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>방송 준수사항을 지키겠습니다 (필수)</span>
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button type="submit" className={styles.submit} disabled={pending || !agreed} aria-busy={pending || undefined}>
            {pending ? "등록하는 중..." : "방송인으로 등록하기"}
          </button>
          <p className={styles.note}>채널 이름과 주소는 FLEXTV 채널을 그대로 써요.</p>
        </form>
      )}

      <section aria-labelledby="ch-benefits">
        <h2 id="ch-benefits" className={styles.subTitle}>
          방송인이 되면
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
