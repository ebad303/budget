// Reports: a month's totals, where the money went, and the last 6 months (port of ui/reports/ReportsScreen.kt).

import * as store from "../store.js";
import { addMonths, currentYm, esc, monthShort, monthShortYear, rs, ymCompare, ymEquals, ymKey } from "../format.js";
import { card, emptyNote, icon, progress } from "../ui.js";

let month = currentYm();

export function reportsScreen() {
  const entries = store.entriesIn(month);
  const spent = entries.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);
  const income = entries.filter((e) => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
  const byCategory = store.expenseByCategory(month);
  const first = addMonths(month, -5);
  const totals = store.monthlyExpense(first, month);
  const trend = [0, 1, 2, 3, 4, 5].map((i) => {
    const m = addMonths(first, i);
    return { m, total: totals[ymKey(m)] ?? 0 };
  });
  const previousSpent = trend[4].total;
  const canGoNext = ymCompare(month, currentYm()) < 0;

  const statCard = (label, value, note) => card(
    `<div class="label">${label}</div><div class="sp4"></div><div class="figure" style="font-size:20px">${value}</div><div class="sp4"></div><div class="row-sub" style="font-size:12px">${esc(note)}</div>`,
    "small pad16",
  );

  let where;
  if (!byCategory.length) {
    where = emptyNote("No expenses this month.");
  } else {
    const sum = Math.max(1, byCategory.reduce((s, c) => s + c.total, 0));
    const biggest = Math.max(1, ...byCategory.map((c) => c.total));
    where = byCategory.map((c, i) => `
      ${i > 0 ? '<div class="sp12"></div>' : ""}
      <div class="row"><span class="grow body ellipsis" style="font-size:14px">${esc(c.categoryName ?? "Uncategorised")}</span>
        <span class="row-amount" style="font-size:14px">${rs(c.total)} · ${Math.floor((c.total * 100) / sum)}%</span></div>
      <div style="height:5px"></div>
      ${progress(c.total / biggest, { cls: "h6" })}`).join("");
  }

  const biggestMonth = Math.max(1, ...trend.map((t) => t.total));
  const description = trend.map((t) => `${monthShort(t.m)} ${rs(t.total)}`).join(", ");

  return {
    html: `
      <div class="row gap8">
        <h1 class="display grow">Reports</h1>
        <div class="card small row" style="padding:0 4px">
          <button class="circle-btn" style="border:0" data-action="prev" aria-label="Previous month">${icon("chevronLeft", 16)}</button>
          <span style="font:600 14px/20px var(--sans)">${monthShortYear(month)}</span>
          <button class="circle-btn" style="border:0;${canGoNext ? "" : "color:var(--faint)"}" data-action="next" aria-label="Next month"${canGoNext ? "" : " disabled"}>${icon("chevronRight", 16)}</button>
        </div>
      </div>
      <div class="two">
        ${statCard("Spent", rs(spent), `${monthShort(addMonths(month, -1))}: ${rs(previousSpent)}`)}
        ${statCard("Income", rs(income), `Saved: ${rs(income - spent)}`)}
      </div>
      ${card(`<h2 class="section">Where it went</h2><div class="sp12"></div>${where}`)}
      ${card(`<h2 class="section">Last 6 months</h2><div style="height:10px"></div>
        <div class="bars" role="img" aria-label="Monthly spending: ${esc(description)}">
          ${trend.map((t) => `<i class="${ymEquals(t.m, month) ? "on" : ""}" style="height:${Math.max(3, (t.total / biggestMonth) * 100)}%"></i>`).join("")}
        </div>
        <div class="sp8"></div>
        <div class="bar-labels">${trend.map((t) => `<span class="${ymEquals(t.m, month) ? "on" : ""}">${monthShort(t.m)}</span>`).join("")}</div>`)}`,
    actions: {
      prev: (d, el, rerender) => { month = addMonths(month, -1); rerender(); },
      next: (d, el, rerender) => { if (canGoNext) { month = addMonths(month, 1); rerender(); } },
    },
  };
}
