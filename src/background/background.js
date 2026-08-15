const DEFAULT_STATE = {
  enabled: true,
  pausedHosts: [],
  customBlock: [],
  customAllow: [],
  totalBlocked: 0,
  lists: {
    ads: true,
    trackers: true,
    annoyances: true,
    youtube: true,
  },
};

const GROUP_ORDER = ["youtube", "ads", "trackers", "annoyances"];
const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "script",
  "image",
  "xmlhttprequest",
  "media",
  "font",
  "stylesheet",
  "object",
  "ping",
  "csp_report",
  "websocket",
  "webtransport",
  "webbundle",
  "other",
];

const tabBlocked = new Map();
let rulesetCache = null;
let pendingBlocked = 0;
let statsTimer = null;
let badgeTimer = null;
let badgeTabId = null;

function hostnameFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function getState() {
  const stored = await chrome.storage.local.get(DEFAULT_STATE);
  return {
    ...DEFAULT_STATE,
    ...stored,
    lists: { ...DEFAULT_STATE.lists, ...(stored.lists || {}) },
  };
}

async function setState(patch) {
  await chrome.storage.local.set(patch);
}

async function getRulesets() {
  if (rulesetCache) return rulesetCache;
  const response = await fetch(chrome.runtime.getURL("rules/rulesets.json"));
  rulesetCache = await response.json();
  return rulesetCache;
}

function blockRule(id, domain) {
  return {
    id,
    priority: 2,
    action: { type: "block" },
    condition: {
      urlFilter: domain.includes("/") || domain.startsWith("|") || domain.startsWith(".") ? domain : `||${domain}^`,
      resourceTypes: RESOURCE_TYPES.filter((type) => type !== "main_frame"),
    },
  };
}

function allowUrlRule(id, domain) {
  return {
    id,
    priority: 100,
    action: { type: "allow" },
    condition: {
      urlFilter: `||${domain}^`,
      resourceTypes: RESOURCE_TYPES,
    },
  };
}

function allowInitiatorRule(id, domain) {
  return {
    id,
    priority: 1000,
    action: { type: "allowAllRequests" },
    condition: {
      requestDomains: [domain],
      resourceTypes: ["main_frame", "sub_frame"],
    },
  };
}

async function syncDynamicRules() {
  const state = await getState();
  const existing = await chrome.declarativeNetRequest.getDynamicRules();
  const removeRuleIds = existing.map((rule) => rule.id);
  const addRules = [];

  if (state.enabled) {
    state.customBlock.forEach((domain, index) => {
      if (domain) addRules.push(blockRule(10000 + index, domain));
    });
    state.customAllow.forEach((domain, index) => {
      if (domain) addRules.push(allowUrlRule(20000 + index, domain));
    });
    [...new Set([...state.pausedHosts, ...state.customAllow])].forEach((domain, index) => {
      if (!domain) return;
      addRules.push(allowInitiatorRule(30000 + index, domain));
      addRules.push({
        id: 40000 + index,
        priority: 1000,
        action: { type: "allow" },
        condition: {
          initiatorDomains: [domain],
          resourceTypes: RESOURCE_TYPES,
        },
      });
    });
  }

  try {
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules,
    });
  } catch {
    const safeRules = addRules.filter((rule) => rule.action.type !== "allowAllRequests");
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds,
      addRules: safeRules,
    });
  }
}

async function syncStaticRulesets() {
  const state = await getState();
  const rulesets = await getRulesets();
  const allIds = rulesets.map((item) => item.id);

  try {
    await chrome.declarativeNetRequest.updateEnabledRulesets({
      disableRulesetIds: allIds,
    });
  } catch {
    // Some IDs may already be disabled.
  }

  if (!state.enabled) return;

  const wanted = GROUP_ORDER.flatMap((group) =>
    state.lists[group] === false ? [] : rulesets.filter((item) => item.group === group)
  );

  let enabledCount = 0;
  for (const ruleset of wanted) {
    const available = await chrome.declarativeNetRequest.getAvailableStaticRuleCount();
    if (enabledCount > 0 && available < ruleset.count) break;
    try {
      await chrome.declarativeNetRequest.updateEnabledRulesets({
        enableRulesetIds: [ruleset.id],
      });
      enabledCount += ruleset.count;
    } catch {
      break;
    }
  }
}

async function syncAllRules() {
  await syncDynamicRules();
  await syncStaticRulesets();
}

async function flushStats() {
  if (!pendingBlocked) return;
  const add = pendingBlocked;
  pendingBlocked = 0;
  const state = await getState();
  await setState({ totalBlocked: (state.totalBlocked || 0) + add });
}

async function updateBadge(tabId) {
  badgeTabId = tabId;
  if (badgeTimer) return;
  badgeTimer = setTimeout(async () => {
    badgeTimer = null;
    const id = badgeTabId;
    const state = await getState();
    const count = tabBlocked.get(id) || 0;
    const text = !state.enabled ? "OFF" : count > 0 ? String(Math.min(count, 99)) : "";
    const color = state.enabled ? "#0f9f6e" : "#6b7280";
    try {
      await chrome.action.setBadgeText({ tabId: id, text });
      await chrome.action.setBadgeBackgroundColor({ tabId: id, color });
    } catch {
      // Tab may have closed.
    }
  }, 200);
}

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.local.get(null);
  if (stored.enabled === undefined) {
    await chrome.storage.local.set(DEFAULT_STATE);
  }
  await syncAllRules();
});

chrome.runtime.onStartup.addListener(syncAllRules);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.enabled || changes.pausedHosts || changes.customBlock || changes.customAllow || changes.lists) {
    syncAllRules();
  }
});

if (chrome.declarativeNetRequest.onRuleMatchedDebug) {
  chrome.declarativeNetRequest.onRuleMatchedDebug.addListener((info) => {
    const tabId = info.tabId;
    if (typeof tabId !== "number" || tabId < 0) return;

    tabBlocked.set(tabId, (tabBlocked.get(tabId) || 0) + 1);
    pendingBlocked += 1;
    updateBadge(tabId);
    if (!statsTimer) {
      statsTimer = setTimeout(() => {
        statsTimer = null;
        flushStats();
      }, 1000);
    }
  });
}

chrome.tabs.onRemoved.addListener((tabId) => {
  tabBlocked.delete(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabBlocked.set(tabId, 0);
    updateBadge(tabId);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "getPopupState") {
      const state = await getState();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const host = tab?.url ? hostnameFromUrl(tab.url) : "";
      sendResponse({
        enabled: state.enabled,
        host,
        paused: host ? state.pausedHosts.includes(host) : false,
        pageBlocked: tab?.id ? tabBlocked.get(tab.id) || 0 : 0,
        totalBlocked: state.totalBlocked || 0,
        lists: state.lists,
      });
      return;
    }

    if (message?.type === "toggleEnabled") {
      const state = await getState();
      await setState({ enabled: !state.enabled });
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) await updateBadge(tab.id);
      sendResponse({ enabled: !state.enabled });
      return;
    }

    if (message?.type === "toggleList") {
      const state = await getState();
      const key = message.list;
      if (key && Object.prototype.hasOwnProperty.call(state.lists, key)) {
        await setState({ lists: { ...state.lists, [key]: !state.lists[key] } });
      }
      const next = await getState();
      sendResponse({ lists: next.lists });
      return;
    }

    if (message?.type === "togglePauseSite") {
      const state = await getState();
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      const host = tab?.url ? hostnameFromUrl(tab.url) : "";
      if (!host) {
        sendResponse({ paused: false, host: "" });
        return;
      }
      const pausedHosts = state.pausedHosts.includes(host)
        ? state.pausedHosts.filter((item) => item !== host)
        : [...state.pausedHosts, host];
      await setState({ pausedHosts });
      sendResponse({ paused: pausedHosts.includes(host), host });
      return;
    }

    if (message?.type === "isSitePaused") {
      const state = await getState();
      const host = hostnameFromUrl(sender.tab?.url || message.url || "");
      sendResponse({
        enabled: state.enabled,
        paused: host ? state.pausedHosts.includes(host) : false,
        lists: state.lists,
      });
    }
  })();
  return true;
});
