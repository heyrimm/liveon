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

## Meshy 3D 에셋 생성

`.env.local`에 Meshy API 키를 추가한 뒤 개발 서버를 다시 시작하세요.

```bash
MESHY_API_KEY=msy_...
```

→ http://localhost:3000/meshy

JPG 또는 PNG 사진을 올리면 Meshy 6의 Image to 3D 작업을 실행합니다. 생성 상태를 자동으로 확인하고, 완료된 GLB를 3D 뷰어에 표시합니다. API 키는 서버 라우트에서만 사용되며 브라우저로 전달되지 않습니다.

## 구조

- `app/page.tsx` — 화면 전환 (시작 → 커스터마이징 → 대화)
- `app/meshy/page.tsx` — Meshy Image to 3D 생성 및 GLB 미리보기
- `app/api/meshy/` — Meshy 작업 생성/상태 조회 프록시 (API 키 보호)
- `components/PetModel.tsx` — 기본 도형 조합 로우폴리 강아지/고양이. 향후 실제 GLB 모델로 교체하려면 이 컴포넌트만 갈아끼우면 됨 (커스터마이징 상태는 `lib/store.ts`의 zustand 스토어에서 읽음)
- `components/SceneCanvas.tsx` — R3F Canvas, 조명, 드래그 회전(OrbitControls)
- `app/api/chat/route.ts` — Claude API 호출 (시스템 프롬프트 포함)
- `lib/store.ts` — 커스터마이징/화면 상태 (zustand)

## 배포

Vercel에 그대로 배포 가능. 프로젝트 설정에 `ANTHROPIC_API_KEY`와 `MESHY_API_KEY`를 추가하면 됩니다.
