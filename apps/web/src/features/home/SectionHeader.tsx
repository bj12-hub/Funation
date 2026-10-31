import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightSmallIcon } from "@/components/icons";
import styles from "./home.module.css";

type SectionHeaderProps = {
  id: string;
  title: string;
  /** "전체보기" destination and its label (the page passes it in the viewer's language). */
  viewAllHref?: string;
  viewAllLabel?: string;
  aside?: ReactNode;
};

export function SectionHeader({ id, title, viewAllHref, viewAllLabel = "전체보기", aside }: SectionHeaderProps) {
  return (
    <div className={styles.sectionHeader}>
      <h2 id={id} className={styles.sectionTitle}>
        {title}
      </h2>
      {aside && <p className={styles.sectionAside}>{aside}</p>}
      {viewAllHref && (
        <Link href={viewAllHref} className={styles.viewAll}>
          {viewAllLabel}
          <ChevronRightSmallIcon />
        </Link>
      )}
    </div>
  );
}
