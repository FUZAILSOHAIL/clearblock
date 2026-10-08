# ClearBlock

[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL--3.0--or--later-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/manifest-V3-1a73e8.svg)](manifest.json)
[![Chrome and Edge 121+](https://img.shields.io/badge/Chrome%20%7C%20Edge-121%2B-34a853.svg)](manifest.json)
[![Release](https://img.shields.io/github/v/release/FUZAILSOHAIL/clearblock?display_name=tag)](https://github.com/FUZAILSOHAIL/clearblock/releases)

A Manifest V3 ad, tracker, and annoyance blocker for Chrome and Edge, with extra handling for YouTube.

Copyright (C) 2026 Fuzail Sohail. ClearBlock is free software under the **GNU General Public License v3.0 or later**. See [LICENSE](LICENSE). Filter lists bundled in `tools/lists/` keep their own licenses; credits, source URLs, and the license choice are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Install (unpacked)

1. Open `chrome://extensions` or `edge://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Pin ClearBlock from the toolbar.

A tagged release also attaches a zip of the extension files. See [Releases](#releases).

## Features

- Network rules converted from EasyList, EasyPrivacy, and the Fanboy annoyance snapshot in `tools/lists/`
- Cosmetic hiding so leftover ad, tracker, and annoyance slots collapse
- YouTube ad-request blocking, in-player skip and seek, and hiding of in-feed and overlay ads
- Per-site pause, custom block and allow lists, and separate toggles for ads, trackers, annoyances, and YouTube

## How it works

### Network rules

`manifest.json` registers static [`declarativeNetRequest`](https://developer.chrome.com/docs/extensions/reference/api/declarativeNetRequest) rulesets under `rules/`. Ads, trackers, and annoyances are split into files of at most 8,000 rules. `rules/youtube.json` is a short list of YouTube and googlevideo URL patterns written in `tools/generate_rules.py`.

The service worker in `src/background/background.js` turns those rulesets on and off. List toggles map to the groups `youtube`, `ads`, `trackers`, and `annoyances`. On startup it enables the groups that are still on, in that order, and stops when Chrome's remaining static-rule budget is too small for the next file. Turning the extension off disables every static ruleset.

Custom block and allow entries, and sites paused from the popup, are dynamic rules:

- A custom block entry becomes a `block` rule.
- A custom allow entry becomes an `allow` rule for that host.
- A paused site, and each custom allow entry, also gets a high-priority allow so requests from that site are permitted. The worker first tries `allowAllRequests` for the site's own documents, and if Chrome rejects that update it keeps the plain `allow` rules.

The toolbar badge uses `declarativeNetRequest.onRuleMatchedDebug`. Each match on a tab increments that tab's count and the stored all-time total. The badge shows the tab count up to 99, or `OFF` when protection is off.

### Cosmetic filters

Generic element-hiding rules from the lists are compiled into `src/filters/generic-ads.css` and `src/filters/generic-annoyances.css`. `src/content/content.css` is a small extra stylesheet of common ad frames and slots that ships with the extension. Site-specific hide rules and their exceptions are stored as host maps in `src/filters/specific-ads.json`, `src/filters/exceptions-ads.json`, `src/filters/specific-annoyances.json`, and `src/filters/exceptions-annoyances.json`.

`src/content/specific.js` loads those maps and injects a style element for the current host, skipping selectors that appear in the exception map. `src/content/content.js` enables or disables the generic stylesheets, including `content.css` and `src/content/youtube.css`, when protection is off, the site is paused, or the matching list toggle is off.

### YouTube

YouTube pages get three extra pieces on top of the network rules in `rules/youtube.json`:

- `src/content/youtube.css` hides in-player overlays, masthead and in-feed promoted renderers, and the ad-block enforcement dialog.
- `src/content/youtube.js` runs in the isolated content-script world. While the player element has `ad-showing` or `ad-interrupting`, it clicks the skip and overlay-close buttons. If a skip button is not there yet, it seeks the video to just before the end of its duration, at most once every 1.5 seconds.
- `src/content/youtube-main.js` runs in the page's main world. It clears `adPlacements`, `adSlots`, and `playerAds` on `ytInitialPlayerResponse` and `ytInitialData`, and it does the same for JSON from `/youtubei/v1/player` and `/youtubei/v1/next` (`fetch` and `XMLHttpRequest`). It also deletes `adBlockingMessageRenderer` when that object is present.

The YouTube toggle, the global switch, and per-site pause all gate this behaviour. The skip and seek script asks the service worker before it keeps running, and the stylesheet is toggled with the other cosmetic CSS.

### Popup and settings

The popup shows the current host, this tab's match count, the all-time total, the master switch, the four list toggles, and pause for this site. Changing the switch, a list, or pause reloads the active tab. The options page edits the same list toggles plus the custom block list, allow list, and paused-site list, and it can reset the stored total.

## Rebuilding rules

The generator reads the snapshots already stored in `tools/lists/`. It needs Python 3.10 or newer.

```bash
python3 tools/generate_rules.py
```

That command deletes the existing JSON files in `rules/`, then writes:

- `rules/ads_*.json`, `rules/trackers_*.json`, and `rules/annoyances_1.json` from `tools/lists/easylist.txt`, `tools/lists/easyprivacy.txt`, and `tools/lists/annoyances.txt`
- `rules/youtube.json` from the YouTube patterns in the script
- `rules/rulesets.json`, which the service worker uses to decide what to enable
- `src/filters/generic-*.css`, `src/filters/specific-*.json`, and `src/filters/exceptions-*.json`
- solid green icons at `assets/icons/icon16.png`, `icon48.png`, and `icon128.png`

Only network and cosmetic filters the script understands are kept. Regex rules, scriptlets, and options it skips (including `redirect`, `csp`, and `removeparam`) are left out. After replacing a list, update [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) if the new file's license header changed.

## Screenshots

Add real popup and options-page captures at the paths below, then replace each placeholder with the image line under it.

**Popup** — save the capture as [`docs/screenshots/popup.png`](docs/screenshots/popup.png)

> Placeholder: ClearBlock popup screenshot (`docs/screenshots/popup.png`).

<!-- screenshot: popup
![ClearBlock popup](docs/screenshots/popup.png)
-->

**Options page** — save the capture as [`docs/screenshots/options.png`](docs/screenshots/options.png)

> Placeholder: ClearBlock options-page screenshot (`docs/screenshots/options.png`).

<!-- screenshot: options
![ClearBlock settings](docs/screenshots/options.png)
-->

## Releases

Pushing a tag that starts with `v` runs [`.github/workflows/release.yml`](.github/workflows/release.yml). The workflow zips `manifest.json`, `src/`, `rules/`, `assets/`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, and `README.md`, then attaches `clearblock-<manifest version>.zip` to a GitHub Release for that tag. The generated rules stay in the repository; the workflow packs the files that are already committed.

```bash
git tag v2.0.1
git push origin v2.0.1
```

Use a tag that matches the `version` field in `manifest.json`. The zip name comes from that field, and the release name comes from the tag.

## Filter list credits

Network and cosmetic filters are converted from [EasyList](https://easylist.to/easylist/easylist.txt), [EasyPrivacy](https://easylist.to/easylist/easyprivacy.txt), and [Fanboy's Annoyance List](https://easylist.to/easylist/fanboy-annoyance.txt). The annoyance snapshot also contains Fanboy's Social, Notifications, Newsletter, and age-gate sections, plus the EasyList Cookie List. Full credits, licenses, and source URLs are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
