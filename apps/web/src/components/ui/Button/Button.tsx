import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

/**
 * Shared buttons.
 * - primary : purple → indigo gradient (로그인, 다음 단계)          Figma 13:46
 * - accent  : purple → pink gradient   (회원가입 완료)               Figma 722:908
 * - cta     : indigo gradient, inline  (인증번호 발송, 중복 확인)    Figma 722:581
 * - pink    : solid pink               (재설정 링크 보내기)          Figma 718:664
 * - secondary: dark surface            (로그인으로 돌아가기)          Figma 718:661
 * - light   : white, black text      (바로 시청하기, 지금 참여하기)  Figma 727:2758 · 727:2982
 * - surface : dark surface, bordered (보관함에 저장)                 Figma 727:2763
 * Size `lg` (28px side padding, 16px text): home hero and promo banner.
 * Disabled state: Figma 722:593
 */
type Variant = "primary" | "accent" | "cta" | "pink" | "secondary" | "light" | "surface";
type Size = "md" | "lg";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type LinkButtonProps = CommonProps & { href: string };

export function Button(props: ButtonProps | LinkButtonProps) {
  if (props.href !== undefined) {
    const { variant = "primary", size = "md", block = false, className, children, href } = props;
    return (
      <Link href={href} className={classNames(variant, size, block, className)}>
        {children}
      </Link>
    );
  }

  const { variant = "primary", size = "md", block = false, className, children, type = "button", ...rest } = props;
  return (
    <button type={type} className={classNames(variant, size, block, className)} {...rest}>
      {children}
    </button>
  );
}

function classNames(variant: Variant, size: Size, block: boolean, className?: string) {
  return [styles.button, styles[variant], size === "lg" ? styles.lg : "", block ? styles.block : "", className ?? ""].join(" ");
}
