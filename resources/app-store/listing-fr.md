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

**Description** (≤4000, currently 2131) — same text on App Store and Google Play (full). Updated for 2.3 on 2026-10-12 from the live App Store copy.

```
Toute votre garde-robe, enfin au même endroit.

Ajoutez deux ou trois photos de vous et essayez n'importe quelle pièce sur votre propre corps avant de la porter ou de l'acheter. Photographiez ce que vous possédez : drape détoure chaque pièce, l'étiquette et la range.

ESSAYEZ AVANT DE PORTER
• N'importe quelle pièce, sur votre propre photo. C'est votre visage et votre silhouette, donc on voit tout de suite si ça vous va.
• Essayez une tenue entière repérée sur quelqu'un d'autre, ou mélangez les pièces de votre dressing.

VOTRE DRESSING, EN NUMÉRIQUE
• Une photo par pièce, c'est tout. Catégorie, couleur, saison et style s'ajoutent seuls.
• Pressé ? Envoyez la photo d'une tenue entière et nous y retrouvons chaque pièce.
• Cherchez par tag, marque ou couleur. Pincez la grille pour en voir davantage, ou moins et en plus grand.

VOTRE STYLISTE IA
• Dites à votre styliste, par chat, où vous allez : vous recevez des tenues composées uniquement avec ce que vous avez déjà.
• Quatre stylistes, quatre regards. Choisissez celui ou celle qui vous ressemble.
• Votre styliste consulte la météo du jour et vous habille en conséquence.
• Dites-lui les styles que vous aimez et les couleurs à éviter : ce que vous dites prime sur ce qu'il devine.
• Vous quittez l'app en pleine réponse ? Nous vous prévenons dès qu'elle arrive.

UNE PHOTO PAR JOUR
• Une photo suffit à noter la journée, et le calendrier se remplit tout seul, avec la météo de chaque jour.
• Vous verrez ce que vous portez vraiment, et ce que vous avez oublié.

PLANCHES
• Transformez une tenue, ou une semaine ou un mois de tenues, en moodboard.

TENDANCES
• Un nouveau numéro chaque lundi : les styles, couleurs et marques qui montent, tirés de ce que les membres portent réellement.

ALLEZ VOIR D'AUTRES DRESSINGS
• Ouvrez une tenue dans Tendances, voyez à qui elle est, puis parcourez tout son dressing.
• Essayez ses pièces sur vous et gardez celles qui vous plaisent.

GRATUIT POUR COMMENCER
• 50 crédits gratuits chaque jour, de quoi faire 5 essayages. Un message à votre styliste n'en utilise qu'un.
• Invitez quelqu'un et vous en recevez 100 de plus chacun.
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
Vous pouvez maintenant demander à un styliste si un look vous irait vraiment, et pas seulement comment la pièce tombe.

Les pièces en vente affichent leur prix directement dans le look : ouvrez-la et écrivez à la personne qui la porte. Vous pouvez aussi essayer n'importe quelle pièce croisée dans l'app, pas seulement celles de votre dressing.

Nous avons également réparé les liens partagés, cassés depuis un moment — désolés pour la gêne. Les liens d'invitation remplissent désormais le code pour vous, et le tri est disponible partout où il y a un filtre.
```

**Nouveautés** (Play, ≤500) — 2.2.0:

```
Vous pouvez maintenant demander à un styliste si un look vous irait vraiment. Les pièces en vente affichent leur prix directement dans le look : ouvrez-la et écrivez à la personne qui la porte. Vous pouvez aussi essayer n'importe quelle pièce croisée dans l'app.

Nous avons également réparé les liens partagés, cassés depuis un moment. Désolés pour la gêne.
```

**What's New** (≤4000) — 2.2.1:

```
Essayer les pièces du dressing des autres est désormais plus rapide et plus fluide. Nous avons aussi corrigé quelques petits bugs.
```

**Nouveautés** (Play, ≤500) — 2.2.1:

```
Essayer les pièces du dressing des autres est désormais plus rapide et plus fluide. Nous avons aussi corrigé quelques petits bugs.
```

**What's New** (≤4000) — 2.3.0:

```
Un nouveau look, et un styliste avec qui discuter.

- Une barre plus simple : Tendances, Styliste, Dressing, Réglages.
- Votre styliste choisit des tenues dans votre dressing, et chaque conversation est gardée.
- La météo sur votre calendrier et vos tenues, et votre styliste s’y adapte.
- Ajoutez ou liez chaque pièce depuis une tenue.
- Faites d’une tenue, d’une semaine ou d’un mois une planche.
- Essayages et chat passent aux crédits : 50 gratuits par jour, soit 5 essayages.
```

**Nouveautés** (Play, ≤500) — 2.3.0:

```
Un nouveau look, et un styliste avec qui discuter.

- Une barre plus simple : Tendances, Styliste, Dressing, Réglages.
- Votre styliste choisit des tenues dans votre dressing, et chaque conversation est gardée.
- La météo sur votre calendrier et vos tenues, et votre styliste s’y adapte.
- Ajoutez ou liez chaque pièce depuis une tenue.
- Faites d’une tenue, d’une semaine ou d’un mois une planche.
- Essayages et chat passent aux crédits : 50 gratuits par jour, soit 5 essayages.
```

**What's New** (≤4000) — 2.3.1:

```
Pensée pour les grands dressings.

- Choisissez dans tout votre dressing pour les planches, tenues et essayages.
- Votre styliste voit tout ce que vous possédez, répond plus vite et vous prévient dès que sa réponse arrive.
- Un dressing plus rapide et moins gourmand en données, et des corrections pour les profils, notifications et longues conversations.
```

**Nouveautés** (Play, ≤500) — 2.3.1:

```
Pensée pour les grands dressings.

- Choisissez dans tout votre dressing pour les planches, tenues et essayages.
- Votre styliste voit tout ce que vous possédez, répond plus vite et vous prévient dès que sa réponse arrive.
- Un dressing plus rapide et moins gourmand en données, et des corrections pour les profils, notifications et longues conversations.
```
