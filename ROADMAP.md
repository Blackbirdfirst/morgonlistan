# Roadmap

Ideas discussed and deliberately deferred — not yet built, unless noted otherwise. Sections 1–4 are nearer-term feature areas under active consideration; section 5 is explicitly parked backlog.

## 1. Cycle end + candy reset

**Goal:** the game runs in cycles (e.g. Mon–Sat). At the end of the cycle the user gets to use their candy, is notified, and the counter resets to zero for a new cycle.

> Note: a basic version of the boundary exists today — the reward week resets at Saturday 18:00, derived from timestamps (see `getRewardWeekStart()` in `app.js` / `CLAUDE.md`), not a running timer. Everything below extends that into a full cycle with explicit states, a redeem step, notifications, and history.

**Core behaviour**
- Define the cycle boundary explicitly — start day/time and end day/time, in a fixed timezone (e.g. Europe/Stockholm)
- Derive cycle state from timestamps, not from a running timer — must be correct even if the app was closed all week
- Cycle states: `active` → `ended / ready to redeem` → `reset` → new `active`
- Freeze earning once the cycle has ended (no new candy until the new cycle starts)

**Redeem step**
- "Use your candy" screen at cycle end: shows total earned, lets the user cash it in
- Decide whether redeeming is a manual confirm ("I got my candy") or automatic at reset
- Decide the carry-over rule: unspent candy is lost, or rolls into next cycle, or capped roll-over

**Notifications**
- Cycle-end notification: "The week is done — you have X candies to use today"
- Reset notification / in-app message: "New cycle started, candy is back to 0"
- Optional heads-up the day before ("1 day left to earn")
- Handle notification permission being denied — the same info must be visible in-app

**Visibility in the UI**
- Persistent cycle indicator: which day of the cycle, days remaining, progress
- Clear "cycle ended" banner/state so the reset never looks like lost data or a bug
- Cycle history: candies earned and used per past cycle

**Edge cases**
- Task completed after the cutoff — which cycle does it count toward?
- Retroactive edits/undo of a task after the cycle closed
- Timezone changes and DST shifts across the boundary
- Multiple users/profiles — do they share one cycle or run independently?
- First-ever cycle and a cycle where zero candy was earned

## 2. Easier startup configuration (first-run setup)

**Goal:** get from install to a usable app without going into parent mode.

- First-run wizard that triggers automatically on a fresh install
- Step 1: pick number of kids (1 / 2 / 3 / more)
- Step 2: enter names for all of them on one screen, then create all profiles in one go
- Optional in the same flow: avatar or colour per kid, so they can tell profiles apart
- Sensible defaults applied automatically — default task lists, default cycle, default candy values — so the app works immediately with zero further setup
- Parent mode stays available afterwards for editing, but is never required to start
- Skippable / editable: adding or removing a kid later must not require a reinstall
- Don't re-show the wizard on later launches; handle the "started but didn't finish" case

## 3. Morning list: instant first point

**Goal:** an immediate, easy win at the very start of the morning so it feels engaging from the first second.

- Add a first task to the morning list — "Get out of bed" / "Steg upp ur sängen"
- Place it as the top item so it's the first thing seen
- Award candy for it like any other task — note: candy is only granted once all tasks on the list are done, so per-task value isn't a balance concern
- Consider a bit of extra feedback on the first tick of the day — animation, sound, "You're off!"
- Make sure it can't be double-counted across the day
- Consider the same pattern for other lists (e.g. an easy opener on the evening list)

## 4. Visual identity and colour system

**Goal:** a defined look that belongs to the app, instead of ad-hoc colours per screen.

> Note: a derived-color system already exists (see "Color system" in `CLAUDE.md`) — kids pick from a curated 6-color palette and every other UI color is computed from that one hue via HSL. What's below is about formalizing that into a documented, tokenized system and extending it to typography, dark mode, and contrast — not starting from scratch.

- Write a short brand guideline document and keep it in the repo, so every new screen builds from it
- Define the palette by role, not by taste: primary, secondary, background/surface, text, plus semantic colours (success, warning, disabled)
- One colour per kid profile, drawn from the palette and distinguishable at a glance
- Decide the overall mood — playful and childlike, or calm and modern with playful accents
- Implement as design tokens / theme variables, never hard-coded hex values in components
- Check contrast for text and for the tick/untick states (kids should read state instantly)
- Colour must not be the only signal — pair with icon or shape for done/not-done
- Define the celebration/reward colour used at cycle end and on completion
- Decide dark mode: support it properly or lock the app to light
- Pick typography at the same time — one family, a small set of sizes
- Test on a real phone in daylight and in a dim bedroom (morning use case)

## 5. Backlog / later

Not for now — ideas parked until the core app is solid.

**Content and engagement**
- Seasonal and holiday visual themes (winter + Santa, summer, World Cup, etc.) — build on top of the token system from section 4 so a theme is a swap, not a rewrite
- Surprise bonus tasks (silly dance, tell a joke) — decide whether they're extra or replace a normal task, and how often they appear
- More gamification: streaks, badges. Watch the downside — streaks punish a missed day, which lands hard on a small kid, so consider forgiving mechanics

**Design maturity**
- Custom hand-drawn icon set to replace emoji, if the emoji-based MVP validates well

**Account & sync maturity**
- Real accounts + a Supabase backend now exist (one family per account, isolated by row-level security) — see `CLAUDE.md`
- Today, sharing access within a family means literally sharing one login email (e.g. both parents use the same address). A proper multi-user-per-family model — separate logins for each parent, linked to the same family's data via an invite step — is deferred until the shared-login approach actually becomes annoying in practice
- No offline handling yet — a dropped connection mid-use silently fails to save; worth a local queue/retry if it becomes a real problem
- Hosting still needs to move off the Claude Artifact to a real static host (Vercel/Netlify/GitHub Pages/Cloudflare Pages) — not yet decided

**Scaling to other families**
- Children's privacy rules apply: COPPA (US) and GDPR-K / the Swedish age of consent for data processing. Needs proper attention before any public/wider launch
- Prefer keeping kids' data local or minimal — the less personal data leaves the device, the smaller the compliance surface
- Parental consent flow, data deletion, and a privacy policy written in plain language
