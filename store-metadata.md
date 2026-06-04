# drape — App Store Connect metadata (paste-ready)

Single source for the ASC text fields + the **App Review 메모 (Review Notes)** body.
Keep in sync with `APP_STORE_SUBMISSION.md` (the how-to) and the in-app legal copy.

Contact: hello@uhzlab.com · Support/Marketing URL: https://drape.nyc · Privacy: https://drape.nyc/privacy

---

## App Review Information — 로그인 정보

The app offers **Sign in with Apple**, so a demo account is NOT required — the
reviewer signs in with their own Apple ID. Anonymous "guest" browsing also works.

→ In ASC: either **uncheck "로그인 필요"** (login is optional — guest browsing covers
the core), or leave it checked and paste the note below. Username/password fields
can stay empty (we have no email/password login).

If a reviewer prefers a seeded account, provide a Google test account's
email + password in the fields and tell them to tap "Continue with Google".

---

## App Review Information — 메모 (Review Notes) — paste this

```
Thanks for reviewing drape.

AUTHENTICATION / GUEST ACCESS
- Sign in with Apple or Google. You can use your own Apple ID — no demo
  account needed. Anonymous "guest" browsing is also available from the
  welcome screen, so the feed and most browsing work without signing in.
- Signing in is only needed to build a closet, run try-on, post, or message.

AI VIRTUAL TRY-ON
- The user uploads 2–3 of their OWN full-body photos ("identity photos").
- We generate a try-on image of the user's body wearing a selected garment
  using Google's Gemini image model. Identity photos are private to the
  account, used ONLY for generating the user's own try-ons, and are NOT used
  to train any model. They can be removed in Settings.
- Generated try-ons can be deleted by the user (Try-on history → delete).
- No third-party model/celebrity photos are used.

USER-GENERATED CONTENT & MESSAGING (Guideline 1.2)
- Users can post looks to a public feed, comment, send direct messages, and
  list items in a peer-to-peer marketplace.
- REPORT: a post/OOTD/board/listing via its ⋯ menu → Report; a user via their
  profile ⋯ → Report. BLOCK: a user via their profile ⋯ → Block — a blocked
  user's posts/messages are hidden from the blocker.
- A EULA prohibiting objectionable content and abusive users is shown at
  sign-up; reported content/users are reviewed and removed (within 24h).

MARKETPLACE (physical goods)
- Listings are pre-owned clothing (physical goods). Buyers and sellers arrange
  the transaction OFF-PLATFORM via in-app direct messages.
- There is NO in-app payment for marketplace items.

IN-APP PURCHASES / SUBSCRIPTIONS
- drape has NO in-app purchases and NO subscriptions. All features are free.

ACCOUNT DELETION (Guideline 5.1.1(v))
- Settings → Delete Account → confirm. This deletes the Firebase Auth user and
  all of the user's Firestore data + Storage files (closet, outfits, OOTDs,
  generations, messages). A screen recording of this flow is available on request.

CONTACT
- hello@uhzlab.com
```

---

## Listing copy (current, finalized)

**Promotional text (170)**
Build your digital closet, try anything on yourself with AI, and log every outfit. Your wardrobe, finally in one place.

**Description** — see the screenshot/ASC; lead is "drape is where your wardrobe lives." with the six bullets (closet / try-on / OOTD calendar / outfits & boards / lookbook feed / marketplace).

**Keywords (100)**
wardrobe,fashion,style,lookbook,clothes,ai stylist,dressing room,fit check,capsule,virtual fitting
- Optional swap now that marketplace shipped: drop one low-value term for `resale` or `preloved`.

(KO / JA description + keyword strings: keep the versions already entered in ASC.)

---

## Pre-archive technical state — VERIFIED in repo (2026-06-04)

These are the archive/build gotchas archelier (../voda) hit; for drape they're already handled:
- ✅ `ENABLE_USER_SCRIPT_SANDBOXING = NO` in project.pbxproj — Archive won't fail with the
  CocoaPods "Sandbox: bash deny …Pods-App-frameworks.sh" error.
- ✅ `ITSAppUsesNonExemptEncryption = false` in `ios/App/App/Info.plist` — no export-compliance
  dialog on every upload.
- ✅ Sign in with Apple entitlement present (`ios/App/App/App.entitlements`).
- ✅ In-app account deletion exists (`functions/account.js` nuclear delete + `DeleteAccountModal.jsx`).
- ✅ No IAP / no subscriptions → none of archelier's subscription-review gotchas (3.1.2(c),
  45-char subscription description, paywall clarity) apply.
- Version 1.0.0, build 1 (first submission — build 1 is fine; bump CURRENT_PROJECT_VERSION for any
  resubmission, keep MARKETING_VERSION).

## ⚠️ Outstanding — verify BEFORE submitting (beyond screenshots + archive)

1. **Apple Sign-In end-to-end** — the reviewer will likely log in with Sign in with Apple. Portal
   setup was previously flagged outstanding. **On a real device, complete a full Apple sign-in →
   land in the app** before submitting. (Firebase Apple provider enabled + key; native iOS uses
   the device Apple ID.) A broken reviewer login = rejection.
2. **Push notifications** — `PushService` requests permission + registers, but the iOS **Push
   Notifications capability / `aps-environment` entitlement is NOT set**, and no APNs key is wired.
   So push is non-functional on iOS today. For v1 either (a) add the Push Notifications capability
   in Xcode + enable Push on the App ID + upload an APNs auth key to Firebase, or (b) ship without
   push (the in-app Firestore badge already covers it) — just confirm the permission prompt doesn't
   misfire. Not a review blocker either way.
3. **App Review 메모** — paste the block above into ASC → App Review Information → Notes (it was
   empty in the screenshot). This is the #1 thing reviewers read.
4. **Cold-start with a brand-new account** — no crash, empty feed/marketplace shows a placeholder
   not a blank/hanging screen. Test on a real device + simulator; if universal, test **iPad
   landscape** (archelier was reviewed on an iPad).

## Submission gotchas to remember (from archelier's actual review)

- **Screenshots:** upload to the **6.9" (1290×2796) slot** — Apple auto-derives the smaller sizes.
  Putting a 6.9" image in the 6.5" slot errors. 3–8 shots, EN/KO/JA.
- **Build selection:** the build must be **"Ready to Submit" in TestFlight** (not "Processing") and
  have export compliance answered, or it won't appear in the build picker.
- **One active submission per app**; the submission draft should show just "iOS App 1.0.0".
- **Account-deletion screen recording** is only requested if 5.1.1 gets flagged on resubmission —
  film it on a **real device** (sign in → Settings → Delete Account → confirm), host the link, and
  paste it into the **permanent** App Review Notes so future builds aren't re-asked.

## Still-to-do checklist (ASC, user-side)

- [ ] **Review Notes (메모)** — paste the block above (this is the empty field in the screenshot).
- [ ] **로그인 정보** — uncheck "로그인 필요" OR note Sign in with Apple (fields can stay empty).
- [ ] **Screenshots** — 6.7" (and any required sizes), EN + KO + JA.
- [ ] **Privacy Policy URL** — https://drape.nyc/privacy reachable.
- [ ] **App Privacy** questionnaire matches the Privacy Policy (done earlier — re-verify after marketplace/DM).
- [ ] **Export compliance** — `ITSAppUsesNonExemptEncryption = false` in Info.plist (HTTPS-only).
- [ ] **Sign in with Apple** entitlement present (Guideline 4.8 — Google is offered, so Apple is required).
- [ ] **Build** uploaded via TestFlight + export-compliance answered.
- [ ] **Developer name → "uhz LLC"** — the App Store seller name follows the Apple Developer
      account type: Individual shows the personal legal name (Uihyun Kim), Organization shows the
      LLC. To show "uhz LLC" you need an **Organization account** (D-U-N-S # for the LLC). No
      payout/tax impact while there are NO in-app purchases, so it's cleanest to set the entity
      **before monetizing**. Individual→Org later = an app transfer + splitting that year's income
      across two tax entities. Can be changed/re-applied later, but more friction.
