"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store";

export default function StartScreen() {
  const s = useAppStore();
  const hasProfiles = s.profiles.length > 0;

  return (
    <main className="start-screen">
      <div className="start-inner">
        <p className="start-eyebrow">반려동물 추모 · 펫로스 회복</p>
        <h1 className="start-logo">LiveOn</h1>
        <p className="start-tagline">잘 보내주기 위한 시간</p>

        {!hasProfiles && (
          <>
            <p className="start-desc">
              떠난 아이를 닮은 작은 친구를 만들고,
              <br />
              미처 하지 못했던 인사를 천천히 나눠보세요.
            </p>
            <Link href="/login?next=%2Fmeshy" className="btn-primary start-primary-link">
              우리 아이 만나러 가기
            </Link>
          </>
        )}

        {hasProfiles && (
          <>
            <p className="start-desc">다시 만나고 싶은 아이를 선택해주세요.</p>
            <ul className="profile-list">
              {s.profiles.map((p) => (
                <li key={p.id} className="profile-card">
                  <button className="profile-card-main" onClick={() => s.loadProfile(p.id, "chat")}>
                    <span className="profile-emoji">{p.species === "dog" ? "🐶" : "🐱"}</span>
                    <span className="profile-name">{p.name}</span>
                  </button>
                  <button
                    className="profile-card-edit"
                    title="다시 꾸미기"
                    onClick={() => s.loadProfile(p.id, "customize")}
                  >
                    ✎
                  </button>
                  <button
                    className="profile-card-delete"
                    title="삭제"
                    onClick={() => {
                      if (window.confirm(`${p.name}(을)를 목록에서 지울까요? 나눈 대화는 남아있어요.`)) {
                        s.deleteProfile(p.id);
                      }
                    }}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button className="btn-primary" onClick={() => s.startNewProfile()}>
              새로운 아이 만들기
            </button>
          </>
        )}

        <Link href="/meshy" className="start-meshy-link">
          사진으로 3D 에셋 만들기 →
        </Link>
        <Link href="/login" className="start-account-link">
          로그인 · 회원가입
        </Link>
      </div>
    </main>
  );
}
