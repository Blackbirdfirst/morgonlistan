# CLAUDE.md

## Project

Morgonlistan — a morning/evening checklist app for kids. Plain vanilla HTML/CSS/JS on the frontend: no build tools, no frameworks, no bundler. This is deliberate — keep it this way unless there's a strong reason to change. Data is backed by Supabase (Postgres + Auth), added after real usage showed local-only storage couldn't support one family across multiple devices, or multiple separate families.

## Files

- `index.html` — shell; loads `style.css`, the Supabase JS client, `config.js`, and `app.js`
- `style.css` — all styling
- `app.js` — all application logic (auth, state, rendering, interactions)
- `config.js` — **gitignored**, holds this machine's Supabase URL + anon key; copy `config.example.js` to create it
- `config.example.js` — committed template for `config.js`
- `supabase/schema.sql` — the database schema (`families` table, RLS policies, auto-create-row trigger); run once per Supabase project via the SQL Editor
- `serve.py` — local dev server
- `.claude/launch.json` — dev server config for the Browser pane preview tool
- `morgonlistan-brand-spec.md` — the queued visual identity spec (see `ROADMAP.md` §4); not yet implemented

## Running locally

1. Create a Supabase project, run `supabase/schema.sql` in its SQL Editor, then copy `config.example.js` to `config.js` and fill in that project's URL + anon key (Project Settings → API).
2. ```bash
   python3 serve.py 8000
   ```

Always use `serve.py`, not `python3 -m http.server` — the plain stdlib server sends no cache-control headers, which caused stale-JS bugs on mobile Safari reloads. `serve.py` sends `Cache-Control: no-store` on every response.

Then open `http://<mac-lan-ip>:8000` on a phone on the same WiFi (find the IP with `ipconfig getifaddr en0`).

## Auth & data model

Signing in is passwordless (magic-link email via Supabase Auth — see `renderLoginScreen()` / `initAuth()` in `app.js`). Each signed-in family gets exactly one row in the `families` table, auto-created by a Postgres trigger the moment they first sign up (`supabase/schema.sql`). Row Level Security means a user can only ever read/write their own row.

The whole app state lives in that row's single `state` jsonb column — same shape as the old localStorage blob, which kept the migration mostly to "swap the read/write layer," not a redesign:

```
{
  kids: [{ id, name, color }],
  tasks: [{ id, name, emoji }],         // morning list
  eveningTasks: [{ id, name, emoji }],  // evening list
  rewardPerSession: number,             // currency earned per fully-completed session
  currencySymbol: string,               // emoji or text, e.g. "🍬"
  completions: [{ kidId, taskId, date, amount, timestamp }],
}
```

`completions` is one flat log used for three things, distinguished by `taskId`:
- a real task's id — just tracks that task as checked today (`amount: 0`, no currency)
- `"session-reward-morning"` / `"session-reward-evening"` — the currency earned for finishing a whole session
- `"manual-adjustment"` — a parent's manual balance tweak in Parent Mode

`timestamp` is used for precise weekly-boundary math; older records without it fall back to noon of `date`.

**Offline resilience**: `saveState()` stashes the change in `localStorage` (`PENDING_SAVE_KEY`) before writing, retries with backoff (3 attempts) on failure, and leaves the change cached if all retries fail. A pending change is flushed automatically on the next app load (`bootstrapApp`) and as soon as the browser reports connectivity again (`window`'s `online` event) — a dropped connection mid-use no longer silently loses a kid's progress. If reopening the app while still offline, the cached pending state is shown directly rather than an outdated (or empty) fetch.

**Shared family access**: today, "sharing" a family (e.g. both parents) means literally sharing one login email — there's no concept of multiple auth users linked to one family row yet. That's a deliberate v1 simplification (see `ROADMAP.md` if a proper multi-user-per-family model is ever needed).

## Key architectural decisions

- **No frameworks, no build step, by design** — matches the user's preference for something simple to inspect and edit without heavy tooling.
- **Morning/evening switching**: `getCurrentPeriod()` returns evening for hours 18:00–03:59, morning otherwise. This drives which task list shows, each kid's panel color (a deliberately darker shade of their own color at night, not a generic dark mode), and the sun/moon icon in the title.
- **Reward model**: 1 currency unit is earned per fully-completed session, not per task (see `toggleTask()`). This caps the total at 2/day, 14/week by design — that cap is load-bearing for the jar display below, not arbitrary.
- **Weekly reset**: `getRewardWeekStart()` computes the most recent Saturday 18:00 — not a calendar week or midnight boundary — because that's when parents hand out the week's reward and the evening list flips over in the same moment. This logic has been tested against edge cases (the exact cutoff second, Saturday morning vs. evening, Sunday, midweek); re-verify those cases if it's touched.
- **Color system**: kids pick one of 6 curated base colors; `deriveKidTheme()` derives the done-state tint and the checkmark/celebration accent from that same hue via HSL math (`hexToRgb` / `rgbToHsl` / `hslToRgb` / `rgbToHex`). Never hardcode an independent accent color elsewhere — derive it, or the palette will clash (this happened twice before the derivation system existed).
- **Reward jar display**: a fixed 7×2 grid of 14 slots (`buildRewardJar()`), filled vs. faint outline, at a fixed pixel height regardless of count — deliberate, to avoid layout shift/flicker as the count changes. A balance above 14 (from a manual adjustment) shows a completely full jar plus a small "+N" badge rather than ever resizing the jar.
- **Parental gate**: a birth-year check (`openParentGate()`), not a simple confirm button — must compute to age 18–100. No example year in the placeholder, since a kid could just copy it.

## Public hosting

Live on **GitHub Pages**: `https://blackbirdfirst.github.io/morgonlistan/`. Deploys automatically from a push to `main` (Settings → Pages → Deploy from a branch → `main` / root) — no separate build/deploy step. `config.js` is committed (see Files above) since GitHub Pages serves the repo as-is with no build step to inject it otherwise; this is safe because it only holds the Supabase publishable key, not a secret.

Superseded the earlier Claude Artifact approach (single self-contained HTML file) and the local-only `serve.py` LAN setup — those still exist for local dev (see "Running locally"), but the GitHub Pages URL is the one to actually share with other families.

## Git

Local repo, `main` branch, pushed to `origin` — `git@github.com:Blackbirdfirst/morgonlistan.git` (SSH; a dedicated key at `~/.ssh/id_ed25519_morgonlistan`, configured in `~/.ssh/config` for `github.com`). Git identity is set locally for this repo only (Bjorn Jansson / bjornjansson80@gmail.com) — not the machine's global config.
