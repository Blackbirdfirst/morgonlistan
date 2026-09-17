# Brand guide — The Morning List

Living document. Started for two kids, aged 5 and 7, ahead of the App Store launch — update as the product and its languages grow. Supersedes `morgonlistan-brand-spec.md`, which was written under the old candy-jar direction before the pivot to this name and identity.

## 1. Who it's actually for

Two very different audiences use the same screen, and the brand has to work for both at once:

- **The child** — 4–8 years old. Some can't read at all yet; some are just starting. They recognise their own colour, their own icons, and the shape of a checkmark long before they can sound out a word.
- **The parent** — sets it up, adds the tasks, hands out the reward. Wants it to feel considered and trustworthy enough to put a real email address into, not just cute.
- **Other families** — started as one household's tool, now shared with a sister's family and friends. Every piece of copy and colour has to make sense to a family that has never met us.
- **Every language** — Swedish first, English and Spanish soon after. Nothing in the brand should depend on a pun, an idiom, or a word that doesn't translate.

## 2. Understand before you read

The whole product is built around one constraint: **the primary user often can't read.** Everything else — colour, iconography, copy length — follows from that.

In practice: one emoji per task, always. A short label underneath it for the parent and the older child, but the icon carries the meaning on its own. Big, high-contrast tap targets. No task is ever explained in a sentence — if it needs a sentence, it needs a clearer icon instead.

**Learned the hard way:** the evening "Pyjamas" task used 🩱, which reads as a swimsuit, not pyjamas. A 7-year-old noticed immediately and made fun of it. **Rule: test every icon on an actual kid before it ships.** An adult skimming a list of emoji will wave through ambiguity that a child staring at the actual icon every evening will not.

## 3. Voice & copy

Short enough to be read in one glance by a child who's just learning to read, and warm enough that it doesn't feel like a chore list. No instructions, no explaining — just the name of the thing.

| Before (too long) | After |
|---|---|
| Klä på dig (get dressed) | 👕 Kläder |
| Borsta tänderna (brush your teeth) | 🦷 Tänder |
| Gå upp ur sängen (get out of bed) | 🛌 Vakna |

One or two words, always a noun where possible — not an instruction. The icon is already the instruction.

**Parent-facing screens** get a different register: plain, direct, no baby-talk, no exclamation marks doing the work a clear sentence should. Say what happened and, if something's wrong, what to do about it — never an apology standing in for an explanation.

## 4. Colour: calm bases, energising splashes

Each kid's card is a single calm, muted colour — it has to feel good to look at all morning, not just for a first impression. Colour becomes vivid only for the few seconds that mark an actual win. Calm is the resting state; colour is the reward, not the wallpaper.

### The bases (`KID_COLORS` in `app.js`)

One muted hue wheel, same saturation and lightness throughout — only the hue turns, so any kid's colour sits comfortably next to any other's.

| Name | Hex |
|---|---|
| Dusty Rose | `#D9A6A0` |
| Clay | `#C98B6E` |
| Sand | `#D4B483` |
| Olive Mist | `#B8B383` |
| Sage | `#8FA888` |
| Muted Teal | `#7FA79C` |
| Powder Blue | `#9FC0C4` |
| Dusty Blue | `#8CA3B8` |
| Periwinkle | `#9A9DC4` |
| Lavender Grey | `#A79CC0` |
| Dusty Plum | `#A97C93` |
| Blush | `#C99AA6` |

### The splashes (`SPLASH_COLORS` in `app.js`)

Shared across every kid, never a card's identity — only ever the answer to "what just happened." Currently wired to two real product moments; `Sky Spark` (#4FC1E0, full list done) and `Grass Pop` (#6FBE6A, streak milestone) are reserved for features that don't exist yet.

| Name | Hex | Role |
|---|---|---|
| Sunshine | `#FFC93C` | a single task checked off (`SPLASH_COLORS.tick`) |
| Coral Pop | `#F0654A` | a session fully completed (`SPLASH_COLORS.reward`) |

## 5. Type

A warm serif for anything that's the brand speaking, a clean grotesk for anything the product is doing.

- **Fraunces** — display. App title, kid names, dialog titles.
- **Karla** — body. Every task label, every button, every piece of UI, including uppercase section labels. Needs to be legible small, not characterful.

## 6. Icons

Real emoji, not custom illustration — they're already familiar, already render everywhere, and already speak every language. One per task, standing for one concrete, literal thing a child already knows by sight.

**The exception is the App Store icon itself** (`app-icon.svg` at the repo root, rasterized to `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`): a sun mark built from [Phosphor Icons'](https://github.com/phosphor-icons/core) bold sun glyph (MIT-licensed), recoloured into the app's own palette — cream background (`#F7F2E9`), the ring in Sunshine, and the eight rays split evenly two-per-colour across all four splash colours (Coral Pop, Sky Spark, Grass Pop, and Sunshine again), with each pair of rays diametrically opposite so the mark reads as deliberate, not randomly cycled. If this ever needs to change, edit `app-icon.svg` and re-rasterize — don't hand-edit the PNG.

## 7. Quick reference

**Do**
- One emoji, one concrete object, per task
- One or two words per label, nouns over instructions
- Calm, muted colour for anything on screen most of the time
- Vivid colour only for a genuine win
- Test every new icon on an actual kid

**Don't**
- Full sentences where an icon would do
- A colour, joke, or idiom that only works in one language
- Bright, saturated colour as a resting/default state
- An apology standing in for an explanation, in parent-facing copy
- A new emoji nobody's actually looked at closely
