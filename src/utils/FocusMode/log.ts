const LOG_KEY = "focusmode:log";

/** Last 50 Focus Mode events in localStorage "focusmode:log", for checking it in the real app. */
export function focusLog(ev: string, extra?: Record<string, unknown>) {
  try {
    const list = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    list.push({ t: Date.now(), ev, ...extra });
    localStorage.setItem(LOG_KEY, JSON.stringify(list.slice(-50)));
  } catch {}
}
