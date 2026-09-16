# Store listing — Spanish (es-MX / es-ES)

One neutral Spanish for every market, same register as `src/locales/es.js`:
`tú` (never `vosotros`, which reads as Spain-only) and vocabulary a reader in
Madrid, Mexico City, Bogotá or Buenos Aires all recognises — "camiseta" not the
Mexican "playera", "gafas" not "lentes".

Upload under **Spanish (Spain)** on the App Store: it is the locale Apple falls
back to for every other Spanish storefront, so one entry covers es-MX and the
rest. On Play use **Spanish (Latin America)** plus **Spanish (Spain)** pointing
at the same text. Two national variants are not worth maintaining — the copy
below is written so neither market reads it as foreign.

Character limits are annotated — they are hard caps, and both stores reject the
whole submission on overflow.

## App Store Connect

**Name** (≤30, currently 25):

```
drape: armario y prueba
```

**Subtitle** (≤30, currently 26) — lowercase, and avoiding *armario* /
*prueba*, which the name already carries:

```
estilista ia, looks y ootd
```

**Promotional text** (≤170 — editable without a new build, use it for campaigns):

```
Fotografía tu ropa, arma tu armario digital y pruébate cualquier prenda en tu propio cuerpo. Tu estilista con IA arma looks con lo que ya tienes.
```

**Keywords** (≤100 chars) — a new locale, so there is no live set to protect;
this can go in as-is. Words already in the name or subtitle are left out on
purpose: Apple indexes name + subtitle + keywords together, so a repeat is
spent budget:

```
ropa,moda,estilo,probador,armario,guardarropa,cápsula,lookbook,tendencias,vender
```

**Description** (≤4000):

```
drape es el lugar donde vive tu guardarropa.

Agrega dos o tres fotos tuyas y mira cualquier prenda en tu propio cuerpo
antes de usarla o comprarla. Fotografía lo que tienes y drape lo recorta, lo
etiqueta y lo archiva — así el armario es tuyo, no un catálogo.

PRUEBA VIRTUAL EN TI
• Agrega 2 o 3 fotos tuyas de cuerpo completo y pruébate cualquier prenda.
• Es tu rostro y tu cuerpo reales, así que el resultado se ve natural.
• 5 pruebas gratis cada día. Invita a una amistad y ambos reciben 10 más.

TU ARMARIO DIGITAL
• Una foto por prenda: quitamos el fondo y etiquetamos categoría, color,
  temporada y estilo automáticamente.
• ¿Tienes prisa? Sube la foto de un look completo y detectamos cada prenda.
• Busca y filtra por etiqueta, marca o color. Pellizca la cuadrícula para ver
  más de una vez, o menos y en grande.

TU ESTILISTA CON IA
• Elige un estilista personal y recibe looks armados con tu propio armario.
• Indica tu estilo y lo que prefieres evitar: tus preferencias mandan.
• Guarda los looks que te gusten y vuelve a probártelos cuando quieras.

OOTD Y CALENDARIO
• Una foto registra tu día: el calendario se llena solo.
• Mira en qué usas más tu ropa y qué prendas están olvidadas.

TENDENCIAS
• Una edición nueva cada lunes: los estilos, colores y marcas de la semana,
  sacados de lo que los miembros realmente están usando.

EXPLORA OTROS ARMARIOS
• Abre un look en Tendencias para ver de quién es y recorrer su armario público.
• Pruébate sus prendas y guarda los looks que te gusten.

drape es gratis para empezar. Las pruebas virtuales usan una cuota diaria que
se renueva cada día.
```

**What's New** (≤4000) — 2.1.0:

```
• Tu estilista con IA: elige uno de cuatro y recibe ideas armadas con tu
  propio armario; míralas en ti con un toque.
• Tendencias: una edición nueva cada lunes con los estilos, colores y marcas
  de la semana.
• Comparte la página de un producto desde cualquier app a drape para ver si
  te queda antes de comprarlo.
• drape ahora está en español y en francés, además de inglés, coreano y japonés.
• Un recorrido guiado que te muestra dónde está cada cosa, en vez de una pila
  de diapositivas.
• Cambia el tamaño de tu armario con dos dedos, ordénalo por color, categoría
  o uso, y agrega varias prendas de una vez.
```

## Google Play Console

**App name** (≤30):

```
drape: armario y prueba
```

**Short description** (≤80, currently 74):

```
Tu armario digital, tu OOTD y prueba virtual con IA en tu propio cuerpo.
```

**Full description** (≤4000) — reuse the App Store description above verbatim;
Play renders the bullet characters fine and the length is well within cap.

## Owner checklist

- [ ] App Store Connect → this version → **+ Spanish (Spain)** → paste the
      fields above. Screenshots: the English set is reused automatically unless
      a Spanish set is uploaded; captions on variant B are burned into the image,
      so a proper Spanish set means re-rendering via
      `scripts/build-app-store-screenshots-b.cjs` with Spanish captions.
- [ ] Play Console → Main store listing → **Add Spanish (Latin America) and
      Spanish (Spain)**, same text in both.
- [ ] Both: privacy policy URL stays `https://drape.nyc/privacy.html` — the page
      now carries a Spanish tab, no separate URL needed.
- [ ] Verify the build declares Spanish: `ios/App/App/Info.plist` →
      `CFBundleLocalizations` must list `es` (done in 2.1.0), otherwise the App
      Store shows the app as English-only regardless of the listing.
