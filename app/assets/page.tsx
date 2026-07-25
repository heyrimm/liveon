import type { Metadata } from "next";
import AssetLibrary, { AssetSummary } from "@/components/AssetLibrary";
import { db } from "@/lib/db";
import { requireCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 3D 에셋 — LiveOn",
  description: "내가 만든 LiveOn 3D 에셋을 확인합니다.",
};

interface AssetRow {
  id: string;
  meshyTaskId: string;
  name: string;
  status: "pending" | "ready" | "failed";
  modelSize: number | null;
  createdAt: Date;
}

export default async function AssetsPage() {
  const session = await requireCurrentSession("/assets");
  const result = await db.query<AssetRow>(
    `SELECT "id", "meshyTaskId", "name", "status", "modelSize", "createdAt"
     FROM "asset"
     WHERE "userId" = $1
     ORDER BY "createdAt" DESC`,
    [session.user.id]
  );
  const assets: AssetSummary[] = result.rows.map((asset) => ({
    ...asset,
    createdAt: asset.createdAt.toISOString(),
  }));

  return <AssetLibrary assets={assets} />;
}
