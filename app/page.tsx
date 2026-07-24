"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import StartScreen from "@/components/StartScreen";
import CustomizeScreen from "@/components/CustomizeScreen";
import ChatScreen from "@/components/ChatScreen";

export default function Home() {
  const screen = useAppStore((s) => s.screen);
  const [hydrated, setHydrated] = useState(false);

  // localStorage의 저장 상태(꾸미기 결과, 화면 위치)를 마운트 후 복원
  useEffect(() => {
    void Promise.resolve(useAppStore.persist.rehydrate()).then(() => {
      const shouldCustomize =
        new URLSearchParams(window.location.search).get("start") === "customize";

      if (shouldCustomize) {
        useAppStore.getState().startNewProfile();
        window.history.replaceState({}, "", "/");
      }

      setHydrated(true);
    });
  }, []);

  if (!hydrated) return null;
  if (screen === "customize") return <CustomizeScreen />;
  if (screen === "chat") return <ChatScreen />;
  return <StartScreen />;
}
