"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import AccountActions from "./AccountActions";
import GeneratedAssetCanvas from "./GeneratedAssetCanvas";
import styles from "./MeshyAssetStudio.module.css";

const FALLBACK_MODEL_URL = "/models/pets.glb";
const MAX_SOURCE_FILE_SIZE = 20 * 1024 * 1024;
const MAX_DATA_URI_LENGTH = 4_000_000;
const RESIZE_LONG_EDGE = 1600;

interface ActiveTask {
  id: string;
  progress: number;
}

interface MeshyTask {
  status: string;
  progress?: number;
  task_error?: { message?: string };
}

interface MeshyAssetStudioProps {
  userEmail: string;
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => ({}))) as T & { error?: string };
  if (!response.ok) {
    throw new Error(data.error || "요청에 실패했습니다.");
  }
  return data;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function prepareImage(file: File): Promise<string> {
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    throw new Error("JPG 또는 PNG 이미지만 사용할 수 있어요.");
  }
  if (file.size > MAX_SOURCE_FILE_SIZE) {
    throw new Error("원본 이미지는 20MB 이하여야 해요.");
  }

  const original = await readFileAsDataUrl(file);
  if (original.length <= MAX_DATA_URI_LENGTH) return original;

  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, RESIZE_LONG_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
  canvas.height = Math.max(1, Math.round(bitmap.height * ratio));

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("이미지를 변환하지 못했습니다.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const resized = canvas.toDataURL("image/jpeg", 0.88);
  if (resized.length > MAX_DATA_URI_LENGTH) {
    throw new Error("이미지를 줄이지 못했습니다. 더 작은 파일을 선택해주세요.");
  }
  return resized;
}

export default function MeshyAssetStudio({ userEmail }: MeshyAssetStudioProps) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [imageName, setImageName] = useState("");
  const [activeTask, setActiveTask] = useState<ActiveTask | null>(null);
  const [modelUrl, setModelUrl] = useState(FALLBACK_MODEL_URL);
  const [error, setError] = useState("");
  const [isGenerated, setIsGenerated] = useState(false);
  const [isPreparingImage, setIsPreparingImage] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    fetch("/api/meshy", { cache: "no-store" })
      .then((response) => readJson<{ configured: boolean }>(response))
      .then((data) => setConfigured(data.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    if (!activeTask) return;

    const taskToPoll = activeTask;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      try {
        const response = await fetch(`/api/meshy/${encodeURIComponent(taskToPoll.id)}`, {
          cache: "no-store",
        });
        const task = await readJson<MeshyTask>(response);
        if (cancelled) return;

        const progress = Math.max(0, Math.min(100, task.progress ?? 0));
        setActiveTask((current) =>
          current?.id === taskToPoll.id ? { ...current, progress } : current
        );

        if (task.status === "SUCCEEDED") {
          setActiveTask((current) =>
            current?.id === taskToPoll.id ? { ...current, progress: 100 } : current
          );
          const saveResponse = await fetch(
            `/api/meshy/${encodeURIComponent(taskToPoll.id)}/save`,
            { method: "POST" }
          );
          const saved = await readJson<{
            asset: { id: string; modelUrl: string };
          }>(saveResponse);

          setModelUrl(saved.asset.modelUrl);
          setIsGenerated(true);
          setActiveTask(null);
          return;
        }

        if (task.status === "FAILED" || task.status === "CANCELED") {
          throw new Error(task.task_error?.message || `Meshy 작업이 ${task.status} 상태입니다.`);
        }

        timer = setTimeout(poll, 5000);
      } catch (pollError) {
        if (!cancelled) {
          setError(pollError instanceof Error ? pollError.message : "생성에 실패했습니다.");
          setActiveTask(null);
        }
      }
    }

    poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeTask?.id]);

  async function selectImage(file?: File) {
    if (!file || activeTask) return;

    setError("");
    setIsPreparingImage(true);
    try {
      const prepared = await prepareImage(file);
      setImageDataUrl(prepared);
      setImageName(file.name);
      setIsGenerated(false);
      setModelUrl(FALLBACK_MODEL_URL);
    } catch (imageError) {
      setError(imageError instanceof Error ? imageError.message : "이미지를 준비하지 못했습니다.");
    } finally {
      setIsPreparingImage(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    void selectImage(event.target.files?.[0]);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    void selectImage(event.dataTransfer.files?.[0]);
  }

  async function startGeneration() {
    if (!imageDataUrl || activeTask) return;

    setError("");
    setIsGenerated(false);

    try {
      const response = await fetch("/api/meshy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl, sourceName: imageName }),
      });
      const data = await readJson<{ result: string }>(response);
      setActiveTask({ id: data.result, progress: 0 });
    } catch (generationError) {
      setError(
        generationError instanceof Error ? generationError.message : "생성을 시작하지 못했습니다."
      );
    }
  }

  const statusLabel = activeTask
    ? "사진을 3D 모델로 만들고 있어요"
    : isGenerated
      ? "Meshy 에셋 생성 완료"
      : "기본 LiveOn 모델 미리보기";

  return (
    <main className={styles.page}>
      <section className={styles.viewer}>
        <header className={styles.viewerHeader}>
          <Link href="/" className={styles.backLink}>
            ← LiveOn
          </Link>
          <span className={`${styles.badge} ${isGenerated ? styles.badgeReady : ""}`}>
            {isGenerated ? "MESHY GLB" : "DEMO GLB"}
          </span>
        </header>

        <div className={styles.canvas}>
          <GeneratedAssetCanvas modelUrl={modelUrl} />
        </div>

        <div className={styles.viewerFooter}>
          <div>
            <p className={styles.status}>{statusLabel}</p>
            <p className={styles.hint}>드래그해서 회전하고, 휠로 확대할 수 있어요.</p>
          </div>
          {isGenerated && (
            <a className={styles.download} href={modelUrl} target="_blank" rel="noreferrer">
              GLB 받기 ↗
            </a>
          )}
        </div>
      </section>

      <aside className={styles.panel}>
        <AccountActions email={userEmail} />
        <p className={styles.eyebrow}>MESHY AI · IMAGE TO 3D</p>
        <h1>
          사진 속 아이를
          <br />
          3D로 만들어봐요.
        </h1>
        <p className={styles.description}>
          아이가 선명하게 나온 사진 한 장을 올려주세요. Meshy 6가 형태와 색, 재질을
          분석해 회전 가능한 3D 모델로 만들어요.
        </p>

        <div className={styles.label}>
          <span>참고 이미지</span>
          <span>JPG · PNG</span>
        </div>
        <label
          htmlFor="meshy-image"
          className={`${styles.dropzone} ${isDragging ? styles.dropzoneDragging : ""} ${
            imageDataUrl ? styles.dropzoneSelected : ""
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            id="meshy-image"
            className={styles.fileInput}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            disabled={Boolean(activeTask) || isPreparingImage}
            onChange={handleFileChange}
          />
          {imageDataUrl ? (
            <>
              <img className={styles.imagePreview} src={imageDataUrl} alt="선택한 참고 이미지" />
              <span className={styles.replaceImage}>다른 사진 선택</span>
            </>
          ) : (
            <span className={styles.uploadCopy}>
              <strong>{isPreparingImage ? "사진 준비 중…" : "사진을 선택하거나 여기로 끌어오세요"}</strong>
              <small>한 마리가 전신으로 선명하게 나온 사진이 좋아요</small>
            </span>
          )}
        </label>
        {imageName && <p className={styles.fileName}>{imageName}</p>}

        <div className={styles.keyStatus}>
          <span
            className={`${styles.statusDot} ${
              configured ? styles.statusDotReady : styles.statusDotMissing
            }`}
          />
          {configured === null
            ? "API 연결 확인 중"
            : configured
              ? "Meshy API 연결 준비됨"
              : ".env.local에 MESHY_API_KEY가 필요해요"}
        </div>

        {activeTask && (
          <div className={styles.progressCard}>
            <div className={styles.progressCopy}>
              <span>{statusLabel}</span>
              <strong>{activeTask.progress}%</strong>
            </div>
            <div className={styles.progressTrack}>
              <span style={{ width: `${activeTask.progress}%` }} />
            </div>
            <p>보통 몇 분 정도 걸려요. 완료되면 왼쪽 뷰어에 자동으로 표시됩니다.</p>
          </div>
        )}

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.generateButton}
          disabled={!configured || !imageDataUrl || Boolean(activeTask) || isPreparingImage}
          onClick={startGeneration}
        >
          {activeTask ? "3D 에셋 생성 중…" : "이 사진으로 3D 에셋 만들기"}
        </button>

        {!configured && configured !== null && (
          <p className={styles.setup}>
            프로젝트 루트의 <code>.env.local</code>에 키를 저장하고 개발 서버를 다시 시작해주세요.
          </p>
        )}
      </aside>
    </main>
  );
}
