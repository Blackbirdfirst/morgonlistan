// ---------- Storage ----------

const DEFAULT_TASKS = [
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
  { id: "e4", name: "Pyjamas", emoji: "🩱" },
  { id: "e5", name: "Sängen", emoji: "🛏️" },
];

// Evening list shows 18:00-03:59; morning list shows 04:00-17:59.
const EVENING_START_HOUR = 18;
const MORNING_START_HOUR = 4;

// A small curated palette. Every other color used on a kid's card (done-state,
// checkmarks, celebration gradient) is derived from whichever of these is picked,
// so the whole card always stays internally color-harmonized.
const KID_COLORS = [
  "#F0605A", // red
  "#F58220", // orange
  "#E0A400", // amber
  "#3FAE58", // green
  "#3D8BF2", // blue
  "#8B5CF6", // purple
];

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

async function saveState() {
  if (!currentUserId) return;
  const { error } = await supabaseClient
    .from("families")
    .update({ state, updated_at: new Date().toISOString() })
    .eq("id", currentUserId);
  if (error) console.error("Kunde inte spara:", error);
}

async function bootstrapApp(userId) {
  currentUserId = userId;
  state = await fetchFamilyState(userId);
  render();
}

function showLoginScreen() {
  app.innerHTML = "";
  app.appendChild(renderLoginScreen());
}

function renderLoginScreen() {
  const wrap = el("div", "screen onboard-wrap");
  wrap.innerHTML = `
    <div class="big-emoji">🍬</div>
    <div class="home-title">Morgonlistan</div>
    <div>Ange din e-postadress för att logga in eller skapa ett konto.</div>
  `;

  const field = el("div", "field");
  field.innerHTML = `<label>E-post</label>`;
  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.placeholder = "din@epost.se";
  emailInput.autocomplete = "email";
  field.appendChild(emailInput);
  wrap.appendChild(field);

  const errorEl = el("div", "field-error", "Något gick fel. Försök igen.");
  errorEl.style.display = "none";
  wrap.appendChild(errorEl);

  const btn = el("button", "primary-btn", "Skicka inloggningslänk");
  btn.onclick = async () => {
    const email = emailInput.value.trim();
    if (!email) { emailInput.focus(); return; }
    errorEl.style.display = "none";
    btn.disabled = true;
    btn.textContent = "Skickar...";
    const { error } = await supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    });
    if (error) {
      errorEl.style.display = "block";
      btn.disabled = false;
      btn.textContent = "Skicka inloggningslänk";
      return;
    }
    wrap.innerHTML = `
      <div class="big-emoji">📬</div>
      <div class="home-title">Kolla din inkorg!</div>
      <div>Vi har skickat en inloggningslänk till ${escapeHtml(email)}.</div>
    `;
  };
  wrap.appendChild(btn);

  setTimeout(() => emailInput.focus(), 50);
  return wrap;
}

async function initAuth() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    await bootstrapApp(session.user.id);
  } else {
    showLoginScreen();
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_IN" && session && session.user.id !== currentUserId) {
      bootstrapApp(session.user.id);
    } else if (event === "SIGNED_OUT") {
      currentUserId = null;
      state = null;
      showLoginScreen();
    }
  });
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
// Every kid picks one base color; everything else (done-state tint, checkmark
// accent, celebration gradient) is derived from that same hue so it always
// stays harmonized, instead of mixing in independent hardcoded colors.

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
    doneAccent: shade(Math.min(s + 8, 90), 42),
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
