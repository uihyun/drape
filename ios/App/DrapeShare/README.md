# DrapeShare — iOS Share Extension

**The target is ALREADY WIRED into project.pbxproj (2026-09-14, hand-added
and verified: `xcodebuild -list` shows both targets; App scheme simulator
build succeeds with DrapeShare.appex embedded in PlugIns/).** No Xcode setup
steps needed — just open the workspace and archive as usual.

What it does: v1 handles LINK/TEXT shares — grabs the shared URL and hands
it to the host app via `drape://import?...` (scheme registered in the main
app's Info.plist; appUrlOpen routes it to /import). No App Group needed.
Image shares are a v2 item (they'd need an App Group container).

Files:
- `ShareViewController.swift` — programmatic (NSExtensionPrincipalClass, no
  storyboard); tries `extensionContext.open` then the responder-chain
  fallback, always calls completeRequest.
- `Info.plist` — activation rule: 1 web URL or text.

Target settings live in project.pbxproj: bundle id `com.uihyun.drape.share`,
automatic signing (team WG75TG59NJ), versions pinned to the app's
(MARKETING_VERSION 2.1.0 / CURRENT_PROJECT_VERSION 16 — bump alongside the
app's three version spots).

First device build: Xcode will auto-provision the new bundle id — if it
asks, just let automatic signing register it.

Smoke test on device: Safari에서 상품 페이지 → 공유 → drape → 앱이 열리며
/import → 분석 화면. (공유 시트에 drape가 안 보이면 '더 보기'에서 활성화.)
