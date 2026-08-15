function setSheetsEnabled(enabled, names) {
  for (const sheet of document.styleSheets) {
    try {
      if (!sheet.href) continue;
      if (names.some((name) => sheet.href.includes(name))) {
        sheet.disabled = !enabled;
      }
    } catch {
      // Cross-origin or unloaded stylesheet.
    }
  }
}

function applyGate(state) {
  const enabled = Boolean(state?.enabled) && !state?.paused;
  const lists = state?.lists || {};
  document.documentElement.toggleAttribute("data-clearblock-off", !enabled);
  document.documentElement.setAttribute("data-clearblock-youtube", enabled && lists.youtube !== false ? "on" : "off");
  setSheetsEnabled(enabled && lists.ads !== false, ["generic-ads.css", "content.css"]);
  setSheetsEnabled(enabled && lists.annoyances !== false, ["generic-annoyances.css"]);
  setSheetsEnabled(enabled && lists.youtube !== false, ["youtube.css"]);
}

function refresh() {
  chrome.runtime.sendMessage({ type: "isSitePaused", url: location.href }, (response) => {
    if (chrome.runtime.lastError) {
      applyGate({ enabled: true, paused: false, lists: { ads: true, annoyances: true, youtube: true } });
      return;
    }
    applyGate(response);
  });
}

refresh();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.enabled || changes.pausedHosts || changes.lists) refresh();
});
