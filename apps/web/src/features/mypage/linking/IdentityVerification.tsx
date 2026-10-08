"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Modal } from "@/components/ui/Modal";
import { verifyIdentity, type VerificationMethod, type VerificationResult } from "@/services/account/linkingActions";
import { formatDotDate, formatDotDateTime } from "./format";
import styles from "./linking.module.css";

/**
 * Identity verification (본인인증).
 * Figma: method choice 743:2297 · already verified 750:153 · duplicate account 750:205
 * · attempts exceeded 750:257 · success 750:306
 * The provider hand-off itself (phone / i-PIN screens) is outside Ssumnation and TBD.
 */

const METHODS: { value: VerificationMethod; glyph: string; title: string; sub: string }[] = [
  { value: "PHONE", glyph: "P", title: "휴대폰 인증", sub: "본인 명의 휴대폰으로 인증" },
  { value: "IPIN", glyph: "I", title: "아이핀 인증", sub: "아이핀 ID로 안전하게 인증" }
];

type Result = Exclude<VerificationResult, { status: "INVALID" | "UNAUTHORIZED" }>;

export function IdentityVerification({ triggerClassName }: { triggerClassName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [method, setMethod] = useState<VerificationMethod>("PHONE");
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  function close() {
    setOpen(false);
    if (result?.status === "VERIFIED") router.refresh();
  }

  async function start() {
    setBusy(true);
    setError(false);
    try {
      const r = await verifyIdentity(method);
      if (r.status === "UNAUTHORIZED") return router.push("/login?next=/mypage");
      if (r.status === "INVALID") return setError(true);
      setResult(r);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  const view = result ? resultView(result) : null;

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => {
          setResult(null);
          setError(false);
          setOpen(true);
        }}
      >
        인증하기
      </button>
      <Modal
        open={open}
        onClose={close}
        title={view ? view.title : "본인인증"}
        description={view ? undefined : "안전한 서비스 이용을 위해 본인인증을 진행해 주세요."}
        customHeader={
          view && (
            <header className={`${styles.resultHeader} ${view.tone === "success" ? styles.success : styles.warning}`}>
              <div className={styles.resultLabelRow}>
                <span className={styles.resultLabel}>{view.label}</span>
                <button type="button" className={styles.close} aria-label="닫기" onClick={close}>
                  ×
                </button>
              </div>
              <div className={styles.resultRow}>
                <span className={styles.resultIcon} aria-hidden="true">
                  {view.tone === "success" ? "✓" : "!"}
                </span>
                <div className={styles.resultText}>
                  <h2 className={styles.resultTitle}>{view.title}</h2>
                  <p className={styles.resultDescription}>{view.description}</p>
                </div>
              </div>
            </header>
          )
        }
        footer={
          view ? (
            view.actions(close)
          ) : (
            <>
              <button type="button" className={styles.secondary} onClick={close}>
                취소
              </button>
              <button type="button" className={styles.primary} onClick={start} disabled={busy} aria-busy={busy || undefined}>
                인증 시작
              </button>
            </>
          )
        }
      >
        {view ? (
          <div className={`${styles.detailBox} ${view.tone === "success" ? styles.success : styles.warning}`}>
            <span className={styles.detailTitle}>{view.detailTitle}</span>
            <ul className={styles.detailRows}>{view.rows}</ul>
          </div>
        ) : (
          <div className={styles.content}>
            <div role="radiogroup" aria-label="인증 방법" className={styles.content}>
              {METHODS.map((m) => {
                const selected = method === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`${styles.card} ${selected ? styles.cardSelected : ""}`}
                    onClick={() => setMethod(m.value)}
                  >
                    <span className={styles.glyph} aria-hidden="true">
                      {m.glyph}
                    </span>
                    <span className={styles.cardText}>
                      <span className={styles.cardTitle}>{m.title}</span>
                      <span className={styles.cardSub}>{m.sub}</span>
                    </span>
                    <span className={`${styles.radio} ${selected ? styles.radioOn : ""}`} aria-hidden="true" />
                  </button>
                );
              })}
            </div>
            <p className={styles.infoBox}>
              인증 시작을 누르면 선택한 인증 서비스로 이동합니다. 인증 정보는 본인 확인 외의 용도로 사용되지 않습니다.
            </p>
            {error && (
              <p className={styles.fieldError} role="alert">
                일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요
              </p>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}

/** Minutes until the server-provided unlock time (Figma 750:257 "약 30분 후"). */
function minutesUntil(iso: string) {
  return Math.max(1, Math.ceil((new Date(iso).getTime() - Date.now()) / 60_000));
}

function Row({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <li>
      <span>
        {label && <span className={styles.detailLabel}>{label}</span>}
        {children}
      </span>
    </li>
  );
}

type View = {
  tone: "success" | "warning";
  label: string;
  title: string;
  description: string;
  detailTitle: string;
  rows: ReactNode;
  actions: (close: () => void) => ReactNode;
};

/** 닫기 + a primary button that also just closes (Figma 750:153 · 750:306). */
function closeAndConfirm(primary: string) {
  return function renderActions(close: () => void) {
    return (
      <>
        <button type="button" className={styles.secondary} onClick={close}>
          닫기
        </button>
        <button type="button" className={styles.primary} onClick={close}>
          {primary}
        </button>
      </>
    );
  };
}

function resultView(r: Result): View {

  switch (r.status) {
    case "VERIFIED":
      return {
        tone: "success",
        label: "본인인증 완료",
        title: "본인인증이 완료되었어요",
        description: "이제 썸네이션의 모든 서비스를 안전하게 이용할 수 있습니다.",
        detailTitle: "인증 결과",
        rows: (
          <>
            <Row label="인증자">{r.name}</Row>
            <Row label="완료 일시">{formatDotDateTime(r.verifiedAt)}</Row>
          </>
        ),
        actions: closeAndConfirm("마이페이지로 돌아가기")
      };
    case "ALREADY_VERIFIED":
      return {
        tone: "success",
        label: "인증 완료 계정",
        title: "이미 본인인증이 완료되었어요",
        description: "현재 계정은 안전하게 본인인증이 완료된 상태입니다.",
        detailTitle: "인증 정보",
        rows: (
          <>
            <Row label="인증자">{r.name}</Row>
            <Row label="생년월일">{formatDotDate(r.birthDate)}</Row>
            <Row label="완료 일시">{formatDotDateTime(r.verifiedAt)}</Row>
          </>
        ),
        actions: closeAndConfirm("확인")
      };
    case "DUPLICATE":
      return {
        tone: "warning",
        label: "중복 가입 안내",
        title: "동일 명의의 계정이 있어요",
        description: "입력한 본인정보로 이미 가입된 계정이 확인되었습니다.",
        detailTitle: "가입 계정",
        rows: (
          <>
            <Row label="썸네이션 ID">{r.maskedSsumnationId}</Row>
            <Row label="가입일">{formatDotDate(r.joinedAt)}</Row>
            <Row>개인정보 보호를 위해 일부 정보만 표시됩니다.</Row>
          </>
        ),
        // TBD: Figma does not define these destinations; the closest existing screens are used.
        actions: () => (
          <>
            <Link href="/login" className={styles.secondary}>
              로그인으로 돌아가기
            </Link>
            <Link href="/password-reset" className={styles.primary}>
              내 계정 찾기
            </Link>
          </>
        )
      };
    case "LOCKED":
      return {
        tone: "warning",
        label: "인증 일시 제한",
        title: "인증 시도 횟수를 초과했어요",
        description: "안전한 이용을 위해 본인인증이 잠시 제한되었습니다.",
        detailTitle: "다시 시도 가능",
        rows: (
          <>
            <Row label="제한 해제 시각">{formatDotDateTime(r.retryAt)}</Row>
            <Row>약 {minutesUntil(r.retryAt)}분 후 다시 시도해 주세요.</Row>
          </>
        ),
        actions: (close) => (
          <>
            <Link href="/support" className={styles.secondary}>
              고객센터 안내
            </Link>
            <button type="button" className={styles.primary} onClick={close}>
              확인
            </button>
          </>
        )
      };
  }
}
