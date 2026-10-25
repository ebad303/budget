// Hash-based navigation: #/home, #/reports, #/budgets, #/people, #/person/12, #/history, #/entry/0.

let depth = 0;

export function go(path) {
  depth++;
  location.hash = path;
}

/** Back to the previous screen, or [fallback] when the app was opened straight onto this one. */
export function back(fallback = "#/home") {
  if (depth > 0) {
    depth--;
    history.back();
  } else {
    location.replace(fallback);
  }
}

export function currentRoute() {
  const [name = "home", param] = location.hash.replace(/^#\/?/, "").split("/");
  return { name: name || "home", id: param != null ? Number(param) : 0 };
}
