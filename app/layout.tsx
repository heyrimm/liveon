import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LiveOn — 잘 보내주기 위한 시간",
  description: "떠난 반려동물을 닮은 추모 친구를 만들고, 미처 못한 인사를 나눠보세요.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
