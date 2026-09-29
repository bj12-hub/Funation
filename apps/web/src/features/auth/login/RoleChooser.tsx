"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CloseIcon, HeartLineIcon, VideoCameraIcon } from "@/components/icons";
import { Modal } from "@/components/ui/Modal";
import styles from "./RoleChooser.module.css";

const ROLES = [
  { key: "creator", tag: "LIVE", question: "방송을 하고싶다면?", name: "크리에이터", Icon: VideoCameraIcon, tone: styles.creator },
  { key: "donator", tag: "DONATE", question: "후원을 하고싶다면?", name: "도네이터", Icon: HeartLineIcon, tone: styles.donator }
] as const;

/**
 * Figma 280:2 로그인/회원가입 — the header "로그인" button opens a role chooser.
 * Both roles continue to the login page for now: creator sign-in/sign-up and the creator area are not
 * designed yet, so the role is only passed along as `?role=` (TBD).
 */
export function RoleChooser({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname() ?? "/";
  const next = pathname.startsWith("/login") || pathname.startsWith("/signup") ? null : pathname;
  const href = (role: string) => {
    const params = new URLSearchParams({ role });
    if (next && next !== "/") params.set("next", next);
    return `/login?${params.toString()}`;
  };

  return (
    <>
      <button type="button" className={className} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        로그인
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="로그인/회원가입"
        width={560}
        className={styles.dialog}
        customHeader={
          <header className={styles.header}>
            <div>
              <h2>로그인/회원가입</h2>
              <p>3초 만에 시작해보세요!</p>
            </div>
            <button type="button" className={styles.close} aria-label="닫기" onClick={() => setOpen(false)}>
              <CloseIcon />
            </button>
          </header>
        }
      >
        <ul className={styles.cards}>
          {ROLES.map(({ key, tag, question, name, Icon, tone }) => (
            <li key={key}>
              <Link href={href(key)} className={styles.card} onClick={() => setOpen(false)}>
                <span className={styles.icon} aria-hidden="true">
                  <Icon />
                </span>
                <span className={styles.labels}>
                  <span className={`${styles.tag} ${tone}`}>{tag}</span>
                  <span className={styles.question}>{question}</span>
                  <strong className={styles.name}>{name}</strong>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
