// 참고 이미지를 fal.ai의 Pixal3D 모델로 3D 에셋(GLB)으로 변환해 public/models/에 저장하는 1회성 스크립트.
// 사용법: npm run gen3d -- <이미지 경로 또는 URL> <출력 파일명(확장자 제외)>
//   예)  npm run gen3d -- ./ref/my-dog.png dog-realistic
import { fal } from "@fal-ai/client";
import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const [, , imageArg, outNameArg] = process.argv;

if (!imageArg || !outNameArg) {
  console.error("사용법: npm run gen3d -- <이미지 경로 또는 URL> <출력 파일명(확장자 제외)>");
  process.exit(1);
}

if (!process.env.FAL_KEY) {
  console.error("FAL_KEY 환경변수가 없습니다. .env.local에 FAL_KEY=... 를 추가하세요.");
  process.exit(1);
}

async function resolveImageUrl(imageArg) {
  if (/^https?:\/\//.test(imageArg)) return imageArg;

  const filePath = path.resolve(imageArg);
  if (!existsSync(filePath)) {
    console.error(`이미지 파일을 찾을 수 없습니다: ${filePath}`);
    process.exit(1);
  }
  const buffer = await readFile(filePath);
  const file = new File([buffer], path.basename(filePath));
  console.log("이미지 업로드 중...");
  return fal.storage.upload(file);
}

const imageUrl = await resolveImageUrl(imageArg);

console.log("Pixal3D로 3D 모델 생성 중... (몇 분 걸릴 수 있습니다)");
const result = await fal.subscribe("fal-ai/pixal3d", {
  input: { image_url: imageUrl },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.forEach((log) => console.log(log.message));
    }
  },
});

const glbUrl = result.data.model_glb.url;
console.log("생성 완료:", glbUrl);

const glbRes = await fetch(glbUrl);
const glbBuffer = Buffer.from(await glbRes.arrayBuffer());

const outPath = path.resolve("public/models", `${outNameArg}.glb`);
await writeFile(outPath, glbBuffer);
console.log("저장됨:", outPath);
