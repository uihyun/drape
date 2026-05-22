# Brand Assets Pipeline — archelier

> 2026-05-09 갱신. 디자인 D (Quiet Atelier) 적용 완료. 이 문서는 **자산 파이프라인 룰** + **반복 실수 방지** 지침. 브랜드명/마케팅 카피는 [`BRANDING.md`](./BRANDING.md) 참고.

---

## TL;DR — 디자인 작업 시 절대 룰 5개

1. **컨셉 → production 은 `cp` 만**. 같은 의도의 새 SVG 작성 금지 (오타·폰트 fallback 으로 미묘한 차이 발생)
2. **컨셉 SVG 는 `lock-svg-to-png.cjs` 로 lock**. PNG 가 SVG 안에 base64 임베드 → 어떤 렌더러도 동일.
3. **Live element (CSS/JSX) 색은 컨셉 PNG 픽셀 sampling 으로 결정**. 원본 SVG hex 그대로 쓰면 sharp render artifact 와 브라우저 render 가 달라 사용자 눈에 다르게 보임.
4. **Splash 의 'a' 마크는 `<img src="/mark-D.png">`**. inline SVG `<text>` 사용 금지 (브라우저 폰트 fallback 위험).
5. **이미 확정된 자산은 사용자 명시 요청 없이 변경 금지**. 색·위치·overlay 임의 수정 금지.

---

## 1. 디자인 시스템 (D — Quiet Atelier)

### 컬러
| 용도 | 값 | 비고 |
|---|---|---|
| BG 그라데이션 시작 (top-left) | `#DCD4C4` | linear-gradient 135deg |
| BG 그라데이션 끝 (bottom-right) | `#C9C0AF` | |
| BG overlay | `#1F1B16` opacity 0.05 | 그라데이션 위에 추가 |
| 마크 / 워드마크 | `#1F1B16` | charcoal |
| 액센트 점 | `#B5654A` | terracotta |
| Native splash 단색 (LaunchScreen 등) | `#C8BFAF` | 그라데이션 mid-tone (overlay 적용 후) |

### 타이포그래피
| 용도 | 폰트 스택 |
|---|---|
| 마크·워드마크 (icon SVG, JsSplash, watermark) | `'Hoefler Text', 'Cochin', 'Cormorant Garamond', 'Garamond', 'Times New Roman', serif` |
| 본문/UI | 기존 시스템 스택 (변경 없음) |

> Hoefler Text 는 Apple 시스템 폰트 (proprietary). macOS / iOS Safari 에서만 렌더. 그 외 OS 는 Times fallback. 진정한 크로스 플랫폼 일관성이 필요하면 향후 Fraunces (OFL) 도입 검토. 현재는 production 자산이 PNG 라서 폰트 의존 없음.

### 'a' 마크 좌표 (1024×1024 viewBox)
- 'a' baseline: `x=500, y=720`, font-size 800, weight 400, anchor middle, fill `#1F1B16`
- 점: `cx=700, cy=700, r=22`, fill `#B5654A`

> 위 좌표는 시각적 옵티컬 센터링. 수학적 중심보다 약 5% 위. 변경 시 사용자 합의 필수.

---

## 2. 파일 구조 — 무엇이 어디 있는가

### 컨셉 (lock 됨, source of truth)
| 파일 | 용도 |
|---|---|
| `resources/concepts/icon-D-centered.svg` (+ `.png`) | **현재 production 아이콘 원본**. 'a' 위치 y=720 |
| `resources/concepts/icon-D-quiet-atelier.svg` (+ `.png`) | 초기 D 컨셉. 'a' y=760 (lower). 참고용 |
| `resources/concepts/mark-D.svg` (+ `.png`) | **transparent bg + 'a' + 점**. JsSplash 의 `<img>` 소스 |
| `resources/concepts/icon-{A..M}*.svg` (+ `.png`) | 비교용 컨셉 시안 (보존) |
| `resources/concepts/splash-D-quiet-atelier.svg` (+ `.png`) | 풀 스플래시 시안 (preview용, production 은 JsSplash 가 합성) |
| `resources/concepts/compare*.png` | 비교 시트들 (의사결정 기록) |

### Production (컨셉에서 cp)
| 파일 | 출처 |
|---|---|
| `resources/icon-only.svg` (+ `.png`) | `cp concepts/icon-D-centered.svg` |
| `resources/icon-foreground.svg` (+ `.png`) | locked, Android adaptive 용. 'a' 작게 (Safe zone) |
| `resources/icon-background.svg` (+ `.png`) | locked, BG gradient + overlay |
| `resources/splash.svg` (+ `.png`) | gradient + overlay (icon-only 와 동일 톤). LaunchScreen / capacitor-assets 입력 |
| `resources/splash-dark.svg` (+ `.png`) | splash 와 동일 (다크 변형 폐기) |
| `resources/og-image.svg` | OG 카드 (1200×630) 소스. locked, PNG 임베드 |
| `assets/*` | `resources/` 와 동일 — `@capacitor/assets` 가 이 경로를 읽음 |
| `public/mark-D.png` | `cp concepts/mark-D.svg.png`. JsSplash 가 런타임에 fetch |
| `public/og-image.png` | 1200×630 OG 카드. `index.html` 의 og:image meta 가 참조 |

### 자동 생성 (커밋 대상)
| 경로 | 생성기 |
|---|---|
| `ios/App/App/Assets.xcassets/{AppIcon,Splash}.imageset/*` | `npx capacitor-assets generate` |
| `android/app/src/main/res/mipmap-*/ic_launcher*.png` | `npx capacitor-assets generate` |
| `android/app/src/main/res/drawable*/splash.png` | `npx capacitor-assets generate` |
| `public/icons/icon-*.webp` | `npx capacitor-assets generate` (PWA) |

### Native config
| 경로 | 값 |
|---|---|
| `capacitor.config.json` `SplashScreen.backgroundColor` | `#C8BFAF` |
| `ios/App/App/Base.lproj/LaunchScreen.storyboard` 의 `backgroundColor` | RGB `0.784, 0.749, 0.686` (= `#C8BFAF`) |

### 런타임 컴포넌트
| 파일 | 역할 |
|---|---|
| `src/components/JsSplash.jsx` | 네이티브 splash 후 표시되는 JS 스플래시. `<img src="/mark-D.png">` + 워드마크 + 라인 + 태그라인 |
| `src/styles/main.css` `.js-splash*` | 스플래시 스타일. BG = icon 과 동일 그라데이션 + overlay |
| `src/services/watermark.js` | "Made with archelier" 워터마크. 세리프 폰트 스택 |

---

## 3. 빌드 파이프라인

```
1. resources/concepts/*.svg (locked)
       │ cp (사용자 결정 후)
       ▼
2. resources/icon-only.svg, icon-foreground.svg, icon-background.svg, splash.svg, splash-dark.svg
       │ cp resources/* assets/*
       ▼
3. assets/* (@capacitor/assets 의 입력 경로)
       │ node scripts/build-assets.cjs   (sharp SVG → PNG @ 정해진 사이즈)
       ▼
4. resources/*.png (icon-only.png, splash.png 등)
       │ npx capacitor-assets generate   (iOS / Android / PWA 자산 분배)
       ▼
5. ios/.../Assets.xcassets/, android/.../res/, public/icons/
       │ npx cap sync ios   (Xcode 프로젝트 갱신)
       ▼
6. Xcode 에서 Clean Build (⇧⌘K) + Run (⌘R)   ← LaunchScreen 캐시 때문에 필수
```

**주의:**
- `assets/` 디렉토리 동기화 누락 시 `capacitor-assets` 가 옛 자산 사용. 새 production 자산 만들면 항상 `cp resources/* assets/*`.
- `@capacitor/assets@3.0.5` 는 Capacitor 7 universal 포맷에서 iOS AppIcon 1개 (1024 universal) 만 생성. 정상.
- iOS LaunchScreen 변경은 시뮬레이터/실기에서 **앱 삭제 → Clean Build → 재설치** 해야 보임. iOS 가 LaunchScreen 을 캐시함.

---

## 4. 새 디자인 작업 시 워크플로우

### 시안 만들기
1. `resources/concepts/icon-{X}-{name}.svg` 작성 (텍스트 기반 SVG)
2. `scripts/lock-svg-to-png.cjs` 의 FILES 배열에 추가
3. `node scripts/lock-svg-to-png.cjs` 실행 → SVG 가 PNG 임베드 형태로 잠김 + .svg.png 생성
4. 비교가 필요하면 `scripts/build-concept-sheet*.cjs` 패턴으로 비교 시트 생성

### 시안 → production 적용
1. 사용자 결정 받음
2. `cp resources/concepts/<chosen>.svg resources/icon-only.svg`
3. `cp resources/concepts/<chosen>.svg.png resources/icon-only.png`
4. `cp resources/icon-only.svg assets/icon-only.svg`
5. `cp resources/icon-only.png assets/icon-only.png`
6. (icon-foreground / icon-background 도 필요 시 같은 패턴)
7. (splash 변경 시 splash.svg 도 같은 패턴)
8. `node scripts/build-assets.cjs` (생략 가능 — capacitor-assets 가 svg 직접 처리)
9. `npx capacitor-assets generate`
10. `npm run build`
11. `npx cap sync ios`
12. iOS / Android / 웹 배포 각자 트랙

### Live element 가 컨셉 위에 오버레이되는 경우 (예: JsSplash 의 'a')
- 옵션 1 (권장): 컨셉 PNG 를 `<img>` 로 그대로 사용 (`mark-D.png`)
- 옵션 2: 컨셉 PNG 의 픽셀 색을 sample 하여 CSS/SVG 에 명시 (sharp render artifact 보정)
  ```js
  // 한 줄 sampling 명령 예
  node -e "
    const sharp=require('sharp');(async()=>{
      const{data,info}=await sharp('path/to/concept.png').raw().toBuffer({resolveWithObject:true});
      const idx=(YYY*info.width+XXX)*info.channels;
      console.log(data[idx],data[idx+1],data[idx+2]);
    })();"
  ```

---

## 5. 반복했던 실수들 (절대 다시 하지 말 것)

| # | 실수 | 결과 | 방지법 |
|---|---|---|---|
| 1 | `icon-only.svg` 를 텍스트 기반으로 새로 작성 (overlay `#FFFFFF` 오타, 원본은 `#1F1B16`) | production 아이콘이 컨셉보다 밝음 | Rule 1 — `cp` only |
| 2 | JsSplash 에 inline SVG `<text>` 사용 | 브라우저가 Hoefler 못 찾으면 Times fallback → 'a' 모양 다름 | Rule 4 — `<img src="/mark-D.png">` |
| 3 | JsSplash 점 색 `fill="#B5654A"` 직접 명시 | 컨셉 PNG 의 점은 sharp antialiasing 으로 `#8F6C5B` 로 muted, live CSS 는 vibrant → 사용자 눈에 다름 | Rule 3 — sample concept PNG |
| 4 | `assets/` 동기화 누락 후 `capacitor-assets` 실행 | 옛 V placeholder 가 iOS AppIcon 으로 생성됨 | 항상 resources/ 변경 후 assets/ 도 cp |
| 5 | 아이콘과 splash BG 그라데이션을 다르게 정의 | 시각적 분리감 (다른 앱 같음) | 같은 그라데이션 + overlay 사용. 단일 source 로 관리 |
| 6 | dark mode override 추가 → splash 가 OS 다크모드 따라 변함 | 컨셉 (light D 단일) 과 안 맞음 | Splash 는 always light. dark variant 폐기 |

---

## 6. 자산 변경 시 체크리스트

- [ ] 컨셉 SVG 가 `concepts/` 에 있고 lock 됐는가?
- [ ] 사용자 명시 결정 받았는가?
- [ ] `resources/` 에 cp 했는가? (텍스트 SVG 새로 작성 X)
- [ ] `assets/` 에 cp 했는가?
- [ ] `npx capacitor-assets generate` 실행했는가?
- [ ] iOS / Android / PWA 결과 시각 확인했는가?
- [ ] `npm run build` 성공했는가?
- [ ] `npx cap sync ios` 완료했는가?
- [ ] live element (JsSplash 등) 가 컨셉과 일관된가? (`<img>` 또는 sample 색 사용)
- [ ] 시뮬레이터에서 앱 삭제 → Clean Build → Run 했는가?

---

## 7. Quick reference

```bash
# 컨셉 lock
node scripts/lock-svg-to-png.cjs

# 컨셉 비교 시트 (의사결정 기록)
node scripts/build-concept-sheet.cjs       # A·B·C
node scripts/build-concept-sheet-2.cjs     # D·E·F·G
node scripts/build-concept-sheet-3.cjs     # H·I·J·K·L·M
node scripts/build-d-vs-d1-compare.cjs     # D vs D-1
node scripts/build-d-variants-compare.cjs  # D variants
node scripts/build-splash-compare.cjs      # splash D vs I

# Production 빌드
node scripts/build-assets.cjs              # SVG → PNG @ 사이즈
npx capacitor-assets generate              # iOS / Android / PWA 분배
npm run build                              # 웹 dist/
npx cap sync ios                           # Xcode 프로젝트 갱신

# 픽셀 sampling
node -e "const sharp=require('sharp');(async()=>{const{data,info}=await sharp('PATH').raw().toBuffer({resolveWithObject:true});const i=(Y*info.width+X)*info.channels;console.log('#'+[data[i],data[i+1],data[i+2]].map(x=>x.toString(16).padStart(2,'0').toUpperCase()).join(''));})()"
```
