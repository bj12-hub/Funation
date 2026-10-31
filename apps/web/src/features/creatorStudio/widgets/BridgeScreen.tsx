"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatKstTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveBridgeRules } from "@/services/creator/bridge";
import {
  BRIDGE_BODY_MAX,
  BRIDGE_DELAY_MAX,
  BRIDGE_METHODS,
  BRIDGE_NAME_MAX,
  BRIDGE_RULES_MAX,
  BRIDGE_TEMPLATES,
  BRIDGE_URL_MAX,
  BRIDGE_VARIABLES,
  SAMPLE_EVENT,
  renderRequest,
  type BridgeMethod,
  type BridgeOutcome,
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
/** Template, variable and outcome labels by key (the service's BRIDGE_TEMPLATES · BRIDGE_VARIABLES · BRIDGE_OUTCOME_LABEL stay as written, 2026-11-01). */
const TEMPLATE_KEY: Record<string, MessageKey> = {
  companion: "studioToolsBridge.templateCompanion",
  resolume: "studioToolsBridge.templateResolume",
  get: "studioToolsBridge.templateGet"
};
const VARIABLE_KEY: Record<string, MessageKey> = {
  "{nickname}": "studioToolsBridge.varNickname",
  "{amount}": "studioToolsBridge.varAmount",
  "{amountLabel}": "studioToolsBridge.varAmountLabel",
  "{message}": "studioToolsBridge.varMessage",
  "{type}": "studioToolsBridge.varType",
  "{platform}": "studioToolsBridge.varPlatform"
};
const OUTCOME_KEY: Record<BridgeOutcome, MessageKey> = { FIRED: "studioToolsBridge.outcomeFired", SENT: "studioToolsBridge.outcomeSent", FAILED: "studioToolsBridge.outcomeFailed" };

/**
 * 외부 프로그램 연동 — code-first (no Figma frame; StreamDonate "외부 프로그램 API (조명 · Resolume · Companion)" 참고, P3).
 * Route `/creator/widgets/bridge`. The 연동 페이지 address (OBS browser source, or a tab with `?status`), the 규칙 (when: 최소
 * FN · 시그니처 · 테스트 후원 / then: GET · POST to an address with variables, 지연), 테스트 보내기 from this browser with a
 * sample 후원, 저장, and the latest sends the 연동 페이지 reported.
 */
export function BridgeScreen({ view }: { view: BridgeView }) {
  const router = useRouter();
  const { t: translate } = useI18n();
  const templateLabel = (x: { key: string; label: string }) => (TEMPLATE_KEY[x.key] ? translate(TEMPLATE_KEY[x.key]) : x.label);
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
        name: t ? templateLabel(t).slice(0, BRIDGE_NAME_MAX) : translate("studioToolsBridge.defaultRule", { n: d.length + 1 }),
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
          setMessage({ tone: "ok", text: translate("studioToolsBridge.saved") });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/widgets/bridge");
        else setMessage({ tone: "error", text: res.message });
      } catch {
        setMessage({ tone: "error", text: translate("studioTools.saveFailed") });
      }
    });
  };

  // 테스트 보내기: the rule's request with a sample 후원, sent from this browser (the same way the 연동 페이지 sends).
  const [tests, setTests] = useState<Record<string, TestState>>({});
  const test = async (r: DraftRule) => {
    const req = renderRequest(fromDraft(r), SAMPLE_EVENT);
    setTests((t) => ({ ...t, [r.id]: { tone: "muted", text: translate("studioTools.sending") } }));
    try {
      await fetch(req.url, { method: req.method, body: req.method === "POST" ? req.body : undefined, mode: "no-cors", cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
      setTests((t) => ({ ...t, [r.id]: { tone: "ok", text: translate("studioToolsBridge.testSent", { method: req.method, url: req.url }) } }));
    } catch {
      setTests((t) => ({ ...t, [r.id]: { tone: "error", text: translate("studioToolsBridge.testFailed", { url: req.url }) } }));
    }
  };

  const shown = shownOverlayAddress(origin, view.bridgePath);
  const full = `${origin}${view.bridgePath}`;

  return (
    <div className={crew.content}>
      <header className={crew.header}>
        <h1 className={crew.title}>{translate("studioToolsBridge.title")}</h1>
        <p className={crew.subtitle}>{translate("studioToolsBridge.subtitle")}</p>
        <p className={crew.note}>
          {translate("studioToolsBridge.headBefore")}
          <Link href="/creator/remote">{translate("studioTools.remote")}</Link>
          {translate("studioToolsBridge.headAfter")}
        </p>
      </header>

      {message && (
        <p className={message.tone === "ok" ? crew.ok : crew.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      <section className={crew.card} aria-labelledby="bridge-page-title">
        <h2 id="bridge-page-title" className={crew.cardTitle}>
          {translate("studioToolsBridge.pageTitle")}
        </h2>
        <p className={crew.note}>{translate("studioToolsBridge.pageNote")}</p>
        <div className={`${crew.addRow} ${local.address}`}>
          <input className={crew.input} value={shown} readOnly aria-label={translate("studioToolsBridge.pageAddress")} onFocus={(e) => e.target.select()} />
          <CopyButton value={full} label={translate("studioToolsBridge.copyObs")} className={crew.ghost} />
          <CopyButton value={`${full}?status`} label={translate("studioToolsBridge.copyTab")} className={crew.ghost} />
        </div>
        <ul className={local.rules}>
          <li>{translate("studioToolsBridge.rule1")}</li>
          <li>{translate("studioToolsBridge.rule2")}</li>
          <li>{translate("studioToolsBridge.rule3")}</li>
        </ul>
      </section>

      <section className={crew.card} aria-labelledby="bridge-rules-title">
        <div className={`${crew.cardHead} ${local.head}`}>
          <h2 id="bridge-rules-title" className={`${crew.cardTitle} ${local.title}`}>
            {translate("studioToolsBridge.rules")} <span className={crew.muted}>{draft.length} / {BRIDGE_RULES_MAX}</span>
          </h2>
          <span className={local.addRule}>
            <select className={crew.select} aria-label={translate("studioToolsBridge.templateAria")} value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="">{translate("studioToolsBridge.blankRule")}</option>
              {BRIDGE_TEMPLATES.map((t) => (
                <option key={t.key} value={t.key}>
                  {translate("studioToolsBridge.templateOption", { label: templateLabel(t) })}
                </option>
              ))}
            </select>
            <button type="button" className={crew.ghost} disabled={draft.length >= BRIDGE_RULES_MAX} onClick={add}>
              {translate("studioToolsBridge.addRule")}
            </button>
          </span>
        </div>
        {draft.length === 0 ? (
          <p className={crew.empty}>{translate("studioToolsBridge.empty")}</p>
        ) : (
          <ul className={local.list}>
            {draft.map((r) => (
              <li key={r.id} data-off={!r.enabled || undefined}>
                <div className={local.row}>
                  <input
                    className={`${crew.inputSmall} ${local.name}`}
                    aria-label={translate("studioToolsBridge.ruleName")}
                    maxLength={BRIDGE_NAME_MAX}
                    value={r.name}
                    onChange={(e) => editRule(r.id, { name: e.target.value })}
                  />
                  <label className={crew.checkRow}>
                    <input type="checkbox" checked={r.enabled} onChange={(e) => editRule(r.id, { enabled: e.target.checked })} />
                    {translate("studioTools.on")}
                  </label>
                  <button type="button" className={crew.ghost} aria-label={translate("studioToolsBridge.deleteAria", { name: r.name })} onClick={() => setDraft((d) => d.filter((x) => x.id !== r.id))}>
                    {translate("studioTools.delete")}
                  </button>
                </div>
                <div className={local.row}>
                  <span className={crew.muted}>{translate("studioToolsBridge.when")}</span>
                  <select
                    className={crew.select}
                    aria-label={translate("studioToolsBridge.signatureAria", { name: r.name })}
                    value={r.signatureId ?? ""}
                    onChange={(e) => editRule(r.id, { signatureId: e.target.value || null })}
                  >
                    <option value="">{translate("studioToolsBridge.anyDonation")}</option>
                    {view.signatures.map((s) => (
                      <option key={s.id} value={s.id}>
                        {translate("studioToolsBridge.signatureOption", { name: s.name, price: s.price.toLocaleString("ko-KR") })}
                      </option>
                    ))}
                  </select>
                  <label className={local.unit}>
                    <input
                      className={crew.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={translate("studioToolsBridge.minAria", { name: r.name })}
                      min={0}
                      value={r.minFn}
                      onChange={(e) => editRule(r.id, { minFn: e.target.value })}
                    />
                    <span className={crew.muted}>{translate("studioToolsBridge.minUnit")}</span>
                  </label>
                  <label className={crew.checkRow}>
                    <input type="checkbox" checked={r.includeTest} onChange={(e) => editRule(r.id, { includeTest: e.target.checked })} />
                    {translate("studioToolsBridge.includeTest")}
                  </label>
                </div>
                <div className={local.row}>
                  <span className={crew.muted}>{translate("studioToolsBridge.send")}</span>
                  <select
                    className={crew.select}
                    aria-label={translate("studioToolsBridge.methodAria", { name: r.name })}
                    value={r.method}
                    onChange={(e) => editRule(r.id, { method: e.target.value as BridgeMethod })}
                  >
                    {BRIDGE_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <input
                    className={`${crew.input} ${local.url}`}
                    aria-label={translate("studioToolsBridge.urlAria", { name: r.name })}
                    placeholder="http://127.0.0.1:8000/…"
                    maxLength={BRIDGE_URL_MAX}
                    value={r.url}
                    onChange={(e) => editRule(r.id, { url: e.target.value })}
                  />
                  <label className={local.unit}>
                    <input
                      className={crew.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={translate("studioToolsBridge.delayAria", { name: r.name })}
                      min={0}
                      max={BRIDGE_DELAY_MAX}
                      value={r.delaySec}
                      onChange={(e) => editRule(r.id, { delaySec: e.target.value })}
                    />
                    <span className={crew.muted}>{translate("studioToolsBridge.delayUnit")}</span>
                  </label>
                </div>
                {r.method === "POST" && (
                  <textarea
                    className={`${crew.input} ${crew.textarea} ${local.body}`}
                    aria-label={translate("studioToolsBridge.bodyAria", { name: r.name })}
                    rows={2}
                    placeholder={translate("studioToolsBridge.bodyPlaceholder")}
                    maxLength={BRIDGE_BODY_MAX}
                    value={r.body}
                    onChange={(e) => editRule(r.id, { body: e.target.value })}
                  />
                )}
                <div className={local.row}>
                  <button type="button" className={crew.ghost} onClick={() => void test(r)}>
                    {translate("studioToolsBridge.sendTest")}
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
          {translate("studioToolsBridge.variablesNote", {
            variables: BRIDGE_VARIABLES.map((v) => `${v.key} ${VARIABLE_KEY[v.key] ? translate(VARIABLE_KEY[v.key]) : v.label}`).join(" · ")
          })}
        </p>
        <div className={crew.actions}>
          <button type="button" className={crew.ghost} disabled={pending || !dirty} onClick={() => setDraft(view.rules.map(toDraft))}>
            {translate("studioTools.revert")}
          </button>
          <button type="button" className={crew.primary} disabled={pending || !dirty} onClick={save}>
            {pending ? translate("studioTools.savingLong") : translate("studioTools.save")}
          </button>
        </div>
      </section>

      <section className={crew.card} aria-labelledby="bridge-log-title">
        <h2 id="bridge-log-title" className={crew.cardTitle}>
          {translate("studioToolsBridge.logTitle")}
        </h2>
        {view.log.length === 0 ? (
          <p className={crew.empty}>{translate("studioToolsBridge.logEmpty")}</p>
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
                  {translate(OUTCOME_KEY[e.outcome])}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
