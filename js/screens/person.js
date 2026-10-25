// One person's ledger (port of ui/people/PersonScreen.kt).
// "You gave" adds to what they owe you; "You got" takes away from it.

import * as store from "../store.js";
import { dateLabel, dayToIso, digitsOnly, esc, isoToDay, rs, shortDay, todayDay } from "../format.js";
import { card, chip, circleBtn, confirmDialog, emptyNote, field, openDialog, pillButton, sectionHeader } from "../ui.js";
import { back } from "../nav.js";
import { balanceClass, personNameDialog } from "./people.js";

/** "+Rs 500", "−Rs 500" or "Rs 0". */
const signedRs = (v) => (v > 0 ? "+" + rs(v) : rs(v));
const entriesCount = (n) => (n === 1 ? "1 entry" : `${n} entries`);

export function personScreen(route) {
  const person = store.person(route.id);
  if (!person) {
    return { html: `<p class="label">This person no longer exists.</p>${pillButton("Back", "back", { cls: "cream" })}`, actions: { back: () => back("#/people") } };
  }
  const entries = store.personEntries(person.id);
  // Running balance is built oldest first, then shown newest first.
  let running = 0;
  const rows = [...entries].reverse().map((e) => ({ e, after: (running += e.amount) })).reverse();
  const balance = running;
  const name = person.name;

  const ledger = !rows.length
    ? emptyNote("No entries yet. Use “You gave” or “You got” to add one.")
    : rows.map(({ e, after }, i) => {
      const gave = e.amount > 0;
      const kind = gave ? "You gave" : "You got";
      return `<div class="${i > 0 ? "divider" : ""}">
        <div class="entry-row" data-action="edit" data-id="${e.id}">
          <div class="grow">
            <div class="row-title ellipsis">${esc(e.note.trim() || kind)}</div>
            <div class="row-sub">${shortDay(e.epochDay)}${e.note.trim() ? ` · ${kind}` : ""}</div>
          </div>
          <div class="end">
            <div class="row-amount ${gave ? "good" : "over"}">${gave ? "+" : "−"}${rs(Math.abs(e.amount))}</div>
            <div class="row-sub">Bal. ${signedRs(after)}</div>
          </div>
        </div></div>`;
    }).join("");

  return {
    html: `
      <div class="row gap8">
        ${circleBtn("chevronLeft", "Back", "back")}
        <span class="grow"></span>
        ${circleBtn("pencil", "Rename", "rename")}
        ${circleBtn("trash", "Delete person", "deletePerson")}
      </div>
      <h1 class="display" style="overflow-wrap:anywhere">${esc(name)}</h1>
      ${card(`<div class="label">Balance</div><div class="sp4"></div>
        <div class="big-figure ${balanceClass(balance)}">${rs(Math.abs(balance))}</div>
        <div class="body">${balance > 0 ? `${esc(name)} owes you` : balance < 0 ? `You owe ${esc(name)}` : "All settled up"}</div>`, "pad20")}
      <div class="two">
        ${pillButton("You gave", "gave")}
        ${pillButton("You got", "got", { cls: "cream" })}
      </div>
      <div class="row-sub" style="padding:0 4px">“You gave” is money you lent or paid for them. “You got” is money they paid back or lent you.</div>
      ${card(sectionHeader("Ledger", entriesCount(rows.length)) + ledger, "list")}`,
    actions: {
      back: () => back("#/people"),
      gave: () => entryDialog(person, null, true),
      got: () => entryDialog(person, null, false),
      edit: (d) => {
        const e = entries.find((x) => x.id === Number(d.id));
        if (e) entryDialog(person, e, e.amount > 0);
      },
      rename: () => personNameDialog("Rename", name, person.id, (n) => store.renamePerson(person.id, n)),
      deletePerson: () => confirmDialog(
        `Delete ${name}?`,
        rows.length ? `Their ledger (${entriesCount(rows.length)}) will be deleted too. This can't be undone.` : "This can't be undone.",
        "Delete",
        () => {
          back("#/people");
          store.deletePerson(person.id);
        },
      ),
    },
  };
}

/** Add or edit one ledger line. The amount is entered positive; "You gave / You got" sets the sign. */
function entryDialog(person, initial, initialGave) {
  let gave = initialGave;
  let day = initial ? initial.epochDay : todayDay();
  const toggle = () => `${chip("You gave", gave, "noop", { extra: { "data-gave": "1" } })}${chip("You got", !gave, "noop", { extra: { "data-gave": "0" } })}`;

  openDialog({
    title: initial ? "Edit entry" : gave ? "You gave" : "You got",
    confirm: "Save",
    confirmDisabled: !initial,
    body: `<div class="row gap8" data-toggle>${toggle()}</div>
      ${field("Amount", { name: "amount", value: initial ? Math.abs(initial.amount) : "", prefix: "Rs ", inputmode: "numeric", autocap: "off" })}
      ${field("Note (optional)", { name: "note", value: initial?.note ?? "", placeholder: "e.g. Dinner, petrol, loan" })}
      <div class="row" style="position:relative">
        <div class="grow"><div class="label">Date</div><div class="body" data-date-label>${esc(dateLabel(day))}</div></div>
        <span class="text-btn">Change</span>
        <input type="date" class="overlay-input" name="date" value="${dayToIso(day)}" aria-label="Date">
      </div>
      ${initial ? `<div><button class="text-btn danger" data-delete>Delete entry</button></div>` : ""}`,
    onOpen: (el, close) => {
      const amount = el.querySelector("[name=amount]");
      const save = el.querySelector("[data-dlg=confirm]");
      amount.addEventListener("input", () => {
        amount.value = digitsOnly(amount.value);
        save.disabled = !(Number(amount.value) > 0);
      });
      el.querySelector("[data-toggle]").addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-gave]");
        if (!b) return;
        gave = b.dataset.gave === "1";
        el.querySelector("[data-toggle]").innerHTML = toggle();
        if (!initial) el.querySelector("h2").textContent = gave ? "You gave" : "You got";
      });
      const date = el.querySelector("[name=date]");
      date.addEventListener("change", () => {
        if (!date.value) return;
        day = isoToDay(date.value);
        el.querySelector("[data-date-label]").textContent = dateLabel(day);
      });
      el.querySelector("[data-delete]")?.addEventListener("click", () => {
        confirmDialog("Delete this entry?", "The balance will be recalculated without it.", "Delete", () => {
          store.deletePersonEntry(initial.id);
          close();
        });
      });
      if (!initial) amount.focus();
    },
    onConfirm: (el) => {
      const value = Number(el.querySelector("[name=amount]").value || 0);
      if (!(value > 0)) return false;
      store.savePersonEntry({
        id: initial?.id ?? 0,
        personId: person.id,
        amount: gave ? value : -value,
        note: el.querySelector("[name=note]").value.trim(),
        epochDay: day,
      });
    },
  });
}
