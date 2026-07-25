# LiveOn — 추모 친구 MVP 프로토타입

떠난 반려동물을 닮은 3D 캐릭터를 만들고 대화하는 데모입니다. (창업 경진대회 시연용)

## 실행

```bash
npm install
npm run db:migrate
npm run dev
```

→ http://localhost:3000

## Railway PostgreSQL · 로그인

Railway에서 PostgreSQL 서비스를 만든 다음 public/TCP proxy `DATABASE_URL`을
`.env.local`에 넣으세요. Vercel에서 접속할 때도 Railway 내부 주소
(`*.railway.internal`)가 아닌 외부 연결 문자열이 필요합니다.

```bash
DATABASE_URL=postgresql://postgres:password@host:port/railway
BETTER_AUTH_SECRET=32자-이상의-랜덤-문자열
BETTER_AUTH_URL=http://localhost:3000
```

시크릿은 `npx auth@latest secret`으로 만들 수 있습니다. 최초 1회
`npm run db:migrate`를 실행하면 Better Auth 사용자/세션 테이블과 사용자별
3D 에셋 테이블이 생성됩니다.

- `/signup` — 이메일 회원가입
- `/login` — 이메일 로그인
- `/assets` — 로그인한 사용자의 저장된 GLB 목록

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

JPG 또는 PNG 사진을 올리면 Meshy 6의 Image to 3D 작업을 실행합니다. 생성 상태를
자동으로 확인하고, 완료된 GLB를 Railway PostgreSQL에 저장한 다음 3D 뷰어에
표시합니다. 작업과 파일은 로그인한 사용자에게 귀속되며 다른 사용자는 조회하거나
다운로드할 수 없습니다. API 키는 서버 라우트에서만 사용되며 브라우저로 전달되지
않습니다. 현재 GLB 저장 한도는 파일당 25MB입니다.

## 구조

- `app/page.tsx` — 화면 전환 (시작 → 커스터마이징 → 대화)
- `app/meshy/page.tsx` — Meshy Image to 3D 생성 및 GLB 미리보기
- `app/assets/page.tsx` — 로그인한 사용자의 저장된 3D 에셋
- `app/api/auth/` — Better Auth 로그인/회원가입/세션
- `app/api/meshy/` — Meshy 작업 생성/상태 조회/GLB 저장 (API 키·소유권 보호)
- `migrations/` — Better Auth와 3D 에셋 PostgreSQL 스키마
- `components/PetModel.tsx` — 기본 도형 조합 로우폴리 강아지/고양이. 향후 실제 GLB 모델로 교체하려면 이 컴포넌트만 갈아끼우면 됨 (커스터마이징 상태는 `lib/store.ts`의 zustand 스토어에서 읽음)
- `components/SceneCanvas.tsx` — R3F Canvas, 조명, 드래그 회전(OrbitControls)
- `app/api/chat/route.ts` — Claude API 호출 (시스템 프롬프트 포함)
- `lib/store.ts` — 커스터마이징/화면 상태 (zustand)

## Vercel 배포

Vercel 프로젝트에 `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`MESHY_API_KEY`를 추가하세요. `BETTER_AUTH_URL`은 실제 프로덕션 URL
(예: `https://liveon.example.com`)이어야 합니다. 채팅 API를 사용할 경우
`ANTHROPIC_API_KEY`도 추가합니다. 배포 전에 Railway DB에 대해
`npm run db:migrate`를 한 번 실행해야 합니다.
