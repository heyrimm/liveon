"use client";

import Link from "next/link";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import styles from "./PetPlayground.module.css";

interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
}

interface BrowserSpeechRecognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  abort: () => void;
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

export interface PlayAssetOption {
  id: string;
  name: string;
}

interface PetPlaygroundProps {
  assets: PlayAssetOption[];
  initialAssetId?: string;
  userId: string;
}

type Direction = "up" | "down" | "left" | "right";
type Controls = Record<Direction, boolean>;
type GameStatus = "ready" | "playing" | "won" | "lost";

interface Treat {
  id: string;
  x: number;
  z: number;
}

interface Obstacle {
  id: string;
  x: number;
  z: number;
  radius: number;
  type: "rock" | "bush" | "stump";
}

const ROUND_SECONDS = 50;
const TREAT_COUNT = 10;
const ARENA_LIMIT = 4.25;
const TREAT_SPOTS: Array<[number, number]> = [
  [-3.5, -2.8],
  [-1.2, -3.6],
  [1.5, -3.4],
  [3.5, -2.2],
  [-2.8, -0.7],
  [2.7, -0.4],
  [-3.6, 2.1],
  [-1.1, 3.4],
  [1.6, 3.2],
  [3.5, 1.8],
];
const OBSTACLE_SPOTS: Array<[number, number, number, Obstacle["type"]]> = [
  [-2.15, -1.9, 0.58, "rock"],
  [0.15, -2.1, 0.52, "stump"],
  [2.35, -1.15, 0.64, "bush"],
  [-1.85, 1.25, 0.62, "bush"],
  [1.15, 1.2, 0.56, "rock"],
  [0.1, 3, 0.5, "stump"],
];

function createTreats(round: number): Treat[] {
  const angle = round * 0.37;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return TREAT_SPOTS.map(([x, z], index) => ({
    id: `${round}-${index}`,
    x: x * cosine - z * sine,
    z: x * sine + z * cosine,
  }));
}

function createObstacles(round: number): Obstacle[] {
  const angle = round * 0.37;
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);

  return OBSTACLE_SPOTS.map(([x, z, radius, type], index) => ({
    id: `${round}-obstacle-${index}`,
    x: x * cosine - z * sine,
    z: x * sine + z * cosine,
    radius,
    type,
  }));
}

function defaultPetName(asset: PlayAssetOption) {
  return asset.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "우리 아이";
}

function CameraSetup() {
  const { camera } = useThree();

  useEffect(() => {
    camera.lookAt(0, 0.25, 0);
  }, [camera]);

  return null;
}

function LoadingModel() {
  return (
    <Html center>
      <span className={styles.modelLoading}>우리 아이를 불러오는 중…</span>
    </Html>
  );
}

function TreatModel({ treat }: { treat: Treat }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const elapsed = clock.getElapsedTime();
    groupRef.current.position.y = 0.28 + Math.sin(elapsed * 2.4 + treat.x) * 0.08;
    groupRef.current.rotation.y = elapsed * 0.9 + treat.z;
  });

  return (
    <group ref={groupRef} position={[treat.x, 0.28, treat.z]} rotation={[0, 0, 0.12]}>
      <mesh castShadow>
        <boxGeometry args={[0.48, 0.14, 0.15]} />
        <meshStandardMaterial color="#e9a96f" roughness={0.55} />
      </mesh>
      {[
        [-0.25, 0.1],
        [-0.25, -0.1],
        [0.25, 0.1],
        [0.25, -0.1],
      ].map(([x, y], index) => (
        <mesh key={index} position={[x, y, 0]} castShadow>
          <sphereGeometry args={[0.13, 16, 16]} />
          <meshStandardMaterial color="#f0b77f" roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

function ObstacleModel({ obstacle }: { obstacle: Obstacle }) {
  if (obstacle.type === "rock") {
    return (
      <group position={[obstacle.x, 0.32, obstacle.z]} rotation={[0.1, obstacle.x, -0.08]}>
        <mesh castShadow receiveShadow scale={[1.15, 0.72, 0.95]}>
          <dodecahedronGeometry args={[obstacle.radius, 0]} />
          <meshStandardMaterial color="#9f998e" roughness={0.96} />
        </mesh>
        <mesh position={[0.17, 0.29, 0.12]}>
          <sphereGeometry args={[0.12, 12, 12]} />
          <meshStandardMaterial color="#acb99a" roughness={0.9} />
        </mesh>
      </group>
    );
  }

  if (obstacle.type === "stump") {
    return (
      <group position={[obstacle.x, 0, obstacle.z]}>
        <mesh position={[0, 0.34, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[obstacle.radius * 0.78, obstacle.radius, 0.68, 10]} />
          <meshStandardMaterial color="#9c7557" roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.69, 0]} castShadow>
          <cylinderGeometry args={[obstacle.radius * 0.78, obstacle.radius * 0.78, 0.04, 10]} />
          <meshStandardMaterial color="#c99e73" roughness={0.88} />
        </mesh>
      </group>
    );
  }

  return (
    <group position={[obstacle.x, 0, obstacle.z]}>
      <mesh position={[0, 0.28, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.14, 0.56, 8]} />
        <meshStandardMaterial color="#8d6b4f" roughness={0.95} />
      </mesh>
      {[
        [0, 0.62, 0],
        [-0.28, 0.48, 0.08],
        [0.27, 0.5, -0.04],
      ].map(([x, y, z], index) => (
        <mesh key={index} position={[x, y, z]} castShadow>
          <sphereGeometry args={[obstacle.radius * 0.62, 14, 14]} />
          <meshStandardMaterial
            color={index === 0 ? "#8fa77d" : "#9db38b"}
            roughness={0.88}
          />
        </mesh>
      ))}
    </group>
  );
}

function PetActor({
  modelUrl,
  controlsRef,
  enabled,
  treats,
  obstacles,
  resetKey,
  heartBurst,
  jumpSignal,
  feedSignal,
  callSignal,
  callLabel,
  onCollect,
  onPetClick,
  onPetStroke,
  onObstacleHit,
}: {
  modelUrl: string;
  controlsRef: MutableRefObject<Controls>;
  enabled: boolean;
  treats: Treat[];
  obstacles: Obstacle[];
  resetKey: number;
  heartBurst: number;
  jumpSignal: number;
  feedSignal: number;
  callSignal: number;
  callLabel: string;
  onCollect: (id: string) => void;
  onPetClick: () => void;
  onPetStroke: () => void;
  onObstacleHit: () => void;
}) {
  const { scene } = useGLTF(modelUrl);
  const actorRef = useRef<THREE.Group>(null);
  const feedingRef = useRef<THREE.Group>(null);
  const jumpProgress = useRef(1);
  const feedProgress = useRef(1);
  const attentionProgress = useRef(1);
  const fedJumped = useRef(false);
  const isPetting = useRef(false);
  const lastPetPoint = useRef({ x: 0, y: 0 });
  const lastStrokeAt = useRef(0);
  const lastObstacleHitAt = useRef(0);
  const collectedIds = useRef(new Set<string>());
  const movement = useMemo(() => new THREE.Vector3(), []);

  const model = useMemo(() => {
    const clone = scene.clone(true);
    clone.updateWorldMatrix(true, true);

    const originalBox = new THREE.Box3().setFromObject(clone);
    const originalSize = originalBox.getSize(new THREE.Vector3());
    const maxDimension = Math.max(originalSize.x, originalSize.y, originalSize.z);
    const fitScale = maxDimension > 0 ? 1.55 / maxDimension : 1;

    clone.scale.setScalar(fitScale);
    clone.updateWorldMatrix(true, true);
    const fittedBox = new THREE.Box3().setFromObject(clone);
    const fittedCenter = fittedBox.getCenter(new THREE.Vector3());
    clone.position.set(-fittedCenter.x, -fittedBox.min.y, -fittedCenter.z);

    clone.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });

    return clone;
  }, [scene]);

  useEffect(() => {
    collectedIds.current.clear();
    jumpProgress.current = 1;
    feedProgress.current = 1;
    attentionProgress.current = 1;
    isPetting.current = false;
    actorRef.current?.position.set(0, 0, 0);
  }, [modelUrl, resetKey]);

  useEffect(() => {
    if (enabled && jumpSignal > 0) jumpProgress.current = 0;
  }, [enabled, jumpSignal]);

  useEffect(() => {
    if (feedSignal > 0) {
      feedProgress.current = 0;
      fedJumped.current = false;
    }
  }, [feedSignal]);

  useEffect(() => {
    if (callSignal > 0) attentionProgress.current = 0;
  }, [callSignal]);

  useEffect(() => {
    const stopPetting = () => {
      isPetting.current = false;
    };
    window.addEventListener("pointerup", stopPetting);
    window.addEventListener("pointercancel", stopPetting);
    return () => {
      window.removeEventListener("pointerup", stopPetting);
      window.removeEventListener("pointercancel", stopPetting);
    };
  }, []);

  useFrame(({ clock }, delta) => {
    const actor = actorRef.current;
    if (!actor) return;

    let jumpHeight = 0;
    if (jumpProgress.current < 1) {
      jumpProgress.current = Math.min(1, jumpProgress.current + delta * 2.25);
      jumpHeight = Math.sin(jumpProgress.current * Math.PI) * 0.82;
    }

    movement.set(0, 0, 0);
    if (enabled) {
      if (controlsRef.current.up) movement.z -= 1;
      if (controlsRef.current.down) movement.z += 1;
      if (controlsRef.current.left) movement.x -= 1;
      if (controlsRef.current.right) movement.x += 1;
    }

    const isMoving = movement.lengthSq() > 0;
    if (isMoving) {
      movement.normalize();
      const proposedX = THREE.MathUtils.clamp(
        actor.position.x + movement.x * delta * 3.1,
        -ARENA_LIMIT,
        ARENA_LIMIT
      );
      const proposedZ = THREE.MathUtils.clamp(
        actor.position.z + movement.z * delta * 3.1,
        -ARENA_LIMIT,
        ARENA_LIMIT
      );
      const blockingObstacle =
        jumpHeight < 0.32
          ? obstacles.find((obstacle) => {
              const minimumDistance = obstacle.radius + 0.43;
              const currentDistance = Math.hypot(
                actor.position.x - obstacle.x,
                actor.position.z - obstacle.z
              );
              const proposedDistance = Math.hypot(
                proposedX - obstacle.x,
                proposedZ - obstacle.z
              );
              return (
                proposedDistance < minimumDistance &&
                !(currentDistance < minimumDistance && proposedDistance > currentDistance)
              );
            })
          : undefined;

      if (!blockingObstacle) {
        actor.position.x = proposedX;
        actor.position.z = proposedZ;
      } else if (clock.getElapsedTime() - lastObstacleHitAt.current > 0.7) {
        lastObstacleHitAt.current = clock.getElapsedTime();
        onObstacleHit();
      }
      actor.rotation.y = Math.atan2(movement.x, movement.z);
    }

    if (feedProgress.current < 1 && feedingRef.current) {
      feedProgress.current = Math.min(1, feedProgress.current + delta * 1.45);
      const progress = THREE.MathUtils.smoothstep(feedProgress.current, 0, 1);
      feedingRef.current.visible = true;
      feedingRef.current.position.set(
        0,
        THREE.MathUtils.lerp(1.28, 0.7, progress),
        THREE.MathUtils.lerp(1.75, 0.16, progress)
      );
      feedingRef.current.rotation.z = progress * Math.PI * 2;
      feedingRef.current.scale.setScalar(1 - progress * 0.42);
      if (progress > 0.72 && !fedJumped.current) {
        fedJumped.current = true;
        jumpProgress.current = 0;
      }
      if (feedProgress.current >= 1) feedingRef.current.visible = false;
    } else if (feedingRef.current) {
      feedingRef.current.visible = false;
    }

    const elapsed = clock.getElapsedTime();
    let reactionWiggle = 0;
    if (attentionProgress.current < 1) {
      attentionProgress.current = Math.min(1, attentionProgress.current + delta * 1.65);
      reactionWiggle =
        Math.sin(attentionProgress.current * Math.PI * 5) *
        (1 - attentionProgress.current) *
        0.22;
    }
    const bob = isMoving
      ? Math.abs(Math.sin(elapsed * 9)) * 0.07
      : Math.sin(elapsed * 2.2) * 0.025;
    actor.position.y = bob + jumpHeight;
    actor.rotation.z = (isMoving ? Math.sin(elapsed * 9) * 0.025 : 0) + reactionWiggle;
    const breathingScale = 1 + Math.sin(elapsed * 2.2) * 0.008;
    actor.scale.setScalar(breathingScale);

    if (!enabled) return;

    for (const treat of treats) {
      if (collectedIds.current.has(treat.id)) continue;
      const distance = Math.hypot(actor.position.x - treat.x, actor.position.z - treat.z);
      if (distance < 0.62) {
        collectedIds.current.add(treat.id);
        onCollect(treat.id);
      }
    }
  });

  function reactToPet(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    jumpProgress.current = 0;
    onPetClick();
  }

  function startPetting(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const pointerEvent = event.nativeEvent as PointerEvent;
    isPetting.current = true;
    lastPetPoint.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
  }

  function continuePetting(event: ThreeEvent<PointerEvent>) {
    if (!isPetting.current) return;
    event.stopPropagation();
    const pointerEvent = event.nativeEvent as PointerEvent;
    const distance = Math.hypot(
      pointerEvent.clientX - lastPetPoint.current.x,
      pointerEvent.clientY - lastPetPoint.current.y
    );
    const now = performance.now();
    if (distance > 12 && now - lastStrokeAt.current > 120) {
      lastPetPoint.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };
      lastStrokeAt.current = now;
      onPetStroke();
    }
  }

  return (
    <group ref={actorRef}>
      <group
        onClick={reactToPet}
        onPointerDown={startPetting}
        onPointerMove={continuePetting}
        onPointerOut={() => {
          isPetting.current = false;
        }}
      >
        <primitive object={model} />
      </group>
      <group ref={feedingRef} visible={false}>
        <mesh castShadow>
          <boxGeometry args={[0.42, 0.13, 0.14]} />
          <meshStandardMaterial color="#e9a96f" roughness={0.55} />
        </mesh>
        {[
          [-0.22, 0.09],
          [-0.22, -0.09],
          [0.22, 0.09],
          [0.22, -0.09],
        ].map(([x, y], index) => (
          <mesh key={index} position={[x, y, 0]} castShadow>
            <sphereGeometry args={[0.11, 12, 12]} />
            <meshStandardMaterial color="#f0b77f" roughness={0.5} />
          </mesh>
        ))}
      </group>
      {heartBurst > 0 && (
        <Html key={heartBurst} position={[0, 1.8, 0]} center>
          <span className={styles.heartBurst} aria-hidden="true">
            ♥
          </span>
        </Html>
      )}
      {feedSignal > 0 && (
        <Html key={feedSignal} position={[0, 1.72, 0]} center>
          <span className={styles.reactionBubble}>냠냠!</span>
        </Html>
      )}
      {callSignal > 0 && (
        <Html key={callSignal} position={[0, 1.72, 0]} center>
          <span className={styles.reactionBubble}>{callLabel}!</span>
        </Html>
      )}
    </group>
  );
}

function GameScene({
  modelUrl,
  controlsRef,
  status,
  treats,
  obstacles,
  resetKey,
  heartBurst,
  jumpSignal,
  feedSignal,
  callSignal,
  callLabel,
  onCollect,
  onPetClick,
  onPetStroke,
  onObstacleHit,
}: {
  modelUrl: string;
  controlsRef: MutableRefObject<Controls>;
  status: GameStatus;
  treats: Treat[];
  obstacles: Obstacle[];
  resetKey: number;
  heartBurst: number;
  jumpSignal: number;
  feedSignal: number;
  callSignal: number;
  callLabel: string;
  onCollect: (id: string) => void;
  onPetClick: () => void;
  onPetStroke: () => void;
  onObstacleHit: () => void;
}) {
  return (
    <>
      <CameraSetup />
      <color attach="background" args={["#f4eadb"]} />
      <fog attach="fog" args={["#f4eadb", 10, 18]} />
      <ambientLight intensity={1.3} />
      <hemisphereLight args={["#fff8ed", "#b8c7a8", 1.2]} />
      <directionalLight
        position={[4, 8, 5]}
        intensity={2.1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[5.2, 64]} />
        <meshStandardMaterial color="#dce4c9" roughness={0.92} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <torusGeometry args={[4.72, 0.035, 10, 80]} />
        <meshStandardMaterial color="#aebf96" roughness={0.8} />
      </mesh>

      {treats.map((treat) => (
        <TreatModel key={treat.id} treat={treat} />
      ))}
      {obstacles.map((obstacle) => (
        <ObstacleModel key={obstacle.id} obstacle={obstacle} />
      ))}

      <Suspense fallback={<LoadingModel />}>
        <PetActor
          key={modelUrl}
          modelUrl={modelUrl}
          controlsRef={controlsRef}
          enabled={status === "playing"}
          treats={treats}
          obstacles={obstacles}
          resetKey={resetKey}
          heartBurst={heartBurst}
          jumpSignal={jumpSignal}
          feedSignal={feedSignal}
          callSignal={callSignal}
          callLabel={callLabel}
          onCollect={onCollect}
          onPetClick={onPetClick}
          onPetStroke={onPetStroke}
          onObstacleHit={onObstacleHit}
        />
      </Suspense>

      <ContactShadows position={[0, 0.025, 0]} opacity={0.2} scale={10} blur={2.8} far={7} />
    </>
  );
}

function TouchControls({
  controlsRef,
  disabled,
  onJump,
}: {
  controlsRef: MutableRefObject<Controls>;
  disabled: boolean;
  onJump: () => void;
}) {
  function press(direction: Direction, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    controlsRef.current[direction] = true;
  }

  function release(direction: Direction, event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    controlsRef.current[direction] = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  function directionButton(direction: Direction, label: string, symbol: string) {
    return (
      <button
        type="button"
        className={styles[`control${label}`]}
        aria-label={`${label} 방향으로 이동`}
        disabled={disabled}
        onPointerDown={(event) => press(direction, event)}
        onPointerUp={(event) => release(direction, event)}
        onPointerCancel={(event) => release(direction, event)}
      >
        {symbol}
      </button>
    );
  }

  return (
    <div className={styles.touchControls} aria-label="이동 방향키">
      <div className={styles.directionPad}>
        {directionButton("up", "Up", "↑")}
        {directionButton("left", "Left", "←")}
        {directionButton("down", "Down", "↓")}
        {directionButton("right", "Right", "→")}
      </div>
      <button
        type="button"
        className={styles.jumpControl}
        aria-label="점프"
        disabled={disabled}
        onClick={onJump}
      >
        <span>↑</span>
        JUMP
      </button>
    </div>
  );
}

export default function PetPlayground({
  assets,
  initialAssetId,
  userId,
}: PetPlaygroundProps) {
  const [selectedAssetId, setSelectedAssetId] = useState(initialAssetId || assets[0]?.id || "");
  const [status, setStatus] = useState<GameStatus>("ready");
  const [treats, setTreats] = useState<Treat[]>(() => createTreats(0));
  const [obstacles, setObstacles] = useState<Obstacle[]>(() => createObstacles(0));
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [resetKey, setResetKey] = useState(0);
  const [heartBurst, setHeartBurst] = useState(0);
  const [jumpSignal, setJumpSignal] = useState(0);
  const [feedSignal, setFeedSignal] = useState(0);
  const [callSignal, setCallSignal] = useState(0);
  const [affection, setAffection] = useState(0);
  const [petName, setPetName] = useState("우리 아이");
  const [notice, setNotice] = useState("");
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const roundRef = useRef(0);
  const endTimeRef = useRef(0);
  const timeLeftRef = useRef(ROUND_SECONDS);
  const noticeTimerRef = useRef<number | null>(null);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const controlsRef = useRef<Controls>({
    up: false,
    down: false,
    left: false,
    right: false,
  });
  const storageKey = `liveon-play-best:${userId}`;
  const selectedAsset = assets.find((asset) => asset.id === selectedAssetId) || assets[0];
  const collectedCount = TREAT_COUNT - treats.length;

  const clearControls = useCallback(() => {
    controlsRef.current = { up: false, down: false, left: false, right: false };
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(""), 1500);
  }, []);

  useEffect(() => {
    const savedScore = Number.parseInt(window.localStorage.getItem(storageKey) || "0", 10);
    setBestScore(Number.isFinite(savedScore) ? savedScore : 0);
  }, [storageKey]);

  useEffect(() => {
    setSpeechSupported(Boolean(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => {
      recognitionRef.current?.abort();
      if (noticeTimerRef.current) window.clearTimeout(noticeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedAsset) return;
    const nameKey = `liveon-pet-name:${userId}:${selectedAsset.id}`;
    setPetName(window.localStorage.getItem(nameKey) || defaultPetName(selectedAsset));
  }, [selectedAsset, userId]);

  useEffect(() => {
    const keyDirections: Record<string, Direction> = {
      ArrowUp: "up",
      w: "up",
      W: "up",
      ArrowDown: "down",
      s: "down",
      S: "down",
      ArrowLeft: "left",
      a: "left",
      A: "left",
      ArrowRight: "right",
      d: "right",
      D: "right",
    };

    function updateKey(event: KeyboardEvent, pressed: boolean) {
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement ||
        event.target instanceof HTMLButtonElement
      ) {
        return;
      }
      const direction = keyDirections[event.key];
      if (!direction) return;
      event.preventDefault();
      controlsRef.current[direction] = pressed;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code === "Space" &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target instanceof HTMLButtonElement)
      ) {
        event.preventDefault();
        if (status === "playing" && !event.repeat) {
          setJumpSignal((current) => current + 1);
        }
        return;
      }
      updateKey(event, true);
    };
    const handleKeyUp = (event: KeyboardEvent) => updateKey(event, false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearControls);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearControls);
    };
  }, [clearControls, status]);

  useEffect(() => {
    if (status !== "playing") {
      clearControls();
      return;
    }

    function updateTimer() {
      const remaining = Math.max(0, (endTimeRef.current - Date.now()) / 1000);
      timeLeftRef.current = remaining;
      setTimeLeft(remaining);
      if (remaining <= 0) setStatus("lost");
    }

    updateTimer();
    const timer = window.setInterval(updateTimer, 100);
    return () => window.clearInterval(timer);
  }, [clearControls, status]);

  useEffect(() => {
    if (status === "playing" && treats.length === 0) {
      setStatus("won");
    }
  }, [status, treats.length]);

  useEffect(() => {
    if ((status === "won" || status === "lost") && score > bestScore) {
      setBestScore(score);
      window.localStorage.setItem(storageKey, String(score));
    }
  }, [bestScore, score, status, storageKey]);

  function startGame() {
    roundRef.current += 1;
    clearControls();
    setTreats(createTreats(roundRef.current));
    setObstacles(createObstacles(roundRef.current));
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    timeLeftRef.current = ROUND_SECONDS;
    endTimeRef.current = Date.now() + ROUND_SECONDS * 1000;
    setResetKey((current) => current + 1);
    setStatus("playing");
  }

  function chooseAsset(assetId: string) {
    if (status === "playing") return;
    setSelectedAssetId(assetId);
    setStatus("ready");
    setScore(0);
    setTimeLeft(ROUND_SECONDS);
    setTreats(createTreats(roundRef.current));
    setObstacles(createObstacles(roundRef.current));
    setResetKey((current) => current + 1);
  }

  function collectTreat(treatId: string) {
    setTreats((current) => current.filter((treat) => treat.id !== treatId));
    setScore((current) => current + 100 + Math.ceil(timeLeftRef.current) * 2);
  }

  function updatePetName(value: string) {
    setPetName(value);
    if (!selectedAsset) return;
    window.localStorage.setItem(`liveon-pet-name:${userId}:${selectedAsset.id}`, value);
  }

  function reactWithAffection(amount: number) {
    setAffection((current) => Math.min(100, current + amount));
    setHeartBurst((current) => current + 1);
  }

  function petThePet() {
    reactWithAffection(2);
    showNotice(`${petName || "우리 아이"}가 쓰다듬는 손길을 좋아해요 ♥`);
  }

  function feedPet() {
    if (status !== "playing") return;
    setFeedSignal((current) => current + 1);
    reactWithAffection(9);
    showNotice("간식을 맛있게 먹었어요! +애정");
  }

  function callPet() {
    if (status !== "playing") return;
    const name = petName.trim() || "우리 아이";
    setCallSignal((current) => current + 1);
    reactWithAffection(4);
    showNotice(`${name}! 부르는 소리에 돌아봤어요.`);
  }

  function listenForName() {
    if (status !== "playing") return;
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      showNotice("이 브라우저는 음성 인식을 지원하지 않아요.");
      return;
    }

    recognitionRef.current?.abort();
    const recognition = new Recognition();
    recognitionRef.current = recognition;
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim() || "";
      const name = petName.trim();
      if (!name || transcript.replace(/\s/g, "").includes(name.replace(/\s/g, ""))) {
        callPet();
      } else {
        showNotice(`“${transcript}”로 들었어요. ${name} 이름을 불러주세요.`);
      }
    };
    recognition.onerror = () => {
      showNotice("목소리를 듣지 못했어요. 다시 눌러주세요.");
    };
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    try {
      recognition.start();
    } catch {
      setIsListening(false);
      showNotice("마이크를 시작하지 못했어요. 이름 부르기 버튼을 이용해주세요.");
    }
  }

  function hitObstacle() {
    if (status !== "playing") return;
    setScore((current) => Math.max(0, current - 35));
    showNotice("앗, 장애물! 점프해서 넘어가세요. -35");
  }

  if (!selectedAsset) {
    return (
      <main className={styles.emptyPage}>
        <section className={styles.emptyCard}>
          <span className={styles.emptyIcon}>3D</span>
          <p className={styles.eyebrow}>LIVEON PLAYGROUND</p>
          <h1>먼저 우리 아이를 만들어주세요.</h1>
          <p>사진으로 만든 3D 에셋이 있으면 바로 게임의 주인공이 될 수 있어요.</p>
          <Link href="/meshy">3D 에셋 만들러 가기 →</Link>
        </section>
      </main>
    );
  }

  const overlayCopy =
    status === "won"
      ? {
          eyebrow: "간식 찾기 성공!",
          title: "우리 아이가 모두 찾았어요",
          description: `${score.toLocaleString("ko-KR")}점 · 다시 놀면 간식 위치가 바뀌어요.`,
          action: "한 번 더 놀기",
        }
      : status === "lost"
        ? {
            eyebrow: "시간 종료",
            title: `${collectedCount}개의 간식을 찾았어요`,
            description: "조금만 더 빠르게 움직여볼까요?",
            action: "다시 도전하기",
          }
        : {
            eyebrow: "간식 찾기",
            title: "우리 아이와 산책을 시작해요",
            description: "50초 안에 장애물을 넘고 간식 10개를 모두 모아보세요.",
            action: "게임 시작",
          };

  return (
    <main className={styles.page}>
      <header className={styles.topbar}>
        <Link href="/meshy" className={styles.backLink}>
          ← 3D 스튜디오
        </Link>
        <Link href="/" className={styles.brand}>
          LiveOn
        </Link>
        <span className={styles.topHint}>WASD · SPACE 점프 · 터치</span>
      </header>

      <section className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>LIVEON PLAYGROUND · TREAT HUNT</p>
          <h1>우리 아이와 간식 찾기</h1>
        </div>
        <p>
          직접 만든 3D 아이가 오늘의 주인공이에요.
          <br />
          쓰다듬고 이름을 부르며 장애물을 함께 넘어봐요.
        </p>
      </section>

      <div className={styles.gameLayout}>
        <section className={styles.arena}>
          <div className={styles.canvas}>
            <Canvas
              camera={{ position: [0, 7.7, 8.5], fov: 43, near: 0.1, far: 40 }}
              dpr={[1, 1.75]}
              gl={{ antialias: true, alpha: false }}
              shadows
            >
              <GameScene
                modelUrl={`/api/assets/${selectedAsset.id}/model`}
                controlsRef={controlsRef}
                status={status}
                treats={treats}
                obstacles={obstacles}
                resetKey={resetKey}
                heartBurst={heartBurst}
                jumpSignal={jumpSignal}
                feedSignal={feedSignal}
                callSignal={callSignal}
                callLabel={petName.trim() || "우리 아이"}
                onCollect={collectTreat}
                onPetClick={() => {
                  reactWithAffection(1);
                  showNotice(`${petName || "우리 아이"}가 폴짝 뛰었어요!`);
                }}
                onPetStroke={petThePet}
                onObstacleHit={hitObstacle}
              />
            </Canvas>
          </div>

          <div className={styles.hud}>
            <div>
              <span>남은 시간</span>
              <strong>{Math.ceil(timeLeft)}초</strong>
            </div>
            <div>
              <span>찾은 간식</span>
              <strong>
                {collectedCount}<small> / {TREAT_COUNT}</small>
              </strong>
            </div>
            <div>
              <span>점수</span>
              <strong>{score.toLocaleString("ko-KR")}</strong>
            </div>
          </div>

          <div className={styles.progressTrack} aria-label={`간식 ${collectedCount}개 찾음`}>
            <span style={{ width: `${(collectedCount / TREAT_COUNT) * 100}%` }} />
          </div>

          {status !== "playing" && (
            <div className={styles.gameOverlay}>
              <div className={styles.overlayCard}>
                <p>{overlayCopy.eyebrow}</p>
                <h2>{overlayCopy.title}</h2>
                <span>{overlayCopy.description}</span>
                <button type="button" onClick={startGame}>
                  {overlayCopy.action} <b>→</b>
                </button>
              </div>
            </div>
          )}

          {notice && (
            <div key={notice} className={styles.notice} role="status">
              {notice}
            </div>
          )}

          <TouchControls
            controlsRef={controlsRef}
            disabled={status !== "playing"}
            onJump={() => setJumpSignal((current) => current + 1)}
          />
          <span className={styles.petHint}>드래그로 쓰다듬기 · SPACE로 점프</span>
        </section>

        <aside className={styles.sidePanel}>
          <section className={styles.scoreCard}>
            <span>BEST SCORE</span>
            <strong>{bestScore.toLocaleString("ko-KR")}</strong>
            <small>이 브라우저에 내 최고 점수가 저장돼요.</small>
          </section>

          <section className={styles.interactionPanel}>
            <div className={styles.sectionHeading}>
              <span>우리 아이와 교감하기</span>
              <small>드래그로 쓰다듬기</small>
            </div>

            <label className={styles.nameField}>
              <span>부를 이름</span>
              <input
                value={petName}
                maxLength={20}
                placeholder="우리 아이 이름"
                onChange={(event) => updatePetName(event.target.value)}
              />
            </label>

            <div className={styles.interactionActions}>
              <button type="button" disabled={status !== "playing"} onClick={feedPet}>
                <span>♢</span>
                간식 주기
              </button>
              <button type="button" disabled={status !== "playing"} onClick={callPet}>
                <span>♥</span>
                이름 부르기
              </button>
              <button
                type="button"
                disabled={status !== "playing" || !speechSupported || isListening}
                onClick={listenForName}
                title={
                  speechSupported
                    ? "마이크로 이름 부르기"
                    : "이 브라우저에서는 음성 인식을 지원하지 않습니다."
                }
              >
                <span>◉</span>
                {isListening ? "듣는 중…" : "마이크"}
              </button>
            </div>

            <div className={styles.affection}>
              <div>
                <span>애정도</span>
                <strong>{affection}%</strong>
              </div>
              <div className={styles.affectionTrack}>
                <span style={{ width: `${affection}%` }} />
              </div>
            </div>
          </section>

          <section className={styles.assetPanel}>
            <div className={styles.sectionHeading}>
              <span>오늘의 주인공</span>
              <small>{assets.length}개의 에셋</small>
            </div>
            <div className={styles.assetList}>
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type="button"
                  className={selectedAsset.id === asset.id ? styles.assetSelected : ""}
                  disabled={status === "playing"}
                  onClick={() => chooseAsset(asset.id)}
                >
                  <span className={styles.assetIcon}>3D</span>
                  <strong>{asset.name}</strong>
                  <span>{selectedAsset.id === asset.id ? "선택됨" : "선택"}</span>
                </button>
              ))}
            </div>
          </section>

          <section className={styles.guide}>
            <div className={styles.sectionHeading}>
              <span>게임 방법</span>
            </div>
            <ol>
              <li>
                <b>01</b>
                방향키나 WASD로 움직이고 SPACE로 점프해요.
              </li>
              <li>
                <b>02</b>
                나무와 돌을 피하거나 점프로 넘어가요.
              </li>
              <li>
                <b>03</b>
                빛나는 간식을 모으면 남은 시간만큼 보너스를 받아요.
              </li>
              <li>
                <b>04</b>
                아이를 드래그하고 이름을 불러 교감해요.
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}
