export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** 프로필별(profile id, 없으면 이름)로 localStorage에 저장되는 대화 기록 + 장기 기억 */
export interface ChatLog {
  messages: ChatMessage[];
  /** Haiku가 요약한 기억 노트 — 매 대화 요청의 시스템 프롬프트에 주입됨 */
  memory: string;
  /** messages 중 이 인덱스 앞까지는 memory에 요약 반영이 끝난 상태 */
  summarizedUpTo: number;
  updatedAt: number;
}

const storageKey = (key: string) => `liveon-chat:${key.trim()}`;

export function loadChatLog(key: string): ChatLog | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChatLog;
    if (!Array.isArray(parsed.messages)) return null;
    return {
      messages: parsed.messages,
      memory: typeof parsed.memory === "string" ? parsed.memory : "",
      summarizedUpTo: typeof parsed.summarizedUpTo === "number" ? parsed.summarizedUpTo : 0,
      updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0,
    };
  } catch {
    return null;
  }
}

export function saveChatLog(key: string, log: Omit<ChatLog, "updatedAt">) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(key), JSON.stringify({ ...log, updatedAt: Date.now() }));
  } catch {
    // 저장 실패(용량 초과 등)는 무시 — 대화 자체는 계속 가능
  }
}

export function clearChatLog(key: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(key));
  } catch {
    // ignore
  }
}
