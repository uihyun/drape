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

**Description** (≤4000, currently 2044) — same text on App Store and Google Play (full). Updated for 2.3 on 2026-10-12.

```
Todo o seu guarda-roupa, finalmente em um só lugar.

Adicione duas ou três fotos suas e veja qualquer peça no seu próprio corpo antes de usar ou comprar. Fotografe o que você já tem — o drape recorta cada peça, coloca as tags e organiza tudo para você.

PROVE EM VOCÊ
• Qualquer peça, na sua própria foto. É o seu rosto e o seu corpo de verdade, então dá para saber se fica mesmo bem em você.
• Prove um look inteiro que você viu em outra pessoa, ou combine peças do seu guarda-roupa.

SEU GUARDA-ROUPA DIGITAL
• Uma foto por peça. Removemos o fundo e marcamos categoria, cor, estação e estilo para você.
• Com pressa? Envie a foto de um look completo e encontramos cada peça nele.
• Busque por tag, marca ou cor. Faça o movimento de pinça na grade para ver mais peças na tela, ou menos e maiores.

SEU PRÓPRIO ESTILISTA DE IA
• Converse com o seu estilista sobre aonde você vai — ele responde com looks montados só com roupas que você já tem.
• Quatro estilistas, quatro pontos de vista. Escolha o que tem mais a ver com você.
• Ele confere o clima de hoje e escolhe o look de acordo.
• Conte os estilos que você ama e as cores que quer evitar. O que você diz vale mais do que o que ele imagina.
• Saiu no meio da resposta? Avisamos você quando ele responder.

CALENDÁRIO DE OOTD
• Uma foto registra o dia. O calendário se preenche sozinho, com o clima de cada dia.
• Veja o que você realmente usa e quais peças ficaram esquecidas.

PAINÉIS
• Transforme um look, uma semana ou um mês de looks em um moodboard.

TENDÊNCIAS
• Uma nova edição toda segunda-feira — os estilos, cores e marcas em alta nesta semana, tirados do que os membros estão usando de verdade.

EXPLORE OUTROS GUARDA-ROUPAS
• Abra qualquer look em Tendências para ver de quem é e depois percorra todo o guarda-roupa público dessa pessoa.
• Prove as peças dela em você e salve as que você curtir.

GRÁTIS PARA COMEÇAR
• 50 créditos grátis todo dia — o suficiente para 5 provas virtuais. Uma mensagem para o seu estilista usa só 1.
• Convide alguém e vocês dois ganham mais 100.
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
