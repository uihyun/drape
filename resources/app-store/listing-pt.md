# Store listing — Portuguese (Brazil)

Brazilian Portuguese, `você` throughout, matching `src/locales/pt.js`. Written
for Brazil, not Portugal: "guarda-roupa" and "look do dia" are what a shopper
in São Paulo types, and "a gente" / "te avisa" keep the register as casual as
the app itself. Character limits are annotated — both stores reject the whole
submission on overflow.

## App Store Connect

**Name** (≤30, currently 30) — *provador* (fitting room) is the store-search
word; the in-app feature is *prova virtual*:

```
drape: guarda-roupa e provador
```

**Subtitle** (≤30, currently 30) — lowercase, and avoiding *guarda-roupa* /
*provador*, which the name already carries. "look do dia" is the Brazilian
OOTD, and far more searched than the English acronym:

```
estilista com ia e look do dia
```

**Promotional text** (≤170, currently 153 — editable without a new build, use
it for campaigns):

```
Fotografe suas roupas, monte seu guarda-roupa digital e prove qualquer peça no seu próprio corpo. Seu estilista com IA monta looks com o que você já tem.
```

**Keywords** (≤100 chars, currently 95) — a new locale, so there is no live set
to protect; this can go in as-is. Words already in the name or subtitle are
left out on purpose: Apple indexes name + subtitle + keywords together, so a
repeat is spent budget. *virtual* is a single word here because Apple combines
it with the name, covering both "provador virtual" and "guarda-roupa virtual";
*brechó* (thrift) is for the marketplace:

```
roupas,moda,estilo,closet,armário,virtual,cápsula,lookbook,tendências,outfit,brechó,vestir,ootd
```

**Description** (≤4000):

```
Seu guarda-roupa inteiro, no bolso.

Fotografe cada peça e o drape monta um guarda-roupa digital limpo: recorta o fundo e marca categoria, cor e estação sozinho. Com duas ou três fotos suas de corpo inteiro, você prova o que quiser com IA, antes de comprar e antes de vestir. Gostou de um look que viu em outra pessoa? Recrie o look inteiro em você.

• Guarda-roupa digital — fotografe suas roupas; a gente recorta a peça e marca categoria, cor e estação.
• Prova virtual — qualquer peça, ou um look completo, no seu próprio corpo. A IA preserva seu rosto e sua pose.
• Estilista com IA — escolha um estilista pessoal e receba looks montados só com as roupas que você já tem.
• Calendário do look do dia — registre o que você usou em cada dia e construa seu histórico de estilo.
• Looks e painéis — combine peças em looks e monte seus painéis de inspiração.
• Tendências — uma edição nova toda segunda-feira: os estilos, as cores e as marcas da semana.

Seu guarda-roupa, seu provador e seu diário de estilo. Tudo no drape.
```

## Google Play Console

**App name** (≤30, currently 30):

```
drape: guarda-roupa e provador
```

**Short description** (≤80, currently 71):

```
Crie seu guarda-roupa digital, prove tudo com IA e registre seus looks.
```

**Full description** (≤4000) — reuse the App Store description above verbatim;
Play renders the bullet characters fine and the length is well within cap.

## Owner checklist

- [ ] App Store Connect → this version → **+ Portuguese (Brazil)** → paste the
      fields above. Screenshots: the English set is reused automatically unless
      a Portuguese set is uploaded; the poster headlines are burned into the
      image, so a proper Portuguese set means rendering
      `node scripts/build-store-posters.cjs pt` once the script carries `pt`
      lines.
- [ ] Play Console → Main store listing → **Add Portuguese (Brazil) – pt-BR**.
      Play caps phone screenshots at 8: skip the two `-ios-only` posters.
- [ ] Both: privacy policy URL stays `https://drape.nyc/privacy.html` — the page
      carries a Portuguese tab, no separate URL needed.
- [ ] Verify the build declares Portuguese: `ios/App/App/Info.plist` →
      `CFBundleLocalizations` must list `pt-BR`, otherwise the App Store shows
      the app as English-only regardless of the listing.

**What's New** (≤4000) — 2.3.1:

```
Feito para guarda-roupas grandes.

- Escolha entre todo o seu guarda-roupa nos painéis, looks e provas virtuais.
- Seu estilista vê tudo o que você tem, responde mais rápido e te avisa quando a resposta chega.
- Um guarda-roupa mais rápido e que gasta menos dados, além de correções em perfis, notificações e conversas longas.
```

**Novidades** (Play, ≤500) — 2.3.1:

```
Feito para guarda-roupas grandes.

- Escolha entre todo o seu guarda-roupa nos painéis, looks e provas virtuais.
- Seu estilista vê tudo o que você tem, responde mais rápido e te avisa quando a resposta chega.
- Um guarda-roupa mais rápido e que gasta menos dados, além de correções em perfis, notificações e conversas longas.
```
