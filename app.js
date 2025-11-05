
const App = (() => {
  const KEY = "umizoomi.budget.v1";

  const el = (id) => document.getElementById(id);

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {
        income: { primary: 0, other: 0 },
        expenses: { rent: 0, food: 0, transportation: 0, entertainment: 0, savings: 0, other: 0 },
        plan: null
      };
    } catch (_) {
      return { income: { primary: 0, other: 0 }, expenses: { rent: 0, food: 0, transportation: 0, entertainment: 0, savings: 0, other: 0 }, plan: null };
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
    updateTotalsUI();
    updateDashboard();
  }

  function numberOrZero(v) {
    const n = parseFloat(v);
    return isNaN(n) ? 0 : n;
  }

  function saveIncome() {
    const state = load();
    const form = document.getElementById("income-form");
    state.income.primary = numberOrZero(form?.primary?.value);
    state.income.other = numberOrZero(form?.other?.value);
    save(state);
  }

  function saveExpenses() {
    const state = load();
    const form = document.getElementById("expense-form");
    if (!form) return;
    ["rent","food","transportation","entertainment","savings","other"].forEach(k => {
      state.expenses[k] = numberOrZero(form[k]?.value);
    });
    save(state);
  }

  function totals(state) {
    const totalIncome = (state.income.primary || 0) + (state.income.other || 0);
    const totalExpenses = Object.values(state.expenses).reduce((a,b)=>a+numberOrZero(b),0);
    const remaining = totalIncome - totalExpenses;
    return { totalIncome, totalExpenses, remaining };
  }

  function updateTotalsUI() {
    const state = load();
    const { totalIncome, totalExpenses, remaining } = totals(state);
    if (el("totalIncome")) el("totalIncome").textContent = `$${totalIncome.toFixed(2)}`;
    if (el("totalExpenses")) el("totalExpenses").textContent = `$${totalExpenses.toFixed(2)}`;
    if (el("remaining")) el("remaining").textContent = `$${remaining.toFixed(2)}`;
  }

  function scoreSurvey() {
    const form = document.getElementById("survey-form");
    if (!form) return;
    const savings = form.savings.value;
    const housing = form.housing.value;
    const lifestyle = form.lifestyle.value;

    // Simple heuristic: pick a plan
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
      planName = planName === "Flexible" ? "Flexible (High Housing)" : "Conservative (High Housing)";
    }

    const state = load();
    state.plan = { name: planName, targets };
    save(state);

    const result = document.getElementById("plan-result");
    const nameEl = document.getElementById("plan-name");
    const ul = document.getElementById("plan-targets");
    if (result && nameEl && ul) {
      nameEl.textContent = planName;
      ul.innerHTML = "";
      Object.entries(targets).forEach(([k,v]) => {
        const li = document.createElement("li");
        li.textContent = `${k}: ${v}% of income`;
        ul.appendChild(li);
      });
      result.hidden = false;
    }
  }

  let chart;
  function updateDashboard() {
    const state = load();
    const { totalIncome, totalExpenses, remaining } = totals(state);
    if (el("sumIncome")) el("sumIncome").textContent = `$${totalIncome.toFixed(2)}`;
    if (el("sumExpenses")) el("sumExpenses").textContent = `$${totalExpenses.toFixed(2)}`;
    if (el("sumRemaining")) el("sumRemaining").textContent = `$${remaining.toFixed(2)}`;

    const ctx = document.getElementById("catChart");
    if (ctx && typeof Chart !== "undefined") {
      const data = {
        labels: Object.keys(state.expenses),
        datasets: [{
          data: Object.values(state.expenses).map(numberOrZero)
        }]
      };
      if (chart) chart.destroy();
      chart = new Chart(ctx, { type: "doughnut", data });
    }
  }

  function exportJSON() {
    const state = load();
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const ts = new Date().toISOString().slice(0,10);
    a.href = url;
    a.download = `umizoomi-budget-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function resetData() {
    localStorage.removeItem(KEY);
    updateTotalsUI();
    updateDashboard();
    alert("All local data cleared.");
  }

  // Init per page
  function init() {
    updateTotalsUI();
    updateDashboard();
  }

  return { init, saveIncome, saveExpenses, scoreSurvey, exportJSON, resetData };
})();

document.addEventListener("DOMContentLoaded", () => App.init());
