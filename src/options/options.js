const blockList = document.getElementById("block-list");
const allowList = document.getElementById("allow-list");
const pausedList = document.getElementById("paused-list");
const saveBtn = document.getElementById("save-btn");
const resetBtn = document.getElementById("reset-btn");
const saveStatus = document.getElementById("save-status");
const listAds = document.getElementById("list-ads");
const listTrackers = document.getElementById("list-trackers");
const listAnnoyances = document.getElementById("list-annoyances");
const listYoutube = document.getElementById("list-youtube");

function parseList(value) {
  const seen = new Set();
  return value
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase().replace(/^www\./, ""))
    .filter((line) => {
      if (!line || seen.has(line) || /[\s/]/.test(line)) return false;
      seen.add(line);
      return true;
    });
}

function toText(items) {
  return (items || []).join("\n");
}

function flash(message) {
  saveStatus.textContent = message;
  setTimeout(() => {
    saveStatus.textContent = "";
  }, 1500);
}

async function load() {
  const state = await chrome.storage.local.get({
    customBlock: [],
    customAllow: [],
    pausedHosts: [],
    lists: { ads: true, trackers: true, annoyances: true, youtube: true },
  });
  blockList.value = toText(state.customBlock);
  allowList.value = toText(state.customAllow);
  pausedList.value = toText(state.pausedHosts);
  listAds.checked = state.lists?.ads !== false;
  listTrackers.checked = state.lists?.trackers !== false;
  listAnnoyances.checked = state.lists?.annoyances !== false;
  listYoutube.checked = state.lists?.youtube !== false;
}

saveBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({
    customBlock: parseList(blockList.value),
    customAllow: parseList(allowList.value),
    pausedHosts: parseList(pausedList.value),
    lists: {
      ads: listAds.checked,
      trackers: listTrackers.checked,
      annoyances: listAnnoyances.checked,
      youtube: listYoutube.checked,
    },
  });
  flash("Saved");
});

resetBtn.addEventListener("click", async () => {
  await chrome.storage.local.set({ totalBlocked: 0 });
  flash("Stats reset");
});

load();
