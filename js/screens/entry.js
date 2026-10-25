// Add or edit an expense or income (port of ui/entry/EntryScreen.kt).

import * as store from "../store.js";
import { dateLabel, dayToIso, digitsOnly, esc, groupDigits, isoToDay, todayDay } from "../format.js";
import { card, chip, circleBtn, confirmDialog, pillButton } from "../ui.js";
import { back } from "../nav.js";
import { categoryDialog } from "./budgets.js";

/** The form being edited. [amount] holds digits only. */
let form = null;

function startForm(id) {
  const e = id ? store.getEntry(id) : null;
  form = e
    ? { id: e.id, name: e.name, amount: String(e.amount), type: e.type, categoryId: e.categoryId, day: e.epochDay }
    : { id: 0, name: "", amount: "", type: "EXPENSE", categoryId: null, day: todayDay() };
  form.missing = id !== 0 && !e;
}

/** Expenses need a category; income doesn't. */
const canSave = () => form.name.trim() !== "" && Number(form.amount || 0) > 0 &&
  (form.type === "INCOME" || form.categoryId != null);

export function entryScreen(route, entered) {
  if (entered || !form) startForm(route.id);
  if (form.missing) {
    return { html: `<p class="label">This entry no longer exists.</p>${pillButton("Back", "close", { cls: "cream" })}`, actions: { close: () => back() } };
  }
  const isEdit = form.id !== 0;
  const income = form.type === "INCOME";
  const kind = income ? "income" : "expense";
  const categories = store.categories();

  const categoryCard = income ? "" : card(`
    <div class="label">Category</div><div class="sp12"></div>
    <div class="chips">
      ${categories.map((c) => chip(c.name, form.categoryId === c.id, "category", { extra: { "data-id": c.id } })).join("")}
      ${chip("New category", false, "newCategory", { dashed: true, leading: "plus" })}
    </div>`);

  return {
    html: `
      <div class="row gap8">
        ${circleBtn("close", "Close", "close")}
        <span class="grow"></span>
        ${isEdit ? circleBtn("trash", "Delete entry", "delete") : ""}
        <div class="toggle">
          <button class="${income ? "" : "on"}" data-action="type" data-type="EXPENSE">Expense</button>
          <button class="${income ? "on" : ""}" data-action="type" data-type="INCOME">Income</button>
        </div>
      </div>
      <h1 class="display" style="font-size:28px;margin:8px 0 4px">${isEdit ? "Edit" : "New"} ${kind}</h1>
      ${card(`<div class="label">${income ? "Where from?" : "What was it?"}</div><div class="sp6"></div>
        <input class="card-input" data-field="name" value="${esc(form.name)}" placeholder="${income ? "e.g. Salary" : "e.g. KFC with friends"}" autocapitalize="sentences" autocomplete="off" enterkeyhint="next">`, "small")}
      ${card(`<div class="label">Amount</div><div class="sp6"></div>
        <div class="row gap8"><span class="figure muted" style="font-size:22px;font-weight:500">Rs</span>
        <input class="card-input amount-input" data-field="amount" value="${form.amount ? groupDigits(Number(form.amount)) : ""}" placeholder="0" inputmode="numeric" autocomplete="off"></div>`, "small")}
      ${categoryCard}
      ${card(`<div class="row" style="position:relative">
          <div class="grow"><div class="label">Date</div><div class="sp4"></div>
            <div class="body" style="font-weight:500;font-size:16px" data-date-label>${esc(dateLabel(form.day))}</div></div>
          <span style="font:600 14px/20px var(--sans)">Change</span>
          <input type="date" class="overlay-input" data-field="date" value="${dayToIso(form.day)}" aria-label="Date">
        </div>`)}
      <div style="position:sticky;bottom:calc(16px + env(safe-area-inset-bottom));margin-top:4px">
        ${pillButton(isEdit ? "Save changes" : `Save ${kind}`, "save", { cls: "tall wide", disabled: !canSave() })}
      </div>`,
    mount: (root) => {
      const save = root.querySelector("[data-action=save]");
      const refresh = () => { save.disabled = !canSave(); };
      const name = root.querySelector("[data-field=name]");
      const amount = root.querySelector("[data-field=amount]");
      name.addEventListener("input", () => { form.name = name.value; refresh(); });
      name.addEventListener("keydown", (ev) => { if (ev.key === "Enter") amount.focus(); });
      amount.addEventListener("input", () => {
        form.amount = digitsOnly(amount.value);
        amount.value = form.amount ? groupDigits(Number(form.amount)) : "";
        refresh();
      });
      const date = root.querySelector("[data-field=date]");
      date.addEventListener("change", () => {
        if (!date.value) return;
        form.day = isoToDay(date.value);
        root.querySelector("[data-date-label]").textContent = dateLabel(form.day);
      });
      if (entered && !isEdit) name.focus();
    },
    actions: {
      close: () => back(),
      type: (d, el, rerender) => { form.type = d.type; rerender(); },
      // Tapping the selected category again clears it.
      category: (d, el, rerender) => {
        const id = Number(d.id);
        form.categoryId = form.categoryId === id ? null : id;
        rerender();
      },
      newCategory: (d, el, rerender) => categoryDialog(null, (n, budget) => {
        form.categoryId = store.addCategory(n, budget).id;
        rerender();
      }),
      save: () => {
        if (!canSave()) return;
        store.saveEntry({
          id: form.id,
          name: form.name.trim(),
          amount: Number(form.amount),
          type: form.type,
          categoryId: form.type === "INCOME" ? null : form.categoryId,
          epochDay: form.day,
        });
        form = null;
        back();
      },
      delete: () => confirmDialog("Delete this entry?", `“${form.name}” will be removed. This can't be undone.`, "Delete", () => {
        store.deleteEntry(form.id);
        form = null;
        back();
      }),
    },
  };
}
