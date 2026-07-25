"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import GeneratedAssetCanvas from "./GeneratedAssetCanvas";
import styles from "./AssetLibrary.module.css";

export interface AssetSummary {
  id: string;
  meshyTaskId: string;
  name: string;
  status: "pending" | "ready" | "failed";
  modelSize: number | null;
  createdAt: string;
}

export default function AssetLibrary({ assets }: { assets: AssetSummary[] }) {
  const router = useRouter();
  const firstReady = assets.find((asset) => asset.status === "ready");
  const [selectedId, setSelectedId] = useState(firstReady?.id || "");
  const [checkingId, setCheckingId] = useState("");
  const [error, setError] = useState("");
  const selected = assets.find((asset) => asset.id === selectedId);

  async function retrySave(asset: AssetSummary) {
    setCheckingId(asset.id);
    setError("");

    try {
      const response = await fetch(
        `/api/meshy/${encodeURIComponent(asset.meshyTaskId)}/save`,
        { method: "POST" }
      );
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || "저장 상태를 확인하지 못했습니다.");
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "저장 상태를 확인하지 못했습니다."
      );
    } finally {
      setCheckingId("");
    }
  }

  return (
    <div className={styles.layout}>
      <section className={styles.viewer}>
        <div className={styles.viewerTop}>
          <span>{selected ? selected.name : "내 3D 에셋"}</span>
          {selected && <span className={styles.readyBadge}>저장됨</span>}
        </div>
        <div className={styles.canvas}>
          <GeneratedAssetCanvas
            modelUrl={selected ? `/api/assets/${selected.id}/model` : "/models/pets.glb"}
          />
        </div>
        <div className={styles.viewerBottom}>
          <p>
            {selected
              ? "Railway PostgreSQL에 저장된 내 GLB 에셋입니다."
              : "완성된 에셋을 선택하면 여기에서 확인할 수 있어요."}
          </p>
          {selected && (
            <a href={`/api/assets/${selected.id}/model`} download={`${selected.name}.glb`}>
              GLB 받기
            </a>
          )}
        </div>
      </section>

      <aside className={styles.sidebar}>
        <div className={styles.sidebarHeader}>
          <div>
            <p>MY LIBRARY</p>
            <h1>내 3D 에셋</h1>
          </div>
          <Link href="/meshy">새로 만들기</Link>
        </div>

        {error && <p className={styles.error}>{error}</p>}

        {assets.length === 0 ? (
          <div className={styles.empty}>
            <strong>아직 저장된 에셋이 없어요.</strong>
            <p>사진 한 장으로 첫 3D 에셋을 만들어보세요.</p>
            <Link href="/meshy">3D 에셋 만들기</Link>
          </div>
        ) : (
          <ul className={styles.list}>
            {assets.map((asset) => (
              <li key={asset.id}>
                {asset.status === "ready" ? (
                  <button
                    className={selectedId === asset.id ? styles.selected : ""}
                    onClick={() => setSelectedId(asset.id)}
                  >
                    <span className={styles.assetIcon}>3D</span>
                    <span className={styles.assetCopy}>
                      <strong>{asset.name}</strong>
                      <small>
                        {new Date(asset.createdAt).toLocaleDateString("ko-KR")}
                        {asset.modelSize
                          ? ` · ${(asset.modelSize / 1024 / 1024).toFixed(1)}MB`
                          : ""}
                      </small>
                    </span>
                    <span className={styles.chevron}>›</span>
                  </button>
                ) : (
                  <div className={styles.pending}>
                    <span className={styles.assetIcon}>…</span>
                    <span className={styles.assetCopy}>
                      <strong>{asset.name}</strong>
                      <small>생성 또는 저장 확인이 필요해요</small>
                    </span>
                    <button
                      onClick={() => retrySave(asset)}
                      disabled={checkingId === asset.id}
                    >
                      {checkingId === asset.id ? "확인 중" : "확인"}
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  );
}
