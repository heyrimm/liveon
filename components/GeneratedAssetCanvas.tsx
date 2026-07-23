"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { ContactShadows, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";

function GeneratedAsset({ url }: { url: string }) {
  const { scene } = useGLTF(url);
  const { model, scale } = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateWorldMatrix(true, true);

    const box = new THREE.Box3().setFromObject(clone);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDimension = Math.max(size.x, size.y, size.z);

    clone.position.x -= center.x;
    clone.position.y -= box.min.y;
    clone.position.z -= center.z;

    return {
      model: clone,
      scale: maxDimension > 0 ? 2.4 / maxDimension : 1,
    };
  }, [scene]);
  const modelRef = useRef<THREE.Group>(null);

  useEffect(() => {
    model.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }, [model]);

  useFrame((_, delta) => {
    if (modelRef.current) modelRef.current.rotation.y += delta * 0.08;
  });

  return (
    <group ref={modelRef} scale={scale}>
      <primitive object={model} />
    </group>
  );
}

export default function GeneratedAssetCanvas({ modelUrl }: { modelUrl: string }) {
  return (
    <Canvas
      camera={{ position: [4, 2.4, 5], fov: 38 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      shadows
    >
      <color attach="background" args={["#f5ecdf"]} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[4, 7, 5]} intensity={2.2} castShadow />
      <directionalLight position={[-4, 3, -4]} intensity={0.7} color="#ffd8bf" />
      <Suspense fallback={null}>
        <GeneratedAsset key={modelUrl} url={modelUrl} />
      </Suspense>
      <ContactShadows
        position={[0, -0.015, 0]}
        opacity={0.28}
        scale={5}
        blur={2.4}
        far={5}
      />
      <OrbitControls
        makeDefault
        enablePan={false}
        target={[0, 1, 0]}
        minDistance={2.5}
        maxDistance={10}
        minPolarAngle={0.45}
        maxPolarAngle={1.55}
      />
    </Canvas>
  );
}
