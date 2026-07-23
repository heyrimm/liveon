export const runtime = "nodejs";

const MESHY_API_URL = "https://api.meshy.ai/openapi/v1/image-to-3d";
const MAX_DATA_URI_LENGTH = 4_000_000;

interface CreateRequest {
  imageDataUrl: string;
}

function meshyHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function readMeshyResponse(response: Response) {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : "Meshy 요청에 실패했습니다.";
    return Response.json({ error: message }, { status: response.status });
  }

  return Response.json(data);
}

export async function GET() {
  return Response.json({ configured: Boolean(process.env.MESHY_API_KEY) });
}

export async function POST(request: Request) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "MESHY_API_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  let input: CreateRequest;
  try {
    input = (await request.json()) as CreateRequest;
  } catch {
    return Response.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const imageDataUrl = input.imageDataUrl?.trim();
  if (!imageDataUrl) {
    return Response.json(
      { error: "JPG 또는 PNG 이미지가 필요합니다." },
      { status: 400 }
    );
  }
  if (imageDataUrl.length > MAX_DATA_URI_LENGTH) {
    return Response.json(
      { error: "이미지가 너무 큽니다. 더 작은 이미지를 선택해주세요." },
      { status: 413 }
    );
  }
  if (!/^data:image\/(?:jpeg|png);base64,[a-z0-9+/=\s]+$/i.test(imageDataUrl)) {
    return Response.json(
      { error: "JPG 또는 PNG 이미지가 필요합니다." },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(MESHY_API_URL, {
      method: "POST",
      headers: meshyHeaders(apiKey),
      body: JSON.stringify({
        image_url: imageDataUrl,
        model_type: "standard",
        ai_model: "meshy-6",
        should_texture: true,
        enable_pbr: true,
        should_remesh: true,
        topology: "triangle",
        target_polycount: 30000,
        remove_lighting: true,
        image_enhancement: true,
        target_formats: ["glb"],
        moderation: true,
      }),
      cache: "no-store",
    });

    return readMeshyResponse(response);
  } catch (error) {
    console.error("Meshy create task error:", error);
    return Response.json(
      { error: "Meshy 서버에 연결하지 못했습니다." },
      { status: 502 }
    );
  }
}
