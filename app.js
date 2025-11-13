
const App = (() => {
  const KEY = "umizoomi.budget.v2";
  const THEME_KEY = "umizoomi.theme";
  const ACCENT_KEY = "umizoomi.accent";
  const NAV_KEY = "umizoomi.drawer";

  function defaultState(){
    return {
      income: { primary: 0, other: 0 },
      expenses: { rent: 0, food: 0, transportation: 0, entertainment: 0, savings: 0, other: 0 },
      plan: null
    };
  }
  function load(){
    try { return JSON.parse(localStorage.getItem(KEY)) || defaultState(); }
    catch(_) { return defaultState(); }
  }
  function save(state){
    localStorage.setItem(KEY, JSON.stringify(state));
    updateTotalsUI();
    updateDashboard();
  }

  const el = (id) => document.getElementById(id);
  const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;

  function totals(state){
    const totalIncome = Number(state.income.primary||0) + Number(state.income.other||0);
    const totalExpenses = Object.values(state.expenses).reduce((a,b)=>a+Number(b||0),0);
    return { totalIncome, totalExpenses, remaining: totalIncome - totalExpenses };
  }

  function fromForm(formEl){
    const data = new FormData(formEl);
    const obj = {};
    for(const [k,v] of data.entries()) obj[k] = parseFloat(v) || 0;
    return obj;
  }

  function saveIncome(){
    const s = load();
    const form = document.getElementById("income-form");
    if(form){
      const d = fromForm(form);
      s.income.primary = d.primary || 0;
      s.income.other = d.other || 0;
      save(s);
    }
  }
  function saveExpenses(){
    const s = load();
    const form = document.getElementById("expense-form");
    if(form){
      const d = fromForm(form);
      for(const k of ["rent","food","transportation","entertainment","savings","other"]){
        s.expenses[k] = d[k] || 0;
      }
      save(s);
    }
  }

  function updateTotalsUI(){
    const s = load();
    const t = totals(s);
    if(el("totalIncome")) el("totalIncome").textContent = fmt(t.totalIncome);
    if(el("totalExpenses")) el("totalExpenses").textContent = fmt(t.totalExpenses);
    if(el("remaining")) el("remaining").textContent = fmt(t.remaining);
  }

  function scoreSurvey(){
    const form = document.getElementById("survey-form");
    if(!form) return;
    const savings = form.savings.value;
    const housing = form.housing.value;
    const lifestyle = form.lifestyle.value;

    let planName = "Balanced";
    let targets = { rent: 30, food: 15, transportation: 10, entertainment: 10, savings: 20, other: 5 };

    if (savings === "high") {
      planName = "Conservative";
      targets = { rent: 28, food: 12, transportation: 10, entertainment: 5, savings: 30, other: 5 };
    }
    if (lifestyle === "high") {
      planName = "Flexible";
      targets = { rent: 30, food: 18, transportation: 12, entertainment: 15, savings: 15, other: 5 };
    }
    if (housing === "high") {
      targets.rent = Math.max(targets.rent, 35);
      planName += " (High Housing)";
    }

    const s = load();
    s.plan = { name: planName, targets };
    save(s);

    const result = document.getElementById("plan-result");
    if(result){
      result.hidden = false;
      const nameEl = document.getElementById("plan-name");
      const ul = document.getElementById("plan-targets");
      if(nameEl) nameEl.textContent = planName;
      if(ul){
        ul.innerHTML = "";
        Object.entries(targets).forEach(([k,v]) => {
          const li = document.createElement("li");
          li.textContent = `${k}: {v}% of income`.replace("{v}", v);
          ul.appendChild(li);
        });
      }
    }
  }

  let chart;
  function updateDashboard(){
    const s = load();
    const t = totals(s);
    if(el("sumIncome")) el("sumIncome").textContent = fmt(t.totalIncome);
    if(el("sumExpenses")) el("sumExpenses").textContent = fmt(t.totalExpenses);
    if(el("sumRemaining")) el("sumRemaining").textContent = fmt(t.remaining);

    const canvas = document.getElementById("catChart");
    if(!canvas || typeof Chart === "undefined") return;

    const labels = Object.keys(s.expenses);
    const data = Object.values(s.expenses).map(v => Number(v||0));
    const styles = getComputedStyle(document.documentElement);
    const ink = styles.getPropertyValue("--ink").trim() || "#ecf5ee";
    const a1 = styles.getPropertyValue("--accent").trim() || "#5ac471";
    const a2 = styles.getPropertyValue("--accent-2").trim() || "#9ae66e";
    const palette = labels.map((_,i)=> (i%2===0 ? a1 : a2));

    const cfg = {
      type: "doughnut",
      data: { labels, datasets: [{ data, borderWidth: 1, hoverOffset: 6, backgroundColor: palette }] },
      options: { plugins: { legend: { position: "bottom", labels: { color: ink } } } }
    };
    if(chart) chart.destroy();
    chart = new Chart(canvas, cfg);
  }

  function exportJSON(){
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(load(), null, 2)], {type:"application/json"}));
    a.download = `umizoomi-budget-${new Date().toISOString().slice(0,10)}.json`;
    a.click(); URL.revokeObjectURL(a.href);
  }

  function resetData(){
    localStorage.removeItem(KEY);
    updateTotalsUI(); updateDashboard();
    alert("All local data cleared.");
  }

  function applyTheme(theme){ document.documentElement.setAttribute("data-theme", theme); }
  function loadTheme(){ try { return localStorage.getItem(THEME_KEY) || "forest"; } catch(_) { return "forest"; } }
  function saveTheme(t){ try { localStorage.setItem(THEME_KEY, t); } catch(_){} }
  function toggleTheme(){
    const current = loadTheme();
    const next = current === "forest" ? "parchment" : "forest";
    saveTheme(next); applyTheme(next);
    updateDashboard();
  }

  function applyAccent(name){ document.documentElement.setAttribute("data-accent", name); }
  function loadAccent(){ try { return localStorage.getItem(ACCENT_KEY) || "green"; } catch(_) { return "green"; } }
  function saveAccent(n){ try { localStorage.setItem(ACCENT_KEY, n); } catch(_){} }
  function setAccent(name){ saveAccent(name); applyAccent(name); updateDashboard(); }

  function applyDrawer(open){ document.body.classList.toggle("drawer-open", !!open); }
  function loadDrawer(){ try { return localStorage.getItem(NAV_KEY) === "1"; } catch(_) { return false; } }
  function saveDrawer(open){ try { localStorage.setItem(NAV_KEY, open ? "1" : "0"); } catch(_){} }
  function toggleNav(){ const open = !document.body.classList.contains("drawer-open"); applyDrawer(open); saveDrawer(open); }

  function init(){
    try{ applyTheme(loadTheme()); applyAccent(loadAccent()); applyDrawer(loadDrawer()); }catch(_){}

    document.querySelectorAll(".nav a").forEach(a => {
      if(location.pathname.split("/").pop() === a.getAttribute("href")) a.classList.add("active");
    });

    updateTotalsUI();
    updateDashboard();
  }

  return { init, saveIncome, saveExpenses, resetData, scoreSurvey, exportJSON, toggleTheme, setAccent, toggleNav };
})();

document.addEventListener("DOMContentLoaded", () => App.init());
