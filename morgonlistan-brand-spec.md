# Morgonlistan — Brand & Style Spec

> ⚠️ **This is a target design, not the current app.** Everything below is queued, unimplemented — see `ROADMAP.md` §4/§7. The app running today uses a *different* palette and system fonts (the derived-HSL 6-color system described in `CLAUDE.md`'s "Color system"), not the colors, Fraunces/Karla typefaces, or component rules described here. Do not treat this file as documentation of current behavior — if it ever conflicts with what the running app actually does, the running app is correct and this file is stale/aspirational until someone implements it.

Direction: **Lugn morgon** (calm morning) — soft, rounded, storybook-calm rather than loud/game-like. This replaces whatever colors currently exist in the app.

**Status**: queued behind the native App Store migration (see `ROADMAP.md` §7 and §4) — not yet implemented. Two ambiguities from the original draft are resolved:
- Reward placement does **not** change from today — it stays at the top of each individual kid's card, not a single shared area above all kids.
- The swipeable-carousel layout (one kid's full card at a time, peek of the next) is kept as-is. "Reflow for however many kids" just means the existing carousel already supports 1–N kids natively, not a switch to a grid layout.

## Typography

- **Wordmark / headers:** Fraunces (serif). Weight ~600 for the app title, weight ~340 (optical size auto) works well for larger display use.
- **Body / task labels / UI text:** Karla (sans-serif).
- Google Fonts import:
  `https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,340;0,9..144,600;0,9..144,720;1,9..144,500&family=Karla:wght@400;600;700&display=swap`

## Kid color palette (5 options, parent-selectable)

Each color has a **day** tone and a **night** tone (same hue, darker — this is what powers the existing 18:00/04:00 panel shift). Text is always dark ink in day mode and light cream in night mode — never white text on a light/colored background.

| Name | Day bg | Night bg | Day text | Night text |
|---|---|---|---|---|
| Rosa | `#F2CBD4` | `#7A3B49` | `#3D1420` | `#F8E3E9` |
| Blå | `#C0D5EE` | `#2E4E7A` | `#0E2038` | `#E4EEFB` |
| Gul | `#F7DFA3` | `#7A5A14` | `#3B2B04` | `#F8EBC8` |
| Grön | `#C1DCBF` | `#355C30` | `#17300F` | `#E6F1E2` |
| Lila | `#D7C7EE` | `#4A3878` | `#241748` | `#EDE6F7` |

Reward accent (star): `#DFAE3F`

## Component rules

**Kid panel:** `border-radius: 14px`; subtle inner highlight along the top edge (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.55)`); background is the day tone, switching to the night tone (same hue, just darker) during the evening window — this is the existing per-kid day/night behavior, just re-colored.

**Checkboxes:** never plain black. Pull the checkbox border/fill from the *opposite* tone of that same panel's color — in day mode use the color's own **night** hex as the checkbox color; in night mode use its **day** hex. Same hue family as the panel, so it contrasts but still feels harmonious rather than clashing.

**Reward icon:** default is now a generic ⭐ star instead of 🍬 candy (still parent-configurable via the existing emoji picker — some parents don't want a candy-based reward). Label: "BELÖNINGAR" instead of "GODISBURK".

**Reward area placement — important:** the reward jar goes at the **top** of the screen, directly under the header/greeting, *above* the kids' checklists — not below them. It should read as visually larger/more prominent than the checklists (bigger slot circles, soft gold-tinted background card behind it) per the existing project principle that the reward area should be more legible/prominent than the checklist text.

**Variable kid count:** the panel grid must reflow for however many kids exist (1, 2, 3, 4+) — don't hardcode a 2-column layout.

**Parent Mode color picker:** when a parent assigns a kid's color, show all 5 as circular swatches (~38px); selected swatch gets a ring in the studio/UI accent color.

## Reference mockups

Three files were shared earlier in this conversation showing this direction visually (with a live day/night toggle and a working color picker) — worth a quick look before implementing if anything above is ambiguous.
