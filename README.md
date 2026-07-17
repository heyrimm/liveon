# LiveOn — 추모 친구 MVP 프로토타입

떠난 반려동물을 닮은 3D 캐릭터를 만들고 대화하는 데모입니다. (창업 경진대회 시연용)

## 실행

```bash
npm install
npm run dev
```

→ http://localhost:3000

## Claude API 연동 (선택)

`.env.local.example`을 `.env.local`로 복사하고 Anthropic API 키를 넣으세요.

```
ANTHROPIC_API_KEY=sk-ant-...
```

**키가 없거나 API 호출이 실패해도 데모는 동작합니다** — 미리 준비된 폴백 응답으로 자동 전환됩니다 (시연 안정성용).

## 구조

- `app/page.tsx` — 화면 전환 (시작 → 커스터마이징 → 대화)
- `components/PetModel.tsx` — 기본 도형 조합 로우폴리 강아지/고양이. 향후 실제 GLB 모델로 교체하려면 이 컴포넌트만 갈아끼우면 됨 (커스터마이징 상태는 `lib/store.ts`의 zustand 스토어에서 읽음)
- `components/SceneCanvas.tsx` — R3F Canvas, 조명, 드래그 회전(OrbitControls)
- `app/api/chat/route.ts` — Claude API 호출 (시스템 프롬프트 포함)
- `lib/store.ts` — 커스터마이징/화면 상태 (zustand)

## 배포

Vercel에 그대로 배포 가능. 환경변수 `ANTHROPIC_API_KEY`만 프로젝트 설정에 추가하면 됩니다.
