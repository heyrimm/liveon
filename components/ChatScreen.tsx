"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore, nameWithParticle } from "@/lib/store";
import { ChatMessage, loadChatLog, saveChatLog, clearChatLog } from "@/lib/memory";
import { pickFallbackReply } from "@/lib/fallback";
import SceneCanvas from "./SceneCanvas";

/** 직전 폴백과 바로 겹치지 않도록 기억해두는 개수 */
const FALLBACK_MEMORY = 2;
/** API에 보내는 최근 메시지 수 — 그 이전 내용은 기억 노트(memory)가 대신함 */
const HISTORY_WINDOW = 12;
/** 요약 안 된 메시지가 이만큼 쌓이면 백그라운드 요약 실행 */
const SUMMARIZE_THRESHOLD = 16;
/** 요약할 때 최근 몇 개는 원문 그대로 남겨둠 */
const KEEP_RECENT = 6;
/** 마지막 대화 후 이 시간이 지나 돌아오면 재회 인사 추가 */
const RETURN_GREETING_MS = 60 * 60 * 1000;

export default function ChatScreen() {
  const name = useAppStore((s) => s.name);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const set = useAppStore((s) => s.set);
  // 프로필 id로 대화를 구분 저장 — 다른 아이가 같은 이름이어도 기억이 섞이지 않도록
  const memKey = activeProfileId ?? name;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [restored, setRestored] = useState(false);
  const recentFallbacks = useRef<string[]>([]);
  const listRef = useRef<HTMLDivElement>(null);
  const reactTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 장기 기억 노트 + 어디까지 요약했는지. 렌더에 안 쓰이므로 ref로 관리
  const memRef = useRef({ memory: "", summarizedUpTo: 0 });
  const summarizing = useRef(false);

  // 저장된 대화가 있으면 복원, 없으면 첫 인사
  useEffect(() => {
    const saved = loadChatLog(memKey);
    if (saved && saved.messages.length > 0) {
      memRef.current = { memory: saved.memory, summarizedUpTo: saved.summarizedUpTo };
      const msgs = [...saved.messages];
      const last = msgs[msgs.length - 1];
      if (Date.now() - saved.updatedAt > RETURN_GREETING_MS && last.role === "assistant") {
        msgs.push({ role: "assistant", content: "다시 와줬네요. 기다리고 있었어요." });
      }
      setMessages(msgs);
    } else {
      setMessages([{ role: "assistant", content: `${nameWithParticle(name)}. 보고 싶었어요.` }]);
    }
    setRestored(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 메시지가 바뀔 때마다 저장 (복원 완료 전에는 저장하지 않음)
  useEffect(() => {
    if (!restored || messages.length === 0) return;
    saveChatLog(memKey, { messages, ...memRef.current });
  }, [messages, restored, memKey]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, waiting]);

  const startReacting = () => {
    set({ reacting: true });
    if (reactTimer.current) clearTimeout(reactTimer.current);
  };
  const stopReactingSoon = () => {
    if (reactTimer.current) clearTimeout(reactTimer.current);
    reactTimer.current = setTimeout(() => set({ reacting: false }), 2500);
  };

  // 오래된 대화를 기억 노트로 압축 (백그라운드, 실패해도 무시)
  const maybeSummarize = async (all: ChatMessage[]) => {
    const { memory, summarizedUpTo } = memRef.current;
    if (summarizing.current || all.length - summarizedUpTo < SUMMARIZE_THRESHOLD) return;
    summarizing.current = true;
    const cut = all.length - KEEP_RECENT;
    try {
      const res = await fetch("/api/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, memory, messages: all.slice(summarizedUpTo, cut) }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.memory) {
        memRef.current = { memory: data.memory, summarizedUpTo: cut };
        saveChatLog(memKey, { messages: all, ...memRef.current });
      }
    } catch {
      // 다음 기회에 재시도됨
    } finally {
      summarizing.current = false;
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || waiting) return;
    setInput("");
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setWaiting(true);
    startReacting();

    let reply = "";
    let placeholderAdded = false;
    const replacePlaceholder = (content: string) =>
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content };
        return copy;
      });

    try {
      // 최근 HISTORY_WINDOW개만 전달하고, 그 이전은 기억 노트로 대체.
      // API 규칙상 히스토리는 user 메시지로 시작해야 함
      let history = next.slice(Math.max(0, next.length - HISTORY_WINDOW));
      const firstUser = history.findIndex((m) => m.role === "user");
      history = history.slice(firstUser);
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          messages: history,
          memory: memRef.current.memory || undefined,
        }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;
        reply += chunk;
        if (!placeholderAdded) {
          placeholderAdded = true;
          setWaiting(false);
          setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        } else {
          replacePlaceholder(reply);
        }
      }

      reply = reply.trim();
      if (!reply) throw new Error("empty reply");
      if (placeholderAdded) replacePlaceholder(reply);
    } catch {
      reply = pickFallbackReply(text, recentFallbacks.current);
      recentFallbacks.current = [reply, ...recentFallbacks.current].slice(0, FALLBACK_MEMORY);
      if (placeholderAdded) replacePlaceholder(reply);
      else setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    }

    setWaiting(false);
    stopReactingSoon();
    const withReply: ChatMessage[] = [...next, { role: "assistant", content: reply }];
    void maybeSummarize(withReply);
  };

  const resetConversation = () => {
    if (!window.confirm("지금까지의 대화와 기억을 모두 지울까요?")) return;
    clearChatLog(memKey);
    memRef.current = { memory: "", summarizedUpTo: 0 };
    recentFallbacks.current = [];
    setMessages([{ role: "assistant", content: `${nameWithParticle(name)}. 보고 싶었어요.` }]);
  };

  return (
    <main className="chat-screen">
      <div className="chat-canvas">
        <SceneCanvas />
        <div className="chat-header">
          <button className="btn-back" onClick={() => set({ screen: "customize", reacting: false })}>
            ← 다시 꾸미기
          </button>
          <span className="chat-petname">{name}</span>
          <button className="btn-back" onClick={resetConversation}>
            대화 지우기
          </button>
        </div>
      </div>

      <div className="chat-panel">
        <div className="chat-messages" ref={listRef}>
          {messages.map((m, i) => (
            <div key={i} className={`bubble-row ${m.role === "user" ? "row-user" : "row-pet"}`}>
              <div className={`bubble ${m.role === "user" ? "bubble-user" : "bubble-pet"}`}>
                {m.content}
              </div>
            </div>
          ))}
          {waiting && (
            <div className="bubble-row row-pet">
              <div className="bubble bubble-pet bubble-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}
        </div>

        <div className="chat-inputbar">
          <input
            className="chat-input"
            placeholder={`${name}에게 하고 싶은 말을 적어주세요`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) send();
            }}
          />
          <button className="btn-primary btn-send" onClick={send} disabled={waiting || !input.trim()}>
            보내기
          </button>
        </div>
      </div>
    </main>
  );
}
