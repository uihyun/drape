# Voda Capacitor 셋업 — 전체 여정

PWA → 네이티브 iOS / Android 앱 (Capacitor 8) 까지 가는 전 과정. PRODUCT_PLAN §8-5 의 Sprint A 를 실제 어떻게 진행했는지 시간순 기록 + 「나중에 다시 읽어도 따라 할 수 있는」 walkthrough.

빠른 Xcode → TestFlight 만 보고 싶으면 → `IOS_BUILD_GUIDE.md`
잔여 단계 (4단계 IAP, Sprint B Android, Sprint C 푸시) 는 이 문서 끝부분.

---

## 0. 의사결정 (먼저 정한 것)

| 질문 | 결정 | 이유 |
|------|------|------|
| 어떤 래퍼? | **Capacitor 7** | TWA 는 iOS 불가, React Native 는 완전 재작성. 기존 PWA 코드 그대로 가져갈 수 있는 Capacitor 가 ROI 최고. **8 이 아닌 7 인 이유**: `@capacitor-community/apple-sign-in` 의 최신 버전 (7.1.0) 이 아직 Capacitor 8 호환이 안 됨 — Sign in with Apple 이 필요한 우리 케이스에선 v7 으로 통일 (§2-1 참고) |
| 번들 ID | **`com.voda.app`** | 표준 reverse-domain. 한 번 박히면 변경 시 IAP / 사용자 / 빌드 다 새로 시작 |
| 푸시 알림 | **분리 (Sprint C)** | 출시 v1.0 가 너무 커지지 않게. 푸시 없이도 출시 가능 |
| iOS IAP | **RevenueCat 사용 결정, 단 v1.0 TestFlight 는 IAP 없이** | 매출 $2,500/mo 까지 무료 + 그 이후 1%. 영수증 검증 / 갱신 / 환불 / 무료체험 자동. v1.0 은 먼저 native 동작 확인 우선 |
| Android 첫 출시 | **Sprint B 로 분리** | iOS 가 더 risky path (Apple 심사). Android 는 거의 동일 코드라 Sprint B 에서 빌드만 |
| Apple Sign-In 웹 활성? | **활성** | App Store 가 Google 외 소셜 로그인 있으면 Apple 도 제공 의무. 웹에서도 같이 활성하면 정책 + UX 동시 충족 |

---

## 1. 사전 준비 (사용자 액션)

### 1-1. 개발자 계정
- [x] **Apple Developer Program** 가입 — Team ID: `WG75TG59NJ` (Uihyun Kim)
- [x] **Google Play Console** 가입 — Sprint B 에서 사용

### 1-2. 로컬 환경 점검

```bash
xcode-select -p   # Xcode 경로 (CommandLineTools 가 아닌 풀 Xcode 필요)
pod --version     # CocoaPods 1.16+
java -version     # Java 21 (Android 빌드용)
ls /Applications/Android\ Studio.app  # 설치 확인
```

전부 OK 인 상태에서 시작.

---

## 2. Capacitor 셋업 (Sprint A 1+2단계)

### 2-1. 의존성 설치

```bash
npm install --save-dev @capacitor/cli@^7
npm install --save @capacitor/core@^7 @capacitor/ios@^7 @capacitor/android@^7
```

`package.json` 의 dependencies 에 `@capacitor/{core,ios,android}` 가, devDependencies 에 `@capacitor/cli` 가 들어옴.

#### ⚠️ Capacitor 8 이 아닌 7 인 이유 — 의존성 함정

처음에 v8 로 셋업했다가 빌드 시점에 다음 에러로 발견:

> `Failed to resolve dependencies. apple-sign-in depends on capacitor-swift-pm 7.0.0..<8.0.0 and share depends on capacitor-swift-pm 8.0.0..<9.0.0`

원인: **`@capacitor-community/apple-sign-in@7.1.0` 이 최신인데 아직 Capacitor 8 미지원**. v8 의 다른 플러그인 (`@capacitor/share@8`, `@capacitor/filesystem@8`) 과 같이 못 씀.

해결책 두 가지:
- **A. Capacitor 전체를 v7 로 통일** (우리 선택) — 검증됨, 모든 플러그인 v7 호환 버전 있음
- B. v8 유지 + Apple Sign-In 자체 native 구현 — `AppDelegate.swift` 에 `ASAuthorizationAppleIDProvider` 코드 + JS bridge. 시간 더 듦

만약 미래에 apple-sign-in 의 v8 호환 버전이 나오면 v8 로 업그레이드 가능. 그때까지는 v7 유지. 확인 명령:

```bash
npm view @capacitor-community/apple-sign-in versions --json
npm view @capacitor-community/apple-sign-in@latest peerDependencies
```

### 2-2. 프로젝트 초기화

```bash
npx cap init "Voda" "com.voda.app" --web-dir dist
```

→ 루트에 `capacitor.config.json` 생성:

```json
{
  "appId": "com.voda.app",
  "appName": "Voda",
  "webDir": "dist"
}
```

### 2-3. 네이티브 프로젝트 생성

먼저 web 빌드를 돌려서 `dist/` 가 있어야 함 (`cap add` 가 dist 를 native 프로젝트의 web 자산으로 복사).

```bash
npm run build
npx cap add ios
npx cap add android
```

→ 루트에 `ios/`, `android/` 두 디렉토리 생성. 둘 다 자체 `.gitignore` 가 들어가 있어 (Pods, build/, local.properties 등 자동 ignore).

#### ⚠️ 알려진 함정 — 「Update to recommended settings」

`cap add ios` 가 만드는 Xcode 프로젝트는 호환성 위해 **Xcode 8.0 compatibility version** (`compatibilityVersion = "Xcode 8.0";` in pbxproj) 으로 시작해. 그래서 최신 Xcode 로 처음 열면 자동으로 다이얼로그가 떠:

> **「Update to recommended settings」**
> Asset Catalog / Build Settings / Localization / Project Settings 등 항목 체크박스

**대처**: 모든 체크박스를 그대로 두고 **「Perform Changes」** 눌러. 다음 항목들이 자동 적용돼:
- Enable Recommended Warnings (컴파일러 경고 강화)
- Enable User Script Sandboxing (빌드 스크립트 샌드박스) ⚠️ **CocoaPods 와 충돌함, 아래 참고**
- Inherit Development Team from Project Settings (Team 통합)
- Enable String Catalog Symbol Generation (다국어 코드 자동 생성)
- Enable Parallelization in Command Line Builds (병렬 빌드)

체크 안 된 항목 (예: Generated Asset Symbol Extensions) 은 우리 프로젝트에 불필요하니 그대로 둠.

#### ⚠️ 「Update to recommended settings」 후 CocoaPods Sandbox 충돌

「Perform Changes」 가 켠 **User Script Sandboxing = YES** 가 CocoaPods 의 「[CP] Embed Pods Frameworks」 스크립트와 충돌해 Archive 가 실패해:

> `error: Sandbox: bash(...) deny(1) file-read-data .../Pods-App-frameworks.sh: Operation not permitted`

이건 Xcode 15+ 와 CocoaPods 의 잘 알려진 호환성 문제. 해결: User Script Sandboxing 을 다시 NO 로.

**Xcode UI 로**: TARGETS > App > **Build Settings** 탭 > 검색창에 `User Script Sandbox` > **User Script Sandboxing** 항목을 **NO** 로 변경 (Debug + Release 양쪽)

**또는 pbxproj 직접 편집** (반복 가능, git 으로 추적):

```bash
sed -i '' 's/ENABLE_USER_SCRIPT_SANDBOXING = YES;/ENABLE_USER_SCRIPT_SANDBOXING = NO;/g' \
  ios/App/App.xcodeproj/project.pbxproj
```

미래에 Capacitor 가 SPM (Swift Package Manager) 으로 완전 이전하면 이 문제는 사라질 것. 지금은 v7 / CocoaPods 라 NO 로 유지 필요.

이게 우상단 ⚠️ 경고 1개의 흔한 원인. 한 번 적용하면 다시 안 뜸. **다만 누군가 ios/ 를 통째로 지우고 `cap add ios` 다시 하면 같은 다이얼로그가 또 떠** — 매번 「Perform Changes」 눌러주면 됨. 적용 결과는 `project.pbxproj` 에 박혀 git 으로 추적됨.

### 2-4. npm 스크립트

`package.json` scripts 에 추가:

```json
"cap:sync": "npm run build && cap sync",
"cap:open:ios": "cap open ios",
"cap:open:android": "cap open android"
```

`cap sync` 는:
- `dist/` → `ios/App/App/public/` + `android/app/src/main/assets/public/` 로 복사
- 새로 추가된 Capacitor 플러그인을 native 프로젝트에 등록
- 변경된 capacitor.config.json 을 native 프로젝트에 동기화

코드 / 의존성 바뀔 때마다 `npm run cap:sync` 한 번 돌리면 됨.

### 2-5. platform-service.js (단일 분기점)

**경로**: `src/services/platform-service.js`

```js
import { Capacitor } from '@capacitor/core';

export function isNativeApp() {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
}

export function getPlatform() {
  try { return Capacitor.getPlatform(); } catch { return 'web'; }
}

export const isIOS = () => getPlatform() === 'ios';
export const isAndroid = () => getPlatform() === 'android';
export const isWeb = () => getPlatform() === 'web';
```

**원칙**: 「웹/네이티브 분기」 가 필요한 모든 곳은 이 모듈만 import. 직접 `userAgent` 검사 금지.

---

## 3. Sign in with Apple (Sprint A 3단계)

App Store 정책: Google 외 소셜 로그인이 있으면 Apple 도 제공 의무. 웹 + iOS 네이티브 양쪽에서 작동.

### 3-1. Apple Developer Console 작업 (사용자)

#### App ID 에 Sign In with Apple capability 추가
1. https://developer.apple.com/account/resources/identifiers/list
2. `com.voda.app` 행 클릭 → Capabilities 에서 ☑ **Sign In with Apple** + (6단계용) ☑ **Associated Domains**
3. 우상단 **Save** → Confirm

#### Services ID 생성 (웹 Sign-In 용 식별자)
1. 같은 Identifiers 페이지 우상단 「+」
2. ○ **Services IDs** → Continue
3. Description: `Voda Web Sign-In`, Identifier: **`com.voda.app.signin`** (변경 불가)
4. 만든 후 다시 클릭 → ☑ Sign In with Apple → **Configure**
   - Primary App ID: `com.voda.app`
   - Domains: `voda-7647c.firebaseapp.com`
   - Return URLs: `https://voda-7647c.firebaseapp.com/__/auth/handler`
5. Save → Continue → Register

#### Sign in with Apple Key 생성
1. https://developer.apple.com/account/resources/authkeys/list → 「+」
2. Key Name: `Voda Sign In Key`
3. ☑ **Sign in with Apple** → Configure → Primary App ID: `com.voda.app` → Save
4. Continue → Register
5. **Download** 로 `AuthKey_<10자리>.p8` 받기 (한 번만 가능). Voda 의 경우: **`AuthKey_G3Q44RRZ7R.p8`**, Key ID = **`G3Q44RRZ7R`**

#### Team ID 메모
- Membership 페이지: **`WG75TG59NJ`**

### 3-2. .p8 키 보관 — 중요

**절대 git 에 커밋 금지**. `.gitignore` 에 추가:

```
*.p8
AuthKey_*.p8
```

권장 보관처:
1. **1Password / Bitwarden 의 secure file attachment** (가장 안전)
2. 또는 macOS 의 권한 600 폴더 + 외부 백업

분실 시: Apple Developer 에서 새 키 발급 + Firebase Console 에 다시 입력. 기존 키는 자동 무효화 안 되니 Apple Developer 의 Keys 페이지에서 「Revoke」.

### 3-3. Firebase Console (사용자)

https://console.firebase.google.com/project/voda-7647c/authentication/providers
→ Apple → 활성화

| 필드 | 값 |
|------|-----|
| 서비스 ID | `com.voda.app.signin` |
| OAuth 코드 흐름 → Apple Team ID | `WG75TG59NJ` |
| OAuth 코드 흐름 → Key ID | `G3Q44RRZ7R` |
| OAuth 코드 흐름 → 개인 키 | `.p8` 파일 텍스트 에디터로 열어서 `-----BEGIN PRIVATE KEY-----` ~ `-----END PRIVATE KEY-----` 전체 복사 / 붙여넣기 |

저장.

### 3-4. 클라이언트 의존성 + 코드

```bash
npm install --save @capacitor-community/apple-sign-in@^7
```

**`src/services/auth-service.js`** 핵심 변경:

```js
import { OAuthProvider, signInWithPopup, signInWithCredential, linkWithPopup, linkWithCredential, updateProfile } from 'firebase/auth';
import { isNativeApp, isIOS as isIOSPlatform } from './platform-service.js';

const appleProvider = new OAuthProvider('apple.com');
appleProvider.addScope('email');
appleProvider.addScope('name');

async signInWithApple(beforeSwitch) {
  if (isNativeApp() && isIOSPlatform()) {
    // 네이티브 iOS: Capacitor 플러그인 → identityToken → signInWithCredential
    const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
    const { response } = await SignInWithApple.authorize({
      clientId: 'com.voda.app',
      redirectURI: 'https://voda-7647c.firebaseapp.com/__/auth/handler',
      scopes: 'email name',
    });
    const credential = appleProvider.credential({ idToken: response.identityToken });
    const fullName = [response.givenName, response.familyName].filter(Boolean).join(' ').trim();
    // ... linkWithCredential 또는 signInWithCredential, _applyAppleFirstLoginName, _ensureUserDoc
  } else {
    // 웹 / Android: signInWithPopup(auth, appleProvider)
  }
}
```

**Apple 의 first-login displayName quirk**: Apple 은 이름을 **첫 로그인에만** 줘. 그 이후엔 안 줌. 그래서 첫 응답에서 받아서 `updateProfile(user, { displayName: fullName })` 로 Firebase 사용자 프로필에 캐시. 두 번째 로그인부터는 Firebase 가 캐시된 displayName 사용.

**`_ensureUserDoc(user, provider)`** 에 provider 인자 추가 → `users/{uid}.provider = 'apple' | 'google'` 기록.

### 3-5. iOS 네이티브 entitlement

**경로**: `ios/App/App/App.entitlements` (신규)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.developer.applesignin</key>
  <array><string>Default</string></array>
</dict>
</plist>
```

`ios/App/App.xcodeproj/project.pbxproj` 의 Debug + Release buildSettings 에:

```
CODE_SIGN_ENTITLEMENTS = App/App.entitlements;
```

추가. (6단계에서 associated-domains 도 같은 파일에 추가됨)

### 3-6. UI — Sign-In 모달

`src/App.jsx > SignInModal` 에 Google 버튼 아래 Apple 버튼:

```jsx
<button className="btn signin-apple-btn" onClick={() => onSignIn('apple')} disabled={loading}>
  <svg ...>{/* Apple logo */}</svg>
  {t('signInApple')}
</button>
```

CSS (`signin-apple-btn`): 검정 배경 + 흰 로고 (Apple HIG 준수), min 44px tap target.

i18n 키: `signInApple` (en/ko).

`handleSignIn(provider)` 시그니처로 분기.

### 3-7. 검증

```bash
npm run build && npm run cap:sync
```

cap sync 출력에 `@capacitor-community/apple-sign-in@7.x.x` 가 iOS 플러그인 목록에 등록됐는지 확인.

웹은 https://voda-7647c.web.app 에서 시크릿 창으로 Sign In → Apple 버튼 클릭 → Apple OAuth 시트 → 로그인 가능해야 함.

---

## 4. 네이티브 share / 다운로드 (Sprint A 5단계)

iOS 네이티브 앱의 WKWebView 에선 `navigator.share` 와 `<a download>` 가 신뢰할 수 없음. Capacitor 플러그인으로 분기.

### 4-1. 의존성

```bash
npm install --save @capacitor/share@^8 @capacitor/filesystem@^8
```

### 4-2. 단일 진입점 — `src/services/share-service.js` (신규)

```js
import { isNativeApp } from './platform-service.js';

export async function shareLink({ title, text, url }) {
  if (isNativeApp()) {
    const { Share } = await import('@capacitor/share');
    try {
      await Share.share({ title, text, url });
      return true;
    } catch (err) {
      if (/canceled/i.test(err?.message || '')) return false;
      throw err;
    }
  }
  // Web Share API + 클립보드 폴백
  if (navigator.share) { /* navigator.share + AbortError 처리 */ }
  await navigator.clipboard.writeText(url).catch(() => {});
  return false;
}

export async function shareOrDownloadImage({ blob, filename, title, text }) {
  if (isNativeApp()) {
    const [{ Filesystem, Directory }, { Share }] = await Promise.all([
      import('@capacitor/filesystem'),
      import('@capacitor/share'),
    ]);
    const data = await blobToBase64(blob);
    const { uri } = await Filesystem.writeFile({ path: filename, data, directory: Directory.Cache });
    await Share.share({ title, text, url: uri });
    return 'shared';
  }
  // 웹: <a download> 클릭
  downloadBlobAsFile(blob, filename);
  return 'downloaded';
}
```

iOS share 시트의 「이미지 저장」 액션이 사진앱에 저장 (NSPhotoLibraryAddUsageDescription 권한 필요 — 7단계).

### 4-3. 콜사이트 통합

전 페이지의 `navigator.share(...)` / `<a download>` 직접 호출을 모두 위 service 함수로 교체:

- `src/App.jsx > ResultStep > handleShare`
- `src/pages/DesignDetail.jsx > handleNativeShare`, `handleDownload`
- `src/pages/ShareView.jsx > handleShare`
- `src/pages/CollectionPage.jsx > handleShare`
- `src/pages/Invite.jsx > handleShare`

가시성 게이트 (`navigator.share` 가 있을 때만 share 버튼 노출) 도 `isNativeApp() || navigator.share` 로 확장 — WKWebView 의 navigator.share 부재 시에도 share 버튼이 나오도록.

### 4-4. iOS Info.plist 권한 description

**경로**: `ios/App/App/Info.plist`

```xml
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Voda saves AI-generated interior renders to your Photos when you tap Save Image from the share sheet.</string>
<key>NSCameraUsageDescription</key>
<string>Voda uses the camera to capture photos of your space for AI redesign.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Voda lets you pick existing photos of your space for AI redesign.</string>
```

Apple 심사: 권한 사유 문자열이 모호하면 reject 됨. 「뭘 위해 쓰는지」 명확히.

---

## 5. Universal Links (Sprint A 6단계)

iOS 사용자가 https://voda-7647c.web.app/s/... 같은 링크를 탭했을 때 앱이 설치되어 있으면 앱이 열리도록.

### 5-1. 의존성

```bash
npm install --save @capacitor/app@^8
```

### 5-2. AASA 파일 호스팅

**경로**: `public/.well-known/apple-app-site-association` (확장자 없음)

```json
{
  "applinks": {
    "details": [
      {
        "appIDs": ["WG75TG59NJ.com.voda.app"],
        "components": [
          { "/": "/s/*" },
          { "/": "/c/*" },
          { "/": "/u/*" },
          { "/": "/designs/*" }
        ]
      }
    ]
  },
  "webcredentials": {
    "apps": ["WG75TG59NJ.com.voda.app"]
  }
}
```

`appIDs` 형식 = `<TeamID>.<BundleID>`.

### 5-3. firebase.json — Content-Type 헤더 + dot-file 허용

```json
{
  "hosting": {
    "ignore": ["firebase.json", "**/node_modules/**"],
    "headers": [
      {
        "source": "/.well-known/apple-app-site-association",
        "headers": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Cache-Control", "value": "public, max-age=300" }
        ]
      },
      {
        "source": "/.well-known/assetlinks.json",
        "headers": [
          { "key": "Content-Type", "value": "application/json" },
          { "key": "Cache-Control", "value": "public, max-age=300" }
        ]
      }
    ]
  }
}
```

⚠️ **`ignore` 의 `**/.*` 패턴 제거 필수** — 그게 있으면 `.well-known/` 가 deploy 에서 제외됨.

### 5-4. PWA Service Worker 가 AASA 가로채지 않도록

**경로**: `vite.config.js`

```js
workbox: {
  navigateFallbackDenylist: [
    /^\/__\//,
    /^\/\.well-known\//, // ← 추가
    /^\/.*googleapis\.com/,
  ],
}
```

이게 없으면 SW 가 `/.well-known/apple-app-site-association` 를 SPA 셸 (`index.html`) 로 응답해서 Apple 검증기가 「JSON 이 아니다」 라고 거절.

### 5-5. iOS entitlement

`ios/App/App/App.entitlements` 에 추가 (Sign-In entitlement 와 같은 파일):

```xml
<key>com.apple.developer.associated-domains</key>
<array>
  <string>applinks:voda-7647c.web.app</string>
  <string>applinks:voda-7647c.firebaseapp.com</string>
</array>
```

Apple Developer Console 의 App ID `com.voda.app` 에서도 ☑ **Associated Domains** capability 가 켜져있어야 함.

### 5-6. App URL listener (`NativeUrlHandler`)

**`src/App.jsx`** 에 컴포넌트 추가:

```jsx
function NativeUrlHandler() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isNativeApp()) return;
    let listener;
    (async () => {
      const { App: CapApp } = await import('@capacitor/app');
      listener = await CapApp.addListener('appUrlOpen', (event) => {
        const url = new URL(event.url);
        const path = `${url.pathname}${url.search}${url.hash}`;
        if (path && path !== '/') navigate(path);
      });
    })();
    return () => listener?.remove?.();
  }, [navigate]);
  return null;
}
```

`<BrowserRouter>` 안에서 `AuthRedirectHandler` 옆에 마운트.

### 5-7. 배포 + 검증

```bash
firebase deploy --only hosting
curl -I https://voda-7647c.web.app/.well-known/apple-app-site-association
# HTTP/2 200, Content-Type: application/json
curl https://voda-7647c.web.app/.well-known/apple-app-site-association
# JSON 본문이 그대로 나와야 함
```

**iOS 첫 설치 후 5-10분 정도 OS 가 AASA 다운로드해서 캐시**. 즉시 동작 안 할 수 있음. SMS 로 본인에게 링크 보내고 탭하면 검증 빠름.

---

## 6. 스토어 자산 + Privacy Manifest + 메타데이터 (Sprint A 7단계)

### 6-1. 자동 생성 도구

```bash
npm install --save-dev @capacitor/assets
```

### 6-2. 마스터 SVG (placeholder — 출시 전 디자이너 교체)

**경로**: `assets/`

- `icon-only.svg` — 1024×1024 검정 배경 + 흰 「V」 letter
- `icon-foreground.svg` — Android adaptive icon foreground (배경 없는 V)
- `icon-background.svg` — Android adaptive icon background (검정 사각형)
- `splash.svg` — 2732×2732 검정 + V

### 6-3. 자동 생성

```bash
npx capacitor-assets generate \
  --iconBackgroundColor '#000000' \
  --iconBackgroundColorDark '#000000' \
  --splashBackgroundColor '#000000' \
  --splashBackgroundColorDark '#000000'
```

→ iOS 4 + Android 61 + PWA 7 = 72 native asset 자동 생성.

⚠️ **알려진 부작용**: `capacitor-assets` 가 `public/manifest.json` 의 icon path 를 깨고 (`../icons/*.webp` 같은 잘못된 경로로), 또 `public/icon.svg` 를 삭제. 실행 후 `public/manifest.json` 을 원래 (`/icon-192.png`, `/icon-512.png`) 로 복구해야 함.

이미 있는 PWA 아이콘 (`public/icon-192.png`, `public/icon-512.png`) 은 충분하니 새로 만든 webp 는 무시.

### 6-4. Privacy Manifest (iOS 17+ 필수)

**경로**: `ios/App/App/PrivacyInfo.xcprivacy`

```xml
<dict>
  <key>NSPrivacyTracking</key>
  <false/>
  <key>NSPrivacyCollectedDataTypes</key>
  <array>
    <!-- 각 항목에 dataType, Linked, Tracking, Purposes -->
    <!-- UserID, EmailAddress, Name, PhotosOrVideos, OtherUserContent,
         ProductInteraction, CrashData -->
  </array>
  <key>NSPrivacyAccessedAPITypes</key>
  <array>
    <!-- UserDefaults (CA92.1), FileTimestamp (C617.1),
         SystemBootTime (35F9.1), DiskSpace (E174.1) -->
  </array>
</dict>
```

전체 내용은 실제 파일 (`ios/App/App/PrivacyInfo.xcprivacy`) 참조.

### 6-5. Xcode 프로젝트에 Privacy Manifest 등록

`ios/App/App.xcodeproj/project.pbxproj` 의 4곳에 추가:
1. **PBXBuildFile section** — 새 buildFile 항목
2. **PBXFileReference section** — 파일 참조
3. **App PBXGroup children** — 프로젝트 navigator 에 표시
4. **PBXResourcesBuildPhase files** — 빌드 시 번들에 포함

ID 예시: `AA0DA0001FED796500168000` (FileRef), `AA0DA0011FED796500168001` (BuildFile). 24자 hex 면 임의 OK, 다른 ID 와 충돌만 안 나면 됨.

### 6-6. 스토어 메타데이터 — `store-metadata.md`

App Store Connect / Play Console 에 입력할 텍스트 (영문 + 한글):
- 이름 (30자), 부제목 (30자), 홍보 텍스트 (170자), 설명 (4000자), 키워드 (100자), 카테고리, 연령 등급, 출시 체크리스트

상세는 `store-metadata.md` 참조.

---

## 7. iOS 빌드 → TestFlight (Sprint A 8단계)

### 7-1. 결제 UI iOS hide (정책 준수)

App Store 정책: 디지털 상품 앱은 외부 결제 안내 (Stripe 웹 등) 금지. RevenueCat IAP 붙기 전 임시로 결제 UI 통째로 숨김.

`isIOS()` 분기로 hide:
- `src/components/Header.jsx` — Pricing 메뉴
- `src/pages/Account.jsx` — View plans / Change plan / Manage billing / Buy credit pack 버튼
- `src/components/CreditModal.jsx` — Pro / Credit pack 옵션 (게스트 초대만 남김)
- `src/components/DesignChat.jsx` — chat turn 소진 시 Upgrade 버튼
- `src/pages/Pricing.jsx` — `useEffect` 로 iOS 진입 시 `/` 로 redirect, 즉시 null 반환
- `errInsufficientCredits` 카피 — 「or get more credits」 제거, 「come back tomorrow」 만

`HIDE_PAYMENTS_UI = isIOS()` 같은 모듈 상수 또는 인라인 분기 모두 OK. 런타임 평가라 PWA 웹은 영향 없음.

### 7-2. Xcode 워크스페이스 열기

```bash
npm run cap:open:ios
```

**`.xcworkspace`** 가 열려야 함 (`.xcodeproj` 가 아님). Capacitor 가 자동으로 워크스페이스 열어줌.

### 7-3. Apple Developer 계정 추가

Personal Team 만 보이면 paid team 추가 필요:

1. Xcode > Settings > **Accounts** 탭
2. 좌하단 **+** → Apple ID → Developer Program 가입한 계정으로 로그인
3. 우측 패널에 「Uihyun Kim (`WG75TG59NJ`)」 표시 확인

### 7-4. Signing & Capabilities

좌측 Project Navigator 의 파란 「App」 → TARGETS > App > **Signing & Capabilities**:

- ☑ Automatically manage signing
- Team: **Uihyun Kim (`WG75TG59NJ`)** ← Personal Team 아님
- Bundle Identifier: `com.voda.app` (이미 박힘)
- Capability 목록:
  - Sign In with Apple
  - Associated Domains (`applinks:voda-7647c.web.app`, `applinks:voda-7647c.firebaseapp.com`)

빨간 에러는 보통 provisioning profile 자동 생성 중 — 잠시 기다리거나 「Try Again」.

### 7-5. Archive

상단 device target 을 **「Any iOS Device (arm64)」** 로 변경 (시뮬레이터 X) → **Product > Archive** → 5-10분.

끝나면 자동으로 Organizer 창이 뜸.

### 7-6. Distribute App

Organizer > 방금 만든 archive > **Distribute App** > **App Store Connect** > **Upload** > Next 진행.

코드 사이닝: Automatically manage signing 유지.

업로드 5-15분 → 「Upload Successful」.

### 7-7. App Store Connect

https://appstoreconnect.apple.com/apps → Voda → **TestFlight** 탭

- 빌드가 「Processing」 (10-30분) → 「Ready to Submit」
- 빌드 행 클릭 → Compliance: Encryption「No」 (또는 Info.plist 에 `ITSAppUsesNonExemptEncryption = false`)
- 좌측 **Internal Testing** > 「+」 > 그룹 추가 (본인 자동 포함) → 빌드 활성화

본인 iPhone 의 **TestFlight 앱** 으로 같은 Apple ID 로그인 → Voda 빌드 → Install.

### 7-8. 실기 테스트 체크리스트

- [ ] 앱 시작 → splash → 로딩
- [ ] **Sign in with Apple** 동작
- [ ] 사진 업로드 → 카메라/사진 권한 다이얼로그
- [ ] 디자인 생성 → 결과
- [ ] 공유 / 다운로드 (share 시트의 「이미지 저장」 → 사진앱)
- [ ] **Universal Links** — Safari 또는 SMS 의 https://voda-7647c.web.app/s/... 탭 → Voda 앱에서 열림
- [ ] **결제 UI 모두 hide** (Pricing 메뉴 / Upgrade 버튼 / 외부 결제 유도 카피 없음)
- [ ] 크레딧 0 → 「Come back tomorrow」 메시지만

---

## 7-bonus. Firebase Web SDK 를 Capacitor WKWebView 에서 살리기 ⚠️

이 단계는 처음 셋업할 때 **반드시 봐야 함** — 안 보고 가면 「피드가 계속 로딩 중인데 에러는 안 뜸」 이라는 진단 불가능한 상태에 갇힘. 우리 첫 셋업에선 이거 발견하는 데 하루 가까이 들었음.

### 증상

- 사파리/PWA 에선 정상
- 네이티브 앱 안에서만 Firestore read 가 영원히 hang
- 화면에 에러 안 뜨고 Web Inspector console 도 비어있음 (혹은 opaque `Script error.` 만)

### 원인

WKWebView 의 origin 은 default 로 `capacitor://localhost` (또는 `https://localhost` 로 변경 가능). Firebase Auth 의 default `getAuth(app)` 는 **popup-based OAuth helper 를 lazy-load** — 어떤 redirect/popup 관련 코드 경로가 호출될 때 (또는 그냥 시작 시 `getRedirectResult` 호출) `https://apis.google.com/_/scs/...` 의 외부 스크립트를 동적으로 로드한다.

`capacitor://` 와 `https://localhost` 둘 다 WKWebView 가 **cross-origin** 으로 평가하는 케이스가 있어 그 외부 스크립트 평가가 거부되고, throw 가 main thread 의 onerror 로 propagate 되면서 **「Script error.」 로 마스킹**. 그 다음 자기 jserror endpoint (`apis.google.com/_/jserror`) 로 리포트 시도 → 그것도 fail. 그동안 main thread 는 망가졌고 그 thread 위에서 도는 Firestore SDK 의 promise 들도 다 죽음.

### 진단 단서

디버그 패널 / DevTools console 에서 `apis.google.com/_/scs` 또는 `apis.google.com/_/jserror` 호출이 보이면 100% 이 케이스.

### Fix

`src/firebase.js` 에 `isNativeApp()` 분기로 다음 세 가지를 같이 적용:

```js
import { getAuth, initializeAuth, indexedDBLocalPersistence,
         signInAnonymously, getRedirectResult } from 'firebase/auth';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

// 1. Auth: native 에선 popupRedirectResolver 없이 init
export const auth = isNativeApp()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);

// 2. Firestore: native 에선 long-polling 강제
export const db = isNativeApp()
  ? initializeFirestore(app, {
      experimentalForceLongPolling: true,
      useFetchStreams: false,
    })
  : getFirestore(app);

// 3. getRedirectResult 도 native 에선 skip — popup helper 의 또 다른 trigger
const attachAuthState = () => {
  auth.onAuthStateChanged((user) => {
    if (!user) signInAnonymously(auth).catch(() => {});
  });
};
if (isNativeApp()) {
  attachAuthState();
} else {
  getRedirectResult(auth).catch(() => null).finally(attachAuthState);
}

// 4. Analytics: native 에선 cookie 거부로 throw → firebase.js 의 다른
//    export 까지 깨뜨림. 호출 사이트 호환을 위해 callable Proxy 로
//    no-op 처리 (logEvent(analytics, ...) 가 silent fail).
let _analytics = null;
try { if (!isNativeApp()) _analytics = getAnalytics(app); } catch {}
const noopFn = () => undefined;
export const analytics = _analytics || new Proxy(noopFn, {
  get: (_t, p) => (_analytics && p in _analytics ? _analytics[p] : noopFn),
  apply: () => undefined,
});
```

Apple / Google sign-in 은 native 에서 Capacitor 플러그인이 처리하므로 popup helper 불필요.

### Status Bar / Safe Area 도 같이 챙길 것

- `index.html` viewport meta 에 `viewport-fit=cover`
- `@capacitor/status-bar` 플러그인 추가 → `main.jsx` 에서 native 일 때 `setOverlaysWebView({ overlay: true })` + `setStyle({ style: Style.Dark })` (밝은 배경) 호출
- `<body>` 에 `.is-native` 클래스 추가 + CSS 에서 `body.is-native .header { padding-top: calc(.75rem + max(env(safe-area-inset-top, 0px), 50px)); }` — `env()` 가 0 으로 평가되는 케이스 있어서 `max()` fallback 필요

---

## 8. 잔여 단계

### 8-1. Sprint A 4단계 — RevenueCat IAP (TestFlight 동작 확인 후)

상품 정의: Pro 월/연 구독, Studio 월/연 구독, 크레딧 팩.

순서:
1. RevenueCat 계정 (https://app.revenuecat.com) + Voda 프로젝트 생성
2. App Store Connect 에 IAP 상품 등록 + RevenueCat 에 매핑
3. RevenueCat Capacitor SDK 설치 + Firebase uid ↔ RevenueCat appUserID 매핑
4. 서버 웹훅 (`functions/revenuecatWebhook`) → `users/{uid}.plan` / `credits` 갱신 (기존 Stripe 웹훅과 같은 로직 공유)
5. iOS 결제 UI un-hide (`isIOS() && hasIAPProducts` 같은 분기), Stripe 버튼은 그대로 hide
6. 새 Build 번호 → 외부 베타 → 정식 제출

### 8-2. Sprint B — Android 출시 (1-2주)

대부분 동일 코드. 추가 작업:
- Android 빌드 (Capacitor 가 거의 자동)
- Production keystore 생성 + 보관 (분실 시 앱 업데이트 불가)
- Google Play Billing via RevenueCat (상품 재정의 필요)
- App Links — `public/.well-known/assetlinks.json` 신규 (production keystore 의 SHA-256 fingerprint 필요)
- AndroidManifest.xml 의 deep-link intent-filter 추가
- Adaptive icon (이미 7단계에서 생성됨)
- Play Console 자산 + 메타데이터 (`store-metadata.md` 참조)

### 8-3. Sprint C — 푸시 알림 (1주, 출시 후 OK)

PRODUCT_PLAN §8-6.

순서:
1. `@capacitor/push-notifications` + `firebase-messaging` 추가
2. `public/firebase-messaging-sw.js` 신규 (웹 푸시 SW)
3. `users/{uid}.fcmTokens` 배열에 토큰 등록
4. 사용자 알림 설정 UI (`/account/notifications`)
5. 서버 트리거 (`functions/sendPush.js`):
   - 디자인 생성 완료 (Cloud Function 자체 트리거)
   - 좋아요 (onCreate)
   - 주간 다이제스트 (pubsub 스케줄)
   - 일일 보너스 리마인더 (24h 미접속)
6. iOS APNs 키 등록 (Apple Developer Console > Keys > Apple Push Notifications service)
7. Firebase Console 의 Cloud Messaging 에 APNs 키 업로드

---

## 9. 주요 파일 / 디렉토리

```
voda/
├── capacitor.config.json              # Capacitor 설정 (appId, appName, webDir)
├── ios/                                # iOS 네이티브 프로젝트
│   ├── App/
│   │   ├── App/
│   │   │   ├── App.entitlements        # Sign in with Apple + Associated Domains
│   │   │   ├── Info.plist              # 권한 description, bundle 메타
│   │   │   ├── PrivacyInfo.xcprivacy   # iOS 17+ 필수 Privacy Manifest
│   │   │   ├── Assets.xcassets/        # AppIcon, Splash (자동 생성)
│   │   │   └── public/                 # cap sync 가 dist 복사 (gitignored)
│   │   └── App.xcworkspace             # 이걸 Xcode 로 열어야 함 (.xcodeproj 아님)
│   └── .gitignore                      # Capacitor 자동 생성
├── android/                            # Android 네이티브 프로젝트
│   ├── app/
│   │   ├── build.gradle
│   │   └── src/main/
│   │       ├── AndroidManifest.xml
│   │       └── res/
│   │           ├── mipmap-*/           # adaptive icon (자동 생성)
│   │           └── drawable-*/         # splash (자동 생성)
│   └── .gitignore
├── assets/                             # 마스터 SVG (capacitor-assets 입력)
│   ├── icon-only.svg
│   ├── icon-foreground.svg
│   ├── icon-background.svg
│   └── splash.svg
├── public/
│   └── .well-known/
│       └── apple-app-site-association  # AASA (Universal Links)
├── src/services/
│   ├── platform-service.js             # isNativeApp / isIOS / isAndroid / isWeb
│   ├── share-service.js                # shareLink / shareOrDownloadImage
│   └── auth-service.js                 # signInWithApple 분기 추가
├── firebase.json                       # AASA Content-Type 헤더 + functions runtime
├── vite.config.js                      # SW navigateFallbackDenylist 에 /.well-known/
├── store-metadata.md                   # App Store / Play Store 메타데이터 (EN+KO)
├── IOS_BUILD_GUIDE.md                  # Xcode → TestFlight 빠른 가이드
└── CAPACITOR_SETUP.md                  # 이 문서
```

---

## 10. 자주 쓰는 명령

```bash
# 평소 개발
npm run dev                              # vite 웹 개발 서버

# 네이티브 동기화 (코드 / 의존성 변경 후)
npm run cap:sync                         # build + cap sync

# Xcode / Android Studio 열기
npm run cap:open:ios
npm run cap:open:android

# 직접 cap 명령
npx cap sync                             # build 없이 sync 만
npx cap copy                             # web 자산만 복사 (plugin 등록 X)
npx cap update                           # plugin 갱신

# iOS 빌드 (Xcode 로 하지만 CLI 도)
xcodebuild -workspace ios/App/App.xcworkspace -scheme App -configuration Release archive
```

---

## 11. 주요 시크릿 / 식별자

| 항목 | 값 | 보관처 |
|------|-----|--------|
| Apple Team ID | `WG75TG59NJ` | 공개 OK |
| Apple App ID (Bundle) | `com.voda.app` | 공개 OK |
| Apple Service ID (Web Sign-In) | `com.voda.app.signin` | 공개 OK |
| Apple Sign-In Key ID | `G3Q44RRZ7R` | 공개 OK (단, .p8 파일은 비공개) |
| Apple Sign-In .p8 | `AuthKey_G3Q44RRZ7R.p8` | **1Password / 비번 매니저** (절대 git X) |
| Firebase Project | `voda-7647c` | 공개 OK |
| Firebase Hosting Domain | `voda-7647c.web.app` + `.firebaseapp.com` | 공개 OK |

---

## 12. 트러블슈팅

| 증상 | 원인 / 조치 |
|------|------|
| `npx cap add ios` 가 CocoaPods 에러 | `gem install cocoapods` 또는 `brew install cocoapods` |
| Xcode Archive 메뉴 회색 | device target 이 시뮬레이터 — 「Any iOS Device」 선택 |
| Sign in with Apple 「Service ID 가 없다」 | Firebase Console 에 Service ID 입력 누락 또는 Apple Developer 의 Service ID 의 Return URL 이 Firebase auth handler 와 안 맞음 |
| Apple ID 로그인 후 displayName 비어있음 | Apple 은 first-login 에만 줌 — `_applyAppleFirstLoginName` 에서 `updateProfile` 호출 확인 |
| Universal Links 가 Safari 로 열림 | (1) `curl /.well-known/apple-app-site-association` Content-Type application/json 인지. (2) iOS 가 AASA 캐시하는 5-10분 기다리기. (3) SW 가 가로채면 안 됨 (`navigateFallbackDenylist`) |
| TestFlight 「Missing Compliance」 | 빌드 행에서 Encryption 질문 답 또는 Info.plist 에 `ITSAppUsesNonExemptEncryption = false` |
| TestFlight Processing 가 30분+ | App Store Connect 의 Activity 탭에서 invalidation 메일 확인. 보통 entitlement / Privacy Manifest 누락 |
| `capacitor-assets generate` 후 PWA 아이콘 깨짐 | `public/manifest.json` 의 icon path 가 `../icons/*.webp` 로 망가짐. `/icon-192.png`, `/icon-512.png` 로 복구 |
| 「Personal Team」 만 보임 | Xcode > Settings > Accounts 에 Apple Developer Program 가입한 Apple ID 로그인 누락 |
| `cap sync` 출력에 우리 plugin 없음 | `node_modules` 재설치 또는 `npx cap update` |
| Xcode 처음 열 때 「Update to recommended settings」 다이얼로그 + 우상단 ⚠️ 1 | Capacitor 가 Xcode 8 compatibility 로 만들어서. 모든 체크박스 그대로 두고 「Perform Changes」 (§2-3 참조) |
| Xcode 빌드 시 `Missing package product 'CapApp-SPM'` + `apple-sign-in depends on capacitor-swift-pm 7.x and share depends on 8.x` | Capacitor 8 + apple-sign-in 호환 문제. v7 로 다운그레이드 (§2-1 참조) |
| Xcode Archive 시 `Sandbox: bash deny(1) file-read-data Pods-App-frameworks.sh: Operation not permitted` | 「Update to recommended settings」 가 켠 User Script Sandboxing 이 CocoaPods 와 충돌. NO 로 (§2-3 참조) |
| 네이티브 앱에서 Firestore read 가 영원히 hang + `[xhr>] apis.google.com/_/jserror` 또는 `_/scs` 호출 보임 + 화면에 에러 0 | Firebase Auth 의 popup OAuth helper 가 cross-origin 으로 막혀 main thread 죽임. native 에서 `initializeAuth(app, { persistence: indexedDBLocalPersistence })` + `getRedirectResult` skip + Firestore long-polling (§7-bonus 참조) |
| 네이티브 헤더가 iOS 시간/배터리 표시와 같은 줄에 겹침 | `viewport-fit=cover` + `body.is-native .header { padding-top: calc(.75rem + max(env(safe-area-inset-top, 0px), 50px)); }` (§7-bonus 참조). `@capacitor/status-bar` 의 `setOverlaysWebView({ overlay: true })` 와 함께 |

---

## 13. 「from scratch」 minimal 명령 (재셋업)

이미 다 한 상태에서, 만약 ios/ android/ 디렉토리가 통째로 사라지면:

```bash
# 1. 의존성은 package.json 에 이미 있으니 npm install
npm install

# 2. native 프로젝트 재생성
npm run build
npx cap add ios
npx cap add android

# 3. 우리가 직접 추가한 파일들이 새 native 프로젝트로 안 옮겨짐 — 수동 복원:
# - ios/App/App/App.entitlements (Sign-In + Associated Domains)
# - ios/App/App/PrivacyInfo.xcprivacy
# - ios/App/App/Info.plist 의 권한 description 추가
# - ios/App/App.xcodeproj/project.pbxproj 의:
#   - CODE_SIGN_ENTITLEMENTS = App/App.entitlements
#   - PrivacyInfo.xcprivacy 의 4곳 등록
# 위 파일들은 git history 에 있으니 git checkout 으로 복구 가능

# 4. 자동 생성 자산 재생성
npx capacitor-assets generate \
  --iconBackgroundColor '#000000' \
  --iconBackgroundColorDark '#000000' \
  --splashBackgroundColor '#000000' \
  --splashBackgroundColorDark '#000000'
# public/manifest.json 복구 (icon path)

# 5. cap sync 최종 확인
npm run cap:sync
```

---

## 14. 참고 링크

- Capacitor 8 docs — https://capacitorjs.com/docs
- Apple Developer Portal — https://developer.apple.com/account
- App Store Connect — https://appstoreconnect.apple.com
- Firebase Console — https://console.firebase.google.com/project/voda-7647c
- AASA validator — https://branch.io/resources/aasa-validator/ (SMS 통한 실기 검증이 가장 신뢰)
- Apple Privacy Manifest 카테고리 + reason 코드 — https://developer.apple.com/documentation/bundleresources/privacy_manifest_files

---

작성일: 2026-04-29
Sprint A 1+2+3+5+6+7 단계 완료, 8단계 코드 준비 완료, 4단계 (RevenueCat IAP) 미진행.
