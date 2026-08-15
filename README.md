# ClearBlock

A Manifest V3 ad, tracker, and YouTube ad blocker for Chrome and Edge.

## Install (unpacked)

1. Open `chrome://extensions` or `edge://extensions`
2. Turn on **Developer mode**
3. Click **Load unpacked** and select this folder
4. Pin ClearBlock from the toolbar

## Features

- EasyList, EasyPrivacy, and Fanboy Annoyances network rules
- Cosmetic hiding so leftover ad slots collapse
- YouTube ad skipping and in-feed ad hiding
- Per-site pause, custom block/allow lists, and list toggles

## Rebuild filter lists

Requires Python 3.10+:

```bash
python tools/generate_rules.py
```

That downloads nothing by itself. It converts the lists in `tools/lists/` into `rules/` and `src/filters/`.

## Filter list credits

Network and cosmetic filters are converted from [EasyList](https://easylist.to/), EasyPrivacy, and Fanboy Annoyances. Those lists are licensed separately by their authors (GPL / CC BY-SA).
