import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const MESHY_API_URL = "https://api.meshy.ai/openapi/v1/image-to-3d";
const MAX_GLB_SIZE = 25 * 1024 * 1024;

interface OwnedAsset {
  id: string;
  status: "pending" | "ready" | "failed";
}

interface MeshyTask {
  status?: string;
  model_urls?: { glb?: string };
  task_error?: { message?: string };
}

export async function POST(
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

  const apiKey = process.env.MESHY_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "MESHY_API_KEY가 설정되지 않았습니다." },
      { status: 503 }
    );
  }

  const { id: taskId } = await params;
  const assetResult = await db.query<OwnedAsset>(
    `SELECT "id", "status" FROM "asset"
     WHERE "meshyTaskId" = $1 AND "userId" = $2`,
    [taskId, session.user.id]
  );
  const asset = assetResult.rows[0];

  if (!asset) {
    return Response.json({ error: "작업을 찾을 수 없습니다." }, { status: 404 });
  }
  if (asset.status === "ready") {
    return Response.json({
      asset: {
        id: asset.id,
        modelUrl: `/api/assets/${asset.id}/model`,
      },
    });
  }

  try {
    const taskResponse = await fetch(
      `${MESHY_API_URL}/${encodeURIComponent(taskId)}`,
      {
        headers: { Authorization: `Bearer ${apiKey}` },
        cache: "no-store",
      }
    );
    const task = (await taskResponse.json().catch(() => null)) as MeshyTask | null;

    if (!taskResponse.ok) {
      return Response.json(
        { error: task?.task_error?.message || "Meshy 작업을 조회하지 못했습니다." },
        { status: taskResponse.status }
      );
    }
    if (task?.status !== "SUCCEEDED") {
      return Response.json(
        { error: "아직 저장할 수 있는 상태가 아닙니다." },
        { status: 409 }
      );
    }

    const glbUrl = task.model_urls?.glb;
    if (!glbUrl) {
      return Response.json(
        { error: "완료된 작업에 GLB 파일이 없습니다." },
        { status: 502 }
      );
    }

    const modelResponse = await fetch(glbUrl, { cache: "no-store" });
    if (!modelResponse.ok) {
      return Response.json(
        { error: "완료된 GLB 파일을 내려받지 못했습니다." },
        { status: 502 }
      );
    }

    const announcedSize = Number(modelResponse.headers.get("content-length") || 0);
    if (announcedSize > MAX_GLB_SIZE) {
      return Response.json(
        { error: "GLB 파일이 25MB보다 커서 저장할 수 없습니다." },
        { status: 413 }
      );
    }

    const model = Buffer.from(await modelResponse.arrayBuffer());
    if (model.byteLength > MAX_GLB_SIZE) {
      return Response.json(
        { error: "GLB 파일이 25MB보다 커서 저장할 수 없습니다." },
        { status: 413 }
      );
    }
    if (
      model.byteLength < 12 ||
      model[0] !== 0x67 ||
      model[1] !== 0x6c ||
      model[2] !== 0x54 ||
      model[3] !== 0x46
    ) {
      return Response.json(
        { error: "Meshy가 유효한 GLB 파일을 반환하지 않았습니다." },
        { status: 502 }
      );
    }

    await db.query(
      `UPDATE "asset"
       SET "status" = 'ready',
           "modelGlb" = $1,
           "modelSize" = $2,
           "errorMessage" = NULL,
           "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = $3 AND "userId" = $4`,
      [model, model.byteLength, asset.id, session.user.id]
    );

    return Response.json({
      asset: {
        id: asset.id,
        modelUrl: `/api/assets/${asset.id}/model`,
      },
    });
  } catch (error) {
    console.error("Meshy save asset error:", error);
    return Response.json(
      { error: "완성된 3D 에셋을 저장하지 못했습니다." },
      { status: 502 }
    );
  }
}
