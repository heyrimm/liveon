import type { Metadata } from "next";
import PetPlayground, { PlayAssetOption } from "@/components/PetPlayground";
import { db } from "@/lib/db";
import { requireCurrentSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "우리 아이와 놀기 — LiveOn",
  description: "내가 만든 3D 아이와 함께 간식을 모아보세요.",
};

interface AssetRow {
  id: string;
  name: string;
}

export default async function PlayPage({
  searchParams,
}: {
  searchParams: Promise<{ asset?: string | string[] }>;
}) {
  const session = await requireCurrentSession("/play");
  const params = await searchParams;
  const result = await db.query<AssetRow>(
    `SELECT "id", "name"
     FROM "asset"
     WHERE "userId" = $1 AND "status" = 'ready'
     ORDER BY "createdAt" DESC`,
    [session.user.id]
  );
  const assets: PlayAssetOption[] = result.rows;
  const requestedAssetId = typeof params.asset === "string" ? params.asset : "";
  const initialAssetId = assets.some((asset) => asset.id === requestedAssetId)
    ? requestedAssetId
    : assets[0]?.id;

  return (
    <PetPlayground
      assets={assets}
      initialAssetId={initialAssetId}
      userId={session.user.id}
    />
  );
}
