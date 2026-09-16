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

**What's New** (≤4000) — 2.1.0:

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
Votre dressing, votre styliste IA — et chaque look essayé sur vous d’abord.
```

**Full description** (≤4000) — reuse the App Store description above verbatim.
