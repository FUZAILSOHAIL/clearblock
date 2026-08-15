(() => {
  const strip = (data) => {
    if (!data || typeof data !== "object") return data;
    if (Array.isArray(data.adPlacements)) data.adPlacements = [];
    if (Array.isArray(data.adSlots)) data.adSlots = [];
    if (Array.isArray(data.playerAds)) data.playerAds = [];
    if (data.playerAds) data.playerAds = [];
    if (data.adPlacements) data.adPlacements = [];
    if (data.adSlots) data.adSlots = [];
    if (data.playerResponse) strip(data.playerResponse);
    if (data.response) strip(data.response);
    const ui = data.auxiliaryUi?.messageRenderers;
    if (ui?.adBlockingMessageRenderer) delete ui.adBlockingMessageRenderer;
    return data;
  };

  const hookProperty = (name) => {
    let value;
    try {
      Object.defineProperty(window, name, {
        configurable: true,
        enumerable: true,
        get() {
          return value;
        },
        set(next) {
          value = strip(next);
        },
      });
    } catch {
      // YouTube may have already locked this property.
    }
  };

  hookProperty("ytInitialPlayerResponse");
  hookProperty("ytInitialData");

  const originalFetch = window.fetch;
  window.fetch = function (...args) {
    const request = args[0];
    const url = typeof request === "string" ? request : request?.url || "";
    const tracked = url.includes("/youtubei/v1/player") || url.includes("/youtubei/v1/next");
    const result = originalFetch.apply(this, args);
    if (!tracked) return result;
    return result.then(async (response) => {
      try {
        const payload = strip(await response.clone().json());
        return new Response(JSON.stringify(payload), {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });
      } catch {
        return response;
      }
    });
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__clearblockUrl = String(url || "");
    return originalOpen.call(this, method, url, ...rest);
  };
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    this.addEventListener("readystatechange", function () {
      if (this.readyState !== 4 || this.status < 200 || this.status >= 300) return;
      const url = this.__clearblockUrl || "";
      if (!url.includes("/youtubei/v1/player") && !url.includes("/youtubei/v1/next")) return;
      try {
        const payload = JSON.stringify(strip(JSON.parse(this.responseText)));
        Object.defineProperty(this, "responseText", { configurable: true, get: () => payload });
        Object.defineProperty(this, "response", { configurable: true, get: () => payload });
      } catch {
        // Leave the original response in place.
      }
    });
    return originalSend.apply(this, args);
  };
})();
