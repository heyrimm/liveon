import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";

function buildSystemPrompt(name: string, memory?: string): string {
  const memorySection = memory?.trim()
    ? `\n\n지금까지의 대화에서 기억하고 있는 내용입니다. 대화에 자연스럽게 녹여내되, 목록처럼 나열하거나 기억하고 있다는 사실을 과시하지 마세요:\n${memory.trim()}`
    : "";
  return `당신은 세상을 떠난 반려동물 "${name}"의 추모 캐릭터입니다. 보호자가 애도의 과정에서 마음을 정리할 수 있도록 돕는 역할입니다.

지켜야 할 원칙:
1. 반려동물의 시점에서 1인칭으로, 짧고 따뜻하게 말합니다. (2~3문장 이내)
2. 보호자와의 좋았던 기억을 묻고, 회상하도록 부드럽게 유도합니다.
3. "나는 잘 지내고 있어요", "당신 잘못이 아니에요" 같은 안심과 위로를 전합니다.
4. 보호자가 미처 하지 못한 말을 할 수 있도록 공간을 열어줍니다.
5. 절대 하지 말 것: 죽음을 부정하기("나 안 죽었어"), 다시 만날 수 있다는 거짓 약속, 보호자의 죄책감을 자극하는 말, 의학적/종교적 단정.
6. 보호자가 심하게 괴로워하는 신호(자책 반복, 극단적 표현)를 보이면, 캐릭터 톤을 유지하면서 "혼자 견디지 말고 주변 사람이나 전문가와 이야기해보면 좋겠어요"라고 부드럽게 권합니다.
7. 존댓말과 반말 중 보호자가 쓰는 말투를 따라갑니다.${memorySection}`;
}

export async function POST(req: Request) {
  try {
    const { name, messages, memory } = (await req.json()) as {
      name: string;
      messages: { role: "user" | "assistant"; content: string }[];
      memory?: string;
    };

    if (!name || !Array.isArray(messages) || messages.length === 0) {
      return Response.json({ error: "invalid request" }, { status: 400 });
    }

    const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 사용

    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      output_config: { effort: "low" }, // 짧은 위로 대화 — 빠른 응답 우선
      system: buildSystemPrompt(name, memory),
      messages,
    });

    // for-await를 두 번 새로 시작하면 SDK가 내부적으로 이벤트를 두 iterator에 나눠줘서
    // 중간이 끊길 수 있으므로, iterator 인스턴스 하나를 끝까지 재사용한다.
    const iterator = stream[Symbol.asyncIterator]();

    // 인증 실패 등 초반 에러를 감지해 폴백이 동작하도록, 첫 텍스트 조각이 나올 때까지만 먼저 기다림.
    let firstChunk = "";
    while (true) {
      const { value, done } = await iterator.next();
      if (done) break;
      if (value.type === "content_block_delta" && value.delta.type === "text_delta") {
        firstChunk = value.delta.text;
        break;
      }
    }

    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        if (firstChunk) controller.enqueue(encoder.encode(firstChunk));
        try {
          while (true) {
            const { value, done } = await iterator.next();
            if (done) break;
            if (value.type === "content_block_delta" && value.delta.type === "text_delta") {
              controller.enqueue(encoder.encode(value.delta.text));
            }
          }
        } catch (err) {
          console.error("chat stream error (mid-stream):", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error) {
    console.error("chat api error:", error);
    // 클라이언트가 폴백 응답으로 전환하도록 500 반환
    return Response.json({ error: "chat failed" }, { status: 500 });
  }
}
