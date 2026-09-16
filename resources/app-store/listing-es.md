# Store listing — Spanish (es-MX / es-ES)

Neutral Latin-American Spanish, same register as `src/locales/es.js` (tú, no
vosotros). Upload under **Spanish (Mexico)** on both stores; App Store Connect
falls back to it for every other Spanish locale, so one entry covers es-ES too.

Character limits are annotated — they are hard caps, and both stores reject the
whole submission on overflow.

## App Store Connect

**Name** (≤30) — keep identical across locales, it is the brand:

```
drape
```

**Subtitle** (≤30, currently 29):

```
Tu armario y prueba virtual
```

**Promotional text** (≤170 — editable without a new build, use it for campaigns):

```
Fotografía tu ropa, arma tu armario digital y pruébate cualquier prenda en tu propio cuerpo. Tu estilista con IA arma looks con lo que ya tienes.
```

**Keywords** (≤100 chars total, comma-separated, no spaces after commas — do
not repeat words already in the name or subtitle, Apple indexes those anyway):

```
ropa,outfit,OOTD,probador,moda,estilo,clóset,guardarropa,looks,estilista,IA,vender
```

**Description** (≤4000):

```
drape es el lugar donde vive tu guardarropa.

Fotografía cada prenda y drape la recorta, la etiqueta y la archiva sola. Arma
looks, registra tu OOTD diario en el calendario y —lo mejor— pruébate cualquier
cosa en tu propio cuerpo antes de usarla o comprarla.

TU ARMARIO DIGITAL
• Una foto por prenda: quitamos el fondo y etiquetamos categoría, color,
  temporada y estilo automáticamente.
• ¿Tienes prisa? Sube la foto de un look completo y detectamos cada prenda.
• Busca y filtra por etiqueta, marca o color. Descubre lo que llevas meses
  sin ponerte.

PRUEBA VIRTUAL EN TI
• Agrega 2 o 3 fotos tuyas de cuerpo completo y pruébate cualquier prenda.
• Es tu rostro y tu cuerpo reales, así que el resultado se ve natural.
• 5 pruebas gratis cada día. Invita amistades y ambos ganan más.

TU ESTILISTA CON IA
• Elige un estilista personal y recibe looks armados con tu propio armario.
• Indica tu estilo y lo que prefieres evitar: tus preferencias mandan.
• Guarda los looks que te gusten y vuelve a probártelos cuando quieras.

OOTD Y CALENDARIO
• Una foto registra tu día: el calendario se llena solo.
• Mira en qué usas más tu ropa y qué prendas están olvidadas.

COMUNIDAD Y MERCADO
• Explora looks reales de otros miembros y pruébate sus prendas.
• Vende lo que ya no usas y encuentra piezas de otras personas.

drape es gratis para empezar. Las pruebas virtuales usan créditos diarios que
se renuevan cada día.
```

**What's New** (≤4000) — 2.1.0:

```
• Tendencias: una edición semanal con los estilos, colores y marcas del momento.
• Estilista con IA: looks armados con tu propio armario, ahora en español.
• Importa prendas compartiendo un enlace desde cualquier app.
• Ordena tu armario por color, categoría o uso.
• drape ahora está completamente en español.
```

## Google Play Console

**App name** (≤30):

```
drape
```

**Short description** (≤80, currently 74):

```
Tu armario digital, tu OOTD y prueba virtual con IA en tu propio cuerpo.
```

**Full description** (≤4000) — reuse the App Store description above verbatim;
Play renders the bullet characters fine and the length is well within cap.

## Owner checklist

- [ ] App Store Connect → this version → **+ Spanish (Mexico)** → paste the
      fields above. Screenshots: the English set is reused automatically unless
      a Spanish set is uploaded; captions on variant B are burned into the image,
      so a proper Spanish set means re-rendering via
      `scripts/build-app-store-screenshots-b.cjs` with Spanish captions.
- [ ] Play Console → Main store listing → **Add language → Spanish (Latin America)**.
- [ ] Both: privacy policy URL stays `https://drape.nyc/privacy.html` — the page
      now carries a Spanish tab, no separate URL needed.
- [ ] Verify the build declares Spanish: `ios/App/App/Info.plist` →
      `CFBundleLocalizations` must list `es` (done in 2.1.0), otherwise the App
      Store shows the app as English-only regardless of the listing.
