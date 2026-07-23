"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import styles from "./AccountActions.module.css";

export default function AccountActions({ email }: { email: string }) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut() {
    setIsSigningOut(true);
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className={styles.account}>
      <span title={email}>{email}</span>
      <Link href="/assets">내 에셋</Link>
      <button onClick={signOut} disabled={isSigningOut}>
        {isSigningOut ? "…" : "로그아웃"}
      </button>
    </div>
  );
}
