export const runtime = "nodejs";

const MESHY_API_URL = "https://api.meshy.ai/openapi/v1/image-to-3d";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "MESHY_API_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const { id } = await params;
  if (!id) {
    return Response.json({ error: "작업 ID가 필요합니다." }, { status: 400 });
  }

  try {
    const response = await fetch(`${MESHY_API_URL}/${encodeURIComponent(id)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        data && typeof data === "object" && "message" in data
          ? String(data.message)
          : "Meshy 작업을 조회하지 못했습니다.";
      return Response.json({ error: message }, { status: response.status });
    }

    return Response.json(data);
  } catch (error) {
    console.error("Meshy get task error:", error);
    return Response.json(
      { error: "Meshy 서버에 연결하지 못했습니다." },
      { status: 502 }
    );
  }
}
