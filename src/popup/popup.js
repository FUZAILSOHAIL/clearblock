const enabledToggle = document.getElementById("enabled-toggle");
const statusLabel = document.getElementById("status-label");
const pageCount = document.getElementById("page-count");
const totalCount = document.getElementById("total-count");
const hostLabel = document.getElementById("host-label");
const pauseBtn = document.getElementById("pause-btn");
const optionsBtn = document.getElementById("options-btn");
const listAds = document.getElementById("list-ads");
const listTrackers = document.getElementById("list-trackers");
const listAnnoyances = document.getElementById("list-annoyances");
const listYoutube = document.getElementById("list-youtube");

const listInputs = {
  ads: listAds,
  trackers: listTrackers,
  annoyances: listAnnoyances,
  youtube: listYoutube,
};

function render(state) {
  enabledToggle.checked = state.enabled;
  pageCount.textContent = state.pageBlocked.toLocaleString();
  totalCount.textContent = state.totalBlocked.toLocaleString();
  hostLabel.textContent = state.host || "No active tab";

  for (const [key, input] of Object.entries(listInputs)) {
    input.checked = state.lists?.[key] !== false;
    input.disabled = !state.enabled;
  }

  if (!state.enabled) {
    statusLabel.textContent = "Protection off";
    pauseBtn.disabled = true;
    pauseBtn.textContent = "Pause on this site";
    return;
  }

  pauseBtn.disabled = !state.host;
  if (state.paused) {
    statusLabel.textContent = "Paused on this site";
    pauseBtn.textContent = "Resume on this site";
  } else {
    statusLabel.textContent = "Full protection on";
    pauseBtn.textContent = "Pause on this site";
  }
}

async function refresh() {
  const state = await chrome.runtime.sendMessage({ type: "getPopupState" });
  render(state);
}

async function reloadActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id && tab.url && !tab.url.startsWith("chrome")) {
    await chrome.tabs.reload(tab.id);
  }
}

enabledToggle.addEventListener("change", async () => {
  await chrome.runtime.sendMessage({ type: "toggleEnabled" });
  await refresh();
  await reloadActiveTab();
});

pauseBtn.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "togglePauseSite" });
  await refresh();
  await reloadActiveTab();
});

for (const [key, input] of Object.entries(listInputs)) {
  input.addEventListener("change", async () => {
    await chrome.runtime.sendMessage({ type: "toggleList", list: key });
    await refresh();
    await reloadActiveTab();
  });
}

optionsBtn.addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});

refresh();
