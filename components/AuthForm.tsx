"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./AuthForm.module.css";

interface AuthFormProps {
  mode: "login" | "signup";
  nextPath: string;
}

export default function AuthForm({ mode, nextPath }: AuthFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === "signup";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isSignup && !name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const result = isSignup
        ? await authClient.signUp.email({
            name: name.trim(),
            email: email.trim(),
            password,
          })
        : await authClient.signIn.email({
            email: email.trim(),
            password,
          });

      if (result.error) {
        setError(result.error.message || "인증에 실패했습니다.");
        return;
      }

      router.push(nextPath);
      router.refresh();
    } catch {
      setError("서버에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <Link href="/" className={styles.logo}>
          LiveOn
        </Link>
        <p className={styles.eyebrow}>{isSignup ? "처음 오셨군요" : "다시 만나요"}</p>
        <h1>{isSignup ? "회원가입" : "로그인"}</h1>
        <p className={styles.description}>
          {isSignup
            ? "계정을 만들면 생성한 3D 에셋을 안전하게 보관할 수 있어요."
            : "내 3D 에셋과 작업을 이어서 확인하세요."}
        </p>

        <form onSubmit={submit} className={styles.form}>
          {isSignup && (
            <label>
              이름
              <input
                name="name"
                autoComplete="name"
                minLength={1}
                maxLength={80}
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="이름"
              />
            </label>
          )}

          <label>
            이메일
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            비밀번호
            <input
              name="password"
              type="password"
              autoComplete={isSignup ? "new-password" : "current-password"}
              minLength={8}
              maxLength={128}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8자 이상"
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? "처리 중…"
              : isSignup
                ? "계정 만들기"
                : "로그인"}
          </button>
        </form>

        <p className={styles.switch}>
          {isSignup ? "이미 계정이 있나요?" : "아직 계정이 없나요?"}{" "}
          <Link href={`${isSignup ? "/login" : "/signup"}?next=${encodeURIComponent(nextPath)}`}>
            {isSignup ? "로그인" : "회원가입"}
          </Link>
        </p>
      </section>
    </main>
  );
}
