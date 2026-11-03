"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState, useTransition } from "react";
import { Toast } from "@/components/ui/Toast";
import { kstIsoString } from "@/lib/format";
import { useI18n } from "@/lib/i18n/I18nProvider";
import type { MessageKey } from "@/lib/i18n/translate";
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

/** A call FLEXTV did not answer shows a message under its part instead of the error page. */
async function attempt(call: () => Promise<ChatSettingResult>): Promise<ChatSettingResult | null> {
  try {
    return await call();
  } catch {
    return null;
  }
}

const day = (iso: string) => (iso ? kstIsoString(iso).slice(0, 10).replace(/-/g, ".") : "");

type Settle = (result: ChatSettingResult | null, ok: string) => string | null;

const TEXT_KEYS: Record<"notice" | "rule", { title: MessageKey; help: MessageKey; saved: MessageKey; removed: MessageKey }> = {
  notice: {
    title: "flextvChatSettings.noticeTitle",
    help: "flextvChatSettings.noticeHelp",
    saved: "flextvChatSettings.noticeSaved",
    removed: "flextvChatSettings.noticeRemoved"
  },
  rule: {
    title: "flextvChatSettings.ruleTitle",
    help: "flextvChatSettings.ruleHelp",
    saved: "flextvChatSettings.ruleSaved",
    removed: "flextvChatSettings.ruleRemoved"
  }
};

const LIST_KEYS: Record<
  "managers" | "blacklist",
  { title: MessageKey; help: MessageKey; empty: MessageKey; addAria: MessageKey; added: MessageKey; removeConfirm: MessageKey; removed: MessageKey }
> = {
  managers: {
    title: "flextvChatSettings.managersTitle",
    help: "flextvChatSettings.managersHelp",
    empty: "flextvChatSettings.managersEmpty",
    addAria: "flextvChatSettings.managersAddAria",
    added: "flextvChatSettings.managersAdded",
    removeConfirm: "flextvChatSettings.managersRemoveConfirm",
    removed: "flextvChatSettings.managersRemoved"
  },
  blacklist: {
    title: "flextvChatSettings.blacklistTitle",
    help: "flextvChatSettings.blacklistHelp",
    empty: "flextvChatSettings.blacklistEmpty",
    addAria: "flextvChatSettings.blacklistAddAria",
    added: "flextvChatSettings.blacklistAdded",
    removeConfirm: "flextvChatSettings.blacklistRemoveConfirm",
    removed: "flextvChatSettings.blacklistRemoved"
  }
};

/**
 * 채팅 관리 with FLEXTV (phase 9; code-first, no Figma frame — FLEXTV's own channel and broadcast settings are the
 * reference). Route `/creator/chat`. The channel's chat on FLEXTV: its pop-up 공지 and 규칙, 금지어, 매니저, 블랙리스트
 * and the YouTube live chat it brings in. Each part is saved on its own; every value is checked again on the server.
 */
export function FlextvChatSettingsScreen({ view }: { view: FlextvChatSettingsView }) {
  const router = useRouter();
  const { t } = useI18n();
  const [toast, setToast] = useState<string | null>(null);
  const clear = useCallback(() => setToast(null), []);

  /** The message to show under the part, or null when it was saved (the page reloads with the new state). */
  const settle: Settle = (result, ok) => {
    if (!result) return t("flextvChatSettings.unreachable");
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
      <h1 className={styles.pageTitle}>{t("flextvChatSettings.title")}</h1>
      <p className={styles.help}>{t("flextvChatSettings.intro")}</p>
      {/* Keyed by the kept text: after a save the box shows what FLEXTV kept (it filters forbidden words out). */}
      <ChatTextCard key={`notice:${view.notice}`} which="notice" current={view.notice} settle={settle} />
      <ChatTextCard key={`rule:${view.rule}`} which="rule" current={view.rule} settle={settle} />
      <BanWordsCard words={view.banWords} settle={settle} />
      <MembersCard list="managers" members={view.managers} settle={settle} />
      <MembersCard list="blacklist" members={view.blacklist} settle={settle} />
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

function ChatTextCard({ which, current, settle }: { which: "notice" | "rule"; current: string; settle: Settle }) {
  const { t } = useI18n();
  const [text, setText] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = `chat-${which}`;
  const keys = TEXT_KEYS[which];
  const save = () => start(async () => setError(settle(await attempt(() => saveFlextvChatText(which, text)), t(text.trim() ? keys.saved : keys.removed))));
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {t(keys.title)}
      </h2>
      <p className={styles.help}>{t(keys.help)}</p>
      <textarea
        className={`${styles.input} ${settings.textarea}`}
        aria-labelledby={id}
        maxLength={CHAT_NOTICE_MAX}
        rows={4}
        value={text}
        placeholder={t("flextvChatSettings.textPlaceholder", { max: CHAT_NOTICE_MAX })}
        onChange={(e) => setText(e.target.value)}
      />
      <div className={styles.actions}>
        <span className={styles.hint}>{t("flextvChatSettings.textHint", { length: text.length, max: CHAT_NOTICE_MAX })}</span>
        <button type="button" className={styles.secondaryButton} disabled={pending || text.trim() === current.trim()} onClick={save}>
          {t("flextvChatSettings.save")}
        </button>
      </div>
      <Problem text={error} />
    </section>
  );
}

function BanWordsCard({ words, settle }: { words: FlextvChatSettingsView["banWords"]; settle: Settle }) {
  const { t } = useI18n();
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const add = () =>
    start(async () => {
      const problem = settle(await attempt(() => addFlextvBanWord(word)), t("flextvChatSettings.banWordAdded"));
      setError(problem);
      if (!problem) setWord("");
    });
  const remove = (id: string) => start(async () => setError(settle(await attempt(() => removeFlextvBanWord(id)), t("flextvChatSettings.banWordRemoved"))));
  return (
    <section className={styles.card} aria-labelledby="chat-words">
      <h2 id="chat-words" className={styles.cardTitle}>
        {t("flextvChatSettings.banWordsTitle")}
      </h2>
      <p className={styles.help}>{t("flextvChatSettings.banWordsHelp")}</p>
      {words.length === 0 ? (
        <p className={styles.empty}>{t("flextvChatSettings.banWordsEmpty")}</p>
      ) : (
        <ul className={local.words} aria-label={t("flextvChatSettings.banWordsAria")}>
          {words.map((w) => (
            <li key={w.id} className={local.word}>
              {w.word}
              <button type="button" className={local.wordRemove} aria-label={t("flextvChatSettings.banWordRemoveAria", { word: w.word })} disabled={pending} onClick={() => remove(w.id)}>
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
          aria-label={t("flextvChatSettings.banWordAddAria")}
          placeholder={t("flextvChatSettings.banWordPlaceholder", { max: BAN_WORD_MAX })}
          maxLength={BAN_WORD_MAX}
          value={word}
          onChange={(e) => {
            setWord(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className={styles.secondaryButton} disabled={pending || !word.trim()}>
          {t("flextvChatSettings.add")}
        </button>
      </form>
      <Problem text={error} />
    </section>
  );
}

function MembersCard({ list, members, settle }: { list: "managers" | "blacklist"; members: ChatMember[]; settle: Settle }) {
  const { t } = useI18n();
  const [loginId, setLoginId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = `chat-${list}`;
  const keys = LIST_KEYS[list];
  const add = () =>
    start(async () => {
      const problem = settle(await attempt(() => addFlextvChatMember(list, loginId)), t(keys.added));
      setError(problem);
      if (!problem) setLoginId("");
    });
  const remove = (m: ChatMember) => {
    if (!window.confirm(t(keys.removeConfirm, { nickname: m.nickname, loginId: m.loginId }))) return;
    start(async () => setError(settle(await attempt(() => removeFlextvChatMember(list, m.loginId)), t(keys.removed))));
  };
  return (
    <section className={styles.card} aria-labelledby={id}>
      <h2 id={id} className={styles.cardTitle}>
        {t(keys.title)} <span className={styles.hint}>{t("flextvChatSettings.memberCount", { count: members.length })}</span>
      </h2>
      <p className={styles.help}>{t(keys.help)}</p>
      {members.length === 0 ? (
        <p className={styles.empty}>{t(keys.empty)}</p>
      ) : (
        <ul className={local.members} aria-labelledby={id}>
          {members.map((m) => (
            <li key={m.loginId} className={local.member}>
              <span className={local.memberName}>
                <strong>{m.nickname}</strong>
                <span className={styles.hint}>
                  {m.loginId}
                  {m.since && ` · ${t("flextvChatSettings.memberSince", { date: day(m.since) })}`}
                </span>
              </span>
              <button type="button" className={styles.secondaryButton} disabled={pending} onClick={() => remove(m)}>
                {t("flextvChatSettings.remove")}
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
          aria-label={t(keys.addAria)}
          placeholder={t("flextvChatSettings.loginIdPlaceholder")}
          maxLength={40}
          autoComplete="off"
          value={loginId}
          onChange={(e) => {
            setLoginId(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className={styles.secondaryButton} disabled={pending || !loginId.trim()}>
          {t("flextvChatSettings.add")}
        </button>
      </form>
      <Problem text={error} />
    </section>
  );
}

const LINK_KIND: Record<YoutubeChatLink["kind"], MessageKey> = {
  channelId: "flextvChatSettings.kindChannelId",
  handle: "flextvChatSettings.kindHandle",
  videoId: "flextvChatSettings.kindVideoId"
};

function YoutubeCard({ link, settle }: { link: YoutubeChatLink | null; settle: Settle }) {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const save = () =>
    start(async () => {
      const problem = settle(await attempt(() => saveFlextvYoutubeLink(url)), t("flextvChatSettings.youtubeLinked"));
      setError(problem);
      if (!problem) setUrl("");
    });
  const unlink = () => {
    if (!window.confirm(t("flextvChatSettings.youtubeUnlinkConfirm"))) return;
    start(async () => setError(settle(await attempt(() => removeFlextvYoutubeLink()), t("flextvChatSettings.youtubeUnlinked"))));
  };
  const show = (on: boolean) =>
    start(async () => setError(settle(await attempt(() => showFlextvYoutubeChat(on)), t(on ? "flextvChatSettings.youtubeShown" : "flextvChatSettings.youtubeHidden"))));
  return (
    <section className={styles.card} aria-labelledby="chat-youtube">
      <h2 id="chat-youtube" className={styles.cardTitle}>
        {t("flextvChatSettings.youtubeTitle")}
      </h2>
      <p className={styles.help}>{t("flextvChatSettings.youtubeHelp")}</p>
      {link ? (
        <>
          <dl className={local.link}>
            <dt>{t("flextvChatSettings.youtubeLinkedLabel")}</dt>
            <dd>
              {link.raw} <span className={styles.hint}>({t(LINK_KIND[link.kind])})</span>
            </dd>
            {link.savedAt && (
              <>
                <dt>{t("flextvChatSettings.youtubeSavedAtLabel")}</dt>
                <dd>
                  {kstIsoString(link.savedAt).slice(0, 16).replace("T", " ")} <span className={styles.hint}>· {t("flextvChatSettings.youtubeMemory")}</span>
                </dd>
              </>
            )}
          </dl>
          <label className={local.toggle}>
            <input type="checkbox" checked={link.showInChat} disabled={pending} onChange={(e) => show(e.target.checked)} />
            {t("flextvChatSettings.youtubeShow")}
          </label>
          <div className={styles.actions}>
            <button type="button" className={styles.secondaryButton} disabled={pending} onClick={unlink}>
              {t("flextvChatSettings.disconnect")}
            </button>
          </div>
        </>
      ) : (
        <p className={styles.empty}>{t("flextvChatSettings.youtubeEmpty")}</p>
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
          aria-label={t("flextvChatSettings.youtubeUrlAria")}
          placeholder={t("flextvChatSettings.youtubeUrlPlaceholder")}
          inputMode="url"
          maxLength={300}
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError(null);
          }}
        />
        <button type="submit" className={styles.secondaryButton} disabled={pending || !url.trim()}>
          {t(link ? "flextvChatSettings.change" : "flextvChatSettings.connect")}
        </button>
      </form>
      <Problem text={error} />
    </section>
  );
}
