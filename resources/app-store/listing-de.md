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

**Description** (≤4000, currently 2215) — same text on App Store and Google Play (full). Updated for 2.3 on 2026-10-12.

```
Dein ganzer Kleiderschrank, endlich an einem Ort.

Lade zwei oder drei Fotos von dir hoch und sieh jedes Teil an deinem eigenen Körper, bevor du es trägst oder kaufst. Fotografiere, was du schon hast — drape stellt jedes Teil frei, versieht es mit Tags und sortiert es ein.

PROBIER ES AN DIR AN
• Jedes Teil, auf deinem eigenen Foto. Es ist dein echtes Gesicht und dein echter Körper — so siehst du, ob es dir wirklich steht.
• Probier einen ganzen Look an, den du bei jemand anderem gesehen hast, oder kombiniere Teile aus deinem Kleiderschrank.

DEIN DIGITALER KLEIDERSCHRANK
• Ein Foto pro Teil. Wir entfernen den Hintergrund und taggen Kategorie, Farbe, Saison und Stil für dich.
• Keine Zeit? Lade ein Foto von einem ganzen Outfit hoch, und wir finden jedes Teil darin.
• Suche nach Tag, Marke oder Farbe. Zieh das Raster mit zwei Fingern zusammen, um mehr auf einmal zu sehen — oder weniger und größer.

DEIN EIGENER KI-STYLIST
• Chatte mit deinem Stylist darüber, wohin du gehst — die Antwort sind Outfits nur aus Kleidung, die du schon hast.
• Vier Stylists, vier Sichtweisen. Wähl den, der zu dir passt.
• Dein Stylist checkt das Wetter von heute und zieht dich passend dazu an.
• Sag, welche Styles du liebst und welche Farben du meiden willst. Was du sagst, zählt mehr als das, was er vermutet.
• Mitten in der Antwort weggegangen? Wir sagen dir Bescheid, sobald die Antwort da ist.

OOTD-KALENDER
• Ein Foto hält den Tag fest. Der Kalender füllt sich von selbst, mit dem Wetter jedes Tages.
• Sieh, wozu du wirklich greifst und welche Teile du vergessen hast.

BOARDS
• Mach aus einem Outfit, einer Woche oder einem Monat voller Looks ein Moodboard.

TRENDS
• Jeden Montag eine neue Ausgabe — die Styles, Farben und Marken, die sich diese Woche bewegen, aus dem, was Mitglieder wirklich tragen.

STÖBERE IN ANDEREN KLEIDERSCHRÄNKEN
• Öffne einen Look in Trends, um zu sehen, wem er gehört, und geh dann den ganzen öffentlichen Kleiderschrank dieser Person durch.
• Probier die Teile an dir an und speichere die, die dir gefallen.

KOSTENLOS STARTEN
• Jeden Tag 50 Credits gratis — genug für 5 Anproben. Eine Nachricht an deinen Stylist kostet nur 1.
• Lade jemanden ein, und ihr bekommt beide 100 mehr.
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
