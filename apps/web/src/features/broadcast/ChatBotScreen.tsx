"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatKstTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import { saveChatBot } from "@/services/broadcast/chatBot";
import {
  BOT_ACCESS,
  BOT_COMMANDS_MAX,
  BOT_COOLDOWN_DEFAULT,
  BOT_COOLDOWN_MAX,
  BOT_LIST_TRIGGER,
  BOT_REPLIES_PER_MIN,
  BOT_RESPONSE_MAX,
  BOT_TRIGGER_MAX,
  BOT_VARIABLES,
  canUse,
  listReply,
  matchCommand,
  renderReply,
  type BotAccess,
  type BotOutcome,
  type ChatBotSettings,
  type ChatBotView,
  type ChatCommand
} from "@/services/broadcast/chatBotTypes";
import type { ChatAuthorRole } from "@/services/platforms/platformTypes";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import crew from "../creatorStudio/crew/crew.module.css";
import local from "./chatBot.module.css";
import { PlatformMark } from "./PlatformMark";

/** The form keeps 쿨다운 as typed. */
type DraftCommand = Omit<ChatCommand, "cooldownSec"> & { cooldownSec: string };
type Draft = Omit<ChatBotSettings, "commands"> & { commands: DraftCommand[] };
const toDraft = (s: ChatBotSettings): Draft => ({ ...s, commands: s.commands.map((c) => ({ ...c, cooldownSec: String(c.cooldownSec) })) });
const fromDraft = (d: Draft): ChatBotSettings => ({
  ...d,
  commands: d.commands.map((c) => ({ ...c, trigger: c.trigger.trim(), response: c.response.trim(), cooldownSec: Number(c.cooldownSec) }))
});
const PLATFORMS: Platform[] = ["YOUTUBE", "CHZZK", "SOOP", "FLEXTV"];
const STATE_KEY = { OK: "chatBot.stateOk", NOT_CONNECTED: "chatBot.stateNotConnected", UNSUPPORTED: "chatBot.stateUnsupported" } as const satisfies Record<string, MessageKey>;
const TEST_ROLES: { key: string; label: MessageKey; roles: ChatAuthorRole[] }[] = [
  { key: "VIEWER", label: "chatBot.roleViewer", roles: [] },
  { key: "MODERATOR", label: "chatBot.roleManager", roles: ["MODERATOR"] },
  { key: "OWNER", label: "chatBot.roleOwner", roles: ["OWNER"] }
];
/** `BOT_ACCESS`, `BOT_VARIABLES` and `BOT_OUTCOME_LABEL` labels as message keys (2026-11-01). */
const ACCESS_KEY: Record<BotAccess, MessageKey> = { ALL: "chatBot.accessAll", MANAGER: "chatBot.accessManager", OWNER: "chatBot.accessOwner" };
const VARIABLE_KEY: Record<string, MessageKey> = { "{nickname}": "chatBot.varNickname", "{platform}": "chatBot.varPlatform" };
const OUTCOME_KEY: Record<BotOutcome, MessageKey> = {
  SENT: "chatBot.outcomeSent",
  COOLDOWN: "chatBot.outcomeCooldown",
  NO_ACCESS: "chatBot.outcomeNoAccess",
  RATE_LIMIT: "chatBot.outcomeRateLimit",
  NOT_CONNECTED: "chatBot.outcomeNotConnected",
  UNSUPPORTED: "chatBot.outcomeUnsupported",
  PENDING: "chatBot.outcomePending",
  UNCONFIRMED: "chatBot.outcomeUnconfirmed",
  FAILED: "chatBot.outcomeFailed"
};

/**
 * 채팅봇 명령어 — code-first (no Figma frame; StreamDonate (DallaHelper) 참고, P3). Route `/creator/chat/bot`. 봇 사용 ·
 * 답할 플랫폼 · 목록 명령어, the commands (명령어 · 응답 · 사용 가능 · 쿨다운 · 사용), 저장, a 테스트 that shows what the
 * bot would say (nothing is sent) and the 최근 응답 (refreshed while the bot is on).
 */
export function ChatBotScreen({ view }: { view: ChatBotView }) {
  const { t } = useI18n();
  const router = useRouter();
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  // A newer saved value (another tab, a refresh) replaces the draft; edits stay until saved.
  const [draft, setDraft] = useState(() => toDraft(view.settings));
  const synced = useRef(JSON.stringify(view.settings));
  useEffect(() => {
    const next = JSON.stringify(view.settings);
    if (next !== synced.current) {
      synced.current = next;
      setDraft(toDraft(view.settings));
    }
  }, [view.settings]);
  const dirty = JSON.stringify(fromDraft(draft)) !== synced.current;
  const edit = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const editCommand = (id: string, patch: Partial<DraftCommand>) => setDraft((d) => ({ ...d, commands: d.commands.map((c) => (c.id === id ? { ...c, ...patch } : c)) }));

  // The log moves on its own while the bot is on.
  useEffect(() => {
    if (!view.settings.enabled) return;
    const poll = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(poll);
  }, [view.settings.enabled, router]);

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      try {
        const res = await saveChatBot(fromDraft(draft));
        if (res.status === "SAVED") {
          setMessage({ tone: "ok", text: t("chatBot.saved") });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/chat/bot");
        else setMessage({ tone: "error", text: res.message });
      } catch {
        setMessage({ tone: "error", text: t("chatBot.saveFailed") });
      }
    });
  };
  const add = () =>
    setDraft((d) => ({
      ...d,
      commands: [...d.commands, { id: `cmd-${crypto.randomUUID().slice(0, 8)}`, trigger: "!", response: "", access: "ALL", cooldownSec: String(BOT_COOLDOWN_DEFAULT), enabled: true }]
    }));

  // 테스트: what the draft would answer (no 쿨다운, nothing sent).
  const [testText, setTestText] = useState("!");
  const [testRole, setTestRole] = useState("VIEWER");
  const [testPlatform, setTestPlatform] = useState<Platform>("YOUTUBE");
  const test = (() => {
    const s = fromDraft(draft);
    const hit = matchCommand(s, testText);
    if (!hit) return { tone: "muted", text: t("chatBot.testNotCommand") };
    if (!s.platforms.includes(testPlatform)) return { tone: "muted", text: t("chatBot.testPlatformOff", { platform: PLATFORM_LABEL[testPlatform] }) };
    const roles = TEST_ROLES.find((r) => r.key === testRole)!.roles;
    if (hit.kind === "COMMAND" && !canUse(hit.command.access, roles))
      return { tone: "muted", text: t(hit.command.access === "OWNER" ? "chatBot.testOwnerOnly" : "chatBot.testManagerOnly") };
    return { tone: "ok", text: hit.kind === "LIST" ? listReply(s) : renderReply(hit.command.response, { nickname: "시청자", platform: testPlatform }) };
  })();

  return (
    <div className={crew.content}>
      <header className={crew.header}>
        <h1 className={crew.title}>{t("chatBot.title")}</h1>
        <p className={crew.subtitle}>{t("chatBot.subtitle")}</p>
        <p className={crew.note}>
          <Link href="/creator/chat">{t("chatBot.backToChat")}</Link>
          {t("chatBot.note", { count: BOT_REPLIES_PER_MIN })}
        </p>
      </header>

      {message && (
        <p className={message.tone === "ok" ? crew.ok : crew.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      <section className={crew.card} aria-labelledby="bot-settings-title">
        <h2 id="bot-settings-title" className={crew.cardTitle}>
          {t("chatBot.settingsTitle")}
        </h2>
        <label className={crew.checkRow}>
          <input type="checkbox" checked={draft.enabled} onChange={(e) => edit({ enabled: e.target.checked })} />
          {t("chatBot.enable")}
        </label>
        <div role="group" aria-label={t("chatBot.platformsAria")} className={local.platforms}>
          {PLATFORMS.map((p) => (
            <label key={p} className={local.platform}>
              <input
                type="checkbox"
                checked={draft.platforms.includes(p)}
                onChange={(e) => edit({ platforms: e.target.checked ? PLATFORMS.filter((x) => x === p || draft.platforms.includes(x)) : draft.platforms.filter((x) => x !== p) })}
              />
              <PlatformMark platform={p} size="sm" />
              {PLATFORM_LABEL[p]}
              <span className={crew.muted} data-state={view.platforms[p]}>
                {t(STATE_KEY[view.platforms[p]])}
              </span>
            </label>
          ))}
        </div>
        <label className={crew.checkRow}>
          <input type="checkbox" checked={draft.listCommand} onChange={(e) => edit({ listCommand: e.target.checked })} />
          {t("chatBot.listCommand", { trigger: BOT_LIST_TRIGGER, sec: BOT_COOLDOWN_DEFAULT })}
        </label>
      </section>

      <section className={crew.card} aria-labelledby="bot-commands-title">
        <div className={crew.cardHead}>
          <h2 id="bot-commands-title" className={crew.cardTitle}>
            {t("chatBot.commandsTitle")} <span className={crew.muted}>{draft.commands.length} / {BOT_COMMANDS_MAX}</span>
          </h2>
          <button type="button" className={crew.ghost} disabled={draft.commands.length >= BOT_COMMANDS_MAX} onClick={add}>
            {t("chatBot.addCommand")}
          </button>
        </div>
        {draft.commands.length === 0 ? (
          <p className={crew.empty}>{t("chatBot.empty")}</p>
        ) : (
          <ul className={local.commands}>
            {draft.commands.map((c) => (
              <li key={c.id} data-off={!c.enabled || undefined}>
                <div className={local.commandHead}>
                  <input
                    className={`${crew.inputSmall} ${local.trigger}`}
                    aria-label={t("chatBot.commandAria")}
                    placeholder={t("chatBot.triggerPlaceholder")}
                    maxLength={BOT_TRIGGER_MAX}
                    value={c.trigger}
                    onChange={(e) => editCommand(c.id, { trigger: e.target.value })}
                  />
                  <select className={crew.select} aria-label={t("chatBot.accessAria", { trigger: c.trigger })} value={c.access} onChange={(e) => editCommand(c.id, { access: e.target.value as BotAccess })}>
                    {BOT_ACCESS.map((a) => (
                      <option key={a.key} value={a.key}>
                        {t(ACCESS_KEY[a.key])}
                      </option>
                    ))}
                  </select>
                  <label className={local.cooldown}>
                    <span className={crew.muted}>{t("chatBot.cooldown")}</span>
                    <input
                      className={crew.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={t("chatBot.cooldownAria", { trigger: c.trigger })}
                      min={0}
                      max={BOT_COOLDOWN_MAX}
                      value={c.cooldownSec}
                      onChange={(e) => editCommand(c.id, { cooldownSec: e.target.value })}
                    />
                    <span className={crew.muted}>{t("chatBot.seconds")}</span>
                  </label>
                  <label className={crew.checkRow}>
                    <input type="checkbox" checked={c.enabled} onChange={(e) => editCommand(c.id, { enabled: e.target.checked })} />
                    {t("chatBot.use")}
                  </label>
                  <button
                    type="button"
                    className={crew.ghost}
                    aria-label={t("chatBot.deleteAria", { trigger: c.trigger })}
                    onClick={() => setDraft((d) => ({ ...d, commands: d.commands.filter((x) => x.id !== c.id) }))}
                  >
                    {t("chatBot.delete")}
                  </button>
                </div>
                <textarea
                  className={`${crew.input} ${crew.textarea}`}
                  aria-label={t("chatBot.responseAria", { trigger: c.trigger })}
                  rows={2}
                  placeholder={t("chatBot.responsePlaceholder")}
                  maxLength={BOT_RESPONSE_MAX}
                  value={c.response}
                  onChange={(e) => editCommand(c.id, { response: e.target.value })}
                />
              </li>
            ))}
          </ul>
        )}
        <p className={crew.note}>
          {t("chatBot.rulesNote", { max: BOT_TRIGGER_MAX, responseMax: BOT_RESPONSE_MAX })}{" "}
          {BOT_VARIABLES.map((v) => `${v.key} ${VARIABLE_KEY[v.key] ? t(VARIABLE_KEY[v.key]) : v.label}`).join(" · ")}.
        </p>
        <div className={crew.actions}>
          <button type="button" className={crew.ghost} disabled={pending || !dirty} onClick={() => setDraft(toDraft(view.settings))}>
            {t("chatBot.revert")}
          </button>
          <button type="button" className={crew.primary} disabled={pending || !dirty} onClick={save}>
            {pending ? t("chatBot.saving") : t("chatBot.save")}
          </button>
        </div>
      </section>

      <section className={crew.card} aria-labelledby="bot-test-title">
        <h2 id="bot-test-title" className={crew.cardTitle}>
          {t("chatBot.testTitle")}
        </h2>
        <p className={crew.note}>{t("chatBot.testNote")}</p>
        <div className={local.testRow}>
          <select className={crew.select} aria-label={t("chatBot.testPlatform")} value={testPlatform} onChange={(e) => setTestPlatform(e.target.value as Platform)}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
          <select className={crew.select} aria-label={t("chatBot.testRole")} value={testRole} onChange={(e) => setTestRole(e.target.value)}>
            {TEST_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {t(r.label)}
              </option>
            ))}
          </select>
          <input className={crew.input} aria-label={t("chatBot.testChat")} placeholder={t("chatBot.triggerPlaceholder")} value={testText} onChange={(e) => setTestText(e.target.value)} />
        </div>
        <p className={local.testResult} data-tone={test.tone} role="status">
          {test.tone === "ok" && <span className={crew.muted}>{t("chatBot.botArrow")}</span>}
          {test.text}
        </p>
      </section>

      <section className={crew.card} aria-labelledby="bot-log-title">
        <h2 id="bot-log-title" className={crew.cardTitle}>
          {t("chatBot.logTitle")}
        </h2>
        {view.log.length === 0 ? (
          <p className={crew.empty}>{t("chatBot.logEmpty")}</p>
        ) : (
          <ol className={local.log}>
            {view.log.map((e, i) => (
              <li key={`${e.at}-${i}`}>
                <span className={crew.muted}>{formatKstTime(e.at, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
                <PlatformMark platform={e.platform} size="sm" />
                <span className={local.who}>
                  {e.nickname} <b>{e.trigger}</b>
                  {e.reply && <span className={crew.muted}> → {e.reply}</span>}
                </span>
                <span className={local.badge} data-outcome={e.outcome}>
                  {t(OUTCOME_KEY[e.outcome])}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
