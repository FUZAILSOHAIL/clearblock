const SKIP_SELECTORS = [
  ".ytp-skip-ad-button",
  ".ytp-ad-skip-button",
  ".ytp-ad-skip-button-modern",
  ".ytp-ad-skip-button-container button",
  ".ytp-ad-overlay-close-button",
].join(",");

let enabled = true;
let lastJumpAt = 0;
let timer = null;

function player() {
  return document.querySelector("#movie_player, .html5-video-player");
}

function isAdPlaying() {
  const node = player();
  if (!node?.classList.contains("ad-showing") && !node?.classList.contains("ad-interrupting")) {
    return false;
  }
  return Boolean(
    node.querySelector(
      ".ytp-ad-player-overlay, .ytp-ad-player-overlay-layout, .ytp-ad-preview-container, .ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-text"
    )
  );
}

function clickSkips(root) {
  root.querySelectorAll(SKIP_SELECTORS).forEach((node) => {
    try {
      node.click();
    } catch {
      // Ignore detached nodes.
    }
  });
}

function tick() {
  if (!enabled) return;
  const node = player();
  if (!node || !isAdPlaying()) return;

  clickSkips(node);

  const skipReady = node.querySelector(
    ".ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern"
  );
  if (skipReady) return;

  const now = Date.now();
  if (now - lastJumpAt < 1500) return;
  const video = node.querySelector("video");
  if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return;
  if (video.currentTime >= video.duration - 0.25) return;
  lastJumpAt = now;
  video.currentTime = Math.max(video.duration - 0.05, 0);
}

function setEnabled(next) {
  enabled = next;
  if (enabled && !timer) {
    timer = setInterval(tick, 500);
    tick();
    return;
  }
  if (!enabled && timer) {
    clearInterval(timer);
    timer = null;
  }
}

chrome.runtime.sendMessage({ type: "isSitePaused", url: location.href }, (response) => {
  if (chrome.runtime.lastError) {
    setEnabled(true);
    return;
  }
  setEnabled(Boolean(response?.enabled) && !response?.paused && response?.lists?.youtube !== false);
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  chrome.runtime.sendMessage({ type: "isSitePaused", url: location.href }, (response) => {
    if (chrome.runtime.lastError) return;
    setEnabled(Boolean(response?.enabled) && !response?.paused && response?.lists?.youtube !== false);
  });
});

setEnabled(true);
