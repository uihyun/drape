# Store listing — German (Germany)

Informal `du` throughout, matching `src/locales/de.js` — the register German
fashion and lifestyle apps use; `Sie` would read like a bank. One German for
Germany, Austria and Switzerland (Swiss spelling differs only in ß, which none
of the store fields below depend on). Character limits are annotated — both
stores reject the whole submission on overflow.

## App Store Connect

**Name** (≤30, currently 25) — "kleiderschrank app" is the top German search
for the category, and "kleiderschrank & anprobe" runs to 31, one over:

```
drape: kleiderschrank-app
```

**Subtitle** (≤30, currently 30) — lowercase per the brand rule, like every
other locale (search is case-insensitive, so German noun capitals buy nothing
here), and avoiding *kleiderschrank*, which the name already carries:

```
ki-stylist & virtuelle anprobe
```

**Promotional text** (≤170, currently 166 — editable without a new build, use
it for campaigns):

```
Fotografiere deine Kleidung, bau deinen digitalen Kleiderschrank und probier jedes Teil virtuell an. Dein KI-Stylist stellt Looks aus dem zusammen, was du schon hast.
```

**Keywords** (≤100 chars, currently 100 — at the cap, so any addition means a
removal) — a new locale, so there is no live set to protect; this can go in
as-is. Words already in the name or subtitle are left out on purpose: Apple
indexes name + subtitle + keywords together, so a repeat is spent budget.
*outfit* + *planen* are separate words because Apple combines them, covering
"Outfit planen" and "Outfit App" with one budget:

```
outfit,planen,mode,kleidung,garderobe,style,styling,anprobieren,lookbook,trends,ootd,capsule,fashion
```

**Description** (≤4000):

```
Dein ganzer Kleiderschrank, immer dabei.

Fotografiere jedes Teil, und drape baut daraus einen aufgeräumten digitalen Kleiderschrank: Hintergrund freigestellt, Kategorie, Farbe und Saison automatisch getaggt. Mit zwei, drei Ganzkörperfotos von dir probierst du per KI an, was du willst – bevor du es kaufst und bevor du es anziehst. Ein Look an jemand anderem gefällt dir? Stell ihn komplett an dir nach.

• Digitaler Kleiderschrank – fotografiere deine Kleidung; wir stellen das Teil frei und taggen Kategorie, Farbe und Saison.
• Virtuelle Anprobe – ein einzelnes Teil oder ein ganzer Look, an deinem eigenen Körper. Die KI behält dein Gesicht und deine Pose bei.
• KI-Stylist – wähl deinen persönlichen Stylisten und bekomm Looks nur aus Kleidung, die du schon hast.
• OOTD-Kalender – halte fest, was du jeden Tag getragen hast, und bau dir deine Stilhistorie auf.
• Looks und Boards – kombiniere Teile zu Outfits und sammle deine Inspiration auf Boards.
• Trends – jeden Montag eine neue Ausgabe: die Styles, Farben und Marken der Woche.

Dein Kleiderschrank, deine Umkleide, dein Stiltagebuch. Alles in drape.
```

## Google Play Console

**App name** (≤30, currently 25):

```
drape: kleiderschrank-app
```

**Short description** (≤80, currently 75):

```
Dein digitaler Kleiderschrank: alles per KI anprobieren und Outfits planen.
```

**Full description** (≤4000) — reuse the App Store description above verbatim;
Play renders the bullet characters fine and the length is well within cap.

## Owner checklist

- [ ] App Store Connect → this version → **+ German** → paste the fields above.
      Screenshots: the English set is reused automatically unless a German set
      is uploaded; the poster headlines are burned into the image, so a proper
      German set means rendering `node scripts/build-store-posters.cjs de` once
      the script carries `de` lines.
- [ ] Play Console → Main store listing → **Add German – de-DE**. Play caps
      phone screenshots at 8: skip the two `-ios-only` posters.
- [ ] Both: privacy policy URL stays `https://drape.nyc/privacy.html` — the page
      carries a German tab, no separate URL needed.
- [ ] Verify the build declares German: `ios/App/App/Info.plist` →
      `CFBundleLocalizations` must list `de`, otherwise the App Store shows the
      app as English-only regardless of the listing.

**What's New** (≤4000) — 2.3.1:

```
Gemacht für große Kleiderschränke.

- Wähl in Boards, Outfits und bei der Anprobe aus deinem ganzen Kleiderschrank.
- Dein Stylist sieht alles, was du hast, antwortet schneller und sagt dir Bescheid, sobald die Antwort da ist.
- Ein schnellerer Kleiderschrank, der weniger Daten verbraucht, dazu Fehlerbehebungen bei Profilen, Benachrichtigungen und langen Chats.
```

**Neuigkeiten** (Play, ≤500) — 2.3.1:

```
Gemacht für große Kleiderschränke.

- Wähl in Boards, Outfits und bei der Anprobe aus deinem ganzen Kleiderschrank.
- Dein Stylist sieht alles, was du hast, antwortet schneller und sagt dir Bescheid, sobald die Antwort da ist.
- Ein schnellerer Kleiderschrank, der weniger Daten verbraucht, dazu Fehlerbehebungen bei Profilen, Benachrichtigungen und langen Chats.
```
