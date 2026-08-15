const HIDE =
  "{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;max-height:0!important;overflow:hidden!important}";

const cache = {
  ads: null,
  adsEx: null,
  annoy: null,
  annoyEx: null,
};

function hostVariants(hostname) {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  const parts = host.split(".");
  const variants = new Set([host, hostname.toLowerCase()]);
  for (let i = 0; i < parts.length - 1; i += 1) {
    variants.add(parts.slice(i).join("."));
  }
  return variants;
}

function collect(map, hostname) {
  const out = [];
  if (!map) return out;
  for (const host of hostVariants(hostname)) {
    const list = map[host];
    if (list) out.push(...list);
  }
  return out;
}

function toCss(selectors, exceptions) {
  const skip = new Set(exceptions);
  const simple = [];
  const complex = [];
  for (const selector of selectors) {
    if (!selector || skip.has(selector)) continue;
    if (selector.includes(",")) complex.push(selector);
    else simple.push(selector);
  }
  const parts = [];
  for (let i = 0; i < simple.length; i += 200) {
    parts.push(simple.slice(i, i + 200).join(",") + HIDE);
  }
  for (const selector of complex) {
    parts.push(selector + HIDE);
  }
  return parts.join("\n");
}

function inject(id, css) {
  let style = document.getElementById(id);
  if (!css) {
    style?.remove();
    return;
  }
  if (style?.textContent === css) return;
  if (!style) {
    style = document.createElement("style");
    style.id = id;
    (document.head || document.documentElement).appendChild(style);
  }
  style.textContent = css;
}

async function loadJson(path) {
  const response = await fetch(chrome.runtime.getURL(path));
  return response.json();
}

async function loadFilters() {
  if (cache.ads) return cache;
  const [ads, adsEx, annoy, annoyEx] = await Promise.all([
    loadJson("src/filters/specific-ads.json"),
    loadJson("src/filters/exceptions-ads.json"),
    loadJson("src/filters/specific-annoyances.json"),
    loadJson("src/filters/exceptions-annoyances.json"),
  ]);
  cache.ads = ads;
  cache.adsEx = adsEx;
  cache.annoy = annoy;
  cache.annoyEx = annoyEx;
  return cache;
}

function apply(state, filters) {
  const enabled = Boolean(state?.enabled) && !state?.paused;
  if (!enabled) {
    inject("clearblock-specific-ads", "");
    inject("clearblock-specific-annoyances", "");
    return;
  }

  const host = location.hostname;
  const lists = state?.lists || {};

  inject(
    "clearblock-specific-ads",
    lists.ads !== false ? toCss(collect(filters.ads, host), collect(filters.adsEx, host)) : ""
  );
  inject(
    "clearblock-specific-annoyances",
    lists.annoyances !== false ? toCss(collect(filters.annoy, host), collect(filters.annoyEx, host)) : ""
  );
}

async function refresh() {
  const filters = await loadFilters();
  const response = await chrome.runtime.sendMessage({ type: "isSitePaused", url: location.href }).catch(() => null);
  apply(response || { enabled: true, paused: false, lists: { ads: true, annoyances: true } }, filters);
}

function scheduleRefresh() {
  const run = () => refresh().catch(() => {});
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(run, { timeout: 1200 });
    return;
  }
  setTimeout(run, 0);
}

scheduleRefresh();

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.enabled || changes.pausedHosts || changes.lists) scheduleRefresh();
});
