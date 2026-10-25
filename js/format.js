// Money and date formatting (port of ui/Format.kt).
// Dates are "epoch days" (days since 1970-01-01), months are { y, m } with m = 1..12.

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const MON = MONTHS.map((m) => m.slice(0, 3));
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_MS = 86400000;

const pad = (n) => String(n).padStart(2, "0");

export function groupDigits(n) {
  return Math.round(n).toLocaleString("en-US");
}

/** "Rs 1,250", or "−Rs 1,250" (real minus sign) when negative. */
export function rs(v) {
  return v < 0 ? "−Rs " + groupDigits(-v) : "Rs " + groupDigits(v);
}

/** Digits only, no leading zeros, at most 12 characters. */
export function digitsOnly(text) {
  return String(text).replace(/\D/g, "").replace(/^0+/, "").slice(0, 12);
}

export function dayOf(y, m, d) {
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function todayDay() {
  const n = new Date();
  return dayOf(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

export function dayParts(day) {
  const d = new Date(day * DAY_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), wd: d.getUTCDay() };
}

export function dayToIso(day) {
  const p = dayParts(day);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function isoToDay(s) {
  const [y, m, d] = s.split("-").map(Number);
  return dayOf(y, m, d);
}

export function isValidDate(y, m, d) {
  if (!(m >= 1 && m <= 12 && d >= 1 && y >= 1000)) return false;
  return dayParts(dayOf(y, m, d)).d === d;
}

// Months

export const ymOfDay = (day) => { const p = dayParts(day); return { y: p.y, m: p.m }; };
export const currentYm = () => ymOfDay(todayDay());
export const ymKey = (ym) => `${ym.y}-${pad(ym.m)}`;
export const ymEquals = (a, b) => a.y === b.y && a.m === b.m;
export const ymCompare = (a, b) => (a.y - b.y) || (a.m - b.m);
export function addMonths(ym, n) {
  const i = ym.y * 12 + (ym.m - 1) + n;
  return { y: Math.floor(i / 12), m: (i % 12) + 1 };
}
export const ymStart = (ym) => dayOf(ym.y, ym.m, 1);
export const ymEnd = (ym) => dayOf(ym.y, ym.m + 1, 1) - 1;
export const lengthOfMonth = (ym) => ymEnd(ym) - ymStart(ym) + 1;

// Labels

/** "Today", "Yesterday" or "Mon, 3 Mar". */
export function dayHeading(day, today = todayDay()) {
  if (day === today) return "Today";
  if (day === today - 1) return "Yesterday";
  const p = dayParts(day);
  return `${DAYS[p.wd].slice(0, 3)}, ${p.d} ${MON[p.m - 1]}`;
}

/** "Today, 3 Mar 2026", "Yesterday, …" or "Monday, 3 Mar 2026". */
export function dateLabel(day, today = todayDay()) {
  const p = dayParts(day);
  const full = `${p.d} ${MON[p.m - 1]} ${p.y}`;
  if (day === today) return "Today, " + full;
  if (day === today - 1) return "Yesterday, " + full;
  return `${DAYS[p.wd]}, ${full}`;
}

/** "March" this year, "March 2025" otherwise. */
export function monthHeading(ym, now = currentYm()) {
  return ym.y === now.y ? MONTHS[ym.m - 1] : `${MONTHS[ym.m - 1]} ${ym.y}`;
}

export const monthShort = (ym) => MON[ym.m - 1];
export const monthShortYear = (ym) => `${MON[ym.m - 1]} ${ym.y}`;
export function shortDay(day) {
  const p = dayParts(day);
  return `${p.d} ${MON[p.m - 1]}`;
}

/** Escapes text for safe use inside HTML. */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
