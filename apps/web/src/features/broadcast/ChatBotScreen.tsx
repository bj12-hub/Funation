"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { formatKstTime } from "@/lib/format";
import { saveChatBot } from "@/services/broadcast/chatBot";
import {
  BOT_ACCESS,
  BOT_COMMANDS_MAX,
  BOT_COOLDOWN_DEFAULT,
  BOT_COOLDOWN_MAX,
  BOT_LIST_TRIGGER,
  BOT_OUTCOME_LABEL,
  BOT_REPLIES_PER_MIN,
  BOT_RESPONSE_MAX,
  BOT_TRIGGER_MAX,
  BOT_VARIABLES,
  canUse,
  listReply,
  matchCommand,
  renderReply,
  type BotAccess,
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
const STATE_LABEL = { OK: "답할 수 있어요", NOT_CONNECTED: "연결 안 됨", UNSUPPORTED: "채팅 보내기 미지원" } as const;
const TEST_ROLES: { key: string; label: string; roles: ChatAuthorRole[] }[] = [
  { key: "VIEWER", label: "시청자", roles: [] },
  { key: "MODERATOR", label: "매니저", roles: ["MODERATOR"] },
  { key: "OWNER", label: "방송인", roles: ["OWNER"] }
];

/**
 * 채팅봇 명령어 — code-first (no Figma frame; StreamDonate (DallaHelper) 참고, P3). Route `/creator/chat/bot`. 봇 사용 ·
 * 답할 플랫폼 · 목록 명령어, the commands (명령어 · 응답 · 사용 가능 · 쿨다운 · 사용), 저장, a 테스트 that shows what the
 * bot would say (nothing is sent) and the 최근 응답 (refreshed while the bot is on).
 */
export function ChatBotScreen({ view }: { view: ChatBotView }) {
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
          setMessage({ tone: "ok", text: "채팅봇 설정을 저장했어요." });
          router.refresh();
        } else if (res.status === "UNAUTHORIZED") router.push("/login?role=creator&next=/creator/chat/bot");
        else setMessage({ tone: "error", text: res.message });
      } catch {
        setMessage({ tone: "error", text: "저장하지 못했어요. 잠시 후 다시 시도해 주세요." });
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
    if (!hit) return { tone: "muted", text: "명령어가 아니에요. 봇은 답하지 않아요." };
    if (!s.platforms.includes(testPlatform)) return { tone: "muted", text: `${PLATFORM_LABEL[testPlatform]}에서는 답하지 않게 설정돼 있어요.` };
    const roles = TEST_ROLES.find((r) => r.key === testRole)!.roles;
    if (hit.kind === "COMMAND" && !canUse(hit.command.access, roles))
      return { tone: "muted", text: `${hit.command.access === "OWNER" ? "방송인만" : "매니저 이상만"} 쓸 수 있는 명령어예요. 봇은 답하지 않아요.` };
    return { tone: "ok", text: hit.kind === "LIST" ? listReply(s) : renderReply(hit.command.response, { nickname: "시청자", platform: testPlatform }) };
  })();

  return (
    <div className={crew.content}>
      <header className={crew.header}>
        <h1 className={crew.title}>채팅봇 명령어</h1>
        <p className={crew.subtitle}>시청자가 채팅에 명령어(예: !공지)를 쓰면 채널 이름으로 자동으로 답해요.</p>
        <p className={crew.note}>
          <Link href="/creator/chat">← 통합 채팅</Link> · 통합 채팅에 연결한 플랫폼에서 동작하고, 채팅 보내기를 지원하는 플랫폼에서만 답해요. 명령어마다 플랫폼별 쿨다운이 있고, 봇 응답은 모든
          명령어를 합쳐 1분에 {BOT_REPLIES_PER_MIN}번까지예요.
        </p>
      </header>

      {message && (
        <p className={message.tone === "ok" ? crew.ok : crew.error} role={message.tone === "ok" ? "status" : "alert"}>
          {message.text}
        </p>
      )}

      <section className={crew.card} aria-labelledby="bot-settings-title">
        <h2 id="bot-settings-title" className={crew.cardTitle}>
          🤖 봇 설정
        </h2>
        <label className={crew.checkRow}>
          <input type="checkbox" checked={draft.enabled} onChange={(e) => edit({ enabled: e.target.checked })} />
          채팅봇 사용 (켠 뒤에 들어온 채팅부터 답해요)
        </label>
        <div role="group" aria-label="답할 플랫폼" className={local.platforms}>
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
                {STATE_LABEL[view.platforms[p]]}
              </span>
            </label>
          ))}
        </div>
        <label className={crew.checkRow}>
          <input type="checkbox" checked={draft.listCommand} onChange={(e) => edit({ listCommand: e.target.checked })} />
          {BOT_LIST_TRIGGER}로 명령어 목록 답하기 (&lsquo;모두&rsquo;가 쓸 수 있는 명령어, 쿨다운 {BOT_COOLDOWN_DEFAULT}초)
        </label>
      </section>

      <section className={crew.card} aria-labelledby="bot-commands-title">
        <div className={crew.cardHead}>
          <h2 id="bot-commands-title" className={crew.cardTitle}>
            명령어 <span className={crew.muted}>{draft.commands.length} / {BOT_COMMANDS_MAX}</span>
          </h2>
          <button type="button" className={crew.ghost} disabled={draft.commands.length >= BOT_COMMANDS_MAX} onClick={add}>
            + 명령어 추가
          </button>
        </div>
        {draft.commands.length === 0 ? (
          <p className={crew.empty}>아직 명령어가 없어요. &lsquo;명령어 추가&rsquo;로 만들어 보세요.</p>
        ) : (
          <ul className={local.commands}>
            {draft.commands.map((c) => (
              <li key={c.id} data-off={!c.enabled || undefined}>
                <div className={local.commandHead}>
                  <input
                    className={`${crew.inputSmall} ${local.trigger}`}
                    aria-label="명령어"
                    placeholder="!공지"
                    maxLength={BOT_TRIGGER_MAX}
                    value={c.trigger}
                    onChange={(e) => editCommand(c.id, { trigger: e.target.value })}
                  />
                  <select className={crew.select} aria-label={`${c.trigger} 사용 가능`} value={c.access} onChange={(e) => editCommand(c.id, { access: e.target.value as BotAccess })}>
                    {BOT_ACCESS.map((a) => (
                      <option key={a.key} value={a.key}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                  <label className={local.cooldown}>
                    <span className={crew.muted}>쿨다운</span>
                    <input
                      className={crew.inputSmall}
                      type="number"
                      inputMode="numeric"
                      aria-label={`${c.trigger} 쿨다운`}
                      min={0}
                      max={BOT_COOLDOWN_MAX}
                      value={c.cooldownSec}
                      onChange={(e) => editCommand(c.id, { cooldownSec: e.target.value })}
                    />
                    <span className={crew.muted}>초</span>
                  </label>
                  <label className={crew.checkRow}>
                    <input type="checkbox" checked={c.enabled} onChange={(e) => editCommand(c.id, { enabled: e.target.checked })} />
                    사용
                  </label>
                  <button
                    type="button"
                    className={crew.ghost}
                    aria-label={`${c.trigger} 삭제`}
                    onClick={() => setDraft((d) => ({ ...d, commands: d.commands.filter((x) => x.id !== c.id) }))}
                  >
                    삭제
                  </button>
                </div>
                <textarea
                  className={`${crew.input} ${crew.textarea}`}
                  aria-label={`${c.trigger} 응답`}
                  rows={2}
                  placeholder="봇이 채팅에 보낼 말"
                  maxLength={BOT_RESPONSE_MAX}
                  value={c.response}
                  onChange={(e) => editCommand(c.id, { response: e.target.value })}
                />
              </li>
            ))}
          </ul>
        )}
        <p className={crew.note}>
          명령어는 !로 시작하고 띄어쓰기 없이 2~{BOT_TRIGGER_MAX}자, 채팅의 첫 단어가 같으면 답해요(대소문자 무시). 응답은 {BOT_RESPONSE_MAX}자까지, 이렇게 바꿔 넣을 수 있어요:{" "}
          {BOT_VARIABLES.map((v) => `${v.key} ${v.label}`).join(" · ")}.
        </p>
        <div className={crew.actions}>
          <button type="button" className={crew.ghost} disabled={pending || !dirty} onClick={() => setDraft(toDraft(view.settings))}>
            되돌리기
          </button>
          <button type="button" className={crew.primary} disabled={pending || !dirty} onClick={save}>
            {pending ? "저장하는 중…" : "저장"}
          </button>
        </div>
      </section>

      <section className={crew.card} aria-labelledby="bot-test-title">
        <h2 id="bot-test-title" className={crew.cardTitle}>
          테스트
        </h2>
        <p className={crew.note}>입력 중인 설정으로 봇이 어떻게 답할지 미리 봐요. 실제 채팅에는 보내지 않아요.</p>
        <div className={local.testRow}>
          <select className={crew.select} aria-label="테스트 플랫폼" value={testPlatform} onChange={(e) => setTestPlatform(e.target.value as Platform)}>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {PLATFORM_LABEL[p]}
              </option>
            ))}
          </select>
          <select className={crew.select} aria-label="테스트 역할" value={testRole} onChange={(e) => setTestRole(e.target.value)}>
            {TEST_ROLES.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label}
              </option>
            ))}
          </select>
          <input className={crew.input} aria-label="테스트 채팅" placeholder="!공지" value={testText} onChange={(e) => setTestText(e.target.value)} />
        </div>
        <p className={local.testResult} data-tone={test.tone} role="status">
          {test.tone === "ok" && <span className={crew.muted}>🤖 봇 → </span>}
          {test.text}
        </p>
      </section>

      <section className={crew.card} aria-labelledby="bot-log-title">
        <h2 id="bot-log-title" className={crew.cardTitle}>
          최근 응답
        </h2>
        {view.log.length === 0 ? (
          <p className={crew.empty}>아직 들어온 명령어가 없어요.</p>
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
                  {BOT_OUTCOME_LABEL[e.outcome]}
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
