// History: search and filter all entries, plus CSV import/export and full backups (port of ui/history/HistoryScreen.kt).

import * as store from "../store.js";
import { exportCsv, importCsv } from "../csv.js";
import { addMonths, currentYm, dayOf, dayParts, dayToIso, esc, monthHeading, rs, shortDay, todayDay, ymEnd, ymKey, ymOfDay, ymStart } from "../format.js";
import { card, circleBtn, confirmDialog, emptyNote, entryRow, icon, menuDialog, messageDialog, pickFile, saveFile, sectionHeader, toast } from "../ui.js";
import { go } from "../nav.js";

const PERIODS = [
  ["THIS_MONTH", "This month"],
  ["LAST_3_MONTHS", "Last 3 months"],
  ["THIS_YEAR", "This year"],
  ["ALL", "All time"],
];
const TYPES = [["ALL", "Expenses & income"], ["EXPENSES", "Expenses"], ["INCOME", "Income"]];

const filters = { query: "", period: "LAST_3_MONTHS", categoryId: null, type: "ALL" };

function range(period) {
  const cur = currentYm();
  const y = dayParts(todayDay()).y;
  switch (period) {
    case "THIS_MONTH": return [ymStart(cur), ymEnd(cur)];
    case "LAST_3_MONTHS": return [ymStart(addMonths(cur, -2)), ymEnd(cur)];
    case "THIS_YEAR": return [dayOf(y, 1, 1), dayOf(y, 12, 31)];
    default: return [dayOf(1970, 1, 1), dayOf(2200, 1, 1)];
  }
}

function results() {
  const [from, to] = range(filters.period);
  const q = filters.query.trim().toLowerCase();
  const matching = store.entriesBetween(from, to).filter((e) =>
    (!q || e.name.toLowerCase().includes(q) || (e.categoryName ?? "").toLowerCase().includes(q)) &&
    (filters.categoryId == null || e.categoryId === filters.categoryId) &&
    (filters.type === "ALL" || (filters.type === "EXPENSES" ? e.type === "EXPENSE" : e.type === "INCOME")));

  const months = [];
  for (const e of matching) {
    const k = ymKey(ymOfDay(e.epochDay));
    if (!months.length || months[months.length - 1].key !== k) months.push({ key: k, ym: ymOfDay(e.epochDay), entries: [] });
    months[months.length - 1].entries.push(e);
  }
  const spent = matching.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);
  const income = matching.filter((e) => e.type === "INCOME").reduce((s, e) => s + e.amount, 0);
  const count = matching.length;

  const summary = card(`<div class="row"><span class="label grow">${count === 1 ? "1 entry matches" : `${count} entries match`}</span>
    <span class="row-amount" style="font-size:14px">${income > 0 ? `Spent ${rs(spent)} · In ${rs(income)}` : `Spent ${rs(spent)}`}</span></div>`,
  "small", { style: "padding:12px 16px" });

  const groups = !months.length
    ? card(emptyNote("No entries match these filters."))
    : months.map((g) => {
      const net = g.entries.filter((e) => e.type === "EXPENSE").reduce((s, e) => s + e.amount, 0);
      return card(sectionHeader(monthHeading(g.ym), rs(net)) + g.entries.map((e, i) => entryRow({
        name: e.name,
        subtitle: `${shortDay(e.epochDay)} · ${e.type === "INCOME" ? "Income" : e.categoryName ?? "Uncategorised"}`,
        amount: e.amount,
        income: e.type === "INCOME",
        action: "edit",
        id: e.id,
        divider: i > 0,
      })).join(""), "list");
    }).join("");

  return summary + groups;
}

/** A chip with a native picker laid over it, so the iPhone shows its own selection wheel. */
function filterChip(label, active, name, options, selected) {
  const select = `<select class="overlay-input" data-filter="${name}" aria-label="${esc(label)}">${options
    .map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(selected) ? " selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
  return `<span class="chip ${active ? "on" : ""}">${esc(label)}${icon("chevronDown", 12)}${select}</span>`;
}

export function historyScreen() {
  const categories = store.categories();
  const period = PERIODS.find(([v]) => v === filters.period)[1];
  const category = categories.find((c) => c.id === filters.categoryId)?.name ?? "All categories";
  const type = TYPES.find(([v]) => v === filters.type)[1];

  return {
    html: `
      <div class="row"><h1 class="display grow">History</h1>${circleBtn("transfer", "Import or export", "menu")}</div>
      ${card(`<div class="search">${icon("search", 18).replace("<svg", '<svg style="color:var(--muted)"')}
        <input type="search" data-search placeholder="Search entries" value="${esc(filters.query)}" enterkeyhint="search" autocomplete="off">
        ${filters.query ? circleBtn("close", "Clear search", "clear", "sm") : ""}</div>`, "small", { style: "padding:0 16px" })}
      <div class="chips scroll">
        ${filterChip(period, filters.period !== "ALL", "period", PERIODS, filters.period)}
        ${filterChip(category, filters.categoryId != null, "category", [["", "All categories"], ...categories.map((c) => [c.id, c.name])], filters.categoryId ?? "")}
        ${filterChip(type, filters.type !== "ALL", "type", TYPES, filters.type)}
      </div>
      <div class="stack gap12" data-results>${results()}</div>`,
    mount: (root, rerender) => {
      const search = root.querySelector("[data-search]");
      search.addEventListener("input", () => {
        const hadQuery = !!filters.query;
        filters.query = search.value;
        // Only the results change while typing, so the keyboard stays up.
        root.querySelector("[data-results]").innerHTML = results();
        if (hadQuery !== !!filters.query) {
          const pos = search.selectionStart;
          rerender();
          const s = document.querySelector("[data-search]");
          s.focus();
          s.setSelectionRange(pos, pos);
        }
      });
      root.querySelectorAll("[data-filter]").forEach((sel) => sel.addEventListener("change", () => {
        const v = sel.value;
        if (sel.dataset.filter === "period") filters.period = v;
        if (sel.dataset.filter === "type") filters.type = v;
        if (sel.dataset.filter === "category") filters.categoryId = v ? Number(v) : null;
        rerender();
      }));
    },
    actions: {
      edit: (d) => go(`#/entry/${d.id}`),
      clear: (d, el, rerender) => { filters.query = ""; rerender(); },
      menu: () => menuDialog("Import or export", [
        { label: "Export to CSV", action: exportEntries },
        { label: "Import from CSV", action: importEntries },
        { label: "Back up everything", action: backup },
        { label: "Restore from backup", action: restore },
      ]),
    },
  };
}

async function exportEntries() {
  const { text, count } = exportCsv();
  if (await saveFile(`budget-${dayToIso(todayDay())}.csv`, text, "text/csv")) toast(`Exported ${count} entries`);
}

async function importEntries() {
  const text = await pickFile(".csv,text/csv,text/comma-separated-values,text/plain");
  if (text == null) return;
  let report;
  try {
    report = importCsv(text);
  } catch (e) {
    report = "Import failed: " + e.message;
  }
  messageDialog("Import finished", report);
}

/** Everything, including people and their ledgers (CSV only covers entries). */
async function backup() {
  if (await saveFile(`budget-backup-${dayToIso(todayDay())}.json`, store.backupJson(), "application/json")) {
    toast("Backup saved");
  }
}

async function restore() {
  const text = await pickFile(".json,application/json,text/plain");
  if (text == null) return;
  confirmDialog("Restore this backup?", "Everything in the app now will be replaced by the backup.", "Restore", () => {
    try {
      store.restoreJson(text);
      toast("Backup restored");
    } catch (e) {
      messageDialog("Couldn't restore", e.message.startsWith("This isn't") ? e.message : "This isn't a Budget backup file.");
    }
  });
}
