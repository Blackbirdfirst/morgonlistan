// ---------- Storage ----------

const DEFAULT_TASKS = [
  { id: "t0", name: "Vakna", emoji: "🛌" },
  { id: "t1", name: "Frukost", emoji: "🍳" },
  { id: "t2", name: "Kläder", emoji: "👕" },
  { id: "t3", name: "Tänder & hår", emoji: "🦷" },
  { id: "t4", name: "Ryggsäck", emoji: "🎒" },
  { id: "t5", name: "Ytterkläder & skor", emoji: "🧥" },
];

const DEFAULT_EVENING_TASKS = [
  { id: "e0", name: "Plocka undan", emoji: "🧸" },
  { id: "e1", name: "Duscha", emoji: "🚿" },
  { id: "e2", name: "Tandborstning", emoji: "🪥" },
  { id: "e3", name: "Toalett", emoji: "🚽" },
  { id: "e4", name: "Pyjamas", emoji: "🛌" },
  { id: "e5", name: "Sängen", emoji: "🛏️" },
];

// Evening list shows 18:00-03:59; morning list shows 04:00-17:59.
const EVENING_START_HOUR = 18;
const MORNING_START_HOUR = 4;

// A muted hue wheel — same saturation/lightness throughout, only the hue
// turns — so any subset a family ends up using always sits together
// harmoniously. Each kid's done-state background tint is still derived from
// whichever of these they pick (see deriveKidTheme); see brand-guide.md.
const KID_COLORS = [
  "#D9A6A0", // dusty rose
  "#C98B6E", // clay
  "#D4B483", // sand
  "#B8B383", // olive mist
  "#8FA888", // sage
  "#7FA79C", // muted teal
  "#9FC0C4", // powder blue
  "#8CA3B8", // dusty blue
  "#9A9DC4", // periwinkle
  "#A79CC0", // lavender grey
  "#A97C93", // dusty plum
  "#C99AA6", // blush
];

// Shared "splash" accents — not tied to any kid, deliberately designed to
// read clearly against every colour above. Reserved for the moment
// something is actually earned, not for a card's resting state.
const SPLASH_COLORS = {
  tick: "#FFC93C",   // sunshine — a single task checked off
  reward: "#F0654A", // coral pop — a session fully completed
};

const TASK_EMOJIS = [
  "🍳","🥣","🥪","🧃","👕","👖","🧦","🩳",
  "🦷","🪥","💇","🧴","🚿","🛁","🎒","📚",
  "✏️","🧥","🧤","🧣","👟","👢","🛏️","⏰",
  "☀️","🌙","🐶","🚗","🎵","⭐","🎁","🖐️",
  "🧸","🎈","🧹","🍽️","🚽","🏃","🧻","🥤",
];

const CURRENCY_OPTIONS = ["🍬", "❤️", "⭐", "🪙", "💰", "🏆"];
const DEFAULT_CURRENCY = "🍬";
const MANUAL_ADJUSTMENT_TASK_ID = "manual-adjustment";
// One reward is earned per fully-completed session (not per task), so the
// weekly total stays small (max 2/day, 14/week) and can be shown as icons.
const SESSION_REWARD_IDS = { morning: "session-reward-morning", evening: "session-reward-evening" };
const MAX_DISPLAY_ICONS = 14;

function defaultState() {
  return {
    kids: [],
    tasks: DEFAULT_TASKS.slice(),
    eveningTasks: DEFAULT_EVENING_TASKS.slice(),
    rewardPerSession: 1,
    currencySymbol: DEFAULT_CURRENCY,
    completions: [], // { kidId, taskId, date, amount, timestamp }
  };
}

// Fills in defaults for a state object loaded from the backend — handles a
// brand-new family (empty state) and older records missing newer fields.
function normalizeState(parsed) {
  if (!parsed || Object.keys(parsed).length === 0) return defaultState();
  if (!parsed.currencySymbol) parsed.currencySymbol = DEFAULT_CURRENCY;
  if (parsed.rewardPerSession === undefined) parsed.rewardPerSession = parsed.rewardPerTask ?? parsed.kronaPerTask ?? 1;
  if (!parsed.eveningTasks) parsed.eveningTasks = DEFAULT_EVENING_TASKS.slice();
  if (!parsed.kids) parsed.kids = [];
  if (!parsed.tasks) parsed.tasks = DEFAULT_TASKS.slice();
  if (!parsed.completions) parsed.completions = [];
  return parsed;
}

let state = null;

// ---------- Auth & sync (Supabase) ----------
// Each signed-in family has one row in the `families` table (see
// supabase/schema.sql), keyed by their auth user id. `state` above holds a
// local copy while signed in; saveState() pushes it to that row.

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUserId = null;
// Checked synchronously from the URL itself, before Supabase's async auth
// event processing even starts. Relying on Supabase's PASSWORD_RECOVERY
// event alone is not reliable: if a session is already active on this
// device (very common — the whole point of password login is staying
// signed in), Supabase quietly swaps in the new session and never fires
// a distinct recovery event at all, so the app would bootstrap straight
// past it. The recovery link's URL always carries type=recovery in its
// hash fragment regardless, so that's the one source of truth here.
let inPasswordRecovery = window.location.hash.includes("type=recovery");

// Supabase appends #error=...&error_code=...&error_description=... to the
// redirect URL instead of a session when a signup/recovery link is invalid,
// expired, or already used — most often because it's a single-use token and
// something (a mail provider's own link-scanning, a second click, simple
// delay) already consumed it before the user's real tap. Left unhandled,
// this silently lands on a bare login screen with no explanation. Read and
// strip it synchronously, same timing as inPasswordRecovery above and for
// the same reason: it also must not survive into a later email's redirect
// target via emailRedirectTo/redirectTo.
let pendingAuthError = null;
if (window.location.hash.includes("error=")) {
  const errorParams = new URLSearchParams(window.location.hash.slice(1));
  pendingAuthError = errorParams.get("error_code") === "otp_expired"
    ? "Länken har gått ut eller redan använts. Begär en ny länk."
    : "Länken är ogiltig. Försök igen.";
  history.replaceState(null, "", window.location.pathname);
}

// If this exact tab was already open on this origin (very common: the
// browser reuses an existing tab for a link tapped in Mail/Gmail rather
// than opening a new one), the confirmation/recovery link only changes the
// URL's hash — and a hash-only change is a same-document navigation, so
// the page never reloads and none of the checks above ever run. Whatever
// screen happened to be showing (e.g. "Bekräfta din e-post" from the
// original signup) just sits there forever, looking stuck, even though the
// new hash is sitting right there unprocessed. Force a real reload so it's
// picked up exactly like a fresh page load would.
window.addEventListener("hashchange", () => {
  if (window.location.hash.includes("access_token=") || window.location.hash.includes("error=")) {
    window.location.reload();
  }
});

async function fetchFamilyState(userId) {
  const { data, error } = await supabaseClient
    .from("families")
    .select("state")
    .eq("id", userId)
    .single();

  if (data) return normalizeState(data.state);

  // No row yet — normally the signup trigger creates one, but self-heal here
  // too (e.g. a user created before the trigger existed) so a missing row
  // never means silently unsaved progress.
  if (error) console.warn("Ingen familjerad hittades, skapar en:", error.message);
  const fresh = defaultState();
  const { error: insertError } = await supabaseClient
    .from("families")
    .insert({ id: userId, state: fresh });
  if (insertError) console.error("Kunde inte skapa familjerad:", insertError);
  return fresh;
}

// Offline/flaky-connection resilience: before attempting the network write,
// stash the change in localStorage. If the write fails (dropped WiFi mid
// morning rush is the real scenario here), retry with backoff; if all
// retries fail, the change stays cached and gets flushed on next load or as
// soon as the browser reports connectivity again — so a network hiccup
// never silently loses a kid's progress.
const PENDING_SAVE_KEY = "morgonlistanPendingSave";

async function saveState() {
  if (!currentUserId) return;
  localStorage.setItem(PENDING_SAVE_KEY, JSON.stringify({ userId: currentUserId, state }));

  const delays = [500, 1500, 3000];
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    const { error } = await supabaseClient
      .from("families")
      .update({ state, updated_at: new Date().toISOString() })
      .eq("id", currentUserId);
    if (!error) {
      localStorage.removeItem(PENDING_SAVE_KEY);
      return;
    }
    console.warn(`Kunde inte spara (försök ${attempt + 1}):`, error.message);
    if (attempt < delays.length) await new Promise(r => setTimeout(r, delays[attempt]));
  }
  console.error("Kunde inte spara efter flera försök — ändringen är sparad lokalt och skickas när anslutningen är tillbaka.");
}

// Pushes a locally-cached change from a previous session/attempt that never
// made it to the server. Returns true if there was nothing pending, or the
// pending change was successfully flushed.
async function flushPendingSave() {
  const raw = localStorage.getItem(PENDING_SAVE_KEY);
  if (!raw) return true;
  let pending;
  try {
    pending = JSON.parse(raw);
  } catch (e) {
    localStorage.removeItem(PENDING_SAVE_KEY);
    return true;
  }
  if (pending.userId !== currentUserId) {
    localStorage.removeItem(PENDING_SAVE_KEY); // belongs to a different account
    return true;
  }
  const { error } = await supabaseClient
    .from("families")
    .update({ state: pending.state, updated_at: new Date().toISOString() })
    .eq("id", currentUserId);
  if (error) {
    console.warn("Kunde fortfarande inte skicka sparad ändring:", error.message);
    return false;
  }
  localStorage.removeItem(PENDING_SAVE_KEY);
  return true;
}

async function bootstrapApp(userId) {
  currentUserId = userId;

  const raw = localStorage.getItem(PENDING_SAVE_KEY);
  if (raw) {
    const flushed = await flushPendingSave();
    if (!flushed) {
      // Still offline — show the cached local state rather than an
      // out-of-date fetch, and keep retrying in the background.
      try {
        state = normalizeState(JSON.parse(raw).state);
        render();
        return;
      } catch (e) { /* fall through to a normal fetch */ }
    }
  }

  state = await fetchFamilyState(userId);
  render();
}

window.addEventListener("online", () => {
  if (currentUserId) flushPendingSave();
});

function showLoginScreen() {
  app.innerHTML = "";
  app.appendChild(renderLoginScreen());
}

function friendlyAuthError(error) {
  const msg = error && error.message || "";
  if (/invalid login credentials/i.test(msg)) return "Fel e-post eller lösenord.";
  if (/user already registered/i.test(msg)) return "Det finns redan ett konto med den e-postadressen. Logga in istället.";
  if (/password should be at least/i.test(msg)) return "Lösenordet måste vara minst 6 tecken.";
  if (/unable to validate email/i.test(msg) || /invalid email/i.test(msg)) return "Ogiltig e-postadress.";
  if (/email not confirmed/i.test(msg)) return "E-posten är inte bekräftad än. Klicka på länken i mejlet först.";
  return "Något gick fel. Försök igen.";
}

// The confirmation link usually opens somewhere other than the app the
// person signed up in (Outlook's in-app browser, Safari) — a separate
// browser context with its own session, so the app they're actually
// looking at can't see that it happened and would sit here forever. The
// password is still in hand from the signup form, so just try signing in:
// it fails with "email not confirmed" until the link has been clicked
// anywhere, then succeeds and onAuthStateChange takes over. Checked when
// the app comes back to the foreground (the moment that matters) plus a
// slow timer as a backstop, kept slow to stay under Supabase's sign-in
// rate limit. The password only ever lives in this closure, never stored.
function watchForEmailConfirmation(email, password, screen, onWaiting) {
  let stopped = false;
  let trying = false;

  async function attempt(manual) {
    if (stopped || trying) return;
    if (!screen.isConnected) { stop(); return; }
    trying = true;
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    trying = false;
    if (!error) { stop(); return; }
    if (manual === true) onWaiting(friendlyAuthError(error));
  }
  function onVisible() {
    if (document.visibilityState === "visible") attempt();
  }
  function onFocus() { attempt(); }
  function stop() {
    stopped = true;
    clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onFocus);
  }

  const timer = setInterval(attempt, 15000);
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onFocus);
  return () => attempt(true);
}

function renderLoginScreen() {
  let mode = "login"; // "login" | "signup" | "forgot"
  const wrap = el("div", "screen onboard-wrap");

  function draw() {
    wrap.innerHTML = "";

    const subtitles = {
      login: "Logga in på ditt konto.",
      signup: "Skapa ett konto för din familj.",
      forgot: "Ange din e-post så skickar vi instruktioner för att återställa lösenordet.",
    };
    wrap.innerHTML = `
      <div class="big-emoji">${getCurrentPeriod() === "evening" ? "🌙" : "☀️"}</div>
      <div class="home-title">${mode === "forgot" ? "Glömt lösenordet?" : "Morgonlistan"}</div>
      <div class="onboard-subtitle">${subtitles[mode]}</div>
    `;

    const emailField = el("div", "field");
    emailField.innerHTML = `<label>E-post</label>`;
    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.placeholder = "din@epost.se";
    emailInput.autocomplete = "email";
    emailField.appendChild(emailInput);
    wrap.appendChild(emailField);

    // Someone who forgot their password shouldn't also have to look at (or
    // think about) a password field, so "forgot" mode is email-only.
    let passwordInput = null;
    if (mode !== "forgot") {
      const passwordField = el("div", "field");
      passwordField.innerHTML = `<label>Lösenord</label>`;
      passwordInput = document.createElement("input");
      passwordInput.type = "password";
      passwordInput.placeholder = mode === "signup" ? "Minst 6 tecken" : "••••••••";
      passwordInput.autocomplete = mode === "login" ? "current-password" : "new-password";
      passwordField.appendChild(passwordInput);
      wrap.appendChild(passwordField);
    }

    const errorEl = el("div", "field-error", "Något gick fel. Försök igen.");
    errorEl.style.display = "none";
    if (pendingAuthError) {
      errorEl.textContent = pendingAuthError;
      errorEl.style.display = "block";
      pendingAuthError = null;
    }
    wrap.appendChild(errorEl);

    const btnLabels = { login: "Logga in", signup: "Skapa konto", forgot: "Skicka instruktioner" };
    const btn = el("button", "primary-btn", btnLabels[mode]);
    btn.onclick = async () => {
      const email = emailInput.value.trim();
      if (!email) { emailInput.focus(); return; }
      if (mode !== "forgot" && !passwordInput.value) { passwordInput.focus(); return; }
      errorEl.style.display = "none";
      btn.disabled = true;

      if (mode === "login") {
        btn.textContent = "Loggar in...";
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password: passwordInput.value });
        if (error) {
          errorEl.textContent = friendlyAuthError(error);
          errorEl.style.display = "block";
          btn.disabled = false;
          btn.textContent = btnLabels[mode];
        }
        // On success, onAuthStateChange in initAuth() takes over.
      } else if (mode === "signup") {
        btn.textContent = "Skapar konto...";
        const password = passwordInput.value;
        const { error } = await supabaseClient.auth.signUp({
          email,
          password,
          // The base URL, not window.location.href — the current URL can
          // carry a leftover #error=... or #access_token=... hash from an
          // earlier auth attempt, which would otherwise get baked straight
          // into this email's redirect target.
          options: { emailRedirectTo: window.location.origin + window.location.pathname },
        });
        if (error) {
          errorEl.textContent = friendlyAuthError(error);
          errorEl.style.display = "block";
          btn.disabled = false;
          btn.textContent = btnLabels[mode];
          return;
        }
        wrap.innerHTML = `
          <div class="big-emoji">📬</div>
          <div class="home-title">Bekräfta din e-post</div>
          <div class="onboard-subtitle">Vi har skickat ett bekräftelsemejl till ${escapeHtml(email)}. Klicka på länken i mejlet och kom sedan tillbaka hit — då loggas du in automatiskt.</div>
        `;
        const waitingEl = el("div", "field-error", "");
        waitingEl.style.display = "none";
        waitingEl.style.margin = "0";
        wrap.appendChild(waitingEl);
        const checkNow = watchForEmailConfirmation(email, password, wrap, (msg) => {
          waitingEl.textContent = msg;
          waitingEl.style.display = "block";
        });
        const checkBtn = document.createElement("button");
        checkBtn.type = "button";
        checkBtn.className = "link-btn";
        checkBtn.textContent = "Jag har bekräftat";
        checkBtn.onclick = checkNow;
        wrap.appendChild(checkBtn);
      } else {
        btn.textContent = "Skickar...";
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + window.location.pathname,
        });
        if (error) {
          errorEl.textContent = friendlyAuthError(error);
          errorEl.style.display = "block";
          btn.disabled = false;
          btn.textContent = btnLabels[mode];
          return;
        }
        wrap.innerHTML = `
          <div class="big-emoji">📬</div>
          <div class="home-title">Kolla din inkorg</div>
          <div class="onboard-subtitle">Vi har skickat instruktioner för att återställa lösenordet till ${escapeHtml(email)}.</div>
        `;
      }
    };
    wrap.appendChild(btn);

    const links = el("div", "auth-links");
    if (mode === "forgot") {
      const backLink = document.createElement("button");
      backLink.type = "button";
      backLink.className = "link-btn";
      backLink.textContent = "Tillbaka till inloggning";
      backLink.onclick = () => { mode = "login"; draw(); };
      links.appendChild(backLink);
    } else {
      const toggleLink = document.createElement("button");
      toggleLink.type = "button";
      toggleLink.className = "link-btn";
      toggleLink.textContent = mode === "login" ? "Inget konto? Skapa ett" : "Har du redan ett konto? Logga in";
      toggleLink.onclick = () => { mode = mode === "login" ? "signup" : "login"; draw(); };
      links.appendChild(toggleLink);

      if (mode === "login") {
        const forgotLink = document.createElement("button");
        forgotLink.type = "button";
        forgotLink.className = "link-btn";
        forgotLink.textContent = "Glömt lösenordet?";
        forgotLink.onclick = () => { mode = "forgot"; draw(); };
        links.appendChild(forgotLink);
      }
    }
    wrap.appendChild(links);

    setTimeout(() => emailInput.focus(), 50);
  }

  draw();
  return wrap;
}

// On the native iOS app, the password-reset email link is a Universal Link
// (https://morninglist.app/...) so it opens this app directly instead of
// Safari — see AASA config in .well-known/ and App.entitlements. Capacitor
// hands the incoming URL to JS via the @capacitor/app plugin's "appUrlOpen"
// event (foreground/background resume) or getLaunchUrl() (cold launch). This
// app has no bundler, but native plugins are auto-exposed on
// Capacitor.Plugins without needing to import their JS package.
function handleNativeDeepLink(url) {
  let incoming;
  try {
    incoming = new URL(url);
  } catch (e) {
    return;
  }
  // Covers every auth callback shape Supabase can hand back — a successful
  // recovery or signup confirmation (access_token=...) and a failed one
  // (error=...) alike — not just recovery specifically. Reloading with the
  // hash in place re-runs this script from scratch, so it's picked up by
  // the same synchronous checks (inPasswordRecovery, pendingAuthError) and
  // Supabase's own session detection used for the plain web flow.
  if (incoming.hash.includes("access_token=") || incoming.hash.includes("error=")) {
    window.location.hash = incoming.hash.slice(1);
    window.location.reload();
  }
}

if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
  const CapApp = window.Capacitor.Plugins.App;
  CapApp.addListener("appUrlOpen", ({ url }) => handleNativeDeepLink(url));
  CapApp.getLaunchUrl().then((result) => {
    if (result && result.url) handleNativeDeepLink(result.url);
  });
}

async function initAuth() {
  // inPasswordRecovery is already known synchronously from the URL (see
  // where it's declared) — act on it immediately rather than waiting for
  // Supabase's PASSWORD_RECOVERY event, which doesn't reliably fire when
  // a session already existed on this device before the link was opened.
  if (inPasswordRecovery) {
    showSetNewPasswordScreen();
  }
  // Deliberately no separate getSession() call here: it returns any valid
  // session, including one from an unconsumed password-recovery link, and
  // would race with (and beat) the PASSWORD_RECOVERY event below. Supabase
  // always fires exactly one of these events on startup (INITIAL_SESSION,
  // PASSWORD_RECOVERY, SIGNED_IN, ...), so onAuthStateChange alone is the
  // single source of truth for what screen to show first.
  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      inPasswordRecovery = true;
      showSetNewPasswordScreen();
    } else if (event === "SIGNED_OUT") {
      inPasswordRecovery = false;
      currentUserId = null;
      state = null;
      showLoginScreen();
    } else if (inPasswordRecovery) {
      // Ignore the SIGNED_IN/INITIAL_SESSION noise Supabase fires right
      // after PASSWORD_RECOVERY — stay on "set new password" until the
      // user actually submits one (or explicitly signs out).
    } else if (session && session.user.id !== currentUserId) {
      bootstrapApp(session.user.id);
    } else if (!session && event === "INITIAL_SESSION") {
      showLoginScreen();
    }
  });
}

function showSetNewPasswordScreen() {
  app.innerHTML = "";
  app.appendChild(renderSetNewPasswordScreen());
}

function renderSetNewPasswordScreen() {
  const wrap = el("div", "screen onboard-wrap");
  wrap.innerHTML = `
    <div class="big-emoji">🔑</div>
    <div class="home-title">Nytt lösenord</div>
    <div class="onboard-subtitle">Ange ett nytt lösenord för ditt konto.</div>
  `;

  const field = el("div", "field");
  field.innerHTML = `<label>Lösenord</label>`;
  const passwordInput = document.createElement("input");
  passwordInput.type = "password";
  passwordInput.placeholder = "Minst 6 tecken";
  passwordInput.autocomplete = "new-password";
  field.appendChild(passwordInput);
  wrap.appendChild(field);

  const errorEl = el("div", "field-error", "Något gick fel. Försök igen.");
  errorEl.style.display = "none";
  wrap.appendChild(errorEl);

  const btn = el("button", "primary-btn", "Spara lösenord");
  btn.onclick = async () => {
    const password = passwordInput.value;
    if (!password) { passwordInput.focus(); return; }
    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Sparar...";
    const { data, error } = await supabaseClient.auth.updateUser({ password });
    if (error) {
      errorEl.textContent = friendlyAuthError(error);
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Spara lösenord";
      return;
    }
    inPasswordRecovery = false;
    await bootstrapApp(data.user.id);
  };
  wrap.appendChild(btn);

  setTimeout(() => passwordInput.focus(), 50);
  return wrap;
}

// ---------- Date helpers ----------

function getCurrentPeriod(now = new Date()) {
  const hour = now.getHours();
  return (hour >= EVENING_START_HOUR || hour < MORNING_START_HOUR) ? "evening" : "morning";
}

function getActiveTasks(period = getCurrentPeriod()) {
  return period === "evening" ? state.eveningTasks : state.tasks;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

// The reward week resets at the same moment the evening list kicks in on
// Saturday (EVENING_START_HOUR), since that's when parents hand out the
// week's reward — so Saturday morning still counts, Saturday evening starts fresh.
function getRewardWeekStart(now = new Date()) {
  const d = new Date(now);
  d.setHours(EVENING_START_HOUR, 0, 0, 0);
  const day = d.getDay(); // 0=Sun..6=Sat
  const daysSinceSaturday = (day + 1) % 7;
  d.setDate(d.getDate() - daysSinceSaturday);
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 7);
  return d.getTime();
}

function completionTimestamp(c) {
  return c.timestamp ?? new Date(c.date + "T12:00:00").getTime();
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

// ---------- Color theme derivation ----------
// Every kid picks one base color; the done-state background tint is derived
// from that same hue so a card always stays visually "theirs." The checkmark
// and celebration accents are deliberately NOT derived — they're the shared
// SPLASH_COLORS, the one vivid, common note across every kid's card.

function hexToRgb(hex) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r, g, b) {
  return "#" + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb(h, s, l) {
  h /= 360; s /= 100; l /= 100;
  if (s === 0) { const v = l * 255; return [v, v, v]; }
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3) * 255, hue2rgb(p, q, h) * 255, hue2rgb(p, q, h - 1 / 3) * 255];
}

// At night, panels shift to a slightly darker shade of the same hue, to
// visually reinforce that it's evening — a small, deliberate cue, not a full
// dark-mode redesign.
function getPeriodPanelColor(baseHex, period) {
  if (period !== "evening") return baseHex;
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return rgbToHex(...hslToRgb(h, s, Math.max(l - 14, 20)));
}

function deriveKidTheme(baseHex) {
  const [r, g, b] = hexToRgb(baseHex);
  const [h, s] = rgbToHsl(r, g, b);
  const shade = (sat, light) => rgbToHex(...hslToRgb(h, sat, light));
  return {
    doneBg: shade(Math.max(s * 0.5, 20), 93),
    doneAccent: SPLASH_COLORS.tick,
    celebrationAccent: SPLASH_COLORS.reward,
  };
}

// ---------- Derived data ----------

function weeklyBalance(kidId) {
  const start = getRewardWeekStart();
  return state.completions
    .filter(c => c.kidId === kidId && completionTimestamp(c) >= start)
    .reduce((sum, c) => sum + c.amount, 0);
}

function todaysCompletedTaskIds(kidId) {
  const today = todayStr();
  return new Set(
    state.completions
      .filter(c => c.kidId === kidId && c.date === today)
      .map(c => c.taskId)
  );
}

// ---------- Sound ----------

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, startTime, duration, gain, type = "sine") {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, startTime);
  g.gain.linearRampToValueAtTime(gain, startTime + 0.02);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(g);
  g.connect(audioCtx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

// Bright ascending "coin" sound (plus a sparkly octave harmonic) for one completed task
function playChime() {
  ensureAudio();
  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5]; // C E G C
  notes.forEach((f, i) => {
    const t = now + i * 0.045;
    playTone(f, t, 0.22, 0.3, "triangle");
    playTone(f * 2, t, 0.15, 0.08, "sine");
  });
}

// A big joyful victory fanfare for finishing the whole list
function playCheer() {
  ensureAudio();
  const now = audioCtx.currentTime;

  // rising anticipation sweep
  const sweep = audioCtx.createOscillator();
  const sweepGain = audioCtx.createGain();
  sweep.type = "sawtooth";
  sweep.frequency.setValueAtTime(220, now);
  sweep.frequency.exponentialRampToValueAtTime(880, now + 0.3);
  sweepGain.gain.setValueAtTime(0, now);
  sweepGain.gain.linearRampToValueAtTime(0.15, now + 0.05);
  sweepGain.gain.linearRampToValueAtTime(0, now + 0.3);
  sweep.connect(sweepGain);
  sweepGain.connect(audioCtx.destination);
  sweep.start(now);
  sweep.stop(now + 0.3);

  // triumphant ascending run
  const run = [523.25, 659.25, 783.99, 1046.5, 1318.51];
  run.forEach((f, i) => playTone(f, now + 0.3 + i * 0.09, 0.25, 0.28, "triangle"));

  // final held major chord, lightly detuned for a rich brass-like sound
  const chordStart = now + 0.3 + run.length * 0.09;
  [523.25, 659.25, 783.99, 1046.5].forEach(f => {
    playTone(f, chordStart, 0.9, 0.22, "sawtooth");
    playTone(f * 1.004, chordStart, 0.9, 0.12, "sawtooth");
  });
}

// ---------- Rendering ----------

const app = document.getElementById("app");
let route = { screen: "main" }; // { screen: 'main' | 'parent' }

function render() {
  app.innerHTML = "";
  if (state.kids.length === 0 && route.screen !== "parent") {
    app.appendChild(renderOnboarding());
    return;
  }
  if (route.screen === "parent") {
    app.appendChild(renderParent());
  } else {
    app.appendChild(renderMain());
  }
}

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// ---------- Onboarding ----------

function renderOnboarding() {
  const wrap = el("div", "screen onboard-wrap");
  wrap.innerHTML = `
    <div class="big-emoji">👋</div>
    <div class="home-title">Välkommen!</div>
    <div>Lägg till ditt första barn för att komma igång.</div>
  `;
  const btn = el("button", "primary-btn", "Lägg till barn");
  btn.onclick = () => openKidModal(null);
  wrap.appendChild(btn);
  return wrap;
}

// ---------- Main (swipeable kid checklists) ----------

function allTasksDoneToday(kidId, tasks) {
  const completedIds = todaysCompletedTaskIds(kidId);
  return tasks.length > 0 && tasks.every(t => completedIds.has(t.id));
}

// A fixed 7x2 "jar" of 14 slots — filled ones vivid, empty ones a faint
// outline — so the shape and fill-level are always visible at a glance, even
// at 0 or 1. A manually-adjusted balance could exceed 14; rather than ever
// resize or overflow the jar, it just shows completely full plus a small
// "+N" badge for the surplus, so it always stays this exact size and shape.
function buildRewardJar(balance, symbol) {
  const filled = Math.min(Math.max(balance, 0), MAX_DISPLAY_ICONS);
  const overflow = Math.max(balance - MAX_DISPLAY_ICONS, 0);
  const slots = Array.from({ length: MAX_DISPLAY_ICONS }, (_, i) =>
    `<div class="reward-slot${i < filled ? " filled" : ""}">${symbol}</div>`
  ).join("");
  const badge = overflow > 0 ? `<div class="reward-overflow-badge">+${overflow}</div>` : "";
  return `<div class="reward-jar">${slots}</div>${badge}`;
}

function buildRewardCard(kid, tasks, celebrating = allTasksDoneToday(kid.id, tasks)) {
  const card = el("div", "reward-card" + (celebrating ? " celebrating" : ""));
  card.innerHTML = `
    ${buildRewardJar(weeklyBalance(kid.id), state.currencySymbol)}
    ${celebrating
      ? `<div class="celebration-line1">Allt klart för idag! 🎉</div>`
      : `<div class="reward-label">denna vecka</div>`}
  `;
  return card;
}

function renderMain() {
  const screen = el("div", "screen");
  const period = getCurrentPeriod();
  const tasks = getActiveTasks(period);

  const topBar = el("div", "top-bar");
  const periodIcon = period === "evening" ? "🌙" : "☀️";
  const periodTitle = period === "evening" ? "Kvällslistan" : "Morgonlistan";
  topBar.innerHTML = `<div class="home-title">${periodIcon} ${periodTitle}</div>`;
  const gear = el("button", "gear-btn", "⚙️");
  gear.onclick = () => openParentGate();
  topBar.appendChild(gear);
  screen.appendChild(topBar);

  const scroller = el("div", "card-scroller");
  state.kids.forEach(kid => {
    scroller.appendChild(renderKidPanel(kid, tasks, period));
  });
  screen.appendChild(scroller);

  if (state.kids.length > 1) {
    const dots = el("div", "dots");
    state.kids.forEach((_, i) => dots.appendChild(el("div", "dot" + (i === 0 ? " active" : ""))));
    screen.appendChild(dots);
    scroller.addEventListener("scroll", () => {
      const scrollerCenter = scroller.getBoundingClientRect().left + scroller.clientWidth / 2;
      let closestIdx = 0;
      let closestDist = Infinity;
      [...scroller.children].forEach((panel, i) => {
        const rect = panel.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width / 2 - scrollerCenter);
        if (dist < closestDist) { closestDist = dist; closestIdx = i; }
      });
      [...dots.children].forEach((d, i) => d.classList.toggle("active", i === closestIdx));
    });
  }

  return screen;
}

function renderKidPanel(kid, tasks, period = getCurrentPeriod()) {
  const panel = el("div", "kid-panel");
  const panelColor = getPeriodPanelColor(kid.color, period);
  panel.style.background = panelColor;
  const theme = deriveKidTheme(panelColor);
  panel.style.setProperty("--task-done-bg", theme.doneBg);
  panel.style.setProperty("--task-done-accent", theme.doneAccent);
  panel.style.setProperty("--celebration-accent", theme.celebrationAccent);

  const header = el("div", "panel-header");
  header.innerHTML = `
    <div class="kid-avatar">${kid.name.charAt(0).toUpperCase()}</div>
    <div class="kid-name">${escapeHtml(kid.name)}</div>
  `;
  panel.appendChild(header);
  panel.appendChild(buildRewardCard(kid, tasks));

  const completedIds = todaysCompletedTaskIds(kid.id);
  const list = el("div", "task-list");
  tasks.forEach(task => {
    const done = completedIds.has(task.id);
    const card = el("div", "task-card" + (done ? " done" : ""));
    card.innerHTML = `
      <div class="task-emoji">${task.emoji}</div>
      <div class="task-label">${escapeHtml(task.name)}</div>
      <div class="task-check">${done ? "✓" : ""}</div>
    `;
    card.onclick = () => toggleTask(kid, task, card, panel, tasks, period);
    list.appendChild(card);
  });
  panel.appendChild(list);

  return panel;
}

function toggleTask(kid, task, cardEl, panelEl, tasks, period) {
  const today = todayStr();
  const existingIndex = state.completions.findIndex(
    c => c.kidId === kid.id && c.taskId === task.id && c.date === today
  );

  if (existingIndex >= 0) {
    state.completions.splice(existingIndex, 1);
    cardEl.classList.remove("done");
    cardEl.querySelector(".task-check").textContent = "";
  } else {
    // Completing a task earns no currency by itself — only finishing the
    // whole session does (see below). This entry just tracks it as checked.
    state.completions.push({ kidId: kid.id, taskId: task.id, date: today, amount: 0, timestamp: Date.now() });
    cardEl.classList.add("done");
    cardEl.querySelector(".task-check").textContent = "✓";
    playChime();
  }

  saveState();

  const sessionRewardId = SESSION_REWARD_IDS[period];
  const hasSessionReward = state.completions.some(
    c => c.kidId === kid.id && c.taskId === sessionRewardId && c.date === today
  );
  const nowAllDone = allTasksDoneToday(kid.id, tasks);
  const rewardCardEl = panelEl.querySelector(".reward-card");

  if (nowAllDone && !hasSessionReward) {
    state.completions.push({ kidId: kid.id, taskId: sessionRewardId, date: today, amount: state.rewardPerSession, timestamp: Date.now() });
    saveState();
    rewardCardEl.replaceWith(buildRewardCard(kid, tasks, false));
    setTimeout(() => {
      playCheer();
      panelEl.querySelector(".reward-card").replaceWith(buildRewardCard(kid, tasks, true));
    }, 350);
  } else if (!nowAllDone && hasSessionReward) {
    state.completions = state.completions.filter(
      c => !(c.kidId === kid.id && c.taskId === sessionRewardId && c.date === today)
    );
    saveState();
    rewardCardEl.replaceWith(buildRewardCard(kid, tasks));
  } else {
    rewardCardEl.replaceWith(buildRewardCard(kid, tasks));
  }
}

// ---------- Parent mode gate ----------

const MIN_PARENT_AGE = 18;
const MAX_PARENT_AGE = 100;

function openParentGate() {
  openModal((sheet, close) => {
    sheet.appendChild(el("div", "modal-title", "Föräldraläge"));
    sheet.appendChild(el("div", "modal-text", "Det här är till för föräldrar. Ange ditt födelseår (4 siffror) för att fortsätta."));

    const field = el("div", "field");
    field.innerHTML = `<label>Födelseår</label>`;
    const yearInput = document.createElement("input");
    yearInput.type = "number";
    yearInput.inputMode = "numeric";
    yearInput.placeholder = "ÅÅÅÅ";
    yearInput.maxLength = 4;
    field.appendChild(yearInput);
    sheet.appendChild(field);

    const errorMsg = el("div", "field-error", "Hoppsan, det här är till för föräldrar!");
    errorMsg.style.display = "none";
    sheet.appendChild(errorMsg);

    const actions = el("div", "modal-actions");
    const cancelBtn = el("button", "secondary-btn", "Avbryt");
    cancelBtn.onclick = close;
    const continueBtn = el("button", "primary-btn", "Fortsätt");
    continueBtn.onclick = () => {
      const raw = yearInput.value.trim();
      const currentYear = new Date().getFullYear();
      const year = parseInt(raw, 10);
      const isFourDigits = /^\d{4}$/.test(raw);
      const isOldEnough = isFourDigits && year >= currentYear - MAX_PARENT_AGE && year <= currentYear - MIN_PARENT_AGE;
      if (!isOldEnough) {
        errorMsg.style.display = "block";
        yearInput.value = "";
        yearInput.focus();
        return;
      }
      close();
      route = { screen: "parent" };
      render();
    };
    actions.appendChild(cancelBtn);
    actions.appendChild(continueBtn);
    sheet.appendChild(actions);
    setTimeout(() => yearInput.focus(), 50);
  });
}

// ---------- Parent mode ----------

function renderParent() {
  const screen = el("div", "screen");

  const header = el("div", "parent-header");
  const back = el("button", "back-btn", "←");
  back.onclick = () => { route = { screen: "main" }; render(); };
  header.appendChild(back);
  header.appendChild(el("div", "title", "Föräldraläge"));
  screen.appendChild(header);

  const body = el("div", "parent-body");

  // Kids section
  const kidsSection = el("div");
  kidsSection.appendChild(el("div", "section-title", "Barn"));
  state.kids.forEach(kid => {
    const row = el("div", "list-row");
    const swatch = el("div", "swatch");
    swatch.style.background = kid.color;
    row.appendChild(swatch);
    row.appendChild(el("div", "label", escapeHtml(kid.name)));
    const editBtn = el("button", "icon-btn", "✏️");
    editBtn.onclick = () => openKidModal(kid);
    row.appendChild(editBtn);
    const delBtn = el("button", "icon-btn", "🗑️");
    delBtn.onclick = () => {
      if (confirm(`Ta bort ${kid.name}?`)) {
        state.kids = state.kids.filter(k => k.id !== kid.id);
        state.completions = state.completions.filter(c => c.kidId !== kid.id);
        saveState();
        render();
      }
    };
    row.appendChild(delBtn);
    kidsSection.appendChild(row);
  });
  const addKidBtn = el("button", "add-row-btn", "+ Lägg till barn");
  addKidBtn.onclick = () => openKidModal(null);
  kidsSection.appendChild(addKidBtn);
  body.appendChild(kidsSection);

  // Morning tasks section
  const morningSection = el("div");
  morningSection.appendChild(el("div", "section-title", "Morgonuppgifter"));
  const morningListEl = el("div", "task-manage-list");
  renderTaskRows(morningListEl, state.tasks);
  morningSection.appendChild(morningListEl);
  const addMorningTaskBtn = el("button", "add-row-btn", "+ Lägg till morgonuppgift");
  addMorningTaskBtn.onclick = () => openTaskModal(null, state.tasks);
  morningSection.appendChild(addMorningTaskBtn);
  body.appendChild(morningSection);

  // Evening tasks section
  const eveningSection = el("div");
  eveningSection.appendChild(el("div", "section-title", "Kvällsuppgifter"));
  const eveningListEl = el("div", "task-manage-list");
  renderTaskRows(eveningListEl, state.eveningTasks);
  eveningSection.appendChild(eveningListEl);
  const addEveningTaskBtn = el("button", "add-row-btn", "+ Lägg till kvällsuppgift");
  addEveningTaskBtn.onclick = () => openTaskModal(null, state.eveningTasks);
  eveningSection.appendChild(addEveningTaskBtn);
  body.appendChild(eveningSection);

  // Settings section
  const settingsSection = el("div");
  settingsSection.appendChild(el("div", "section-title", "Inställningar"));

  settingsSection.appendChild(el("div", "field-label", "Valuta"));
  const currencyGrid = el("div", "currency-grid");
  CURRENCY_OPTIONS.forEach(symbol => {
    const btn = el("button", "currency-option" + (symbol === state.currencySymbol ? " selected" : ""), symbol);
    btn.type = "button";
    btn.onclick = () => {
      state.currencySymbol = symbol;
      customCurrencyInput.value = "";
      saveState();
      render();
    };
    currencyGrid.appendChild(btn);
  });
  settingsSection.appendChild(currencyGrid);

  const customCurrencyField = el("div", "field");
  customCurrencyField.innerHTML = `<label>Eller skriv egen valuta</label>`;
  const customCurrencyInput = document.createElement("input");
  customCurrencyInput.type = "text";
  customCurrencyInput.placeholder = "T.ex. kr, poäng, $";
  customCurrencyInput.value = CURRENCY_OPTIONS.includes(state.currencySymbol) ? "" : state.currencySymbol;
  customCurrencyInput.oninput = () => {
    const val = customCurrencyInput.value.trim();
    if (val) {
      state.currencySymbol = val;
      saveState();
      [...currencyGrid.children].forEach(c => c.classList.remove("selected"));
      valueEl.textContent = `${state.rewardPerSession} ${state.currencySymbol}`;
    }
  };
  customCurrencyField.appendChild(customCurrencyInput);
  settingsSection.appendChild(customCurrencyField);

  settingsSection.appendChild(el("div", "field-label", "Belöning per avklarad lista"));
  const stepper = el("div", "stepper");
  const decBtn = el("button", "stepper-btn", "−");
  const valueEl = el("div", "stepper-value", `${state.rewardPerSession} ${state.currencySymbol}`);
  const incBtn = el("button", "stepper-btn", "+");
  const updateReward = (delta) => {
    state.rewardPerSession = Math.max(0, Math.min(100, state.rewardPerSession + delta));
    valueEl.textContent = `${state.rewardPerSession} ${state.currencySymbol}`;
    saveState();
  };
  decBtn.onclick = () => updateReward(-1);
  incBtn.onclick = () => updateReward(1);
  stepper.appendChild(decBtn);
  stepper.appendChild(valueEl);
  stepper.appendChild(incBtn);
  settingsSection.appendChild(stepper);
  body.appendChild(settingsSection);

  // Account section
  const accountSection = el("div");
  accountSection.appendChild(el("div", "section-title", "Konto"));
  const signOutBtn = el("button", "add-row-btn", "Logga ut");
  signOutBtn.onclick = () => supabaseClient.auth.signOut();
  accountSection.appendChild(signOutBtn);
  const deleteAccountBtn = el("button", "danger-btn", "Radera konto");
  deleteAccountBtn.style.marginTop = "10px";
  deleteAccountBtn.onclick = () => openDeleteAccountModal();
  accountSection.appendChild(deleteAccountBtn);
  body.appendChild(accountSection);

  screen.appendChild(body);
  return screen;
}

// ---------- Task list with drag-to-reorder ----------

function renderTaskRows(container, tasks) {
  container.innerHTML = "";
  tasks.forEach(task => container.appendChild(buildTaskRow(task, tasks)));
}

function buildTaskRow(task, tasks) {
  const row = el("div", "list-row");
  const handle = el("div", "drag-handle", "☰");
  row.appendChild(handle);
  row.appendChild(el("div", "emoji", task.emoji));
  row.appendChild(el("div", "label", escapeHtml(task.name)));
  const editBtn = el("button", "icon-btn", "✏️");
  editBtn.onclick = () => openTaskModal(task, tasks);
  row.appendChild(editBtn);
  const delBtn = el("button", "icon-btn", "🗑️");
  delBtn.onclick = () => {
    if (confirm(`Ta bort "${task.name}"?`)) {
      const idx = tasks.findIndex(t => t.id === task.id);
      if (idx >= 0) tasks.splice(idx, 1);
      state.completions = state.completions.filter(c => c.taskId !== task.id);
      saveState();
      render();
    }
  };
  row.appendChild(delBtn);
  attachDragReorder(handle, row, tasks);
  return row;
}

function attachDragReorder(handle, row, tasks) {
  let dragging = false;
  let container = null;
  let allRows = [];
  let originalIndex = 0;
  let startY = 0;
  let rowStep = 0;
  let currentShift = 0;

  const finish = () => {
    if (!dragging) return;
    dragging = false;
    row.classList.remove("dragging");
    row.style.transform = "";
    row.style.zIndex = "";
    allRows.forEach(r => { r.style.transform = ""; });

    const targetIndex = Math.max(0, Math.min(allRows.length - 1, originalIndex + currentShift));
    if (targetIndex !== originalIndex) {
      const [moved] = tasks.splice(originalIndex, 1);
      tasks.splice(targetIndex, 0, moved);
      saveState();
    }
    renderTaskRows(container, tasks);
  };

  handle.addEventListener("pointerdown", (e) => {
    container = row.parentElement;
    allRows = [...container.children];
    originalIndex = allRows.indexOf(row);
    dragging = true;
    currentShift = 0;
    startY = e.clientY;
    rowStep = row.getBoundingClientRect().height + 12; // row height + gap
    row.classList.add("dragging");
    row.style.zIndex = "10";
    handle.setPointerCapture(e.pointerId);
  });

  handle.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const deltaY = e.clientY - startY;
    row.style.transform = `translateY(${deltaY}px)`;

    const rawShift = Math.round(deltaY / rowStep);
    const targetIndex = Math.max(0, Math.min(allRows.length - 1, originalIndex + rawShift));
    const shift = targetIndex - originalIndex;
    if (shift !== currentShift) {
      allRows.forEach((r, i) => {
        if (r === row) return;
        if (shift > 0 && i > originalIndex && i <= originalIndex + shift) {
          r.style.transform = `translateY(-${rowStep}px)`;
        } else if (shift < 0 && i < originalIndex && i >= originalIndex + shift) {
          r.style.transform = `translateY(${rowStep}px)`;
        } else {
          r.style.transform = "";
        }
      });
      currentShift = shift;
    }
  });

  handle.addEventListener("pointerup", finish);
  handle.addEventListener("pointercancel", finish);
}

function openDeleteAccountModal() {
  openModal((sheet, close) => {
    sheet.appendChild(el("div", "modal-title", "Radera konto"));
    sheet.appendChild(el("div", "modal-text", "Det här raderar ditt konto och all tillhörande data permanent — barn, uppgifter och sparad status. Det går inte att ångra."));

    const field = el("div", "field");
    field.innerHTML = `<label>Skriv RADERA för att bekräfta</label>`;
    const confirmInput = document.createElement("input");
    confirmInput.type = "text";
    field.appendChild(confirmInput);
    sheet.appendChild(field);

    const errorMsg = el("div", "field-error", "Kunde inte radera kontot just nu. Försök igen om en stund.");
    errorMsg.style.display = "none";
    sheet.appendChild(errorMsg);

    const actions = el("div", "modal-actions");
    const cancelBtn = el("button", "secondary-btn", "Avbryt");
    cancelBtn.onclick = close;
    const deleteBtn = el("button", "danger-btn", "Radera konto");
    deleteBtn.disabled = true;
    confirmInput.oninput = () => {
      deleteBtn.disabled = confirmInput.value.trim().toUpperCase() !== "RADERA";
    };
    deleteBtn.onclick = async () => {
      deleteBtn.disabled = true;
      deleteBtn.textContent = "Raderar…";
      errorMsg.style.display = "none";
      const { error } = await supabaseClient.functions.invoke("delete-account");
      if (error) {
        console.error("Kunde inte radera konto:", error.message);
        errorMsg.style.display = "block";
        deleteBtn.disabled = false;
        deleteBtn.textContent = "Radera konto";
        return;
      }
      localStorage.removeItem(PENDING_SAVE_KEY);
      await supabaseClient.auth.signOut();
      window.location.reload();
    };
    actions.appendChild(cancelBtn);
    actions.appendChild(deleteBtn);
    sheet.appendChild(actions);
    setTimeout(() => confirmInput.focus(), 50);
  });
}

function openModal(contentBuilder) {
  const overlay = el("div", "modal-overlay");
  const sheet = el("div", "modal-sheet");
  sheet.appendChild(el("div", "modal-handle"));
  overlay.appendChild(sheet);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  contentBuilder(sheet, () => overlay.remove());
  document.body.appendChild(overlay);
}

function openKidModal(kid) {
  openModal((sheet, close) => {
    const isEdit = !!kid;
    sheet.appendChild(el("div", "modal-title", isEdit ? "Redigera barn" : "Lägg till barn"));

    const nameField = el("div", "field");
    nameField.innerHTML = `<label>Förnamn</label>`;
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "T.ex. Vera";
    nameInput.value = isEdit ? kid.name : "";
    nameField.appendChild(nameInput);
    sheet.appendChild(nameField);

    const colorField = el("div", "field");
    colorField.innerHTML = `<label>Färg</label>`;
    const grid = el("div", "swatch-grid");
    let selectedColor = isEdit ? kid.color : KID_COLORS[state.kids.length % KID_COLORS.length];
    KID_COLORS.forEach(color => {
      const opt = el("div", "swatch-option" + (color === selectedColor ? " selected" : ""));
      opt.style.background = color;
      opt.onclick = () => {
        selectedColor = color;
        [...grid.children].forEach(c => c.classList.remove("selected"));
        opt.classList.add("selected");
      };
      grid.appendChild(opt);
    });
    colorField.appendChild(grid);
    sheet.appendChild(colorField);

    if (isEdit) {
      const balanceField = el("div", "field");
      balanceField.innerHTML = `<label>Saldo denna vecka</label>`;
      const balanceStepper = el("div", "stepper");
      const balDecBtn = el("button", "stepper-btn", "−");
      const balValueEl = el("div", "stepper-value", `${weeklyBalance(kid.id)} ${state.currencySymbol}`);
      const balIncBtn = el("button", "stepper-btn", "+");
      const adjustBalance = (delta) => {
        state.completions.push({ kidId: kid.id, taskId: MANUAL_ADJUSTMENT_TASK_ID, date: todayStr(), amount: delta, timestamp: Date.now() });
        saveState();
        balValueEl.textContent = `${weeklyBalance(kid.id)} ${state.currencySymbol}`;
      };
      balDecBtn.onclick = () => adjustBalance(-1);
      balIncBtn.onclick = () => adjustBalance(1);
      balanceStepper.appendChild(balDecBtn);
      balanceStepper.appendChild(balValueEl);
      balanceStepper.appendChild(balIncBtn);
      balanceField.appendChild(balanceStepper);
      sheet.appendChild(balanceField);
    }

    const actions = el("div", "modal-actions");
    const cancelBtn = el("button", "secondary-btn", "Avbryt");
    cancelBtn.onclick = close;
    const saveBtn = el("button", "primary-btn", "Spara");
    saveBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      if (isEdit) {
        kid.name = name;
        kid.color = selectedColor;
      } else {
        state.kids.push({ id: uid(), name, color: selectedColor });
      }
      saveState();
      close();
      render();
    };
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    sheet.appendChild(actions);
    setTimeout(() => nameInput.focus(), 50);
  });
}

function openTaskModal(task, tasks) {
  openModal((sheet, close) => {
    const isEdit = !!task;
    sheet.appendChild(el("div", "modal-title", isEdit ? "Redigera uppgift" : "Lägg till uppgift"));

    const nameField = el("div", "field");
    nameField.innerHTML = `<label>Namn</label>`;
    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.placeholder = "T.ex. Borsta håret";
    nameInput.value = isEdit ? task.name : "";
    nameField.appendChild(nameInput);
    sheet.appendChild(nameField);

    const emojiField = el("div", "field");
    emojiField.innerHTML = `<label>Ikon</label>`;
    const grid = el("div", "emoji-grid");
    let selectedEmoji = isEdit ? task.emoji : TASK_EMOJIS[0];
    const isCustomStart = isEdit && !TASK_EMOJIS.includes(task.emoji);
    TASK_EMOJIS.forEach(emoji => {
      const btn = el("button", !isCustomStart && emoji === selectedEmoji ? "selected" : "", emoji);
      btn.type = "button";
      btn.onclick = () => {
        selectedEmoji = emoji;
        customInput.value = "";
        [...grid.children].forEach(c => c.classList.remove("selected"));
        btn.classList.add("selected");
      };
      grid.appendChild(btn);
    });
    emojiField.appendChild(grid);
    sheet.appendChild(emojiField);

    const customField = el("div", "field");
    customField.innerHTML = `<label>Eller skriv en egen emoji</label>`;
    const customInput = document.createElement("input");
    customInput.type = "text";
    customInput.placeholder = "Tryck här och öppna din emoji-knapp 😀";
    customInput.value = isCustomStart ? task.emoji : "";
    customInput.oninput = () => {
      const val = customInput.value.trim();
      if (val) {
        selectedEmoji = val;
        [...grid.children].forEach(c => c.classList.remove("selected"));
      }
    };
    customField.appendChild(customInput);
    sheet.appendChild(customField);

    const actions = el("div", "modal-actions");
    const cancelBtn = el("button", "secondary-btn", "Avbryt");
    cancelBtn.onclick = close;
    const saveBtn = el("button", "primary-btn", "Spara");
    saveBtn.onclick = () => {
      const name = nameInput.value.trim();
      if (!name) { nameInput.focus(); return; }
      if (isEdit) {
        task.name = name;
        task.emoji = selectedEmoji;
      } else {
        tasks.push({ id: uid(), name, emoji: selectedEmoji });
      }
      saveState();
      close();
      render();
    };
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);
    sheet.appendChild(actions);
    setTimeout(() => nameInput.focus(), 50);
  });
}

// ---------- Utils ----------

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ---------- Init ----------

initAuth();
