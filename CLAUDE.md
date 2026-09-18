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
- `supabase/email-templates/` — source for Supabase Auth email templates (e.g. `reset-password.html`); no CLI on this machine, so paste each file's contents into the Supabase dashboard (Authentication → Email Templates) by hand, same pattern as the Edge Function below
- `serve.py` — local dev server
- `.claude/launch.json` — dev server config for the Browser pane preview tool
- `brand-guide.md` — the settled visual identity and copy tonality reference (see `ROADMAP.md` §4); supersedes the removed `morgonlistan-brand-spec.md`
- `app-icon.svg` — source of the App Store icon; see "Icons" in `brand-guide.md` for how it maps to `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- `ios/` — the native iOS wrapper (Capacitor); see "Native iOS app" below
- `www/` — **gitignored**, a generated copy of the four web files for Capacitor to bundle; never edit directly, see "Native iOS app"
- `capacitor.config.json`, `package.json` — Capacitor/npm config, added solely to support the iOS wrapper (see "Native iOS app")

## Running locally

1. Create a Supabase project, run `supabase/schema.sql` in its SQL Editor, then copy `config.example.js` to `config.js` and fill in that project's URL + anon key (Project Settings → API).
2. ```bash
   python3 serve.py 8000
   ```

Always use `serve.py`, not `python3 -m http.server` — the plain stdlib server sends no cache-control headers, which caused stale-JS bugs on mobile Safari reloads. `serve.py` sends `Cache-Control: no-store` on every response.

Then open `http://<mac-lan-ip>:8000` on a phone on the same WiFi (find the IP with `ipconfig getifaddr en0`).

## Auth & data model

Signing in is email + password via Supabase Auth (`renderLoginScreen()` in `app.js`, with `login`/`signup`/`forgot` modes drawn on one shared screen). "Glömt lösenordet?" (forgot password) is its own dedicated email-only mode rather than reusing the login form, matching the standard pattern of not making someone fill in a password field they don't have. Password recovery is detected synchronously from `window.location.hash` at script load (`type=recovery`) rather than relying on Supabase's `PASSWORD_RECOVERY` event, which doesn't reliably fire when a session already exists on the device — see the comment above `inPasswordRecovery` in `app.js`. Each signed-in family gets exactly one row in the `families` table, auto-created by a Postgres trigger the moment they first sign up (`supabase/schema.sql`). Row Level Security means a user can only ever read/write their own row.

**Email sending**: auth emails (signup confirmation, password reset) go out via custom SMTP (Supabase Project Settings → Authentication → SMTP Settings), not Supabase's shared default sender — that shared sender has a low rate limit that was hit during our own testing. Configured with **Resend**, sending from the verified domain `morninglist.app` (DKIM via a `resend._domainkey` TXT record, DMARC via `_dmarc` TXT, plus `rsend`/`send` CNAMEs pointing at Resend's sending infrastructure). If email deliverability ever breaks, check Resend's dashboard and that domain's DNS records first. The password-reset email's HTML is a custom branded template (`supabase/email-templates/reset-password.html`) rather than Supabase's plain default — see "Files" above for how to deploy it.

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

**Account deletion** (Parent mode → Konto → Radera konto, `openDeleteAccountModal()` in `app.js`): requires typing "RADERA" to confirm, then calls the `delete-account` Edge Function (`supabase/functions/delete-account/index.ts`). That function deletes the `auth.users` row via the Admin API using the service role key (only available server-side); the `families` row disappears automatically via its `on delete cascade` FK — no separate data-deletion step needed. Added to satisfy Apple App Store Guideline 5.1.1(v) (apps with account creation must offer in-app account deletion, not just a support contact). Deploy/update this function via the Supabase dashboard's Edge Functions editor (no CLI installed on this machine) — paste the file's contents in as a new function named `delete-account`.

## Key architectural decisions

- **No frameworks, no build step, by design** — matches the user's preference for something simple to inspect and edit without heavy tooling.
- **Morning/evening switching**: `getCurrentPeriod()` returns evening for hours 18:00–03:59, morning otherwise. This drives which task list shows, each kid's panel color (a deliberately darker shade of their own color at night, not a generic dark mode), and the sun/moon icon in the title.
- **Reward model**: 1 currency unit is earned per fully-completed session, not per task (see `toggleTask()`). This caps the total at 2/day, 14/week by design — that cap is load-bearing for the jar display below, not arbitrary.
- **Weekly reset**: `getRewardWeekStart()` computes the most recent Saturday 18:00 — not a calendar week or midnight boundary — because that's when parents hand out the week's reward and the evening list flips over in the same moment. This logic has been tested against edge cases (the exact cutoff second, Saturday morning vs. evening, Sunday, midweek); re-verify those cases if it's touched.
- **Color system** (see `brand-guide.md`): kids pick one of 12 curated muted base colors (`KID_COLORS`); `deriveKidTheme()` derives the done-state background tint from that same hue via HSL math (`hexToRgb` / `rgbToHsl` / `hslToRgb` / `rgbToHex`). The checkmark and celebration accents are deliberately *not* derived — they're the shared `SPLASH_COLORS` (`tick` for a checked task, `reward` for a completed session), designed to work against every base color at once. Don't add a third kind of accent color without adding it to `SPLASH_COLORS` and the brand guide — the whole point is one small, shared set of "win" colors, not per-feature hardcoding.
- **App-wide chrome** (login screen, primary buttons, modal sheets, general background — everything outside a kid's own card) also follows the brand: the global background and `.modal-sheet` are the warm paper cream (`#F7F2E9`), and `.primary-btn` / focus rings / selected states use Coral Pop (`#F0654A`, same as `SPLASH_COLORS.reward` and the email CTA button) rather than the old blue theme. Secondary "add" buttons (`.add-row-btn`, `.stepper-btn`) use a calm sand tint, not a color from the splash set — they shouldn't visually compete with the one real call to action on a screen.
- **Typography**: Fraunces (display/serif, loaded in `index.html`) for anything that's the brand speaking — the app title, kid names, dialog titles (see `.home-title` / `.kid-name` / `.modal-title` / `.parent-header .title` in `style.css`). Karla (the global body font) for everything the product itself is doing, including uppercase section labels — never switch a `.section-title`-style label to Fraunces, that's a Karla-only role per the brand guide.
- **Reward jar display**: a fixed 7×2 grid of 14 slots (`buildRewardJar()`), filled vs. faint outline, at a fixed pixel height regardless of count — deliberate, to avoid layout shift/flicker as the count changes. A balance above 14 (from a manual adjustment) shows a completely full jar plus a small "+N" badge rather than ever resizing the jar.
- **Parental gate**: a birth-year check (`openParentGate()`), not a simple confirm button — must compute to age 18–100. No example year in the placeholder, since a kid could just copy it.

## Public hosting

Live on **GitHub Pages**, served under the custom domain **`morninglist.app`** (`CNAME` file in repo root). The original `https://blackbirdfirst.github.io/morgonlistan/` URL now auto-redirects there. Deploys automatically from a push to `main` (Settings → Pages → Deploy from a branch → `main` / root) — no separate build/deploy step. `config.js` is committed (see Files above) since GitHub Pages serves the repo as-is with no build step to inject it otherwise; this is safe because it only holds the Supabase publishable key, not a secret.

Superseded the earlier Claude Artifact approach (single self-contained HTML file) and the local-only `serve.py` LAN setup — those still exist for local dev (see "Running locally"), but `https://morninglist.app` is the one to actually share with other families.

## Git

Local repo, `main` branch, pushed to `origin` — `git@github.com:Blackbirdfirst/morgonlistan.git` (SSH; a dedicated key at `~/.ssh/id_ed25519_morgonlistan`, configured in `~/.ssh/config` for `github.com`). Git identity is set locally for this repo only (Bjorn Jansson / bjornjansson80@gmail.com) — not the machine's global config.

## Native iOS app

Wrapped with **Capacitor** (`app.morninglist.ios`, display name "The Morning List") — the one deliberate exception to "no build tools," scoped narrowly to just the native app packaging. The actual web app (`index.html`/`style.css`/`app.js`/`config.js`) is still zero-build and still what GitHub Pages serves directly; nothing about the live web app changed.

Capacitor requires its bundled web assets in their own folder (`www/`), not the repo root, so **after editing any of the four web files, run `npm run cap:sync`** before testing/building the iOS app — this copies the current files into `www/` and syncs Capacitor's `ios/App/App/public`. This is the one place a "build step" exists, and it only matters for the native app; the live website needs no such step and keeps working exactly as before.

Requires Node.js (installed via `nvm`, not Homebrew — this machine had neither) and full Xcode (not just Command Line Tools) to open/build/run. Uses Capacitor 8's default Swift Package Manager integration, **not CocoaPods** — this machine's system Ruby (2.6) is too old for modern CocoaPods, but that's a non-issue since no Podfile is generated.

To open the Xcode project: `npx cap open ios`.

**Universal Links**: the password-reset email link (`https://morninglist.app/...`) opens the native app directly instead of Safari, via `.well-known/apple-app-site-association` (served from the repo root, so GitHub Pages hosts it — no server config needed) plus the `com.apple.developer.associated-domains` entitlement in `ios/App/App/App.entitlements`. That entitlement needs both the App ID's Associated Domains capability enabled in the Apple Developer portal *and* a provisioning profile generated after that capability was added — an older profile predating it will fail the archive step with a clear "doesn't include the Associated Domains capability" error. `App.entitlements` is wired into the build via `CODE_SIGN_ENTITLEMENTS` in `project.pbxproj` (both Debug and Release configs). On the JS side, Capacitor's `@capacitor/app` plugin surfaces the incoming URL via the `appUrlOpen` event (app already running/backgrounded) or `getLaunchUrl()` (cold launch) — see the top of `initAuth()`'s section in `app.js`; both paths just set `window.location.hash` and reload, reusing the same synchronous `type=recovery` detection as the web flow rather than a separate code path.
