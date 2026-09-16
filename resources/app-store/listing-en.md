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

Add two or three photos of yourself, then see any piece on your own body
before you wear it or buy it. Photograph what you own and drape cuts each
piece out, tags it, and files it away — so the closet is yours, not a
catalogue.

TRY IT ON YOURSELF
• Add two or three full-body photos of yourself, then try on any piece.
• It's your real face and body, so the result looks like you — not a model.
• 5 free try-ons every day. Invite a friend and you each get 10 more.

YOUR DIGITAL CLOSET
• One photo per piece: we remove the background and tag category, colour,
  season and style automatically.
• In a hurry? Upload a photo of a full outfit and we detect every piece in it.
• Search and filter by tag, brand or colour. Pinch the grid to see more at
  once, or fewer and larger.

YOUR OWN AI STYLIST
• Pick a personal stylist and get outfit ideas built from your own closet.
• Tell it the styles you love and the colours to avoid — your preferences
  outrank anything it guesses.
• Save the looks you like and try them on again whenever you want.

OOTD CALENDAR
• One photo logs your day; the calendar fills itself in.
• See what you actually reach for, and which pieces you've forgotten.

TRENDS
• A new issue every Monday: the styles, colours and brands moving this week,
  drawn from what members are actually wearing.

BROWSE OTHER CLOSETS
• Open any look from Trends to see whose it is, then browse their whole
  public closet.
• Try their pieces on yourself, and keep the looks you love.

drape is free to start. Try-ons use a daily allowance that refills every day.
```

**What's New** (≤4000) — 2.1.0:

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
Your closet, your AI stylist — and try every look on your own body first.
```

**Full description** (≤4000) — reuse the App Store description above verbatim.

## Notes

- Screenshot order matters more than the copy: slide 1 is a try-on result,
  slide 2 the closet, slide 3 the stylist. App Store Browse traffic is
  surging and the product page is the bottleneck — impressions → installs is
  the metric to watch after release.
- The shot list and the renderer live in `README.md` next to this file.
