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

// Evening list shows 12:00-03:59; morning list shows 04:00-11:59.
const EVENING_START_HOUR = 12;
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
const DEFAULT_REMINDERS = { enabled: true, morning: "07:00", evening: "19:00" }; // "HH:MM" local time
const DEFAULT_RESET_DAY = 6; // Saturday (Date#getDay: 0=Sun..6=Sat)
const DEFAULT_RESET_HOUR = 12; // noon Saturday by default — independent of EVENING_START_HOUR, which only governs the daily morning/evening switch
const WEEKDAYS_SV = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // shown Monday-first

function defaultState() {
  return {
    kids: [],
    tasks: DEFAULT_TASKS.slice(),
    eveningTasks: DEFAULT_EVENING_TASKS.slice(),
    rewardPerSession: 1,
    currencySymbol: DEFAULT_CURRENCY,
    completions: [], // { kidId, taskId, date, amount, timestamp }
    settledWeeks: {}, // { [kidId]: week start (ms) whose reward a parent confirmed as handed out }
    resetSchedule: [{ effectiveAt: 0, day: DEFAULT_RESET_DAY, hour: DEFAULT_RESET_HOUR, minute: 0 }], // which weekday+time the reward week ends on, and from when
    endWeekEarlyOnMorningDone: true, // per kid: end their week the moment their morning list is done on the reset day, instead of waiting for Klockslag
    earlyWeekEnds: {}, // { [kidId]: { closedCycleStart, endedAt, nextRegularBoundary } } — most recent early end only, see kidWeekStart/kidWeekEnd
    reminders: { ...DEFAULT_REMINDERS }, // daily reminder notifications (iPhone app only)
    setupDone: false, // the first-run wizard has been completed or skipped
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
  if (!parsed.settledWeeks) parsed.settledWeeks = {};
  if (!parsed.resetSchedule || !parsed.resetSchedule.length) parsed.resetSchedule = [{ effectiveAt: 0, day: DEFAULT_RESET_DAY, hour: DEFAULT_RESET_HOUR, minute: 0 }];
  // Older saved schedules predate the configurable reset time — they always meant EVENING_START_HOUR:00.
  parsed.resetSchedule = parsed.resetSchedule.map(e => ({ hour: DEFAULT_RESET_HOUR, minute: 0, ...e }));
  if (parsed.endWeekEarlyOnMorningDone === undefined) parsed.endWeekEarlyOnMorningDone = true;
  if (!parsed.earlyWeekEnds) parsed.earlyWeekEnds = {};
  parsed.reminders = { ...DEFAULT_REMINDERS, ...(parsed.reminders || {}) };
  // A family that already has kids is past setup; only a fresh one gets the wizard.
  if (parsed.setupDone === undefined) parsed.setupDone = parsed.kids.length > 0;
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

// Someone who taps the signup link in a browser (rather than typing the code
// in the app they signed up in) shouldn't end up quietly using the web
// version by accident — it's the same product, so it looks like the app
// and they'd carry on there. Show a plain "activated" page instead and
// point them back to where they signed up, which signs itself in (see
// watchForEmailConfirmation). The native app skips this — being sent
// straight into it is exactly what should happen there.
const isNativeApp = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
let signupConfirmedLanding = window.location.hash.includes("type=signup") && !isNativeApp;

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
  syncReminders().catch(() => {});
}

window.addEventListener("online", () => {
  if (currentUserId) flushPendingSave();
});

// Someone opening morninglist.app on the web for the first time should meet
// a page that says what this is, not a bare login form. Shown only to
// signed-out web visitors who haven't yet clicked through to log in or sign
// up on this browser; never in the native app, and never when an auth link
// has just landed here (that goes to the login screen with its message).
const VISITED_KEY = "morgonlistan-seen-login";
function markVisitorEngaged() {
  try { localStorage.setItem(VISITED_KEY, "1"); } catch (e) {}
}
function shouldShowLanding() {
  if (isNativeApp || pendingAuthError) return false;
  try { return !localStorage.getItem(VISITED_KEY); } catch (e) { return true; }
}

function showLandingScreen() {
  const wrap = el("div", "screen onboard-wrap");
  wrap.innerHTML = `
    ${brandLockupHTML()}
    <div class="home-title">Morgonrutinen som barnen sköter själva</div>
    <div class="onboard-subtitle">Morgonlistan är en enkel checklista med bilder för morgon och kväll. Barnet bockar av, du bestämmer belöningen.</div>
    <div class="landing-steps">
      <div class="landing-step"><span class="landing-step-icon">🛌</span><span>Du lägger till barnen och deras uppgifter. En bild per uppgift, så att även de som inte läser än hänger med.</span></div>
      <div class="landing-step"><span class="landing-step-icon">✅</span><span>Barnet bockar av under morgonen och kvällen med en tryckning.</span></div>
      <div class="landing-step"><span class="landing-step-icon">🎁</span><span>En klar lista fyller veckans burk. När veckan är slut delar ni ut belöningen.</span></div>
    </div>
  `;
  const create = el("button", "primary-btn", "Skapa konto");
  create.onclick = () => showLoginScreen("signup");
  wrap.appendChild(create);

  const links = el("div", "auth-links");
  const login = document.createElement("button");
  login.type = "button";
  login.className = "link-btn";
  login.textContent = "Har du redan ett konto? Logga in";
  login.onclick = () => showLoginScreen("login");
  links.appendChild(login);
  const privacy = document.createElement("a");
  privacy.className = "link-btn";
  privacy.href = "privacy.html";
  privacy.textContent = "Integritetspolicy";
  links.appendChild(privacy);
  wrap.appendChild(links);

  app.innerHTML = "";
  app.appendChild(wrap);
}

function showLoginScreen(mode = "login") {
  markVisitorEngaged();
  app.innerHTML = "";
  app.appendChild(renderLoginScreen(mode));
}

// The lockup every onboarding/auth screen opens with: the app icon (inlined
// from app-icon.svg so it works offline in the native app) and, in one fixed
// spot under it, the app's name. The heading below is then always the
// screen's own title. Spacing rules: brand-guide.md §7, .brand-lockup in style.css.
function brandLockupHTML() {
  return `<div class="brand-lockup"><svg class="brand-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="1024" height="1024" fill="#F7F2E9"/><g transform="translate(77, 77) scale(3.4)"><path fill="#FFC93C" d="M196,128a68,68,0,1,1-68-68A68.07,68.07,0,0,1,196,128ZM172,128a44,44,0,1,0-44,44A44.05,44.05,0,0,0,172,128Z"/><path fill="#F0654A" d="M116,36V20a12,12,0,0,1,24,0V36a12,12,0,0,1-24,0Z"/><path fill="#4FC1E0" d="M196,72a12,12,0,0,0,8.49-3.51l12-12a12,12,0,0,0-17-17l-12,12A12,12,0,0,0,196,72Z"/><path fill="#6FBE6A" d="M236,116H220a12,12,0,0,0,0,24h16a12,12,0,0,0,0-24Z"/><path fill="#E0568C" d="M204.49,187.51a12,12,0,0,0-17,17l12,12a12,12,0,0,0,17-17Z"/><path fill="#F0654A" d="M128,208a12,12,0,0,0-12,12v16a12,12,0,0,0,24,0V220A12,12,0,0,0,128,208Z"/><path fill="#4FC1E0" d="M51.51,187.49l-12,12a12,12,0,0,0,17,17l12-12a12,12,0,1,0-17-17Z"/><path fill="#6FBE6A" d="M48,128a12,12,0,0,0-12-12H20a12,12,0,0,0,0,24H36A12,12,0,0,0,48,128Z"/><path fill="#E0568C" d="M51.51,68.49a12,12,0,1,0,17-17l-12-12a12,12,0,0,0-17,17Z"/></g></svg><div class="brand-name">Morgonlistan</div></div>`;
}

function friendlyAuthError(error) {
  const msg = error && error.message || "";
  if (/invalid login credentials/i.test(msg)) return "Fel e-post eller lösenord.";
  if (/user already registered/i.test(msg)) return "Det finns redan ett konto med den e-postadressen. Logga in istället.";
  if (/password should be at least/i.test(msg)) return "Lösenordet måste vara minst 6 tecken.";
  if (/unable to validate email/i.test(msg) || /invalid email/i.test(msg)) return "Ogiltig e-postadress.";
  if (/email not confirmed/i.test(msg)) return "E-posten är inte bekräftad än. Skriv in koden från mejlet.";
  if (/token has expired|otp_expired|invalid.*token|token.*invalid/i.test(msg)) return "Fel eller utgången kod. Försök igen eller skicka en ny.";
  if (/security purposes|rate limit/i.test(msg)) return "Vänta en stund innan du försöker igen.";
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
  return { checkNow: () => attempt(true), stop };
}

// Signup confirmation is a code typed into this screen, so it works the
// same whichever mail app the email is opened in — a link can't be relied
// on to open the app rather than a browser. The link in the email still
// works too (watchForEmailConfirmation signs this screen in once it's been
// clicked anywhere), so someone who taps it instead isn't stranded.
function renderSignupConfirmScreen(wrap, email, password, onBack) {
  wrap.innerHTML = `
    ${brandLockupHTML()}
    <div class="home-title">Bekräfta din e-post</div>
    <div class="onboard-subtitle">Vi har skickat en kod till ${escapeHtml(email)}. Skriv in den här för att komma igång.</div>
  `;

  const field = el("div", "field");
  field.innerHTML = `<label>Kod</label>`;
  const codeInput = document.createElement("input");
  codeInput.type = "text";
  codeInput.inputMode = "numeric";
  codeInput.autocomplete = "one-time-code";
  codeInput.maxLength = 6;
  codeInput.placeholder = "Koden från mejlet";
  field.appendChild(codeInput);
  wrap.appendChild(field);

  const msgEl = el("div", "field-error", "");
  msgEl.style.display = "none";
  function showMsg(text, isError = true) {
    msgEl.textContent = text;
    msgEl.style.color = isError ? "" : "#495057";
    msgEl.style.display = "block";
  }
  wrap.appendChild(msgEl);

  const btn = el("button", "primary-btn", "Bekräfta");
  btn.onclick = async () => {
    const token = codeInput.value.replace(/\s/g, "");
    if (!token) { codeInput.focus(); return; }
    msgEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Bekräftar...";
    const { error } = await supabaseClient.auth.verifyOtp({ email, token, type: "signup" });
    if (error) {
      showMsg(friendlyAuthError(error));
      btn.disabled = false;
      btn.textContent = "Bekräfta";
    }
    // On success, onAuthStateChange in initAuth() takes over.
  };
  wrap.appendChild(btn);

  const watcher = watchForEmailConfirmation(email, password, wrap, showMsg);

  const links = el("div", "auth-links");
  const linkBtn = document.createElement("button");
  linkBtn.type = "button";
  linkBtn.className = "link-btn";
  linkBtn.textContent = "Jag klickade på länken istället";
  linkBtn.onclick = watcher.checkNow;
  links.appendChild(linkBtn);

  const resendBtn = document.createElement("button");
  resendBtn.type = "button";
  resendBtn.className = "link-btn";
  resendBtn.textContent = "Skicka ny kod";
  resendBtn.onclick = async () => {
    resendBtn.disabled = true;
    const { error } = await supabaseClient.auth.resend({ type: "signup", email });
    resendBtn.disabled = false;
    if (error) showMsg(friendlyAuthError(error));
    else showMsg("Vi har skickat en ny kod.", false);
  };
  links.appendChild(resendBtn);

  // Wrong address typed at signup? Back to the form with it filled in. The
  // watcher must stop too, or it would keep trying to sign in behind the form.
  const backBtn = document.createElement("button");
  backBtn.type = "button";
  backBtn.className = "link-btn";
  backBtn.textContent = "Ändra e-postadress";
  backBtn.onclick = () => { watcher.stop(); onBack(); };
  links.appendChild(backBtn);
  wrap.appendChild(links);

  setTimeout(() => codeInput.focus(), 50);
}

function renderLoginScreen(initialMode = "login") {
  let mode = initialMode; // "login" | "signup" | "forgot"
  let prefillEmail = ""; // carried across a redraw when going back from a "check your email" screen
  const wrap = el("div", "screen onboard-wrap");

  function draw() {
    wrap.innerHTML = "";

    const headings = { login: "Logga in", signup: "Skapa konto", forgot: "Glömt lösenordet?" };
    const subtitles = {
      login: "",
      signup: "Ett konto för hela din familj.",
      forgot: "Ange din e-post så skickar vi instruktioner för att återställa lösenordet.",
    };
    wrap.innerHTML = `
      ${brandLockupHTML()}
      <div class="home-title">${headings[mode]}</div>
      ${subtitles[mode] ? `<div class="onboard-subtitle">${subtitles[mode]}</div>` : ""}
    `;

    const emailField = el("div", "field");
    emailField.innerHTML = `<label>E-post</label>`;
    const emailInput = document.createElement("input");
    emailInput.type = "email";
    emailInput.placeholder = "din@epost.se";
    emailInput.autocomplete = "email";
    emailInput.value = prefillEmail;
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
        renderSignupConfirmScreen(wrap, email, password, () => { mode = "signup"; prefillEmail = email; draw(); });
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
          ${brandLockupHTML()}
          <div class="home-title">Kolla din inkorg</div>
          <div class="onboard-subtitle">Vi har skickat instruktioner för att återställa lösenordet till ${escapeHtml(email)}.</div>
        `;
        const backToLogin = document.createElement("button");
        backToLogin.type = "button";
        backToLogin.className = "link-btn";
        backToLogin.textContent = "Tillbaka till inloggning";
        backToLogin.onclick = () => { mode = "login"; prefillEmail = email; draw(); };
        wrap.appendChild(backToLogin);
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
      cancelReminders().catch(() => {});
      inPasswordRecovery = false;
      currentUserId = null;
      state = null;
      showLoginScreen();
    } else if (inPasswordRecovery) {
      // Ignore the SIGNED_IN/INITIAL_SESSION noise Supabase fires right
      // after PASSWORD_RECOVERY — stay on "set new password" until the
      // user actually submits one (or explicitly signs out).
    } else if (signupConfirmedLanding && session) {
      showAccountActivatedScreen(session.user.id);
    } else if (session && session.user.id !== currentUserId) {
      bootstrapApp(session.user.id);
    } else if (!session && event === "INITIAL_SESSION") {
      if (shouldShowLanding()) showLandingScreen();
      else showLoginScreen();
    }
  });
}

function showAccountActivatedScreen(userId) {
  const wrap = el("div", "screen onboard-wrap");
  wrap.innerHTML = `
    ${brandLockupHTML()}
    <div class="home-title">Kontot är aktiverat</div>
    <div class="onboard-subtitle">Gå tillbaka till appen där du skapade kontot — du loggas in automatiskt.</div>
  `;
  const stay = document.createElement("button");
  stay.type = "button";
  stay.className = "link-btn";
  stay.textContent = "Fortsätt på webben istället";
  stay.onclick = () => {
    signupConfirmedLanding = false;
    bootstrapApp(userId);
  };
  wrap.appendChild(stay);
  app.innerHTML = "";
  app.appendChild(wrap);
}

function showSetNewPasswordScreen() {
  app.innerHTML = "";
  app.appendChild(renderSetNewPasswordScreen());
}

function renderSetNewPasswordScreen() {
  const wrap = el("div", "screen onboard-wrap");
  wrap.innerHTML = `
    ${brandLockupHTML()}
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
    // Same reasoning as the signup confirmation's "account activated" page:
    // a reset link usually opens somewhere other than the app it was
    // requested from (Outlook's in-app browser, Safari), and bootstrapping
    // the full working app right there just invites using that instead of
    // switching to the native app. Unlike signup, there's no way to sign
    // the original app in automatically here — that app never sees this
    // new password, only this browser does — so the copy asks for a
    // manual return + login rather than claiming it'll happen on its own.
    if (isNativeApp) await bootstrapApp(data.user.id);
    else showPasswordResetDoneScreen(data.user.id);
  };
  wrap.appendChild(btn);

  setTimeout(() => passwordInput.focus(), 50);
  return wrap;
}

function showPasswordResetDoneScreen(userId) {
  const wrap = el("div", "screen onboard-wrap");
  wrap.innerHTML = `
    ${brandLockupHTML()}
    <div class="home-title">Lösenordet är sparat</div>
    <div class="onboard-subtitle">Gå tillbaka till appen och logga in med ditt nya lösenord.</div>
  `;
  const stay = document.createElement("button");
  stay.type = "button";
  stay.className = "link-btn";
  stay.textContent = "Fortsätt på webben istället";
  stay.onclick = () => bootstrapApp(userId);
  wrap.appendChild(stay);
  app.innerHTML = "";
  app.appendChild(wrap);
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

// The reward week ends on a day and time a parent sets in Parent mode —
// Saturday 18:00 by default, matching when the evening list used to kick in,
// since that's when parents hand out the week's reward. Day and time are
// independently configurable (a family can move the reset off the evening
// switch entirely), so the morning of the reset day still counts and
// whether its evening starts a fresh week depends only on the configured time.
//
// The day/time is a *schedule*, not a single value: changing it mid-week
// appends an entry that only takes effect at the end of the week in
// progress, which is therefore never cut short or stretched, and no reward
// is lost or moved between weeks. Entry = { effectiveAt: ms of a week
// boundary, day, hour, minute }. The first week under a new setting runs
// from effectiveAt to the first new boundary after it (so that one
// transition week can be shorter or longer).
const DEFAULT_SCHEDULE = [{ effectiveAt: 0, day: DEFAULT_RESET_DAY, hour: DEFAULT_RESET_HOUR, minute: 0 }];

function activeScheduleEntry(now, schedule) {
  const t = now.getTime();
  let entry = schedule[0];
  for (const e of schedule) if (e.effectiveAt <= t) entry = e;
  return entry;
}

// Most recent `day` at `hour`:`minute`, at or before `now`.
function latestWeekdayBoundary(now, day, hour, minute) {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() - day + 7) % 7));
  if (d.getTime() > now.getTime()) d.setDate(d.getDate() - 7);
  return d.getTime();
}

function getRewardWeekStart(now = new Date(), schedule = (state && state.resetSchedule) || DEFAULT_SCHEDULE) {
  const entry = activeScheduleEntry(now, schedule);
  return Math.max(latestWeekdayBoundary(now, entry.day, entry.hour, entry.minute), entry.effectiveAt);
}

// When the week in progress ends. Calendar days, not 7x24h, so a clock change
// can't move it off its configured wall-clock time.
function getNextRewardWeekEnd(now = new Date(), schedule = (state && state.resetSchedule) || DEFAULT_SCHEDULE) {
  const entry = activeScheduleEntry(now, schedule);
  const d = new Date(latestWeekdayBoundary(now, entry.day, entry.hour, entry.minute));
  d.setDate(d.getDate() + 7);
  return d.getTime();
}

// The week that just ended, found by looking one millisecond before this
// week began — correct even when a schedule change made it a different length.
function getPreviousRewardWeekStart(now = new Date(), schedule = (state && state.resetSchedule) || DEFAULT_SCHEDULE) {
  return getRewardWeekStart(new Date(getRewardWeekStart(now, schedule) - 1), schedule);
}

// Per-kid early end (ROADMAP §1 follow-up): a kid can end their own week the
// moment their morning list is done on the reset day, rather than waiting
// for the family's Klockslag fallback — opt-in per family
// (endWeekEarlyOnMorningDone), independent per kid (one kid finishing
// doesn't affect a sibling still working through their list). Recorded
// once as {closedCycleStart, endedAt, nextRegularBoundary} — the family's
// own OWN unadjusted values at the moment it fires, not recomputed live —
// specifically so the override keeps applying for this one transition even
// after the family's own un-adjusted checkpoint later passes the same day
// (an earlier, buggier version compared against a live-recomputed family
// boundary and silently stopped applying at that exact moment). Naturally
// stops applying once "now" reaches nextRegularBoundary — one cycle later,
// this kid is back on the shared family schedule until they trigger early
// again.
function kidWeekStart(kidId, now = new Date()) {
  const early = state.earlyWeekEnds[kidId];
  if (early && now.getTime() >= early.endedAt && now.getTime() < early.nextRegularBoundary) {
    return early.endedAt;
  }
  return getRewardWeekStart(now);
}

function kidWeekEnd(kidId, now = new Date()) {
  const early = state.earlyWeekEnds[kidId];
  if (early && now.getTime() < early.endedAt && getRewardWeekStart(now) === early.closedCycleStart) {
    return early.endedAt; // still in the cycle being closed early, before the trigger itself
  }
  if (early && now.getTime() >= early.endedAt && now.getTime() < early.nextRegularBoundary) {
    return early.nextRegularBoundary; // the kid's own early-started week, running to the family's next regular boundary
  }
  return getNextRewardWeekEnd(now);
}

function kidPreviousWeekStart(kidId, now = new Date()) {
  return kidWeekStart(kidId, new Date(kidWeekStart(kidId, now) - 1));
}

// Records kid A finishing their morning list on the reset day, before the
// family's own Klockslag fallback has passed. Safe to call unconditionally
// from toggleTask's "just completed the session" branch, which already
// only fires once per day (guarded by hasSessionReward) — this simply does
// nothing when the setting is off, it isn't the reset day, or an early end
// for the current cycle is already recorded.
// Returns true only when this call actually just closed a kid's week early
// (not on a no-op call), so the caller can trigger a one-time celebration.
function maybeEndWeekEarly(kidId, now = new Date()) {
  if (!state.endWeekEarlyOnMorningDone) return false;
  if (now.getDay() !== getRewardWeekEndDay(now)) return false;
  const closedCycleStart = getRewardWeekStart(now);
  // If the cycle now in force already started earlier TODAY, the family's
  // own Klockslag fallback has already fired today — there's nothing to
  // bring forward; a morning list finished after that reset belongs to the
  // brand-new cycle already, not a second one to close early on top of it.
  // (getNextRewardWeekEnd(now) is always >= now by construction, so
  // comparing against it directly can never catch this — that was the bug
  // in an earlier version of this guard, caught by testing exactly this case.)
  const cycleStartDate = new Date(closedCycleStart);
  if (cycleStartDate.getFullYear() === now.getFullYear() && cycleStartDate.getMonth() === now.getMonth() && cycleStartDate.getDate() === now.getDate()) return false;
  const existing = state.earlyWeekEnds[kidId];
  if (existing && existing.closedCycleStart === closedCycleStart) return false; // already recorded this cycle
  const closedCycleEnd = getNextRewardWeekEnd(now);
  const nextRegularBoundary = getNextRewardWeekEnd(new Date(closedCycleEnd + 1));
  state.earlyWeekEnds[kidId] = { closedCycleStart, endedAt: now.getTime(), nextRegularBoundary };
  return true;
}

// "3 dagar kvar" — whole calendar days until the week ends.
function weekDaysLeftText(kidId, now = new Date()) {
  const end = new Date(kidId ? kidWeekEnd(kidId, now) : getNextRewardWeekEnd(now));
  end.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = Math.round((end - today) / 86400000);
  if (days <= 0) return "slutar i kväll";
  return days === 1 ? "1 dag kvar" : `${days} dagar kvar`;
}

// Picks a new reset day and/or time (pass either or both), effective
// immediately — a parent changing this expects it to apply right away, not
// weeks later. Any field left out keeps whatever's currently active, so
// changing day and time in two separate steps combines them rather than the
// second overwriting the first. Nothing already earned this cycle is lost by
// cutting it short (or extending it): the completions log is untouched, it's
// only the boundary that moves, so whatever falls before the new boundary
// simply becomes "last week" via the usual Förra veckan / Utdelat flow.
function setResetSchedule(partial, now = new Date()) {
  const schedule = state.resetSchedule.filter(e => e.effectiveAt <= now.getTime());
  const current = activeScheduleEntry(now, schedule);
  const next = { day: current.day, hour: current.hour, minute: current.minute, ...partial };
  if (next.day !== current.day || next.hour !== current.hour || next.minute !== current.minute) {
    schedule.push({ effectiveAt: now.getTime(), ...next });
  }
  state.resetSchedule = schedule.slice(-10);
  saveState();
}

function getRewardWeekEndDay(now = new Date()) {
  return activeScheduleEntry(now, state.resetSchedule).day;
}

function getRewardWeekEndTime(now = new Date()) {
  const e = activeScheduleEntry(now, state.resetSchedule);
  return { hour: e.hour, minute: e.minute };
}

function formatTime(hour, minute) {
  return `${hour}:${String(minute).padStart(2, "0")}`;
}

// ---------- Daily reminders (iPhone app only) ----------
//
// Local notifications: iOS itself holds and delivers them, so they arrive at
// the set time even when the app is closed or force-quit, with no server. The
// plugin only exists inside the native app; on the web there's nothing to
// schedule, so the setting simply isn't offered there. Times live in the
// family's `state` (both parents' devices agree); the permission is per
// device, so each device schedules its own copy and never asks for permission
// except when a parent turns reminders on.

const REMINDER_IDS = { morning: 1001, evening: 1002, weekEnd: 1003 };
const REMINDER_TEXT = {
  morning: { title: "Dags för morgonlistan", body: "Öppna Morgonlistan och bocka av." },
  evening: { title: "Dags för kvällslistan", body: "Öppna Morgonlistan och bocka av." },
  // No kid names or counts here — a scheduled notification's text is fixed
  // at scheduling time and can go stale, so this stays generic on purpose.
  weekEnd: { title: "Veckan är slut!", body: "Dags att dela ut veckans belöning." },
};

// Present only when running inside the native app with the plugin installed.
function localNotifications() {
  return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications) || null;
}

function parseReminderTime(value) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value || "");
  if (!m) return null;
  const hour = Number(m[1]), minute = Number(m[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

async function reminderPermission() {
  const ln = localNotifications();
  if (!ln) return "unavailable";
  return (await ln.checkPermissions()).display; // "granted" | "denied" | "prompt" ...
}

// Asks iOS for permission only if it hasn't been decided yet.
async function ensureReminderPermission() {
  const ln = localNotifications();
  if (!ln) return "unavailable";
  let permission = (await ln.checkPermissions()).display;
  if (permission === "prompt" || permission === "prompt-with-rationale") {
    permission = (await ln.requestPermissions()).display;
  }
  return permission;
}

async function cancelReminders() {
  const ln = localNotifications();
  if (!ln) return;
  await ln.cancel({ notifications: Object.values(REMINDER_IDS).map(id => ({ id })) });
}

// Makes what iOS has scheduled match the family's settings: cancel both, then
// schedule again if reminders are on and this device has allowed them. Safe to
// call any time (on load, after a change).
async function syncReminders() {
  const ln = localNotifications();
  if (!ln || !state) return;
  await cancelReminders();
  const settings = state.reminders;
  if (!settings.enabled) return;
  if ((await ln.checkPermissions()).display !== "granted") return;
  const notifications = [];
  for (const kind of ["morning", "evening"]) {
    const time = parseReminderTime(settings[kind]);
    if (!time) continue;
    notifications.push({
      id: REMINDER_IDS[kind],
      ...REMINDER_TEXT[kind],
      // A calendar trigger without a date repeats every day at this time.
      schedule: { on: { hour: time.hour, minute: time.minute }, allowWhileIdle: true },
    });
  }
  // One-shot, at the next reset moment rather than a repeating daily time —
  // re-run any time (this function already is, on load and after a change)
  // and it just re-points at whatever the next boundary currently is, which
  // also picks up a reset-day change automatically.
  notifications.push({
    id: REMINDER_IDS.weekEnd,
    ...REMINDER_TEXT.weekEnd,
    schedule: { at: new Date(getNextRewardWeekEnd()), allowWhileIdle: true },
  });
  if (notifications.length) await ln.schedule({ notifications });
}

// "16/9–23/9" — the week's date span for the history list. Uses the day
// before `end` (the reset moves to a new day at the exact boundary, which
// belongs to the new week), so a Saturday-18:00 week reads "13/9–19/9",
// not "...–20/9".
function formatWeekRange(startMs, endMs) {
  const s = new Date(startMs);
  const e = new Date(endMs - 1);
  return `${s.getDate()}/${s.getMonth() + 1}–${e.getDate()}/${e.getMonth() + 1}`;
}

function formatWeekEnd(ms) {
  const d = new Date(ms);
  return `${WEEKDAYS_SV[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1} kl. ${formatTime(d.getHours(), d.getMinutes())}`;
}

// What's still to be handed out from the week that just ended, or null when
// there's nothing (no reward earned) or a parent already confirmed it. The
// reward is gone at the reset either way — this only keeps the result
// visible so the reset never looks like lost data (ROADMAP §1).
function pendingWeekSummary(kidId, now = new Date()) {
  const start = kidPreviousWeekStart(kidId, now);
  const end = kidWeekStart(kidId, now);
  if (state.settledWeeks[kidId] === start) return null;
  const count = state.completions
    .filter(c => c.kidId === kidId && completionTimestamp(c) >= start && completionTimestamp(c) < end)
    .reduce((sum, c) => sum + c.amount, 0);
  return count > 0 ? { count, weekStart: start } : null;
}

const WEEK_HISTORY_LENGTH = 8;

// The last `count` completed weeks (most recent first, oldest first if a
// short history exists), each with every kid's total. Never includes the
// week in progress. Walks backward one boundary at a time with the same
// "one millisecond before" trick as getPreviousRewardWeekStart, so it's
// correct across a reset-day change partway through the history too.
function weekHistory(count = WEEK_HISTORY_LENGTH, now = new Date()) {
  const weeks = [];
  let end = getRewardWeekStart(now);
  for (let i = 0; i < count; i++) {
    const start = getRewardWeekStart(new Date(end - 1));
    if (start >= end) break; // guards against a schedule that can't move backward further
    const totals = {};
    for (const kid of state.kids) {
      const total = state.completions
        .filter(c => c.kidId === kid.id && completionTimestamp(c) >= start && completionTimestamp(c) < end)
        .reduce((sum, c) => sum + c.amount, 0);
      if (total > 0) totals[kid.id] = total;
    }
    weeks.push({ start, end, totals });
    end = start;
  }
  return weeks;
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
  const start = kidWeekStart(kidId);
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

// The main screen is drawn once, so an app left open (or backgrounded) across
// the morning→evening switch or midnight would keep showing the old list and
// yesterday's ticks. Redraw when the period or date has moved on — checked on
// return to the app and on a slow timer — but never over an open dialog.
let renderedMain = null; // { period, date } of the main screen as last drawn
function refreshIfStale() {
  if (!state || route.screen !== "main" || !renderedMain || state.kids.length === 0) return;
  if (document.querySelector(".modal-overlay")) return;
  if (renderedMain.period !== getCurrentPeriod() || renderedMain.date !== todayStr()) render();
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshIfStale(); });
setInterval(refreshIfStale, 30000);

function el(tag, className, html) {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (html !== undefined) e.innerHTML = html;
  return e;
}

// ---------- Onboarding ----------

const WIZARD_MAX_KIDS = 6;

// Colours spread around the hue wheel, so kids added together are easy to
// tell apart at a glance (a parent can still change any of them).
function evenlySpacedKidColors(n) {
  return Array.from({ length: n }, (_, i) => KID_COLORS[Math.floor((i * KID_COLORS.length) / n)]);
}

// First-run setup for a family with no kids: how many, then their names, then
// everything is created at once. Nothing is saved until the end, so leaving
// halfway just starts over next time. The default task lists, currency and
// weekly cycle are already in place (defaultState), so a family can use the
// app the moment this is done; Parent mode stays there for changing anything.
function renderOnboarding() {
  if (state.setupDone) return renderNoKidsScreen();
  const wrap = el("div", "screen onboard-wrap");
  let count = 1;
  let names = [];
  let colors = [];

  function drawCount() {
    wrap.innerHTML = `
      ${brandLockupHTML()}
      <div class="home-title">Välkommen!</div>
      <div class="onboard-subtitle">Vi hjälper dig komma igång. Hur många barn ska använda Morgonlistan?</div>
    `;
    const grid = el("div", "weekday-grid count-grid");
    for (let n = 1; n <= WIZARD_MAX_KIDS; n++) {
      const chip = el("button", "weekday-option" + (n === count ? " selected" : ""), String(n));
      chip.onclick = () => { count = n; drawCount(); };
      grid.appendChild(chip);
    }
    wrap.appendChild(grid);

    const next = el("button", "primary-btn", "Fortsätt");
    next.onclick = () => {
      names = Array.from({ length: count }, (_, i) => names[i] || "");
      if (colors.length !== count) colors = evenlySpacedKidColors(count); // keep a colour the parent already picked
      drawNames();
    };
    wrap.appendChild(next);

    const links = el("div", "auth-links");
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "link-btn";
    skip.textContent = "Hoppa över, jag lägger till själv";
    skip.onclick = () => {
      state.setupDone = true;
      saveState();
      route = { screen: "parent" };
      render();
    };
    links.appendChild(skip);
    wrap.appendChild(links);
  }

  function drawNames() {
    wrap.innerHTML = `
      ${brandLockupHTML()}
      <div class="home-title">${count === 1 ? "Vad heter barnet?" : "Vad heter barnen?"}</div>
      <div class="onboard-subtitle">Varje barn får en egen färg. Tryck på färgen för att byta.</div>
    `;
    const inputs = [];
    for (let i = 0; i < count; i++) {
      const field = el("div", "field");
      field.innerHTML = `<label>${count === 1 ? "Namn" : `Barn ${i + 1}`}</label>`;
      const row = el("div", "name-row");
      const dot = el("button", "color-dot");
      dot.type = "button";
      dot.style.background = colors[i];
      dot.setAttribute("aria-label", "Byt färg");
      dot.onclick = () => {
        let idx = KID_COLORS.indexOf(colors[i]);
        do { idx = (idx + 1) % KID_COLORS.length; } while (colors.includes(KID_COLORS[idx]));
        colors[i] = KID_COLORS[idx];
        dot.style.background = colors[i];
      };
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "T.ex. Vera";
      input.maxLength = 20;
      input.autocomplete = "off";
      input.value = names[i];
      input.oninput = () => { names[i] = input.value; };
      inputs.push(input);
      row.appendChild(dot);
      row.appendChild(input);
      field.appendChild(row);
      wrap.appendChild(field);
    }
    wrap.appendChild(el("div", "onboard-subtitle", "Vi lägger in vanliga uppgifter för morgon och kväll. Du ändrar dem senare i Föräldraläge."));

    const errorEl = el("div", "field-error", "Skriv ett namn för varje barn.");
    errorEl.style.display = "none";
    wrap.appendChild(errorEl);

    const done = el("button", "primary-btn", "Klart");
    done.onclick = () => {
      const cleaned = names.map(n => n.trim());
      const blank = cleaned.findIndex(n => !n);
      if (blank !== -1) {
        errorEl.style.display = "block";
        inputs[blank].focus();
        return;
      }
      state.kids = cleaned.map((name, i) => ({ id: uid(), name, color: colors[i] }));
      state.setupDone = true;
      saveState();
      render();
    };
    wrap.appendChild(done);

    const links = el("div", "auth-links");
    const back = document.createElement("button");
    back.type = "button";
    back.className = "link-btn";
    back.textContent = "Tillbaka";
    back.onclick = drawCount;
    links.appendChild(back);
    wrap.appendChild(links);
    setTimeout(() => inputs[0].focus(), 50);
  }

  drawCount();
  return wrap;
}

// Setup was skipped (or every child has since been removed): just a way in.
function renderNoKidsScreen() {
  const wrap = el("div", "screen onboard-wrap");
  wrap.innerHTML = `
    ${brandLockupHTML()}
    <div class="home-title">Inga barn ännu</div>
    <div class="onboard-subtitle">Lägg till ett barn för att komma igång.</div>
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

function buildWeekSummary(kid) {
  const summary = pendingWeekSummary(kid.id);
  if (!summary) return null;
  const row = el("div", "week-summary");
  row.innerHTML = `<span class="week-summary-text">Förra veckan: <b>${summary.count} ${escapeHtml(state.currencySymbol)}</b></span>`;
  const btn = el("button", "week-summary-btn", "Utdelat");
  // Parents only: a child tapping this would hide the result before anyone
  // has seen how many were earned.
  btn.onclick = () => openParentGate(() => {
    state.settledWeeks[kid.id] = summary.weekStart;
    saveState();
    render();
  });
  row.appendChild(btn);
  return row;
}

function buildRewardCard(kid, tasks, celebrating = allTasksDoneToday(kid.id, tasks), weekEndedEarly = false) {
  const card = el("div", "reward-card" + (celebrating ? " celebrating" : ""));
  card.innerHTML = `
    ${buildRewardJar(weeklyBalance(kid.id), state.currencySymbol)}
    ${celebrating
      ? `<div class="celebration-line1">Allt klart för idag! 🎉</div>`
      : `<div class="reward-label">denna vecka</div>`}
    ${weekEndedEarly ? `<div class="reward-label">Och veckan är klar — bra jobbat! 🎊</div>` : ``}
  `;
  return card;
}

function renderMain() {
  const screen = el("div", "screen");
  const period = getCurrentPeriod();
  const tasks = getActiveTasks(period);
  renderedMain = { period, date: todayStr() };

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
    <div class="week-left">${weekDaysLeftText(kid.id)}</div>
  `;
  panel.appendChild(header);
  const weekSummary = buildWeekSummary(kid);
  if (weekSummary) panel.appendChild(weekSummary);
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
    const justEndedWeek = period === "morning" ? maybeEndWeekEarly(kid.id) : false;
    saveState();
    rewardCardEl.replaceWith(buildRewardCard(kid, tasks, false));
    if (justEndedWeek) {
      const weekLeftEl = panelEl.querySelector(".week-left");
      if (weekLeftEl) weekLeftEl.textContent = weekDaysLeftText(kid.id);
      const newSummary = buildWeekSummary(kid);
      const existingSummary = panelEl.querySelector(".week-summary");
      if (existingSummary) {
        if (newSummary) existingSummary.replaceWith(newSummary); else existingSummary.remove();
      } else if (newSummary) {
        panelEl.querySelector(".panel-header").insertAdjacentElement("afterend", newSummary);
      }
    }
    setTimeout(() => {
      playCheer();
      panelEl.querySelector(".reward-card").replaceWith(buildRewardCard(kid, tasks, true, justEndedWeek));
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

function openParentGate(onPass) {
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
      if (onPass) { onPass(); return; }
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

  const weekEndLabel = el("div", "field-label", "Veckan slutar");
  weekEndLabel.style.marginTop = "24px";
  settingsSection.appendChild(weekEndLabel);
  const weekdayGrid = el("div", "weekday-grid");
  settingsSection.appendChild(weekdayGrid);
  const timeField = el("div", "field");
  timeField.style.marginTop = "12px";
  timeField.innerHTML = `<label>Klockslag</label>`;
  const timeInput = document.createElement("input");
  timeInput.type = "time";
  timeField.appendChild(timeInput);
  settingsSection.appendChild(timeField);
  const weekdayInfo = el("div", "modal-text");
  weekdayInfo.style.marginTop = "12px";
  settingsSection.appendChild(weekdayInfo);

  const selectedWeekday = () => getRewardWeekEndDay();
  const selectedTime = () => getRewardWeekEndTime();

  const drawWeekdayInfo = () => {
    const t = selectedTime();
    weekdayInfo.textContent = `Veckan slutar ${WEEKDAYS_SV[getRewardWeekEndDay()]} kl. ${formatTime(t.hour, t.minute)} — nästa gång ${formatWeekEnd(getNextRewardWeekEnd())}.`;
  };
  const drawWeekdayButtons = () => {
    weekdayGrid.innerHTML = "";
    WEEKDAY_ORDER.forEach(day => {
      const btn = el("button", "weekday-option" + (day === selectedWeekday() ? " selected" : ""), WEEKDAYS_SV[day].slice(0, 3));
      btn.onclick = () => proposeResetChange({ day });
      weekdayGrid.appendChild(btn);
    });
  };
  const drawTimeInput = () => {
    const t = selectedTime();
    timeInput.value = formatTime(t.hour, t.minute);
  };
  timeInput.onchange = () => {
    const parsed = parseReminderTime(timeInput.value);
    if (!parsed) { drawTimeInput(); return; }
    proposeResetChange({ hour: parsed.hour, minute: parsed.minute });
  };

  // Shared by both controls: applies immediately — a parent changing this
  // expects the new schedule to take effect right away, not weeks later
  // (see setResetSchedule). If the combined result (this field plus
  // whatever's already selected for the other one) matches what's already
  // active, there's nothing to confirm. Otherwise confirm first, since it
  // changes when the current week ends — possibly to right now.
  function proposeResetChange(partial) {
    const proposedDay = "day" in partial ? partial.day : selectedWeekday();
    const proposedTime = "hour" in partial ? { hour: partial.hour, minute: partial.minute } : selectedTime();
    const commit = () => { setResetSchedule(partial); drawWeekdayButtons(); drawTimeInput(); drawWeekdayInfo(); drawEarlyEnd(); };
    if (proposedDay === getRewardWeekEndDay()) {
      const active = getRewardWeekEndTime();
      if (proposedTime.hour === active.hour && proposedTime.minute === active.minute) { commit(); return; }
    }
    openModal((sheet, close) => {
      sheet.appendChild(el("div", "modal-title", "Byta veckoslut?"));
      sheet.appendChild(el("div", "modal-text",
        `Veckan slutar nu direkt, på ${WEEKDAYS_SV[proposedDay]}ar kl. ${formatTime(proposedTime.hour, proposedTime.minute)} framöver. Det som redan är intjänat den här veckan sparas som förra veckans belöning, redo att delas ut — ingen belöning försvinner.`));
      const actions = el("div", "modal-actions");
      const cancel = el("button", "secondary-btn", "Avbryt");
      cancel.onclick = () => { close(); drawTimeInput(); }; // undo an unconfirmed time-field edit
      const ok = el("button", "primary-btn", "Byt");
      ok.onclick = () => { close(); commit(); };
      actions.appendChild(cancel);
      actions.appendChild(ok);
      sheet.appendChild(actions);
    });
  }

  drawWeekdayButtons();
  drawTimeInput();
  drawWeekdayInfo();

  const earlyEndLabel = el("div", "field-label", "Sluta tidigt");
  earlyEndLabel.style.marginTop = "24px";
  settingsSection.appendChild(earlyEndLabel);
  const earlyEndBox = el("div");
  settingsSection.appendChild(earlyEndBox);
  const drawEarlyEnd = () => {
    earlyEndBox.innerHTML = "";
    const on = state.endWeekEarlyOnMorningDone;
    const toggle = el("div", "weekday-grid");
    toggle.style.gridTemplateColumns = "1fr 1fr";
    [["Av", false], ["På", true]].forEach(([label, value]) => {
      const btn = el("button", "weekday-option" + (on === value ? " selected" : ""), label);
      btn.onclick = () => {
        if (on === value) return;
        state.endWeekEarlyOnMorningDone = value;
        saveState();
        drawEarlyEnd();
      };
      toggle.appendChild(btn);
    });
    earlyEndBox.appendChild(toggle);
    const note = el("div", "modal-text");
    note.style.marginTop = "12px";
    note.textContent = `När ett barn är klart med morgonlistan på ${WEEKDAYS_SV[getRewardWeekEndDay()]}en, avslutas veckan direkt för det barnet — i stället för att vänta till kl. ${formatTime(getRewardWeekEndTime().hour, getRewardWeekEndTime().minute)}. Ett syskon som inte är klar än påverkas inte.`;
    earlyEndBox.appendChild(note);
  };
  drawEarlyEnd();

  // Reminders — only offered inside the iPhone app, where the plugin exists.
  if (localNotifications()) {
    const reminderLabel = el("div", "field-label", "Påminnelser");
    reminderLabel.style.marginTop = "24px";
    settingsSection.appendChild(reminderLabel);
    const reminderBox = el("div");
    settingsSection.appendChild(reminderBox);
    const drawReminders = async () => {
      reminderBox.innerHTML = "";
      let permission = await reminderPermission();
      const on = state.reminders.enabled;
      // Reminders default to on for a new family, but iOS still needs an
      // explicit ask before anything can actually be scheduled — and
      // clicking an already-selected "På" chip does nothing (see below), so
      // without this, a family that never touched the toggle would be
      // stuck showing "on" with no way to trigger the prompt. Ask once,
      // right when this section is first seen in that state; iOS itself
      // only returns "prompt" until the person has answered, so this can
      // only ever fire the real system prompt one time, never repeatedly.
      if (on && (permission === "prompt" || permission === "prompt-with-rationale")) {
        permission = await ensureReminderPermission();
        if (permission === "granted") await syncReminders();
      }
      const toggle = el("div", "weekday-grid");
      toggle.style.gridTemplateColumns = "1fr 1fr";
      [["Av", false], ["På", true]].forEach(([label, value]) => {
        const btn = el("button", "weekday-option" + (on === value ? " selected" : ""), label);
        btn.onclick = async () => {
          if (on === value) return;
          if (value) {
            const result = await ensureReminderPermission();
            if (result !== "granted") { await drawReminders(); return; }
          }
          state.reminders.enabled = value;
          saveState();
          await syncReminders();
          await drawReminders();
        };
        toggle.appendChild(btn);
      });
      reminderBox.appendChild(toggle);

      const note = el("div", "modal-text");
      note.style.marginTop = "12px";
      if (permission === "denied") {
        note.textContent = "Aviseringar är avstängda för Morgonlistan på den här enheten. Slå på dem i iOS Inställningar → Morgonlistan → Aviseringar.";
      } else if (on && permission !== "granted") {
        note.textContent = "Påminnelserna är på för familjen, men den här enheten har inte tillåtit aviseringar än.";
      } else {
        note.textContent = "En avisering på den här enheten när det är dags för morgon- och kvällslistan.";
      }
      reminderBox.appendChild(note);

      if (on) {
        [["morning", "Morgon"], ["evening", "Kväll"]].forEach(([kind, label]) => {
          const field = el("div", "field");
          field.style.marginTop = "12px";
          field.innerHTML = `<label>${label}</label>`;
          const input = document.createElement("input");
          input.type = "time";
          input.value = state.reminders[kind];
          input.onchange = async () => {
            if (!parseReminderTime(input.value)) { input.value = state.reminders[kind]; return; }
            state.reminders[kind] = input.value;
            saveState();
            await syncReminders();
          };
          field.appendChild(input);
          reminderBox.appendChild(field);
        });
      }
    };
    drawReminders();
  }
  body.appendChild(settingsSection);

  // History section — only worth showing once at least one week has closed.
  const weeks = weekHistory();
  if (weeks.length) {
    const historySection = el("div");
    historySection.appendChild(el("div", "section-title", "Tidigare veckor"));
    weeks.forEach(week => {
      const row = el("div", "list-row history-row");
      const label = el("div", "label", formatWeekRange(week.start, week.end));
      row.appendChild(label);
      const totalsEl = el("div", "history-totals");
      if (Object.keys(week.totals).length === 0) {
        totalsEl.appendChild(el("span", "history-empty", "Inget denna vecka"));
      } else {
        state.kids.forEach(kid => {
          const amount = week.totals[kid.id];
          if (!amount) return;
          const chip = el("span", "history-chip");
          chip.style.background = kid.color;
          chip.textContent = `${kid.name}: ${amount} ${state.currencySymbol}`;
          totalsEl.appendChild(chip);
        });
      }
      row.appendChild(totalsEl);
      historySection.appendChild(row);
    });
    body.appendChild(historySection);
  }

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
