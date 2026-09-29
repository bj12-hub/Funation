"use client";

import Image from "next/image";
import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { CopyButton } from "./SettingsCards";
import styles from "./setupGuides.module.css";

type GuideStep = {
  title: string;
  /** Plain lines under the title. */
  lines?: string[];
  /** Grey card of "Step ①" lines (simulcast 328:1558). */
  card?: string[];
  download?: { label: string; href: string };
  showUrl?: boolean;
  images?: { src: string; alt: string; width: number; height: number }[];
};

type Guide = { key: string; tile: string; title: string; steps: GuideStep[]; warning?: { title: string; lines: string[] } };

/**
 * Figma 328:581 (OBS) · 328:927 (Xsplit) · 328:1266 (2가지 플랫폼 동시송출) — broadcast setup guides.
 * Download targets are the vendors' official pages (the design leaves them unspecified).
 * The simulcast badges read ❺–❽ in the design (leftover numbering); they are shown as 1–4.
 */
const GUIDES: Guide[] = [
  {
    key: "obs",
    tile: "OBS 세팅",
    title: "OBS 세팅 안내",
    steps: [
      { title: "OBS 설치", lines: ["OBS를 다운받아 설치 합니다."], download: { label: "[OBS Studio 다운로드]", href: "https://obsproject.com/download" } },
      {
        title: "위젯 제목 설정",
        lines: ["Step ① OBS 실행 후 [+] 버튼 클릭 > [브라우저] 카테고리 선택", "Step ② '새로 만들기'란에 위젯 제목 설정 > [확인] 버튼 클릭"],
        images: [
          { src: "/mock/creator/guides/obs-1.png", alt: "OBS 소스 추가 메뉴에서 브라우저 선택", width: 1184, height: 876 },
          { src: "/mock/creator/guides/obs-2.png", alt: "새로 만들기 창에서 위젯 제목 입력 후 확인", width: 1184, height: 876 }
        ]
      },
      {
        title: "통합알림창 URL 등록",
        lines: ["아래 회원님의 통합 알림창 URL을 복사하여 붙여 넣기 > [확인] 버튼 클릭"],
        showUrl: true,
        images: [{ src: "/mock/creator/guides/obs-3.png", alt: "브라우저 소스 속성의 URL 입력란", width: 1184, height: 876 }]
      },
      {
        title: "위젯 셋팅",
        lines: ["생성된 통합알림창 위젯의 크기와 위치를 셋팅"],
        images: [{ src: "/mock/creator/guides/obs-4.png", alt: "OBS 화면에서 위젯 크기와 위치 조정", width: 1184, height: 876 }]
      }
    ]
  },
  {
    key: "xsplit",
    tile: "Xsplit 세팅",
    title: "Xsplit 세팅 안내",
    steps: [
      {
        title: "Xsplit 설치",
        lines: ["Xsplit를 다운받아 설치 합니다."],
        download: { label: "[Xsplit Broadcaster 다운로드]", href: "https://www.xsplit.com/broadcaster" }
      },
      {
        title: "통합 알림창 위젯 URL 등록",
        lines: ["Step ① Xsplit 실행 후 [소스추가] 버튼 클릭 > [웹 페이지] 클릭", "Step ② 아래 회원님의 통합 알림창 URL을 복사하여 붙여 넣기 > [OK] 버튼 클릭"],
        showUrl: true,
        images: [
          { src: "/mock/creator/guides/xsplit-1.png", alt: "Xsplit 소스 추가 메뉴에서 웹 페이지 선택", width: 1048, height: 876 },
          { src: "/mock/creator/guides/xsplit-2.png", alt: "Xsplit URL 입력 창", width: 1048, height: 876 }
        ]
      },
      {
        title: "위젯 셋팅",
        lines: ["생성된 통합알림창 위젯의 크기와 위치를 셋팅"],
        images: [{ src: "/mock/creator/guides/xsplit-3.png", alt: "Xsplit 화면에서 위젯 크기와 위치 조정", width: 911, height: 738 }]
      }
    ]
  },
  {
    key: "simulcast",
    tile: "2가지 플랫폼 동시 송출 OBS 세팅",
    title: "2가지 플랫폼 동시송출 OBS 세팅",
    steps: [
      {
        title: "동시송출 기능 설정",
        lines: ["두 가지 이상의 방송을 동시에 송출하기 위해 OBS에 동시송출 기능을 설정합니다."],
        card: ["Step ① OBS 실행 후 [동시송출 설정] 메뉴 선택", "Step ② [방송 추가] 버튼 클릭", "Step ③ 첫번째 플랫폼과 두번째 플랫폼의 방송 정보를 각각 등록"]
      },
      {
        title: "동시송출 1 플랫폼 방송 정보 등록",
        lines: ["첫번째 플랫폼의 방송 설정에서 서버 주소와 스트림 키를 확인합니다."],
        card: ["Step ① OBS 동시송출 설정에서 [방송 추가] 클릭", "Step ② 첫번째 플랫폼의 서버 주소와 스트림 키 입력", "Step ③ [저장] 버튼 클릭"]
      },
      {
        title: "동시송출 2 플랫폼 방송 정보 등록",
        lines: ["두번째 플랫폼의 방송 설정에서 서버 주소와 스트림 키를 확인합니다."],
        card: ["Step ① OBS 동시송출 설정에서 [방송 추가] 클릭", "Step ② 두번째 플랫폼의 서버 주소와 스트림 키 입력", "Step ③ [저장] 버튼 클릭"]
      },
      {
        title: "동시송출 시작",
        lines: ["첫번째 플랫폼과 두번째 플랫폼의 방송 정보가 모두 등록되었다면 두 플랫폼으로 동시에 방송을 시작할 수 있습니다."],
        card: ["Step ① 첫번째 플랫폼과 두번째 플랫폼 등록 상태 확인", "Step ② [동시송출 시작] 버튼 클릭", "Step ③ 각 플랫폼에서 방송이 정상적으로 송출되는지 확인"]
      }
    ],
    warning: {
      title: "※ 동시송출 안내",
      lines: [
        "※ 각 플랫폼의 서버 주소 및 스트림 키는 각 플랫폼의 방송 설정에서 확인해 주세요.",
        "※ 스트림 키는 외부에 노출되지 않도록 주의해 주세요.",
        "※ 동시송출 시 인터넷 환경 및 PC 성능에 따라 방송 품질이 달라질 수 있습니다."
      ]
    }
  }
];

/** Tiles on 315:528 that open the guides. */
export function SetupGuides({ channelName, widgetUrl }: { channelName: string; widgetUrl: string }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const guide = GUIDES.find((g) => g.key === openKey) ?? null;

  return (
    <>
      <ul className={styles.tiles}>
        {GUIDES.map((g) => (
          <li key={g.key}>
            <button type="button" className={styles.tile} aria-haspopup="dialog" onClick={() => setOpenKey(g.key)}>
              {g.tile}
            </button>
          </li>
        ))}
      </ul>
      <Modal open={guide !== null} onClose={() => setOpenKey(null)} title={guide?.title ?? "세팅 안내"} width={680} className={styles.dialog}>
        {guide && (
          <div className={styles.body}>
            {guide.steps.map((s, i) => (
              <section key={s.title} className={styles.step} aria-labelledby={`guide-${guide.key}-${i}`}>
                <h3 id={`guide-${guide.key}-${i}`} className={styles.stepTitle}>
                  <span className={styles.badge} aria-hidden="true">
                    {i + 1}
                  </span>
                  {s.title}
                </h3>
                {s.lines?.map((l) => (
                  <p key={l} className={styles.text}>
                    {l}
                  </p>
                ))}
                {s.card && (
                  <ul className={styles.card}>
                    {s.card.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                )}
                {s.download && (
                  <div className={styles.download}>
                    <a href={s.download.href} target="_blank" rel="noopener noreferrer" className={styles.downloadButton}>
                      {s.download.label}
                    </a>
                  </div>
                )}
                {s.showUrl && (
                  <div className={styles.urlBox}>
                    <span className={styles.urlLabel}>&apos;{channelName}&apos; 님의 통합 알림창 URL</span>
                    <div className={styles.urlRow}>
                      <span className={styles.urlField}>{widgetUrl}</span>
                      <CopyButton value={widgetUrl} label="URL 복사" className={styles.copyButton} />
                      <a href={widgetUrl} target="_blank" rel="noopener noreferrer" className={styles.openButton}>
                        열기
                      </a>
                    </div>
                  </div>
                )}
                {s.images && (
                  <div className={s.images.length > 1 ? styles.imagesTwo : styles.images}>
                    {s.images.map((img) => (
                      <Image key={img.src} src={img.src} alt={img.alt} width={img.width} height={img.height} className={styles.image} />
                    ))}
                  </div>
                )}
              </section>
            ))}
            {guide.warning && (
              <div className={styles.warning}>
                <strong>{guide.warning.title}</strong>
                {guide.warning.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            )}
            <button type="button" className={styles.close} onClick={() => setOpenKey(null)}>
              닫기
            </button>
          </div>
        )}
      </Modal>
    </>
  );
}
