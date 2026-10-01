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
  BAN_DURATIONS,
  CHAT_TEXT_MAX,
  HIDDEN_LABEL,
  ROLE_LABEL,
  SEND_OUTCOME_LABEL,
  type ChatActionResult,
  type ChatPlatformState,
  type ChatSendOutcome,
  type UnifiedChatMessage,
  type UnifiedChatView
} from "@/services/broadcast/chatTypes";
import { PLATFORM_ERROR_LABEL } from "@/services/platforms/platformTypes";
import { PLATFORM_LABEL, type Platform } from "@/types/platform";
import crew from "../creatorStudio/crew/crew.module.css";
import styles from "./chat.module.css";
import { PlatformMark } from "./PlatformMark";

const POLL_MS = 1_500;
const time = (iso: string) => new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
const UNSUPPORTED_TITLE = "이 플랫폼은 지원하지 않거나 API 확인 중이에요 (TBD)";
type Note = { tone: "ok" | "error"; text: string } | null;
type Filter = Platform | "ALL";

/**
 * 통합 채팅 — code-first (no Figma frame; reference: weflab 채팅창). Route `/creator/chat`.
 * One feed for every platform the creator streams to; send to all at once; hide on our overlay; delete and
 * ban on the platform where its API allows it.
 */
export function UnifiedChatScreen({ initial }: { initial: UnifiedChatView }) {
  const [view, setView] = useState(initial);
  const [note, setNote] = useState<Note>(null);
  const [pending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const next = await getUnifiedChat().catch(() => null);
    if (next) setView(next);
  }, []);

  useEffect(() => {
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]);

  const run = (action: () => Promise<ChatActionResult>, ok: string) => {
    setNote(null);
    startTransition(async () => {
      try {
        const res = await action();
        if (res.status === "OK") setNote({ tone: "ok", text: ok });
        else setNote({ tone: "error", text: res.status === "UNAUTHORIZED" ? "로그인이 필요합니다." : res.message });
      } catch {
        setNote({ tone: "error", text: "처리하지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
      await refresh();
    });
  };

  const states = useMemo(() => Object.fromEntries(view.platforms.map((p) => [p.platform, p])) as Record<Platform, ChatPlatformState>, [view.platforms]);

  return (
    <div className={crew.content}>
      <header className={crew.header}>
        <h1 className={crew.title}>통합 채팅</h1>
        <p className={crew.subtitle}>여러 플랫폼에 동시 송출할 때 채팅을 한곳에서 보고, 한 번에 답하고, 관리해요.</p>
        <p className={crew.note}>
          방송 화면용 채팅창은 <Link href="/creator/widgets/overlays">오버레이 주소</Link>의 &lsquo;통합 채팅&rsquo;을 OBS에 넣어요 · 숨김은 오버레이에서만 가리고, 삭제 · 차단은 플랫폼에서 처리돼요 · 플랫폼마다 지원 범위가 달라요.
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.side}>
          <Feed view={view} states={states} pending={pending} run={run} />
          <Composer states={states} onDone={refresh} setNote={setNote} />
        </div>
        <div className={styles.side}>
          <Channels states={view.platforms} pending={pending} run={run} />
          <Simulator states={states} pending={pending} run={run} />
          <section className={crew.card} aria-labelledby="uc-log">
            <h2 className={crew.cardTitle} id="uc-log">
              🧾 관리 기록
            </h2>
            {view.log.length === 0 ? (
              <p className={crew.empty}>아직 관리한 메시지가 없어요.</p>
            ) : (
              <ul className={styles.logList}>
                {view.log.map((l, i) => (
                  <li key={`${l.at}-${i}`}>
                    {time(l.at)} · {PLATFORM_LABEL[l.platform]} · {{ HIDE: "숨김", UNHIDE: "다시 보이기", DELETE: "삭제", BAN: "차단" }[l.action]} · {l.target} · {l.detail}
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

function Feed({ view, states, pending, run }: { view: UnifiedChatView; states: Record<Platform, ChatPlatformState>; pending: boolean; run: RunFn }) {
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
          💬 채팅
        </h2>
        <span className={crew.muted}>{connected.length === 0 ? "연결된 채널이 없어요" : `${connected.map((p) => PLATFORM_LABEL[p.platform]).join(" · ")} 연결됨`}</span>
      </div>
      <div className={styles.filters} role="group" aria-label="플랫폼 필터">
        <button type="button" className={styles.filterChip} aria-pressed={filter === "ALL"} onClick={() => setFilter("ALL")}>
          전체
        </button>
        {view.platforms.map((p) => (
          <button key={p.platform} type="button" className={styles.filterChip} aria-pressed={filter === p.platform} onClick={() => setFilter(p.platform)} disabled={!p.connected}>
            <PlatformMark platform={p.platform} size="sm" />
            {PLATFORM_LABEL[p.platform]}
          </button>
        ))}
        <input className={`${crew.input} ${styles.search}`} type="search" placeholder="닉네임 · 내용 검색" aria-label="채팅 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <label className={crew.checkRow}>
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          숨긴 메시지 보기
        </label>
      </div>
      {rows.length === 0 ? (
        <p className={crew.empty}>{view.messages.length === 0 ? "아직 채팅이 없어요. 채널을 연결하고 방송을 시작하면 여기에 모여요." : "조건에 맞는 채팅이 없어요."}</p>
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
            <Line key={m.id} m={m} state={states[m.platform]} pending={pending} run={run} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Line({ m, state, pending, run }: { m: UnifiedChatMessage; state: ChatPlatformState; pending: boolean; run: RunFn }) {
  const [ban, setBan] = useState<string>("300");
  const removed = m.hidden === "DELETED" || m.hidden === "BANNED";
  const isOwner = m.author.roles.includes("OWNER");
  const duration = BAN_DURATIONS.find((d) => String(d.sec) === ban)!;
  return (
    <li className={styles.line} data-hidden={m.hidden ? "" : undefined}>
      <PlatformMark platform={m.platform} />
      <div className={styles.lineBody}>
        <span className={styles.nick}>{m.author.displayName}</span>
        {m.author.roles.map((r) => (
          <span key={r} className={styles.role}>
            {ROLE_LABEL[r]}
          </span>
        ))}
        {m.text}
        {m.hidden && <span className={styles.flag}>· {HIDDEN_LABEL[m.hidden]}</span>}
        {m.fromStudio && <span className={styles.flag}>· 통합 입력</span>}
      </div>
      <span className={styles.time}>{time(m.sentAt)}</span>
      <div className={styles.lineActions}>
        {!removed && (
          <button type="button" className={styles.mini} disabled={pending} onClick={() => run(() => hideChatMessage({ id: m.id, hidden: !m.hidden }), m.hidden ? "다시 보이게 했어요." : "오버레이에서 숨겼어요.")}>
            {m.hidden ? "보이기" : "숨김"}
          </button>
        )}
        {!removed && (
          <button
            type="button"
            className={`${styles.mini} ${styles.miniDanger}`}
            disabled={pending || !state.canModerate}
            title={state.canModerate ? `${PLATFORM_LABEL[m.platform]}에서 삭제` : UNSUPPORTED_TITLE}
            onClick={() => window.confirm(`${PLATFORM_LABEL[m.platform]}에서 이 메시지를 삭제할까요?`) && run(() => deleteChatMessage({ id: m.id }), "플랫폼에서 삭제했어요.")}
          >
            삭제
          </button>
        )}
        {!isOwner && m.hidden !== "BANNED" && (
          <>
            <select className={styles.banSelect} aria-label="차단 기간" value={ban} onChange={(e) => setBan(e.target.value)} disabled={!state.canModerate}>
              {BAN_DURATIONS.map((d) => (
                <option key={d.label} value={String(d.sec)}>
                  {d.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${styles.mini} ${styles.miniDanger}`}
              disabled={pending || !state.canModerate}
              title={state.canModerate ? `${PLATFORM_LABEL[m.platform]}에서 차단` : UNSUPPORTED_TITLE}
              onClick={() =>
                window.confirm(`${m.author.displayName}님을 ${PLATFORM_LABEL[m.platform]}에서 ${duration.label} 차단할까요?`) &&
                run(() => banChatAuthor({ id: m.id, durationSec: duration.sec }), `${duration.label} 차단했어요.`)
              }
            >
              차단
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function Composer({ states, onDone, setNote }: { states: Record<Platform, ChatPlatformState>; onDone: () => Promise<void>; setNote: (n: Note) => void }) {
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
        const res = await sendUnifiedChat({ requestId: requestId.current!.id, text: body, platforms: effective });
        if (res.status !== "OK") {
          setNote({ tone: "error", text: res.status === "INVALID" ? res.message : "로그인이 필요합니다." });
          return;
        }
        setResults(res.results);
        if (!Object.values(res.results).some((r) => r?.status === "FAILED")) {
          setText("");
          requestId.current = null;
        }
      } catch {
        setNote({ tone: "error", text: "보내지 못했어요. 잠시 후 다시 시도해 주세요." });
      }
      await onDone();
    });
  };

  return (
    <section className={crew.card} aria-labelledby="uc-send">
      <h2 className={crew.cardTitle} id="uc-send">
        ✍️ 통합 입력
      </h2>
      <div className={styles.composer}>
        <div className={styles.targets} role="group" aria-label="보낼 플랫폼">
          {(Object.values(states) as ChatPlatformState[]).map((p) => {
            const ok = p.connected && p.canSend;
            return (
              <label key={p.platform} className={styles.target} data-off={ok ? undefined : ""} title={!p.connected ? "채널을 먼저 연결해 주세요" : !p.canSend ? UNSUPPORTED_TITLE : undefined}>
                <input
                  type="checkbox"
                  disabled={!ok}
                  checked={ok && (chosen.length === 0 || chosen.includes(p.platform))}
                  onChange={(e) => setTargets(e.target.checked ? [...new Set([...(chosen.length ? chosen : sendable), p.platform])] : (chosen.length ? chosen : sendable).filter((x) => x !== p.platform))}
                />
                <PlatformMark platform={p.platform} size="sm" />
                {PLATFORM_LABEL[p.platform]}
                {!p.canSend && " (미지원)"}
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
          <input className={crew.input} aria-label="보낼 메시지" placeholder={sendable.length ? "모든 플랫폼에 한 번에 보내요" : "보낼 수 있는 플랫폼이 연결되지 않았어요"} maxLength={CHAT_TEXT_MAX} value={text} onChange={(e) => setText(e.target.value)} disabled={sendable.length === 0} />
          <button type="submit" className={crew.primary} disabled={pending || !text.trim() || effective.length === 0}>
            {failed && requestId.current?.text === text.trim() ? "실패한 곳 다시 보내기" : "보내기"}
          </button>
        </form>
        {results && (
          <ul className={styles.results} aria-label="플랫폼별 결과">
            {(Object.entries(results) as [Platform, ChatSendOutcome][]).map(([p, r]) => (
              <li key={p} data-status={r.status}>
                <PlatformMark platform={p} size="sm" />
                {PLATFORM_LABEL[p]} · {SEND_OUTCOME_LABEL[r.status]}
                {r.status === "FAILED" ? ` (${PLATFORM_ERROR_LABEL[r.code]})` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Channels({ states, pending, run }: { states: ChatPlatformState[]; pending: boolean; run: RunFn }) {
  const [handles, setHandles] = useState<Partial<Record<Platform, string>>>({});
  return (
    <section className={crew.card} aria-labelledby="uc-channels">
      <h2 className={crew.cardTitle} id="uc-channels">
        🔌 채널 연결
      </h2>
      {states.map((p) => (
        <div key={p.platform} className={styles.channel}>
          <div className={styles.channelHead}>
            <PlatformMark platform={p.platform} />
            {PLATFORM_LABEL[p.platform]}
            <span className={styles.status} data-on={p.connected ? "" : undefined}>
              {p.connected ? "연결됨" : "연결 안 됨"}
            </span>
          </div>
          {p.connected && p.channel && <span className={crew.muted}>{p.channel.title} · 받은 채팅 {p.received} · 중복 무시 {p.duplicates}</span>}
          {p.lastError && <span className={crew.error}>{PLATFORM_ERROR_LABEL[p.lastError]}</span>}
          <div className={styles.caps}>
            {(
              [
                ["읽기", p.canRead],
                ["보내기", p.canSend],
                ["삭제 · 차단", p.canModerate]
              ] as const
            ).map(([label, on]) => (
              <span key={label} className={styles.cap} data-off={on ? undefined : ""}>
                {label}
              </span>
            ))}
            {p.unverified && <span className={styles.cap}>API 확인 중</span>}
          </div>
          {p.platform === "YOUTUBE" ? (
            !p.connected && (
              <Link href="/creator/youtube" className={crew.ghost}>
                유튜브 연동에서 연결
              </Link>
            )
          ) : p.connected ? (
            <button type="button" className={crew.ghost} disabled={pending} onClick={() => run(() => disconnectBroadcastChannel({ platform: p.platform }), `${PLATFORM_LABEL[p.platform]} 연결을 해제했어요.`)}>
              연결 해제
            </button>
          ) : (
            <form
              className={crew.addRow}
              onSubmit={(e) => {
                e.preventDefault();
                run(() => connectBroadcastChannel({ platform: p.platform, handle: handles[p.platform] ?? "" }), `${PLATFORM_LABEL[p.platform]} 채널을 연결했어요.`);
              }}
            >
              <input className={crew.input} aria-label={`${PLATFORM_LABEL[p.platform]} 채널 아이디`} placeholder="채널 아이디" maxLength={40} value={handles[p.platform] ?? ""} onChange={(e) => setHandles({ ...handles, [p.platform]: e.target.value })} />
              <button type="submit" className={crew.primary} disabled={pending}>
                연결
              </button>
            </form>
          )}
        </div>
      ))}
      <p className={crew.note}>
        플랫폼 로그인(OAuth) 연결은 준비 중이라 지금은 채널 아이디로 연결해요 (TBD).
      </p>
    </section>
  );
}

function Simulator({ states, pending, run }: { states: Record<Platform, ChatPlatformState>; pending: boolean; run: RunFn }) {
  const connected = (Object.values(states) as ChatPlatformState[]).filter((p) => p.connected).map((p) => p.platform);
  const [sim, setSim] = useState({ platform: "YOUTUBE" as Platform, nick: "시청자", text: "안녕하세요!", role: "" });
  const platform = connected.includes(sim.platform) ? sim.platform : (connected[0] ?? sim.platform);
  return (
    <section className={crew.card} aria-labelledby="uc-sim">
      <h2 className={crew.cardTitle} id="uc-sim">
        🧪 테스트 채팅 (개발용)
      </h2>
      <div className={crew.addRow}>
        <select className={crew.select} aria-label="플랫폼" value={platform} onChange={(e) => setSim({ ...sim, platform: e.target.value as Platform })}>
          {connected.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABEL[p]}
            </option>
          ))}
        </select>
        <select className={crew.select} aria-label="역할" value={sim.role} onChange={(e) => setSim({ ...sim, role: e.target.value })}>
          <option value="">일반</option>
          <option value="MEMBER">구독자</option>
          <option value="MODERATOR">매니저</option>
        </select>
      </div>
      <div className={crew.addRow}>
        <input className={crew.input} aria-label="닉네임" maxLength={40} value={sim.nick} onChange={(e) => setSim({ ...sim, nick: e.target.value })} />
      </div>
      <div className={crew.addRow}>
        <input className={crew.input} aria-label="메시지" maxLength={CHAT_TEXT_MAX} value={sim.text} onChange={(e) => setSim({ ...sim, text: e.target.value })} />
        <button
          type="button"
          className={crew.primary}
          disabled={pending || connected.length === 0}
          onClick={() => run(() => simulateViewerChat({ ...sim, platform, requestId: crypto.randomUUID() }), `${PLATFORM_LABEL[platform]} 채팅이 들어왔어요.`)}
        >
          보내기
        </button>
      </div>
      <button type="button" className={crew.ghost} disabled={pending || connected.length === 0} onClick={() => run(() => simulateChatReconnect({ platform }), "재연결했어요. 다시 받은 메시지는 중복으로 걸러져요.")}>
        {PLATFORM_LABEL[platform]} 재연결 (중복 방지 확인)
      </button>
      <p className={crew.note}>시청자가 플랫폼에서 채팅한 것처럼 흉내 내요. 채널이 연결된 플랫폼만 고를 수 있어요.</p>
    </section>
  );
}
