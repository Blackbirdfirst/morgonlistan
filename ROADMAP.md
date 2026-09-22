# Roadmap

Living list — status: `[ ]` todo · `[~]` in progress · `[x]` done. Sections 1–4 and 6–7 are nearer-term feature areas under active consideration; section 5 is explicitly parked backlog.

## 1. Cycle end + candy reset

**Goal:** the game runs in cycles (e.g. Mon–Sat). At the end of the cycle the user gets to use their candy, is notified, and the counter resets to zero for a new cycle.

> Note: a basic version of the boundary exists today — the reward week resets at Saturday 18:00, derived from timestamps (see `getRewardWeekStart()` in `app.js` / `CLAUDE.md`), not a running timer. Everything below extends that into a full cycle with explicit states, a redeem step, notifications, and history.

**Core behaviour**
- [x] Define the cycle boundary explicitly — start day/time and end day/time, in a fixed timezone (e.g. Europe/Stockholm)
- [x] Derive cycle state from timestamps, not from a running timer — must be correct even if the app was closed all week
- [x] Cycle states: `active` → `ended / ready to redeem` → `reset` → new `active` — not modelled as named states; the same timestamp-derived boundary already produces each of them (the "Utdelat" banner is the ready-to-redeem state, its absence is active/reset)
- [x] Freeze earning once the cycle has ended (no new candy until the new cycle starts) — inherent in the timestamp bucketing: a completion always falls into whichever week its own timestamp is in, so there's nothing to separately freeze

**Configurable reset day**
- [x] Let a parent change the reset day from Saturday to any other weekday, in parent mode
- [x] Keep Saturday 18:00 as the default — it should work out of the box without touching this
- [x] Optionally make the reset time configurable too, not just the day — a `Klockslag` field next to the weekday chips, independent of both the day setting and the daily evening-list switch
- [x] Handle a change made mid-cycle — decided: the week in progress completes on the old day, the new day applies after it: decide whether the current cycle shortens, extends, or completes on the old day and only then switches
- [x] Never silently wipe earned candy when the setting changes — nothing is wiped; the change waits for the week's end and a dialog explains it — warn first if the change would end the cycle early
- [x] Make the current setting visible in the app ("resets on Saturdays"), so the reset is never a surprise
- [x] Update the copy in notifications and the cycle indicator to use the chosen day, not hard-coded "Saturday" (indicator and landing copy done; notification copy follows with §8)

**Redeem step**
- [x] "Use your candy" screen at cycle end: shows total earned, lets the user cash it in — the "Förra veckan: N — Utdelat" banner on each kid's card covers this; no separate screen needed
- [x] Decide whether redeeming is a manual confirm ("I got my candy") or automatic at reset — decided: manual, per kid, via "Utdelat" behind the parental gate (2026-09-21)
- [x] Decide the carry-over rule — decided: unspent reward is lost at the reset (2026-09-21)

**Notifications**
- [x] Cycle-end notification: "The week is done — you have X candies to use today" — generic text, not a live count (see §8/CLAUDE.md); a live count isn't possible in a notification scheduled in advance
- [x] Reset notification / in-app message: "New cycle started, candy is back to 0" — folded into the single week-end notification above rather than a second message right after it
- [ ] Optional heads-up the day before ("1 day left to earn")
- [x] Handle notification permission being denied — the same info must be visible in-app — reuses the same permission handling already built for §8

**Visibility in the UI**
- [x] Persistent cycle indicator: which day of the cycle, days remaining, progress — days remaining shown in each kid card's header
- [x] Clear "cycle ended" banner/state so the reset never looks like lost data or a bug
- [x] Cycle history: candies earned and used per past cycle — "Tidigare veckor" in Parent mode, last 8 completed weeks

**Edge cases**
- [x] Task completed after the cutoff — which cycle does it count toward? — already correct: a completion is bucketed by its own timestamp, not by when the screen happens to render
- [x] Retroactive edits/undo of a task after the cycle closed — moot: the checklist only ever shows *today*, there's no UI path to view or edit a past day at all
- [x] Timezone changes and DST shifts across the boundary — verified: boundaries are computed in calendar days, not fixed millisecond offsets, so a clock change can't move one off its wall-clock time
- [x] Multiple users/profiles — do they share one cycle or run independently? — decided (already the behaviour): the reset day/time is family-wide, but each kid's balance and history are independent
- [x] First-ever cycle and a cycle where zero candy was earned — verified: both just produce empty results (no summary banner, empty history rows), no special-casing needed

## 2. Easier startup configuration (first-run setup)

**Goal:** get from install to a usable app without going into parent mode.

> Current gap: today, first-run only prompts for a single child. The wizard below (multiple kids, one screen) isn't built yet.

- [x] First-run wizard that triggers automatically on a fresh install
- [x] Step 1: pick number of kids (1 / 2 / 3 / more) — 1 to 6
- [x] Step 2: enter names for all of them on one screen, then create all profiles in one go
- [x] Optional in the same flow: avatar or colour per kid — colour, spread around the hue wheel, tap the dot to change, so they can tell profiles apart
- [x] Sensible defaults applied automatically — already in `defaultState()` — default task lists, default cycle, default candy values — so the app works immediately with zero further setup
- [x] Parent mode stays available afterwards for editing, but is never required to start
- [x] Skippable / editable — "Hoppa över" opens Parent mode; adding or removing kids later works as before: adding or removing a kid later must not require a reinstall
- [x] Don't re-show the wizard on later launches; handle the "started but didn't finish" case — `setupDone` flag; nothing is saved until the last step, so an unfinished run simply restarts

## 3. Morning list: instant first point

**Goal:** an immediate, easy win at the very start of the morning so it feels engaging from the first second.

- [ ] Add a first task to the morning list — "Get out of bed" / "Stig upp ur sängen"
- [ ] Place it as the top item so it's the first thing seen
- [ ] Award candy for it like any other task — note: candy is only granted once all tasks on the list are done, so per-task value isn't a balance concern
- [ ] Consider a bit of extra feedback on the first tick of the day — animation, sound, "You're off!"
- [ ] Make sure it can't be double-counted across the day
- [ ] Consider the same pattern for other lists (e.g. an easy opener on the evening list)

## 4. Visual identity and colour system

**Goal:** a defined look that belongs to the app, instead of ad-hoc colours per screen.

**Settled**: see `brand-guide.md` in the repo root — warm, playful, Scandinavian-minimal direction; Fraunces + Karla typefaces; a 12-color muted "kid base" wheel (`KID_COLORS`) plus a small shared "splash" accent set (`SPLASH_COLORS`) for checked-task/reward moments, replacing the old fully-derived-from-one-hue accent system. Supersedes `morgonlistan-brand-spec.md` (removed), which was written under the earlier candy-jar direction. Design work for this project happens directly in Claude Code, grounded in the real code, rather than in a separate design tool/conversation.

- [x] Write a short brand guideline document and keep it in the repo, so every new screen builds from it — `brand-guide.md`
- [x] One colour per kid profile, drawn from the palette and distinguishable at a glance — 12-color wheel, up from 6
- [x] Decide the overall mood — calm/muted by default, with a small set of vivid "splash" colours reserved for actual wins
- [x] Colour must not be the only signal — every task still pairs its state with an emoji, not colour alone
- [ ] Define the *rest* of the UI by role, not just kid cards: primary buttons, backgrounds/surfaces, text — currently still original grays/blues outside the kid-card system
- [ ] Implement as CSS custom properties / theme tokens throughout `style.css`, not just the kid-card variables that already exist (`--task-done-bg` etc.) — most of the app still uses hard-coded hex values
- [ ] Check contrast for text and for the tick/untick states across all 12 base colors (kids should read state instantly)
- [ ] Define the celebration/reward colour used at cycle end and on completion
- [ ] Decide dark mode: support it properly or lock the app to light
- [ ] Pick typography at the same time — one family, a small set of sizes
- [ ] Test on a real phone in daylight and in a dim bedroom (morning use case)

*Deliberately not blocking the native app migration (§7) on this in full — small, well-defined color/content tweaks are fine to do anytime, but this whole section is a post-launch polish pass, not a prerequisite. See §7 for reasoning.*

## 5. Backlog / later

Not for now — ideas parked until the core app is solid.

**Content and engagement**
- [ ] Seasonal and holiday visual themes (winter + Santa, summer, World Cup, etc.) — build on top of the token system from section 4 so a theme is a swap, not a rewrite
- [ ] Surprise bonus tasks (silly dance, tell a joke) — decide whether they're extra or replace a normal task, and how often they appear
- [ ] More gamification: streaks, badges. Watch the downside — streaks punish a missed day, which lands hard on a small kid, so consider forgiving mechanics

**Design maturity**
- [ ] Custom hand-drawn icon set to replace emoji, if the emoji-based MVP validates well

**Account & sync maturity**
- [x] Real accounts + a Supabase backend (one family per account, isolated by row-level security) — see `CLAUDE.md`
- [x] Hosting moved off the Claude Artifact — live on GitHub Pages (`https://blackbirdfirst.github.io/morgonlistan/`)
- [ ] Today, sharing access within a family means literally sharing one login email (e.g. both parents use the same address). A proper multi-user-per-family model — separate logins for each parent, linked to the same family's data via an invite step — is deferred until the shared-login approach actually becomes annoying in practice
- [x] Offline/save resilience — retry with backoff, localStorage cache, flush on reload and on reconnect. See `CLAUDE.md`
- [x] Email deliverability — custom SMTP via Resend, sending from a verified domain (`biom39t.com`), configured in Supabase's SMTP settings. No longer limited by Supabase's shared free-tier sender. Verified end to end with a real sign-in.

**Collecting parent emails (waitlist / updates)**
- [ ] Decide the purpose first: waitlist signups, product updates, or account recovery. The purpose determines what's legally required and how long you may keep it
- [ ] Needs somewhere to store them — a simple form service is enough at first, no backend required
- [ ] GDPR basics even for a plain list: explicit opt-in (no pre-ticked box), stated purpose at the point of signup, working unsubscribe, and a way to delete on request
- [ ] Ask for the address in a parent-gated context, so a child never encounters the field
- [ ] Never collect a child's email — it raises the compliance bar sharply under both COPPA and GDPR-K

**Scaling to other families**
- [ ] Children's privacy rules apply: COPPA (US) and GDPR-K / the Swedish age of consent for data processing. Needs proper attention before any public/wider launch
- [ ] Prefer keeping kids' data local or minimal — the less personal data leaves the device, the smaller the compliance surface
- [ ] Parental consent flow, data deletion, and a privacy policy written in plain language

## 6. Task list content

- [x] Add "Plocka undan" 🧸 (put away toys) to the evening default list, at the top — ships as a default task for new installs; kept short to match the other task names' length
- [ ] Consider similar quick default-list content tweaks as they come up (this section is the catch-all for small task-list changes, not a big feature)

## 7. Native App Store distribution

**Goal:** a real installable app, not just an "Add to Home Screen" web app.

Agreed plan (2026-09-04):
- [x] Offline/save resilience — done, see §5
- [x] Email deliverability — done, see §5
- [ ] Write a short, plain-language privacy policy and settle what data is actually collected — likely required for App Store review given the app's audience, not just a nice-to-have
- [ ] Parent creates an Apple Developer account ($99/year) — their account, their purchase
- [ ] Wrap the app with Capacitor (introduces Node.js/npm and a real build step for the first time — a deliberate, scoped exception to the "no build tools" rule elsewhere in this project)
- [ ] Get it building and running on the iOS Simulator before touching real submission
- [ ] Store listing prep: icons, screenshots, description; then submit
- [ ] Android/Google Play is a separate later decision ($25 one-time, same Capacitor project can target it)

Deliberately **not** blocking this on the full visual identity system (§4) — ship v1 with the current, already-considered look; iterate visuals in a v1.1 update after launch. Small well-defined color/content tweaks (like §6) are fine to fold in anytime since they don't add real rework, either before or after.

## 8. Daily reminder notifications

**Goal:** remind the family it's time for the morning/evening routine, without anyone needing to remember to open the app.

> Depends on §7 (native distribution) — reliable scheduled notifications aren't practical from a pure web app (iOS web-push support for installed PWAs is limited/finicky). This is a natural fit for Capacitor's local notifications plugin once the app is wrapped, since these are fixed-time daily reminders, not server-triggered push — no backend notification service needed.

- [x] Morning reminder, default **07:00**
- [x] Evening reminder, default **19:00**
- [x] Both times configurable per family in parent mode
- [x] Reschedule automatically when a parent changes either time
- [x] One shared-device reminder rather than per-kid, matching the single-device household model elsewhere in the app
- [x] Handle notification permission denied gracefully — the reminder is a nice-to-have, the app must work fully without it (same principle as §1's notification handling)

## 9. Internationalization (Swedish → English → Spanish)

**Goal:** Swedish ships first (already done); English and Spanish follow shortly after as a near-term plan, not someday-maybe.

> Deliberately **not** bundled into the native App Store migration (§7) — ship v1 native in Swedish only, matching what exists today, then add languages as a fast-follow update once the translation system below is actually built. Doing both at once risks neither landing cleanly.

- [ ] Extract all hardcoded UI text (buttons, labels, errors, Parent Mode — currently inline Swedish strings throughout `app.js`) into a translation dictionary with a lookup function used everywhere, instead of literal strings
- [ ] Decide where the language setting lives — likely a per-family setting alongside currency/reward settings (`state`), not a per-browser preference, since a household shares one device and one language
- [ ] Separate default task lists per language (today's Swedish "Frukost, Kläder..." defaults need English/Spanish equivalents for new families choosing those languages)
- [ ] Translate the privacy policy (`privacy.html`) into each supported language
- [ ] **Known wrinkle**: Supabase's built-in magic-link email template is one fixed language for the whole project, not per-recipient. Properly localizing the login email means sending it ourselves via Resend directly instead of through Supabase's template — meaningfully more work than the rest of this list, worth scoping separately rather than assumed-included
- [ ] Decide how a family picks/changes their language (first-run choice? Parent Mode setting? Both?)

## 10. Web landing page

**Goal:** someone who visits `morninglist.app` on the web meets a page that explains and promotes the app, not a bare sign-in/sign-up screen. Today the root URL drops a first-time visitor straight into the login screen, which reads as strange when they don't yet know what the product is.

- [x] Decide the URL layout — chose the low-risk option: one page. `app.js` shows the landing screen to signed-out web visitors who haven't clicked through yet on this browser (`showLandingScreen()`), so no URL, redirect, Universal Link or email link had to move
- [x] The native iOS app keeps opening straight into login, never the landing page (`isNativeApp`)
- [ ] **Constraint — auth links land on the root URL.** The confirmation and password-reset links, Supabase's redirect allow-list, the Universal Links setup (`.well-known/apple-app-site-association`), the `type=signup`/`type=recovery`/`error=` hash handling in `app.js`, and the email templates all point at `https://morninglist.app/`. Moving the app means changing every one of them together, or keeping those callbacks routed to the app wherever the landing page lives
- [x] Content: what it is, how it works in three steps, "Skapa konto" / "Logga in" buttons
- [ ] Still to add: a few screenshots, and the App Store / TestFlight link once one exists
- [x] Build it from the brand system, not fresh: the logo lockup and spacing rules in `brand-guide.md` §7, Fraunces headings, the calm cream palette, the same copy tone (plain, no exclamation marks doing the work of a sentence)
- [x] Link the privacy policy (`privacy.html`)
- [ ] Add a contact address
- [x] Basics for sharing and search: page title, description, Open Graph tags (currently the small icon as image; a proper 1200x630 share image is still to do)
- [x] Kept zero-build like the rest of the web app: plain HTML/CSS/JS, no framework
- [ ] Swedish first; English/Spanish follow with §9

## 11. VAB mode (sick-day list)

**Goal:** when the kids are home sick (VAB — *vård av barn*, the Swedish term for staying home to care for a sick child), a parent switches on a mode that swaps the checklist for activities that suit a sick day — drink water, do a puzzle, rest, read — while keeping the essentials that still make sense (e.g. brushing teeth). The normal routine (get dressed, backpack, out the door) shouldn't be shown to a child who is staying in bed.

- [ ] Decide how a task takes part: each task gets a flag "also on sick days" (kept in VAB mode) vs "normal days only" (hidden in VAB mode), plus a separate set of sick-day-only tasks that appear only in the mode. Simplest for a parent to understand, and lets each family decide which main activities stay
- [ ] Ship sensible defaults: sick-day tasks such as 💧 drink water, 🧩 do a puzzle, 😴 rest, 📖 read/listen to a story, 🍲 eat something; and keep a few main ones (e.g. 🦷 teeth) flagged as staying
- [ ] Icons follow the brand rule: one emoji, one literal thing, no full sentences — and every new icon gets tested on an actual kid before it ships (`brand-guide.md` §2)
- [ ] Where the switch lives: a quick on/off a parent can reach without digging through Parent mode (behind the parental gate, so a child can't turn it on to skip the real list), with a clear visible indicator on the kid cards while it's on
- [ ] Decide the scope: whole family at once, or per child (one sick, one at school)? Per child is more realistic but more UI
- [ ] Decide what it does to the reward: do sick-day tasks still earn the session reward, earn less, or pause the weekly jar so a sick week doesn't cost anyone their reward? This interacts with the weekly cycle in §1 — decide together
- [ ] Turning it off: make sure it can't get stuck on. Options: back to normal automatically at the next morning, or a gentle reminder after N days
- [ ] Switching mid-day: define what happens to tasks already ticked when the list changes — ticked normal tasks must not be lost or double-counted
- [ ] Interplay with reminders (§8): the morning reminder should probably still fire, or be paused while VAB mode is on — decide
- [ ] Naming: "VAB" only means something in Sweden. Use a plain Swedish label in the UI (e.g. "Sjukdag" or "Hemma-läge") and a language-neutral internal name, so it translates cleanly with §9
- [ ] Data shape: a per-task flag plus a mode flag (family- or kid-level) in `state`; older saved states without them must load unchanged

## 12. Guided toothbrushing step

**Goal:** turn the plain "Tänder & hår" tick-box into an active 2-minute guided brushing routine for the toothbrushing part specifically, so kids actually brush long enough and cover the whole mouth, not just tap the checkbox.

- [ ] A countdown timer for the full 2 minutes, running only while this step is open
- [ ] Split into 4 quadrants — upper left, upper right, lower left, lower right — 30 seconds each, with a clear indicator of which quadrant is current
- [ ] A fun character (monster/animal) or simple animation to hold a young kid's attention for the full 2 minutes — needs actual art/animation work, bigger scope than the rest of the app's plain-emoji icons
- [ ] Sound/vibration cue at each quadrant change and at the end, for a kid who isn't watching the screen the whole time
- [ ] Decide how this fits the existing task model: a special-cased task (like the reward-jar's session logic), or a generic "guided step" mechanism other tasks could reuse later
- [ ] Decide what happens if the kid closes/backgrounds the app mid-brush — resume, restart, or just count it done regardless
- [ ] Must still work for a family that doesn't want it — a way to keep the plain tick-box instead, since not every kid wants a 2-minute guided routine every time
- [ ] Consider offline behavior and battery/screen-on time for 2 minutes of active use, twice a day

## 13. More delight on completing a task and a session

**Goal:** make finishing a task, and finishing the whole list, feel like more of a moment — without changing the actual reward math (§1's weekly cap is deliberately tuned, not a bug to fix by making currency more generous).

> Prompted by real feedback: a tester (a child in the extended family) wanted 1 candy per task rather than 1 per session, since a single tick currently feels flat. Considered and set aside: a second currency that converts task-points into session-points — too abstract for a 4–8 year old who can't read yet (brand-guide.md §2), and it would need explaining a conversion rate to a small child. The chosen direction instead is to make each moment feel more rewarding on its own, while every task and full-session amount stays exactly as it is today.

- [ ] **Per-task moment**: something more than the current checkmark + chime when a single task is ticked — the task's own emoji reacting (bounce, sparkle), not a generic effect, so completing "🦷 Tänder" feels different from "🎒 Ryggsäck"
- [ ] **Per-session moment** (i.e. §3's "extra feedback on the first tick of the day", generalized to the *last* tick too): the current "Allt klart för idag! 🎉" text is the whole payoff for finishing every task — make this bigger and more noticeable, the actual "win" moment of the whole session
- [ ] **In-session progress with charm**: as tasks get ticked, show something building toward the session reward *before* it's fully earned — explicitly not a plain progress bar; needs an actual charming/fun treatment (a character reacting to each tick, filling something in a delightful way), not just a mechanical percentage
- [ ] **Longer-term aspiration, explicitly not scoped yet**: real character/animation work, in the spirit of Duolingo's characters and Klarna's checkout animations (reportedly done by a Swedish design studio) — a genuine quality bar to aim for, not a specific mechanic yet. Bigger than anything else in this app so far (real art/animation, not emoji), and directly overlaps with §12's "fun monster/animal" for the toothbrushing step — worth designing one character system that can serve both rather than two unrelated ones
- [ ] Test every new celebration on an actual kid before it ships, same rule as icons (brand-guide.md §2) — a "positive" moment that isn't actually fun to a 6-year-old is worse than nothing
- [ ] Keep it fast: a child does this twice a day, every day — a celebration that's delightful once and tedious by the tenth time is a net loss

## 14. Backend reporting / usage dashboard

**Goal:** visibility into real usage across all families, for the developer's own insight — not an in-app feature for families themselves.

> Prompted by manually cleaning up test signups in Supabase and wanting the same kind of at-a-glance view for actual usage. `families_overview` (see `supabase/schema.sql`) is the first small step — a readable admin-only SQL view — but doesn't yet answer "how many families are actually using this."

- [ ] Total signups, and total *excluding* never-started accounts (no kids ever added) — this session's cleanup queries (zero `kid_count`, or email-pattern-based) are the manual version of this
- [ ] Active vs inactive: e.g. a family with a completion logged today or yesterday counts as active; define the exact cutoff
- [ ] Historic growth: signups and active-family count over time, not just a current snapshot
- [ ] Which default settings get changed, and how often — currency symbol, reward-per-session amount, reset day/time (§1), reminder times (§8) — a signal for which settings actually matter to real families vs which are unused complexity
- [ ] Decide where this lives: more SQL views like `families_overview` (simplest, no new code, SQL-Editor-only — same access pattern already set up), vs an actual small admin page/screen (more work, but easier to check regularly without hand-writing SQL each time)
- [ ] If it becomes an admin page rather than raw SQL: needs its own auth story (must not be reachable by an ordinary family account), separate from everything above in this file, which is all about the product itself, not tooling for the developer
- [ ] Keep it privacy-conscious even though it's developer-only: aggregate counts over exposing individual families' data where a count alone would answer the question
