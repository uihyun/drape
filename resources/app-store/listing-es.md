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
Tu armario entero, en el bolsillo.

Fotografía cada prenda y drape monta un armario digital limpio: recorta el fondo y etiqueta categoría, color y temporada solo. Con dos o tres fotos tuyas de cuerpo entero puedes probarte lo que quieras con IA, antes de comprarlo y antes de ponértelo. ¿Te gustó un look que viste en otra persona? Recréalo entero sobre ti.

• Armario digital — fotografía tu ropa; recortamos la prenda y etiquetamos categoría, color y temporada.
• Prueba virtual — cualquier prenda, o un look completo, sobre tu propio cuerpo. La IA conserva tu cara y tu pose.
• Estilista con IA — elige un estilista personal y recibe looks armados solo con la ropa que ya tienes.
• Calendario OOTD — registra lo que llevaste cada día y construye tu historial de estilo.
• Looks y tableros — combina prendas en conjuntos y arma tus tableros de inspiración.
• Tendencias — una edición nueva cada lunes: los estilos, colores y marcas de la semana.

Tu armario, tu probador y tu diario de estilo. Todo en drape.
```

**What's New** (≤4000) — 2.1.1:

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
Crea tu armario digital, pruébate lo que sea con IA y anota tus looks.
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

**Novedades** (Play, ≤500) — shipped with 2.1.0:

La App Store admite 4000 caracteres; **Play admite 500**, así que estas notas
no son el mismo texto recortado sino una lista más corta.

```
• Estilista con IA: elige uno de cuatro y recibe looks armados con tu propio armario; míralos en ti con un toque.
• Tendencias: una edición nueva cada lunes con los estilos, colores y marcas de la semana.
• Comparte la página de un producto a drape para ver si te queda antes de comprarlo.
• Ahora en español y francés.
• Un recorrido guiado en vez de diapositivas. Ajusta tu armario con dos dedos, ordénalo y agrega varias prendas a la vez.
```

**Novedades** (Play, 2.1.1):

**Solo Play, y solo a partir de 2.1.1.** Play ya publicó 2.1.0, así que sus
usuarios tienen el estilista, Tendencias y los nuevos idiomas. La App Store
sigue en 1.5.0, así que allí esta misma compilación es toda la versión.

```
Actualizaciones internas de la plataforma y varios retoques.
```

**What's New** (≤4000) — 2.2.0:

```
• Pregunta a un estilista si un look te quedaría bien a TI. La prueba virtual enseña cómo te sienta una prenda; el veredicto dice si va contigo, en cualquier look que encuentres.
• Las prendas en venta ya muestran su precio dentro del look que llevan puesto. Entra en la prenda y escribe al vendedor.
• Pruébate cualquier prenda que veas, no solo las tuyas. Se guarda en tu lista de deseos para que la encuentres luego.
• Los enlaces de invitación rellenan el código por ti: se acabó copiar seis caracteres.
• Orden por más reciente o más antiguo en todas las pantallas con filtro: looks, tableros, pruebas y tu armario.
• Corregido: los enlaces compartidos de prendas y looks estaban rotos. Vuelven a funcionar.
```

**Novedades** (Play, ≤500) — 2.2.0:

```
• Pregunta a un estilista si un look que ves te quedaría bien.
• Las prendas en venta muestran su precio dentro del look, y puedes escribir al vendedor.
• Pruébate cualquier prenda que veas, no solo las tuyas: se guarda en tu lista de deseos.
• Los enlaces de invitación rellenan el código por ti.
• Orden por más reciente o más antiguo en toda pantalla con filtro, y los enlaces compartidos vuelven a funcionar.
```
