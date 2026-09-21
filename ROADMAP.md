# Roadmap

Living list — status: `[ ]` todo · `[~]` in progress · `[x]` done. Sections 1–4 and 6–7 are nearer-term feature areas under active consideration; section 5 is explicitly parked backlog.

## 1. Cycle end + candy reset

**Goal:** the game runs in cycles (e.g. Mon–Sat). At the end of the cycle the user gets to use their candy, is notified, and the counter resets to zero for a new cycle.

> Note: a basic version of the boundary exists today — the reward week resets at Saturday 18:00, derived from timestamps (see `getRewardWeekStart()` in `app.js` / `CLAUDE.md`), not a running timer. Everything below extends that into a full cycle with explicit states, a redeem step, notifications, and history.

**Core behaviour**
- [ ] Define the cycle boundary explicitly — start day/time and end day/time, in a fixed timezone (e.g. Europe/Stockholm)
- [ ] Derive cycle state from timestamps, not from a running timer — must be correct even if the app was closed all week
- [ ] Cycle states: `active` → `ended / ready to redeem` → `reset` → new `active`
- [ ] Freeze earning once the cycle has ended (no new candy until the new cycle starts)

**Configurable reset day**
- [ ] Let a parent change the reset day from Saturday to any other weekday, in parent mode
- [ ] Keep Saturday 18:00 as the default — it should work out of the box without touching this
- [ ] Optionally make the reset time configurable too, not just the day
- [ ] Handle a change made mid-cycle: decide whether the current cycle shortens, extends, or completes on the old day and only then switches
- [ ] Never silently wipe earned candy when the setting changes — warn first if the change would end the cycle early
- [ ] Make the current setting visible in the app ("resets on Saturdays"), so the reset is never a surprise
- [ ] Update the copy in notifications and the cycle indicator to use the chosen day, not hard-coded "Saturday"

**Redeem step**
- [ ] "Use your candy" screen at cycle end: shows total earned, lets the user cash it in
- [ ] Decide whether redeeming is a manual confirm ("I got my candy") or automatic at reset
- [ ] Decide the carry-over rule: unspent candy is lost, or rolls into next cycle, or capped roll-over

**Notifications**
- [ ] Cycle-end notification: "The week is done — you have X candies to use today"
- [ ] Reset notification / in-app message: "New cycle started, candy is back to 0"
- [ ] Optional heads-up the day before ("1 day left to earn")
- [ ] Handle notification permission being denied — the same info must be visible in-app

**Visibility in the UI**
- [ ] Persistent cycle indicator: which day of the cycle, days remaining, progress
- [ ] Clear "cycle ended" banner/state so the reset never looks like lost data or a bug
- [ ] Cycle history: candies earned and used per past cycle

**Edge cases**
- [ ] Task completed after the cutoff — which cycle does it count toward?
- [ ] Retroactive edits/undo of a task after the cycle closed
- [ ] Timezone changes and DST shifts across the boundary
- [ ] Multiple users/profiles — do they share one cycle or run independently?
- [ ] First-ever cycle and a cycle where zero candy was earned

## 2. Easier startup configuration (first-run setup)

**Goal:** get from install to a usable app without going into parent mode.

> Current gap: today, first-run only prompts for a single child. The wizard below (multiple kids, one screen) isn't built yet.

- [ ] First-run wizard that triggers automatically on a fresh install
- [ ] Step 1: pick number of kids (1 / 2 / 3 / more)
- [ ] Step 2: enter names for all of them on one screen, then create all profiles in one go
- [ ] Optional in the same flow: avatar or colour per kid, so they can tell profiles apart
- [ ] Sensible defaults applied automatically — default task lists, default cycle, default candy values — so the app works immediately with zero further setup
- [ ] Parent mode stays available afterwards for editing, but is never required to start
- [ ] Skippable / editable: adding or removing a kid later must not require a reinstall
- [ ] Don't re-show the wizard on later launches; handle the "started but didn't finish" case

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

- [ ] Morning reminder, default **07:00**
- [ ] Evening reminder, default **19:00**
- [ ] Both times configurable per family in parent mode
- [ ] Reschedule automatically when a parent changes either time
- [ ] One shared-device reminder rather than per-kid, matching the single-device household model elsewhere in the app
- [ ] Handle notification permission denied gracefully — the reminder is a nice-to-have, the app must work fully without it (same principle as §1's notification handling)

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
