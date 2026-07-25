"use client";

import { useAppStore, BODY_COLORS, Pattern, EarShape, Accessory, PetSize, EyeStyle } from "@/lib/store";
import SceneCanvas from "./SceneCanvas";

const PATTERNS: { label: string; value: Pattern }[] = [
  { label: "없음", value: "none" },
  { label: "얼굴 점", value: "faceDot" },
  { label: "등 얼룩", value: "backPatch" },
];

const SIZES: { label: string; value: PetSize }[] = [
  { label: "소형견", value: "small" },
  { label: "중형견", value: "medium" },
  { label: "대형견", value: "large" },
];

const EYES: { label: string; value: EyeStyle }[] = [
  { label: "Eye 1", value: "eye1" },
  { label: "Eye 2", value: "eye2" },
  { label: "Eye 3", value: "eye3" },
];

const EARS: { label: string; value: EarShape }[] = [
  { label: "선 귀", value: "up" },
  { label: "접힌 귀", value: "folded" },
];

const ACCESSORIES: { label: string; value: Accessory }[] = [
  { label: "없음", value: "none" },
  { label: "리본", value: "ribbon" },
  { label: "목줄", value: "collar" },
];

/** 색상 스와치 줄 — allowFollow면 "몸과 같게" 칩 포함 (value null = 몸 색 따라감) */
function ColorRow({
  label,
  value,
  onChange,
  allowFollow,
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  allowFollow?: boolean;
}) {
  return (
    <section className="panel-section">
      <h3>{label}</h3>
      <div className="swatch-row">
        {allowFollow && (
          <button
            className={`chip ${value === null ? "chip-on" : ""}`}
            onClick={() => onChange(null)}
          >
            몸과 같게
          </button>
        )}
        {BODY_COLORS.map((c) => (
          <button
            key={c.value}
            title={c.label}
            aria-label={c.label}
            className={`swatch ${value === c.value ? "swatch-on" : ""}`}
            style={{ background: c.value }}
            onClick={() => onChange(c.value)}
          />
        ))}
      </div>
    </section>
  );
}

export default function CustomizeScreen() {
  const s = useAppStore();

  return (
    <main className="customize-screen">
      <div className="customize-canvas">
        <SceneCanvas />
        <p className="canvas-hint">드래그해서 아이를 돌려볼 수 있어요</p>
      </div>

      <aside className="customize-panel">
        <button className="btn-back panel-back" onClick={() => s.set({ screen: "start" })}>
          ← {s.profiles.length > 0 ? "아이 목록" : "처음으로"}
        </button>
        <h2 className="panel-title">우리 아이를 기억하며 만들어주세요</h2>
        <p className="panel-sub">털 색, 점 하나까지 떠올리는 시간도 아이와의 소중한 기억이에요.</p>

        <section className="panel-section">
          <h3>종류</h3>
          <div className="chip-row">
            <button
              className={`chip ${s.species === "dog" ? "chip-on" : ""}`}
              onClick={() => s.set({ species: "dog" })}
            >
              강아지
            </button>
            <button
              className={`chip ${s.species === "cat" ? "chip-on" : ""}`}
              onClick={() => s.set({ species: "cat" })}
            >
              고양이
            </button>
          </div>
        </section>

        {s.species === "dog" && (
          <section className="panel-section">
            <h3>크기</h3>
            <div className="chip-row">
              {SIZES.map((z) => (
                <button
                  key={z.value}
                  className={`chip ${s.petSize === z.value ? "chip-on" : ""}`}
                  onClick={() => s.set({ petSize: z.value })}
                >
                  {z.label}
                </button>
              ))}
            </div>
          </section>
        )}

        {s.species === "dog" && (
          <section className="panel-section">
            <h3>눈</h3>
            <div className="chip-row">
              {EYES.map((eye) => (
                <button
                  key={eye.value}
                  className={`chip ${s.eyeStyle === eye.value ? "chip-on" : ""}`}
                  onClick={() => s.set({ eyeStyle: eye.value })}
                >
                  {eye.label}
                </button>
              ))}
            </div>
          </section>
        )}

        <ColorRow label="몸 색" value={s.bodyColor} onChange={(v) => v && s.set({ bodyColor: v })} />
        <ColorRow label="귀 색" value={s.earColor} onChange={(v) => s.set({ earColor: v })} allowFollow />
        <ColorRow label="발 색 (양말)" value={s.pawColor} onChange={(v) => s.set({ pawColor: v })} allowFollow />
        <ColorRow label="꼬리 색" value={s.tailColor} onChange={(v) => s.set({ tailColor: v })} allowFollow />

        <section className="panel-section">
          <h3>무늬</h3>
          <div className="chip-row">
            {PATTERNS.map((p) => (
              <button
                key={p.value}
                className={`chip ${s.pattern === p.value ? "chip-on" : ""}`}
                onClick={() => s.set({ pattern: p.value })}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel-section">
          <h3>귀 모양</h3>
          <div className="chip-row">
            {EARS.map((e) => (
              <button
                key={e.value}
                className={`chip ${s.earShape === e.value ? "chip-on" : ""}`}
                onClick={() => s.set({ earShape: e.value })}
              >
                {e.label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel-section">
          <h3>액세서리</h3>
          <div className="chip-row">
            {ACCESSORIES.map((a) => (
              <button
                key={a.value}
                className={`chip ${s.accessory === a.value ? "chip-on" : ""}`}
                onClick={() => s.set({ accessory: a.value })}
              >
                {a.label}
              </button>
            ))}
          </div>
        </section>

        <section className="panel-section">
          <h3>이름</h3>
          <input
            className="name-input"
            placeholder="아이 이름을 알려주세요"
            value={s.name}
            maxLength={12}
            onChange={(e) => s.set({ name: e.target.value })}
          />
        </section>

        <button
          className="btn-primary btn-full"
          disabled={!s.name.trim()}
          onClick={() => {
            s.saveActiveProfile();
            s.set({ screen: "chat" });
          }}
        >
          이제 만나러 가기
        </button>
        {!s.name.trim() && <p className="panel-note">아이의 이름을 알려주시면 만나러 갈 수 있어요.</p>}
      </aside>
    </main>
  );
}
