import type { Metadata } from "next";
import MeshyAssetStudio from "@/components/MeshyAssetStudio";
import { db } from "@/lib/db";
import { requireCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meshy 3D Studio — LiveOn",
  description: "사진으로 LiveOn 3D 에셋을 만들고 바로 확인합니다.",
};

interface AssetRow {
  id: string;
  name: string;
  createdAt: Date;
}

export default async function MeshyPage() {
  const session = await requireCurrentSession("/meshy");
  const result = await db.query<AssetRow>(
    `SELECT "id", "name", "createdAt"
     FROM "asset"
     WHERE "userId" = $1 AND "status" = 'ready'
     ORDER BY "createdAt" DESC`,
    [session.user.id]
  );

  return (
    <MeshyAssetStudio
      userEmail={session.user.email}
      initialAssets={result.rows.map((asset) => ({
        ...asset,
        createdAt: asset.createdAt.toISOString(),
      }))}
    />
  );
}
