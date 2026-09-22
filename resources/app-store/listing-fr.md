# Store listing — French (France)

Vouvoiement throughout, matching `src/locales/fr.js`. Character limits are
annotated — both stores reject the whole submission on overflow.

## App Store Connect

**Name** (≤30, currently 25):

```
drape : dressing & essayage
```

**Subtitle** (≤30, currently 26) — lowercase, and avoiding *dressing* /
*essayage*, which the name already carries:

```
styliste ia, tenues & ootd
```

**Promotional text** (≤170 — editable without a new build, use it for campaigns):

```
Photographiez vos vêtements, construisez votre dressing numérique et voyez chaque pièce sur vous avant de la porter. Votre styliste IA compose avec ce que vous avez déjà.
```

**Keywords** (≤100 chars) — a new locale, so there is no live set to protect;
this can go in as-is. Words already in the name or subtitle are left out on
purpose: Apple indexes name + subtitle + keywords together, so a repeat is
spent budget:

```
garde-robe,mode,style,penderie,vêtements,capsule,lookbook,tendances,essayage virtuel
```

**Description** (≤4000):

```
Toute votre garde-robe, dans votre poche.

Photographiez chaque pièce et drape construit un dressing numérique net : détourage et tags de catégorie, couleur et saison, automatiquement. Avec deux ou trois photos de vous en pied, essayez ce que vous voulez grâce à l'IA, avant d'acheter et avant de porter. Une tenue repérée sur quelqu'un d'autre ? Recréez-la entièrement sur vous.

• Dressing numérique — photographiez vos vêtements ; nous détourons la pièce et taguons catégorie, couleur et saison.
• Essayage virtuel — une pièce ou une tenue entière, sur votre propre corps. L'IA conserve votre visage et votre pose.
• Styliste IA — choisissez un styliste personnel et recevez des tenues composées avec ce que vous avez déjà.
• Calendrier OOTD — notez ce que vous avez porté chaque jour et construisez votre historique de style.
• Tenues et planches — combinez vos pièces en looks et rassemblez vos inspirations.
• Tendances — un nouveau numéro chaque lundi : les styles, couleurs et marques de la semaine.

Votre dressing, votre cabine d'essayage, votre journal de style. Tout dans drape.
```

**What's New** (≤4000) — 2.1.1:

```
• Votre styliste IA : choisissez-en un parmi quatre et recevez des idées de
  tenues composées avec votre dressing, puis voyez chaque look sur vous.
• Tendances : un nouveau numéro chaque lundi avec les styles, couleurs et
  marques de la semaine.
• Partagez la page d’un produit depuis n’importe quelle app vers drape pour
  voir si elle vous va avant d’acheter.
• drape est maintenant en français et en espagnol, en plus de l’anglais, du
  coréen et du japonais.
• Une visite guidée qui vous montre où se trouve chaque chose, au lieu d’une
  pile de diapositives.
• Pincez votre dressing pour changer sa taille, triez par couleur, catégorie
  ou usage, et ajoutez plusieurs pièces d’un coup.
```

## Google Play Console

**App name** (≤30):

```
drape : dressing & essayage
```

**Short description** (≤80, currently 76):

```
Créez votre dressing numérique, essayez tout avec l’IA et notez vos tenues.
```

**Full description** (≤4000) — reuse the App Store description above verbatim.

**Nouveautés** (Play, ≤500) — shipped with 2.1.0:

L'App Store accepte 4000 caractères ; **Play en accepte 500**, donc ces notes
ne sont pas le même texte tronqué mais une liste plus courte.

```
• Styliste IA : choisissez parmi quatre et recevez des tenues composées avec votre dressing, puis essayez-les en un geste.
• Tendances : un nouveau numéro chaque lundi avec les styles, couleurs et marques de la semaine.
• Partagez une fiche produit vers drape pour voir le vêtement sur vous avant d'acheter.
• Disponible en espagnol et en français.
• Une visite guidée au lieu de diapositives. Redimensionnez le dressing à deux doigts, triez-le, ajoutez plusieurs pièces d'un coup.
```

**Nouveautés** (Play, 2.1.1):

**Play uniquement, à partir de 2.1.1.** Play a déjà publié 2.1.0. L'App Store
en est encore à 1.5.0, donc là-bas cette même build constitue toute la
version : gardez les notes longues ci-dessus.

```
Mises à jour internes de la plateforme et quelques finitions.
```

**What's New** (≤4000) — 2.2.0:

```
• Demandez à un styliste si un look vous irait. L'essayage montre le rendu ; le verdict dit s'il vous ressemble, sur n'importe quel look croisé dans l'app.
• Les pièces en vente affichent leur prix directement dans le look porté. Ouvrez la pièce et écrivez au vendeur.
• Essayez n'importe quelle pièce que vous voyez, pas seulement les vôtres. Elle est enregistrée dans votre liste d'envies.
• Les liens d'invitation remplissent le code pour vous : plus besoin de recopier six caractères.
• Tri du plus récent au plus ancien sur tous les écrans avec filtre : looks, tableaux, essayages et votre dressing.
• Corrigé : les liens partagés de pièces et de looks étaient cassés. Ils fonctionnent de nouveau.
```

**Nouveautés** (Play, ≤500) — 2.2.0:

```
• Demandez à un styliste si un look que vous croisez vous irait.
• Les pièces en vente affichent leur prix dans le look, et vous pouvez écrire au vendeur.
• Essayez n'importe quelle pièce vue dans l'app : elle est enregistrée dans vos envies.
• Les liens d'invitation remplissent le code pour vous.
• Tri du plus récent au plus ancien sur tout écran avec filtre, et les liens partagés fonctionnent de nouveau.
```
