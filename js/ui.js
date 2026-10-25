// Shared UI pieces (port of ui/components/Components.kt and Icons.kt), as HTML-string helpers,
// plus dialogs and toasts. Clicks are handled by each screen through data-action attributes.

import { esc, rs } from "./format.js";

const ICONS = {
  home: ["M4 11l8-6 8 6v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"],
  reports: ["M5 20V10M12 20V4M19 20v-7"],
  budget: ["M12 4a8 8 0 1 1 0 16a8 8 0 1 1 0-16z", "M12 4v8l5 5"],
  history: ["M4 7h16M4 12h16M4 17h10"],
  search: ["M11 4a7 7 0 1 1 0 14a7 7 0 1 1 0-14z", "M20 20l-3.5-3.5"],
  plus: ["M12 5v14M5 12h14", 2],
  close: ["M6 6l12 12M18 6L6 18"],
  chevronLeft: ["M15 6l-6 6 6 6", 2],
  chevronRight: ["M9 6l6 6-6 6", 2],
  chevronDown: ["M6 9l6 6 6-6", 2.5],
  transfer: ["M12 4v11M7 10l5 5 5-5M5 20h14"],
  trash: ["M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"],
  people: ["M12 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8z", "M4.5 20c1.4-3.6 4.2-5.5 7.5-5.5s6.1 1.9 7.5 5.5"],
  pencil: ["M5 19h3.5L19 8.5 15.5 5 5 15.5z", "M13.5 7l3.5 3.5"],
};

export function icon(name, size = 20) {
  const spec = ICONS[name];
  const stroke = typeof spec[spec.length - 1] === "number" ? spec[spec.length - 1] : 1.75;
  const paths = spec.filter((p) => typeof p === "string").map((d) => `<path d="${d}"/>`).join("");
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

const attrs = (o = {}) => Object.entries(o).map(([k, v]) => ` ${k}="${esc(v)}"`).join("");

export const card = (inner, cls = "", extra = {}) => `<div class="card ${cls}"${attrs(extra)}>${inner}</div>`;

export function sectionHeader(title, trailing) {
  return `<div class="section-header"><h2 class="section">${esc(title)}</h2>${trailing ? `<span class="row-sub">${esc(trailing)}</span>` : ""}</div>`;
}

export const emptyNote = (text, cls = "label") => `<div class="empty ${cls}">${esc(text)}</div>`;

/** One expense or income line. Income shows as "+Rs …" in green. */
export function entryRow({ name, subtitle, amount, income, action, id, divider }) {
  return `<div class="${divider ? "divider" : ""}">
    <div class="entry-row" data-action="${action}" data-id="${id}">
      <div class="grow">
        <div class="row-title ellipsis">${esc(name)}</div>
        ${subtitle ? `<div class="row-sub ellipsis">${esc(subtitle)}</div>` : ""}
      </div>
      <div class="row-amount ${income ? "good" : ""}">${income ? "+" : ""}${rs(amount)}</div>
    </div>
  </div>`;
}

export function progress(fraction, { cls = "", fill, track, trackBorder, fillBorder } = {}) {
  const f = Math.max(0, Math.min(1, fraction || 0));
  const outer = [track && `background:${track}`, trackBorder && `border-color:${trackBorder}`].filter(Boolean).join(";");
  const inner = [`width:${(f * 100).toFixed(1)}%`, fill && `background:${fill}`, fillBorder && `border:1px solid ${fillBorder}`]
    .filter(Boolean).join(";");
  return `<div class="progress ${cls}" style="${outer}">${f > 0 ? `<i style="${inner}"></i>` : ""}</div>`;
}

export const statusPill = (text, bg, fg) => `<span class="status-pill" style="background:${bg};color:${fg}">${esc(text)}</span>`;

export function pillButton(text, action, { iconName, cls = "", disabled = false, extra = {} } = {}) {
  return `<button class="pill-btn ${cls}" data-action="${action}"${disabled ? " disabled" : ""}${attrs(extra)}>${iconName ? icon(iconName, 18) : ""}${esc(text)}</button>`;
}

export function circleBtn(iconName, label, action, cls = "") {
  return `<button class="circle-btn ${cls}" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}">${icon(iconName, cls.includes("sm") ? 16 : 20)}</button>`;
}

export function chip(text, on, action, { dashed = false, leading, trailing, extra = {}, inner = "" } = {}) {
  return `<button class="chip ${on ? "on" : ""} ${dashed ? "dashed" : ""}" data-action="${action}"${attrs(extra)}>${leading ? icon(leading, 14) : ""}${esc(text)}${trailing ? icon(trailing, 12) : ""}${inner}</button>`;
}

/** An outlined text field like Material's OutlinedTextField. */
export function field(label, { name, value = "", prefix = "", placeholder = "", inputmode = "text", autocap = "sentences", error = "" } = {}) {
  return `<label class="field ${error ? "error" : ""}">
    <span>${esc(label)}</span>
    <div class="box">${prefix ? `<span class="muted">${esc(prefix)}</span>` : ""}<input name="${name}" value="${esc(value)}" placeholder="${esc(placeholder)}" inputmode="${inputmode}" autocapitalize="${autocap}" autocomplete="off"></div>
    <div class="hint" data-hint="${name}">${esc(error)}</div>
  </label>`;
}

// Dialogs

const layer = () => document.getElementById("layer");

/**
 * Opens a modal dialog. [onConfirm] gets the dialog element; returning false keeps it open.
 * Returns a function that closes it.
 */
export function openDialog({ title, body = "", confirm = "OK", cancel = "Cancel", danger = false, onConfirm, onOpen, confirmDisabled = false }) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `<div class="dialog" role="dialog" aria-modal="true">
    ${title ? `<h2>${esc(title)}</h2>` : ""}
    <div class="stack gap12">${body}</div>
    <div class="dialog-actions">
      ${cancel ? `<button class="text-btn" data-dlg="cancel">${esc(cancel)}</button>` : ""}
      ${confirm ? `<button class="text-btn ${danger ? "danger" : ""}" data-dlg="confirm"${confirmDisabled ? " disabled" : ""}>${esc(confirm)}</button>` : ""}
    </div>
  </div>`;
  const close = () => overlay.remove();
  overlay.addEventListener("click", (ev) => {
    if (ev.target === overlay) return close();
    const b = ev.target.closest("[data-dlg]");
    if (!b) return;
    if (b.dataset.dlg === "cancel") return close();
    if (b.dataset.dlg === "confirm" && (!onConfirm || onConfirm(overlay.querySelector(".dialog")) !== false)) close();
  });
  layer().appendChild(overlay);
  onOpen?.(overlay.querySelector(".dialog"), close);
  return close;
}

/** "Are you sure?" dialog with a red confirm button. */
export function confirmDialog(title, message, confirm, onConfirm) {
  openDialog({ title, body: `<div class="msg">${esc(message)}</div>`, confirm, danger: true, onConfirm });
}

/** A simple message dialog with an OK button (scrolls if long). */
export function messageDialog(title, message) {
  openDialog({ title, body: `<div class="msg">${esc(message)}</div>`, confirm: "OK", cancel: "" });
}

/** A list of choices; the [on] item is shown in bold. */
export function menuDialog(title, items) {
  const close = openDialog({
    title,
    confirm: "",
    body: items.map((it, i) => `<button class="menu-item ${it.on ? "on" : ""}" data-item="${i}">${esc(it.label)}</button>`).join(""),
    onOpen: (el) => el.addEventListener("click", (ev) => {
      const b = ev.target.closest("[data-item]");
      if (!b) return;
      close();
      items[+b.dataset.item].action();
    }),
  });
}

export function toast(message) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = message;
  layer().appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

/** Lets the user save a file: the iPhone share sheet when available, otherwise a download. */
export async function saveFile(filename, text, type) {
  const file = new File([text], filename, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (e) {
      if (e.name === "AbortError") return false;
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

/** Opens the file picker and resolves with the chosen file's text (or null). */
export function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = accept;
    input.onchange = async () => resolve(input.files[0] ? await input.files[0].text() : null);
    input.click();
  });
}
