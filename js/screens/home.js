// Home: this month's spending against the budget, and entries grouped by day (port of ui/home/HomeScreen.kt).

import * as store from "../store.js";
import { currentYm, dayHeading, esc, lengthOfMonth, monthHeading, rs, todayDay, ymStart } from "../format.js";
import { card, circleBtn, emptyNote, entryRow, pillButton, progress, sectionHeader } from "../ui.js";
import { go } from "../nav.js";

/** Within a day, expenses come first, biggest first. */
const byLargestExpense = (a, b) => ((a.type === "EXPENSE" ? 0 : 1) - (b.type === "EXPENSE" ? 0 : 1)) || (b.amount - a.amount);

export function homeScreen() {
  const month = currentYm();
  const entries = store.entriesIn(month);
  const spent = entries.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);
  const income = entries.filter((e) => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
  const budget = store.monthlyBudget();

  const days = [];
  for (const e of entries) {
    if (!days.length || days[days.length - 1].day !== e.epochDay) days.push({ day: e.epochDay, entries: [] });
    days[days.length - 1].entries.push(e);
  }
  days.forEach((d) => d.entries.sort(byLargestExpense));

  let budgetPart;
  if (budget != null && budget > 0) {
    const daysLeft = lengthOfMonth(month) - (todayDay() - ymStart(month));
    budgetPart = `
      ${progress(spent / budget, { cls: "h10", track: "var(--surface)", fill: "var(--cream)", trackBorder: "var(--border)", fillBorder: "var(--cream-edge)" })}
      <div class="sp12"></div>
      <div class="row"><span class="label grow">${Math.floor((spent * 100) / budget)}% of ${rs(budget)} budget</span>
        <span class="label">${daysLeft === 1 ? "1 day left" : `${daysLeft} days left`}</span></div>`;
  } else {
    budgetPart = `<div class="row"><span class="label grow">No monthly budget yet</span>${pillButton("Set budget", "budgets", { cls: "cream short" })}</div>`;
  }

  const list = days.length === 0
    ? sectionHeader("This month") + emptyNote("Nothing logged yet. Tap “Add expense” to log your first one.", "home-label")
    : days.map((d, i) => `${i > 0 ? '<div class="sp4"></div>' : ""}${sectionHeader(dayHeading(d.day))}` +
      d.entries.map((e, j) => entryRow({
        name: e.name,
        subtitle: e.type === "INCOME" ? "Income" : e.categoryName ?? "Uncategorised",
        amount: e.amount,
        income: e.type === "INCOME",
        action: "edit",
        id: e.id,
        divider: j > 0,
      })).join("")).join("");

  return {
    html: `
      <div class="row"><h1 class="display grow">${esc(monthHeading(month))}</h1>${circleBtn("search", "Search entries", "search")}</div>
      ${card(`<div class="home-label">Spent this month</div><div class="sp8"></div><div class="big-figure">${rs(spent)}</div><div class="sp12"></div>${budgetPart}`, "pad20")}
      <div class="two">
        ${card(`<div class="home-label">Income</div><div class="sp4"></div><div class="figure">${rs(income)}</div>`, "small pad16")}
        ${card(`<div class="home-label">Remaining</div><div class="sp4"></div><div class="figure">${rs(income - spent)}</div>`, "small pad16")}
      </div>
      ${card(list, "list")}
      ${pillButton("Add expense", "add", { iconName: "plus", cls: "fab" })}`,
    actions: {
      search: () => go("#/history"),
      budgets: () => go("#/budgets"),
      add: () => go("#/entry/0"),
      edit: (d) => go(`#/entry/${d.id}`),
    },
  };
}
