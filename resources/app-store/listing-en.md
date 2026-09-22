# Store listing — English (primary)

Character limits are annotated. Both stores reject the whole submission on
overflow, so treat them as hard caps.

## App Store Connect

**Name** (≤30, currently 22):

```
drape: closet & try-on
```

**Subtitle** (≤30, currently 26) — all-lowercase per the brand rule, and it
adds terms the name doesn't already carry (the name has *closet* and *try-on*;
Apple indexes both fields together, so repeating them is wasted budget). Live
value before 2.1.0 was `plan outfits & log your ootd`:

```
ai stylist, outfits & ootd
```

**Promotional text** (≤170 — editable without a new build, use it for campaigns):

```
Photograph your clothes, build a digital closet, and see any piece on your own body before you wear or buy it. Your AI stylist builds looks from what you already own.
```

**Keywords** (≤100 chars, currently 87) — this is the LIVE set with one change:
`ai stylist` is gone, because the new subtitle carries it and Apple indexes
name + subtitle + keywords together. Everything else is left alone on purpose:
ranking accrues per keyword, so a term you drop loses its position immediately
and a new one starts from zero. 2.1.0 already changes the subtitle, the
description and the screenshots — churning keywords at the same time would make
the result unreadable:

```
wardrobe,fashion,style,lookbook,clothes,dressing room,fit check,capsule,virtual fitting
```

**Description** (≤4000):

```
drape is where your wardrobe lives.

Snap each piece you own and drape builds a clean digital closet — auto-cut and auto-tagged. Add a few full-body photos and try anything on with AI: see clothes on your real body and face before you wear or buy them. Love a look you saw on someone else? Recreate the whole thing, right on you.

• Digital closet — photograph your clothes; we cut out the garment and tag category, color, and season automatically.
• Virtual try-on — see any item, or a full outfit, on your own body. Identity-preserving AI keeps your face and pose.
• AI stylist — pick a personal stylist and get outfit ideas built only from the clothes you already own.
• OOTD calendar — log what you wore each day and build your style history.
• Outfits & boards — combine pieces into looks and mood boards.
• Trends — a new issue every Monday: the styles, colors, and brands moving this week.

Your closet, your fitting room, your style diary — all in drape.
```

**What's New** (≤4000) — 2.1.1:

```
• Your AI stylist: pick one of four and get outfit ideas from your own
  closet, then see each look on you with one tap.
• Trends: a new issue every Monday — the styles, colours and brands moving
  this week.
• Share a product page from any app straight into drape to check whether it
  suits you before you buy.
• Now in Spanish and French, alongside English, Korean and Japanese.
• A guided walkthrough that shows you where everything is, instead of a
  stack of slides.
• Pinch your closet to resize it, sort by colour, category or wear, and add
  several pieces in one go.
```

## Google Play Console

**App name** (≤30):

```
drape: closet & try-on
```

**Short description** (≤80, currently 74):

```
Build your digital closet, try anything on with AI, and log your outfits.
```

**Full description** (≤4000) — reuse the App Store description above verbatim.

## Notes

- Screenshot order matters more than the copy: slide 1 is a try-on result,
  slide 2 the closet, slide 3 the stylist. App Store Browse traffic is
  surging and the product page is the bottleneck — impressions → installs is
  the metric to watch after release.
- The shot list and the renderer live in `README.md` next to this file.

**What's new** (Play, ≤500) — shipped with 2.1.0:

The App Store takes 4000 characters here; **Play takes 500**, so the release
notes are not the same text trimmed — they are a shorter list. The two weakest
bullets are merged into one closing line.

```
• AI stylist — pick one of four and get outfits built from your own closet, then see them on you in a tap.
• Trends — a new issue every Monday: the styles, colours and brands moving this week.
• Share any product page to drape to see it on you before you buy.
• Now in Spanish and French, alongside English, Korean and Japanese.
• A guided tour instead of a stack of slides. Pinch to resize your closet, new sorting, add several pieces at once.
```

**What's new** (Play, 2.1.1):

**Play only, and only from 2.1.1 on.** Play already shipped 2.1.0, so its
users have the stylist, Trends and the new locales — 21 really is just the
Capacitor 8 upgrade. The App Store is still on 1.5.0 because 2.1.0 was
rejected, so there this same build is the whole feature release: keep the
long **What's New** above for App Store Connect.

```
Platform updates under the hood, plus a round of polish.
```

**What's New** (≤4000) — 2.2.0:

```
• Ask a stylist whether a look would suit YOU. Try-on shows how a piece sits on you; a verdict says whether it is you — on any outfit you come across.
• Pieces for sale now show their price inside the outfit they are worn in. Tap through to the item and message the seller.
• Try on any piece you can see, not only your own. It is saved to your wishlist so you can find it again.
• Invite links fill the code in for you — no more retyping six characters.
• Newest / oldest sorting everywhere a filter lives: outfits, boards, try-ons, your closet and the try-on picker.
• Fixed: shared item and outfit links had been broken. Every link works again.
```

**What's new** (Play, ≤500) — 2.2.0:

```
• Ask a stylist whether a look you come across would suit you.
• Pieces for sale show their price inside the outfit, and you can message the seller.
• Try on any piece you see, not just your own — it saves to your wishlist.
• Invite links fill the code in for you.
• Newest / oldest sorting on every screen with a filter, and shared item and outfit links work again.
```
