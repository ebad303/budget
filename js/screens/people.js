// People: who owes whom (port of ui/people/PeopleScreen.kt).
// A positive balance means they owe you; negative means you owe them.

import * as store from "../store.js";
import { esc, rs, shortDay } from "../format.js";
import { card, emptyNote, field, openDialog, pillButton, sectionHeader } from "../ui.js";
import { go } from "../nav.js";

export const balanceClass = (b) => (b > 0 ? "good" : b < 0 ? "over" : "muted");
export const balanceLabel = (b) => (b > 0 ? "owes you" : b < 0 ? "you owe" : "settled");
const peopleCount = (n) => (n === 1 ? "1 person" : `${n} people`);

export function peopleScreen() {
  // Open balances first (largest first); settled people after, alphabetically.
  const people = store.peopleWithBalance()
    .sort((a, b) => ((a.balance === 0) - (b.balance === 0)) || (Math.abs(b.balance) - Math.abs(a.balance)));
  const owed = people.filter((p) => p.balance > 0);
  const owing = people.filter((p) => p.balance < 0);
  const total = (list) => Math.abs(list.reduce((s, p) => s + p.balance, 0));

  const totalCard = (label, amount, cls, note) => card(
    `<div class="label">${label}</div><div class="sp4"></div><div class="figure ${cls}">${rs(amount)}</div><div class="sp4"></div><div class="row-sub">${note}</div>`,
    "small pad16",
  );

  const rows = !people.length
    ? emptyNote("No one yet. Add a friend to track who owes whom.")
    : people.map((p, i) => `<div class="${i > 0 ? "divider" : ""}">
        <div class="entry-row" data-action="open" data-id="${p.id}">
          <div class="grow">
            <div class="row-title ellipsis">${esc(p.name)}</div>
            <div class="row-sub">${p.lastDay == null ? "No entries yet" : `Last: ${shortDay(p.lastDay)}`}</div>
          </div>
          <div class="end">
            <div class="row-amount ${balanceClass(p.balance)}">${rs(Math.abs(p.balance))}</div>
            <div class="row-sub">${balanceLabel(p.balance)}</div>
          </div>
        </div></div>`).join("");

  return {
    html: `
      <h1 class="display">People</h1>
      <div class="two">
        ${totalCard("You're owed", total(owed), "good", peopleCount(owed.length))}
        ${totalCard("You owe", total(owing), "over", peopleCount(owing.length))}
      </div>
      ${card(sectionHeader("Accounts", "balance") + rows, "list")}
      ${pillButton("Add person", "add", { iconName: "plus", cls: "fab" })}`,
    actions: {
      open: (d) => go(`#/person/${d.id}`),
      add: () => personNameDialog("Add person", "", 0, (name) => go(`#/person/${store.addPerson(name)}`)),
    },
  };
}

/** Name prompt for adding or renaming a person; refuses names already in use. */
export function personNameDialog(title, initial, exceptId, onSave) {
  openDialog({
    title,
    confirm: "Save",
    confirmDisabled: !initial,
    body: field("Name", { name: "name", value: initial, autocap: "words" }),
    onOpen: (el) => {
      const name = el.querySelector("[name=name]");
      const save = el.querySelector("[data-dlg=confirm]");
      name.addEventListener("input", () => {
        save.disabled = !name.value.trim();
        el.querySelector("[data-hint=name]").textContent = "";
        name.closest(".field").classList.remove("error");
      });
      name.focus();
    },
    onConfirm: (el) => {
      const name = el.querySelector("[name=name]").value.trim();
      if (!name) return false;
      if (store.personNameTaken(name, exceptId)) {
        el.querySelector("[data-hint=name]").textContent = "You already have someone with this name";
        el.querySelector("[name=name]").closest(".field").classList.add("error");
        return false;
      }
      onSave(name);
    },
  });
}
