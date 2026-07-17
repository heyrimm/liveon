"use client";

import { useMemo, useRef, useLayoutEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { useAppStore, SIZE_SCALE } from "@/lib/store";

const MODEL_PATH = "/models/pets.glb";
const TARGET_HEIGHT = 1.75;
const MODEL_BOUNDS = {
  dog: {
    min: new THREE.Vector3(-0.8530221640219516, 0, -0.6656611000013463),
    max: new THREE.Vector3(-0.007127603423543261, 1.0060299005544164, 0.6531833007043554),
  },
  cat: {
    min: new THREE.Vector3(0.09109424387452948, 0, -0.585412682722408),
    max: new THREE.Vector3(0.7712515467870632, 0.971669858830662, 0.6774217296455832),
  },
};
const STYLE_POSITIONS = {
  dog: {
    faceDot: [-0.24, 0.61, 0.56] as [number, number, number],
    backPatch: [-0.43, 0.45, -0.08] as [number, number, number],
    harness: [-0.43, 0.42, 0.42] as [number, number, number],
    ribbon: [-0.43, 0.86, 0.42] as [number, number, number],
    sockScale: 1,
    socks: [
      [-0.579, 0.075, 0.34],
      [-0.281, 0.075, 0.34],
      [-0.579, 0.075, -0.18],
      [-0.281, 0.075, -0.18],
    ] as [number, number, number][],
  },
  cat: {
    faceDot: [0.59, 0.58, 0.55] as [number, number, number],
    backPatch: [0.43, 0.45, -0.07] as [number, number, number],
    harness: [0.43, 0.42, 0.42] as [number, number, number],
    ribbon: [0.43, 0.86, 0.43] as [number, number, number],
    sockScale: 0.9,
    socks: [
      [0.298, 0.07, 0.29],
      [0.564, 0.07, 0.29],
      [0.299, 0.07, -0.17],
      [0.563, 0.07, -0.15],
    ] as [number, number, number][],
  },
};

// 3D 얼굴 부품 위치 (groupRef 로컬 = STYLE_POSITIONS와 같은 fitted 공간).
// 몸 색과 무관하게 항상 보이도록 텍스처가 아닌 3D 메시로 얹는다.
type Vec3 = [number, number, number];
const FACE: Record<
  "dog" | "cat",
  {
    eyeL: Vec3; eyeR: Vec3; eyeSize: number;
    muzzle: Vec3; muzzleScale: Vec3;
    nose: Vec3; noseSize: number;
    mouth: Vec3; mouthR: number;
  }
> = {
  dog: {
    eyeL: [-0.50, 0.71, 0.60], eyeR: [-0.36, 0.71, 0.60], eyeSize: 0.052,
    muzzle: [-0.43, 0.52, 0.64], muzzleScale: [0.17, 0.12, 0.13],
    nose: [-0.43, 0.56, 0.73], noseSize: 0.05,
    mouth: [-0.43, 0.47, 0.70], mouthR: 0.05,
  },
  cat: {
    eyeL: [0.37, 0.67, 0.58], eyeR: [0.49, 0.67, 0.58], eyeSize: 0.046,
    muzzle: [0.43, 0.49, 0.60], muzzleScale: [0.13, 0.09, 0.10],
    nose: [0.43, 0.52, 0.67], noseSize: 0.038,
    mouth: [0.43, 0.45, 0.65], mouthR: 0.04,
  },
};

const EYE_DARK = "#2C2622";
const NOSE_DARK = "#33291F";

// 강아지 눈: PNG 데칼 한 장을 얼굴 정면에 붙임 (좌우 눈 한 쌍이 한 이미지)
const DOG_EYES = {
  eye1: "/models/dog eye1.png",
  eye2: "/models/dog eye2 sharp.png",
  eye3: "/models/eye3.png",
};
const DOG_EYE_DECAL = {
  center: [-0.43, 0.685, 0.62] as Vec3, // 두 눈 중앙
  size: 0.42, // 정사각형 한 변 (크기 조정 포인트)
};
const DOG_BLUSH = {
  left: [-0.56, 0.615, 0.655] as Vec3,
  right: [-0.3, 0.615, 0.655] as Vec3,
  scale: [0.055, 0.032, 1] as Vec3,
};

/**
 * pets.glb: 한 파일에 강아지+고양이 스킨드 메시 (머티리얼 CartoonAnimal_Dog_M / Cat_M).
 * 내장 애니메이션이 없으므로 본(Dog_Tail_045 등)을 코드로 직접 움직인다.
 * SkinnedMesh runtime bounds can be unstable, so the selected mesh is fitted
 * from the known source bounds of this GLB.
 */

function FaceFeatures({ species, muzzleColor }: { species: "dog" | "cat"; muzzleColor: string }) {
  const f = FACE[species];
  return (
    <group>
      {/* 주둥이 원 (색 선택 가능) */}
      <mesh position={f.muzzle} scale={f.muzzleScale}>
        <sphereGeometry args={[1, 20, 16]} />
        <meshStandardMaterial color={muzzleColor} roughness={0.85} />
      </mesh>
      {/* 눈 (항상 보이도록 어두운 눈 + 흰 하이라이트) */}
      {[f.eyeL, f.eyeR].map((p, i) => (
        <group key={i} position={p}>
          <mesh scale={[1, 1.15, 0.6]}>
            <sphereGeometry args={[f.eyeSize, 16, 14]} />
            <meshStandardMaterial color={EYE_DARK} roughness={0.4} />
          </mesh>
          <mesh position={[f.eyeSize * 0.35, f.eyeSize * 0.4, f.eyeSize * 0.5]}>
            <sphereGeometry args={[f.eyeSize * 0.32, 8, 8]} />
            <meshStandardMaterial color="#ffffff" roughness={0.3} />
          </mesh>
        </group>
      ))}
      {/* 코 */}
      <mesh position={f.nose} scale={[1.2, 0.9, 0.8]}>
        <sphereGeometry args={[f.noseSize, 16, 12]} />
        <meshStandardMaterial color={NOSE_DARK} roughness={0.35} />
      </mesh>
      {/* 입 (아래로 이어지는 스마일) */}
      <mesh position={f.mouth} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[f.mouthR, f.mouthR * 0.22, 8, 20, Math.PI]} />
        <meshStandardMaterial color={NOSE_DARK} roughness={0.4} />
      </mesh>
    </group>
  );
}

interface SpeciesBones {
  spine?: THREE.Object3D;
  head?: THREE.Object3D;
  tail?: THREE.Object3D;
  leftEar?: THREE.Object3D;
  rightEar?: THREE.Object3D;
}

function saveBase(o?: THREE.Object3D) {
  if (o) o.userData.baseRotation = o.rotation.clone();
  return o;
}

function isLightColor(hex: string): boolean {
  const c = new THREE.Color(hex);
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.45;
}

function Mat({ color }: { color: string }) {
  return <meshStandardMaterial color={color} roughness={0.85} />;
}

function prepareEyeTexture(texture: THREE.Texture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
}

function createBlushTexture() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const gradient = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  gradient.addColorStop(0, "rgba(242, 142, 150, 0.42)");
  gradient.addColorStop(0.45, "rgba(242, 162, 168, 0.24)");
  gradient.addColorStop(1, "rgba(242, 162, 168, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/* ---------- 부위별 색 + 2D 무늬 (vertex color 페인팅) ----------
 * 무늬/부위색은 3D 메시를 얹지 않고 정점 색으로 몸 표면에 직접 칠한다.
 * - 부위(귀/발/꼬리) 판정: 정점의 스킨 웨이트가 어느 뼈에 붙었는지로 계산.
 *   웨이트가 경계에서 섞이므로 색 경계가 털처럼 부드럽게 번진다.
 * - 무늬(점/등 얼룩): 튜닝된 STYLE_POSITIONS를 바인드 좌표(×100, x는 중심 보정)로
 *   변환해 soft falloff 구 영역을 칠한다.
 * 최종 색 = 원본 그라데이션 텍스처 × 정점 색.
 */

type PartKey = "body" | "ear" | "paw" | "tail";
const PART_KEYS: PartKey[] = ["body", "ear", "paw", "tail"];

interface PartData {
  count: number;
  weights: Record<PartKey, Float32Array>;
  faceMask: Float32Array;
  backMask: Float32Array;
}

function classifyBone(name: string): PartKey {
  if (name.includes("Ear")) return "ear";
  if (name.includes("Tail")) return "tail";
  if (name.includes("Hand") || name.includes("Foot") || name.includes("Toe")) return "paw";
  return "body";
}

/** 중심=1 → 반경에서 0으로 부드럽게 (soft edge) */
function softMask(dist: number, radius: number): number {
  const inner = radius * 0.5;
  if (dist <= inner) return 1;
  if (dist >= radius) return 0;
  const x = (dist - inner) / (radius - inner);
  return 1 - x * x * (3 - 2 * x);
}

/**
 * 원본 텍스처의 색(갈색 등)을 버리고 명암 디테일(눈/코/음영)만 남긴다.
 * 밝기를 끌어올려 몸 영역을 거의 흰색으로 만들면, 그 위에 곱해지는
 * 정점 색이 선택한 색 그대로 나온다 (흰색 선택 → 진짜 하얀 강아지).
 */
function neutralizeTexture(mat: THREE.MeshStandardMaterial) {
  const src = mat.map;
  if (!src || !src.image) return;
  const img = src.image as ImageBitmap;
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = data.data;

  // 눈·코·입은 거의 검정(t가 매우 낮음)이고, 귀 안쪽/얼룩 같은 원래 마킹은
  // 중간톤(회색)이다. 임계값을 낮춰 "거의 검정"만 특징으로 남기고,
  // 나머지 중간톤은 몸통 흰 바탕으로 밀어올려 회색 얼룩을 없앤다.
  // 눈과 귀 안쪽이 같은 밝기라 임계값으로는 분리 불가.
  // → 몸/귀/발/꼬리가 깨끗한 0.3으로 두고(코·입은 여기서 잘 보임),
  //   눈은 3D 점으로 따로 얹는다.
  const DARK = 0.3;
  for (let i = 0; i < d.length; i += 4) {
    const t = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    const shade = t < DARK ? (t / DARK) * 0.42 : 1;
    const v = Math.min(255, shade * 255);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(data, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.flipY = src.flipY;
  tex.wrapS = src.wrapS;
  tex.wrapT = src.wrapT;
  tex.colorSpace = src.colorSpace;
  tex.needsUpdate = true;
  mat.map = tex;
  mat.needsUpdate = true;
}

/** 튜닝된 fitted 좌표(STYLE_POSITIONS) → 지오메트리 바인드 좌표 */
function toBindSpace(sp: "dog" | "cat", p: [number, number, number]): THREE.Vector3 {
  const b = MODEL_BOUNDS[sp];
  const cx = (b.min.x + b.max.x) / 2;
  return new THREE.Vector3((p[0] - cx) * 100, p[1] * 100, p[2] * 100);
}

function buildPartData(
  mesh: THREE.SkinnedMesh,
  faceCenter: THREE.Vector3,
  faceR: number,
  backCenter: THREE.Vector3,
  backR: number
): PartData {
  const geo = mesh.geometry;
  const pos = geo.getAttribute("position") as THREE.BufferAttribute;
  const sIdx = geo.getAttribute("skinIndex") as THREE.BufferAttribute;
  const sWt = geo.getAttribute("skinWeight") as THREE.BufferAttribute;
  const n = pos.count;
  const bonePart = mesh.skeleton.bones.map((b) => classifyBone(b.name));

  const weights: Record<PartKey, Float32Array> = {
    body: new Float32Array(n),
    ear: new Float32Array(n),
    paw: new Float32Array(n),
    tail: new Float32Array(n),
  };
  const idxAt = (i: number, k: number) =>
    k === 0 ? sIdx.getX(i) : k === 1 ? sIdx.getY(i) : k === 2 ? sIdx.getZ(i) : sIdx.getW(i);
  const wtAt = (i: number, k: number) =>
    k === 0 ? sWt.getX(i) : k === 1 ? sWt.getY(i) : k === 2 ? sWt.getZ(i) : sWt.getW(i);

  const faceMask = new Float32Array(n);
  const backMask = new Float32Array(n);
  const v = new THREE.Vector3();

  for (let i = 0; i < n; i++) {
    for (let k = 0; k < 4; k++) {
      const w = wtAt(i, k);
      if (w > 0) weights[bonePart[idxAt(i, k)]][i] += w;
    }
    v.fromBufferAttribute(pos, i);
    faceMask[i] = softMask(v.distanceTo(faceCenter), faceR);
    backMask[i] = softMask(v.distanceTo(backCenter), backR);
  }

  return { count: n, weights, faceMask, backMask };
}

interface PartColors {
  body: string;
  ear: string;
  paw: string;
  tail: string;
  pattern: string;
}

function applyPartColors(
  mesh: THREE.SkinnedMesh,
  data: PartData,
  colors: PartColors,
  pattern: string
) {
  const geo = mesh.geometry;
  let attr = geo.getAttribute("color") as THREE.BufferAttribute | undefined;
  if (!attr) {
    attr = new THREE.BufferAttribute(new Float32Array(data.count * 3), 3);
    geo.setAttribute("color", attr);
  }

  const c: Record<PartKey, THREE.Color> = {
    body: new THREE.Color(colors.body),
    ear: new THREE.Color(colors.ear),
    paw: new THREE.Color(colors.paw),
    tail: new THREE.Color(colors.tail),
  };
  const cPat = new THREE.Color(colors.pattern);
  const mask =
    pattern === "faceDot" ? data.faceMask : pattern === "backPatch" ? data.backMask : null;

  for (let i = 0; i < data.count; i++) {
    let r = 0, g = 0, b = 0, sum = 0;
    for (const k of PART_KEYS) {
      const w = data.weights[k][i];
      if (w > 0) {
        r += c[k].r * w;
        g += c[k].g * w;
        b += c[k].b * w;
        sum += w;
      }
    }
    if (sum > 0) {
      r /= sum; g /= sum; b /= sum;
    } else {
      r = c.body.r; g = c.body.g; b = c.body.b;
    }
    if (mask) {
      // 몸 부위에만 (귀/꼬리로 번지지 않게), soft edge 유지
      const m = mask[i] * Math.min(1, data.weights.body[i] * 1.2) * 0.92;
      if (m > 0) {
        r += (cPat.r - r) * m;
        g += (cPat.g - g) * m;
        b += (cPat.b - b) * m;
      }
    }
    attr.setXYZ(i, r, g, b);
  }
  attr.needsUpdate = true;
}

export default function PetModelGLB() {
  const species = useAppStore((s) => s.species);
  const bodyColor = useAppStore((s) => s.bodyColor);
  const earColor = useAppStore((s) => s.earColor);
  const pawColor = useAppStore((s) => s.pawColor);
  const tailColor = useAppStore((s) => s.tailColor);
  const muzzleColor = useAppStore((s) => s.muzzleColor);
  const petSize = useAppStore((s) => s.petSize);
  const eyeStyle = useAppStore((s) => s.eyeStyle);
  const pattern = useAppStore((s) => s.pattern);
  const earShape = useAppStore((s) => s.earShape);
  const accessory = useAppStore((s) => s.accessory);
  const reacting = useAppStore((s) => s.reacting);

  const { scene } = useGLTF(MODEL_PATH);
  const dogEye1 = useTexture(DOG_EYES.eye1);
  const dogEye2 = useTexture(DOG_EYES.eye2);
  const dogEye3 = useTexture(DOG_EYES.eye3);
  const dogEyes = eyeStyle === "eye1" ? dogEye1 : eyeStyle === "eye2" ? dogEye2 : dogEye3;
  prepareEyeTexture(dogEye1);
  prepareEyeTexture(dogEye2);
  prepareEyeTexture(dogEye3);
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  const blushTexture = useMemo(() => createBlushTexture(), []);
  const groupRef = useRef<THREE.Group>(null);
  const bobRef = useRef<THREE.Group>(null);

  const parts = useMemo(() => {
    let catMesh: THREE.Mesh | undefined;
    let dogMesh: THREE.Mesh | undefined;

    // 이름 대신 머티리얼로 메시 식별 (로더 네이밍 차이에 안전)
    clone.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const matName = (m.material as THREE.Material)?.name ?? "";
      if (matName.includes("Cat")) catMesh = m;
      else if (matName.includes("Dog")) dogMesh = m;
      else m.visible = false; // 받침대 등 기타 메시 숨김
    });

    for (const mesh of [catMesh, dogMesh]) {
      if (!mesh) continue;
      const mat = (mesh.material as THREE.MeshStandardMaterial).clone();
      mat.vertexColors = true; // 부위별 색은 정점 색으로 제어
      mat.color.set("#ffffff");
      neutralizeTexture(mat); // 몸통만 흰 바탕으로, 원래 눈·코·입은 유지
      mat.needsUpdate = true;
      mesh.material = mat;
      mesh.frustumCulled = false;
    }

    // 부위 가중치 + 무늬 마스크 사전 계산 (메시당 1회)
    const dogData = (dogMesh as THREE.SkinnedMesh)?.isSkinnedMesh
      ? buildPartData(
          dogMesh as THREE.SkinnedMesh,
          toBindSpace("dog", STYLE_POSITIONS.dog.faceDot), 6.5,
          toBindSpace("dog", STYLE_POSITIONS.dog.backPatch), 15
        )
      : undefined;
    const catData = (catMesh as THREE.SkinnedMesh)?.isSkinnedMesh
      ? buildPartData(
          catMesh as THREE.SkinnedMesh,
          toBindSpace("cat", STYLE_POSITIONS.cat.faceDot), 6,
          toBindSpace("cat", STYLE_POSITIONS.cat.backPatch), 14
        )
      : undefined;

    const bones: Record<"dog" | "cat", SpeciesBones> = {
      dog: {
        spine: saveBase(clone.getObjectByName("Dog_Spine_030")),
        head: saveBase(clone.getObjectByName("Dog_Head_054")),
        tail: saveBase(clone.getObjectByName("Dog_Tail_045")),
        rightEar: saveBase(clone.getObjectByName("Dog_RightEar_056")),
        leftEar: saveBase(clone.getObjectByName("Dog_LeftEar_058")),
      },
      cat: {
        spine: saveBase(clone.getObjectByName("Cat_Spine_02")),
        head: saveBase(clone.getObjectByName("Cat_Head_05")),
        tail: saveBase(clone.getObjectByName("Cat_Tail_021")),
        rightEar: saveBase(clone.getObjectByName("Cat_RightEar_07")),
        leftEar: saveBase(clone.getObjectByName("Cat_LeftEar_08")),
      },
    };

    return { catMesh, dogMesh, catData, dogData, bones };
  }, [clone]);

  // 종 선택: 한 마리만 표시 + GLB 원본 바운드 기준으로 센터링/스케일 정규화
  useLayoutEffect(() => {
    const show = species === "dog" ? parts.dogMesh : parts.catMesh;
    const hide = species === "dog" ? parts.catMesh : parts.dogMesh;
    const group = groupRef.current;
    if (!show || !group) return;

    show.visible = true;
    if (hide) hide.visible = false;

    group.position.set(0, 0, 0);
    group.scale.setScalar(1);
    group.updateWorldMatrix(true, true);

    const box = MODEL_BOUNDS[species];

    const height = box.max.y - box.min.y;
    // 강아지는 소형견/중형견/대형견 크기 반영
    const sizeMul = species === "dog" ? SIZE_SCALE[petSize] : 1;
    const s = (TARGET_HEIGHT / height) * sizeMul;
    const cx = (box.min.x + box.max.x) / 2;
    const cz = (box.min.z + box.max.z) / 2;
    group.scale.setScalar(s);
    group.position.set(-cx * s, -box.min.y * s, -cz * s);
  }, [species, petSize, parts]);

  // 부위별 색(몸/귀/발/꼬리) + 무늬 → 정점 색으로 몸 표면에 칠하기
  useLayoutEffect(() => {
    const colors: PartColors = {
      body: bodyColor,
      ear: earColor ?? bodyColor,
      paw: pawColor ?? bodyColor,
      tail: tailColor ?? bodyColor,
      pattern: isLightColor(bodyColor) ? "#7A4E33" : "#F3E9D8",
    };
    if (parts.dogMesh && parts.dogData)
      applyPartColors(parts.dogMesh as THREE.SkinnedMesh, parts.dogData, colors, pattern);
    if (parts.catMesh && parts.catData)
      applyPartColors(parts.catMesh as THREE.SkinnedMesh, parts.catData, colors, pattern);
  }, [bodyColor, earColor, pawColor, tailColor, pattern, parts]);

  useLayoutEffect(() => {
    const b = parts.bones[species];
    for (const ear of [b.leftEar, b.rightEar]) {
      const base = ear?.userData.baseRotation as THREE.Euler | undefined;
      if (ear && base) ear.rotation.copy(base);
    }
    if (earShape === "folded") {
      const leftBase = b.leftEar?.userData.baseRotation as THREE.Euler | undefined;
      const rightBase = b.rightEar?.userData.baseRotation as THREE.Euler | undefined;
      if (b.leftEar && leftBase) {
        b.leftEar.rotation.x = leftBase.x + 0.65;
        b.leftEar.rotation.z = leftBase.z + (species === "dog" ? 0.55 : 0.35);
      }
      if (b.rightEar && rightBase) {
        b.rightEar.rotation.x = rightBase.x + 0.65;
        b.rightEar.rotation.z = rightBase.z - (species === "dog" ? 0.55 : 0.35);
      }
    }
  }, [earShape, parts, species]);

  // idle: 숨쉬기 + 꼬리 흔들기 + 반응 시 고개 갸웃
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const b = parts.bones[species];

    if (bobRef.current) bobRef.current.position.y = Math.sin(t * 2.1) * 0.03;
    if (b.spine) b.spine.scale.setScalar(1 + Math.sin(t * 2.1) * 0.015);
    if (b.tail) {
      const base = b.tail.userData.baseRotation as THREE.Euler;
      b.tail.rotation.y = base.y + Math.sin(t * (reacting ? 13 : 4.5)) * (reacting ? 0.45 : 0.22);
    }
    if (b.head) {
      const base = b.head.userData.baseRotation as THREE.Euler;
      b.head.rotation.z =
        base.z + (reacting ? 0.13 + Math.sin(t * 3) * 0.05 : Math.sin(t * 1.4) * 0.02);
    }
  });

  // 무늬(점/등 얼룩)와 양말은 vertex color로 몸 표면에 칠해짐 — 3D 오브젝트는 액세서리만
  const style = STYLE_POSITIONS[species];

  return (
    <group ref={bobRef}>
      <group ref={groupRef}>
        <primitive object={clone} />
        {/* 강아지 눈: PNG 데칼 한 장 (고양이는 텍스처 눈 사용) */}
        {species === "dog" && (
          <mesh position={DOG_EYE_DECAL.center}>
            <planeGeometry args={[DOG_EYE_DECAL.size, DOG_EYE_DECAL.size]} />
            <meshBasicMaterial map={dogEyes} transparent alphaTest={0.5} toneMapped={false} />
          </mesh>
        )}
        {species === "dog" && blushTexture &&
          [DOG_BLUSH.left, DOG_BLUSH.right].map((position, i) => (
            <mesh key={i} position={position} scale={DOG_BLUSH.scale}>
              <circleGeometry args={[1, 32]} />
              <meshBasicMaterial
                map={blushTexture}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
          ))}
        {accessory === "collar" && (
          <group position={style.harness}>
            <mesh position={[-0.12, 0.04, 0]} rotation={[0.55, 0, -0.45]}>
              <cylinderGeometry args={[0.028, 0.028, 0.44, 12]} />
              <Mat color="#E58A7B" />
            </mesh>
            <mesh position={[0.12, 0.04, 0]} rotation={[0.55, 0, 0.45]}>
              <cylinderGeometry args={[0.028, 0.028, 0.44, 12]} />
              <Mat color="#E58A7B" />
            </mesh>
            <mesh position={[0, 0.16, 0.02]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.026, 0.026, 0.26, 12]} />
              <Mat color="#E58A7B" />
            </mesh>
            <mesh position={[0, -0.1, 0.02]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.026, 0.026, 0.28, 12]} />
              <Mat color="#E58A7B" />
            </mesh>
          </group>
        )}
        {accessory === "ribbon" && (
          <group position={style.ribbon} rotation={[0.2, 0, 0]}>
            <mesh position={[0.055, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <coneGeometry args={[0.05, 0.12, 6]} />
              <Mat color="#E77B8E" />
            </mesh>
            <mesh position={[-0.055, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
              <coneGeometry args={[0.05, 0.12, 6]} />
              <Mat color="#E77B8E" />
            </mesh>
            <mesh>
              <sphereGeometry args={[0.032, 10, 8]} />
              <Mat color="#E77B8E" />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

useGLTF.preload(MODEL_PATH);
useTexture.preload(DOG_EYES.eye1);
useTexture.preload(DOG_EYES.eye2);
useTexture.preload(DOG_EYES.eye3);
