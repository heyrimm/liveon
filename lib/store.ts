import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Screen = "start" | "customize" | "chat";
export type Species = "dog" | "cat";
export type Pattern = "none" | "faceDot" | "backPatch" | "socks";
export type EarShape = "up" | "folded";
export type Accessory = "none" | "ribbon" | "collar";
export type PetSize = "small" | "medium" | "large";
export type EyeStyle = "eye1" | "eye2" | "eye3";

export const SIZE_SCALE: Record<PetSize, number> = {
  small: 0.72,
  medium: 1,
  large: 1.28,
};

export interface PetConfig {
  species: Species;
  bodyColor: string;
  pattern: Pattern;
  earShape: EarShape;
  accessory: Accessory;
  name: string;
  eyeStyle: EyeStyle;
}

/** 부위별 색 — null이면 몸 색을 따라감 */
export interface PetLook {
  earColor: string | null;
  pawColor: string | null;
  tailColor: string | null;
  muzzleColor: string | null;
  petSize: PetSize;
}

/** 저장된 아이 한 마리의 스냅샷 (시작 화면에서 목록으로 보여줌) */
export interface PetProfile extends PetConfig, PetLook {
  id: string;
}

function makeProfileId(): string {
  return `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface AppState extends PetConfig, PetLook {
  screen: Screen;
  /** true while the pet is "responding" — speeds up tail wag / head tilt */
  reacting: boolean;
  /** 저장된 프로필 목록과, 지금 편집/대화 중인 프로필의 id */
  profiles: PetProfile[];
  activeProfileId: string | null;
  set: (partial: Partial<AppState>) => void;
  /** 현재 편집 중인 값을 activeProfileId 프로필로 저장(없으면 새로 생성) */
  saveActiveProfile: () => void;
  /** 저장된 프로필을 불러와 편집 상태로 세팅하고 지정한 화면으로 이동 */
  loadProfile: (id: string, screen: Screen) => void;
  /** 기본값으로 초기화하고 꾸미기 화면으로 이동 (새 프로필 생성 시작) */
  startNewProfile: () => void;
  deleteProfile: (id: string) => void;
}

export const BODY_COLORS: { label: string; value: string }[] = [
  { label: "흰색", value: "#F6F1E7" },
  { label: "크림", value: "#EFDDB5" },
  { label: "치즈", value: "#E5AE5B" },
  { label: "갈색", value: "#A9744C" },
  { label: "초코", value: "#6B4A35" },
  { label: "회색", value: "#9E9A94" },
  { label: "검정", value: "#3F3A36" },
];

const DEFAULT_PET: PetConfig & PetLook = {
  species: "dog",
  bodyColor: BODY_COLORS[1].value,
  earColor: null,
  pawColor: null,
  tailColor: null,
  muzzleColor: null,
  petSize: "medium",
  eyeStyle: "eye1",
  pattern: "none",
  earShape: "up",
  accessory: "none",
  name: "",
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      screen: "start",
      ...DEFAULT_PET,
      reacting: false,
      profiles: [],
      activeProfileId: null,
      set: (partial) => set(partial),
      saveActiveProfile: () => {
        const s = get();
        const snapshot: PetProfile = {
          id: s.activeProfileId ?? makeProfileId(),
          species: s.species,
          bodyColor: s.bodyColor,
          pattern: s.pattern,
          earShape: s.earShape,
          accessory: s.accessory,
          name: s.name,
          eyeStyle: s.eyeStyle,
          earColor: s.earColor,
          pawColor: s.pawColor,
          tailColor: s.tailColor,
          muzzleColor: s.muzzleColor,
          petSize: s.petSize,
        };
        const exists = s.profiles.some((p) => p.id === snapshot.id);
        set({
          activeProfileId: snapshot.id,
          profiles: exists
            ? s.profiles.map((p) => (p.id === snapshot.id ? snapshot : p))
            : [...s.profiles, snapshot],
        });
      },
      loadProfile: (id, screen) => {
        const profile = get().profiles.find((p) => p.id === id);
        if (!profile) return;
        const { id: profileId, ...look } = profile;
        set({ ...look, activeProfileId: profileId, screen });
      },
      startNewProfile: () => {
        set({ ...DEFAULT_PET, activeProfileId: null, screen: "customize" });
      },
      deleteProfile: (id) => {
        const s = get();
        set({
          profiles: s.profiles.filter((p) => p.id !== id),
          ...(s.activeProfileId === id ? { activeProfileId: null } : {}),
        });
      },
    }),
    {
      name: "liveon-app",
      // SSR 첫 렌더와 localStorage 값이 어긋나 hydration mismatch가 나지 않도록,
      // page.tsx에서 마운트 후 수동으로 rehydrate() 호출
      skipHydration: true,
      // 일시적 상태(reacting)와 액션은 저장하지 않음
      partialize: (s) => ({
        screen: s.screen,
        species: s.species,
        bodyColor: s.bodyColor,
        earColor: s.earColor,
        pawColor: s.pawColor,
        tailColor: s.tailColor,
        muzzleColor: s.muzzleColor,
        petSize: s.petSize,
        eyeStyle: s.eyeStyle,
        pattern: s.pattern,
        earShape: s.earShape,
        accessory: s.accessory,
        name: s.name,
        profiles: s.profiles,
        activeProfileId: s.activeProfileId,
      }),
    }
  )
);

/** 받침 유무에 따라 "이에요/예요" 선택 */
export function nameWithParticle(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "저예요";
  const last = trimmed.charCodeAt(trimmed.length - 1);
  const isHangul = last >= 0xac00 && last <= 0xd7a3;
  const hasBatchim = isHangul && (last - 0xac00) % 28 > 0;
  return trimmed + (hasBatchim ? "이에요" : "예요");
}
