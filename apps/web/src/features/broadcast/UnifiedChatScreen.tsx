"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  banChatAuthor,
  connectBroadcastChannel,
  deleteChatMessage,
  disconnectBroadcastChannel,
  getUnifiedChat,
  hideChatMessage,
  sendUnifiedChat,
  simulateChatReconnect,
  simulateViewerChat
} from "@/services/broadcast/unifiedChat";
import {
  createManagerLink,
  deleteManagerLink,
  getManagerChat,
  managerBanAuthor,
  managerDeleteMessage,
  managerHideMessage,
  managerSendChat,
  setManagerLinkPermissions
} from "@/services/broadcast/managerChat";
import {
  BAN_DURATIONS,
  CHAT_WINDOW_PATH,
  CHAT_TEXT_MAX,
  MANAGER_DEFAULT_PERMISSIONS,
  MANAGER_LINKS_MAX,
  MANAGER_NAME_MAX,
  MANAGER_PERMISSIONS,
  type ChatActionResult,
  type ChatHiddenReason,
  type ChatPlatformState,
  type ChatSendOutcome,
  type ChatSendResult,
  type ManagerChatView,
  type ManagerLink,
  type ManagerPermission,
  type UnifiedChatMessage,
  type UnifiedChatView
} from "@/services/broadcast/chatTypes";
import { formatKstTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
import type { ChatAuthorRole, PlatformErrorCode } from "@/services/platforms/platformTypes";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import type { OverlayTarget } from "@/services/creator/alertTypes";
import { OverlayOffNotice } from "../creatorStudio/remote/OverlayOffNotice";
import crew from "../creatorStudio/crew/crew.module.css";
import { CopyButton } from "../creatorStudio/settings/SettingsCards";
import styles from "./chat.module.css";
import { PlatformMark } from "./PlatformMark";

const POLL_MS = 1_500;
const time = (iso: string) => formatKstTime(iso, { hour: "2-digit", minute: "2-digit" });
type Note = { tone: "ok" | "error"; text: string } | null;
type Filter = Platform | "ALL";
type T = (key: MessageKey, vars?: Record<string, string | number>) => string;

/** The labels `chatTypes` / `platformTypes` keep for the services, as message keys for this screen (2026-11-01). */
const ROLE_KEY: Record<ChatAuthorRole, MessageKey> = { OWNER: "unifiedChat.roleOwner", MODERATOR: "unifiedChat.roleModerator", MEMBER: "unifiedChat.roleMember" };
const HIDDEN_KEY: Record<ChatHiddenReason, MessageKey> = {
  MANUAL: "unifiedChat.hiddenManual",
  FILTER: "unifiedChat.hiddenFilter",
  DELETED: "unifiedChat.hiddenDeleted",
  BANNED: "unifiedChat.hiddenBanned"
};
const OUTCOME_KEY: Record<ChatSendOutcome["status"], MessageKey> = {
  SENT: "unifiedChat.outcomeSent",
  NOT_CONNECTED: "unifiedChat.outcomeNotConnected",
  UNSUPPORTED: "unifiedChat.outcomeUnsupported",
  PENDING: "unifiedChat.outcomePending",
  UNCONFIRMED: "unifiedChat.outcomeUnconfirmed",
  FAILED: "unifiedChat.outcomeFailed"
};
const ERROR_KEY: Record<PlatformErrorCode, MessageKey> = {
  TIMEOUT: "unifiedChat.errTimeout",
  NOT_FOUND: "unifiedChat.errNotFound",
  UNAUTHORIZED: "unifiedChat.errUnauthorized",
  UNSUPPORTED: "unifiedChat.errUnsupported",
  UNAVAILABLE: "unifiedChat.errUnavailable"
};
const LOG_KEY: Record<"HIDE" | "UNHIDE" | "DELETE" | "BAN", MessageKey> = {
  HIDE: "unifiedChat.logHide",
  UNHIDE: "unifiedChat.logUnhide",
  DELETE: "unifiedChat.logDelete",
  BAN: "unifiedChat.logBan"
};
const PERM_KEY: Record<ManagerPermission, { label: MessageKey; hint: MessageKey }> = {
  HIDE: { label: "unifiedChat.permHide", hint: "unifiedChat.permHideHint" },
  MODERATE: { label: "unifiedChat.permModerate", hint: "unifiedChat.permModerateHint" },
  SEND: { label: "unifiedChat.permSend", hint: "unifiedChat.permSendHint" }
};
/** `BAN_DURATIONS` labels by length (null = 영구). */
const banLabel = (sec: number | null, t: T) =>
  t(sec === 300 ? "unifiedChat.ban5m" : sec === 3600 ? "unifiedChat.ban1h" : sec === 86_400 ? "unifiedChat.ban1d" : "unifiedChat.banForever");

/**
 * 통합 채팅 — code-first (no Figma frame; reference: weflab 채팅창). Route `/creator/chat`.
 * One feed for every platform the creator streams to; send to all at once; hide on our overlay; delete and
 * ban on the platform where its API allows it. `variant="window"` is the same chat as a standalone page
 * (`/popout/chat`): feed and composer only, filling the window.
 */
export function UnifiedChatScreen({ initial, variant = "studio", switches }: { initial: UnifiedChatView; variant?: "studio" | "window"; switches?: Record<OverlayTarget, boolean> }) {
  const { t } = useI18n();
  const [view, setView] = useState(initial);
  const [note, setNote] = useState<Note>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const next = await getUnifiedChat().catch(() => null);
    if (next) setView(next);
  }, []);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const run = (action: () => Promise<ChatActionResult>, ok: string) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") setNote({ tone: "ok", text: ok });
        else setNote({ tone: "error", text: res.status === "UNAUTHORIZED" ? t("unifiedChat.loginRequired") : res.message });
      } catch {
        setNote({ tone: "error", text: t("unifiedChat.actionFailed") });
      }
      await refresh();
    });
  };

  const states = useMemo(() => Object.fromEntries(view.platforms.map((p) => [p.platform, p])) as Record<Platform, ChatPlatformState>, [view.platforms]);
  const [origin, setOrigin] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);

  if (variant === "window") {
    return (
      <div className={styles.window}>
        <header className={styles.windowHead}>
          <h1 className={crew.cardTitle}>{t("unifiedChat.title")}</h1>
          <Link className={crew.muted} href="/creator/chat" target="_blank" rel="noreferrer">
            {t("unifiedChat.windowStudioLink")}
          </Link>
        </header>
        <Feed view={view} states={states} pending={pending} run={run} api={CREATOR_API} />
        <Composer states={states} onDone={refresh} setNote={setNote} send={sendUnifiedChat} />
        {note && (
          <p className={note.tone === "error" ? crew.error : crew.ok} role={note.tone === "error" ? "alert" : "status"}>
            {note.text}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className={crew.content}>
      <header className={crew.header}>
        <h1 className={crew.title}>{t("unifiedChat.title")}</h1>
        <p className={crew.subtitle}>{t("unifiedChat.subtitle")}</p>
        <p className={crew.note}>
          {t("unifiedChat.noteBefore")}
          <Link href="/creator/widgets/overlays">{t("unifiedChat.noteOverlayLink")}</Link>
          {t("unifiedChat.noteMiddle")} <Link href="/creator/chat/bot">{t("unifiedChat.noteBotLink")}</Link>
          {t("unifiedChat.noteAfter")}
        </p>
      </header>
      {switches && <OverlayOffNotice targets={["chat"]} switches={switches} />}

      <section className={crew.card} aria-labelledby="uc-window">
        <div className={crew.cardHead}>
          <h2 className={crew.cardTitle} id="uc-window">
            {t("unifiedChat.windowLinkTitle")}
          </h2>
          <button type="button" className={crew.primary} onClick={() => window.open(CHAT_WINDOW_PATH, "ssumnation-chat", "width=440,height=780")}>
            {t("unifiedChat.openWindow")}
          </button>
        </div>
        <p className={crew.note}>{t("unifiedChat.windowNote")}</p>
        <div className={crew.addRow}>
          <input className={crew.input} value={`${origin}${CHAT_WINDOW_PATH}`} readOnly aria-label={t("unifiedChat.windowLinkAria")} onFocus={(e) => e.target.select()} />
          <CopyButton value={`${origin}${CHAT_WINDOW_PATH}`} label={t("unifiedChat.copy")} className={crew.ghost} />
        </div>
      </section>

      <ManagerLinks links={view.managerLinks} origin={origin} pending={pending} run={run} />

      <div className={styles.layout}>
        <div className={styles.side}>
          <Feed view={view} states={states} pending={pending} run={run} api={CREATOR_API} />
          <Composer states={states} onDone={refresh} setNote={setNote} send={sendUnifiedChat} />
        </div>
        <div className={styles.side}>
          <Channels states={view.platforms} pending={pending} run={run} />
          <Simulator states={states} pending={pending} run={run} />
          <section className={crew.card} aria-labelledby="uc-log">
            <h2 className={crew.cardTitle} id="uc-log">
              {t("unifiedChat.logTitle")}
            </h2>
            {view.log.length === 0 ? (
              <p className={crew.empty}>{t("unifiedChat.logEmpty")}</p>
            ) : (
              <ul className={styles.logList}>
                {view.log.map((l, i) => (
                  <li key={`${l.at}-${i}`}>
                    {time(l.at)} · {PLATFORM_LABEL[l.platform]} · {t(LOG_KEY[l.action])} · {l.target} · {l.detail}
                    {l.by && t("unifiedChat.logBy", { name: l.by })}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      {note && (
        <p className={note.tone === "error" ? crew.error : crew.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}

type RunFn = (action: () => Promise<ChatActionResult>, ok: string) => void;

/** What one chat screen may do — the creator gets everything; a manager link only what the creator allowed. */
type ChatApi = {
  hide?: (input: { id: string; hidden: boolean }) => Promise<ChatActionResult>;
  remove?: (input: { id: string }) => Promise<ChatActionResult>;
  ban?: (input: { id: string; durationSec: number | null }) => Promise<ChatActionResult>;
};
const CREATOR_API: ChatApi = { hide: hideChatMessage, remove: deleteChatMessage, ban: banChatAuthor };
type FeedView = { platforms: ChatPlatformState[]; messages: UnifiedChatMessage[] };

function Feed({ view, states, pending, run, api }: { view: FeedView; states: Record<Platform, ChatPlatformState>; pending: boolean; run: RunFn; api: ChatApi }) {
  const { t } = useI18n();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [query, setQuery] = useState("");
  const [showHidden, setShowHidden] = useState(true);
  const listRef = useRef<HTMLOListElement>(null);
  const stick = useRef(true);

  const rows = view.messages.filter(
    (m) => (filter === "ALL" || m.platform === filter) && (showHidden || !m.hidden) && (!query || m.text.includes(query) || m.author.displayName.includes(query))
  );
  const lastId = rows.at(-1)?.id;

  // Follow new messages unless the creator scrolled up to read.
  useEffect(() => {
    const el = listRef.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);

  const connected = view.platforms.filter((p) => p.connected);

  return (
    <section className={`${crew.card} ${styles.feedCard}`} aria-labelledby="uc-feed">
      <div className={crew.cardHead}>
        <h2 className={crew.cardTitle} id="uc-feed">
          {t("unifiedChat.feedTitle")}
        </h2>
        <span className={crew.muted}>
          {connected.length === 0 ? t("unifiedChat.noChannels") : t("unifiedChat.connectedList", { platforms: connected.map((p) => PLATFORM_LABEL[p.platform]).join(" · ") })}
        </span>
      </div>
      <div className={styles.filters} role="group" aria-label={t("unifiedChat.platformFilter")}>
        <button type="button" className={styles.filterChip} aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")}>
          {t("unifiedChat.all")}
        </button>
        {view.platforms.map((p) => (
          <button key={p.platform} type="button" className={styles.filterChip} aria-pressed={filter === p.platform} onClick={() => setFilter(p.platform)} disabled={!p.connected} title={p.connected ? undefined : t("unifiedChat.notConnectedTitle")}>
            <PlatformMark platform={p.platform} size="sm" />
            {PLATFORM_LABEL[p.platform]}
          </button>
        ))}
        <input className={`${crew.input} ${styles.search}`} type="search" placeholder={t("unifiedChat.searchPlaceholder")} aria-label={t("unifiedChat.searchAria")} value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className={crew.checkRow}>
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          {t("unifiedChat.showHidden")}
        </label>
      </div>
      {rows.length === 0 ? (
        <p className={crew.empty}>{view.messages.length === 0 ? t("unifiedChat.feedEmpty") : t("unifiedChat.feedNoMatch")}</p>
      ) : (
        <ol
          className={styles.feed}
          ref={listRef}
          aria-live="polite"
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
          }}
        >
          {rows.map((m) => (
            <Line key={m.id} m={m} state={states[m.platform]} pending={pending} run={run} api={api} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Line({ m, state, pending, run, api }: { m: UnifiedChatMessage; state: ChatPlatformState; pending: boolean; run: RunFn; api: ChatApi }) {
  const { t } = useI18n();
  const [ban, setBan] = useState<string>("300");
  const removed = m.hidden === "DELETED" || m.hidden === "BANNED";
  const isOwner = m.author.roles.includes("OWNER");
  const duration = BAN_DURATIONS.find((d) => String(d.sec) === ban)!;
  const durationLabel = banLabel(duration.sec, t);
  const canHide = !removed && !!api.hide;
  const canRemove = !removed && !!api.remove;
  const canBan = !isOwner && m.hidden !== "BANNED" && !!api.ban;
  return (
    <li className={styles.line} data-hidden={m.hidden ? "" : undefined}>
      <PlatformMark platform={m.platform} />
      <div className={styles.lineBody}>
        <span className={styles.nick}>{m.author.displayName}</span>
        {m.author.roles.map((r) => (
          <span key={r} className={styles.role}>
            {t(ROLE_KEY[r])}
          </span>
        ))}
        {m.text}
        {m.hidden && <span className={styles.flag}>· {t(HIDDEN_KEY[m.hidden])}</span>}
        {m.fromStudio && <span className={styles.flag}>{t("unifiedChat.fromStudio")}</span>}
      </div>
      <span className={styles.time}>{time(m.sentAt)}</span>
      {(canHide || canRemove || canBan) && (
        <div className={styles.lineActions}>
          {canHide && (
            <button type="button" className={styles.mini} disabled={pending} onClick={() => run(() => api.hide!({ id: m.id, hidden: !m.hidden }), m.hidden ? t("unifiedChat.unhidden") : t("unifiedChat.hidden"))}>
              {m.hidden ? t("unifiedChat.show") : t("unifiedChat.hide")}
            </button>
          )}
          {canRemove && (
            <button
              type="button"
              className={`${styles.mini} ${styles.miniDanger}`}
              disabled={pending || !state.canModerate}
              title={state.canModerate ? t("unifiedChat.deleteOn", { platform: PLATFORM_LABEL[m.platform] }) : t("unifiedChat.unsupported")}
              onClick={() => window.confirm(t("unifiedChat.deleteConfirm", { platform: PLATFORM_LABEL[m.platform] })) && run(() => api.remove!({ id: m.id }), t("unifiedChat.deleted"))}
            >
              {t("unifiedChat.delete")}
            </button>
          )}
          {canBan && (
            <>
              <select className={styles.banSelect} aria-label={t("unifiedChat.banDuration")} value={ban} onChange={(e) => setBan(e.target.value)} disabled={!state.canModerate}>
                {BAN_DURATIONS.map((d) => (
                  <option key={d.label} value={String(d.sec)}>
                    {banLabel(d.sec, t)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`${styles.mini} ${styles.miniDanger}`}
                disabled={pending || !state.canModerate}
                title={state.canModerate ? t("unifiedChat.banOn", { platform: PLATFORM_LABEL[m.platform] }) : t("unifiedChat.unsupported")}
                onClick={() =>
                  window.confirm(t("unifiedChat.banConfirm", { name: m.author.displayName, platform: PLATFORM_LABEL[m.platform], duration: durationLabel })) &&
                  run(() => api.ban!({ id: m.id, durationSec: duration.sec }), t("unifiedChat.banned", { duration: durationLabel }))
                }
              >
                {t("unifiedChat.ban")}
              </button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

function Composer({
  states,
  onDone,
  setNote,
  send: sendFn
}: {
  states: Record<Platform, ChatPlatformState>;
  onDone: () => Promise<void>;
  setNote: (n: Note) => void;
  send: (input: { requestId: string; text: string; platforms: Platform[] }) => Promise<ChatSendResult>;
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [targets, setTargets] = useState<Platform[]>([]);
  const [results, setResults] = useState<Partial<Record<Platform, ChatSendOutcome>> | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<{ id: string; text: string } | null>(null);
  const sendable = (Object.values(states) as ChatPlatformState[]).filter((p) => p.connected && p.canSend).map((p) => p.platform);
  const chosen = targets.filter((p) => sendable.includes(p));
  const effective = chosen.length > 0 ? chosen : sendable;
  const failed = results ? Object.values(results).some((r) => r?.status === "FAILED") : false;

  const send = () => {
    const body = text.trim();
    // Same text after a partial failure → same requestId, so only the failed platforms are retried.
    if (!requestId.current || requestId.current.text !== body) requestId.current = { id: crypto.randomUUID(), text: body };
    setNote(null);
    startTransition(async () => {
      try {
        const res = await sendFn({ requestId: requestId.current!.id, text: body, platforms: effective });
        if (res.status !== "OK") {
          setNote({ tone: "error", text: res.status === "INVALID" ? res.message : t("unifiedChat.loginRequired") });
          return;
        }
        setResults(res.results);
        if (!Object.values(res.results).some((r) => r?.status === "FAILED")) {
          setText("");
          requestId.current = null;
        }
      } catch {
        setNote({ tone: "error", text: t("unifiedChat.sendFailed") });
      }
      await onDone();
    });
  };

  return (
    <section className={crew.card} aria-labelledby="uc-send">
      <h2 className={crew.cardTitle} id="uc-send">
        {t("unifiedChat.composerTitle")}
      </h2>
      <div className={styles.composer}>
        <div className={styles.targets} role="group" aria-label={t("unifiedChat.targetsAria")}>
          {(Object.values(states) as ChatPlatformState[]).map((p) => {
            const ok = p.connected && p.canSend;
            return (
              <label key={p.platform} className={styles.target} data-off={ok ? undefined : ""} title={!p.connected ? t("unifiedChat.connectFirst") : !p.canSend ? t("unifiedChat.unsupported") : undefined}>
                <input
                  type="checkbox"
                  disabled={!ok}
                  checked={ok && (chosen.length === 0 || chosen.includes(p.platform))}
                  onChange={(e) => setTargets(e.target.checked ? [...new Set([...(chosen.length ? chosen : sendable), p.platform])] : (chosen.length ? chosen : sendable).filter((x) => x !== p.platform))}
                />
                <PlatformMark platform={p.platform} size="sm" />
                {PLATFORM_LABEL[p.platform]}
                {!p.canSend && t("unifiedChat.unsupportedTag")}
              </label>
            );
          })}
        </div>
        <form
          className={styles.composerRow}
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <input className={crew.input} aria-label={t("unifiedChat.messageAria")} placeholder={sendable.length ? t("unifiedChat.composerPlaceholder") : t("unifiedChat.composerNoTargets")} maxLength={CHAT_TEXT_MAX} value={text} onChange={(e) => setText(e.target.value)} disabled={sendable.length === 0} />
          <button type="submit" className={crew.primary} disabled={pending || !text.trim() || effective.length === 0}>
            {failed && requestId.current?.text === text.trim() ? t("unifiedChat.retryFailed") : t("unifiedChat.send")}
          </button>
        </form>
        {results && (
          <ul className={styles.results} aria-label={t("unifiedChat.resultsAria")}>
            {(Object.entries(results) as [Platform, ChatSendOutcome][]).map(([p, r]) => (
              <li key={p} data-status={r.status}>
                <PlatformMark platform={p} size="sm" />
                {PLATFORM_LABEL[p]} · {t(OUTCOME_KEY[r.status])}
                {r.status === "FAILED" ? ` (${t(ERROR_KEY[r.code])})` : r.status === "UNCONFIRMED" ? ` (${t("unifiedChat.unconfirmedHint")})` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Channels({ states, pending, run }: { states: ChatPlatformState[]; pending: boolean; run: RunFn }) {
  const { t } = useI18n();
  const [handles, setHandles] = useState<Partial<Record<Platform, string>>>({});
  return (
    <section className={crew.card} aria-labelledby="uc-channels">
      <h2 className={crew.cardTitle} id="uc-channels">
        {t("unifiedChat.channelsTitle")}
      </h2>
      {states.map((p) => (
        <div key={p.platform} className={styles.channel}>
          <div className={styles.channelHead}>
            <PlatformMark platform={p.platform} />
            {PLATFORM_LABEL[p.platform]}
            <span className={styles.status} data-on={p.connected ? "" : undefined}>
              {p.connected ? t("unifiedChat.connected") : t("unifiedChat.notConnected")}
            </span>
          </div>
          {p.connected && p.channel && <span className={crew.muted}>{t("unifiedChat.channelStats", { title: p.channel.title, received: p.received, duplicates: p.duplicates })}</span>}
          {p.lastError && <span className={crew.error}>{t(ERROR_KEY[p.lastError])}</span>}
          <div className={styles.caps}>
            {(
              [
                [t("unifiedChat.capRead"), p.canRead],
                [t("unifiedChat.send"), p.canSend],
                [t("unifiedChat.capModerate"), p.canModerate]
              ] as const
            ).map(([label, on]) => (
              <span key={label} className={styles.cap} data-off={on ? undefined : ""}>
                {label}
              </span>
            ))}
            {p.unverified && <span className={styles.cap}>{t("unifiedChat.apiChecking")}</span>}
          </div>
          {p.platform === "YOUTUBE" ? (
            !p.connected && (
              <Link href="/creator/youtube" className={crew.ghost}>
                {t("unifiedChat.connectViaYoutube")}
              </Link>
            )
          ) : p.connected ? (
            <button type="button" className={crew.ghost} disabled={pending} onClick={() => run(() => disconnectBroadcastChannel({ platform: p.platform }), t("unifiedChat.disconnected", { platform: PLATFORM_LABEL[p.platform] }))}>
              {t("unifiedChat.disconnect")}
            </button>
          ) : (
            <form
              className={crew.addRow}
              onSubmit={(e) => {
                e.preventDefault();
                run(() => connectBroadcastChannel({ platform: p.platform, handle: handles[p.platform] ?? "" }), t("unifiedChat.connectedOk", { platform: PLATFORM_LABEL[p.platform] }));
              }}
            >
              <input className={crew.input} aria-label={t("unifiedChat.channelIdAria", { platform: PLATFORM_LABEL[p.platform] })} placeholder={t("unifiedChat.channelId")} maxLength={40} value={handles[p.platform] ?? ""} onChange={(e) => setHandles({ ...handles, [p.platform]: e.target.value })} />
              <button type="submit" className={crew.primary} disabled={pending}>
                {t("unifiedChat.connect")}
              </button>
            </form>
          )}
        </div>
      ))}
      <p className={crew.note}>{t("unifiedChat.oauthNote")}</p>
    </section>
  );
}

function Simulator({ states, pending, run }: { states: Record<Platform, ChatPlatformState>; pending: boolean; run: RunFn }) {
  const { t } = useI18n();
  const connected = (Object.values(states) as ChatPlatformState[]).filter((p) => p.connected).map((p) => p.platform);
  const [sim, setSim] = useState({ platform: "YOUTUBE" as Platform, nick: "시청자", text: "안녕하세요!", role: "" });
  const platform = connected.includes(sim.platform) ? sim.platform : (connected[0] ?? sim.platform);
  return (
    <section className={crew.card} aria-labelledby="uc-sim">
      <h2 className={crew.cardTitle} id="uc-sim">
        {t("unifiedChat.simTitle")}
      </h2>
      <div className={crew.addRow}>
        <select className={crew.select} aria-label={t("unifiedChat.platform")} value={platform} onChange={(e) => setSim({ ...sim, platform: e.target.value as Platform })}>
          {connected.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>
        <select className={crew.select} aria-label={t("unifiedChat.role")} value={sim.role} onChange={(e) => setSim({ ...sim, role: e.target.value })}>
          <option value="">{t("unifiedChat.roleViewer")}</option>
          <option value="MEMBER">{t("unifiedChat.roleMember")}</option>
          <option value="MODERATOR">{t("unifiedChat.roleModerator")}</option>
        </select>
      </div>
      <div className={crew.addRow}>
        <input className={crew.input} aria-label={t("unifiedChat.nickname")} maxLength={40} value={sim.nick} onChange={(e) => setSim({ ...sim, nick: e.target.value })} />
      </div>
      <div className={crew.addRow}>
        <input className={crew.input} aria-label={t("unifiedChat.message")} maxLength={CHAT_TEXT_MAX} value={sim.text} onChange={(e) => setSim({ ...sim, text: e.target.value })} />
        <button
          type="button"
          className={crew.primary}
          disabled={pending || connected.length === 0}
          onClick={() => run(() => simulateViewerChat({ ...sim, platform, requestId: crypto.randomUUID() }), t("unifiedChat.simArrived", { platform: PLATFORM_LABEL[platform] }))}
        >
          {t("unifiedChat.send")}
        </button>
      </div>
      <button type="button" className={crew.ghost} disabled={pending || connected.length === 0} onClick={() => run(() => simulateChatReconnect({ platform }), t("unifiedChat.reconnected"))}>
        {t("unifiedChat.reconnect", { platform: PLATFORM_LABEL[platform] })}
      </button>
      <p className={crew.note}>{t("unifiedChat.simNote")}</p>
    </section>
  );
}

/**
 * 매니저 채팅창 링크 (studio): one link per manager with the permissions the creator picks. Anyone with the
 * link can use it without logging in, so it is shown only here; deleting it stops the link at once.
 */
function ManagerLinks({ links, origin, pending, run }: { links: ManagerLink[]; origin: string; pending: boolean; run: RunFn }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [perms, setPerms] = useState<ManagerPermission[]>(MANAGER_DEFAULT_PERMISSIONS);
  const requestId = useRef<string | null>(null);
  const toggle = (list: ManagerPermission[], p: ManagerPermission, on: boolean) => (on ? [...new Set([...list, p])] : list.filter((x) => x !== p));
  const create = () => {
    requestId.current ??= crypto.randomUUID();
    const id = requestId.current;
    run(async () => {
      const res = await createManagerLink({ requestId: id, name, permissions: perms });
      if (res.status === "OK") {
        requestId.current = null;
        setName("");
        setPerms(MANAGER_DEFAULT_PERMISSIONS);
      }
      return res;
    }, t("unifiedChat.managerCreated", { name: name.trim() }));
  };

  return (
    <section className={crew.card} aria-labelledby="uc-managers">
      <h2 className={crew.cardTitle} id="uc-managers">
        {t("unifiedChat.managersTitle")}
      </h2>
      <p className={crew.note}>{t("unifiedChat.managersNote")}</p>
      {links.length > 0 && (
        <ul className={styles.managerList}>
          {links.map((l) => {
            const url = `${origin}${l.path}`;
            return (
              <li key={l.id}>
                <div className={styles.managerHead}>
                  <strong>{l.name}</strong>
                  <span className={crew.muted}>{l.lastUsedAt ? t("unifiedChat.lastUsed", { time: time(l.lastUsedAt) }) : t("unifiedChat.neverOpened")}</span>
                  <button
                    type="button"
                    className={crew.danger}
                    disabled={pending}
                    onClick={() => window.confirm(t("unifiedChat.managerDeleteConfirm", { name: l.name })) && run(() => deleteManagerLink({ id: l.id }), t("unifiedChat.linkDeleted"))}
                  >
                    {t("unifiedChat.delete")}
                  </button>
                </div>
                <div className={styles.permRow} role="group" aria-label={t("unifiedChat.permsAria", { name: l.name })}>
                  <span className={crew.chipOff}>{t("unifiedChat.permView")}</span>
                  {MANAGER_PERMISSIONS.map((p) => (
                    <label key={p.key} className={crew.checkRow} title={t(PERM_KEY[p.key].hint)}>
                      <input
                        type="checkbox"
                        checked={l.permissions.includes(p.key)}
                        disabled={pending}
                        onChange={(e) => run(() => setManagerLinkPermissions({ id: l.id, permissions: toggle(l.permissions, p.key, e.target.checked) }), t("unifiedChat.permsChanged"))}
                      />
                      {t(PERM_KEY[p.key].label)}
                    </label>
                  ))}
                </div>
                <div className={crew.addRow}>
                  <input className={crew.input} value={url} readOnly aria-label={t("unifiedChat.managerLinkAria", { name: l.name })} onFocus={(e) => e.target.select()} />
                  <CopyButton value={url} label={t("unifiedChat.copy")} className={crew.ghost} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {links.length < MANAGER_LINKS_MAX ? (
        <form
          className={styles.managerForm}
          onSubmit={(e) => {
            e.preventDefault();
            create();
          }}
        >
          <input className={crew.input} aria-label={t("unifiedChat.managerName")} placeholder={t("unifiedChat.managerNamePlaceholder")} maxLength={MANAGER_NAME_MAX} value={name} onChange={(e) => setName(e.target.value)} />
          <div className={styles.permRow} role="group" aria-label={t("unifiedChat.newLinkPerms")}>
            {MANAGER_PERMISSIONS.map((p) => (
              <label key={p.key} className={crew.checkRow} title={t(PERM_KEY[p.key].hint)}>
                <input type="checkbox" checked={perms.includes(p.key)} onChange={(e) => setPerms(toggle(perms, p.key, e.target.checked))} />
                {t(PERM_KEY[p.key].label)}
              </label>
            ))}
          </div>
          <button type="submit" className={crew.primary} disabled={pending || !name.trim()}>
            {t("unifiedChat.createLink")}
          </button>
        </form>
      ) : (
        <p className={crew.muted}>{t("unifiedChat.managerMax", { max: MANAGER_LINKS_MAX })}</p>
      )}
    </section>
  );
}

/**
 * 매니저 채팅창 (`/popout/chat/m/[token]`, no login): the chat with only the actions this link allows.
 * Permission changes and deletion apply on the next read (every 1.5s).
 */
export function ManagerChatScreen({ token, initial }: { token: string; initial: ManagerChatView }) {
  const { t } = useI18n();
  const [view, setView] = useState<ManagerChatView | null>(initial);
  const [note, setNote] = useState<Note>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const next = await getManagerChat(token).catch(() => undefined);
    if (next === "FORBIDDEN") setView(null);
    else if (next) setView(next);
  }, [token]);

  useEffect(() => {
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  const run: RunFn = (action, ok) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") setNote({ tone: "ok", text: ok });
        else setNote({ tone: "error", text: res.status === "UNAUTHORIZED" ? t("unifiedChat.noPermission") : res.message });
      } catch {
        setNote({ tone: "error", text: t("unifiedChat.actionFailed") });
      }
      await refresh();
    });
  };

  const states = useMemo(() => Object.fromEntries((view?.platforms ?? []).map((p) => [p.platform, p])) as Record<Platform, ChatPlatformState>, [view?.platforms]);
  const perms = view?.permissions ?? [];
  const api: ChatApi = {
    hide: perms.includes("HIDE") ? (i) => managerHideMessage(token, i) : undefined,
    remove: perms.includes("MODERATE") ? (i) => managerDeleteMessage(token, i) : undefined,
    ban: perms.includes("MODERATE") ? (i) => managerBanAuthor(token, i) : undefined
  };

  if (!view) {
    return (
      <div className={styles.window}>
        <p className={crew.empty}>{t("unifiedChat.managerGone")}</p>
      </div>
    );
  }
  return (
    <div className={styles.window}>
      <header className={styles.windowHead}>
        <h1 className={crew.cardTitle}>{t("unifiedChat.title")}</h1>
        <span className={crew.muted}>
          {t("unifiedChat.managerHead", {
            name: view.name,
            perms: MANAGER_PERMISSIONS.filter((p) => perms.includes(p.key))
              .map((p) => ` · ${t(PERM_KEY[p.key].label)}`)
              .join("")
          })}
        </span>
      </header>
      <Feed view={view} states={states} pending={pending} run={run} api={api} />
      {perms.includes("SEND") && <Composer states={states} onDone={refresh} setNote={setNote} send={(i) => managerSendChat(token, i)} />}
      {note && (
        <p className={note.tone === "error" ? crew.error : crew.ok} role={note.tone === "error" ? "alert" : "status"}>
          {note.text}
        </p>
      )}
    </div>
  );
}
