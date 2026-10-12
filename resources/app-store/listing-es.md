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

**Description** (≤4000, currently 1851) — same text on App Store and Google Play (full). Updated for 2.3 on 2026-10-12 from the live App Store copy.

```
Toda tu ropa, por fin en un mismo sitio.

Sube dos o tres fotos tuyas y pruébate cualquier prenda en tu propio cuerpo antes de ponértela o comprarla. Fotografía lo que ya tienes: drape recorta cada prenda, la etiqueta y la ordena por ti.

PRUÉBATELO ANTES
• Cualquier prenda, sobre tu propia foto. Es tu cara y tu cuerpo, así que se nota enseguida si te queda bien.
• Pruébate un look entero que viste en otra persona, o combina prendas de tu armario.

TU ARMARIO, EN DIGITAL
• Una foto por prenda y listo. La categoría, el color, la temporada y el estilo se ponen solos.
• ¿Con prisa? Sube la foto de un look entero y encontramos cada prenda.
• Busca por etiqueta, marca o color. Pellizca la cuadrícula para ver más de golpe, o menos y más grande.

TU ESTILISTA CON IA
• Cuéntale a tu estilista por chat adónde vas: te responde con looks hechos solo con la ropa que ya tienes.
• Cuatro estilistas, cuatro miradas. Elige quien más vaya contigo.
• Tiene en cuenta el clima de hoy para vestirte.
• Dile qué estilos te gustan y qué colores evitar. Lo que tú digas manda sobre lo que suponga.
• ¿Te vas a mitad de la respuesta? Te avisamos cuando conteste.

UNA FOTO AL DÍA
• Con una foto queda registrado el día y el calendario se llena solo, con el clima de cada día.
• Verás qué te pones de verdad y qué llevas meses sin tocar.

TABLEROS
• Convierte un look, una semana o un mes de looks en un moodboard.

TENDENCIAS
• Un número nuevo cada lunes: los estilos, colores y marcas que suben esta semana, sacados de lo que la gente lleva puesto.

CURIOSEA OTROS ARMARIOS
• Abre un look en Tendencias, mira de quién es y recorre su armario entero.
• Pruébate sus prendas y guarda las que te gusten.

EMPIEZA GRATIS
• 50 créditos gratis cada día: alcanzan para 5 pruebas. Un mensaje a tu estilista gasta solo 1.
• Invita a alguien y los dos consiguen 100 más.
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
Ahora puedes preguntarle a un estilista si un look te quedaría bien de verdad, y no solo cómo te sienta la prenda.

Las prendas en venta muestran su precio dentro del look, así que puedes entrar y escribirle a quien lo lleva puesto. Y puedes probarte cualquier prenda que veas, no solo las que ya tienes en el armario.

También hemos arreglado los enlaces compartidos, que llevaban un tiempo rotos. Perdón por las molestias. Los enlaces de invitación ya rellenan el código por ti, y hay orden en todas las pantallas con filtro.
```

**Novedades** (Play, ≤500) — 2.2.0:

```
Ahora puedes preguntarle a un estilista si un look te quedaría bien de verdad. Las prendas en venta muestran su precio dentro del look, así que puedes entrar y escribirle a quien lo lleva puesto. Y puedes probarte cualquier prenda que veas, no solo las que ya tienes.

También hemos arreglado los enlaces compartidos, que llevaban un tiempo rotos. Perdón por las molestias.
```

**What's New** (≤4000) — 2.2.1:

```
Probarte prendas del armario de otras personas ahora es más rápido y fluido. También corregimos algunos errores pequeños.
```

**Novedades** (Play, ≤500) — 2.2.1:

```
Probarte prendas del armario de otras personas ahora es más rápido y fluido. También corregimos algunos errores pequeños.
```

**What's New** (≤4000) — 2.3.0:

```
Un nuevo diseño y una estilista con quien conversar.

- Una barra más simple: Tendencias, Estilista, Armario y Ajustes.
- Chatea con tu estilista: elige looks de tu armario y guarda la conversación de cada día.
- El clima en tu calendario y tus outfits, y tu estilista te viste para él.
- Agrega o vincula cada prenda desde un outfit.
- Convierte un outfit, una semana o un mes en un tablero.
- Las pruebas y el chat ahora usan créditos: 50 gratis al día, las mismas 5 pruebas de siempre.
```

**Novedades** (Play, ≤500) — 2.3.0:

```
Un nuevo diseño y una estilista con quien conversar.

- Una barra más simple: Tendencias, Estilista, Armario y Ajustes.
- Chatea con tu estilista: elige looks de tu armario y guarda la conversación de cada día.
- El clima en tu calendario y tus outfits, y tu estilista te viste para él.
- Agrega o vincula cada prenda desde un outfit.
- Convierte un outfit, una semana o un mes en un tablero.
- Las pruebas y el chat ahora usan créditos: 50 gratis al día, las mismas 5 pruebas de siempre.
```

**What's New** (≤4000) — 2.3.1:

```
Pensada para armarios grandes.

- Elige entre todo tu armario en tableros, outfits y pruebas.
- Tu estilista ve todo lo que tienes, responde más rápido y te avisa cuando contesta.
- Un armario más rápido que usa menos datos, y arreglos en perfiles, notificaciones y chats largos.
```

**Novedades** (Play, ≤500) — 2.3.1:

```
Pensada para armarios grandes.

- Elige entre todo tu armario en tableros, outfits y pruebas.
- Tu estilista ve todo lo que tienes, responde más rápido y te avisa cuando contesta.
- Un armario más rápido que usa menos datos, y arreglos en perfiles, notificaciones y chats largos.
```
