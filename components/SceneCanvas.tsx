"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import PetModel from "./PetModel";
import PetModelGLB from "./PetModelGLB";
import { USE_GLB_MODEL } from "@/lib/config";

export default function SceneCanvas() {
  return (
    <Canvas
      camera={{ position: [0, 1.6, 6.2], fov: 36 }}
      gl={{ antialias: true, alpha: true }}
      style={{ width: "100%", height: "100%" }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 7, 5]} intensity={1.2} />
      <directionalLight position={[-4, 3, -4]} intensity={0.35} color="#FFE9D0" />
      <group position={[0, -1.35, 0]}>
        {USE_GLB_MODEL ? (
          <Suspense fallback={null}>
            <PetModelGLB />
          </Suspense>
        ) : (
          <PetModel />
        )}
        {/* 바닥 그림자 느낌의 원 */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
          <circleGeometry args={[1.9, 40]} />
          <meshBasicMaterial color="#EDE3D2" />
        </mesh>
      </group>
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={0.7}
        maxPolarAngle={1.5}
        target={[0, 0.15, 0]}
      />
    </Canvas>
  );
}
