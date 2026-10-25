// App shell: routing, the bottom tab bar and click handling (port of MainActivity.kt).

import * as store from "./store.js";
import { icon } from "./ui.js";
import { currentRoute, go } from "./nav.js";
import { homeScreen } from "./screens/home.js";
import { reportsScreen } from "./screens/reports.js";
import { budgetsScreen } from "./screens/budgets.js";
import { peopleScreen } from "./screens/people.js";
import { personScreen } from "./screens/person.js";
import { historyScreen } from "./screens/history.js";
import { entryScreen } from "./screens/entry.js";

const TABS = [
  { route: "home", label: "Home", icon: "home", screen: homeScreen },
  { route: "reports", label: "Reports", icon: "reports", screen: reportsScreen },
  { route: "budgets", label: "Budgets", icon: "budget", screen: budgetsScreen },
  { route: "people", label: "People", icon: "people", screen: peopleScreen },
  { route: "history", label: "History", icon: "history", screen: historyScreen },
];
const OTHER = { entry: entryScreen, person: personScreen };

const screenEl = document.getElementById("screen");
const tabbarEl = document.getElementById("tabbar");
let actions = {};
let lastHash = null;

function render() {
  const route = currentRoute();
  const entered = location.hash !== lastHash;
  lastHash = location.hash;

  const tab = TABS.find((t) => t.route === route.name);
  const screenFn = tab?.screen ?? OTHER[route.name] ?? homeScreen;
  const s = screenFn(route, entered);

  screenEl.className = "screen" + (tab ? "" : " no-tabs");
  screenEl.innerHTML = s.html;
  actions = s.actions ?? {};
  s.mount?.(screenEl, render);
  if (entered) window.scrollTo(0, 0);

  // The bar hides on the entry and person screens.
  tabbarEl.hidden = !tab;
  tabbarEl.innerHTML = TABS.map((t) => `<button class="tab ${t === tab ? "on" : ""}" data-tab="${t.route}" role="tab" aria-selected="${t === tab}">${icon(t.icon, 20)}<span>${t.label}</span></button>`).join("");
}

screenEl.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-action]");
  if (!el || el.disabled) return;
  actions[el.dataset.action]?.(el.dataset, el, render);
});

tabbarEl.addEventListener("click", (ev) => {
  const b = ev.target.closest("[data-tab]");
  if (b && b.dataset.tab !== currentRoute().name) go(`#/${b.dataset.tab}`);
});

window.addEventListener("hashchange", render);
store.subscribe(render);
store.requestPersistence();
render();

// Offline support: cache the app so it opens without a connection.
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch((e) => console.warn("Offline cache unavailable", e));
}
