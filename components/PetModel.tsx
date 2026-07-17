"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useAppStore } from "@/lib/store";

const DARK = "#3A3230";
const CREAM = "#F3E9D8";
const BROWN = "#8A5A3B";
const CORAL = "#E58A7B";
const PINK = "#E77B8E";

function isLightColor(hex: string): boolean {
  const c = new THREE.Color(hex);
  return 0.299 * c.r + 0.587 * c.g + 0.114 * c.b > 0.45;
}

// 로우폴리 감성: 낮은 세그먼트 + flatShading
const SEG: [number, number] = [12, 9];

function Mat({ color }: { color: string }) {
  return <meshStandardMaterial color={color} flatShading roughness={0.9} />;
}

export default function PetModel() {
  const species = useAppStore((s) => s.species);
  const bodyColor = useAppStore((s) => s.bodyColor);
  const pattern = useAppStore((s) => s.pattern);
  const earShape = useAppStore((s) => s.earShape);
  const accessory = useAppStore((s) => s.accessory);
  const reacting = useAppStore((s) => s.reacting);

  const bodyRef = useRef<THREE.Group>(null);
  const headRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // 숨쉬기: 몸이 살짝 오르내림
    if (bodyRef.current) {
      bodyRef.current.position.y = Math.sin(t * 2.1) * 0.035;
      bodyRef.current.scale.y = 1 + Math.sin(t * 2.1) * 0.012;
    }
    // 꼬리 흔들기 (반응 중엔 빠르게)
    if (tailRef.current) {
      const speed = reacting ? 13 : 4.5;
      const amp = reacting ? 0.55 : 0.3;
      tailRef.current.rotation.y = Math.sin(t * speed) * amp;
    }
    // 반응 중엔 고개 갸웃
    if (headRef.current) {
      headRef.current.rotation.z = reacting
        ? 0.14 + Math.sin(t * 3) * 0.05
        : Math.sin(t * 1.4) * 0.025;
    }
  });

  const patchColor = isLightColor(bodyColor) ? BROWN : CREAM;
  const isCat = species === "cat";
  const legPositions: [number, number][] = [
    [0.42, 0.42],
    [-0.42, 0.42],
    [0.42, -0.5],
    [-0.42, -0.5],
  ];

  return (
    <group>
      {/* 다리 (숨쉬기 애니메이션과 분리해 바닥에 고정) */}
      {legPositions.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.15, 0.17, 0.72, 8]} />
            <Mat color={bodyColor} />
          </mesh>
          {pattern === "socks" && (
            <mesh position={[0, 0.13, 0]}>
              <cylinderGeometry args={[0.17, 0.19, 0.26, 8]} />
              <Mat color={patchColor} />
            </mesh>
          )}
        </group>
      ))}

      <group ref={bodyRef}>
        {/* 몸통 */}
        <mesh position={[0, 1.02, -0.05]} scale={[1.05, 0.85, 1.35]}>
          <sphereGeometry args={[0.92, ...SEG]} />
          <Mat color={bodyColor} />
        </mesh>

        {/* 등 얼룩 */}
        {pattern === "backPatch" && (
          <mesh position={[0.18, 1.55, -0.35]} scale={[1, 0.45, 0.95]} rotation={[0, 0.3, 0.1]}>
            <sphereGeometry args={[0.52, 10, 8]} />
            <Mat color={patchColor} />
          </mesh>
        )}

        {/* 목걸이 */}
        {accessory === "collar" && (
          <mesh position={[0, 1.5, 0.42]} rotation={[1.25, 0, 0]}>
            <torusGeometry args={[0.48, 0.09, 8, 18]} />
            <Mat color={CORAL} />
          </mesh>
        )}

        {/* 머리 */}
        <group ref={headRef} position={[0, 2.0, 0.6]}>
          <mesh>
            <sphereGeometry args={[0.66, ...SEG]} />
            <Mat color={bodyColor} />
          </mesh>

          {/* 얼굴 점 */}
          {pattern === "faceDot" && (
            <mesh position={[0.32, 0.26, 0.42]}>
              <sphereGeometry args={[0.14, 8, 6]} />
              <Mat color={patchColor} />
            </mesh>
          )}

          {/* 주둥이 */}
          <mesh position={[0, -0.14, 0.5]} scale={isCat ? [0.85, 0.55, 0.7] : [1, 0.7, 0.85]}>
            <sphereGeometry args={[0.3, 10, 8]} />
            <Mat color={CREAM} />
          </mesh>
          {/* 코 */}
          <mesh position={[0, -0.02, isCat ? 0.72 : 0.78]}>
            <sphereGeometry args={[isCat ? 0.07 : 0.09, 8, 6]} />
            <Mat color={DARK} />
          </mesh>

          {/* 눈 */}
          <mesh position={[0.26, 0.12, 0.52]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <Mat color={DARK} />
          </mesh>
          <mesh position={[-0.26, 0.12, 0.52]}>
            <sphereGeometry args={[0.07, 8, 6]} />
            <Mat color={DARK} />
          </mesh>

          {/* 귀 */}
          {isCat ? (
            earShape === "up" ? (
              <>
                <mesh position={[0.34, 0.6, 0]} rotation={[0, 0, -0.28]}>
                  <coneGeometry args={[0.2, 0.5, 6]} />
                  <Mat color={bodyColor} />
                </mesh>
                <mesh position={[-0.34, 0.6, 0]} rotation={[0, 0, 0.28]}>
                  <coneGeometry args={[0.2, 0.5, 6]} />
                  <Mat color={bodyColor} />
                </mesh>
              </>
            ) : (
              <>
                {/* 접힌 귀 (스코티시폴드 느낌) */}
                <mesh position={[0.36, 0.48, 0.08]} rotation={[0.9, 0, -0.9]}>
                  <coneGeometry args={[0.18, 0.32, 6]} />
                  <Mat color={bodyColor} />
                </mesh>
                <mesh position={[-0.36, 0.48, 0.08]} rotation={[0.9, 0, 0.9]}>
                  <coneGeometry args={[0.18, 0.32, 6]} />
                  <Mat color={bodyColor} />
                </mesh>
              </>
            )
          ) : earShape === "up" ? (
            <>
              <mesh position={[0.36, 0.58, -0.02]} rotation={[0, 0, -0.22]}>
                <coneGeometry args={[0.23, 0.48, 7]} />
                <Mat color={bodyColor} />
              </mesh>
              <mesh position={[-0.36, 0.58, -0.02]} rotation={[0, 0, 0.22]}>
                <coneGeometry args={[0.23, 0.48, 7]} />
                <Mat color={bodyColor} />
              </mesh>
            </>
          ) : (
            <>
              {/* 접힌 귀 (댕댕이) */}
              <mesh position={[0.48, 0.32, 0.02]} rotation={[0, 0, -1.0]} scale={[0.7, 1, 0.45]}>
                <sphereGeometry args={[0.26, 8, 6]} />
                <Mat color={bodyColor} />
              </mesh>
              <mesh position={[-0.48, 0.32, 0.02]} rotation={[0, 0, 1.0]} scale={[0.7, 1, 0.45]}>
                <sphereGeometry args={[0.26, 8, 6]} />
                <Mat color={bodyColor} />
              </mesh>
            </>
          )}

          {/* 리본 */}
          {accessory === "ribbon" && (
            <group position={[0, 0.62, 0.22]} rotation={[0.25, 0, 0]}>
              <mesh position={[0.18, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <coneGeometry args={[0.13, 0.3, 5]} />
                <Mat color={PINK} />
              </mesh>
              <mesh position={[-0.18, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.13, 0.3, 5]} />
                <Mat color={PINK} />
              </mesh>
              <mesh>
                <sphereGeometry args={[0.09, 8, 6]} />
                <Mat color={PINK} />
              </mesh>
            </group>
          )}
        </group>

        {/* 꼬리 */}
        <group ref={tailRef} position={[0, 1.15, -1.15]}>
          {isCat ? (
            <mesh position={[0, 0.42, -0.12]} rotation={[0.35, 0, 0]}>
              <cylinderGeometry args={[0.055, 0.09, 1.05, 7]} />
              <Mat color={bodyColor} />
            </mesh>
          ) : (
            <mesh position={[0, 0.3, -0.1]} rotation={[0.55, 0, 0]}>
              <coneGeometry args={[0.14, 0.75, 7]} />
              <Mat color={bodyColor} />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}
