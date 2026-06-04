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
  using Google's Gemini image model. Identity photos are used only for this,
  are private to the account, and can be removed in Settings.
- No third-party model/celebrity photos are used.

USER-GENERATED CONTENT (Guideline 1.2)
- Users can post looks to a public feed, comment, send direct messages, and
  list items in a peer-to-peer marketplace.
- Moderation: every post/comment/listing/profile can be REPORTED (flag icon),
  and users can BLOCK each other. Reported content is queued for review and
  offending content/users are removed. A EULA prohibiting objectionable
  content and abusive users is presented at sign-up.

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

## Still-to-do checklist (ASC, user-side)

- [ ] **Review Notes (메모)** — paste the block above (this is the empty field in the screenshot).
- [ ] **로그인 정보** — uncheck "로그인 필요" OR note Sign in with Apple (fields can stay empty).
- [ ] **Screenshots** — 6.7" (and any required sizes), EN + KO + JA.
- [ ] **Privacy Policy URL** — https://drape.nyc/privacy reachable.
- [ ] **App Privacy** questionnaire matches the Privacy Policy (done earlier — re-verify after marketplace/DM).
- [ ] **Export compliance** — `ITSAppUsesNonExemptEncryption = false` in Info.plist (HTTPS-only).
- [ ] **Sign in with Apple** entitlement present (Guideline 4.8 — Google is offered, so Apple is required).
- [ ] **Build** uploaded via TestFlight + export-compliance answered.
