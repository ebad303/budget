// Budgets: the monthly budget and per-category limits (port of ui/budgets/BudgetsScreen.kt).

import * as store from "../store.js";
import { currentYm, digitsOnly, esc, groupDigits, monthHeading, rs } from "../format.js";
import { card, confirmDialog, emptyNote, field, icon, openDialog, progress, sectionHeader, statusPill } from "../ui.js";

export function budgetsScreen() {
  const month = currentYm();
  const monthly = store.monthlyBudget();
  const totals = store.expenseByCategory(month);
  const spentById = new Map(totals.map((t) => [t.categoryId, t.total]));
  const spent = totals.reduce((s, t) => s + t.total, 0);
  // Categories with a limit first, then by what's been spent.
  const categories = store.categories()
    .map((c) => ({ category: c, spent: spentById.get(c.id) ?? 0 }))
    .sort((a, b) => ((a.category.budget == null) - (b.category.budget == null)) || (b.spent - a.spent));
  const allocated = categories.reduce((s, cb) => s + (cb.category.budget ?? 0), 0);

  let monthlyBody;
  if (monthly != null) {
    const left = monthly - spent;
    monthlyBody = `<div class="sp12"></div>
      ${progress(monthly > 0 ? spent / monthly : 0, { track: "#3F3F46", fill: spent > monthly ? "var(--over-bg)" : "#fff" })}
      <div class="sp12"></div>
      <div class="row"><span class="label grow" style="color:var(--on-ink)">${rs(spent)} spent</span>
        <span class="label" style="color:var(--on-ink)">${left >= 0 ? `${rs(left)} left` : `${rs(-left)} over`}</span></div>`;
  } else {
    monthlyBody = `<div class="sp4"></div><div class="label" style="color:var(--on-ink)">Tap Set to choose how much you want to spend each month.</div>`;
  }

  const split = monthly == null ? "" : (() => {
    const free = monthly - allocated;
    return card(`<div class="row"><span class="label grow">Split across categories</span>
      <span class="row-sub" style="color:var(--ink);font-weight:600">${rs(allocated)}</span>
      <span class="row-sub ${free >= 0 ? "" : "over"}">&nbsp;· ${free >= 0 ? `${rs(free)} free` : `${rs(-free)} over`}</span></div>`,
    "small", { style: "padding:12px 16px" });
  })();

  const rows = categories.length === 0
    ? emptyNote("No categories yet.")
    : categories.map(({ category: c, spent: s }) => {
      const limit = c.budget;
      let pill = "";
      let bar = "";
      if (limit != null && limit > 0) {
        const percent = Math.floor((s * 100) / limit);
        if (s > limit) pill = statusPill("Over", "var(--over-bg)", "var(--over-ink)");
        else if (percent >= 85) pill = statusPill(`${percent}%`, "var(--warn-bg)", "var(--warn-ink)");
        bar = `<div class="sp6"></div>${progress(s / limit, { cls: "h6", fill: s > limit ? "var(--over-ink)" : "var(--ink)" })}`;
      }
      const amounts = limit != null ? `${groupDigits(s)} / ${groupDigits(limit)}` : `${groupDigits(s)} · no limit`;
      return `<div class="divider" data-action="editCategory" data-id="${c.id}" style="cursor:pointer;padding:12px 0">
        <div class="row"><span class="row-title ellipsis">${esc(c.name)}</span>${pill}<span class="grow"></span>
          <span class="row-sub" style="color:var(--ink);font-size:14px">${amounts}</span></div>${bar}</div>`;
    }).join("");

  return {
    html: `
      <div class="row"><h1 class="display grow">Budgets</h1>
        ${card(`<span style="font:600 14px/20px var(--sans)">${esc(monthHeading(month))}</span>`, "small", { style: "padding:10px 14px" })}</div>
      ${card(`<div class="row"><span class="label grow" style="color:var(--on-ink)">Monthly budget</span>
          <button class="small-link" data-action="editMonthly">${monthly == null ? "Set" : "Edit"}</button></div>
        <div class="big-figure" style="color:#fff">${monthly == null ? "Not set" : rs(monthly)}</div>${monthlyBody}`, "dark pad20")}
      ${split}
      ${card(sectionHeader("Categories", "spent / limit") + rows, "list")}
      <button class="chip dashed" style="height:48px;justify-content:center;font:600 15px/20px var(--sans)" data-action="newCategory">${icon("plus", 16)}New category</button>`,
    actions: {
      editMonthly: () => amountDialog("Monthly budget", monthly, (v) => store.setMonthlyBudget(v)),
      newCategory: () => categoryDialog(null, (name, budget) => store.addCategory(name, budget)),
      editCategory: (d) => {
        const c = store.categories().find((x) => x.id === Number(d.id));
        if (!c) return;
        categoryDialog(c, (name, budget) => store.updateCategory({ ...c, name, budget }), () => store.deleteCategory(c.id));
      },
    },
  };
}

function amountDialog(title, initial, onSave) {
  openDialog({
    title,
    confirm: "Save",
    body: field("Amount", { name: "amount", value: initial ?? "", prefix: "Rs ", inputmode: "numeric", autocap: "off" }),
    onOpen: (el) => {
      const input = el.querySelector("[name=amount]");
      input.addEventListener("input", () => { input.value = digitsOnly(input.value); });
      input.focus();
    },
    onConfirm: (el) => {
      const v = el.querySelector("[name=amount]").value;
      onSave(v ? Number(v) : null);
    },
  });
}

/** Add or edit a category. Also used from the entry screen's "New category" chip. */
export function categoryDialog(initial, onSave, onDelete) {
  openDialog({
    title: initial ? "Edit category" : "New category",
    confirm: "Save",
    confirmDisabled: !initial,
    body: field("Name", { name: "name", value: initial?.name ?? "" }) +
      field("Monthly limit (optional)", { name: "budget", value: initial?.budget ?? "", prefix: "Rs ", inputmode: "numeric", autocap: "off" }) +
      (onDelete ? `<div><button class="text-btn danger" data-delete>Delete category</button></div>` : ""),
    onOpen: (el, close) => {
      const name = el.querySelector("[name=name]");
      const budget = el.querySelector("[name=budget]");
      const save = el.parentElement.querySelector("[data-dlg=confirm]");
      name.addEventListener("input", () => {
        save.disabled = !name.value.trim();
        el.querySelector("[data-hint=name]").textContent = "";
        name.closest(".field").classList.remove("error");
      });
      budget.addEventListener("input", () => { budget.value = digitsOnly(budget.value); });
      el.querySelector("[data-delete]")?.addEventListener("click", () => {
        confirmDialog(`Delete “${initial.name}”?`, "Entries in this category are kept, but become uncategorised.", "Delete", () => {
          onDelete();
          close();
        });
      });
      if (!initial) name.focus();
    },
    onConfirm: (el) => {
      const name = el.querySelector("[name=name]").value.trim();
      if (!name) return false;
      if (store.categoryNameTaken(name, initial?.id ?? 0)) {
        el.querySelector("[data-hint=name]").textContent = "You already have a category with this name";
        el.querySelector("[name=name]").closest(".field").classList.add("error");
        return false;
      }
      const b = el.querySelector("[name=budget]").value;
      onSave(name, b ? Number(b) : null);
    },
  });
}
