#!/usr/bin/env bash
# 한 번에 빌드 + Firebase Hosting 배포 + iOS Capacitor sync.
# 사용:
#   ./scripts/ship.sh             # 기본: 웹 빌드 + hosting + cap sync
#   ./scripts/ship.sh --functions # 위 + functions 까지 같이 배포
#   ./scripts/ship.sh --skip-ios  # iOS sync 건너뜀 (PWA 만 푸시)
#   ./scripts/ship.sh --rules     # firestore rules + indexes 도 배포
# 모든 step 은 fail-fast (set -e). tail -3 으로 출력 압축.

set -e
cd "$(dirname "$0")/.."

WITH_FUNCTIONS=false
WITH_RULES=false
SKIP_IOS=false

for arg in "$@"; do
  case $arg in
    --functions) WITH_FUNCTIONS=true ;;
    --rules)     WITH_RULES=true ;;
    --skip-ios)  SKIP_IOS=true ;;
    *) echo "unknown flag: $arg"; exit 1 ;;
  esac
done

# ─── 1. Web build ──────────────────────────────────────────────────
echo "▸ Building web (vite)…"
npm run build 2>&1 | tail -3
echo

# ─── 2. Firestore rules + indexes (optional) ──────────────────────
if [ "$WITH_RULES" = true ]; then
  echo "▸ Deploying Firestore rules + indexes…"
  firebase deploy --only firestore 2>&1 | tail -5
  echo
fi

# ─── 3. Cloud Functions (optional) ────────────────────────────────
if [ "$WITH_FUNCTIONS" = true ]; then
  echo "▸ Deploying Cloud Functions…"
  firebase deploy --only functions 2>&1 | tail -5
  echo
fi

# ─── 4. Hosting ────────────────────────────────────────────────────
echo "▸ Deploying to Firebase Hosting…"
firebase deploy --only hosting 2>&1 | tail -5
echo

# ─── 5. iOS Capacitor sync ────────────────────────────────────────
if [ "$SKIP_IOS" = false ]; then
  echo "▸ Syncing iOS Capacitor…"
  npx cap sync ios 2>&1 | tail -3
  echo
fi

echo "✔ Ship complete."
echo "  Web:    https://archelier.co"
echo "  iOS:    open ios/App/App.xcworkspace in Xcode → Run"
