import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

const SYSTEM = `당신은 추모 반려동물 챗봇의 장기 기억을 관리합니다. 기존 기억 노트와 새 대화 내용을 합쳐, 다음 대화에서 참고할 기억 노트를 한국어로 갱신하세요.

규칙:
- 보호자가 들려준 추억, 별명/호칭, 습관, 함께 갔던 장소, 좋아하던 것, 보호자의 감정 상태와 애도 진행 상황을 남깁니다.
- "- "로 시작하는 불릿 목록, 10줄 이내. 덜 중요한 항목은 버리고 병합합니다.
- 기억 노트 텍스트만 출력합니다. 다른 설명은 붙이지 않습니다.`;

export async function POST(req: Request) {
  try {
    const { name, memory, messages } = (await req.json()) as {
      name: string;
      memory?: string;
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!name || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "invalid request" }, { status: 400 });
    }

    const transcript = messages
      .map((m) => `${m.role === "user" ? "보호자" : name}: ${m.content}`)
      .join("\n");

    const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용

    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001", // 요약은 저비용 모델로 충분
      max_tokens: 500,
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: `기존 기억 노트:\n${memory?.trim() || "(없음)"}\n\n새 대화:\n${transcript}`,
        },
      ],
    });

    const updated = response.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    if (!updated) {
      return Response.json({ error: "empty summary" }, { status: 500 });
    }
    return Response.json({ memory: updated });
  } catch (error) {
    console.error("memory api error:", error);
    return Response.json({ error: "memory failed" }, { status: 500 });
  }
}
