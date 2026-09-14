# DrapeShare — iOS Share Extension (one-time Xcode setup)

The Swift/plist here are ready; the TARGET must be added in Xcode's GUI
(hand-editing project.pbxproj for a new target is fragile — 2 minutes of
clicking is the reliable path).

1. Xcode → open `ios/App/App.xcworkspace`.
2. File → New → Target… → iOS → **Share Extension** → Product Name:
   `DrapeShare`, Language: Swift, Embed in Application: App → Finish.
   ("Activate scheme?" → Cancel is fine.)
3. In the new `DrapeShare` group Xcode created:
   - DELETE the generated `ShareViewController.swift`, and add THIS folder's
     `ShareViewController.swift` to the DrapeShare target instead
     (right-click group → Add Files…, check "DrapeShare" target only).
   - Replace the generated Info.plist's `NSExtension` block with the one in
     THIS folder's `Info.plist` (or point the target's Info.plist setting at
     this file). Key part: activation rule = 1 web URL or text.
   - The generated `MainInterface.storyboard` can stay as-is (the controller
     dismisses itself immediately).
4. Target settings (DrapeShare):
   - Bundle Identifier: `com.uihyun.drape.share`
   - iOS Deployment Target: match the App target.
   - Signing: same team as App.
5. Build & run the App scheme on a device → Safari에서 아무 상품 페이지 →
   공유 → drape → 앱이 열리며 /import → 분석 화면으로 이어지면 성공.

No App Group needed (v1 hands off links via the `drape://` URL scheme —
already registered in the main app's Info.plist). Image shares are a v2
item; they'd need an App Group container.
