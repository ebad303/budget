// CSV export and forgiving import (port of data/Csv.kt). Same file format as the Android app,
// so a CSV exported on one can be imported on the other.

import * as store from "./store.js";
import { dayOf, dayToIso, isValidDate, MONTHS } from "./format.js";

const HEADER = ["date", "name", "amount", "type", "category"];
/** A trailing "(Page.md)" or "(https://…)" that Notion adds to relation cells. */
const NOTION_LINK = /\s*\([^()]*(?:\.md|https?:\/\/)[^()]*\)\s*$/;

export function exportCsv() {
  const entries = [...store.allEntries()].sort((a, b) => a.epochDay - b.epochDay);
  const lines = [HEADER.join(",")];
  for (const e of entries) {
    lines.push([dayToIso(e.epochDay), e.name, String(e.amount), e.type.toLowerCase(), e.categoryName ?? ""]
      .map(escape).join(","));
  }
  return { text: lines.join("\n") + "\n", count: entries.length };
}

function escape(v) {
  return /[,"\n\r]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

/** Imports a CSV of entries or of categories; returns a human-readable summary. */
export function importCsv(text) {
  const content = read(text);
  let result;
  if (content.kind === "unrecognised") result = { error: content.reason };
  else if (content.kind === "categories") result = importCategories(content.categories);
  else result = importEntries(content.entries, content.skipped);
  return summary({ imported: 0, duplicates: 0, skipped: [], newCategories: 0, updatedCategories: 0, error: null, ...result });
}

export function summary(r) {
  if (r.error) return r.error;
  let s = "";
  if (r.imported > 0 || (r.newCategories === 0 && r.updatedCategories === 0)) s += `Imported ${r.imported} entries.`;
  if (r.newCategories > 0) s += `\nAdded ${r.newCategories} categories.`;
  if (r.updatedCategories > 0) s += `\nUpdated ${r.updatedCategories} category budgets.`;
  if (r.duplicates > 0) s += `\nSkipped ${r.duplicates} already in the app.`;
  if (r.skipped.length) {
    s += `\n\nLeft out ${r.skipped.length} rows:`;
    for (const row of r.skipped.slice(0, 10)) {
      s += `\n• Line ${row.line}: ${row.name.trim() || "(no name)"} — ${row.reason}`;
    }
    if (r.skipped.length > 10) s += `\n• …and ${r.skipped.length - 10} more`;
  }
  return s.trim();
}

export function read(text) {
  const rows = parse(text.replace(/^﻿/, ""));
  if (!rows.length) return { kind: "unrecognised", reason: "The file is empty." };

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const col = (...names) => {
    let i = header.findIndex((h) => names.includes(h));
    if (i < 0) i = header.findIndex((h) => names.some((n) => h.includes(n)));
    return i;
  };

  const dateCol = col("date", "day", "when");
  const amountCol = col("amount", "price", "cost", "value", "pkr", "rs");
  const categoryCol = col("category", "categories", "tag", "tags");
  const budgetCol = col("monthly budget", "budget", "limit");

  // No dates or amounts but a category and a limit: a list of categories.
  if (dateCol < 0 && amountCol < 0 && categoryCol >= 0 && budgetCol >= 0) {
    const seen = new Set();
    const categories = [];
    for (const row of rows.slice(1)) {
      const name = cleanCategory(row[categoryCol]);
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      const budget = parseAmount(row[budgetCol]);
      categories.push([name, budget != null && budget > 0 ? budget : null]);
    }
    return { kind: "categories", categories };
  }

  const nameCol = col("name", "purchase", "entry", "title", "item", "description");
  const typeCol = col("type", "kind");
  if (nameCol < 0 || amountCol < 0) {
    return { kind: "unrecognised", reason: "Couldn't find a name and an amount column in this file." };
  }

  const entries = [];
  const skipped = [];
  rows.slice(1).forEach((row, index) => {
    const line = index + 2;
    const name = (row[nameCol] ?? "").trim();
    const amount = parseAmount(row[amountCol]);
    const date = dateCol >= 0 ? parseDate(row[dateCol]) : null;
    const reason = !name ? "no name" : (amount == null || amount === 0) ? "no amount" : date == null ? "no date" : null;
    if (reason) {
      skipped.push({ line, name, reason });
      return;
    }
    const kind = typeCol >= 0 ? (row[typeCol] ?? "").trim().toLowerCase() : "";
    const type = kind.startsWith("inc") ? "INCOME" : "EXPENSE";
    entries.push({
      name,
      amount: Math.abs(amount),
      type,
      categoryName: type === "INCOME" ? null : cleanCategory(categoryCol >= 0 ? row[categoryCol] : null),
      epochDay: date,
    });
  });
  return { kind: "entries", entries, skipped };
}

/** Splits CSV text into rows of cells, honouring quotes. Blank rows are dropped. */
export function parse(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const endRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((c) => c.trim())) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\r") { /* ignore */ }
    else if (c === "\n") endRow();
    else cell += c;
  }
  endRow();
  return rows;
}

/** "Rs 1,250.50" → 1251. Keeps digits, '.' and '-', then rounds. */
export function parseAmount(raw) {
  if (raw == null) return null;
  const digits = String(raw).replace(/[^\d.\-]/g, "");
  if (!digits || !/^-?\d*\.?\d+$|^-?\d+\.?$/.test(digits)) return null;
  const n = Number(digits);
  return Number.isFinite(n) ? Math.round(n) : null;
}

const monthIndex = (s) => {
  const t = s.toLowerCase().replace(/\.$/, "");
  const i = MONTHS.findIndex((m) => m.toLowerCase() === t || m.slice(0, 3).toLowerCase() === t);
  return i < 0 ? null : i + 1;
};

const tryDate = (y, m, d) => (m && isValidDate(y, m, d) ? dayOf(y, m, d) : null);

function parseOne(s) {
  let m;
  if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return tryDate(+m[1], +m[2], +m[3]);
  if ((m = s.match(/^([A-Za-z]+\.?) (\d{1,2}), (\d{4})$/))) return tryDate(+m[3], monthIndex(m[1]), +m[2]);
  if ((m = s.match(/^(\d{1,2}) ([A-Za-z]+\.?) (\d{4})$/))) return tryDate(+m[3], monthIndex(m[2]), +m[1]);
  if ((m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))) {
    // Day first (dd/MM/yyyy), falling back to month first (MM/dd/yyyy) when that's impossible.
    return tryDate(+m[3], +m[2], +m[1]) ?? tryDate(+m[3], +m[1], +m[2]);
  }
  if ((m = s.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/))) return tryDate(+m[1], +m[2], +m[3]);
  return null;
}

/** Accepts the same formats as the Android app, ignoring times and the end of "a → b" ranges. */
export function parseDate(raw) {
  const text = String(raw ?? "").split("→")[0].trim();
  if (!text) return null;
  const candidates = [text, text.split("T")[0], text.replace(/\s+\d{1,2}:\d{2}.*$/, "")];
  for (const c of candidates) {
    const day = parseOne(c.trim());
    if (day != null) return day;
  }
  return null;
}

/** Takes the first category from a cell and drops Notion link suffixes. */
export function cleanCategory(raw) {
  const text = String(raw ?? "").trim();
  let first;
  if (text.includes(".md)") || text.includes("http")) {
    // Split on commas that follow a ")" (no lookbehind: older iPhones don't support it).
    const parts = text.split(/\)\s*,\s*/);
    first = parts.length > 1 ? parts[0] + ")" : parts[0];
  } else {
    first = text.split(",")[0];
  }
  const name = first.replace(NOTION_LINK, "").trim();
  return name || null;
}

function importCategories(list) {
  const existing = new Map(store.categoriesSnapshot().map((c) => [c.name.toLowerCase(), c]));
  let newCategories = 0;
  let updatedCategories = 0;
  for (const [name, budget] of list) {
    const current = existing.get(name.toLowerCase());
    if (!current) {
      store.addCategory(name, budget);
      newCategories++;
    } else if (budget != null && current.budget !== budget) {
      store.updateCategory({ ...current, budget });
      updatedCategories++;
    }
  }
  return { newCategories, updatedCategories };
}

function importEntries(entries, skipped) {
  const key = (name, amount, day, type) => `${name.toLowerCase()}|${amount}|${day}|${type}`;
  const byName = new Map(store.categoriesSnapshot().map((c) => [c.name.toLowerCase(), c]));
  const seen = new Set(store.allEntries().map((e) => key(e.name, e.amount, e.epochDay, e.type)));
  let newCategories = 0;
  let duplicates = 0;
  const toInsert = [];
  for (const p of entries) {
    if (seen.has(key(p.name, p.amount, p.epochDay, p.type))) { duplicates++; continue; }
    seen.add(key(p.name, p.amount, p.epochDay, p.type));
    let categoryId = null;
    if (p.categoryName) {
      let c = byName.get(p.categoryName.toLowerCase());
      if (!c) {
        c = store.addCategory(p.categoryName);
        byName.set(c.name.toLowerCase(), c);
        newCategories++;
      }
      categoryId = c.id;
    }
    toInsert.push({ name: p.name, amount: p.amount, type: p.type, categoryId, epochDay: p.epochDay });
  }
  store.insertEntries(toInsert);
  return { imported: toInsert.length, duplicates, skipped, newCategories };
}
