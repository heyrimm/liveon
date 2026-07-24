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

function PetActor({
  modelUrl,
  controlsRef,
  enabled,
  treats,
  resetKey,
  heartBurst,
  onCollect,
  onPetClick,
}: {
  modelUrl: string;
  controlsRef: MutableRefObject<Controls>;
  enabled: boolean;
  treats: Treat[];
  resetKey: number;
  heartBurst: number;
  onCollect: (id: string) => void;
  onPetClick: () => void;
}) {
  const { scene } = useGLTF(modelUrl);
  const actorRef = useRef<THREE.Group>(null);
  const jumpProgress = useRef(1);
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
    actorRef.current?.position.set(0, 0, 0);
  }, [modelUrl, resetKey]);

  useFrame(({ clock }, delta) => {
    const actor = actorRef.current;
    if (!actor) return;

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
      actor.position.x = THREE.MathUtils.clamp(
        actor.position.x + movement.x * delta * 3.1,
        -ARENA_LIMIT,
        ARENA_LIMIT
      );
      actor.position.z = THREE.MathUtils.clamp(
        actor.position.z + movement.z * delta * 3.1,
        -ARENA_LIMIT,
        ARENA_LIMIT
      );
      actor.rotation.y = Math.atan2(movement.x, movement.z);
    }

    let jumpHeight = 0;
    if (jumpProgress.current < 1) {
      jumpProgress.current = Math.min(1, jumpProgress.current + delta * 2.25);
      jumpHeight = Math.sin(jumpProgress.current * Math.PI) * 0.72;
    }

    const elapsed = clock.getElapsedTime();
    const bob = isMoving
      ? Math.abs(Math.sin(elapsed * 9)) * 0.07
      : Math.sin(elapsed * 2.2) * 0.025;
    actor.position.y = bob + jumpHeight;
    actor.rotation.z = isMoving ? Math.sin(elapsed * 9) * 0.025 : 0;
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

  return (
    <group ref={actorRef}>
      <group onClick={reactToPet}>
        <primitive object={model} />
      </group>
      {heartBurst > 0 && (
        <Html key={heartBurst} position={[0, 1.8, 0]} center>
          <span className={styles.heartBurst} aria-hidden="true">
            ♥
          </span>
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
  resetKey,
  heartBurst,
  onCollect,
  onPetClick,
}: {
  modelUrl: string;
  controlsRef: MutableRefObject<Controls>;
  status: GameStatus;
  treats: Treat[];
  resetKey: number;
  heartBurst: number;
  onCollect: (id: string) => void;
  onPetClick: () => void;
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

      <Suspense fallback={<LoadingModel />}>
        <PetActor
          key={modelUrl}
          modelUrl={modelUrl}
          controlsRef={controlsRef}
          enabled={status === "playing"}
          treats={treats}
          resetKey={resetKey}
          heartBurst={heartBurst}
          onCollect={onCollect}
          onPetClick={onPetClick}
        />
      </Suspense>

      <ContactShadows position={[0, 0.025, 0]} opacity={0.2} scale={10} blur={2.8} far={7} />
    </>
  );
}

function TouchControls({
  controlsRef,
  disabled,
}: {
  controlsRef: MutableRefObject<Controls>;
  disabled: boolean;
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
      {directionButton("up", "Up", "↑")}
      {directionButton("left", "Left", "←")}
      {directionButton("down", "Down", "↓")}
      {directionButton("right", "Right", "→")}
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
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(ROUND_SECONDS);
  const [resetKey, setResetKey] = useState(0);
  const [heartBurst, setHeartBurst] = useState(0);
  const roundRef = useRef(0);
  const endTimeRef = useRef(0);
  const timeLeftRef = useRef(ROUND_SECONDS);
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

  useEffect(() => {
    const savedScore = Number.parseInt(window.localStorage.getItem(storageKey) || "0", 10);
    setBestScore(Number.isFinite(savedScore) ? savedScore : 0);
  }, [storageKey]);

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
      const direction = keyDirections[event.key];
      if (!direction) return;
      event.preventDefault();
      controlsRef.current[direction] = pressed;
    }

    const handleKeyDown = (event: KeyboardEvent) => updateKey(event, true);
    const handleKeyUp = (event: KeyboardEvent) => updateKey(event, false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearControls);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearControls);
    };
  }, [clearControls]);

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
    setResetKey((current) => current + 1);
  }

  function collectTreat(treatId: string) {
    setTreats((current) => current.filter((treat) => treat.id !== treatId));
    setScore((current) => current + 100 + Math.ceil(timeLeftRef.current) * 2);
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
            description: "50초 안에 간식 10개를 모두 모아보세요.",
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
        <span className={styles.topHint}>WASD · 방향키 · 터치</span>
      </header>

      <section className={styles.intro}>
        <div>
          <p className={styles.eyebrow}>LIVEON PLAYGROUND · TREAT HUNT</p>
          <h1>우리 아이와 간식 찾기</h1>
        </div>
        <p>
          직접 만든 3D 아이가 오늘의 주인공이에요.
          <br />
          아이를 누르면 깜짝 반응도 보여줘요.
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
                resetKey={resetKey}
                heartBurst={heartBurst}
                onCollect={collectTreat}
                onPetClick={() => setHeartBurst((current) => current + 1)}
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

          <TouchControls controlsRef={controlsRef} disabled={status !== "playing"} />
          <span className={styles.petHint}>아이를 톡 눌러보세요 ♥</span>
        </section>

        <aside className={styles.sidePanel}>
          <section className={styles.scoreCard}>
            <span>BEST SCORE</span>
            <strong>{bestScore.toLocaleString("ko-KR")}</strong>
            <small>이 브라우저에 내 최고 점수가 저장돼요.</small>
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
                방향키나 WASD로 아이를 움직여요.
              </li>
              <li>
                <b>02</b>
                빛나는 간식 가까이 가면 자동으로 먹어요.
              </li>
              <li>
                <b>03</b>
                시간이 많이 남을수록 보너스 점수가 커져요.
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
}
