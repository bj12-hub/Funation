import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightSmallIcon } from "@/components/icons";
import styles from "./home.module.css";

type SectionHeaderProps = {
  id: string;
  title: string;
  /** "전체보기" destination. */
  viewAllHref?: string;
  aside?: ReactNode;
};

export function SectionHeader({ id, title, viewAllHref, aside }: SectionHeaderProps) {
  return (
    <div className={styles.sectionHeader}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {aside && <p className={styles.sectionAside}>{aside}</p>}
      {viewAllHref && (
        <Link href={viewAllHref} className={styles.viewAll}>
          전체보기
          <ChevronRightSmallIcon />
        </Link>
      )}
    </div>
  );
}
