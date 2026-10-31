"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Toast } from "@/components/ui/Toast";
import { kstIsoString } from "@/lib/format";
import {
  addFlextvBanWord,
  addFlextvChatMember,
  removeFlextvBanWord,
  removeFlextvChatMember,
  removeFlextvYoutubeLink,
  saveFlextvChatText,
  saveFlextvYoutubeLink,
  showFlextvYoutubeChat
} from "@/services/creator/flextvChatSettings";
import { BAN_WORD_MAX, CHAT_NOTICE_MAX, type ChatMember, type ChatSettingResult, type FlextvChatSettingsView, type YoutubeChatLink } from "@/services/creator/flextvChatSettingsTypes";
import styles from "../broadcast/broadcast.module.css";
import settings from "../settings/flextvChannelSettings.module.css";
import local from "./flextvChatSettings.module.css";

const LOGIN = "/login?role=creator&next=/creator/chat";
const UNREACHABLE = "FLEXTV가 응답하지 않았어요. 잠시 후 다시 시도해 주세요.";

/** A call FLEXTV did not answer shows a message under its part instead of the error page. */
async function attempt(call: () => Promise<ChatSettingResult>): Promise<ChatSettingResult> {
  try {
    return await call();
  } catch {
    return { status: "INVALID", message: UNREACHABLE };
  }
}

const day = (iso: string) => (iso ? kstIsoString(iso).slice(0, 10).replace(/-/g, ".") : "");

type Settle = (result: ChatSettingResult, ok: string) => string | null;

/**
 * 채팅 관리 with FLEXTV (phase 9; code-first, no Figma frame — FLEXTV's own channel and broadcast settings are the
 * reference). Route `/creator/chat`. The channel's chat on FLEXTV: its pop-up 공지 and 규칙, 금지어, 매니저, 블랙리스트
 * and the YouTube live chat it brings in. Each part is saved on its own; every value is checked again on the server.
 */
export function FlextvChatSettingsScreen({ view }: { view: FlextvChatSettingsView }) {
  const router = useRouter();
  const [toast, setToast] = useState<string | null>(null);
  const clear = useCallback(() => setToast(null), []);

  /** The message to show under the part, or null when it was saved (the page reloads with the new state). */
  const settle: Settle = (result, ok) => {
    if (result.status === "UNAUTHORIZED") {
      router.push(LOGIN);
      return null;
    }
    if (result.status === "SAVED") {
      setToast(ok);
      router.refresh();
      return null;
    }
    return result.message;
  };

  return (
    <div className={styles.content}>
      <h1 className={styles.pageTitle}>채팅 관리</h1>
      <p className={styles.help}>FLEXTV 방송 채팅창의 설정이에요. 여기서 바꾸면 FLEXTV 채팅에 바로 반영돼요.</p>
      {/* Keyed by the kept text: after a save the box shows what FLEXTV kept (it filters forbidden words out). */}
      <ChatTextCard key={`notice:${view.notice}`} which="notice" title="채팅 공지" help="시청자가 채팅창에 들어오면 팝업으로 보여요. 비워 두고 저장하면 공지가 내려가요." current={view.notice} settle={settle} />
      <ChatTextCard key={`rule:${view.rule}`} which="rule" title="채팅 규칙" help="시청자가 채팅을 시작하기 전에 확인하는 규칙이에요. 비워 두고 저장하면 규칙이 내려가요." current={view.rule} settle={settle} />
      <BanWordsCard words={view.banWords} settle={settle} />
      <MembersCard list="managers" title="매니저" help="매니저는 방송 중 채팅을 함께 관리해요. FLEXTV 아이디로 추가해요." members={view.managers} settle={settle} />
      <MembersCard list="blacklist" title="블랙리스트" help="블랙리스트에 넣은 회원은 FLEXTV에서 내 방송국 이용이 제한돼요. FLEXTV 아이디로 추가해요." members={view.blacklist} settle={settle} />
      <YoutubeCard link={view.youtube} settle={settle} />
      <Toast message={toast} tone="neutral" onDone={clear} />
    </div>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p className={styles.error} role="alert">
      {text}
    </p>
  ) : null;
}

function ChatTextCard({ which, title, help, current, settle }: { which: "notice" | "rule"; title: string; help: string; current: string; settle: Settle }) {
  const [text, setText] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = `chat-${which}`;
  const object = which === "notice" ? "채팅 공지를" : "채팅 규칙을";
  const save = () => start(async () => setError(settle(await attempt(() => saveFlextvChatText(which, text)), text.trim() ? `${object} 저장했어요.` : `${object} 내렸어요.`)));
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {title}
      </h2>
      <p className={styles.help}>{help}</p>
      <textarea
        className={`${styles.input} ${settings.textarea}`}
        aria-labelledby={id}
        maxLength={CHAT_NOTICE_MAX}
        rows={4}
        value={text}
        placeholder={`최대 ${CHAT_NOTICE_MAX}자`}
        onChange={(e) => setText(e.target.value)}
      />
      <div className={styles.actions}>
        <span className={styles.hint}>
          {text.length} / {CHAT_NOTICE_MAX} · 금지된 단어는 FLEXTV가 걸러서 저장해요
        </span>
        <button type="button" className={styles.secondaryButton} disabled={pending || text.trim() === current.trim()} onClick={save}>
          저장
        </button>
      </div>
      <Problem text={error} />
    </section>
  );
}

function BanWordsCard({ words, settle }: { words: FlextvChatSettingsView["banWords"]; settle: Settle }) {
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const add = () =>
    start(async () => {
      const problem = settle(await attempt(() => addFlextvBanWord(word)), "금지어를 추가했어요.");
      setError(problem);
      if (!problem) setWord("");
    });
  const remove = (id: string) => start(async () => setError(settle(await attempt(() => removeFlextvBanWord(id)), "금지어를 지웠어요.")));
  return (
    <section className={styles.card} aria-labelledby="chat-words">
      <h2 id="chat-words" className={styles.cardTitle}>
        금지어
      </h2>
      <p className={styles.help}>내 방송 채팅에서 걸러지는 단어예요. FLEXTV 전체 금지어에 더해 적용돼요.</p>
      {words.length === 0 ? (
        <p className={styles.empty}>등록한 금지어가 없어요.</p>
      ) : (
        <ul className={local.words} aria-label="등록한 금지어">
          {words.map((w) => (
            <li key={w.id} className={local.word}>
              {w.word}
              <button type="button" className={local.wordRemove} aria-label={`${w.word} 지우기`} disabled={pending} onClick={() => remove(w.id)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className={styles.inline}
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className={`${styles.input} ${settings.grow}`}
          aria-label="추가할 금지어"
          placeholder={`금지어 (최대 ${BAN_WORD_MAX}자)`}
          maxLength={BAN_WORD_MAX}
          value={word}
          onChange={(e) => {
            setWord(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className={styles.secondaryButton} disabled={pending || !word.trim()}>
          추가
        </button>
      </form>
      <Problem text={error} />
    </section>
  );
}

function MembersCard({ list, title, help, members, settle }: { list: "managers" | "blacklist"; title: string; help: string; members: ChatMember[]; settle: Settle }) {
  const [loginId, setLoginId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = `chat-${list}`;
  const add = () =>
    start(async () => {
      const problem = settle(await attempt(() => addFlextvChatMember(list, loginId)), `${title}에 추가했어요.`);
      setError(problem);
      if (!problem) setLoginId("");
    });
  const remove = (m: ChatMember) => {
    if (!window.confirm(`${m.nickname}(${m.loginId}) 님을 ${title}에서 뺄까요?`)) return;
    start(async () => setError(settle(await attempt(() => removeFlextvChatMember(list, m.loginId)), `${title}에서 뺐어요.`)));
  };
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {title} <span className={styles.hint}>{members.length}명</span>
      </h2>
      <p className={styles.help}>{help}</p>
      {members.length === 0 ? (
        <p className={styles.empty}>{title}에 등록한 회원이 없어요.</p>
      ) : (
        <ul className={local.members} aria-labelledby={id}>
          {members.map((m) => (
            <li key={m.loginId} className={local.member}>
              <span className={local.memberName}>
                <strong>{m.nickname}</strong>
                <span className={styles.hint}>
                  {m.loginId}
                  {m.since && ` · ${day(m.since)} 등록`}
                </span>
              </span>
              <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => remove(m)}>
                빼기
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className={styles.inline}
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          className={`${styles.input} ${settings.grow}`}
          aria-label={`${title}에 추가할 FLEXTV 아이디`}
          placeholder="FLEXTV 아이디"
          maxLength={40}
          autoComplete="off"
          value={loginId}
          onChange={(e) => {
            setLoginId(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className={styles.secondaryButton} disabled={pending || !loginId.trim()}>
          추가
        </button>
      </form>
      <Problem text={error} />
    </section>
  );
}

const LINK_KIND: Record<YoutubeChatLink["kind"], string> = { channelId: "채널 ID", handle: "핸들", videoId: "라이브 영상" };

function YoutubeCard({ link, settle }: { link: YoutubeChatLink | null; settle: Settle }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const problem = settle(await attempt(() => saveFlextvYoutubeLink(url)), "유튜브 채팅을 연결했어요.");
      setError(problem);
      if (!problem) setUrl("");
    });
  const unlink = () => {
    if (!window.confirm("유튜브 채팅 연결을 해제할까요?")) return;
    start(async () => setError(settle(await attempt(() => removeFlextvYoutubeLink()), "유튜브 채팅 연결을 해제했어요.")));
  };
  const show = (on: boolean) => start(async () => setError(settle(await attempt(() => showFlextvYoutubeChat(on)), on ? "유튜브 채팅을 채팅창에 보여 줘요." : "유튜브 채팅을 채팅창에서 숨겼어요.")));
  return (
    <section className={styles.card} aria-labelledby="chat-youtube">
      <h2 id="chat-youtube" className={styles.cardTitle}>
        유튜브 채팅 가져오기
      </h2>
      <p className={styles.help}>유튜브에서 함께 방송할 때, 그 유튜브 라이브의 채팅을 FLEXTV 채팅창으로 가져와요. 유튜브 채널 주소, @핸들이나 라이브 영상 주소를 넣어 주세요.</p>
      {link ? (
        <>
          <dl className={local.link}>
            <dt>연결된 유튜브</dt>
            <dd>
              {link.raw} <span className={styles.hint}>({LINK_KIND[link.kind]})</span>
            </dd>
            {link.savedAt && (
              <>
                <dt>마지막 저장</dt>
                <dd>
                  {kstIsoString(link.savedAt).slice(0, 16).replace("T", " ")} <span className={styles.hint}>· FLEXTV는 마지막으로 바꾼 때부터 24시간 동안 연결을 기억해요</span>
                </dd>
              </>
            )}
          </dl>
          <label className={local.toggle}>
            <input type="checkbox" checked={link.showInChat} disabled={pending} onChange={(e) => show(e.target.checked)} />
            유튜브 채팅을 FLEXTV 채팅창에 보이기
          </label>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} disabled={pending} onClick={unlink}>
              연결 해제
            </button>
          </div>
        </>
      ) : (
        <p className={styles.empty}>연결한 유튜브 채널이 없어요.</p>
      )}
      <form
        className={styles.inline}
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <input
          className={`${styles.input} ${settings.grow}`}
          aria-label="유튜브 채널 주소"
          placeholder="https://www.youtube.com/@채널"
          inputMode="url"
          maxLength={300}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className={styles.secondaryButton} disabled={pending || !url.trim()}>
          {link ? "바꾸기" : "연결"}
        </button>
      </form>
      <Problem text={error} />
    </section>
  );
}
