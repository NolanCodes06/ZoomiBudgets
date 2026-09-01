// ======================================================================
// ZoomiBudgets - PRELAUNCH GAMIFIED BUILD
// "Budgeting as a Video Game for College Students"
//
// This file powers:
// - Login / accounts (per-user data in localStorage)
// - Dashboard (big picture, XP, streak, high-level stats)
// - Budget (planned vs actual, expense logging)
// - Survey (first-time setup, auto-plan builder)
// - Categories, Subscriptions, Classes, Emergency fund
// - Home (daily check-ins)
// - Achievements + Gamified systems (XP, Level, Challenges, Streak)
//
// Everything is *per account* and stored in localStorage only.
// No banking connections, no real servers - safe sandbox.
// ======================================================================

// ----------------------------- Storage Keys ---------------------------

const STORAGE_KEYS = {
  USERS: "zoomi.prelaunch.users",
  CURRENT: "zoomi.prelaunch.currentUser",
  THEME: "zoomi.prelaunch.theme",
  PRIVACY: "zoomi.prelaunch.privacy"
};

// ----------------------------- DOM Helpers ----------------------------

const qs = (sel, root = document) => root.querySelector(sel);
const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const fmtCurrency = (num) =>
  `$${(Number(num) || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const todayISO = () => new Date().toISOString().slice(0, 10);
const uuid = () =>
  crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();

// Safe JSON read/write
function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ----------------------------- User Model -----------------------------

// Load all users from localStorage
function loadUsers() {
  return readJSON(STORAGE_KEYS.USERS, {});
}

// Save all users
function saveUsers(users) {
  writeJSON(STORAGE_KEYS.USERS, users);
}

// Get / set current username (string only)
function currentUserName() {
  return localStorage.getItem(STORAGE_KEYS.CURRENT) || null;
}

function setCurrentUser(name) {
  if (!name) {
    localStorage.removeItem(STORAGE_KEYS.CURRENT);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.CURRENT, name);
}

// Base data model for a new user
function defaultUserState(username) {
  return {
    username,
    createdAt: Date.now(),

    // ---------- Core Money Data ----------
    survey: null,             // first-time survey answers / preferences
    monthlyIncome: 0,
    planned: {},              // planned budget per category
    categories: {},           // { [category]: { color, isDefault } }
    transactions: [],         // { id, date, category, name, amount, tag, createdAt }
    subscriptions: [],        // { id, name, cost, cycle, nextRenewal }
    classes: [],              // { id, name, textbook, supplies, other }
    emergency: {              // emergency fund target
      monthlyCost: 0,
      months: 3,
      goal: 0
    },

    // ---------- Goals / Meta ----------
    goals: [],                // (optional future use)

    // ---------- Gamification ----------
    xp: 0,                    // experience points
    level: 1,                 // player level
    streak: 0,                // consecutive-day check-ins
    lastCheckinDate: null,    // last date (yyyy-mm-dd) of daily check-in
    achievements: {},         // achievements unlocked
    // Daily & weekly challenges:
    // daily: { date, logExpenseCount, targetLog, completed }
    // weekly: { weekKey, wantsSpending, wantsLimit, completed }
    challenges: {
      daily: null,
      weekly: null
    },

    // ---------- Reflection ----------
    checkins: [],             // { date, stress, note }

    // Onboarding
    onboardingDone: false
  };
}

// Get full state of current user (or null if none)
function getUserState() {
  const uname = currentUserName();
  if (!uname) return null;
  const users = loadUsers();
  if (!users[uname]) {
    users[uname] = defaultUserState(uname);
    saveUsers(users);
  }
  return users[uname];
}

// Replace one user's state
function saveUserState(state) {
  const users = loadUsers();
  users[state.username] = state;
  saveUsers(users);
}

// Mutate user state with a function that returns an updated state
function updateUserState(mutator) {
  const state = getUserState();
  if (!state) return;
  const clone = structuredClone(state);
  const updated = mutator(clone);
  if (!updated) return;
  saveUserState(updated);
}

// ----------------------------- Theme / Privacy -----------------------

function initThemeAndPrivacy() {
  const storedTheme = localStorage.getItem(STORAGE_KEYS.THEME);
  const storedPrivacy = localStorage.getItem(STORAGE_KEYS.PRIVACY);

  // Theme default = dark
  if (storedTheme === "light" || storedTheme === "dark") {
    document.documentElement.setAttribute("data-theme", storedTheme);
  } else {
    document.documentElement.setAttribute("data-theme", "dark");
  }

  // Privacy blur default = off
  if (storedPrivacy === "on") {
    document.documentElement.setAttribute("data-privacy", "on");
  } else {
    document.documentElement.setAttribute("data-privacy", "off");
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem(STORAGE_KEYS.THEME, next);
}

function togglePrivacy() {
  const current = document.documentElement.getAttribute("data-privacy") || "off";
  const next = current === "off" ? "on" : "off";
  document.documentElement.setAttribute("data-privacy", next);
  localStorage.setItem(STORAGE_KEYS.PRIVACY, next);
}

// ----------------------------- Auth Logic ----------------------------

// Hash password for per-account sign-in (no plaintext storage)
async function hashPassword(text) {
  try {
    if (window.isSecureContext && crypto?.subtle) {
      const enc = new TextEncoder().encode(text);
      const buf = await crypto.subtle.digest("SHA-256", enc);
      return [...new Uint8Array(buf)]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch (e) {
    console.warn("WebCrypto digest failed, using fallback.", e);
  }
  // Fallback (not cryptographically strong - demo only)
  let h = 5381;
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h) + text.charCodeAt(i);
    h >>>= 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

async function handleRegister() {
  const form = qs("#login-form");
  const msg = qs("#authMsg");
  if (!form || !msg) return;

  const username = (form.username.value || "").trim();
  const password = form.password.value || "";

  if (!username || !password) {
    msg.textContent = "Enter a username and password.";
    return;
  }
  if (password.length < 6) {
    msg.textContent = "Password should be at least 6 characters.";
    return;
  }

  const users = loadUsers();
  if (users[username] && users[username].passHash) {
    msg.textContent = "That username already exists. Try signing in.";
    return;
  }

  const state = users[username] || defaultUserState(username);
  state.passHash = await hashPassword(password);
  users[username] = state;
  saveUsers(users);
  setCurrentUser(username);

  msg.textContent = "Account created! Loading your new save file...";
  setTimeout(() => {
    location.href = "index.html";
  }, 350);
}

async function handleLogin() {
  const form = qs("#login-form");
  const msg = qs("#authMsg");
  if (!form || !msg) return;

  const username = (form.username.value || "").trim();
  const password = form.password.value || "";

  if (!username || !password) {
    msg.textContent = "Enter a username and password.";
    return;
  }

  const users = loadUsers();
  const user = users[username];
  if (!user || !user.passHash) {
    msg.textContent = "Account not found. Try creating one.";
    return;
  }

  const passHash = await hashPassword(password);
  if (passHash !== user.passHash) {
    msg.textContent = "Incorrect password.";
    return;
  }

  setCurrentUser(username);
  msg.textContent = "Signed in. Loading your progress...";
  setTimeout(() => {
    location.href = "index.html";
  }, 300);
}

// Redirect any non-login page if user not signed in
function requireAuthForPage() {
  const page = pageName();
  if (page === "login.html") return;
  if (!currentUserName()) {
    location.href = "login.html";
  }
}

// ----------------------------- Page / Nav ----------------------------

function pageName() {
  const path = location.pathname.split("/").pop() || "index.html";
  return path || "index.html";
}

function buildSidebar() {
  const sidebar = qs("#sidebar");
  if (!sidebar) return;
  sidebar.innerHTML = "";

  const username = currentUserName() || "Guest";
  const state = getUserState();

  // HEADER (user info + XP)
  const header = document.createElement("div");
  header.className = "sidebar-header";
  const level = state?.level ?? 1;
  const xp = state?.xp ?? 0;
  const xpForNext = xpNeededForLevel(level + 1);
  const xpForCurrent = xpNeededForLevel(level);
  const progress =
    xpForNext > xpForCurrent
      ? clamp(((xp - xpForCurrent) / (xpForNext - xpForCurrent)) * 100, 0, 100)
      : 0;

  header.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:.6rem;margin-bottom:.7rem;">
      <div style="display:flex;flex-direction:column;gap:.2rem;">
        <span style="font-size:.78rem;color:var(--text-soft);text-transform:uppercase;letter-spacing:.08em;">Player</span>
        <span id="userPill" style="font-size:.95rem;font-weight:600;">${username}</span>
        <span style="font-size:.78rem;color:var(--text-muted);">Level ${level} · ${xp} XP</span>
        <div style="width:100%;height:4px;border-radius:999px;background:rgba(15,23,42,.8);overflow:hidden;">
          <div style="width:${progress}%;height:100%;background:linear-gradient(90deg,#22c55e,#38bdf8);"></div>
        </div>
      </div>
      <button type="button" class="btn btn-sm subtle" id="logoutBtn">Log out</button>
    </div>
  `;
  sidebar.appendChild(header);

  // NAV GROUPS
  const nav = document.createElement("nav");
  nav.className = "sidebar-nav";
  const current = pageName();

  const groups = [
    {
      label: "Core",
      links: [
        { href: "index.html", label: "Home" },
        { href: "dashboard.html", label: "Dashboard" },
        { href: "budget.html", label: "Budget" },
        { href: "survey.html", label: "Survey" }
      ]
    },
    {
      label: "Details",
      links: [
        { href: "categories.html", label: "Categories" },
        { href: "subscriptions.html", label: "Subscriptions" },
        { href: "classes.html", label: "Class Costs" },
        { href: "emergency.html", label: "Emergency Fund" }
      ]
    },
    {
      label: "Support",
      links: [
        { href: "aid.html", label: "Resources & Aid" },
        { href: "broke.html", label: "Broke Student Mode" },
        { href: "achievements.html", label: "Achievements" }
      ]
    }
  ];

  groups.forEach(group => {
    const h = document.createElement("div");
    h.style.cssText =
      "font-size:.75rem;color:var(--text-soft);letter-spacing:.12em;text-transform:uppercase;margin:.35rem 0 .15rem .1rem;";
    h.textContent = group.label;
    nav.appendChild(h);

    group.links.forEach(link => {
      const a = document.createElement("a");
      a.href = link.href;
      a.textContent = link.label;
      if (current === link.href) a.classList.add("active");
      nav.appendChild(a);
    });
  });

  sidebar.appendChild(nav);

  // FOOTER / SETTINGS
  const footer = document.createElement("div");
  footer.style.cssText =
    "margin-top:auto;padding-top:.7rem;border-top:1px solid rgba(148,163,184,.35);display:flex;flex-direction:column;gap:.4rem;";
  footer.innerHTML = `
    <div style="display:flex;gap:.4rem;flex-wrap:wrap;">
      <button type="button" class="btn btn-sm subtle" id="themeToggleBtn">Theme</button>
      <button type="button" class="btn btn-sm subtle" id="privacyToggleBtn">Blur money</button>
    </div>
    <button type="button" class="btn btn-sm danger" id="clearAllBtn">Clear app data</button>
    <p class="subtitle" style="margin-top:.2rem;font-size:.78rem;">
      Your data lives in this browser only. No banks. No servers.
    </p>
  `;
  sidebar.appendChild(footer);

  // Hook up interactions
  qs("#logoutBtn", sidebar)?.addEventListener("click", () => {
    setCurrentUser(null);
    location.href = "login.html";
  });
  qs("#themeToggleBtn", sidebar)?.addEventListener("click", toggleTheme);
  qs("#privacyToggleBtn", sidebar)?.addEventListener("click", togglePrivacy);
  qs("#clearAllBtn", sidebar)?.addEventListener("click", () => {
    if (!confirm("Clear all ZoomiBudgets data on this device?")) return;
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT);
    localStorage.removeItem(STORAGE_KEYS.THEME);
    localStorage.removeItem(STORAGE_KEYS.PRIVACY);
    location.href = "login.html";
  });
}

// mobile toggle
function initMenuToggle() {
  const toggle = qs(".menu-toggle");
  const sidebar = qs("#sidebar");
  if (!toggle || !sidebar) return;
  toggle.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

// --------------------------- XP & Level System -----------------------
//
// XP = your experience points from doing "good money moves".
// Level = your "budget level" (soft flex, no pressure).
//
// XP events (examples):
// - Complete survey: +100 XP
// - Log first expense: +50 XP
// - Log any expense: +10 XP
// - Hit daily streak > 3: bonus XP
// - Set emergency fund: +40 XP
// - Complete daily challenge: +75 XP
// - Complete weekly challenge: +150 XP
// --------------------------------------------------------------------

function xpNeededForLevel(level) {
  // simple quadratic-like curve: grows +100 * level^1.3
  return Math.floor(100 * Math.pow(level, 1.3));
}

function grantXP(state, amount, reason) {
  if (!amount || amount <= 0) return state;
  let s = state;
  s.xp = (s.xp || 0) + amount;
  // Check for level up
  let leveled = false;
  while (s.xp >= xpNeededForLevel(s.level + 1)) {
    s.level += 1;
    leveled = true;
  }

  // If there's a place to show last event, we could store it here.
  // For now we just keep it server-side and show on dashboard summary.
  s.lastXpEvent = {
    amount,
    reason,
    at: Date.now()
  };

  if (leveled) {
    s.lastLevelUpAt = Date.now();
  }
  return s;
}

// ------------------------------ Achievements -------------------------

// Static definitions for achievements.
// "check" functions evaluate based on current user state.
const ACHIEVEMENT_DEFS = [
  {
    id: "first-expense",
    name: "First Step",
    desc: "Logged your first expense.",
    check: (s) => (s.transactions || []).length >= 1
  },
  {
    id: "ten-expenses",
    name: "You're Actually Doing It",
    desc: "Logged 10 or more expenses.",
    check: (s) => (s.transactions || []).length >= 10
  },
  {
    id: "full-month",
    name: "Thirty Days of Reality",
    desc: "Logged expenses spanning at least 30 days.",
    check: (s) => {
      if (!(s.transactions || []).length) return false;
      const dates = s.transactions.map((t) => new Date(t.date));
      const min = Math.min(...dates);
      const max = Math.max(...dates);
      return (max - min) / (1000 * 60 * 60 * 24) >= 30;
    }
  },
  {
    id: "emergency-set",
    name: "Safety Net Architect",
    desc: "Created an emergency fund goal.",
    check: (s) => (s.emergency?.goal || 0) > 0
  },
  {
    id: "survey-done",
    name: "Know Thyself",
    desc: "Completed the starter survey once.",
    check: (s) => !!s.survey
  },
  {
    id: "streak-3",
    name: "Three Days In a Row",
    desc: "Checked in for 3 consecutive days.",
    check: (s) => (s.streak || 0) >= 3
  },
  {
    id: "streak-7",
    name: "One Week Consistent",
    desc: "Checked in for 7 consecutive days.",
    check: (s) => (s.streak || 0) >= 7
  }
];

// Evaluate & update achievements; grant XP when newly unlocked
function evalAchievements() {
  let state = getUserState();
  if (!state) return;
  const now = Date.now();
  const results = { ...(state.achievements || {}) };

  ACHIEVEMENT_DEFS.forEach((def) => {
    const unlocked = !!def.check(state);
    if (unlocked && !results[def.id]) {
      results[def.id] = { unlocked: true, unlockedAt: now };
      // Achievement XP bonus
      state = grantXP(state, 80, `Achievement unlocked: ${def.name}`);
    }
  });

  state.achievements = results;
  saveUserState(state);
}

function renderAchievements() {
  let state = getUserState();
  if (!state) return;
  evalAchievements();
  state = getUserState();

  const summaryEl = qs("#achievements-summary");
  const listEl = qs("#achievements-list");
  const unlockedIds = Object.keys(state.achievements || {}).filter(
    (id) => state.achievements[id]?.unlocked
  );

  if (summaryEl) {
    summaryEl.innerHTML = `
      <p class="subtitle">
        You've unlocked <strong>${unlockedIds.length}</strong> of <strong>${ACHIEVEMENT_DEFS.length}</strong> achievements so far.
      </p>
    `;
  }

  if (listEl) {
    listEl.innerHTML = "";
    ACHIEVEMENT_DEFS.forEach((def) => {
      const unlocked = !!state.achievements?.[def.id]?.unlocked;
      const item = document.createElement("div");
      item.className = "achievement-item";
      item.innerHTML = `
        <header>
          <span class="achievement-title">${def.name}</span>
          <span class="achievement-badge ${unlocked ? "" : "locked"}">
            ${unlocked ? "Unlocked" : "Locked"}
          </span>
        </header>
        <p class="subtitle" style="margin-top:.3rem;">${def.desc}</p>
      `;
      listEl.appendChild(item);
    });
  }
}

// ----------------------------- Challenges ----------------------------
//
// Daily Challenge Example:
// - "Log 3 expenses today"
//
// Weekly Challenge Example:
// - "Keep wants below 30% of your spending this week"
//
// Stored in state.challenges.daily / weekly
// ---------------------------------------------------------------------

function currentWeekKey() {
  const now = new Date();
  const year = now.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const week = Math.ceil(((now - oneJan) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${year}-W${week}`;
}

function ensureDailyChallenge(state) {
  const today = todayISO();
  const daily = state.challenges?.daily;
  if (daily && daily.date === today) return state;

  // New daily challenge
  state.challenges.daily = {
    date: today,
    logExpenseCount: 0,
    targetLog: 3,
    completed: false
  };
  return state;
}

function ensureWeeklyChallenge(state) {
  const key = currentWeekKey();
  const weekly = state.challenges?.weekly;
  if (weekly && weekly.weekKey === key) return state;

  state.challenges.weekly = {
    weekKey: key,
    wantsSpending: 0,
    wantsLimitRatio: 0.3, // wants <= 30% of total spending
    completed: false
  };
  return state;
}

// Update challenge stats on key events
function registerExpenseForChallenges(state, tx) {
  const today = todayISO();
  state = ensureDailyChallenge(state);
  state = ensureWeeklyChallenge(state);

  // daily: count logged expenses
  if (state.challenges.daily.date === today && !state.challenges.daily.completed) {
    state.challenges.daily.logExpenseCount += 1;
    if (state.challenges.daily.logExpenseCount >= state.challenges.daily.targetLog) {
      state.challenges.daily.completed = true;
      state = grantXP(state, 75, "Daily Challenge: Logged 3 expenses");
    }
  }

  // weekly: track wants spending
  if (tx.tag === "want") {
    state.challenges.weekly.wantsSpending += Number(tx.amount) || 0;
  }

  return state;
}

// Weekly check: call when rendering dashboard
function evaluateWeeklyChallenge(state) {
  state = ensureWeeklyChallenge(state);
  const tx = state.transactions || [];

  const weekKey = currentWeekKey();
  if (state.challenges.weekly.weekKey !== weekKey) {
    // If week changed, new weekly challenge will be created on next call.
    return ensureWeeklyChallenge(state);
  }

  // compute this week's total & wants
  const now = new Date();
  const oneJan = new Date(now.getFullYear(), 0, 1);
  const currentWeek = Math.ceil(
    ((now - oneJan) / 86400000 + oneJan.getDay() + 1) / 7
  );

  const weeklyTx = tx.filter((t) => {
    const d = new Date(t.date);
    const yr = d.getFullYear();
    if (yr !== now.getFullYear()) return false;
    const week = Math.ceil(
      ((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7
    );
    return week === currentWeek;
  });

  const total = weeklyTx.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const wants = weeklyTx
    .filter((t) => t.tag === "want")
    .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const ratio = total > 0 ? wants / total : 0;

  state.challenges.weekly.wantsSpending = wants;

  if (!state.challenges.weekly.completed && total > 0) {
    if (ratio <= state.challenges.weekly.wantsLimitRatio) {
      state.challenges.weekly.completed = true;
      state = grantXP(state, 150, "Weekly Challenge: Kept wants in check");
    }
  }
  return state;
}

function renderChallengesSummary() {
  let state = getUserState();
  if (!state) return;

  state = ensureDailyChallenge(state);
  state = ensureWeeklyChallenge(state);
  state = evaluateWeeklyChallenge(state);
  saveUserState(state);

  const dailyEl = qs("#dailyChallengeSummary");
  const weeklyEl = qs("#weeklyChallengeSummary");

  if (dailyEl) {
    const d = state.challenges.daily;
    const remaining = clamp(d.targetLog - d.logExpenseCount, 0, d.targetLog);
    dailyEl.innerHTML = d.completed
      ? `<p class="subtitle">Daily challenge: <strong>COMPLETE ✅</strong><br>Nice. You logged at least ${d.targetLog} expenses today.</p>`
      : `<p class="subtitle">Daily challenge: <strong>Log ${d.targetLog} expenses today</strong><br>You've logged ${d.logExpenseCount}. ${remaining} to go.</p>`;
  }

  if (weeklyEl) {
    const w = state.challenges.weekly;
    const tx = state.transactions || [];
    const now = new Date();
    const oneJan = new Date(now.getFullYear(), 0, 1);
    const currentWeek = Math.ceil(
      ((now - oneJan) / 86400000 + oneJan.getDay() + 1) / 7
    );
    const weeklyTx = tx.filter((t) => {
      const d = new Date(t.date);
      const yr = d.getFullYear();
      if (yr !== now.getFullYear()) return false;
      const week = Math.ceil(
        ((d - oneJan) / 86400000 + oneJan.getDay() + 1) / 7
      );
      return week === currentWeek;
    });
    const total = weeklyTx.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const wants = weeklyTx
      .filter((t) => t.tag === "want")
      .reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const ratio = total > 0 ? wants / total : 0;
    const pct = total > 0 ? (ratio * 100).toFixed(1) : "0";

    weeklyEl.innerHTML = w.completed
      ? `<p class="subtitle">Weekly challenge: <strong>COMPLETE ✅</strong><br>Your "wants" stayed under ${Math.round(
          w.wantsLimitRatio * 100
        )}% of your spending this week.</p>`
      : `<p class="subtitle">Weekly challenge: Keep "wants" at or below <strong>${Math.round(
          w.wantsLimitRatio * 100
        )}%</strong> of your spending this week.<br>Right now you're at about ${pct}%.</p>`;
  }
}

// ----------------------------- Helpers for Stats ---------------------

function sum(arr) {
  return arr.reduce((a, b) => a + (Number(b) || 0), 0);
}

function monthlySubCost(subs) {
  let total = 0;
  subs.forEach((sub) => {
    const cost = Number(sub.cost) || 0;
    if (sub.cycle === "monthly") total += cost;
    else if (sub.cycle === "yearly") total += cost / 12;
    else if (sub.cycle === "semester") total += cost / 4;
  });
  return total;
}

function semesterClassTotal(classes) {
  return classes.reduce((acc, c) => {
    return (
      acc +
      (Number(c.textbook) || 0) +
      (Number(c.supplies) || 0) +
      (Number(c.other) || 0)
    );
  }, 0);
}

function computeNeedsWants(transactions) {
  let needs = 0,
    wants = 0,
    mixed = 0;
  transactions.forEach((t) => {
    const amt = Number(t.amount) || 0;
    if (t.tag === "need") needs += amt;
    else if (t.tag === "want") wants += amt;
    else mixed += amt;
  });
  const total = needs + wants + mixed;
  const pct = (v) => (total ? clamp((v / total) * 100, 0, 999) : 0);
  return {
    needs,
    wants,
    mixed,
    total,
    pNeeds: pct(needs),
    pWants: pct(wants),
    pMixed: pct(mixed)
  };
}

function computeSpendingByCategory(transactions) {
  const map = new Map();
  transactions.forEach((t) => {
    const key = t.category || "Uncategorized";
    const previous = map.get(key) || 0;
    map.set(key, previous + (Number(t.amount) || 0));
  });
  return map;
}

// ----------------------------- Dashboard -----------------------------

function initDashboardPage() {
  let state = getUserState();
  if (!state) return;

  // Evaluate gamification pieces
  state = evaluateWeeklyChallenge(state);
  saveUserState(state);
  evalAchievements();

  state = getUserState(); // refresh after potential XP/ach changes

  // Tip
  const tip = qs("#dashboardTip");
  if (tip) {
    tip.textContent =
      "Think of this as your mini command center. If the net goes negative for months in a row, it's time to tweak the plan.";
  }

  const income = Number(state.monthlyIncome || 0);
  const tx = state.transactions || [];
  const subsMonthly = monthlySubCost(state.subscriptions || []);
  const nonSubExpenses = tx.reduce(
    (acc, t) => acc + (Number(t.amount) || 0),
    0
  );
  const totalExpenses = nonSubExpenses + subsMonthly;
  const net = income - totalExpenses;
  const savingsRate =
    income > 0 ? clamp((net / income) * 100, -999, 999) : 0;

  // Summary fields
  qs("#dashTotalIncome") &&
    (qs("#dashTotalIncome").textContent = fmtCurrency(income));
  qs("#dashTotalExpenses") &&
    (qs("#dashTotalExpenses").textContent = fmtCurrency(totalExpenses));
  qs("#dashNetBalance") &&
    (qs("#dashNetBalance").textContent = fmtCurrency(net));
  qs("#dashSavingsRate") &&
    (qs("#dashSavingsRate").textContent = `${savingsRate.toFixed(1)}%`);

  // Needs vs wants
  const nw = computeNeedsWants(tx);
  const nwEl = qs("#dashNeedsWants");
  if (nwEl) {
    if (!nw.total) {
      nwEl.textContent =
        "No expenses yet. Track a few days to see your Needs vs Wants split.";
    } else {
      nwEl.textContent = `Needs: ${nw.pNeeds.toFixed(
        0
      )}% • Wants: ${nw.pWants.toFixed(0)}% • Mixed: ${nw.pMixed.toFixed(
        0
      )}%`;
    }
  }

  // Emergency + semester + subs summary
  const em = state.emergency || { monthlyCost: 0, months: 3, goal: 0 };
  const emGoal = Number(em.goal || 0);
  let emSaved = 0;
  tx.forEach((t) => {
    if ((t.category || "").toLowerCase().includes("emergency")) {
      emSaved += Number(t.amount) || 0;
    }
  });
  const emPct = emGoal > 0 ? clamp((emSaved / emGoal) * 100, 0, 999) : 0;

  const semTotal = semesterClassTotal(state.classes || []);

  qs("#dashEmergencyGoal") &&
    (qs("#dashEmergencyGoal").textContent = fmtCurrency(emGoal));
  qs("#dashEmergencySaved") &&
    (qs("#dashEmergencySaved").textContent = fmtCurrency(emSaved));
  qs("#dashEmergencyPercent") &&
    (qs("#dashEmergencyPercent").textContent = `${emPct.toFixed(1)}%`);
  qs("#dashSemesterTotal") &&
    (qs("#dashSemesterTotal").textContent = fmtCurrency(semTotal));
  qs("#dashSubsMonthly") &&
    (qs("#dashSubsMonthly").textContent = fmtCurrency(subsMonthly));

  // XP / Level summary on dashboard
  const xpBox = qs("#dashXPOverview");
  if (xpBox) {
    const nextLevelXP = xpNeededForLevel(state.level + 1);
    const thisLevelXP = xpNeededForLevel(state.level);
    const progress =
      nextLevelXP > thisLevelXP
        ? clamp(
            ((state.xp - thisLevelXP) / (nextLevelXP - thisLevelXP)) * 100,
            0,
            100
          )
        : 0;
    xpBox.innerHTML = `
      <p>You're level <strong>${state.level}</strong> with <strong>${state.xp} XP</strong>.</p>
      <p class="subtitle">About ${Math.max(
        0,
        nextLevelXP - state.xp
      )} XP until the next level.</p>
      <div style="margin-top:.4rem;width:100%;height:6px;border-radius:999px;background:rgba(15,23,42,.9);overflow:hidden;">
        <div style="width:${progress}%;height:100%;background:linear-gradient(90deg,#22c55e,#38bdf8);"></div>
      </div>
      ${
        state.lastXpEvent
          ? `<p class="subtitle" style="margin-top:.3rem;">Last XP gain: +${state.lastXpEvent.amount} for "${state.lastXpEvent.reason}".</p>`
          : ""
      }
    `;
  }

  // Gamified daily & weekly challenges
  renderChallengesSummary();

  // Chart: spending by category
  renderSpendingPieChart(state);

  // Cashflow
  renderCashflowCalendar(state);

  // What-if simulator
  initWhatIfSimulator(state, income, totalExpenses);

  // Exports & achievements blurbs
  initExportsAndAchievements();
}

function renderSpendingPieChart(state) {
  const canvas = qs("#pieChart");
  if (!canvas || typeof Chart === "undefined") return;

  const spending = computeSpendingByCategory(state.transactions || []);
  const labels = Array.from(spending.keys());
  const data = Array.from(spending.values());

  if (!labels.length) {
    const container = qs("#chartContainer");
    if (container) {
      container.innerHTML =
        `<p class="subtitle">No spending yet. As soon as you log expenses, we'll show a category pie chart here.</p>`;
    }
    return;
  }

  const palette = [
    "#22c55e",
    "#38bdf8",
    "#f97316",
    "#eab308",
    "#a855f7",
    "#f43f5e",
    "#14b8a6",
    "#0ea5e9"
  ];

  const colors = labels.map((cat, i) => {
    const c = state.categories?.[cat]?.color;
    return c || palette[i % palette.length];
  });

  new Chart(canvas.getContext("2d"), {
    type: "pie",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: colors,
          borderColor: "#020617",
          borderWidth: 2
        }
      ]
    },
    options: {
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: getComputedStyle(document.documentElement).getPropertyValue(
              "--text-main"
            )
          }
        }
      }
    }
  });
}

function renderCashflowCalendar(state) {
  const container = qs("#dashCalendar");
  if (!container) return;

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const events = [];

  // Rent / housing approx on 1st if present
  if (state.planned) {
    for (const [cat, amt] of Object.entries(state.planned)) {
      if ((cat || "").toLowerCase().includes("rent") && amt > 0) {
        events.push({
          date: new Date(year, month, 1),
          label: `Rent: ${fmtCurrency(amt)}`
        });
      }
    }
  }

  // Subscriptions
  (state.subscriptions || []).forEach((sub) => {
    const cost = Number(sub.cost) || 0;
    if (!cost) return;
    if (sub.nextRenewal) {
      const d = new Date(sub.nextRenewal);
      if (d.getMonth() === month && d.getFullYear() === year) {
        events.push({
          date: d,
          label: `${sub.name} renewal: ${fmtCurrency(cost)} (${sub.cycle})`
        });
      }
    }
  });

  // Class costs as mid-month lumps
  (state.classes || []).forEach((c) => {
    const total =
      (Number(c.textbook) || 0) +
      (Number(c.supplies) || 0) +
      (Number(c.other) || 0);
    if (!total) return;
    events.push({
      date: new Date(year, month, 15),
      label: `${c.name} materials: ${fmtCurrency(total)}`
    });
  });

  if (!events.length) {
    container.innerHTML =
      '<p class="subtitle">No upcoming bills detected for this month. Add subscriptions, class costs, or rent to see them here.</p>';
    return;
  }

  events.sort((a, b) => a.date - b.date);

  const list = document.createElement("ul");
  list.className = "bulleted";
  events.forEach((e) => {
    const li = document.createElement("li");
    li.textContent = `${e.date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    })} - ${e.label}`;
    list.appendChild(li);
  });
  container.innerHTML = "";
  container.appendChild(list);
}

function initWhatIfSimulator(state, income, baseExpenses) {
  const cutInput = qs("#whatIfCutFood");
  const subSelect = qs("#whatIfCancelSub");
  const runBtn = qs("#whatIfRun");
  const out = qs("#whatIfOutput");
  if (!cutInput || !subSelect || !runBtn || !out) return;

  // Fill subscription dropdown
  subSelect.innerHTML = `<option value="">No subscription selected</option>`;
  (state.subscriptions || []).forEach((sub) => {
    const opt = document.createElement("option");
    opt.value = sub.id;
    opt.textContent = `${sub.name} (${fmtCurrency(sub.cost)} / ${sub.cycle})`;
    subSelect.appendChild(opt);
  });

  runBtn.addEventListener("click", () => {
    const cut = Number(cutInput.value) || 0;
    const subId = subSelect.value;
    let subMonthlySaved = 0;

    if (subId) {
      const sub = (state.subscriptions || []).find((s) => s.id === subId);
      if (sub) {
        const c = Number(sub.cost) || 0;
        if (sub.cycle === "monthly") subMonthlySaved = c;
        else if (sub.cycle === "yearly") subMonthlySaved = c / 12;
        else if (sub.cycle === "semester") subMonthlySaved = c / 4;
      }
    }

    const newExpenses = baseExpenses - cut - subMonthlySaved;
    const delta = baseExpenses - newExpenses;
    const newNet = income - newExpenses;

    out.innerHTML = `
      <p>You'd save about <strong>${fmtCurrency(delta)}</strong> per month.</p>
      <p>Your new estimated net would be <strong>${fmtCurrency(
        newNet
      )}</strong> / month.</p>
      <p class="subtitle" style="margin-top:.4rem;">This doesn't change your actual plan - it's just a sandbox to play with ideas.</p>
    `;
  });
}

function initExportsAndAchievements() {
  const expJsonBtn = qs("#exportJsonBtn");
  const expCsvBtn = qs("#exportCsvBtn");

  if (expJsonBtn) {
    expJsonBtn.addEventListener("click", () => {
      const state = getUserState();
      if (!state) return;
      const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: "application/json"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.username}_zoomi_data.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  if (expCsvBtn) {
    expCsvBtn.addEventListener("click", () => {
      const state = getUserState();
      if (!state) return;
      const rows = [
        ["date", "category", "description", "amount", "tag"].join(",")
      ];
      (state.transactions || []).forEach((t) => {
        rows.push(
          [
            t.date,
            JSON.stringify(t.category || ""),
            JSON.stringify(t.name || ""),
            Number(t.amount) || 0,
            t.tag || ""
          ].join(",")
        );
      });
      const blob = new Blob([rows.join("\n")], {
        type: "text/csv"
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${state.username}_transactions.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Achievements summary on dashboard
  const dashAch = qs("#dashAchievements");
  if (dashAch) {
    evalAchievements();
    const state = getUserState();
    const unlocked = Object.keys(state.achievements || {}).filter(
      (id) => state.achievements[id]?.unlocked
    );
    dashAch.innerHTML = `
      <p class="subtitle">You've unlocked <strong>${unlocked.length}</strong> of <strong>${ACHIEVEMENT_DEFS.length}</strong> achievements. Tap "Achievements" in the sidebar to see them.</p>
    `;
  }
}

// ----------------------------- Budget Page ---------------------------

function ensureCategory(state, name) {
  if (!name) return;
  if (!state.categories) state.categories = {};
  if (!state.categories[name]) {
    const colors = [
      "#22c55e",
      "#38bdf8",
      "#f97316",
      "#eab308",
      "#a855f7",
      "#f43f5e",
      "#14b8a6"
    ];
    const idx = Object.keys(state.categories).length % colors.length;
    state.categories[name] = { color: colors[idx], isDefault: false };
  }
}

function initBudgetPage() {
  let state = getUserState();
  if (!state) return;

  const tip = qs("#budgetTip");
  if (tip) {
    tip.textContent =
      `Think of your budget as assigning "roles" to your dollars before the month even starts.`;
  }

  // Planned amounts controls
  const planCategory = qs("#planCategory");
  const planAmount = qs("#planAmount");
  const planBtn = qs("#planAddBtn");

  // Expense logging controls
  const txCategorySelect = qs("#txCategorySelect");
  const txCategoryInput = qs("#txCategory");
  const txName = qs("#txName");
  const txAmount = qs("#txAmount");
  const txDate = qs("#txDate");
  const tagNeed = qs("#tagNeed");
  const tagWant = qs("#tagWant");
  const tagMixed = qs("#tagMixed");
  const txAddBtn = qs("#txAddBtn");
  const undoTxBtn = qs("#undoTxBtn");
  const summaryEl = qs("#budgetSummary");

  if (txDate && !txDate.value) txDate.value = todayISO();

  function refreshCategoryUI() {
    state = getUserState() || state;
    const allCats = new Set([
      ...Object.keys(state.planned || {}),
      ...Object.keys(state.categories || {}),
      ...state.transactions
        .map((t) => t.category || "")
        .filter(Boolean)
    ]);

    if (txCategorySelect) {
      const current = txCategorySelect.value;
      txCategorySelect.innerHTML = `<option value="">Select category...</option>`;
      allCats.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        txCategorySelect.appendChild(opt);
      });
      if (current && allCats.has(current)) txCategorySelect.value = current;
    }

    const datalist = qs("#categoryOptions");
    if (datalist) {
      datalist.innerHTML = "";
      allCats.forEach((cat) => {
        const opt = document.createElement("option");
        opt.value = cat;
        datalist.appendChild(opt);
      });
    }
  }

  // Save planned budget per category
  planBtn?.addEventListener("click", () => {
    const cat = (planCategory?.value || "").trim();
    const amt = Number(planAmount?.value || 0);
    if (!cat || !(amt > 0)) {
      alert("Enter a category and a positive planned amount.");
      return;
    }
    updateUserState((s) => {
      s.planned = s.planned || {};
      s.planned[cat] = amt;
      ensureCategory(s, cat);
      return s;
    });
    state = getUserState();
    planCategory.value = "";
    planAmount.value = "";
    refreshCategoryUI();
    renderBudgetSummary();
  });

  // Log an expense
  txAddBtn?.addEventListener("click", () => {
    const catFromSelect = txCategorySelect?.value || "";
    const catFromInput = (txCategoryInput?.value || "").trim();
    const category = catFromInput || catFromSelect;
    const name = (txName?.value || "").trim();
    const amt = Number(txAmount?.value || 0);
    const date = (txDate?.value || todayISO()) || todayISO();
    let tag = "mixed";
    if (tagNeed?.checked) tag = "need";
    else if (tagWant?.checked) tag = "want";

    if (!category || !(amt > 0)) {
      alert("Enter a positive amount and choose a category.");
      return;
    }

    updateUserState((s) => {
      ensureCategory(s, category);

      const tx = {
        id: uuid(),
        date,
        category,
        name,
        amount: amt,
        tag,
        createdAt: Date.now()
      };

      s.transactions = s.transactions || [];
      const beforeLen = s.transactions.length;

      s.transactions.push(tx);
      s = registerExpenseForChallenges(s, tx);

      // XP rules
      if (beforeLen === 0) {
        s = grantXP(s, 50, "Logged first expense");
      } else {
        s = grantXP(s, 10, "Logged an expense");
      }

      return s;
    });

    state = getUserState();
    txName.value = "";
    txAmount.value = "";
    txCategoryInput.value = "";
    if (txDate) txDate.value = todayISO();
    [tagNeed, tagWant, tagMixed].forEach((el) => el && (el.checked = false));
    refreshCategoryUI();
    renderBudgetSummary();
    evalAchievements();
  });

  // Undo last expense
  undoTxBtn?.addEventListener("click", () => {
    updateUserState((s) => {
      if (!s.transactions || !s.transactions.length) return s;
      s.transactions.pop();
      return s;
    });
    state = getUserState();
    renderBudgetSummary();
  });

  // Render summary card
  function renderBudgetSummary() {
    state = getUserState() || state;
    if (!summaryEl) return;
    const planned = state.planned || {};
    const actualMap = computeSpendingByCategory(state.transactions || []);
    const allCats = new Set([
      ...Object.keys(planned),
      ...Array.from(actualMap.keys())
    ]);

    if (!allCats.size) {
      summaryEl.innerHTML =
        '<p class="subtitle">No plan yet. Build a starter plan with the Survey, then tweak it here.</p>';
      return;
    }

    const container = document.createElement("div");
    container.className = "stats-grid";
    allCats.forEach((cat) => {
      const plannedVal = Number(planned[cat] || 0);
      const actualVal = Number(actualMap.get(cat) || 0);
      const diff = plannedVal - actualVal;
      const status =
        plannedVal === 0
          ? "No plan"
          : diff >= 0
          ? `Under by ${fmtCurrency(diff)}`
          : `Over by ${fmtCurrency(-diff)}`;

      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:.1rem;">
          <span><span class="color-dot" style="background:${state.categories?.[cat]?.color ||
            "#22c55e"}"></span> ${cat}</span>
          <span class="subtitle" style="font-size:.8rem;">Planned: ${fmtCurrency(
            plannedVal
          )} • Actual: ${fmtCurrency(actualVal)}</span>
        </div>
        <div style="font-size:.82rem;font-weight:600;">${status}</div>
      `;
      container.appendChild(item);
    });

    summaryEl.innerHTML = "";
    summaryEl.appendChild(container);
  }

  refreshCategoryUI();
  renderBudgetSummary();
}

// ----------------------------- Survey Page ---------------------------

function initSurveyPage() {
  const state = getUserState();
  if (!state) return;

  const form = qs("#survey-form");
  const out = qs("#survey-output");
  if (!form || !out) return;

  const tip = qs("#surveyTip");
  if (tip) {
    tip.textContent =
      "We'll use your answers to build a starter budget. You can change everything later.";
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const income = Number(form.income.value || 0);
    const rent = Number(form.rent.value || 0);
    const transport = Number(form.transport.value || 0);
    const foodLevel = form.food.value;
    const socialLevel = form.social.value;
    const subsLevel = form.subs.value;
    const saver = form.saver.value;
    const priority = form.priority.value;

    if (!(income > 0)) {
      alert("Please enter a positive estimated monthly income.");
      return;
    }

    // Baseline "envelopes" for categories (we'll fill them in)
    const base = {
      "Rent / Housing": rent || income * 0.35,
      Transportation: transport || income * 0.1,
      Food: 0,
      "Fun / Entertainment": 0,
      Subscriptions: 0,
      Savings: 0,
      "Emergency Fund": 0
    };

    // Food intensity
    if (foodLevel === "high") base["Food"] = income * 0.25;
    else if (foodLevel === "medium") base["Food"] = income * 0.18;
    else base["Food"] = income * 0.14;

    // Social
    if (socialLevel === "high") base["Fun / Entertainment"] = income * 0.18;
    else if (socialLevel === "medium")
      base["Fun / Entertainment"] = income * 0.12;
    else base["Fun / Entertainment"] = income * 0.07;

    // Subscriptions
    if (subsLevel === "none") base["Subscriptions"] = income * 0.03;
    else if (subsLevel === "few") base["Subscriptions"] = income * 0.06;
    else base["Subscriptions"] = income * 0.09;

    // Savings / emergency
    let savingsPct = 0.08;
    let emergencyPct = 0.06;
    if (saver === "yes") {
      savingsPct = 0.12;
      emergencyPct = 0.1;
    } else if (saver === "no") {
      savingsPct = 0.03;
      emergencyPct = 0.03;
    }

    if (priority === "emergency") emergencyPct += 0.04;
    else if (priority === "debt") savingsPct += 0.04;
    else if (priority === "fun") base["Fun / Entertainment"] += income * 0.03;

    base["Savings"] = income * savingsPct;
    base["Emergency Fund"] = income * emergencyPct;

    // Normalize so we don't exceed 100% of income
    let total = sum(Object.values(base));
    if (total > income) {
      const factor = income / total;
      Object.keys(base).forEach((k) => {
        base[k] = base[k] * factor;
      });
      total = income;
    }

    updateUserState((s) => {
      s.survey = {
        income,
        rent,
        transport,
        foodLevel,
        socialLevel,
        subsLevel,
        saver,
        priority,
        savedAt: Date.now()
      };
      s.monthlyIncome = income;
      s.planned = base;
      Object.keys(base).forEach((cat) => ensureCategory(s, cat));

      // XP for completing survey (first time)
      if (!s.achievements?.survey_done) {
        s = grantXP(s, 100, "Completed starter survey");
      }
      return s;
    });

    out.innerHTML = `
      <p>We built a starter plan from your answers:</p>
      <ul class="bulleted" style="margin-top:.4rem;">
        ${Object.entries(base)
          .map(
            ([cat, val]) =>
              `<li>${cat}: <strong>${fmtCurrency(val)}</strong></li>`
          )
          .join("")}
      </ul>
      <p class="subtitle" style="margin-top:.4rem;">Next step: visit the Budget page and customize anything that feels off.</p>
    `;

    evalAchievements();
  });
}

// ----------------------------- Categories Page -----------------------

function initCategoriesPage() {
  let state = getUserState();
  if (!state) return;
  const list = qs("#category-list");
  const addBtn = qs("#addCategoryBtn");
  const seedBtn = qs("#seedCategoriesBtn");
  const nameInput = qs("#catName");
  const colorInput = qs("#catColor");

  function render() {
    state = getUserState() || state;
    if (!list) return;
    const categories = state.categories || {};
    const names = Object.keys(categories);
    if (!names.length) {
      list.innerHTML =
        '<p class="subtitle">No categories yet. Add some or seed defaults.</p>';
      return;
    }
    const container = document.createElement("div");
    container.className = "stats-grid";
    names.forEach((name) => {
      const cat = categories[name];
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <div>
          <span class="color-dot" style="background:${cat.color}"></span>
          <span style="margin-left:.3rem;">${name}</span>
          ${
            cat.isDefault
              ? '<span class="subtitle" style="margin-left:.3rem;font-size:.78rem;">Default</span>'
              : ""
          }
        </div>
      `;
      container.appendChild(item);
    });
    list.innerHTML = "";
    list.appendChild(container);
  }

  addBtn?.addEventListener("click", () => {
    const name = (nameInput?.value || "").trim();
    const color = colorInput?.value || "#22c55e";
    if (!name) {
      alert("Enter a category name.");
      return;
    }
    updateUserState((s) => {
      s.categories = s.categories || {};
      s.categories[name] = { color, isDefault: false };
      return s;
    });
    state = getUserState();
    nameInput.value = "";
    render();
  });

  seedBtn?.addEventListener("click", () => {
    updateUserState((s) => {
      const defaults = [
        "Rent / Housing",
        "Food",
        "Transportation",
        "Fun / Entertainment",
        "Subscriptions",
        "Savings",
        "Emergency Fund",
        "Textbooks",
        "Supplies",
        "Health / Meds"
      ];
      s.categories = s.categories || {};
      const palette = [
        "#22c55e",
        "#38bdf8",
        "#f97316",
        "#eab308",
        "#a855f7",
        "#f43f5e",
        "#14b8a6",
        "#0ea5e9"
      ];
      defaults.forEach((name, idx) => {
        if (!s.categories[name]) {
          s.categories[name] = {
            color: palette[idx % palette.length],
            isDefault: true
          };
        }
      });
      return s;
    });
    state = getUserState();
    render();
  });

  render();
}

// ----------------------------- Subscriptions Page --------------------

function initSubscriptionsPage() {
  let state = getUserState();
  if (!state) return;

  const tip = qs("#subsTip");
  if (tip) {
    tip.textContent =
      "Each subscription is a tiny auto-pilot expense. Keep only the ones that are actually pulling their weight.";
  }

  const name = qs("#subName");
  const cost = qs("#subCost");
  const cycle = qs("#subCycle");
  const renew = qs("#subRenew");
  const addBtn = qs("#addSubBtn");
  const list = qs("#subscriptions-list");

  function render() {
    state = getUserState() || state;
    if (!list) return;
    const subs = state.subscriptions || [];
    if (!subs.length) {
      list.innerHTML =
        '<p class="subtitle">No subscriptions yet. Add streaming, apps, gym memberships, or anything that hits your card regularly.</p>';
      return;
    }
    const container = document.createElement("div");
    container.className = "stats-grid";
    subs.forEach((sub) => {
      const item = document.createElement("div");
      item.className = "list-item";
      const next = sub.nextRenewal
        ? new Date(sub.nextRenewal).toLocaleDateString()
        : "Not set";
      item.innerHTML = `
        <div>
          <div><strong>${sub.name}</strong></div>
          <div class="subtitle" style="font-size:.8rem;">${fmtCurrency(
            sub.cost
          )} • ${sub.cycle} • Next: ${next}</div>
        </div>
        <button type="button" class="btn btn-sm subtle" data-sub-id="${sub.id}">Remove</button>
      `;
      container.appendChild(item);
    });
    list.innerHTML = "";
    list.appendChild(container);

    qsa("button[data-sub-id]", list).forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-sub-id");
        updateUserState((s) => {
          s.subscriptions = (s.subscriptions || []).filter(
            (sub) => sub.id !== id
          );
          return s;
        });
        state = getUserState();
        render();
      });
    });
  }

  addBtn?.addEventListener("click", () => {
    const n = (name?.value || "").trim();
    const c = Number(cost?.value || 0);
    const cyc = cycle?.value || "monthly";
    const r = renew?.value || "";

    if (!n || !(c > 0)) {
      alert("Enter a valid subscription name and cost.");
      return;
    }
    updateUserState((s) => {
      s.subscriptions = s.subscriptions || [];
      s.subscriptions.push({
        id: uuid(),
        name: n,
        cost: c,
        cycle: cyc,
        nextRenewal: r
      });
      // small XP for building awareness
      s = grantXP(s, 15, "Tracked a subscription");
      return s;
    });
    state = getUserState();
    name.value = "";
    cost.value = "";
    if (renew) renew.value = "";
    render();
  });

  render();
}

// ----------------------------- Classes Page --------------------------

function initClassesPage() {
  let state = getUserState();
  if (!state) return;

  const name = qs("#className");
  const text = qs("#classText");
  const supplies = qs("#classSupplies");
  const other = qs("#classOther");
  const addBtn = qs("#addClassBtn");
  const list = qs("#classes-list");

  function render() {
    state = getUserState() || state;
    if (!list) return;
    const classes = state.classes || [];
    if (!classes.length) {
      list.innerHTML =
        '<p class="subtitle">No classes added yet. Add your courses to see what this semester really costs.</p>';
      return;
    }
    const container = document.createElement("div");
    container.className = "stats-grid";
    let total = 0;
    classes.forEach((c) => {
      const ct =
        (Number(c.textbook) || 0) +
        (Number(c.supplies) || 0) +
        (Number(c.other) || 0);
      total += ct;
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <div>
          <strong>${c.name}</strong>
          <div class="subtitle" style="font-size:.8rem;">
            Textbook: ${fmtCurrency(c.textbook)} • Supplies: ${fmtCurrency(
        c.supplies
      )} • Other: ${fmtCurrency(c.other)}<br>
            Total: ${fmtCurrency(ct)}
          </div>
        </div>
        <button type="button" class="btn btn-sm subtle" data-class-id="${c.id}">Remove</button>
      `;
      container.appendChild(item);
    });
    const footer = document.createElement("p");
    footer.className = "subtitle";
    footer.style.marginTop = ".6rem";
    footer.textContent = `Semester total: ${fmtCurrency(total)}`;
    list.innerHTML = "";
    list.appendChild(container);
    list.appendChild(footer);

    qsa("button[data-class-id]", list).forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-class-id");
        updateUserState((s) => {
          s.classes = (s.classes || []).filter((c) => c.id !== id);
          return s;
        });
        state = getUserState();
        render();
      });
    });
  }

  addBtn?.addEventListener("click", () => {
    const n = (name?.value || "").trim();
    const t = Number(text?.value || 0);
    const sup = Number(supplies?.value || 0);
    const o = Number(other?.value || 0);
    if (!n) {
      alert("Enter a course name.");
      return;
    }
    updateUserState((s) => {
      s.classes = s.classes || [];
      s.classes.push({
        id: uuid(),
        name: n,
        textbook: t,
        supplies: sup,
        other: o
      });
      return s;
    });
    state = getUserState();
    name.value = "";
    text.value = "";
    supplies.value = "";
    other.value = "";
    render();
  });

  render();
}

// ----------------------------- Emergency Page ------------------------

function initEmergencyPage() {
  let state = getUserState();
  if (!state) return;

  const cost = qs("#emCost");
  const months = qs("#emMonths");
  const calc = qs("#calcEmergency");
  const out = qs("#emergency-output");
  const tips = qs("#emergency-tips");
  const tipShort = qs("#emergencyTip");

  if (tipShort) {
    tipShort.textContent =
      "Even $50 between you and a crisis is better than $0. Start tiny, scale later.";
  }

  calc?.addEventListener("click", () => {
    const c = Number(cost?.value || 0);
    const m = Number(months?.value || 3);
    if (!(c > 0) || !(m > 0)) {
      alert("Enter a positive monthly cost and months of safety.");
      return;
    }
    const goal = c * m;
    updateUserState((s) => {
      s.emergency = { monthlyCost: c, months: m, goal };
      s = grantXP(s, 40, "Planned an emergency fund");
      return s;
    });
    state = getUserState();

    if (out) {
      out.innerHTML = `
        <p>Your emergency fund target is <strong>${fmtCurrency(goal)}</strong>.</p>
        <p class="subtitle" style="margin-top:.4rem;">Saving ${
          goal ? fmtCurrency(goal / 6) : "$0"
        } per month would get you there in about 6 months.</p>
      `;
    }

    if (tips) {
      tips.innerHTML = `
        <li>Keep your emergency fund a little inconvenient to access so you don't "accidentally" spend it.</li>
        <li>Send unexpected money here first: refunds, gifts, side-gig income.</li>
        <li>Emergency = things like car repair, sudden medical, job loss-not concert tickets.</li>
      `;
    }

    evalAchievements();
  });
}

// ----------------------------- Home / Check-ins ----------------------

function initHomePage() {
  let state = getUserState();
  if (!state) return;

  const tip = qs("#homeTip");
  if (tip) {
    tip.textContent =
      "Money stress is part numbers, part feelings. Checking in helps you see patterns instead of just vibes.";
  }

  const stress = qs("#checkinStress");
  const note = qs("#checkinNote");
  const saveBtn = qs("#checkinSaveBtn");
  const streakEl = qs("#streakDisplay");

  if (streakEl) {
    streakEl.textContent = `Current streak: ${state.streak || 0} day(s)`;
  }

  saveBtn?.addEventListener("click", () => {
    const sVal = Number(stress?.value || 3);
    const text = (note?.value || "").trim();
    const today = todayISO();

    updateUserState((s) => {
      s.checkins = s.checkins || [];
      // Overwrite same-day checkin
      s.checkins = s.checkins.filter((c) => c.date !== today);
      s.checkins.push({
        date: today,
        stress: clamp(sVal, 1, 5),
        note: text
      });

      // Update streak
      const last = s.lastCheckinDate;
      if (!last) {
        s.streak = 1;
      } else {
        const diffDays =
          (new Date(today).getTime() - new Date(last).getTime()) /
          (1000 * 60 * 60 * 24);
        if (diffDays <= 1.1 && diffDays >= 0.9) {
          s.streak = (s.streak || 0) + 1;
        } else if (diffDays > 1.1) {
          s.streak = 1; // reset
        }
      }
      s.lastCheckinDate = today;

      // XP for checking in
      s = grantXP(s, 15, "Daily money check-in");
      // Bonus for streak >3, >7
      if (s.streak === 3) s = grantXP(s, 25, "3-day streak");
      if (s.streak === 7) s = grantXP(s, 50, "7-day streak");

      return s;
    });

    state = getUserState();

    if (streakEl) {
      streakEl.textContent = `Current streak: ${state.streak || 0} day(s)`;
    }
    if (note) note.value = "";
    alert("Check-in saved. This stays on this device only.");
    evalAchievements();
  });
}

// ----------------------------- Achievements Page ---------------------

function initAchievementsPage() {
  renderAchievements();
}

// ----------------------------- Login Page ----------------------------

function initLoginPage() {
  const loginBtn = qs("#loginBtn");
  const registerBtn = qs("#registerBtn");
  loginBtn?.addEventListener("click", handleLogin);
  registerBtn?.addEventListener("click", handleRegister);
}

// ----------------------------- Main Entry ----------------------------

document.addEventListener("DOMContentLoaded", () => {
  initThemeAndPrivacy();
  initMenuToggle();

  const page = pageName();

  if (page === "login.html") {
    initLoginPage();
    buildSidebar(); // optional; just shows skeleton
    return;
  }

  // Protect all other pages behind login
  requireAuthForPage();
  buildSidebar();

  switch (page) {
    case "index.html":
      initHomePage();
      break;
    case "dashboard.html":
      initDashboardPage();
      break;
    case "budget.html":
      initBudgetPage();
      break;
    case "survey.html":
      initSurveyPage();
      break;
    case "categories.html":
      initCategoriesPage();
      break;
    case "subscriptions.html":
      initSubscriptionsPage();
      break;
    case "classes.html":
      initClassesPage();
      break;
    case "emergency.html":
      initEmergencyPage();
      break;
    case "achievements.html":
      initAchievementsPage();
      break;
    // aid.html, broke.html: mostly static content + nav/theme
    default:
      break;
  }

  // Re-evaluate achievements on any page where something might have changed
  const state = getUserState();
  if (state) evalAchievements();
});
