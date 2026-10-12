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

**Description** (≤4000, currently 1838) — same text on App Store and Google Play (full description). Synced to the live App Store copy and updated for 2.3 on 2026-10-12; Play still showed the older 962-character text until this is pasted there.

```
drape is where your wardrobe lives.

Add two or three photos of yourself and see any piece on your own body before you wear it or buy it. Photograph what you already own — drape cuts each piece out, tags it, and files it away.

TRY IT ON YOURSELF
• Any piece, on your own photo. It's your real face and body, so you can tell whether it actually suits you.
• Try on a whole look you saw on someone else, or mix pieces from your closet.

YOUR DIGITAL CLOSET
• One photo per piece. We remove the background and tag category, colour, season and style for you.
• In a hurry? Upload a photo of a full outfit and we find every piece in it.
• Search by tag, brand or colour. Pinch the grid to fit more on screen, or fewer and larger.

YOUR OWN AI STYLIST
• Chat with your stylist about where you're going — they answer with outfits built only from clothes you already own.
• Four stylists, four points of view. Pick the one that sounds like you.
• They check today's weather and dress you for it.
• Tell them the styles you love and the colours to avoid. What you say outranks what they guess.
• Step away mid-answer and we'll let you know when they reply.

OOTD CALENDAR
• One photo logs the day. The calendar fills itself in, with each day's weather.
• See what you actually reach for, and which pieces you've forgotten.

BOARDS
• Turn an outfit, a week or a month of looks into a moodboard.

TRENDS
• A new issue every Monday — the styles, colours and brands moving this week, drawn from what members are really wearing.

BROWSE OTHER CLOSETS
• Open any look from Trends to see whose it is, then go through their whole public closet.
• Try their pieces on yourself and keep the ones you like.

FREE TO START
• 50 free credits every day — enough for 5 try-ons. A message to your stylist uses just 1.
• Invite a friend and you each get 100 more.
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
Now you can ask a stylist whether a look would actually suit you, not just how it would fit.

Pieces that are for sale show their price right inside the outfit, so you can tap through and message whoever is wearing it. And you can try on anything you come across, not only what is already in your closet.

We also fixed shared links, which had been quietly broken for a while — sorry about that. Invite links now fill the code in for you, and sorting works everywhere you can filter.
```

**What's new** (Play, ≤500) — 2.2.0:

```
Now you can ask a stylist whether a look would actually suit you, not just how it would fit. Pieces for sale show their price right inside the outfit, so you can tap through and message whoever is wearing it — and you can try on anything you come across, not only what is in your closet.

We also fixed shared links, which had been quietly broken for a while. Sorry about that.
```

**What's New** (≤4000) — 2.2.1:

```
Trying on pieces from other people's closets is now faster and smoother. We also fixed a few small bugs.
```

**What's new** (Play, ≤500) — 2.2.1:

```
Trying on pieces from other people's closets is now faster and smoother. We also fixed a few small bugs.
```

**What's New** (≤4000) — 2.3.0:

```
A new look, and a stylist you can talk to.

- A simpler tab bar: Trends, Stylist, Closet and Settings.
- Chat with your stylist. They pick looks from your closet, and each day's chat is saved.
- Weather on your calendar and outfits, and your stylist dresses you for it.
- Add or link each piece right from an outfit.
- Turn an outfit, a week or a month into a board.
- Try-ons and chats now use credits: 50 free a day, the same 5 try-ons as before.
```

**What's new** (Play, ≤500) — 2.3.0:

```
A new look, and a stylist you can talk to.

- A simpler tab bar: Trends, Stylist, Closet and Settings.
- Chat with your stylist. They pick looks from your closet, and each day's chat is saved.
- Weather on your calendar and outfits, and your stylist dresses you for it.
- Add or link each piece right from an outfit.
- Turn an outfit, a week or a month into a board.
- Try-ons and chats now use credits: 50 free a day, the same 5 try-ons as before.
```

**What's New** (≤4000) — 2.3.1:

```
Made for big closets.

- Pick from your whole closet in boards, outfits and try-on.
- Your stylist sees everything you own, answers faster, and lets you know when it replies.
- A faster closet that uses less data, plus fixes for profiles, notifications and long chats.
```

**What's new** (Play, ≤500) — 2.3.1:

```
Made for big closets.

- Pick from your whole closet in boards, outfits and try-on.
- Your stylist sees everything you own, answers faster, and lets you know when it replies.
- A faster closet that uses less data, plus fixes for profiles, notifications and long chats.
```
