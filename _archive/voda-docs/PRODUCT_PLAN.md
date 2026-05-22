# Voda 서비스화 제품 계획서

> 작성일: 2026-03-29
> 최종 업데이트: 2026-04-27 (perf pass: 페이지 깜빡임/버퍼링 완화 — Material Icons FOIT, auth loading state, in-memory QueryCache)
> 현재 상태: Phase 1~7 + 8-1, 8-3 구현 완료 / 8-2 스켈레톤 배포 (Stripe 키 대기) / 8-4 경량 구현 (어드민 UI 는 추후) / 9-7 워터마크 1차 완료 / 10-7 예산 1차 완료 / 9-2 Empty Room 토글 1차 완료 / 9-8 쇼핑 검색 URL 1차 완료 / 9-3 부분 편집 (의미론적 마스킹 + lineage UI) 1차 완료 / 10-6 AI 챗 어드바이저 1차 완료 / 10-5 Before/After 슬라이더 / 10-2+10-3 팔로우·프로필 / 9-5 외관·정원 모드 1차 완료 (2026-04-26) / **10-1+10-4 통합 — 북마크가 컬렉션으로 흡수 (2026-04-27, 옵션 B)** / Sprint 4 + Post-launch 차별화 종료 / **9-4 Paint 매칭 UI 노출 제거 (2026-04-27, 서비스는 보존) / 9-1 Room Type 선택 제거 (layout drift)**
> 목표: 본격적인 앱 서비스로 출시

---

## 현재 앱 개요

사용자가 방 사진을 업로드하면 AI(Google Gemini)가 원하는 스타일로 인테리어를 분석하고 재디자인된 이미지를 생성해주는 서비스.

**현재 플로우**: 사진 업로드 → 스타일 선택 → AI 생성 → Before/After 결과 확인

**기술 스택**: React + Vite / Firebase (Auth, Firestore, Storage, Functions) / Google Gemini API

---

## 핵심 원칙

- 로그인 없이도 현재 플로우 그대로 사용 가능 (게스트 모드 유지)
- 현재 깔끔한 디자인 컨셉 그대로 유지
- 로그인 시 결과 저장 및 관리 기능 추가

---

## 스타일 선택 + 커스텀 조합 방식

**결론: 프리셋 스타일 선택 후 "추가 요청 사항" 입력창을 선택적으로 제공**

```
[ IKEA 스타일 선택 ]
  └─ "추가 요청 사항 (선택)" 입력창 등장
       예: "파란 소파 추가, 원목 식탁으로"
```

- 프리셋 스타일 선택 → 하단에 추가 요청 텍스트박스 (optional)
- 커스텀 선택 시엔 기존처럼 전체 직접 입력
- 스타일 카드의 깔끔한 UI 유지하면서 세부 조정 가능

---

## Phase 1 — 핵심 기능 개선

> 로그인 없이도 동작하는 기능들

### 1-1. 다중 사진 지원 (최대 3장)

- 사진 업로드 슬롯 3개 제공
- 드래그앤드롭 / 카메라 촬영 각각 지원
- 각 사진별 미리보기 및 개별 삭제 가능
- AI에게 3장을 모두 전달하여 공간 전체를 반영한 디자인 생성

### 1-2. 이미지 압축 및 포맷 처리

- 업로드 전 자동 압축 (현재 1장 기준 로직 → 3장으로 확장)
- Gemini API 허용 포맷 지원: JPEG, PNG, WebP, HEIC
- 파일 크기 초과 시 자동 압축 후 전송
- 각 이미지 최대 10MB, 압축 후 4MB 이하로 조정

### 1-3. 스타일 확장

**기존 6개**
- Modern, Scandinavian, Industrial, Classic, Vintage, Bohemian

**신규 추가**
- IKEA (실용적이고 깔끔한 북유럽 기반 접근형 디자인)
- Japandi (일본 미니멀 + 스칸디나비안의 조합)
- Coastal / Hamptons (밝고 시원한 해안 리조트 스타일)
- Maximalist (풍성한 레이어링, 대담한 패턴과 색상)
- Art Deco (기하학적 패턴, 골드/블랙 포인트)
- Mid-Century Modern (1950-60년대 레트로 현대 디자인)

**총 12개 스타일 + 커스텀**

### 1-4. 스타일 + 추가 요청 콤보

- 프리셋 스타일 선택 시 "추가 요청 사항" 텍스트박스 선택적 표시
- 커스텀 선택 시에는 기존 방식 유지 (전체 직접 입력)
- 추가 요청과 스타일 둘 다 AI 프롬프트에 반영

### 1-5. 커스텀 스타일 히스토리 (로컬)

- 이전에 입력한 커스텀 텍스트를 로컬스토리지에 최대 10개 저장
- 스타일 선택 화면에서 드롭다운으로 과거 커스텀 입력 재사용 가능
- 로그인 없이도 기기 내에서 동작

---

## Phase 2 — 인증 & 저장

> 로그인 기능 도입 및 결과 관리

### 2-1. 게스트 → 계정 전환

- 현재 익명 auth(anonymous) 방식 유지
- 로그인 시 기존 익명 세션 데이터를 계정으로 마이그레이션
- "로그인하면 결과를 저장할 수 있어요" 유도 배너 (결과 화면에서)

### 2-2. 소셜 로그인

- Google 로그인 (Firebase Auth)
- Apple 로그인 (iOS 대응)
- 이메일/비밀번호는 우선 제외 (소셜 로그인만으로 충분)

### 2-3. 결과 자동 저장

로그인 사용자의 경우 결과 생성 시 자동 저장:
- Before 이미지 URL (Firebase Storage)
- After 이미지 URL (Firebase Storage)
- 사용한 스타일 (프리셋 이름 or "custom")
- 사용한 커스텀 커맨드 전체 텍스트
- 추가 요청 사항 텍스트
- AI 분석 결과 전체 (spaceAnalysis, colorPalette, furnitureRecommendations 등)
- 생성 일시

### 2-4. 마이 디자인 목록

- 썸네일 그리드 형태 (After 이미지 기준)
- 카드에 스타일명, 날짜 표시
- 스타일별 필터, 날짜 정렬
- 무한 스크롤 (페이지네이션)

### 2-5. 디자인 상세 보기

저장된 결과를 그대로 재현:
- Before / After 비교
- 사용한 스타일 + 커맨드 표시 (재사용 가능하도록)
- 컬러 팔레트, 가구 추천, 조명 플랜 등 분석 내용 전체
- "이 커맨드로 다시 해보기" 버튼 (다른 사진에 같은 스타일 적용)

### 2-6. 디자인 관리

- 개별 삭제
- 즐겨찾기 (북마크)
- 이름 지정 (예: "거실 리모델링 1안")
- 즐겨찾기 필터 보기

### 2-7. 커스텀 스타일 저장 (계정 연동)

- 자주 쓰는 커스텀 스타일을 계정에 저장
- 기기 간 동기화
- 스타일 선택 화면에서 "저장된 커스텀" 드롭다운 섹션으로 제공
- 이름 지정 가능 (예: "내 거실 취향", "미니멀 화이트")

---

## Phase 3 — 공유

> 결과물을 다른 사람과 공유

### 3-1. 링크 공유

- 결과 페이지 고유 URL 생성
- 공개/비공개 설정 가능
- 링크로 접근 시 Before/After + 분석 내용 확인 가능 (읽기 전용)

### 3-2. SNS 공유

- Web Share API 활용 (모바일 기본 공유 시트 트리거)
- 카카오톡, 인스타그램, 트위터/X, 기타 앱으로 공유
- 공유 시 After 이미지 + 링크 포함

### 3-3. 이미지 다운로드

- After 이미지 단독 다운로드
- Before + After 합성 이미지 다운로드 (옵션)

### 3-4. 클립보드 복사

- 공유 링크 복사 버튼
- 복사 완료 피드백 ("링크가 복사되었어요")

---

## Phase 4 — 완성도 & UX 개선

### 4-1. 헤더 & 네비게이션

- 로고 (좌측), 로그인/프로필 버튼 (우측)
- 로그인 상태: 프로필 아이콘 → 마이 디자인, 로그아웃
- 비로그인 상태: "로그인" 버튼

### 4-2. 온보딩

- 첫 방문자용 간단한 사용법 안내 (3단계 슬라이드)
- 로컬스토리지로 재방문 시 스킵

### 4-3. 에러 UX 개선

- 실패 시 재시도 버튼
- 부분 실패 안내 (이미지 생성만 실패한 경우 텍스트 분석 결과는 표시)
- 네트워크 오류 vs AI 오류 구분 안내

### 4-4. 모바일 최적화

- 3장 업로드 UI 모바일 레이아웃 최적화
- 공유 시트 모바일 대응
- 마이 디자인 목록 모바일 그리드

---

## 구현 순서 (권장)

```
Phase 1
  ├─ 1-1 다중 사진 지원 (3장)
  ├─ 1-2 이미지 압축 및 포맷
  ├─ 1-3 스타일 확장 (12개)
  ├─ 1-4 스타일 + 추가 요청 콤보
  └─ 1-5 커스텀 스타일 로컬 히스토리

Phase 2
  ├─ 2-1 게스트 → 계정 전환
  ├─ 2-2 소셜 로그인 (Google, Apple)
  ├─ 2-3 결과 자동 저장
  ├─ 2-4 마이 디자인 목록
  ├─ 2-5 디자인 상세 보기
  ├─ 2-6 디자인 관리 (삭제, 즐겨찾기, 이름)
  └─ 2-7 커스텀 스타일 계정 저장

Phase 3
  ├─ 3-1 링크 공유
  ├─ 3-2 SNS 공유
  ├─ 3-3 이미지 다운로드
  └─ 3-4 클립보드 복사

Phase 4
  ├─ 4-1 헤더 & 네비게이션
  ├─ 4-2 온보딩
  ├─ 4-3 에러 UX 개선
  └─ 4-4 모바일 최적화

Phase 5 (다국어 지원)
  ├─ 5-1 언어팩 구조 설계 및 영어 기본팩
  ├─ 5-2 한국어 팩
  ├─ 5-3 일본어, 중국어 팩
  ├─ 5-4 언어 선택 UI (헤더 드롭다운)
  └─ 5-5 추가 언어 확장
```

---

## 데이터 구조 변경 계획

### Firestore: `designs` 컬렉션 확장

```
designs/{designId}
  - userId: string
  - name: string | null          // 사용자 지정 이름
  - isFavorite: boolean
  - style: string                // 'modern' | 'ikea' | 'custom' | ...
  - customStyleInput: string | null
  - additionalRequest: string | null  // 추가 요청 사항 (NEW)
  - originalImageUrls: string[]  // 최대 3장
  - generatedImageUrls: string[] // AI 생성 이미지 (사진별)
  - isPublic: boolean            // 링크 공유 여부
  - spaceAnalysis: string
  - styleDescription: string
  - colorPalette: string[]
  - furnitureRecommendations: object[]
  - decorativeElements: object[]
  - lightingPlan: string
  - estimatedCost: string
  - tips: string[]
  - timestamp: timestamp
```

### Firestore: `users` 컬렉션 신규

```
users/{userId}
  - displayName: string
  - email: string | null
  - photoURL: string | null
  - provider: 'google' | 'apple' | 'anonymous'
  - createdAt: timestamp
  - savedCustomStyles: [         // 저장된 커스텀 스타일 목록
      { id, name, text, createdAt }
    ]
```

---

## Phase 5 — 다국어 지원

> bullet_hell_game의 언어팩 구조를 참고하여 구현

### 아키텍처

```
src/
  locales/
    en.js    ← 기본 언어 (모든 키의 source of truth)
    ko.js
    ja.js
    zh.js
    es.js
    fr.js
    ...
  hooks/
    useLocale.jsx  ← 언어 상태 관리 (Context + localStorage)
```

### 언어팩 구조 (`en.js` 예시)

```javascript
// src/locales/en.js
export const en = {
  // Upload step
  uploadTitle: 'Upload room photos',
  uploadHint: 'Click or drag images here · JPEG, PNG, WebP',
  uploadOr: 'or',
  takePhoto: 'Take Photo',
  yourPhotos: 'Your room photos',
  addPhoto: 'Add photo',
  photoCount1: 'Add up to 2 more photos of the same room for better results',
  photoCount2: 'Add 1 more photo for the best multi-angle result',
  photoCount3: '3 photos selected — great coverage!',
  continue: 'Continue',

  // Style step
  chooseStyle: 'Choose a design style',
  additionalRequests: 'Additional requests',
  additionalRequestsOptional: '(optional)',
  describeCustomStyle: 'Describe your custom style',
  reuseStyle: '— Reuse a past style —',
  generateDesign: 'Generate Design',
  back: 'Back',

  // Generate step
  generating1: 'AI is generating your interior design…',
  generatingN: (n) => `AI is generating ${n} consistent designs for your room…`,

  // Result step
  originalLabel: 'Original',
  aiDesignLabel: 'AI Design',
  photoLabel: (n) => `Photo ${n}`,
  analysisTitle: 'Interior Design Analysis',
  spaceAnalysis: 'Space Analysis',
  styleDescription: 'Style Description',
  colorPalette: 'Color Palette',
  furnitureRecommendations: 'Furniture Recommendations',
  lightingPlan: 'Lighting Plan',
  designTips: 'Design Tips',
  startNew: 'Start New Design',

  // Errors
  errorCustomStyle: 'Please describe your custom style.',
  errorGenFailed: 'Failed to generate design. Please try again.',
  errorInvalidFile: 'Unsupported file type. Please upload a JPEG, PNG, or WebP image.',
  errorFileSize: 'File is too large. Please upload an image under 20MB.',

  // Styles
  styles: {
    modern:     { name: 'Modern',            description: 'Clean lines, neutral tones, minimalist contemporary' },
    scandinavian:{ name: 'Scandinavian',     description: 'Bright, natural materials, cozy Nordic warmth' },
    ikea:       { name: 'IKEA',              description: 'Functional, affordable, smart Scandinavian everyday design' },
    japandi:    { name: 'Japandi',           description: 'Japanese minimalism meets Scandinavian warmth' },
    industrial: { name: 'Industrial',        description: 'Raw materials, exposed elements, urban loft aesthetic' },
    coastal:    { name: 'Coastal',           description: 'Breezy, light-filled beach house elegance' },
    classic:    { name: 'Classic',           description: 'Timeless elegance, rich fabrics, ornate details' },
    artdeco:    { name: 'Art Deco',          description: 'Bold geometry, gold accents, glamorous 1920s opulence' },
    midcentury: { name: 'Mid-Century Modern',description: 'Organic shapes, warm wood, 1950–60s retro-modern charm' },
    maximalist: { name: 'Maximalist',        description: 'Bold patterns, rich layers, more-is-more philosophy' },
    vintage:    { name: 'Vintage',           description: 'Nostalgic charm, antique finds, warm retro palette' },
    bohemian:   { name: 'Bohemian',          description: 'Free-spirited, colorful textiles, artistic eclecticism' },
    custom:     { name: 'Custom Style',      description: 'Describe your own unique interior vision' },
  }
};
```

### 지원 언어 목록 (우선순위 순)

| 우선순위 | 코드 | 언어 | 비고 |
|---------|------|------|------|
| 1 | `en` | English | 기본값 |
| 2 | `ko` | 한국어 | |
| 3 | `ja` | 日本語 | |
| 4 | `zh` | 中文 (简体) | |
| 5 | `es` | Español | |
| 6 | `fr` | Français | |
| 7 | `de` | Deutsch | |
| 8 | `pt` | Português | |

### 구현 방식

- React Context (`LocaleContext`) + `useLocale()` 훅으로 전체 앱에 언어 공급
- 선택된 언어는 `localStorage`에 저장 (재방문 시 유지)
- 브라우저 언어 자동 감지 (`navigator.language`) → 지원 언어면 자동 적용, 없으면 영어
- 언어 선택 UI: 헤더 우측 드롭다운 (Phase 4 헤더와 함께 구현)
- 번역 누락 시 영어 fallback 자동 적용
- Gemini에 보내는 분석 prompt는 선택된 언어로 응답 요청 (`Respond in ${lang}`)

---

---

## Phase 6 — 커뮤니티 피드 & 디스커버리

> 공개된 결과물을 중심으로 한 영감 피드 — 메인 화면이 단순 업로드 도구에서 디자인 쇼케이스로 진화

### 핵심 컨셉

- 공개(isPublic) 설정한 디자인이 메인 화면 피드에 노출
- 다른 사람의 결과물을 보면서 어떤 스타일/커맨드를 썼는지 확인 가능
- 마음에 드는 스타일 세팅을 원클릭으로 가져다 쓸 수 있음
- "이 커맨드로 비슷하게 만들어보기" → 자연스러운 바이럴 루프 형성

---

### 6-1. 메인 페이지 피드

```
[ 업로드 영역 ]

─────────────────────────────
  Community Designs           ← 섹션 헤더
  [All] [Modern] [Japandi] [Coastal] ...  ← 스타일 필터 탭
─────────────────────────────

[ 카드 ] [ 카드 ] [ 카드 ]
[ 카드 ] [ 카드 ] [ 카드 ]
         [ Load More ]
```

- 업로드 영역 아래 피드 섹션 배치
- 최신순 기본 정렬, 스타일 탭 필터
- 로그인 없이도 피드 열람 가능
- 초기 로드 9~12장, Load More로 추가 로딩

### 6-2. 피드 카드 디자인

- After 이미지 썸네일 (메인)
- hover / 탭 시 Before 이미지로 전환 (flip 효과)
- 스타일 태그 표시 (예: `Japandi`)
- 커스텀 스타일인 경우 커맨드 앞부분 미리보기 (예: `따뜻한 원목 톤의...`)
- 좋아요 수
- 클릭 시 공유 뷰(`/s/:id`)로 이동

### 6-3. 공유 뷰 내 커맨드 공개

- 기존 `/s/:id` 공유 뷰에 "이 스타일 써보기" CTA 강화
- 사용된 스타일명 + 커스텀 설명 + 추가 요청 전체 표시
- "이 스타일로 내 공간 디자인하기" 버튼 → 해당 세팅이 프리필된 업로드 화면으로 이동
- 방문자가 스타일 세팅을 그대로 복사해서 자기 사진에 적용 가능

### 6-4. 좋아요 (Likes)

- 피드 카드 및 공유 뷰에서 좋아요 버튼
- 로그인한 유저만 좋아요 가능 (비로그인 시 로그인 유도 토스트)
- 좋아요 수 Firestore에 저장 (`likeCount`)
- 좋아요 많은 순 정렬 옵션 추가

### 6-5. 피드 정렬 & 필터

| 정렬 | 설명 |
|------|------|
| 최신순 | 기본값 |
| 인기순 | likeCount 내림차순 |

| 필터 | 설명 |
|------|------|
| 스타일 탭 | 전체 / 각 스타일별 |
| 커스텀만 | 커스텀 커맨드 사용한 결과만 |

### 6-6. 내 디자인 공개 유도

- 결과 페이지 및 디자인 상세에서 공개 전환 시 "피드에 노출돼요" 문구 추가
- 공개 디자인 수가 많을수록 피드 풍성해짐 → 자연스러운 공개 유도

---

### 공개 범위 구분

링크 공유와 피드 노출은 별개로 제어:

| isPublic | isListed | 의미 |
|----------|----------|------|
| false    | false    | 비공개 — 나만 볼 수 있음 (기본값) |
| true     | false    | 링크 공유 — 링크 아는 사람만 볼 수 있음 |
| true     | true     | 피드 공개 — 링크 공유 + 커뮤니티 피드 노출 |

공유 패널 UI:
```
[ 📢 커뮤니티 피드 ] [토글 ON/OFF]
  피드에서 모두에게 노출돼요 (ON 시 링크 공유도 자동 활성화)

[ 🔗 공개 링크     ] [토글 ON/OFF]
  링크 아는 사람만 볼 수 있어요 (OFF 시 피드 노출도 자동 비활성화)
```

### 데이터 구조 추가

```
designs/{designId}
  + isListed: boolean          // 피드 노출 여부 (신규, 기본값 false)
  + likeCount: number          // 좋아요 수 (신규)
  + likedBy: string[]          // 좋아요 누른 userId 목록 (중복 방지용, 신규)
  + caption: string            // 피드 게시 시 한 줄 글 (선택, ≤ 280자) — Phase 10 후속
```

캡션 모더레이션 — `onCaptionChanged` Firestore 트리거가 `moderation.js` 의
`checkCustomCommand` BLOCKLIST 를 재사용. 차단 시 caption='', moderationFlag='auto_caption'.

Firestore 규칙 추가:
- `isListed` 업데이트는 오너만 가능
- `likeCount`, `likedBy` 업데이트는 인증된 유저라면 누구나 가능 (좋아요 기능)
- 단, `likedBy`에서 자기 uid 추가/제거만 허용 (타인 조작 방지)

---

### 구현 순서

```
Phase 6
  ├─ 6-1 메인 피드 UI (공개 디자인 그리드 + 스타일 필터)
  ├─ 6-2 피드 카드 (Before/After flip, 스타일 태그, 커맨드 미리보기)
  ├─ 6-3 공유 뷰 커맨드 공개 + 이 스타일 써보기 CTA
  ├─ 6-4 좋아요 기능
  └─ 6-5 인기순 정렬
```

---

## Phase 7 — 서비스 운영 기반

### 7-1. Google Analytics (GA4) 커스텀 이벤트

Firebase Analytics가 GA4와 연결돼 있고 초기화는 완료된 상태. 현재는 페이지뷰만 자동 수집 중.
`logEvent(analytics, ...)` 호출을 주요 액션에 추가해서 의미 있는 데이터를 볼 수 있도록 확장.

추적할 이벤트:
| 이벤트 | 파라미터 | 의미 |
|--------|----------|------|
| `photo_uploaded` | `photo_count` | 사진 업로드 완료 |
| `style_selected` | `style` | 스타일 선택 |
| `design_generated` | `style`, `photo_count` | 생성 성공 |
| `design_failed` | `error_type` | 생성 실패 (AI오류 / 네트워크 등) |
| `invalid_space_rejected` | — | 부적절한 이미지 거부됨 |
| `design_saved` | `style` | Firestore 저장 완료 |
| `design_shared` | — | 공유 링크 생성 |
| `feed_card_clicked` | `style` | 피드 카드 클릭 |
| `style_reused` | `style` | 이전 스타일 재사용 |
| `sign_in_completed` | `provider` | 로그인 완료 |

GA4 대시보드에서 보고 싶은 것: 스타일별 인기도, 업로드→생성 전환율, 거부 비율, 공유 전환율.

### 7-2. 에러 모니터링 (Firebase 네이티브)

**Cloud Functions 에러**: GCP에 자동 수집되므로 Cloud Error Reporting에서 바로 확인 가능.

**클라이언트 에러**: 기존 `AIService.logError()`로 Firestore `errorLogs`에 쌓고 있음.
- Firebase Console → Functions → 로그에서 서버 에러 확인
- Firestore `errorLogs` 컬렉션에 임계치 쿼리 or Firebase Extensions으로 알림 설정 검토
- 추가로 `window.onerror` / `unhandledrejection` 글로벌 핸들러에서 주요 에러를 `logError`로 전송

### 7-3. 이용약관 / 개인정보처리방침

Footer 없이 두 곳에 배치:
1. **로그인 모달 하단** — "By signing in, you agree to our Terms of Service and Privacy Policy" 한 줄 링크 (법적 동의 근거)
2. **계정 드롭다운 메뉴** — 로그인 후 프로필 메뉴에 Terms / Privacy 링크 항목 추가

---

## 후순위 (사용자 규모 확대 시)

- **사용량 제한 / 비용 관리**: 게스트 n회 제한, 로그인 유저 일일 n회, 유료 플랜 검토
- **콘텐츠 모더레이션**: 커뮤니티 피드 부적절 이미지 신고 및 자동 필터링

---

## Phase 8 — 수익화 & 앱 출시 인프라

> **전제**: 현재 Gemini 3 Pro Image 호출당 비용이 크기 때문에 무제한 무료로 두면 사용자가 늘수록 적자가 커짐. 출시 **전** 반드시 필요한 항목.

### 8-1. 크레딧 시스템 ✅ 구현 완료 (2026-04-21)

> 배포됨: `initializeUser` endpoint + `generateDesign` 차감/환불, Firestore 규칙, 클라 `credits-service.js` / `CreditModal.jsx`, 헤더 뱃지. 결제/초대 플로우(8-2, 10-6)는 모달에 "Coming soon" 스텁으로만 노출.

#### 기능 개요
- 모든 AI 생성은 크레딧을 소비
- 1 디자인 생성 = 1 크레딧 (photo_count 무관, flat)
- 크레딧이 0이면 Generate 클릭 시 → `CreditModal` 오픈

#### 크레딧 지급 규칙
| 상황 | 지급 크레딧 |
|------|-------------|
| 최초 게스트 방문 | 2 (체험용) |
| 로그인 완료 | +3 (최초 1회) |
| 매일 로그인 | +1 (로그인 유저, 최대 충전량 10) |
| 친구 초대 성공 | +5 (초대자), +3 (피초대자) |
| 구독 결제 | 플랜별 지급 (아래 8-2 참고) |
| 크레딧 팩 구매 | 구매량만큼 |

#### 데이터 구조 (`users/{userId}` 확장)
```
users/{userId}
  + credits: number              // 현재 보유 크레딧
  + lifetimeCredits: number      // 누적 지급 크레딧 (통계용)
  + lastDailyBonusAt: timestamp  // 일일 로그인 보너스 기준
  + referralCode: string         // 예: "VODA-XJ92"
  + referredBy: string | null    // 초대자 userId
```

게스트는 `localStorage`에 `voda_guest_credits` 저장 → 로그인 시 계정으로 이관 (서버에서 최대 2개까지 cap, `initializeUser`가 `isFirstInit=true` 응답을 돌려준 경우에만 클라가 localStorage를 비움 — 실패 시 손실 방지).

#### Firestore 원자적 차감
크레딧 차감 레이스 컨디션 방지를 위해 **Cloud Function에서만** 차감:
```js
// functions/index.js
exports.generateDesign = onCall(async (req) => {
  const uid = req.auth?.uid;
  const userRef = db.doc(`users/${uid}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(userRef);
    const credits = snap.data().credits ?? 0;
    if (credits < 1) throw new HttpsError('failed-precondition', 'no-credits');
    tx.update(userRef, { credits: FieldValue.increment(-1) });
  });
  // … Gemini 호출, 실패 시 환불 로직
});
```
**실패 시 환불**: Gemini API가 에러 반환하거나 모든 이미지 생성이 실패하거나 `invalidSpace` 응답이면 `credits: +1` 트랜잭션으로 되돌림.

#### 인증 보안
`generateDesign`, `initializeUser` 모두 `Authorization: Bearer <Firebase ID token>` 헤더를 요구하고 서버에서 `admin.auth().verifyIdToken()`으로 검증. 기존엔 `req.body.context.auth.uid`를 그대로 신뢰하던 구멍이 있었음 — 8-1과 함께 수정.

#### UI
- 헤더에 크레딧 잔량 뱃지 (예: `⚡ 12`)
- 크레딧 0 상태에서 Generate 버튼 클릭 시 → 충전 모달
- 충전 모달: [크레딧 팩 구매] [Pro 구독하기] [친구 초대]

#### 구현 파일
- `src/services/credits-service.js` (신규) — 잔량 조회, 충전, 알림 훅
- `functions/index.js` — `generateDesign`에 차감 로직 주입
- `firestore.rules` — 클라이언트의 `users.credits` 직접 수정 금지 (서버 전용 필드)
- `src/components/Header.jsx` — 크레딧 뱃지
- `src/components/CreditModal.jsx` (신규)

---

### 8-2. 구독 & 결제 (Stripe + In-App Purchase) 🚧 스켈레톤 배포 (2026-04-21)

> UI(`/pricing`, `/account`), 클라이언트 서비스(`billing-service.js`), Cloud Functions 엔드포인트(`createCheckoutSession`, `createBillingPortalSession`, `stripeWebhook`)까지 구조가 프로덕션에 올라간 상태. 현재 Stripe 시크릿은 배포 파이프라인을 통과시키기 위한 placeholder 값이 들어가 있고, `getStripe()` 가드가 `sk_` 프리픽스를 체크해 엔드포인트는 `503 NOT_CONFIGURED` 로 응답. `src/config/billing.js` 의 `stripePriceId*` 가 `null` 이면 UI 버튼도 "Coming soon" 으로 표시. 실 키 + Price ID 반영 → 재배포로 즉시 활성화. 절차는 SETUP.md "Stripe 결제 (Phase 8-2)" 섹션.


#### 플랜 설계
| 플랜 | 가격 (월) | 크레딧/월 | 혜택 |
|------|-----------|-----------|------|
| Free | $0 | 5 | 워터마크, 1K 해상도 |
| Pro | $9.99 | 100 | 워터마크 제거, 4K, 피드 우선 노출 |
| Studio | $29.99 | 500 | + 상업적 이용, API 접근 (향후) |

- **연간 결제 40~50% 할인** (업계 표준)
- **3일 무료 트라이얼** (Pro만)

#### 추가로 판매할 크레딧 팩 (일회성)
| 팩 | 가격 | 크레딧 |
|----|------|--------|
| Starter | $4.99 | 20 |
| Standard | $14.99 | 80 |
| Pro Pack | $39.99 | 250 |

#### 플랫폼별 결제 경로
1. **웹 (Stripe Checkout)** — 데스크톱/모바일 웹 모두. **현재 스켈레톤은 이 경로만 구현됨**
2. **iOS (App Store In-App Purchase)** — 스토어 규정상 디지털 상품은 IAP 필수 → Phase 8-5에서 Capacitor 래퍼와 함께 추가
3. **Android (Google Play Billing)** — 동일 → Phase 8-5

> Capacitor 래퍼가 없는 지금은 iOS/Android 사용자도 모바일 Safari/Chrome으로 접속해 Stripe로 결제함 (PWA). 네이티브 앱 출시 시점(8-5)에 `platform-service.js`의 `isNativeApp()` 분기로 Pricing 페이지가 RevenueCat 경로로 전환되고, 앱 내부에서는 Stripe 버튼이 숨겨짐. 서버 측 `plan` / `credits` 업데이트 로직은 Stripe 웹훅과 RevenueCat 웹훅이 공유.

#### 구현 방법 (Stripe 기준)
- Firebase Extension: **"Run Payments with Stripe"** 설치 — 거의 무설정
- `products/{planId}/prices/{priceId}` 컬렉션 자동 생성
- 체크아웃 세션 생성 → Stripe 리디렉션 → 웹훅으로 `users/{uid}/subscriptions` 업데이트
- Cloud Function 웹훅에서 구독 활성화 시 크레딧 지급:
  ```js
  // users/{uid}.credits += plan.monthlyCredits
  // users/{uid}.plan = 'pro' | 'studio'
  // users/{uid}.subscriptionRenewsAt = period_end
  ```

#### IAP 연동 (나중에 네이티브 래퍼 시점)
- RevenueCat 사용 권장 — iOS/Android/Stripe 통합 관리
- Firebase Auth uid ↔ RevenueCat appUserID 매핑
- 웹훅으로 Firestore 동기화

#### 구현 파일
- `functions/stripe-webhook.js` (신규)
- `src/pages/Pricing.jsx` (신규) — 플랜 비교 테이블
- `src/pages/Account.jsx` (신규) — 구독 관리, 결제 내역, 취소
- `src/services/billing-service.js` (신규)

---

### 8-3. 프로모 코드 & 초대 시스템 ✅ 구현 완료 (2026-04-21)

> 배포됨: `redeemReferral` / `redeemPromo` Cloud Functions, `/invite` 페이지, 헤더·크레딧 모달 진입점, 프로모 코드 사용 장부. 어드민이 Firebase Console에서 `promoCodes/{code}` 문서를 만들면 즉시 활성화됨 (SETUP.md 참고).

#### 초대 링크
- 로그인 후 계정 메뉴에 "친구 초대하기" + 크레딧 모달에 동일 엔트리
- 초대 링크: `https://voda.app/?ref=VODA-XJ92` (4자 무모호 문자열, 0/O/1/I 제외)
- 모든 유저는 가입/초기화 시점에 `referralCode` 자동 발급 (`initializeUser` 트랜잭션이 `referralCodes/{code}` reverse-index도 함께 생성)
- 피초대자가 가입 완료 시 서버가 `redeemReferral`을 통해 인바이터 +5 / 인바이티 +3 크레딧 원자적 지급
- 중복/어뷰즈 방지: `referredBy`는 서버 전용 + write-once, 자기 자신 초대는 `SELF_REFERRAL`로 거부, 스태시한 코드는 터미널 실패 시 자동 삭제

#### 프로모 코드
- 어드민이 Firestore `promoCodes/{code}` 에 수동 생성
  ```
  promoCodes/LAUNCH2026
    credits: 10
    maxUses: 1000         // null 또는 생략하면 무제한
    usedCount: 0          // 서버 갱신
    expiresAt: Timestamp  // 선택
    perUserLimit: 1       // 통상 1
    note: "Launch giveaway"
  ```
- 사용자가 `/invite` 페이지에서 코드 입력 → `redeemPromo`가 만료/한도/중복 검증 → 크레딧 지급
- `promoCodeUses/{uid}_{code}` 로 중복 사용 차단 (perUserLimit 따름)
- 클라는 `promoCodes/{code}` 읽기 허용(로그인 필요) — 제출 전 크레딧 미리보기 가능. 쓰기는 서버 전용.

#### 구현 파일
- `functions/referral.js` — `assignReferralCode`, `redeemReferral`
- `functions/promo.js` — `redeemPromo`
- `functions/index.js` — `initializeAndApplyDaily`에 `referralCode` 자동 발급 훅
- `src/services/referral-service.js` — `?ref=` 캡처, 스태시, 사인인 직후 자동 리딤, `redeemPromo()`
- `src/pages/Invite.jsx` — 초대 링크 표시/복사/Web Share + 프로모 코드 입력 폼
- `firestore.rules` — `referralCode`/`referredBy` 서버 전용, `promoCodes` 읽기 허용·쓰기 금지, `referralCodes`/`promoCodeUses` 전면 서버 전용

---

### 8-4. 콘텐츠 모더레이션 ✅ 경량 구현 완료 (2026-04-23)

> 배포됨: `generateDesign` 커스텀 커맨드 blocklist 프리필터, `onDesignListed` 트리거 (피드 공개 시 Gemini SFW 판정 → 부적절 시 자동 unlist + `moderationFlag`), `onReportCreated` 트리거 (신고 수집 + 3건 누적 시 자동 unlist), ShareView 신고 모달, DesignDetail 오너 알림. 어드민 UI 는 트래픽이 붙은 뒤 추가 (현재는 Firebase Console 로 직접 처리).

#### ✅ 자동 필터 (생성 전) — 구현 완료
- `invalid_space_rejected` 로 실내가 아닌 이미지 거부 (기존)
- **커스텀 커맨드 blocklist** (`functions/moderation.js` `checkCustomCommand`): 명백한 선정/폭력/혐오 키워드 최소 목록을 `customStyleDescription` + `additionalRequest` 에 포함 여부 검사. 걸리면 `INVALID_CUSTOM_COMMAND` 400 반환, 크레딧 차감 이전에 차단.
- 참고: 이미지 자체의 선정성은 Gemini safety 레이어가 1차 차단, 본격 공개 전에는 아래 SFW 검증이 2차 필터.

#### ✅ 피드 공개 직전 필터 — 구현 완료
- `functions/moderation.js` `onDesignListed` — `designs/{id}` onUpdate 트리거
- `isListed` false→true 전환 감지 → 첫 번째 `generatedImageUrls` 다운로드 → Gemini 3 Flash 에 SAFE / UNSAFE 판정 요청
- UNSAFE 시: `isListed=false`, `moderationFlag='auto_sfw'`, `moderationReason` 기록
- 오너는 DesignDetail 의 공유 패널에서 자동 unlist 알림 확인 가능

#### ✅ 사용자 신고 시스템 — 수집 파트 구현 완료
- **ShareView** 상단 액션 바에 신고 아이콘 버튼 (로그인한 비소유자만 노출) → `ReportModal` (사유 선택 + 선택적 메모)
- Firestore `reports/{uid}_{designId}`:
  ```
  designId: string, reporterId: uid, reason: 'spam'|'nsfw'|'copyright'|'other',
  note?: string, createdAt: serverTimestamp
  ```
  - 복합키로 1인당 1건 강제 (재제출 시 update 룰이 막음)
  - 서버 전용 read (Firebase Console / Cloud Function 만 읽음)
- `onReportCreated` 트리거 — `designs/{id}.reportCount` 증가, 3건 이상 + `isListed=true` 면 자동 unlist + `moderationFlag='auto_reports'`

#### 구현 파일
- `functions/moderation.js` — 블록리스트 + `onDesignListed` + `onReportCreated`
- `functions/index.js` — `generateDesign` 내 `checkCustomCommand` 호출, 트리거 export
- `firestore.rules` — `reports/{id}` 룰 (create only, 서버 read), designs 모더레이션 필드는 기존 `hasOnly()` 로 자동 차단
- `src/components/ReportModal.jsx`, `src/pages/ShareView.jsx` (신고 진입), `src/pages/DesignDetail.jsx` (오너 알림)
- `src/services/design-service.js` — `submitReport`

#### ⏳ 후속 작업 (트래픽 붙은 뒤)
- **어드민 대시보드** `src/pages/Admin.jsx` — uid allowlist 보호, 대기 신고 목록, 디자인 강제 unlist/삭제 액션, 사용자 밴 기능. 현재는 Firebase Console 로 `reports` 컬렉션 확인 + 수동 조치.
- **FeedCard 신고 버튼** — 현재는 ShareView 에만 있음. 피드에서도 오버플로우(⋯) 메뉴로 신고 가능하도록.
- **오너에게 자동 unlist 알림 (이메일/푸시)** — 현재는 DesignDetail 을 열어야 확인 가능.
- **블록리스트 원격 관리** — 현재는 `moderation.js` 하드코딩. `adminConfig/blocklist` Firestore 문서로 핫리로드 가능하게.
- **신고 카운터 디바운싱** — 악의적 스팸 신고 방지 (현재는 복합키로 1인당 1건만 가능하지만 추가 IP 제한은 없음).
- **유저 얼굴/개인정보 탐지** — Gemini 에 별도 프롬프트 추가하거나 Cloud Vision API.

---

### 8-5. 앱 스토어 출시 준비

#### Sprint A — iOS 1차 출시 (Android 동시 빌드, 등록은 Sprint B)
1차 결정 (2026-04-29):
- 번들 ID `com.voda.app` 확정 (iOS + Android 공유)
- Apple Developer + Google Play Console 가입 완료
- 푸시는 Sprint C 로 분리 — 출시는 푸시 없이 진행

#### ✅ Sprint A 1+2단계 완료 (2026-04-29)
- `@capacitor/{core,cli,ios,android}@^8.3.1` 추가
- `npx cap init "Voda" "com.voda.app" --web-dir dist` → `capacitor.config.json` 커밋됨
- `npx cap add ios` / `npx cap add android` → `ios/` + `android/` 네이티브 프로젝트 생성, Gradle sync 통과 (CocoaPods 1.16.2 / Xcode / Android Studio / Java 21 모두 로컬 OK)
- npm 스크립트: `cap:sync`, `cap:open:ios`, `cap:open:android`
- `src/services/platform-service.js` 신규 — `isNativeApp()`, `getPlatform()`, `isIOS/isAndroid/isWeb`. 단일 분기점 (Stripe vs RevenueCat, 카메라 등). 아직 consumer 없음 (다음 단계에서 import).
- `.gitignore` 는 Capacitor 가 ios/ 와 android/ 안에 자동으로 생성한 것 사용 (Pods, build/, local.properties, 복사된 web assets 모두 ignore)

#### ✅ Sprint A 3단계 완료 (2026-04-29) — Sign in with Apple
- Apple Developer Console: App ID `com.voda.app` + Sign In with Apple capability, Service ID `com.voda.app.signin` (Domain `voda-7647c.firebaseapp.com`, Return URL `https://voda-7647c.firebaseapp.com/__/auth/handler`), Sign in with Apple Key 생성 (`AuthKey_G3Q44RRZ7R.p8`, Team ID `WG75TG59NJ`).
- Firebase Console > Authentication > Apple provider 활성화 + 서비스 ID + OAuth 코드 흐름 (Team ID / Key ID / .p8 내용) 입력.
- `@capacitor-community/apple-sign-in@^7.1.0` 추가, cap sync 완료.
- `auth-service.js`:
  - `OAuthProvider('apple.com')` + scopes (email + name)
  - `signInWithApple` — 네이티브 iOS 면 Capacitor 플러그인으로 identityToken 받아 `signInWithCredential`, 그 외(웹/안드로이드)는 `signInWithPopup` 폴백
  - 첫 로그인 시 Apple 이 한 번만 주는 displayName 캐치해서 `updateProfile` (이후 로그인엔 안 줌)
  - `_ensureUserDoc(user, provider)` — `users/{uid}.provider` 에 `'apple'` 또는 `'google'` 기록
- SignInModal — Google 버튼 아래 「Sign In with Apple」 버튼 (검정 배경 + 흰 로고, Apple HIG 준수). `onSignIn(provider)` 시그니처 분기.
- iOS 네이티브: `ios/App/App/App.entitlements` 신규 (`com.apple.developer.applesignin = ['Default']`), `CODE_SIGN_ENTITLEMENTS` 빌드 설정 Debug/Release 양쪽 등록.
- i18n: `signInApple` (en/ko).

#### 🔜 Sprint A 잔여 단계
- **4단계 — RevenueCat + iOS IAP** — 상품 정의 (월/연 구독 + 크레딧 팩), `users/{uid}` ↔ RevenueCat appUserID 매핑, 서버 웹훅으로 plan/credits 갱신 (기존 Stripe 웹훅과 같은 로직 공유), 앱 내 Stripe 버튼 숨김 (`isIOS()` 분기)
#### ✅ Sprint A 5단계 완료 (2026-04-29) — 네이티브 share / 다운로드
- `@capacitor/share@^8.0.1` + `@capacitor/filesystem@^8.1.2` 추가, cap sync 완료.
- `src/services/share-service.js` 신규 — 단일 진입점.
  - `shareLink({title,text,url})` — 네이티브면 Capacitor Share, 아니면 Web Share API + 클립보드 폴백
  - `shareOrDownloadImage({blob,filename,title,text})` — 네이티브면 Filesystem.writeFile (Cache 디렉토리) 후 Share.share 로 file URI 전달 (iOS share 시트의 「이미지 저장」 으로 사진앱 저장 가능). 웹에선 `<a download>` 링크 클릭.
- 콜사이트 통합:
  - `App.jsx` ResultStep `handleShare` → `shareLink`
  - `pages/DesignDetail.jsx` `handleNativeShare` → `shareLink`, `handleDownload` → `shareOrDownloadImage`
  - `pages/ShareView.jsx` → `shareLink`
  - `pages/CollectionPage.jsx` → `shareLink`
  - `pages/Invite.jsx` → `shareLink`
- `navigator.share` 가시성 게이트들 (`DesignDetail`, `Invite`) 을 `isNativeApp() || navigator.share` 로 확장 — 네이티브 앱에선 Web Share API 가 없어도 share 버튼이 나오도록
- iOS Info.plist:
  - `NSPhotoLibraryAddUsageDescription` — 「Save Image」 권한 (share 시트 → 이미지 저장)
  - `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription` — 후속 카메라 / 사진 선택 시 권한 (현재는 PWA file input 으로 처리되지만 네이티브 빌드 안전 차원)

#### 🔜 Sprint A 잔여 단계 (계속)
#### ✅ Sprint A 6단계 완료 (2026-04-29) — Universal Links (iOS)
- `@capacitor/app@^8.1.0` 추가 (URL open listener 용).
- `public/.well-known/apple-app-site-association` 신규 — `WG75TG59NJ.com.voda.app` 에 `/s/*`, `/c/*`, `/u/*`, `/designs/*` paths + webcredentials. Vite 가 dist/ 로 그대로 복사.
- `firebase.json`:
  - `headers` 추가 — `/.well-known/apple-app-site-association` 와 `/.well-known/assetlinks.json` (Android 추후) 에 `Content-Type: application/json` + 짧은 캐시
  - `ignore` 의 `**/.*` 패턴 제거 — `.well-known/` 가 ignore 되지 않도록
- `vite.config.js` — Workbox `navigateFallbackDenylist` 에 `/^\/\.well-known\//` 추가 (SW 가 Apple validator 응답을 SPA 셸로 가로채지 않도록)
- iOS `App.entitlements` — `com.apple.developer.associated-domains` 추가 (`applinks:voda-7647c.web.app`, `applinks:voda-7647c.firebaseapp.com`)
- `App.jsx > NativeUrlHandler` — Capacitor `App.appUrlOpen` 구독, 들어온 URL 의 path 만 추출해 react-router `navigate(path)`. `BrowserRouter` 안에서 `AuthRedirectHandler` 옆에 마운트.
- 배포 완료 — `curl https://voda-7647c.web.app/.well-known/apple-app-site-association` → 200, Content-Type: application/json 확인

#### 🔜 사용자 액션 필요 (Apple Developer Console)
- App ID `com.voda.app` 의 Capabilities 에서 ☑ **Associated Domains** 추가 (이미 켜져 있을 수도). Save → 「Modify App Capabilities」 confirm.
- 첫 빌드 시 entitlement 검증을 위해 iOS Apple ID 가 「Account Holder / Admin」 권한이어야 함
#### ✅ Sprint A 7단계 완료 (2026-04-29) — 스토어 자산 (placeholder 수준)
- `@capacitor/assets` 추가, `assets/icon-only.svg` + `icon-foreground.svg` + `icon-background.svg` + `splash.svg` 마스터 SVG 작성 (검정 배경 + 흰 「V」 letter — placeholder, 출시 전 디자이너 교체 필요).
- `npx capacitor-assets generate` 실행 → 65개 native asset 생성 (iOS 1024 마스터 + Splash imageset universal 1x/2x/3x; Android adaptive icons + splash 14 사이즈; PWA webp 7개는 manifest 가 이미 PNG 사용 중이라 제거).
- 기존 Capacitor default `splash-2732x2732*.png` 잔여 파일 정리.
- `ios/App/App/PrivacyInfo.xcprivacy` 신규 (iOS 17+ 필수):
  - NSPrivacyTracking: false (다른 앱 추적 안 함)
  - 수집 데이터: UserID / Email / Name / PhotosOrVideos / OtherUserContent / ProductInteraction / CrashData — 모두 App Functionality 또는 Analytics 목적, 사용자 계정과 연결 (Linked), tracking 없음
  - Required Reason API 선언: UserDefaults (CA92.1), FileTimestamp (C617.1), SystemBootTime (35F9.1), DiskSpace (E174.1) — Capacitor / WebKit / Firebase SDK 가 사용
- `PrivacyInfo.xcprivacy` 를 Xcode 프로젝트 (`pbxproj`) 의 PBXBuildFile / PBXFileReference / App 그룹 / Resources 빌드 페이즈 4곳에 등록 — 빌드 시 앱 번들에 포함되도록.
- `store-metadata.md` 신규 — 영문 + 한글 App Store / Play Store 메타데이터 초안 (이름, 부제목, 홍보 텍스트, 설명, 키워드, 카테고리, 연령 등급, 출시 체크리스트). App Store Connect / Play Console 입력 시 그대로 사용.
- **`BRANDING.md` 신규 (2026-05-05~06)** — 브랜드 가이드. **글로벌 단일 브랜드 `archelier`** (소문자, Architect + Atelier 합성어, 발음 아르셸리에). 모든 시장 디스플레이명 / 홈 화면 라벨 / 앱 내부 카피 통일. 한·일 ASO 보조 키워드 "공간담" / "空間師" 은 description / keywords 에만 보존. 후보 검토 기록(Voda·Roomify·Atelio·Atelyr·Studeo·Archeo 탈락 사유), 포지셔닝, 비주얼 가이드, 태그라인, App Store 첫 문단, 다음 액션 체크리스트 포함. 모든 마케팅 / 디자인 / 카피 의사결정의 출발점.

#### 🔜 출시 전 진짜 자산 교체 (디자이너 작업 필요)
- 1024×1024 마켓팅 아이콘 (현재 검정 + V placeholder)
- iPhone 6.7" 스크린샷 3-8장 (실제 앱 화면 캡처)
- App Preview 영상 (선택, 30초)
- 실제 Voda 로고 / 컬러 팔레트 확정
#### ⏳ Sprint A 8단계 진행중 (2026-04-29) — iOS 빌드 / TestFlight 준비
- App Store 정책 (외부 결제 안내 금지) 준수를 위해 iOS 네이티브 빌드에서 결제 UI 통째로 숨김:
  - `Header` — Pricing 메뉴 hide
  - `Account` — View plans / Change plan / Manage billing / Buy credit pack 버튼 hide
  - `CreditModal` — Pro / Credit pack 옵션 제거 (게스트 초대만 남김)
  - `DesignChat` — 챗 turn 소진 시 Upgrade 버튼 hide (메시지만 노출)
  - `Pricing` 페이지 — `useEffect` 로 iOS 진입 시 `/` 로 redirect, 즉시 null 반환
  - `errInsufficientCredits` 카피 — 「or get more credits」 제거, 「come back tomorrow」 만 남김 (한국어는 이미 적합)
- `IOS_BUILD_GUIDE.md` 신규 — Xcode 첫 빌드부터 TestFlight 내부 테스트까지 단계별 walkthrough + 실기 테스트 체크리스트 + 트러블슈팅
- `cap sync` 최종 통과 (4 plugins: apple-sign-in, app, filesystem, share)
- 코드 작업 완료. **사용자가 Xcode 에서 Archive → App Store Connect 업로드 → TestFlight 진행**.

#### 🔜 Sprint A 4단계 — RevenueCat IAP (TestFlight 동작 확인 후)
- RevenueCat 사용 결정 (월 매출 $2,500 까지 무료, 그 이후 1% — 가성비 OK)
- 상품 정의: Pro 월/연 구독, Studio 월/연 구독, 크레딧 팩
- Firebase uid ↔ RevenueCat appUserID 매핑
- 서버 웹훅으로 `users/{uid}.plan` / `credits` 갱신 (기존 Stripe 웹훅과 같은 로직 공유)
- iOS 네이티브 앱에 IAP 결제 버튼 노출 — Stripe 버튼은 그대로 hide

#### 선택지 (참고용 — 결정됨)
| 방식 | 장점 | 단점 |
|------|------|------|
| **Capacitor 네이티브 래퍼** ✅ | 기존 웹 코드 그대로 사용, 네이티브 API(푸시, IAP) 지원 | 설정/빌드 작업 필요 |
| TWA (Android Only) | 설정 간단 | iOS 불가, 스토어 정책 까다로움 |
| 완전한 네이티브 리빌드 (React Native) | 성능 최상 | 완전 재작성 |

#### 스토어 등록 자산
- **아이콘**: 1024×1024 (iOS), 512×512 (Play), 어댑티브 아이콘
- **스크린샷**: iPhone 6.7" / 5.5" / iPad 12.9" / Phone / Tablet — 각 3~8장
- **미리보기 영상** (선택, 30초)
- **스토어 설명**: 80자 요약 + 4000자 상세 (ASO 키워드 고려: "AI interior", "room design", "인테리어 AI")
- **개인정보처리방침 URL** (이미 `/privacy` 존재 ✅)
- **지원 URL / 연락처**

#### 심사 대응
- iOS: **Sign in with Apple 필수** (현재 Google 만 있음 → 추가 작업)
- **연령 등급**: 4+ 로 시작 (사용자 생성 콘텐츠 있으므로 12+ 가 안전)
- **IAP 외 결제 금지** 규정 — Stripe 웹 결제 버튼은 앱에서 숨기기

#### 구현 파일
- `capacitor.config.ts` (신규)
- `ios/`, `android/` 디렉토리 (생성됨)
- `src/services/platform-service.js` — `isNativeApp()` 분기로 Web/App 분기 처리

---

### 8-6. 푸시 알림

#### 알림 종류
| 이벤트 | 메시지 예시 | 타이밍 |
|--------|-------------|--------|
| 디자인 생성 완료 | "디자인이 준비됐어요! 확인해보세요" | 생성 완료 즉시 (생성 중 백그라운드로 돌린 경우) |
| 내 디자인 좋아요 | "OO님이 당신의 디자인을 좋아합니다" | 좋아요 발생 시 (하루 N건씩 배치) |
| 주간 피드 하이라이트 | "이번 주 인기 디자인 Top 5" | 주 1회 |
| 크레딧 충전 알림 | "매일 보너스 크레딧이 도착했어요" | 24h 미접속 시 |
| 구독 만료 임박 | "구독 갱신이 3일 남았어요" | D-3 |

#### 구현
- **웹**: Firebase Cloud Messaging + Service Worker (`firebase-messaging-sw.js`)
- **iOS/Android**: Capacitor Push Notifications → FCM 토큰 등록
- 사용자 설정 페이지에서 알림 카테고리별 on/off

#### 데이터 구조
```
users/{uid}/
  fcmTokens: [{ token, platform, updatedAt }]
  notificationPrefs: {
    designComplete: true,
    likes: true,
    weeklyDigest: true,
    creditReminders: true,
    billing: true
  }
```

#### 구현 파일
- `src/services/push-service.js`
- `public/firebase-messaging-sw.js`
- `functions/send-push.js` — 좋아요 onCreate 트리거 등
- `functions/weekly-digest.js` — pubsub 스케줄드 함수

---

## Phase 9 — 차별화 기능 (경쟁력 강화)

### 9-1. Room Type 선택 — ❌ 제거됨 (2026-04-25)

#### ❌ 제거 결정 — 2026-04-25
1차 구현 후 사용 시 두 가지 문제 발생:
1. **다용도 공간 (침실+주방, 거실+다이닝 등) 에 단일 type 강제** → AI 가 "그 방으로 변형" 시도 → **공간 자체를 새로 그려내는 layout drift 유발**
2. **사용자가 잘못 고를 때 비용** > 정확하게 고를 때 이득. Auto 선택자가 적어도 다수임이 관찰.

→ Auto 모드 (사진만 보고 추론) 가 사실상 동등 또는 더 나은 결과. UX 단계도 줄어 이탈 감소. 코드/UI/i18n/CSS/문서 전부 클린업. Firestore 의 기존 `roomType` 필드는 legacy 데이터에 남아있지만 새 디자인은 안 씀.

#### 원래 기능 (참고용)
업로드 후 스타일 선택 전에 **방 종류**를 먼저 선택 → AI 프롬프트에 반영.

| Room Type | 한국어 | 아이콘 |
|-----------|--------|--------|
| living_room | 거실 | 🛋️ |
| bedroom | 침실 | 🛏️ |
| kitchen | 주방 | 🍳 |
| bathroom | 욕실 | 🛁 |
| dining_room | 다이닝룸 | 🍽️ |
| home_office | 홈 오피스 | 💻 |
| kids_room | 아이방 | 🧸 |
| entryway | 현관 | 🚪 |
| outdoor | 야외 (Phase 9-5) | 🌿 |
| auto | 자동 감지 | ✨ |

#### UI
- 업로드 다음 단계: "이 공간은?" 아이콘 그리드 (2×4 + Auto)
- Auto 선택 시 Gemini Vision 으로 분류 후 해당 타입 프롬프트 적용
- 이후 스타일 선택 화면으로 이동

#### 프롬프트 영향
`functions/index.js` 의 프롬프트 조합:
```
You are redesigning a ${roomType} in ${style} style.
Preserve the existing architectural elements (windows, doors, walls, ceiling height, built-ins).
Provide ${roomType}-specific furniture recommendations only.
...
```

각 room type 별로 다른 furniture 카테고리 셋 제공 (예: kitchen은 상부장/하부장/아일랜드, bathroom은 세면대/샤워부스).

#### 데이터 구조
```
designs/{designId}
  + roomType: 'living_room' | 'bedroom' | ...
```
- `MyDesigns.jsx` 에 room type 필터 추가
- 피드에도 Room Type 탭 추가

#### 구현 파일
- `src/locales/en.js`, `ko.js` — roomType 키 추가
- `src/pages/Home.jsx` (또는 현재 업로드 플로우 파일) — Room Type 스텝 추가
- `functions/index.js` — 프롬프트 빌더에 roomType 주입
- `src/services/ai-service.js` — roomType을 generate 호출에 포함

#### ✅ 1차 구현 완료 (2026-04-24)
- `AIService.ROOM_TYPES` 상수 (`auto` + 8종: living/bed/kitchen/bath/dining/office/kids/entryway). 아이콘 생략, 텍스트 버튼 사용
- `AIService.generatePrompt` 에 `roomType` 파라미터 → `auto` 아닐 때 "This is a ${room}. Tailor furniture and layout..." 지침 주입
- App.jsx 플로우: upload → **roomType** → style → generate → result. `RoomTypeStep` 컴포넌트 추가, 기본값 `auto` 선택된 상태
- `designs/{id}.roomType` 필드 저장. `generateDesign` body 와 응답 `metadata.roomType` 에도 전달
- DesignDetail / ShareView 의 "스타일 정보" 패널에 룸타입 태그 노출 (auto 제외), Replay(재사용) 시 roomType carry
- GA: `room_type_selected`, `design_generated.room_type` 로깅
- Auto 모드는 별도 Gemini Vision 호출 없이 이미지 추론에 맡김 (절약)

#### 🔜 후속
- MyDesigns / CommunityFeed 에 Room Type 필터 탭

---

### 9-2. Empty Room / Virtual Staging

#### ✅ 1차 구현 완료 (2026-04-25)
- `DESIGN_MODES = ['redesign', 'staging']` (`src/services/ai-service.js`)
- 텍스트 분석 프롬프트 (`generatePrompt`) — `mode === 'staging'` 일 때 "treat space as empty, recommend furniture from zero" 노트 삽입.
- 이미지 생성 프롬프트 (`functions/index.js > buildImagePrompt`) — staging 일 때 기존 가구 제거 + 신규 풀세트 배치 지시. 마지막 문장도 mode 별로 분기 (`Stage this empty room with a complete new furniture set` vs 기본 `redecorating`).
- `generateDesign` / `saveDesign` / Cloud Function 시그니처에 `mode` 추가, `designs.mode` + `metadata.mode` 저장. 기본값 `redesign`.
- Room Type 스텝 하단에 "빈 방으로 시작" 체크박스 토글 1개. 별도 스텝 안 만듦.
- DesignDetail / ShareView 의 Style Used 패널에 staging 일 때만 mode tag 노출, 재사용 시 mode 도 전달.
- locales `emptyRoomToggle`, `emptyRoomHint`, `modes.{redesign,staging}`.
- GA `empty_room_toggled`, `design_generated.mode`.
- **자동 감지는 의도적으로 보류**. 비용보다 레이턴시·임계값 모호성·익명 게이트가 더 부담. 사용 데이터 보고 필요하면 후속.

#### 후속 (보류)
- Gemini Vision 자동 감지 + 제안 배너
- 거주 인원 / 라이프스타일 태그 (occupancy, lifestyle[])

#### 기능
빈 방 사진 업로드 시 "빈 방 가구 채우기 모드" 자동 제안 → 가구 0 에서 시작해 **완전히 새로 채움**.

#### 왜 중요한가
- 이사/부동산 수요 매우 큼 (Collov, VS AI 이 이것만으로 연매출 수백만 달러)
- 기존 "재디자인" 과 완전히 다른 프롬프트 필요

#### 검출
- Gemini Vision 으로 업로드 이미지의 가구 밀도 판정 → 빈 방이면 모드 제안 배너
- 수동으로도 "Empty Room" 토글 제공

#### 추가 옵션
- **예산 레벨**: Budget / Mid / Luxury (9-7 예산 슬라이더와 연결)
- **거주 인원**: 1인 / 커플 / 가족 / 공유
- **라이프스타일 태그**: WFH / 엔터테인 / 미니멀 / 반려동물

#### 프롬프트 변화
```
Generate a fully furnished ${roomType} in ${style} style.
Start from the existing empty space — preserve walls, floor, windows.
Add furniture suitable for ${lifestyle} and ${occupancy}, within ${budget} price tier.
List each piece with approximate price range.
```

#### 데이터 구조
```
designs/{designId}
  + mode: 'redesign' | 'staging'
  + stagingOptions?: { budget, occupancy, lifestyle[] }
```

#### 구현 파일
- `src/pages/Home.jsx` — 모드 토글 + 옵션 패널
- `functions/detect-empty-room.js` (옵션, 자동 제안용)
- `functions/index.js` — staging 모드 프롬프트 분기

---

### 9-3. Object / Furniture Replace (부분 편집)

> 가장 큰 차별화 포인트. RoomGPT 가 유료 상위 기능으로 제공.

#### ✅ 1차 구현 완료 (2026-04-25) — 의미론적 마스킹 (브러시 UI 없음)
**핵심 발견**: Gemini API 는 **별도 마스크 이미지 입력을 지원하지 않음**. 자연어 의미론적 마스킹 (「이 파란 소파만 빈티지 가죽 체스터필드로 바꿔줘. 나머지는 그대로」) 으로 동작. 브러시/박스 마스크 UI 불필요 → 1차 구현 단순화.

- `src/services/edit-prompt.js` — `buildEditPrompt(target, replacement)` 순수 함수, target/replacement 빈 입력 시 throw.
- `AIService.editDesignRegion({ sourceDesignId, photoIndex, target, replacement })` — Cloud Function 호출, 인증 토큰 첨부.
- 신규 Cloud Function `editDesignRegion` (`functions/index.js`):
  - 인증 + 익명 거부, 소유권 검증 (`design.userId === uid`), 모더레이션 prefilter, 레이트 리밋
  - 크레딧 1 차감 (실패 시 환불)
  - source 이미지 Storage URL fetch → base64 변환 → gemini-3-pro-image-preview 호출
  - 결과 이미지 base64 반환 (저장은 클라이언트가)
- `EditRegionModal` (신규 컴포넌트) — DesignDetail 의 각 generated image 옆에 「부분 편집」 버튼 (오너만), 클릭 시 모달 오픈. 두 텍스트 필드만 (target / replacement, 각 200자 제한).
- 결과 처리: 클라이언트가 base64 → Storage 업로드 → 새 디자인으로 saveDesign (sourceDesignId 추적 차원에서 additionalRequest 에 메모). 새 디자인 페이지로 navigate.
- locales `editRegion` 외 11개, GA `design_edited` / `design_edit_failed`.
- 유닛 테스트 6개 (`tests/edit-prompt.test.js`) — 템플릿 삽입, 보존 블록, 공백 트림, 빈 입력 throw, 순서.

#### 기능
생성된 결과 이미지에서 무엇을 무엇으로 바꿀지 텍스트로 명시 → AI 가 의미론적 마스킹으로 해당 부분만 교체.

#### UX 흐름
1. 결과 페이지에서 "편집하기" 버튼
2. 이미지 위에 브러시 / 박스 선택 도구 활성화
3. 사용자가 영역 마스크 그리기
4. 하단에 "무엇으로 바꿀까요?" 텍스트 입력
5. 생성 → 마스크 영역만 교체된 이미지 반환 (새 디자인으로 저장)

#### 기술 구현
Gemini 3 Pro Image 는 inpainting 을 지원 (원본 + 마스크 + 프롬프트). 없는 경우 Stable Diffusion Inpaint API 로 폴백.

```js
// functions/index.js
async function replaceObject(originalUrl, maskPngBase64, prompt) {
  const result = await gemini.generateContent({
    model: 'gemini-3-pro-image-preview',
    contents: [
      { inlineData: { mimeType: 'image/png', data: originalBase64 } },
      { inlineData: { mimeType: 'image/png', data: maskPngBase64 } },
      { text: `Replace only the masked area with: ${prompt}. Keep everything else identical.` }
    ]
  });
  return result.generatedImageUrl;
}
```

#### 프론트엔드 캔버스
- `<canvas>` 오버레이로 마스크 그리기 (HTML5 Canvas API)
- 라이브러리: `react-canvas-draw` 또는 직접 구현
- 마스크 export: `canvas.toDataURL('image/png')` → Cloud Function 전송

#### 비용
- 편집 1회 = 1 크레딧 (Pro 이상 한정 또는 모두 허용)

#### 구현 파일
- `src/components/InpaintEditor.jsx` (신규)
- `src/pages/DesignDetail.jsx` — "편집하기" CTA
- `functions/inpaint.js` (신규)

---

### 9-4. Paint & Material Explorer

#### ⚠️ 1차 구현 후 UI 노출 제거 (2026-04-27)
색상 swatch 아래 페인트 코드 pill 이 색상 팔레트 영역에서 「제품 추천」 처럼 보여 시각적으로 노이즈가 됨. **DesignDetail / ShareView / ResultStep 의 렌더링만 제거** — 서비스 (`src/services/paint-match.js`), 데이터 (`src/data/paint-colors.js`), 유닛 테스트 14개는 그대로 보존 (벽/바닥 inpainting 후속에서 재사용 예정).

#### ✅ 1차 구현 완료 (2026-04-25) — 색상 매칭만, 이미지 조작은 후속
- `src/data/paint-colors.js` — 큐레이션 시작 셋 (Sherwin-Williams 15 + Benjamin Moore 10 + KR 7개 = 32개). region 필드로 'kr' / 'intl' 구분.
- `src/services/paint-match.js` — `findNearestPaint(hex, lang)`. RGB 유클리드 거리로 가장 가까운 페인트 찾음. lang 'ko' 일 때 KR 브랜드 우선 (regional bias).
- ~~결과 페이지 / DesignDetail / ShareView 의 colorPalette 각 swatch 아래에 매칭 페인트 코드 pill 표시~~ — **2026-04-27 제거**.
- locales `paintMatch`, `paintCodeCopy`, `paintCodeCopied` 키는 남아있음 (사용 안 함).
- 유닛 테스트 14개 (`tests/paint-match.test.js`) — hex 파싱, RGB 거리, 정확 매칭, 근사 매칭, lang 기반 region 우선순위, 잘못된 입력 처리.

#### ⚠️ 데이터 출처 주의
- SW / BM 코드는 공식 카탈로그 기준. hex 값은 web swatch 근사값이라 실제 칠 (lighting 영향) 과 미세 차이 있음.
- KR 브랜드 (노루페인트, 삼화페인트, KCC) 코드/hex 는 **starter / illustrative**. 실제 카탈로그로 보강 필요.

#### 🔜 후속 (보류)
- 벽/바닥 영역 inpainting (9-3 와 함께 또는 그 이후) — 이때 paint-match 서비스를 「벽 색 바꾸기」 dedicated 모달에서 다시 사용
- 페인트 DB 확장 (현재 32개 → 200+, 실제 카탈로그 검증)
- 색상 mood 태그로 필터링 (warm / cool / neutral 등)

#### 원래 스펙 (참고용)
- 결과 이미지의 **벽/바닥 색**을 다른 색으로 시각화
- 실제 페인트 브랜드 색상 코드 제공 (한국: **던에드워드, 노루페인트, 삼화페인트** / 해외: Sherwin-Williams, Benjamin Moore)

#### UX
1. 결과 페이지에서 "페인트 바꾸기" 버튼
2. 색상 팔레트(사전 정의 100색) + 브랜드 필터
3. 벽 선택 → 해당 색상 오버레이 (inpainting with solid fill)
4. 선택 후 "Sherwin-Williams SW 7008 Alabaster" 같은 코드 표시 → 복사 버튼

#### 데이터
`src/data/paint-colors.json` — 수동 큐레이션
```json
[
  {
    "id": "sw-7008",
    "brand": "Sherwin-Williams",
    "name": "Alabaster",
    "hex": "#EDEAE0",
    "code": "SW 7008",
    "mood": ["warm", "neutral"]
  },
  ...
]
```

#### 기술
- 가벼운 색상 교체: 벽 세그멘테이션 (Gemini Vision 으로 벽 마스크 생성) → CSS blend 또는 inpaint
- 무거운 구현: 9-3 의 inpainting 재사용

#### 구현 파일
- `src/pages/PaintExplorer.jsx` 또는 `src/components/PaintSwatchPanel.jsx`
- `src/data/paint-colors.json`
- `functions/generate-wall-mask.js`

---

### 9-5. Exterior / Garden 모드

#### ✅ 1차 구현 완료 (2026-04-26)
- `SPACE_CATEGORIES = ['interior', 'exterior', 'garden']` (`src/services/ai-service.js`). 기본 `interior`.
- 새 스타일 셋: `EXTERIOR_STYLES` 6종 (Modern Facade / Modern Farmhouse / Mediterranean / Craftsman / Contemporary / Minimalist Exterior), `GARDEN_STYLES` 5종 (Zen / Cottage / Desert / Tropical / English).
- `SEASON_OPTIONS` (none/spring/summer/autumn/winter), `TIME_OF_DAY_OPTIONS` (none/day/golden_hour/night) — exterior/garden 일 때만 노출.
- `generatePrompt` 카테고리별 분기:
  - 텍스트 분석 prompt: 「architect / facade designer」 또는 「landscape designer」 페르소나, 카테고리별 invalidGate (interior 는 outdoor 거부, outdoor 는 floor plan 거부).
  - JSON 스키마 라벨이 카테고리에 맞게 (furniture → 「exterior element」 / 「garden / landscape element」).
- `buildImagePrompt` (functions): 카테고리별 preservation/modifiable 블록 — exterior 는 「building footprint + 개구부 위치」 보존 / cladding/roof/paint 변경 가능, garden 은 「lot boundaries + 영구 구조물」 보존 / 식재/하드스케이프 변경 가능.
- `generateDesign` / `saveDesign` / Cloud Function 시그니처에 `spaceCategory` + `exteriorOptions` 추가. Firestore `designs.spaceCategory` + `designs.exteriorOptions` 저장.
- UI: Upload step 상단에 3-button segmented toggle (Interior / Exterior / Garden). Style step 이 카테고리별 스타일 셋 노출. exterior/garden 일 때 Season / Time-of-day 드롭다운, Empty Room 토글 숨김.
- DesignDetail / ShareView style tag 옆에 spaceCategory + season + timeOfDay 태그. 재사용 navigation 에 모두 carry.
- `AIService.styleNameFor(style, spaceCategory)` 헬퍼 — 모든 카탈로그에서 이름 lookup, 레거시 디자인도 안전하게 표시.
- locales 11개 (카테고리, exterior 6, garden 5, season 5, timeOfDay 4, 라벨 2).
- 기존 디자인은 `spaceCategory` 필드 없음 → 모든 곳에서 default `interior` fallback 처리.

#### 🔜 후속 (보류)
- 기후/지역 입력 → 식물 종 추천
- 기존 식물 보존 vs 새로 식재 토글
- 외관 재질 카탈로그 (`src/data/exterior-materials.json`)
- `style` 키 이름 충돌 (exterior 의 `contemporary` vs interior 의 향후 `contemporary`) 검증

#### 원래 기능
집 외관, 마당, 발코니, 정원 사진을 업로드 → 조경/외관 재디자인.

#### 추가 스타일 (exterior 전용)
- Modern Farmhouse, Mediterranean, Contemporary Facade, Craftsman, Minimalist Exterior
- Garden: Zen Garden, Cottage Garden, Desert Xeriscape, Tropical, English Garden

#### 추가 기능
- 계절 변화 ("봄 꽃 만발", "가을 단풍")
- 식물 종류 제안 (지역 기후 고려, 사용자가 지역 입력)
- 조명 시뮬레이션 (낮 / 황혼 / 밤)

#### 데이터 구조
```
designs/{designId}
  + spaceCategory: 'interior' | 'exterior' | 'garden'
  + exteriorOptions?: { season, timeOfDay, climate }
```

#### 구현 파일
- `src/pages/Home.jsx` — Space Category 토글 최상위
- `src/data/exterior-styles.js`
- `functions/index.js` — 프롬프트에 category 반영

---

### 9-6. 스케치/도면 → 실사 렌더 (auto-detect)

#### 방향성
사용자에게 입력 타입 토글을 시키지 않고 **AI 가 자동 감지**해서 분기. 옵션 부담 ↓, 「사진 / 스케치 / 입면도 / 평면도 / 3D 모델 다 그냥 올리면 돼」 가 한 줄 메시지로 끝남. 평면도만 한 가지 특수 처리 — 평면도는 보통 「집 한 층 전체」 라서 한 장 렌더로 다 담을 수 없으므로, 추가 요청에 명시된 방 (또는 가장 큰 공용공간) 을 eye-level 로 렌더하고 결과 화면에 안내 배너를 띄움.

#### ✅ 1차 구현 완료 (2026-04-27, auto-detect 재설계)
- 입력 모드 사용자 토글 제거. `INPUT_MODES` 상수 → `DETECTED_INPUT_TYPES = ['photo', 'sketch', 'elevation', 'floorplan', '3d_model']` (자동 분류용 enum).
- `generatePrompt` 응답 JSON 에 `detectedInputType` + `floorplanRoomFocus` 필드 추가. AI 가 직접 분류, floorplan 일 때만 추가 요청 또는 가장 큰 공용공간 기준으로 어느 방을 렌더할지 선정.
- invalidGate 일반화 — 스페이스를 묘사하지 않는 이미지 (셀카, 음식, 텍스트, UI 스크린샷, 단일 제품 컷, 자연 풍경 등) 만 거절. 스케치/입면도/평면도/3D 모델 모두 통과.
- `functions/index.js > buildImagePrompt` 자동 분기:
  - `photo` → 기존 로직 (preservation block 등) 그대로
  - `sketch` / `elevation` / `3d_model` → 「source 를 spatial blueprint 로 해석, 라인/해칭 따라그리지 말고 photoreal 로 렌더, eye-level 카메라」
  - `floorplan` → 위 + 추가 요청 의도된 방 (또는 거실 등 가장 큰 공용공간) 한 곳만 렌더하라는 별도 지시. additionalRequest 가 함께 전달됨.
- `designs` 문서에 `detectedInputType`, `floorplanRoomFocus` (있을 때만) 저장. metadata 에도 동일.
- UI:
  - UploadStep — 입력 모드 토글 제거. space-category 토글 아래에 「사진 외에 스케치 · 입면도 · 평면도 · 3D 모델 OK」 dismissible 안내문 (`uploadAcceptsHint`). 우상단 X 로 닫으면 `voda_upload_accepts_hint_dismissed=1` localStorage 마커로 영구히 안 뜸.
  - ResultStep — `detectedInputType === 'floorplan'` 일 때 결과 상단에 dismissible info 배너. 「평면도로 인식했어요. {room} 을(를) eye-level 로 렌더했어요. 다른 방 원하면 다음번에 추가 요청에 적어주세요」.
  - DesignDetail / ShareView — 기존 「스케치」 배지 자리에 `detectedInputTypes.{sketch,elevation,floorplan,3d_model}` 자동 배지 (photo 일 땐 표시 안 함). reuse 시 inputMode carry 제거.
  - StyleStep — sketch 전용 분기 제거. Empty Room 토글은 interior 일 때 항상 노출 (sketch / plan 으로 판명되면 functions 단에서 어차피 from-scratch 렌더라 토글 의미가 자연스럽게 합쳐짐).
- locales: `uploadAcceptsHint`, `detectedInputTypes.*`, `floorplanDetectedBanner`, `floorplanDetectedBannerWithRoom` 추가. 이전 `inputModeTitle / inputModes / inputModeSketchHint / sketchBadge` 제거.
- GA `design_generated.detected_input_type` (이전 `input_mode` 대체). `input_mode_selected` 이벤트 제거.

#### 🔜 후속 (보류)
- 「Floor plan styling」 별도 모드 — 평면도 → 평면도 시점 유지 + 가구/컬러 채색된 컬러드 평면도 (B 옵션). 별도 R&D 필요. 현재 1차에선 평면도 → eye-level 한 방향만.
- ControlNet 류 폴백 — Gemini 결과가 layout 정확도 부족할 때 Stable Diffusion XL + ControlNet-scribble 폴백
- 다중 평면도 방 동시 렌더 (평면도 한 장 → 거실 / 안방 / 주방 3장) — 크레딧 정책 + UI 정합성 필요

---

### 9-7. 고해상도 다운로드 (유료)

#### 현재
1K (1024×1024) 기본 생성 → 그대로 다운로드 제공

#### 변경
- **Free**: 1K 다운로드 + 하단 "Made with Voda" 워터마크
- **Pro+**: 1K/2K/4K 선택, 워터마크 없음
- 4K 업스케일은 요청 시 별도 비용 (1 크레딧) — Gemini Upscaler 또는 Real-ESRGAN

#### 구현
- `src/pages/DesignDetail.jsx` 다운로드 버튼을 플랜별 분기
- `functions/upscale.js` — `onCall`, 사용자 플랜 검증 후 업스케일
- 워터마크: Canvas API 로 클라이언트에서 합성 (서버 부하 회피) 또는 Cloud Function

#### ✅ 1차 구현 완료 (2026-04-23) — 워터마크만
- `src/services/watermark.js` — Canvas API 로 "Made with Voda" 우하단 합성, JPEG 0.92 인코딩
- `DesignDetail` 에서 `BillingService.subscribeToSubscription` 으로 `plan` 구독 → `pro`/`studio` 아니면 워터마크 합성, 그 외는 원본
- Free 사용자에게 다운로드 영역 아래 "Pro 로 업그레이드 시 워터마크 제거" 안내 문구 노출
- `design_downloaded` 이벤트에 `plan`, `watermarked` 필드 로깅

#### 🔜 2차 (보류)
- 2K/4K 업스케일 — Stripe 결제 라이브된 이후 `functions/upscale.js` 추가 예정

---

### 9-8. 가구 쇼핑 링크

#### ✅ 1차 구현 완료 (2026-04-25)
- `src/services/shopping-links.js` — `buildShoppingUrl(itemText, lang)`
  - lang 'ko' → 네이버 쇼핑 (`search.shopping.naver.com`)
  - 그 외 → Google Shopping (`google.com/search?tbm=shop`)
  - Markdown 토큰 제거 + 공백 정규화 + URL 인코딩 후 검색 페이지로 deep-link
- furnitureRecommendations 항목 옆에 작은 「🛍 쇼핑」 인라인 링크 노출
  - `src/pages/DesignDetail.jsx`, `src/pages/ShareView.jsx`, `src/App.jsx` (ResultStep) 3곳
  - target=_blank + rel=noopener noreferrer
- locales `shopFor`, `shopShort`
- GA `furniture_shop_clicked` 이벤트 (provider 차원)
- 유닛 테스트 11개 (`tests/shopping-links.test.js`) — Naver/Google 라우팅, 한글/영어 인코딩, Markdown 스트립, 빈 입력 처리, 기본값
- `npm run test:unit` 스크립트 추가

#### 왜 검색 URL 딥링크인가
- 우리가 데이터를 가져오지 않으니 **데이터 신선도 문제 없음** — 사용자가 클릭하는 시점의 마켓플레이스 인덱스를 그대로 보여줌
- API 키 / 레이트 리밋 / 비용 0
- 한계: 검색 품질은 AI가 뱉은 `item` 텍스트의 구체성에 달림 — 「Walnut sectional sofa」 는 잘 매칭, 「modern sofa」 는 모호. 1차 한계로 받아들임

#### 🔜 후속 (보류 — 사용 데이터 보고 결정)
- **2단계: 쇼핑 API 직접 호출** — 정확도가 정말 필요하면, Naver Shopping API / Google Shopping Content API 로 실제 상품 카드 임베드. 호출량(디자인당 가구 5-7개) 만큼 비용 + 키 관리 필요.
- **3단계: 제휴 수익화** — 쿠팡 파트너스 / 아마존 어필리에이트 태그 삽입. 1단계 클릭률 보고 ROI 검토.
- **검색 키워드 분리 필드** — AI 응답에 `item` 외에 `searchKeyword` 추가 요청해서 검색 정확도 올림.

---

## Phase 10 — 커뮤니티 고도화

### 10-1. 댓글 & 북마크

#### ⚠️ 북마크 → 컬렉션으로 통합 (2026-04-27, 옵션 B)
사용자 피드백 — 「북마크와 컬렉션 차이가 뭐야?」. 둘 다 「저장」 의미라 멘탈 모델 충돌. 단일 저장 메커니즘 (컬렉션) 으로 통합:
- `BookmarkButton` → `SaveButton` 으로 대체. 클릭 시 toggle 대신 컬렉션 picker 모달 오픈
- 첫 사용 시 「저장함」 default 컬렉션 자동 생성 (`isDefault: true`)
- `/bookmarks` 페이지 → 「내 컬렉션」 그리드만 보이게 단순화 (URL 은 보존)
- Header dropdown 「저장한 디자인」 → 「내 컬렉션」, 아이콘 `bookmark` → `collections_bookmark`
- ShareView / DesignDetail 의 중복 「+컬렉션」 버튼 제거 — 책갈피 아이콘 하나로 통일
- 레거시 `users/{uid}/bookmarks/` 데이터는 보존 (UI 노출 X). `BookmarkButton.jsx` + DesignService 의 bookmark 메서드는 dead code 로 남김

#### ✅ 1차 구현 완료 (2026-04-25)
**댓글**:
- `designs/{id}/comments/{cid}` 서브컬렉션, flat list (대댓글 X), 텍스트만 (@멘션 / 이모지 reactions 보류)
- `src/services/comment-service.js` — onSnapshot 구독 + addComment + deleteComment
- `src/components/Comments.jsx` — 아바타 + 이름 + 상대시간 + 본문, 작성자 본인 또는 디자인 오너만 삭제 가능
- DesignDetail + ShareView 분석 섹션 아래 통합
- `functions/comment-counter.js` — onCreate / onDelete 트리거로 designs.commentCount 유지
- Firestore rules: read = 누구나, create = 인증+자기 uid+익명거부+text 검증, update/delete = 본인 또는 디자인 오너
- 룰 테스트 8개 추가

**북마크 (1차 — 2026-04-27 컬렉션과 통합)**:
- `users/{uid}/bookmarks/{designId}` 서브컬렉션 (현재는 read-only legacy)
- DesignService: toggleBookmark / isBookmarked / subscribeBookmark / getBookmarkedDesigns — dead code 로 남음
- `src/components/BookmarkButton.jsx` — dead code (대체: `SaveButton.jsx`)
- 룰 테스트 3개는 그대로 (rule 자체는 보존)

**카운터 + UI**:
- FeedCard 에 commentCount 노출 (chat icon + 숫자)
- 누적 룰 테스트 91개 (10-1 ~ 10-4 + 9-3)

#### 🔜 후속 (보류)
- 대댓글 (parentCommentId)
- @멘션 + 알림
- 이모지 반응
- 댓글 좋아요

#### 원래 스펙

#### 댓글
- 피드 카드와 공유 뷰(`/s/:id`)에 댓글 영역
- 기본 텍스트, @멘션, 이모지 반응
- 댓글 작성은 로그인 필수, 수정/삭제는 본인만

##### 데이터 구조
```
designs/{designId}/comments/{commentId}
  - userId, displayName, photoURL
  - text: string (max 500)
  - createdAt, updatedAt
  - parentCommentId?: string  // 대댓글
  - likeCount, likedBy[]
```

##### Firestore 규칙
```
match /designs/{designId}/comments/{commentId} {
  allow read: if resource.data.isListed == true || ... ;
  allow create: if request.auth != null
                && request.resource.data.userId == request.auth.uid;
  allow update, delete: if request.auth.uid == resource.data.userId;
}
```

#### 북마크(저장)
- 좋아요와 별개로 "내 컬렉션에 저장"
- 다른 사람 디자인 포함 → 영감 보드처럼 활용

##### 데이터 구조
```
users/{uid}/bookmarks/{designId}
  - designId, savedAt
```

#### 구현 파일
- `src/components/CommentList.jsx`, `CommentComposer.jsx`
- `src/pages/Bookmarks.jsx`
- `firestore.rules` 업데이트

---

### 10-2. 팔로우

#### ✅ 1차 구현 완료 (2026-04-25)
- `follows/{followerId_followingId}` 컬렉션. 복합 키로 중복 차단, 본인 팔로우 차단, 익명 차단.
- Firestore rules: read = 누구나 (카운트/상태 노출용), create = 자기 uid + 본인 제외, delete = 본인 follow 만. update 차단.
- `users.followerCount` / `users.followingCount` 필드를 client write 차단 (서버 트리거만)
- `functions/follow-counters.js` — onCreate/onDelete 트리거로 양쪽 카운터 동시 증감
- `src/services/follow-service.js` — toggleFollow / isFollowing / subscribeIsFollowing / getFollowingIds (max 30)
- `src/components/FollowButton.jsx` — pill, isFollowing 구독 + optimistic toggle, 본인은 hide
- 사용처 1차: Comments 의 작성자 이름 옆 (10-3 프로필 페이지에서 본격 사용 예정)
- CommunityFeed 「팔로잉」 탭 — Firestore `in` 쿼리로 팔로우한 사람의 디자인만 (max 30명, fan-out 패턴은 후속)
- 룰 테스트 8개 추가 (총 78)

#### 🔜 후속 (보류)
- 팔로잉 30명 초과 시 fan-out 컬렉션 (`user-feeds/{uid}/items/{designId}`)
- 팔로우 알림 (Phase 8-6 푸시 알림과 함께)
- 프로필 페이지 / 팔로워 목록 UI (10-3)

#### 원래 기능
다른 사용자 팔로우 → 메인 피드에 "팔로잉" 탭 추가 → 팔로우한 사람의 새 공개 디자인 우선 노출.

#### 데이터 구조
```
users/{uid}
  + followerCount: number
  + followingCount: number

follows/{followerId_followingId}
  - followerId, followingId, createdAt
```

- 복합 키로 중복 방지
- Cloud Function 으로 카운터 유지 (onCreate/onDelete)

#### 피드 쿼리
`where('userId', 'in', followingIds).orderBy('createdAt', 'desc')`
- Firestore `in` 쿼리는 30개 제한 → 팔로잉 30명 이하면 직접, 이상이면 팬아웃 패턴
- 대안: `user-feeds/{uid}/items/{designId}` 팬아웃 컬렉션 (write-heavy)

#### 구현 파일
- `src/pages/Profile.jsx` — 팔로우 버튼
- `functions/follow-counters.js`
- `src/pages/Home.jsx` — 팔로잉 탭

---

### 10-3. 디자이너 프로필 페이지

#### ✅ 1차 구현 완료 (2026-04-25)
- `profiles/{uid}` 컬렉션 도입 — public read, server-only write. handle, displayName, photoURL, bio, follower/following/designCount.
- `handles/{handle}` 역인덱스 — handle 변경 시 트랜잭션으로 swap.
- `claimHandle` Cloud Function — 트랜잭션 (handle 형식 검증 + 중복 차단 + 이전 handle 해제 + profile.handle 갱신)
- `updateProfile` Cloud Function — bio 업데이트 (200자 cap)
- `initializeUser` 가 가입 시 `voda${first8}` 형태로 자동 핸들 생성 + profile 도큐 작성 (idempotent)
- `onDesignListChange` / `onDesignDeletedDecrement` 트리거 — profiles.designCount 유지 (isListed=true 만 카운트)
- `onUserCountsChange` 트리거 — users.followerCount/followingCount → profiles 로 미러링 (다른 사용자가 카운트 노출)
- `src/services/profile-service.js` — getByUid / getByHandle / subscribeByUid / getListedDesignsByUid / claimHandle / updateBio
- `/u/:handle` 페이지 (`src/pages/Profile.jsx`) — 아바타 + 핸들 + bio + 카운트 + Follow 버튼 (자기 아닐 때) + 프로필 편집 버튼 (자기일 때) + 공개 디자인 그리드
- `/account` 페이지에 「프로필」 섹션 추가 — 핸들 + bio 편집
- Header dropdown 에 「내 프로필」 메뉴
- 룰 테스트 4개 추가 (총 82)
- Firestore 인덱스 추가: designs by userId+isListed+status

#### 🔜 후속 (보류)
- 좋아요한 것 / 북마크 탭 (1차는 디자인 그리드만)
- Comments 작성자 이름 → 프로필 링크 (handle 없는 레거시 댓글 처리 필요)
- ShareView 상단에 디자인 작성자 영역
- 프로필 사진 업로드 (현재는 Google 로그인 사진만)
- website 필드

#### URL
`/u/:handle` — 핸들 시스템 도입 (예: `/u/uihyun`)

#### 내용
- 프로필 사진, 바이오, 디자인 수, 팔로워/팔로잉
- 공개 디자인 그리드 (탭: 디자인 / 좋아요한 것 / 북마크)
- 팔로우 / 메시지(향후) 버튼

#### 데이터 구조
```
users/{uid}
  + handle: string (unique, lowercase, 3-20 chars, [a-z0-9_])
  + bio: string (max 200)
  + website: string
```

- `handles/{handle}` 역인덱스 컬렉션으로 unique 보장
- 가입 시 기본 핸들 자동 생성 후 사용자가 편집 가능

#### 구현 파일
- `src/pages/Profile.jsx` (신규)
- `functions/claim-handle.js` — 트랜잭션으로 핸들 유일성 보장
- `src/pages/AccountSettings.jsx` — 핸들/바이오 편집

---

### 10-4. 컬렉션 / 무드보드

#### ✅ 1차 구현 완료 (2026-04-26)
- `collections/{id}` 컬렉션 + `collections/{id}/items/{designId}` 서브컬렉션
- Firestore rules: 본인만 create/update/delete, public 일 때만 read 공개. itemCount/coverDesignId 는 server-only (트리거).
- 룰 테스트 9개 추가 (총 91)
- `functions/collection-counter.js` — onItemCreate / onItemDelete 트리거로 itemCount 유지 + 첫 아이템에 coverDesignId 자동 설정
- `src/services/collection-service.js` — create / get / list / addItem / removeItem / rename / setPublic / delete / checkMembership
- Firestore 인덱스 추가: collections by ownerId+createdAt 및 ownerId+isPublic+createdAt
- `src/components/CollectionCard.jsx` — 4-image 모자이크 미리보기 (1 큰 cover + 3 small) + 이름 + 아이템 수
- `src/components/AddToCollectionModal.jsx` — 본인 컬렉션 토글 (체크박스 패턴) + 인라인 「새 컬렉션 만들기」. 액션 (생성 또는 토글) 후 자동 닫힘 — 별도 「확인」 버튼 없음 (2026-04-27).
- `src/pages/CollectionPage.jsx` — `/c/:id` 라우트. Pinterest 스타일 masonry 그리드 (CSS columns). 오너만 이름 변경/공개 토글/삭제, 아이템 hover 시 「제거」 버튼 노출
- Profile 페이지에 「컬렉션」 탭 추가 — 본인이면 모든 컬렉션, 아니면 public 만
- locales 25개, CSS (`.collections-grid`, `.collection-card-mosaic`, `.moodboard-grid` 등)

#### ✅ 옵션 B 통합 (2026-04-27) — 북마크 흡수
- `src/components/SaveButton.jsx` 신규 — 북마크 아이콘 그대로 쓰지만 클릭 시 toggle 대신 `AddToCollectionModal` 오픈
- 사용처: FeedCard, DesignDetail, ShareView 의 모든 「저장」 액션이 이 버튼 하나로 통일. 별도 「+ 컬렉션」 아이콘 제거 (중복 해소)
- `CollectionService.ensureDefault(uid, displayName)` — `isDefault: true` 플래그 컬렉션이 없으면 「저장함」 (Korean) / "Saved" (English) 이름으로 자동 생성
- AddToCollectionModal 이 컬렉션 0개 발견 시 자동으로 ensureDefault 호출 → 첫 사용자도 즉시 저장 가능
- `/bookmarks` 페이지 → 「내 컬렉션」 그리드만 (이전의 북마크 섹션 제거). URL 은 보존 (북마크 → 컬렉션 redirect 효과)
- Header dropdown 의 「저장한 디자인」 → 「내 컬렉션」, 아이콘 `bookmark` → `collections_bookmark`. Profile/Account 아이콘도 분리 (`account_circle` / `manage_accounts`).
- 모달 모바일 레이아웃: input + Create 버튼 stack vertical (이전엔 한 줄에 cramped)

#### 🔜 후속 (보류)
- description 필드 사용
- Drag-to-reorder
- 아이템별 노트 / 캡션
- 다른 사람 공개 컬렉션 follow
- AI auto-tag / auto-categorize (Kosmik 같은 2026 트렌드)
- Cover image 수동 선택
- 컬렉션 삭제 시 items 서브컬렉션 정리하는 janitor function

#### 원래 기능
내 디자인 + 북마크한 타인 디자인을 "컬렉션"으로 묶어서 주제별 보드 생성.
예: "거실 영감", "미니멀 침실 아이디어"

#### 데이터 구조
```
collections/{collectionId}
  - ownerId, name, description
  - coverDesignId
  - isPublic: boolean
  - itemCount
  - createdAt, updatedAt

collections/{collectionId}/items/{itemId}
  - designId, addedAt, note?
```

#### UI
- 피드/상세에서 "+ 컬렉션에 추가" 드롭다운
- 프로필 페이지에 "컬렉션" 탭
- 공개 컬렉션은 공유 가능 (`/c/:id`)

#### 구현 파일
- `src/pages/Collection.jsx`
- `src/components/AddToCollectionModal.jsx`

---

### 10-5. Before/After 슬라이더 UI

#### ✅ 1차 구현 완료 (2026-04-25)
- `src/components/BeforeAfterSlider.jsx` — 라이브러리 의존성 없이 커스텀 구현 (~110줄). CSS `clip-path: inset(...)` 로 두 이미지가 같은 위치에 겹쳐 그려지고 핸들 위치에 따라 after 가 좌측에서 노출.
- 인터랙션: 마우스 + 터치 (Pointer Events) + 키보드 (←/→ 5%, Shift+←/→ 1%, Home/End)
- 접근성: role=slider, aria-valuenow, focus ring, tabIndex=0
- 사용처: DesignDetail / ShareView / ResultStep — 모두 image-comparison 자리 교체
- 피드 카드 썸네일은 그대로 (스펙대로 flip 효과 유지)
- 한 쪽 이미지가 누락된 경우 (이미지 생성 실패) 기존 side-by-side fallback 유지

#### 원래 기능
Before 와 After 이미지가 나란히 표시 or flip 효과

#### 개선
**좌우 드래그 슬라이더** — 중앙 핸들을 드래그하면 한 쪽이 다른 쪽을 덮으면서 비교.

#### 구현
- 라이브러리: `react-compare-slider` (경량, 3KB)
- 기존 flip 효과는 피드 카드 썸네일에 유지, 상세 뷰만 슬라이더로
- 터치 제스처 지원 필수 (모바일 UX)

#### 구현 파일
- `src/components/BeforeAfterSlider.jsx`
- `src/pages/DesignDetail.jsx`, `ShareView.jsx` 교체

---

### 10-6. AI 디자인 어드바이저 (챗)

#### ✅ 1차 구현 완료 (2026-04-25) — non-streaming, 무료 3턴
- `src/services/chat-prompt.js` — 순수 함수 `buildSystemPrompt`, `buildChatRequestParts`, `turnsUsed`, `turnsRemainingForFree`. 디자인의 style / palette / furniture / budget / mode 컨텍스트를 system prompt 로 묶음. lang 별 reply 안내 분기.
- `chatWithDesign` Cloud Function — 인증 + 소유권 + 모더레이션 prefilter + 레이트리밋. 무료 3턴 제한 (`users.plan` 체크), Pro/Studio 는 무제한. gemini-3-flash-preview 호출. 첫 generated 이미지 base64 첨부 (best-effort, 실패 시 텍스트 only).
- 데이터 구조: `designs/{designId}/chat/main` 단일 문서, `messages: [{role, text, createdAt}]` 배열. server-only write (firestore.rules), 오너만 read.
- `src/services/chat-service.js` — onSnapshot 구독 + send wrapper.
- `src/components/DesignChat.jsx` — collapsible 섹션. 첫 진입 시 추천 prompt chip 3개. 메시지 list + typing indicator + 입력창. 무료 사용자 잔여 턴 카운터, 소진 시 Pro 업그레이드 배너 (Pricing 으로 이동).
- DesignDetail 의 분석 섹션 아래에 통합, 오너만 노출.
- 유닛 테스트 14개 (`tests/chat-prompt.test.js`), 룰 테스트 5개 추가 (총 59).
- 비용: 크레딧 차감 X (PRODUCT_PLAN 의 0.1 크레딧 누적은 복잡해서 단순화 — 무료 3턴 → Pro 무제한).

#### 🔜 후속 (보류)
- SSE 스트리밍 (현재는 한번에 응답)
- 채팅 기록 export / 삭제
- AI 가 「부분 편집」 추천했을 때 클릭 한 번에 EditRegionModal 자동 열기
- 이미지 컨텍스트를 첫 turn 에만 보내고 그 뒤로는 history 만 (비용 절감)

#### 원래 스펙
결과 페이지에서 "이 방에 대해 더 물어보기" → Gemini Chat 세션 시작.

#### 예시 질문
- "이 소파 대신 어떤 것이 어울릴까?"
- "예산 200만원으로 이 분위기 내려면 뭐부터 바꿔야 해?"
- "반려동물이 있는 집에 이 러그는 괜찮을까?"

#### 기술
- Gemini 3 Flash 기본 (저렴)
- 컨텍스트: 원본 이미지 + 결과 이미지 + 분석 JSON 을 system prompt 로 주입
- 스트리밍 응답

#### 비용 관리
- 무료 사용자: 3턴/디자인
- Pro+: 무제한
- 1턴 = 0.1 크레딧 (소수점 누적)

#### 데이터 구조
```
designs/{designId}/chats/{chatId}
  - userId, messages: [{ role, text, createdAt }]
```

#### 구현 파일
- `src/components/DesignChat.jsx`
- `functions/design-chat.js` (스트리밍 SSE)

---

### 10-7. 예산 슬라이더

#### 기능
스타일 선택 화면 안에 예산 레벨 셀렉터 (Budget / Mid / Luxury). 별도 스텝이 아니라 스타일 스텝 하단 pill row.

#### ✅ 1차 구현 완료 (2026-04-25)
- `BUDGET_TIERS = ['budget', 'mid', 'luxury']` (`src/services/ai-service.js`)
- `BUDGET_TIER_DESCRIPTION` — 가격대 + 소재 퀄리티만 묘사. **브랜드 이름은 의도적으로 제외**.
  - 이유: IKEA / Classic 같은 스타일은 그 자체로 가격대가 코딩돼 있어, 프롬프트에 CB2 / Design Within Reach 같은 브랜드를 박으면 스타일과 충돌함. 톤만 한 단계 위/아래로 밀어주고 브랜드 reconciliation 은 AI 에게 맡김.
- `generatePrompt(... , roomType, budget)` — 스타일 위에 budget tier note 한 단락 추가 (`Do NOT name specific retailers or brands`).
- `generateDesign` / `saveDesign` 시그니처에 `budget` 추가, Firestore `designs/*.budget` 필드 저장. 기본값 `mid`.
- `functions/index.js` — `req.body.data.budget` echo 후 `metadata.budget` 저장.
- StyleStep 안에 pill 3개 (Budget / Mid / Luxury), 기본값 `mid`. 스타일 grid 아래에 위치.
- DesignDetail / ShareView 의 Style Used 패널에 budget tag 노출, 재사용 시 `location.state.budget` 전달.
- locales `chooseBudget`, `chooseBudgetHint`, `budgetTiers.*`.
- GA `budget_selected`, `design_generated.budget`.

#### 후속 (보류)
- `estimatedCost` 필드에 min/max 구간 표시
- 예산 초과 아이템 경고 표시

#### 구현 파일
- `src/services/ai-service.js`
- `src/App.jsx` — StyleStep 안에 pill row
- `functions/index.js` — 프롬프트 확장
- `src/pages/DesignDetail.jsx`, `src/pages/ShareView.jsx`
- `src/locales/{en,ko}.js`
- `src/styles/main.css` — `.budget-pills`, `.budget-pill`

---

## 권장 로드맵 (출시까지 ~8주 예상)

### Sprint 1 (1주) — 필수 인프라
- [x] 8-1 크레딧 시스템 (서버 차감, 게스트 localStorage) — 2026-04-21
- [x] 8-4 콘텐츠 모더레이션 — 경량 구현 (2026-04-23), 어드민 UI 는 후속

### Sprint 2 (1.5주) — 수익화
- [~] 8-2 Stripe 결제 + Pro 구독 — 스켈레톤 배포 (2026-04-21), Stripe 키 대기
- [x] 8-3 프로모/초대 시스템 — 2026-04-21
- [~] 9-7 고해상도 다운로드 + 워터마크 — 워터마크 1차 완료 (2026-04-23), 2K/4K 업스케일은 Stripe 라이브 후

### Sprint 3 (1.5주) — 가치 기능
- [x̶] ~~9-1 Room Type 선택~~ — **제거됨 (2026-04-25)** layout drift 유발로 Auto 모드만 운영
- [~] 9-2 Empty Room 모드 — 수동 토글 1차 완료 (2026-04-25), 자동 감지는 후속
- [~] 10-7 예산 슬라이더 — 1차 완료 (2026-04-25), `estimatedCost` 구간 표시는 후속

### Sprint 4 (2주) — 차별화
- [~] 9-3 Object Replace — 의미론적 마스킹 1차 + 편집 lineage UI (sourceDesignId, 「원본 보기」 배너, 「이 디자인의 편집본」 섹션) 완료 (2026-04-25), 브러시 UI 는 향후 마스크 입력 모델 도입 시 검토
- [~] 9-4 Paint Explorer — 색상 매칭 1차 (2026-04-25). UI 노출은 2026-04-27 제거 (서비스/데이터/테스트는 보존). 벽/바닥 inpainting 후속에서 재사용 예정
- [~] 9-8 쇼핑 링크 — 검색 URL 딥링크 1차 완료 (2026-04-25), 쇼핑 API / 제휴 수익화는 후속

### Sprint 5 (2주) — 앱 출시
- [~] 8-5 Capacitor 래퍼, iOS/Android 빌드 — Sprint A 1+2+3+5+6+7+8 단계 완료 + Native Firestore hang fix (2026-05-05). Capacitor 7 + Sign in with Apple + share/Filesystem + Universal Links + Privacy Manifest + 결제 UI iOS hide + native 에서 Firestore 가 정상 작동하도록 Firebase Auth popup helper 비활성화 (`initializeAuth(app, { persistence: indexedDBLocalPersistence })`). 잔여: 4단계 RevenueCat IAP, Android App Links / production keystore (Sprint B), 디자이너 자산 교체.
- [~] UX 라운드 (2026-05-05) — 공유/커뮤니티 게시 UI 분리, 이미지 생성 병렬화 (75s → 25s), App-level Pending Banner (백그라운드 진행 + fake progress + 다른 페이지 자유 navigate + 완료 시 「열기」 → `/designs/:id`). 후속: Gemini 5xx 자동 재시도 (functions 의 generateContentWithRetry), 전체 이미지 실패 시 디자인 저장 skip + 환불 안내, ResultStep + Banner 중복 제거, PendingBanner / DesignChat input 모바일 layout (column / max-width 가운데 정렬 / safe-area).
- [ ] 8-6 푸시 알림 (디자인 완료 + 좋아요)
- [ ] Sign in with Apple 추가
- [ ] 스토어 자산 제작, 제출

### Post-launch
- [~] 9-5 Exterior/Garden — 1차 완료 (2026-04-26), 식물 추천/지역 기후 입력은 후속
- [~] 10-1 댓글 — 1차 완료 (2026-04-25), 대댓글 / @멘션 / 이모지는 후속. ~~북마크~~ 는 2026-04-27 컬렉션 (10-4) 으로 흡수
- [~] 10-2 팔로우 — 1차 완료 (2026-04-25), fan-out 패턴 / 알림은 후속
- [~] 10-3 디자이너 프로필 페이지 — 1차 완료 (2026-04-25), 좋아요/북마크 탭 / 사진 업로드는 후속
- [~] 10-4 컬렉션 / 무드보드 — 1차 완료 (2026-04-26), 옵션 B 통합 적용 (2026-04-27) — 북마크 흡수, 「저장함」 default 컬렉션 자동 생성. 노트/드래그 정렬/AI 태그는 후속
- [~] 10-6 AI 챗 어드바이저 — 1차 완료 (2026-04-25), SSE 스트리밍은 후속
- [x] 10-5 Before/After 드래그 슬라이더 — 1차 완료 (2026-04-25)
- [~] 9-6 스케치 → 렌더 — 1차 완료 (2026-04-27, auto-detect 재설계), AI 가 photo / sketch / elevation / floorplan / 3d_model 자동 분류, 평면도는 추가 요청 또는 가장 큰 공용공간 기준 한 방 eye-level 렌더 + 결과 배너. ControlNet 폴백 / Floor plan styling (B 모드) 은 후속
- [ ] (참고용, 후순위) 3D 워크스루 / VR — NeRF·Gaussian Splatting 기반, R&D 비용 큼

---

## 위험 요소 & 미리 고려할 것

| 항목 | 리스크 | 완화 |
|------|--------|------|
| Gemini API 비용 폭증 | 무료 사용자가 대량 생성 | 크레딧 시스템 (8-1) + 일일 한도 |
| App Store 심사 거부 | IAP 미지원, UGC 모더레이션 부재 | Capacitor + RevenueCat + 신고 시스템 |
| 콘텐츠 저작권 이슈 | 피드 이미지 무단 사용 | "이 디자인은 Voda AI로 생성됨" 워터마크 + 약관 명시 |
| Firestore 비용 | 피드 read 폭증 | 피드 쿼리 결과 캐싱 (CDN), 썸네일 경량화 |
| 개인정보 (방 내부 사진) | 사용자 프라이버시 | 기본 비공개, 업로드 시 안내, 삭제 시 Storage도 삭제 |
| 어뷰저/봇 가입 | 초대 보너스 악용 | 휴대폰 인증 또는 reCAPTCHA, 초대는 SNS 공유 경로만 |
| Gemini 3 Pro Image deprecate | 모델 변경 필요 | AI 레이어 추상화, 모델명 환경변수화 |

---

*이 문서는 기능 추가 및 방향 변경 시 업데이트 예정*
