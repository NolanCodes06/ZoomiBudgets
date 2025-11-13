// ZoomiBudgets_Beta_V2 core logic – gamified + achievements + export/import
const App = (() => {
  const USERS_KEY = "zoomi.v2.users";
  const CURRENT_KEY = "zoomi.v2.current";
  const THEME_KEY = "zoomi.v2.theme";

  const el = (id) => document.getElementById(id);
  const fmt = (n) => "$" + Number(n || 0).toFixed(2);
  const todayISO = () => new Date().toISOString().slice(0, 10);
  const ym = (d) => d.slice(0, 7);
  const pageName = () => {
    const p = location.pathname.split("/").pop();
    return p || "index.html";
  };

  // ---- Storage helpers ----
  function defaultCategories() {
    return [
      "rent",
      "food",
      "transportation",
      "entertainment",
      "subscriptions",
      "savings",
      "other",
    ];
  }

  function defaultColorMap() {
    const cats = defaultCategories();
    const palette = [
      "#4ade80",
      "#22c55e",
      "#a3e635",
      "#f97316",
      "#38bdf8",
      "#e879f9",
      "#facc15",
    ];
    const out = {};
    cats.forEach((c, idx) => {
      out[c] = palette[idx % palette.length];
    });
    return out;
  }

  function defaultPlanned() {
    const out = {};
    defaultCategories().forEach((c) => (out[c] = 0));
    return out;
  }

  function defaultAchievements() {
    return {
      firstMonthTracked: false,
      tenTxMonth: false,
      goalCreated: false,
      billsSet: false,
      surveySaved: false,
      netWorthPositive: false,
      exportDone: false,
    };
  }

  function defaultState(username) {
    return {
      profile: { username },
      passHash: null,
      income: { primary: 0, other: 0 },
      categories: defaultCategories(),
      planned: defaultPlanned(),
      colors: defaultColorMap(),
      transactions: [],
      survey: null,
      goals: [],
      bills: [],
      netWorth: { assets: 0, debts: 0 },
      checkins: {}, // date -> { spent: bool }
      achievements: defaultAchievements(),
    };
  }

  function loadUsers() {
    try {
      return JSON.parse(localStorage.getItem(USERS_KEY)) || {};
    } catch {
      return {};
    }
  }

  function saveUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function currentUser() {
    return localStorage.getItem(CURRENT_KEY) || null;
  }

  function setCurrentUser(username) {
    localStorage.setItem(CURRENT_KEY, username);
    refreshUserUI();
  }

  function getState() {
    const u = currentUser();
    if (!u) return null;
    const all = loadUsers();
    if (!all[u]) {
      all[u] = defaultState(u);
      saveUsers(all);
    } else {
      const s = all[u];
      if (!s.categories) s.categories = defaultCategories();
      if (!s.planned) s.planned = defaultPlanned();
      if (!s.colors) s.colors = defaultColorMap();
      if (!s.netWorth) s.netWorth = { assets: 0, debts: 0 };
      if (!s.goals) s.goals = [];
      if (!s.bills) s.bills = [];
      if (!s.checkins) s.checkins = {};
      if (!s.achievements) s.achievements = defaultAchievements();
      all[u] = s;
      saveUsers(all);
    }
    return all[u];
  }

  function setState(state) {
    const u = currentUser();
    if (!u) return;
    const all = loadUsers();
    all[u] = state;
    saveUsers(all);
  }

  function getStateOrWarn() {
    const s = getState();
    if (!s) {
      alert("Please log in first.");
      return null;
    }
    return s;
  }

  // ---- Theme & nav ----
  function initTheme() {
    const t = localStorage.getItem(THEME_KEY) || "dark";
    document.documentElement.setAttribute("data-theme", t);
  }

  function toggleTheme() {
    const current = localStorage.getItem(THEME_KEY) || "dark";
    const next = current === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    document.documentElement.setAttribute("data-theme", next);
    updateDashboard();
  }

  function toggleNav() {
    document.body.classList.toggle("drawer-open");
  }

  function refreshUserUI() {
    const name = currentUser() || "Guest";
    const pill = el("userPill");
    const duser = el("drawerUser");
    if (pill) pill.textContent = name;
    if (duser) duser.textContent = name;
  }

  // ---- Auth ----
  async function hash(text) {
    try {
      if (window.isSecureContext && window.crypto && crypto.subtle) {
        const enc = new TextEncoder().encode(text);
        const buf = await crypto.subtle.digest("SHA-256", enc);
        return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
      }
    } catch (e) {
      console.warn("WebCrypto failed, using fallback hash.", e);
    }
    let h = 5381;
    for (let i = 0; i < text.length; i++) {
      h = ((h << 5) + h) + text.charCodeAt(i);
      h = h >>> 0;
    }
    return ("00000000" + h.toString(16)).slice(-8);
  }

  function gotoLogin() {
    location.href = "login.html";
  }

  async function authRegister() {
    const form = document.getElementById("login-form");
    const msg = el("authMsg");
    const username = (form.username.value || "").trim();
    const password = form.password.value || "";

    if (!username || !password) {
      msg.textContent = "Enter a username and password.";
      return;
    }
    const users = loadUsers();
    if (users[username] && users[username].passHash) {
      msg.textContent = "Username already exists.";
      return;
    }

    const state = users[username] || defaultState(username);
    state.passHash = await hash(password);
    users[username] = state;
    saveUsers(users);

    setCurrentUser(username);
    msg.textContent = "Account created. Redirecting to home...";
    setTimeout(() => {
      location.href = "index.html";
    }, 250);
  }

  async function authLogin() {
    const form = document.getElementById("login-form");
    const msg = el("authMsg");
    const username = (form.username.value || "").trim();
    const password = form.password.value || "";

    const users = loadUsers();
    if (!users[username] || !users[username].passHash) {
      msg.textContent = "Account not found. Try creating one.";
      return;
    }

    const ok = (await hash(password)) === users[username].passHash;
    if (!ok) {
      msg.textContent = "Incorrect password.";
      return;
    }

    setCurrentUser(username);
    msg.textContent = "Signed in. Redirecting to home...";
    setTimeout(() => {
      location.href = "index.html";
    }, 250);
  }

  function logout() {
    localStorage.removeItem(CURRENT_KEY);
    refreshUserUI();
    location.href = "login.html";
  }

  // ---- Budget helpers ----
  function ensureCategoryPlanned(state) {
    state.categories.forEach((c) => {
      if (typeof state.planned[c] !== "number") state.planned[c] = 0;
      if (!state.colors) state.colors = defaultColorMap();
      if (!state.colors[c]) state.colors[c] = "#4ade80";
    });
  }

  function totalIncome(state) {
    return Number(state.income.primary || 0) + Number(state.income.other || 0);
  }

  function plannedTotals(state) {
    ensureCategoryPlanned(state);
    const income = totalIncome(state);
    const expenses = Object.values(state.planned).reduce(
      (sum, v) => sum + Number(v || 0),
      0
    );
    return { income, expenses, remaining: income - expenses };
  }

  function saveIncome() {
    const s = getStateOrWarn();
    if (!s) return;
    const form = document.getElementById("income-form");
    const data = new FormData(form);
    s.income.primary = parseFloat(data.get("primary") || "0") || 0;
    s.income.other = parseFloat(data.get("other") || "0") || 0;
    setState(s);
    recomputeAchievementsAndSave();
    updateBudgetSummary();
    updateDashboard();
  }

  function buildPlannedInputs() {
    const s = getState();
    const container = el("plannedInputs");
    if (!container) return;
    container.innerHTML = "";
    const cats = s ? s.categories : defaultCategories();
    const planned = s ? s.planned : defaultPlanned();

    cats.forEach((c) => {
      const wrapper = document.createElement("label");
      wrapper.innerHTML = `
        <span>${c}</span>
        <input type="number" step="0.01" name="${c}" value="${planned[c] || 0}" />
      `;
      container.appendChild(wrapper);
    });
  }

  function savePlanned() {
    const s = getStateOrWarn();
    if (!s) return;
    const form = document.getElementById("planned-form");
    const data = new FormData(form);
    s.categories.forEach((c) => {
      s.planned[c] = parseFloat(data.get(c) || "0") || 0;
    });
    setState(s);
    recomputeAchievementsAndSave();
    updateBudgetSummary();
    updateDashboard();
  }

  function randomColor() {
    const h = Math.floor(Math.random() * 360);
    return `hsl(${h} 70% 50%)`;
  }

  function addCategory() {
    const s = getStateOrWarn();
    if (!s) return;
    const input = el("newCategoryName");
    const name = (input.value || "").trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/\s+/g, "_");
    if (!s.categories.includes(key)) {
      s.categories.push(key);
      s.planned[key] = 0;
      if (!s.colors) s.colors = defaultColorMap();
      s.colors[key] = randomColor();
      setState(s);
    }
    input.value = "";
    hydrateCategoriesUI();
    buildPlannedInputs();
    updateDashboard();
  }

  function updateCategoryColor(cat, color) {
    const s = getStateOrWarn();
    if (!s) return;
    if (!s.colors) s.colors = defaultColorMap();
    s.colors[cat] = color;
    setState(s);
    updateDashboard();
  }

  function hydrateCategoriesUI() {
    const s = getState();
    const select = el("txCategory");
    const colorWrap = el("categoryColors");
    const cats = s ? s.categories : defaultCategories();
    const colors = s && s.colors ? s.colors : defaultColorMap();

    if (select) {
      select.innerHTML = "";
      cats.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
      });
    }

    if (colorWrap) {
      colorWrap.innerHTML = "";
      cats.forEach((c) => {
        const row = document.createElement("div");
        row.className = "category-color-row";
        const color = colors[c] || "#4ade80";
        row.innerHTML = `
          <span>${c}</span>
          <input type="color" value="${color}" onchange="App.updateCategoryColor('${c}', this.value)" />
        `;
        colorWrap.appendChild(row);
      });
    }
  }

  // ---- Net worth ----
  function saveNetWorth() {
    const s = getStateOrWarn();
    if (!s) return;
    s.netWorth.assets = parseFloat(el("netAssets")?.value || "0") || 0;
    s.netWorth.debts = parseFloat(el("netDebts")?.value || "0") || 0;
    setState(s);
    recomputeAchievementsAndSave();
    updateDashboard();
  }

  function hydrateNetWorth() {
    const s = getState();
    if (!s) return;
    if (el("netAssets")) el("netAssets").value = s.netWorth.assets || 0;
    if (el("netDebts")) el("netDebts").value = s.netWorth.debts || 0;
  }

  // ---- Goals ----
  function addGoal() {
    const s = getStateOrWarn();
    if (!s) return;
    const name = (el("goalName")?.value || "").trim();
    const target = parseFloat(el("goalTarget")?.value || "0") || 0;
    const current = parseFloat(el("goalCurrent")?.value || "0") || 0;
    if (!name || !target) return;

    s.goals.push({
      id: Date.now().toString(),
      name,
      target,
      current,
    });
    setState(s);

    if (el("goalName")) el("goalName").value = "";
    if (el("goalTarget")) el("goalTarget").value = "";
    if (el("goalCurrent")) el("goalCurrent").value = "";

    hydrateGoalsTable();
    recomputeAchievementsAndSave();
    updateDashboard();
  }

  function deleteGoal(id) {
    const s = getStateOrWarn();
    if (!s) return;
    s.goals = s.goals.filter((g) => g.id !== id);
    setState(s);
    hydrateGoalsTable();
    recomputeAchievementsAndSave();
    updateDashboard();
  }

  function hydrateGoalsTable() {
    const s = getState();
    const tb = el("goalsTable")?.querySelector("tbody");
    if (!tb || !s) return;
    tb.innerHTML = "";
    s.goals.forEach((g) => {
      const pct = g.target ? Math.min(100, (g.current / g.target) * 100) : 0;
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${g.name}</td>
        <td>${fmt(g.current)} / ${fmt(g.target)} (${pct.toFixed(0)}%)</td>
        <td><button class="btn danger" type="button" onclick="App.deleteGoal('${g.id}')">X</button></td>
      `;
      tb.appendChild(tr);
    });
  }

  // ---- Bills ----
  function addBill() {
    const s = getStateOrWarn();
    if (!s) return;
    const name = (el("billName")?.value || "").trim();
    const amount = parseFloat(el("billAmount")?.value || "0") || 0;
    const day = parseInt(el("billDay")?.value || "0", 10);
    const notes = (el("billNotes")?.value || "").trim();
    if (!name || !amount || day < 1 || day > 31) return;

    s.bills.push({
      id: Date.now().toString(),
      name,
      amount,
      day,
      notes,
    });
    setState(s);

    ["billName", "billAmount", "billDay", "billNotes"].forEach((id) => {
      if (el(id)) el(id).value = "";
    });

    hydrateBillsTable();
    recomputeAchievementsAndSave();
    updateDashboard();
  }

  function deleteBill(id) {
    const s = getStateOrWarn();
    if (!s) return;
    s.bills = s.bills.filter((b) => b.id !== id);
    setState(s);
    hydrateBillsTable();
    recomputeAchievementsAndSave();
    updateDashboard();
  }

  function hydrateBillsTable() {
    const s = getState();
    const tb = el("billsTable")?.querySelector("tbody");
    if (!tb || !s) return;
    tb.innerHTML = "";
    s.bills.forEach((b) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${b.name}</td>
        <td>${b.day}</td>
        <td>${fmt(b.amount)}</td>
        <td><button class="btn danger" type="button" onclick="App.deleteBill('${b.id}')">X</button></td>
      `;
      tb.appendChild(tr);
    });
  }

  // ---- Transactions ----
  function currentMonthKey() {
    const monthInput = el("monthPicker") || el("dashMonthInput");
    if (monthInput && monthInput.value) return monthInput.value;
    return ym(todayISO());
  }

  function setCurrentMonth() {
    const monthInput = el("monthPicker");
    if (monthInput) monthInput.value = ym(todayISO());
    updateTransactionsTable();
    updateBudgetSummary();
    updateDashboard();
  }

  function monthTransactions(state, yymm) {
    return state.transactions.filter((t) => ym(t.date) === yymm);
  }

  function addTransaction() {
    const s = getStateOrWarn();
    if (!s) return;
    const date = el("txDate")?.value || todayISO();
    const category = el("txCategory")?.value || "other";
    const amount = parseFloat(el("txAmount")?.value || "0") || 0;
    const note = el("txNote")?.value || "";
    if (!amount) return;

    s.transactions.push({ date, category, amount, note });
    setState(s);

    if (el("txAmount")) el("txAmount").value = "";
    if (el("txNote")) el("txNote").value = "";

    updateTransactionsTable();
    updateBudgetSummary();
    recomputeAchievementsAndSave();
    updateDashboard();
  }

  function deleteTransaction(idx) {
    const s = getStateOrWarn();
    if (!s) return;
    const key = currentMonthKey();
    const list = monthTransactions(s, key);
    const target = list[idx];
    const absIndex = s.transactions.findIndex((t) => t === target);
    if (absIndex >= 0) {
      s.transactions.splice(absIndex, 1);
      setState(s);
    }
    updateTransactionsTable();
    updateBudgetSummary();
    recomputeAchievementsAndSave();
    updateDashboard();
  }

  function updateTransactionsTable() {
    const s = getState();
    const tb = el("txTable")?.querySelector("tbody");
    if (!tb || !s) return;
    const key = currentMonthKey();
    const list = monthTransactions(s, key);
    tb.innerHTML = "";
    list.forEach((t, i) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${t.date}</td>
        <td>${t.category}</td>
        <td>${t.note || ""}</td>
        <td>${fmt(t.amount)}</td>
        <td><button class="btn danger" type="button" onclick="App.deleteTransaction(${i})">X</button></td>
      `;
      tb.appendChild(tr);
    });
  }

  // ---- Budget summary ----
  function updateBudgetSummary() {
    const s = getState();
    if (!s) return;
    const key = currentMonthKey();
    const list = monthTransactions(s, key);
    const actual = list.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totals = plannedTotals(s);

    if (el("sumIncome")) el("sumIncome").textContent = fmt(totals.income);
    if (el("sumExpenses")) el("sumExpenses").textContent = fmt(totals.expenses);
    if (el("sumRemaining")) el("sumRemaining").textContent = fmt(totals.remaining);
    if (el("sumActual")) el("sumActual").textContent = fmt(actual);
  }

  // ---- Survey ----
  function buildSurveyTargets(responses) {
    let name = "Balanced student plan";
    let targets = {
      rent: 30,
      food: 15,
      transportation: 10,
      entertainment: 10,
      subscriptions: 5,
      savings: 20,
      other: 10,
    };
    const tips = [];

    if (responses.housingType === "dorm" || responses.housingType === "withFamily") {
      targets.rent = 20;
      targets.food = 20;
      tips.push("Lower housing costs let you lean into savings or food quality.");
    } else if (responses.housingType === "solo") {
      targets.rent = 35;
      tips.push("Living alone → keep rent under control to protect everything else.");
    }

    if (responses.workType === "none") {
      targets.savings = Math.min(targets.savings, 15);
      tips.push("No job right now → focus on survival categories first.");
    } else if (responses.workType === "full") {
      targets.savings = 25;
      tips.push("Full-time work → you can push savings higher if you choose.");
    }

    if (responses.savingsPriority === "high") {
      targets.savings = Math.max(targets.savings, 25);
      name = "Safety-first plan";
      tips.push("High savings priority → treat savings as a non-negotiable bill.");
    } else if (responses.savingsPriority === "low") {
      targets.savings = 10;
      name = "Survival mode plan";
      tips.push("Low savings priority → at least 5–10% keeps future-you slightly safer.");
    }

    if (responses.debtLevel === "heavy") {
      targets.subscriptions = 3;
      targets.entertainment = Math.min(targets.entertainment, 8);
      targets.savings = Math.max(targets.savings, 20);
      tips.push("Heavy debt → trim subscriptions/going out, protect savings for emergencies.");
    }

    if (responses.lifestyle === "frugal") {
      targets.food = 13;
      targets.entertainment = 7;
      tips.push("Frugal lifestyle → your secret weapon is already there. Keep it up.");
    } else if (responses.lifestyle === "social") {
      targets.food = 18;
      targets.entertainment = 15;
      tips.push("Very social → consider setting a weekly cap for food/going out.");
    }

    if (responses.selfCare === "high") {
      targets.entertainment = Math.max(targets.entertainment, 12);
      tips.push("Self-care is important → just keep it inside a planned slice.");
    }

    const sum = Object.values(targets).reduce((a, b) => a + b, 0);
    if (sum !== 100) {
      const factor = 100 / sum;
      Object.keys(targets).forEach((k) => {
        targets[k] = Math.round(targets[k] * factor);
      });
    }

    return {
      name,
      targets,
      notes: (responses.notes || "").trim() || "",
      tips,
    };
  }

  function saveSurvey() {
    const s = getStateOrWarn();
    if (!s) return;
    const form = document.getElementById("survey-form");
    const data = new FormData(form);
    const responses = {
      housingType: data.get("housingType"),
      workType: data.get("workType"),
      savingsPriority: data.get("savingsPriority"),
      debtLevel: data.get("debtLevel"),
      lifestyle: data.get("lifestyle"),
      selfCare: data.get("selfCare"),
      notes: data.get("notes") || "",
    };
    const plan = buildSurveyTargets(responses);
    s.survey = plan;
    setState(s);
    hydrateSurveyResult();
    recomputeAchievementsAndSave();
    updateDashboard();

    const block = el("surveyResult");
    if (block) block.scrollIntoView({ behavior: "smooth" });
  }

  function hydrateSurveyResult() {
    const s = getState();
    if (!s || !s.survey) return;
    const block = el("surveyResult");
    if (!block) return;
    const plan = s.survey;
    block.hidden = false;
    if (el("planName")) el("planName").textContent = plan.name;
    if (el("planNotes")) {
      const extra = plan.notes ? " " + plan.notes : "";
      el("planNotes").textContent =
        "These percentages are a starting point, not a prison." + extra;
    }

    const tb = el("planTable").querySelector("tbody");
    tb.innerHTML = "";
    Object.entries(plan.targets).forEach(([cat, pct]) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${cat}</td><td>${pct}%</td>`;
      tb.appendChild(tr);
    });

    const tipsEl = el("planTips");
    if (tipsEl) {
      tipsEl.innerHTML = "";
      if (!plan.tips || !plan.tips.length) {
        const li = document.createElement("li");
        li.textContent = "No major red flags. Focus on tracking your actual numbers.";
        tipsEl.appendChild(li);
      } else {
        plan.tips.forEach((t) => {
          const li = document.createElement("li");
          li.textContent = t;
          tipsEl.appendChild(li);
        });
      }
    }
  }

  // ---- Daily check-in ----
  function checkinToday(spent) {
    const s = getStateOrWarn();
    if (!s) return;
    const d = todayISO();
    if (!s.checkins) s.checkins = {};
    s.checkins[d] = { spent: !!spent };
    setState(s);
    recomputeAchievementsAndSave();
    updateDashboard();
  }

  function computeCheckinStreak(checkins) {
    if (!checkins) return { streak: 0, last: null };
    const dates = Object.keys(checkins);
    if (!dates.length) return { streak: 0, last: null };
    dates.sort();
    const last = dates[dates.length - 1];

    let streak = 0;
    const cur = new Date();
    while (true) {
      const iso = cur.toISOString().slice(0, 10);
      if (checkins[iso]) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      } else {
        break;
      }
    }
    return { streak, last };
  }

  // ---- Achievements ----
  function recomputeAchievementsAndSave() {
    const u = currentUser();
    if (!u) return;
    const all = loadUsers();
    const s = all[u];
    if (!s) return;

    if (!s.achievements) s.achievements = defaultAchievements();
    const a = s.achievements;

    const monthKey = ym(todayISO());
    const list = monthTransactions(s, monthKey);
    const daysSet = new Set(list.map((t) => t.date));

    if (list.length >= 20 && daysSet.size >= 10) {
      a.firstMonthTracked = true;
    }
    if (list.length >= 10) {
      a.tenTxMonth = true;
    }
    if (s.goals && s.goals.length > 0) {
      a.goalCreated = true;
    }
    if (s.bills && s.bills.length > 0) {
      a.billsSet = true;
    }
    if (s.survey) {
      a.surveySaved = true;
    }
    const netWorth = (s.netWorth.assets || 0) - (s.netWorth.debts || 0);
    if (netWorth > 0) {
      a.netWorthPositive = true;
    }

    s.achievements = a;
    all[u] = s;
    saveUsers(all);
  }

  // ---- Export / import ----
  function exportData() {
    const s = getStateOrWarn();
    if (!s) return;

    const copy = JSON.parse(JSON.stringify(s));
    delete copy.passHash;

    const blob = new Blob([JSON.stringify(copy, null, 2)], {
      type: "application/json",
    });
    const u = currentUser() || "user";
    const stamp = todayISO();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zoomi-budget-${u}-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);

    const all = loadUsers();
    const state = all[u];
    if (state) {
      if (!state.achievements) state.achievements = defaultAchievements();
      state.achievements.exportDone = true;
      all[u] = state;
      saveUsers(all);
    }
    updateDashboard();
  }

  function importFromFile(file) {
    const baseState = getStateOrWarn();
    if (!baseState || !file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        if (!data || typeof data !== "object" || !data.income || !data.planned || !Array.isArray(data.transactions)) {
          alert("Not a valid ZoomiBudgets export.");
          return;
        }
        const u = currentUser();
        const all = loadUsers();
        const existing = all[u] || defaultState(u);

        const merged = {
          ...defaultState(existing.profile.username),
          ...data,
          profile: { username: existing.profile.username },
          passHash: existing.passHash,
        };
        all[u] = merged;
        saveUsers(all);
        alert("Data imported for " + existing.profile.username);
        updateDashboard();
      } catch (err) {
        console.error(err);
        alert("Import failed: invalid file.");
      }
    };
    reader.readAsText(file);
  }

  // ---- Dashboard ----
  let pieChart = null;

  function setDashToCurrentMonth() {
    const input = el("dashMonthInput");
    if (input) input.value = ym(todayISO());
    updateDashboard();
  }

  function updateDashboard() {
    const s = getState();
    if (!s) return;

    const key = (el("dashMonthInput") && el("dashMonthInput").value) || ym(todayISO());
    if (el("dashMonthInput") && !el("dashMonthInput").value) {
      el("dashMonthInput").value = key;
    }

    const [y, m] = key.split("-");
    const dt = new Date(Number(y), Number(m) - 1, 1);
    if (el("dashMonthLabel")) {
      el("dashMonthLabel").textContent = dt.toLocaleString(undefined, {
        month: "long",
        year: "numeric",
      });
    }

    const list = monthTransactions(s, key);
    const actual = list.reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totals = plannedTotals(s);

    if (el("dIncome")) el("dIncome").textContent = fmt(totals.income);
    if (el("dExpenses")) el("dExpenses").textContent = fmt(totals.expenses);
    if (el("dActual")) el("dActual").textContent = fmt(actual);
    if (el("dRemaining")) el("dRemaining").textContent = fmt(totals.remaining);

    const netWorth = (s.netWorth.assets || 0) - (s.netWorth.debts || 0);
    if (el("dNetWorth")) el("dNetWorth").textContent = fmt(netWorth);

    const byCat = {};
    s.categories.forEach((c) => (byCat[c] = 0));
    list.forEach((t) => {
      if (!byCat[t.category]) byCat[t.category] = 0;
      byCat[t.category] += Number(t.amount || 0);
    });

    const canvas = el("catChart");
    if (canvas && typeof Chart !== "undefined") {
      const labels = Object.keys(byCat);
      const data = Object.values(byCat);
      const colors = s.colors || defaultColorMap();
      const bg = labels.map((cat) => colors[cat] || "#4ade80");

      const style = getComputedStyle(document.documentElement);
      const ink = style.getPropertyValue("--ink").trim() || "#eef3f2";

      const config = {
        type: "pie",
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: bg,
              borderColor: "#000000",
              borderWidth: 0.5,
            },
          ],
        },
        options: {
          plugins: {
            legend: {
              position: "bottom",
              labels: {
                color: ink,
              },
            },
          },
        },
      };

      if (pieChart) pieChart.destroy();
      pieChart = new Chart(canvas, config);
    }

    // Alerts
    const alertsEl = el("alertList");
    if (alertsEl) {
      alertsEl.innerHTML = "";
      const alerts = [];
      s.categories.forEach((c) => {
        const planned = Number(s.planned[c] || 0);
        const spent = byCat[c] || 0;
        if (!planned) return;
        const pct = (spent / planned) * 100;
        if (pct >= 110) {
          alerts.push({ type: "danger", text: `${c}: ${pct.toFixed(0)}% of budget (way over)` });
        } else if (pct >= 100) {
          alerts.push({ type: "danger", text: `${c}: ${pct.toFixed(0)}% of budget (over)` });
        } else if (pct >= 80) {
          alerts.push({ type: "warn", text: `${c}: ${pct.toFixed(0)}% of budget (getting close)` });
        }
      });
      if (!alerts.length) {
        const li = document.createElement("li");
        li.textContent = "No alerts yet – you’re within all planned slices.";
        alertsEl.appendChild(li);
      } else {
        alerts.forEach((a) => {
          const li = document.createElement("li");
          const cls = a.type === "danger" ? "badge-danger" : "badge-warn";
          li.innerHTML = `<span class="${cls}"></span>${a.text}`;
          alertsEl.appendChild(li);
        });
      }
    }

    // Survey plan on dashboard
    const plan = s.survey;
    const planName = el("dashPlanName");
    const planTb = el("dashPlanTable")?.querySelector("tbody");
    if (planName) planName.textContent = plan ? plan.name : "No plan saved yet.";
    if (planTb) {
      planTb.innerHTML = "";
      if (plan) {
        Object.entries(plan.targets).forEach(([cat, pct]) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${cat}</td><td>${pct}%</td>`;
          planTb.appendChild(tr);
        });
      }
    }

    // Upcoming bills (next 14 days)
    const billsTb = el("dashBills")?.querySelector("tbody");
    if (billsTb) {
      billsTb.innerHTML = "";
      const now = new Date();
      const today = now.getDate();
      const yr = now.getFullYear();
      const mon = now.getMonth();

      const upcoming = s.bills
        .map((b) => {
          let due = new Date(yr, mon, b.day);
          if (b.day < today) {
            due = new Date(yr, mon + 1, b.day);
          }
          const diffDays = Math.round((due - now) / (1000 * 60 * 60 * 24));
          return { ...b, due, diffDays };
        })
        .filter((b) => b.diffDays >= 0 && b.diffDays <= 14)
        .sort((a, b) => a.due - b.due);

      if (!upcoming.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="3">No bills in the next 2 weeks.</td>`;
        billsTb.appendChild(tr);
      } else {
        upcoming.forEach((b) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td>${b.name}</td>
            <td>${b.due.toLocaleDateString()}</td>
            <td>${fmt(b.amount)}</td>
          `;
          billsTb.appendChild(tr);
        });
      }
    }

    // Goals snapshot
    const goalsTb = el("dashGoals")?.querySelector("tbody");
    if (goalsTb) {
      goalsTb.innerHTML = "";
      if (!s.goals.length) {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td colspan="2">No goals yet. Add some on the Budget page.</td>`;
        goalsTb.appendChild(tr);
      } else {
        s.goals.forEach((g) => {
          const pct = g.target ? Math.min(100, (g.current / g.target) * 100) : 0;
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${g.name}</td><td>${pct.toFixed(0)}%</td>`;
          goalsTb.appendChild(tr);
        });
      }
    }

    // Budget score
    const scoreValueEl = el("scoreValue");
    const scoreTextEl = el("scoreText");
    const scoreDaysEl = el("scoreDays");
    const scoreTxEl = el("scoreTx");
    const scoreStreakEl = el("scoreStreak");

    if (scoreDaysEl || scoreTxEl || scoreValueEl || scoreTextEl || scoreStreakEl) {
      const daysSet = new Set(list.map((t) => t.date));
      const txCount = list.length;
      const daysActive = daysSet.size;

      let score = 50;
      if (totals.expenses > 0) {
        const ratio = actual / totals.expenses;
        const distance = Math.abs(1 - ratio);
        score = Math.round(100 - distance * 120);
        score = Math.max(0, Math.min(100, score));
      }

      if (scoreValueEl) scoreValueEl.textContent = String(score);
      if (scoreDaysEl) scoreDaysEl.textContent = String(daysActive);
      if (scoreTxEl) scoreTxEl.textContent = String(txCount);

      if (scoreTextEl) {
        let msg = "";
        if (list.length === 0) {
          msg = "No data yet. Your only mission right now is to start logging a few transactions.";
        } else if (score >= 85) {
          msg = "You’re dialed in. Your spending is hugging your plan – this is where calm lives.";
        } else if (score >= 65) {
          msg = "You’re close. A few tweaks (usually food, rides, or subscriptions) could bump this higher.";
        } else if (score >= 40) {
          msg = "You’re in the messy middle. That’s normal – your future self will thank you for even looking.";
        } else {
          msg = "Right now, the numbers are yelling. That’s okay. Use alerts to pick one category to fix first.";
        }
        scoreTextEl.textContent = msg;
      }

      const { streak, last } = computeCheckinStreak(s.checkins);
      if (scoreStreakEl) scoreStreakEl.textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
      if (el("checkinStreak")) el("checkinStreak").textContent = `${streak} ${streak === 1 ? "day" : "days"}`;
      if (el("checkinLast")) el("checkinLast").textContent = last || "No check-ins yet";
    }

    // Achievements UI
    recomputeAchievementsAndSave();
    const achList = el("achievementsList");
    if (achList) {
      achList.innerHTML = "";
      const a = s.achievements || defaultAchievements();
      const defs = [
        {
          key: "firstMonthTracked",
          title: "First month fully tracked",
          desc: "Logged enough days and transactions in a single month.",
        },
        {
          key: "tenTxMonth",
          title: "Active tracker",
          desc: "Logged at least 10 transactions in a month.",
        },
        {
          key: "goalCreated",
          title: "Goal setter",
          desc: "Created at least one savings goal.",
        },
        {
          key: "billsSet",
          title: "No-surprise bills",
          desc: "Added at least one recurring bill.",
        },
        {
          key: "surveySaved",
          title: "Planned on purpose",
          desc: "Completed the personalized budget survey.",
        },
        {
          key: "netWorthPositive",
          title: "Above water",
          desc: "Your net worth is currently positive.",
        },
        {
          key: "exportDone",
          title: "Shared your story",
          desc: "Exported your budget as a JSON file.",
        },
      ];

      defs.forEach((def) => {
        const unlocked = !!a[def.key];
        const li = document.createElement("li");
        li.className = "achievement-item";
        li.innerHTML = `
          <div class="achievement-icon">${unlocked ? "✅" : "🔒"}</div>
          <div class="achievement-body">
            <div class="achievement-title">${def.title}</div>
            <div class="achievement-desc">${def.desc}</div>
          </div>
        `;
        achList.appendChild(li);
      });
    }
  }

  // ---- Page-specific init ----
  function initCommon() {
    initTheme();
    refreshUserUI();

    const page = pageName().toLowerCase();
    document.querySelectorAll(".nav a").forEach((a) => {
      const href = a.getAttribute("href");
      if (href && href.toLowerCase() === page) {
        a.classList.add("active");
      } else {
        a.classList.remove("active");
      }
    });
  }

  function initLogin() {}

  function initHome() {}

  function initBudget() {
    const s = getState();
    if (el("txDate")) el("txDate").value = todayISO();
    if (el("monthPicker")) el("monthPicker").value = ym(todayISO());

    hydrateCategoriesUI();
    buildPlannedInputs();
    hydrateNetWorth();
    hydrateGoalsTable();
    hydrateBillsTable();

    if (s) {
      const incForm = el("income-form");
      if (incForm) {
        incForm.primary.value = s.income.primary || 0;
        incForm.other.value = s.income.other || 0;
      }
    }

    updateTransactionsTable();
    updateBudgetSummary();
  }

  function initSurvey() {
    const s = getState();
    if (s && s.survey) {
      hydrateSurveyResult();
    }
  }

  function initDashboard() {
    if (el("dashMonthInput") && !el("dashMonthInput").value) {
      el("dashMonthInput").value = ym(todayISO());
    }
    updateDashboard();
  }

  function initAbout() {
    const input = el("importFile");
    if (input) {
      input.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) importFromFile(file);
      });
    }
  }

  function init() {
    initCommon();
    const p = pageName().toLowerCase();
    if (p === "login.html") initLogin();
    else if (p === "index.html") initHome();
    else if (p === "budget.html") initBudget();
    else if (p === "survey.html") initSurvey();
    else if (p === "dashboard.html") initDashboard();
    else if (p === "about.html") initAbout();
  }

  // public API
  return {
    init,
    toggleTheme,
    toggleNav,
    gotoLogin,
    authLogin,
    authRegister,
    logout,
    saveIncome,
    savePlanned,
    addCategory,
    updateCategoryColor,
    addTransaction,
    deleteTransaction,
    setCurrentMonth,
    saveNetWorth,
    addGoal,
    deleteGoal,
    addBill,
    deleteBill,
    saveSurvey,
    setDashToCurrentMonth,
    checkinToday,
    exportData,
  };
})();

document.addEventListener("DOMContentLoaded", () => {
  App.init();
});
