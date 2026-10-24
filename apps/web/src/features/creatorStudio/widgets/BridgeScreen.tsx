"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatKstTime } from "@/lib/format";
import { saveBridgeRules } from "@/services/creator/bridge";
import {
  BRIDGE_BODY_MAX,
  BRIDGE_DELAY_MAX,
  BRIDGE_METHODS,
  BRIDGE_NAME_MAX,
  BRIDGE_OUTCOME_LABEL,
  BRIDGE_RULES_MAX,
  BRIDGE_TEMPLATES,
  BRIDGE_URL_MAX,
  BRIDGE_VARIABLES,
  SAMPLE_EVENT,
  renderRequest,
  type BridgeMethod,
  type BridgeRule,
  type BridgeView
} from "@/services/creator/bridgeTypes";
import { shownOverlayAddress } from "../crew/overlayAddress";
import crew from "../crew/crew.module.css";
import { CopyButton } from "../settings/SettingsCards";
import local from "./bridge.module.css";

/** The form keeps numbers as typed. */
type DraftRule = Omit<BridgeRule, "minFn" | "delaySec"> & { minFn: string; delaySec: string };
const toDraft = (r: BridgeRule): DraftRule => ({ ...r, minFn: String(r.minFn), delaySec: String(r.delaySec) });
const fromDraft = (r: DraftRule): BridgeRule => ({ ...r, name: r.name.trim(), url: r.url.trim(), minFn: Number(r.minFn), delaySec: Number(r.delaySec), body: r.method === "POST" ? r.body : "" });
type TestState = { tone: "ok" | "error" | "muted"; text: string };

/**
 * 외부 프로그램 연동 — code-first (no Figma frame; StreamDonate "외부 프로그램 API (조명 · Resolume · Companion)" 참고, P3).
 * Route `/creator/widgets/bridge`. The 연동 페이지 address (OBS browser source, or a tab with `?status`), the 규칙 (when: 최소
 * FN · 시그니처 · 테스트 후원 / then: GET · POST to an address with variables, 지연), 테스트 보내기 from this browser with a
 * sample 후원, 저장, and the latest sends the 연동 페이지 reported.
 */
export function BridgeScreen({ view }: { view: BridgeView }) {
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  // A newer saved value (another tab, a refresh) replaces the draft; edits stay until saved.
  const [draft, setDraft] = useState(() => view.rules.map(toDraft));
  const synced = useRef(JSON.stringify(view.rules));
  useEffect(() => {
    const next = JSON.stringify(view.rules);
    if (next !== synced.current) {
      synced.current = next;
      setDraft(view.rules.map(toDraft));
    }
  }, [view.rules]);
  const dirty = JSON.stringify(draft.map(fromDraft)) !== synced.current;
  const editRule = (id: string, patch: Partial<DraftRule>) => setDraft((d) => d.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // The sends the 연동 페이지 reports come in on their own.
  useEffect(() => {
    if (view.rules.length === 0) return;
    const poll = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(poll);
  }, [view.rules.length, router]);

  const [template, setTemplate] = useState("");
  const add = () => {
    const t = BRIDGE_TEMPLATES.find((x) => x.key === template);
    setDraft((d) => [
      ...d,
      {
        id: `rule-${crypto.randomUUID().slice(0, 8)}`,
        name: t ? t.label.slice(0, BRIDGE_NAME_MAX) : `규칙 ${d.length + 1}`,
        enabled: true,
        minFn: "0",
        signatureId: null,
        includeTest: true,
        delaySec: "0",
        method: t?.method ?? "GET",
        url: t?.url ?? "http://",
        body: t?.body ?? ""
      }
    ]);
  };
  const save = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await saveBridgeRules({ rules: draft.map(fromDraft) });
        if (res.status === "SAVED") {
          setMessage({ tone: "ok", text: "외부 연동 규칙을 저장했어요." });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/bridge");
        else setMessage({ tone: "error", text: res.message });
      } catch {
        setMessage({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
    });
  };

  // 테스트 보내기: the rule's request with a sample 후원, sent from this browser (the same way the 연동 페이지 sends).
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const test = async (r: DraftRule) => {
    const req = renderRequest(fromDraft(r), SAMPLE_EVENT);
    setTests((t) => ({ ...t, [r.id]: { tone: "muted", text: "보내는 중…" } }));
    try {
      await fetch(req.url, { method: req.method, body: req.method === "POST" ? req.body : undefined, mode: "no-cors", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
      setTests((t) => ({ ...t, [r.id]: { tone: "ok", text: `보냈어요: ${req.method} ${req.url} (프로그램의 응답 내용은 브라우저 보안상 볼 수 없어요)` } }));
    } catch {
      setTests((t) => ({ ...t, [r.id]: { tone: "error", text: `연결하지 못했어요: ${req.url} — 프로그램이 켜져 있는지, 주소 · 포트가 맞는지 확인해 주세요.` } }));
    }
  };

  const shown = shownOverlayAddress(origin, view.bridgePath);
  const full = `${origin}${view.bridgePath}`;

  return (
    <div className={crew.content}>
      <header className={crew.header}>
        <h1 className={crew.title}>외부 프로그램 연동</h1>
        <p className={crew.subtitle}>후원이 들어오면 조명 · Resolume · Companion 같은 방송 PC의 프로그램에 신호(HTTP 요청)를 보내요.</p>
        <p className={crew.note}>
          요청은 아래 &lsquo;연동 페이지&rsquo;가 열려 있는 PC에서 보내요 — 그래서 그 PC나 같은 네트워크의 프로그램(127.0.0.1 · 192.168.…)에 닿아요. 연동 페이지가 열려 있지 않으면 아무것도 보내지
          않아요. <Link href="/creator/remote">리모컨</Link> 기능 제어의 &lsquo;외부 프로그램 연동&rsquo;으로 켜고 꺼요.
        </p>
      </header>

      {message && (
        <p className={message.tone === "ok" ? crew.ok : crew.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      <section className={crew.card} aria-labelledby="bridge-page-title">
        <h2 id="bridge-page-title" className={crew.cardTitle}>
          🔌 연동 페이지
        </h2>
        <p className={crew.note}>OBS에 브라우저 소스로 추가하면(화면에는 아무것도 안 보여요) 방송하는 동안 계속 동작해요. 브라우저 탭으로 열려면 상태가 보이는 주소를 쓰세요.</p>
        <div className={`${crew.addRow} ${local.address}`}>
          <input className={crew.input} value={shown} readOnly aria-label="연동 페이지 주소" onFocus={(e) => e.target.select()} />
          <CopyButton value={full} label="OBS용 복사" className={crew.ghost} />
          <CopyButton value={`${full}?status`} label="탭용 복사" className={crew.ghost} />
        </div>
        <ul className={local.rules}>
          <li>같은 연동 페이지를 여러 개 열어도 후원 한 건 · 규칙 하나에 한 번만 보내요.</li>
          <li>브라우저 보안상 프로그램의 응답 내용은 볼 수 없고, 연결됐는지만 알 수 있어요. 브라우저가 로컬 네트워크 접근을 물으면 허용해 주세요.</li>
          <li>후원 알림이 화면에 뜨는 순간 보내요(알림 대기열 순서 그대로). 연동 페이지가 꺼져 있던 동안의 후원은 나중에 보내지 않아요.</li>
        </ul>
      </section>

      <section className={crew.card} aria-labelledby="bridge-rules-title">
        <div className={`${crew.cardHead} ${local.head}`}>
          <h2 id="bridge-rules-title" className={`${crew.cardTitle} ${local.title}`}>
            규칙 <span className={crew.muted}>{draft.length} / {BRIDGE_RULES_MAX}</span>
          </h2>
          <span className={local.addRule}>
            <select className={crew.select} aria-label="규칙 예시" value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="">빈 규칙</option>
              {BRIDGE_TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  예시 · {t.label}
                </option>
              ))}
            </select>
            <button type="button" className={crew.ghost} disabled={draft.length >= BRIDGE_RULES_MAX} onClick={add}>
              + 규칙 추가
            </button>
          </span>
        </div>
        {draft.length === 0 ? (
          <p className={crew.empty}>아직 규칙이 없어요. 예시를 골라 &lsquo;규칙 추가&rsquo;로 시작해 보세요.</p>
        ) : (
          <ul className={local.list}>
            {draft.map((r) => (
              <li key={r.id} data-off={!r.enabled || undefined}>
                <div className={local.row}>
                  <input className={`${crew.inputSmall} ${local.name}`} aria-label="규칙 이름" maxLength={BRIDGE_NAME_MAX} value={r.name} onChange={(e) => editRule(r.id, { name: e.target.value })} />
                  <label className={crew.checkRow}>
                    <input type="checkbox" checked={r.enabled} onChange={(e) => editRule(r.id, { enabled: e.target.checked })} />
                    사용
                  </label>
                  <button type="button" className={crew.ghost} aria-label={`${r.name} 삭제`} onClick={() => setDraft((d) => d.filter((x) => x.id !== r.id))}>
                    삭제
                  </button>
                </div>
                <div className={local.row}>
                  <span className={crew.muted}>언제</span>
                  <select
                    className={crew.select}
                    aria-label={`${r.name} 시그니처`}
                    value={r.signatureId ?? ""}
                    onChange={(e) => editRule(r.id, { signatureId: e.target.value || null })}
                  >
                    <option value="">모든 후원</option>
                    {view.signatures.map((s) => (
                      <option key={s.id} value={s.id}>
                        시그니처 · {s.name} ({s.price.toLocaleString("ko-KR")} FN)
                      </option>
                    ))}
                  </select>
                  <label className={local.unit}>
                    <input className={crew.inputSmall} type="number" inputMode="numeric" aria-label={`${r.name} 최소 금액`} min={0} value={r.minFn} onChange={(e) => editRule(r.id, { minFn: e.target.value })} />
                    <span className={crew.muted}>FN 이상 (0 = 금액 무관, 플랫폼 후원 포함)</span>
                  </label>
                  <label className={crew.checkRow}>
                    <input type="checkbox" checked={r.includeTest} onChange={(e) => editRule(r.id, { includeTest: e.target.checked })} />
                    테스트 후원도
                  </label>
                </div>
                <div className={local.row}>
                  <span className={crew.muted}>보내기</span>
                  <select className={crew.select} aria-label={`${r.name} 방식`} value={r.method} onChange={(e) => editRule(r.id, { method: e.target.value as BridgeMethod })}>
                    {BRIDGE_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${crew.input} ${local.url}`}
                    aria-label={`${r.name} 주소`}
                    placeholder="http://127.0.0.1:8000/…"
                    maxLength={BRIDGE_URL_MAX}
                    value={r.url}
                    onChange={(e) => editRule(r.id, { url: e.target.value })}
                  />
                  <label className={local.unit}>
                    <input className={crew.inputSmall} type="number" inputMode="numeric" aria-label={`${r.name} 지연`} min={0} max={BRIDGE_DELAY_MAX} value={r.delaySec} onChange={(e) => editRule(r.id, { delaySec: e.target.value })} />
                    <span className={crew.muted}>초 뒤</span>
                  </label>
                </div>
                {r.method === "POST" && (
                  <textarea
                    className={`${crew.input} ${crew.textarea} ${local.body}`}
                    aria-label={`${r.name} 보낼 내용`}
                    rows={2}
                    placeholder="보낼 내용 (비워 두면 내용 없이 보내요)"
                    maxLength={BRIDGE_BODY_MAX}
                    value={r.body}
                    onChange={(e) => editRule(r.id, { body: e.target.value })}
                  />
                )}
                <div className={local.row}>
                  <button type="button" className={crew.ghost} onClick={() => void test(r)}>
                    테스트 보내기
                  </button>
                  {tests[r.id] && (
                    <span className={local.test} data-tone={tests[r.id].tone} role="status">
                      {tests[r.id].text}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className={crew.note}>
          주소와 내용에 넣을 수 있는 값: {BRIDGE_VARIABLES.map((v) => `${v.key} ${v.label}`).join(" · ")}. 주소에서는 알맞게 인코딩돼요. 예시 주소는 프로그램의 기본 설정이에요 — 프로그램에 맞게
          바꿔 주세요. 테스트 보내기는 이 브라우저에서 &lsquo;테스트&rsquo; 10,000 FN 후원으로 보내요.
        </p>
        <div className={crew.actions}>
          <button type="button" className={crew.ghost} disabled={pending || !dirty} onClick={() => setDraft(view.rules.map(toDraft))}>
            되돌리기
          </button>
          <button type="button" className={crew.primary} disabled={pending || !dirty} onClick={save}>
            {pending ? "저장하는 중…" : "저장"}
          </button>
        </div>
      </section>

      <section className={crew.card} aria-labelledby="bridge-log-title">
        <h2 id="bridge-log-title" className={crew.cardTitle}>
          최근 보낸 요청
        </h2>
        {view.log.length === 0 ? (
          <p className={crew.empty}>아직 연동 페이지가 보낸 요청이 없어요.</p>
        ) : (
          <ol className={local.log}>
            {view.log.map((e) => (
              <li key={e.id}>
                <span className={crew.muted}>{formatKstTime(e.at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <span className={local.who}>
                  <b>{e.ruleName}</b> · {e.nickname} {e.amountLabel}
                  <span className={`${crew.muted} ${local.logUrl}`}>{e.url}</span>
                </span>
                <span className={local.badge} data-outcome={e.outcome}>
                  {BRIDGE_OUTCOME_LABEL[e.outcome]}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
