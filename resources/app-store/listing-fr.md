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
drape, c’est là où vit votre garde-robe.

Ajoutez deux ou trois photos de vous, puis voyez n’importe quelle pièce sur
votre propre corps avant de la porter ou de l’acheter. Photographiez ce que
vous avez : drape détoure chaque pièce, la tague et la range — le dressing est
le vôtre, pas un catalogue.

ESSAYEZ SUR VOUS
• Ajoutez deux ou trois photos de vous en pied, puis essayez n’importe quelle pièce.
• C’est votre vrai visage et votre vrai corps : le résultat vous ressemble,
  pas à un mannequin.
• 5 essayages gratuits par jour. Invitez un ami et vous en recevez 10 chacun.

VOTRE DRESSING NUMÉRIQUE
• Une photo par pièce : nous retirons le fond et taguons catégorie, couleur,
  saison et style automatiquement.
• Pressé ? Envoyez la photo d’une tenue complète et nous détectons chaque pièce.
• Cherchez et filtrez par tag, marque ou couleur. Pincez la grille pour en
  voir plus d’un coup, ou moins et en plus grand.

VOTRE STYLISTE IA
• Choisissez un styliste personnel : il compose des tenues avec votre dressing.
• Dites-lui les styles que vous aimez et les couleurs à éviter — vos
  préférences passent avant toute supposition.
• Gardez les looks qui vous plaisent et réessayez-les quand vous voulez.

CALENDRIER OOTD
• Une photo enregistre votre journée ; le calendrier se remplit tout seul.
• Voyez ce que vous portez vraiment, et les pièces que vous avez oubliées.

TENDANCES
• Un nouveau numéro chaque lundi : les styles, couleurs et marques qui montent,
  tirés de ce que les membres portent réellement.

PARCOUREZ D’AUTRES DRESSINGS
• Ouvrez un look dans Tendances pour voir à qui il est, puis parcourez tout
  son dressing public.
• Essayez ses pièces sur vous et gardez les looks qui vous plaisent.

drape est gratuit au départ. Les essayages utilisent un quota quotidien qui se
recharge chaque jour.
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
