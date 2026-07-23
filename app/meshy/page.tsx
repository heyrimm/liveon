import type { Metadata } from "next";
import MeshyAssetStudio from "@/components/MeshyAssetStudio";

export const metadata: Metadata = {
  title: "Meshy 3D Studio — LiveOn",
  description: "사진으로 LiveOn 3D 에셋을 만들고 바로 확인합니다.",
};

export default function MeshyPage() {
  return <MeshyAssetStudio />;
}
