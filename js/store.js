// All app data, kept on the device in localStorage (port of data/Repository.kt + the Room DAOs).
// Tables mirror the Android database: categories, entries, people, personEntries, plus the monthly budget.

import { ymStart, ymEnd, ymKey, ymOfDay } from "./format.js";

const KEY = "budget-data";
const STARTER_CATEGORIES = ["Eating out", "Fuel", "Groceries", "Bills", "Transport"];

function seed() {
  return {
    version: 1,
    seq: STARTER_CATEGORIES.length,
    categories: STARTER_CATEGORIES.map((name, i) => ({ id: i + 1, name, budget: null })),
    entries: [],
    monthlyBudget: null,
    people: [],
    personEntries: [],
  };
}

function isValid(d) {
  return d && Array.isArray(d.categories) && Array.isArray(d.entries) &&
    Array.isArray(d.people) && Array.isArray(d.personEntries) && typeof d.seq === "number";
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      if (isValid(d)) return d;
    }
  } catch (e) {
    console.warn("Could not read saved data", e);
  }
  return seed();
}

let data = load();
const listeners = new Set();

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function commit() {
  localStorage.setItem(KEY, JSON.stringify(data));
  listeners.forEach((fn) => fn());
}

const nextId = () => ++data.seq;
const lower = (s) => s.toLowerCase();
const byNewest = (a, b) => (b.epochDay - a.epochDay) || (b.createdAt - a.createdAt);

/** Asks the browser not to clear our data when space is low (best effort). */
export function requestPersistence() {
  navigator.storage?.persist?.().catch(() => {});
}

// Categories

export function categories() {
  return [...data.categories].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

const categoryById = (id) => data.categories.find((c) => c.id === id);
const findCategory = (name) => data.categories.find((c) => lower(c.name) === lower(name.trim()));

/** Returns the existing category with this name (any case), or creates it. */
export function addCategory(name, budget = null) {
  const clean = name.trim();
  const existing = findCategory(clean);
  if (existing) return existing;
  const c = { id: nextId(), name: clean, budget };
  data.categories.push(c);
  commit();
  return c;
}

export function updateCategory(category) {
  const c = categoryById(category.id);
  if (!c) return;
  c.name = category.name.trim();
  c.budget = category.budget;
  commit();
}

/** Entries in the category are kept, but become uncategorised. */
export function deleteCategory(id) {
  data.categories = data.categories.filter((c) => c.id !== id);
  data.entries.forEach((e) => { if (e.categoryId === id) e.categoryId = null; });
  commit();
}

export function categoryNameTaken(name, exceptId = 0) {
  const c = findCategory(name);
  return !!c && c.id !== exceptId;
}

export const monthlyBudget = () => data.monthlyBudget;
export function setMonthlyBudget(amount) {
  data.monthlyBudget = amount;
  commit();
}

// Entries (expenses and income)

function withCategory(e) {
  return { ...e, categoryName: e.categoryId != null ? categoryById(e.categoryId)?.name ?? null : null };
}

export function entriesBetween(fromDay, toDay) {
  return data.entries.filter((e) => e.epochDay >= fromDay && e.epochDay <= toDay).sort(byNewest).map(withCategory);
}

export const entriesIn = (ym) => entriesBetween(ymStart(ym), ymEnd(ym));
export const allEntries = () => [...data.entries].sort(byNewest).map(withCategory);
export const getEntry = (id) => data.entries.find((e) => e.id === id) ?? null;

/** Expense totals per category for a month, biggest first. */
export function expenseByCategory(ym) {
  const totals = new Map();
  for (const e of entriesIn(ym)) {
    if (e.type !== "EXPENSE") continue;
    const t = totals.get(e.categoryId) ?? { categoryId: e.categoryId, categoryName: e.categoryName, total: 0 };
    t.total += e.amount;
    totals.set(e.categoryId, t);
  }
  return [...totals.values()].sort((a, b) => b.total - a.total);
}

/** Expense totals keyed by "yyyy-MM" between two months (inclusive). */
export function monthlyExpense(fromYm, toYm) {
  const totals = {};
  for (const e of entriesBetween(ymStart(fromYm), ymEnd(toYm))) {
    if (e.type !== "EXPENSE") continue;
    const k = ymKey(ymOfDay(e.epochDay));
    totals[k] = (totals[k] ?? 0) + e.amount;
  }
  return totals;
}

export function saveEntry(entry) {
  const row = {
    id: entry.id || nextId(),
    name: entry.name,
    amount: entry.amount,
    type: entry.type,
    categoryId: entry.categoryId ?? null,
    epochDay: entry.epochDay,
    createdAt: Date.now(),
  };
  const i = data.entries.findIndex((e) => e.id === row.id);
  if (i >= 0) data.entries[i] = row; else data.entries.push(row);
  commit();
}

export function deleteEntry(id) {
  data.entries = data.entries.filter((e) => e.id !== id);
  commit();
}

export function insertEntries(list) {
  for (const e of list) data.entries.push({ ...e, id: nextId(), createdAt: Date.now() });
  commit();
}

export const categoriesSnapshot = () => data.categories.map((c) => ({ ...c }));

// People and their ledgers

/** Everyone with their balance: positive means they owe you, negative means you owe them. */
export function peopleWithBalance() {
  return [...data.people]
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
    .map((p) => {
      const lines = data.personEntries.filter((e) => e.personId === p.id);
      return {
        id: p.id,
        name: p.name,
        balance: lines.reduce((s, e) => s + e.amount, 0),
        entryCount: lines.length,
        lastDay: lines.length ? Math.max(...lines.map((e) => e.epochDay)) : null,
      };
    });
}

export const person = (id) => data.people.find((p) => p.id === id) ?? null;

export function personEntries(personId) {
  return data.personEntries.filter((e) => e.personId === personId).sort(byNewest);
}

export function addPerson(name) {
  const p = { id: nextId(), name: name.trim(), createdAt: Date.now() };
  data.people.push(p);
  commit();
  return p.id;
}

export function renamePerson(id, name) {
  const p = person(id);
  if (!p) return;
  p.name = name.trim();
  commit();
}

/** Also deletes their ledger. */
export function deletePerson(id) {
  data.people = data.people.filter((p) => p.id !== id);
  data.personEntries = data.personEntries.filter((e) => e.personId !== id);
  commit();
}

export function personNameTaken(name, exceptId = 0) {
  const p = data.people.find((x) => lower(x.name) === lower(name.trim()));
  return !!p && p.id !== exceptId;
}

/** [entry.amount] is signed: positive when you gave, negative when you got. */
export function savePersonEntry(entry) {
  const existing = data.personEntries.find((e) => e.id === entry.id);
  if (existing) {
    Object.assign(existing, { amount: entry.amount, note: entry.note, epochDay: entry.epochDay });
  } else {
    data.personEntries.push({
      id: nextId(),
      personId: entry.personId,
      amount: entry.amount,
      note: entry.note,
      epochDay: entry.epochDay,
      createdAt: Date.now(),
    });
  }
  commit();
}

export function deletePersonEntry(id) {
  data.personEntries = data.personEntries.filter((e) => e.id !== id);
  commit();
}

// Full backup (everything, including people) as JSON

export function backupJson() {
  return JSON.stringify({ app: "budget", ...data }, null, 1);
}

/** Replaces all data with a backup. Throws if the file isn't a Budget backup. */
export function restoreJson(text) {
  const d = JSON.parse(text);
  delete d.app;
  if (!isValid(d)) throw new Error("This isn't a Budget backup file.");
  data = d;
  commit();
}
