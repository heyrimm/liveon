import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

interface StoredModel {
  id: string;
  modelGlb: Buffer;
  modelSize: number;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!process.env.DATABASE_URL) {
    return Response.json(
      { error: "DATABASE_URL이 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { id } = await params;
  const result = await db.query<StoredModel>(
    `SELECT "id", "modelGlb", "modelSize" FROM "asset"
     WHERE "id" = $1 AND "userId" = $2 AND "status" = 'ready'`,
    [id, session.user.id]
  );
  const asset = result.rows[0];

  if (!asset?.modelGlb) {
    return Response.json({ error: "에셋을 찾을 수 없습니다." }, { status: 404 });
  }

  return new Response(new Uint8Array(asset.modelGlb), {
    headers: {
      "Content-Type": "model/gltf-binary",
      "Content-Length": String(asset.modelSize),
      "Content-Disposition": `inline; filename="${asset.id}.glb"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
