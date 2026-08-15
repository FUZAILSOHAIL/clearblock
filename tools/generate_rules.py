"""Convert EasyList-style filter lists into MV3 DNR rules and cosmetic filters."""

from __future__ import annotations

import json
import re
import struct
import zlib
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LISTS = Path(__file__).resolve().parent / "lists"
RULES_DIR = ROOT / "rules"
FILTERS_DIR = ROOT / "src" / "filters"
ICONS_DIR = ROOT / "assets" / "icons"

CHUNK_SIZE = 8000

DEFAULT_TYPES = [
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "csp_report",
    "media",
    "websocket",
    "webtransport",
    "webbundle",
    "other",
]

TYPE_MAP = {
    "script": "script",
    "image": "image",
    "stylesheet": "stylesheet",
    "object": "object",
    "object-subrequest": "object",
    "subdocument": "sub_frame",
    "sub_frame": "sub_frame",
    "xmlhttprequest": "xmlhttprequest",
    "xhr": "xmlhttprequest",
    "fetch": "xmlhttprequest",
    "ping": "ping",
    "beacon": "ping",
    "websocket": "websocket",
    "media": "media",
    "font": "font",
    "other": "other",
    "csp_report": "csp_report",
    "imageset": "image",
    "main_frame": "main_frame",
    "document": "main_frame",
    "popup": "main_frame",
}

SKIP_OPTIONS = {
    "redirect",
    "redirect-rule",
    "csp",
    "removeparam",
    "cookie",
    "replace",
    "removeheader",
    "permissions",
    "header",
    "elemhide",
    "generichide",
    "specifichide",
    "inline-script",
    "inline-font",
    "rewrite",
    "empty",
    "mp4",
    "match-case",
    "sitekey",
    "to",
    "method",
    "diff",
    "href",
    "webrtc",
}

SKIP_OPTION_PREFIXES = (
    "redirect=",
    "redirect-rule=",
    "csp=",
    "removeparam=",
    "cookie=",
    "replace=",
    "removeheader=",
    "permissions=",
    "header=",
    "rewrite=",
    "csp_report=",
)

YOUTUBE_EXTRA = [
    "||youtube.com/api/stats/ads",
    "||youtube.com/pagead/",
    "||youtube.com/ptracking?",
    "||youtube.com/ptracking&",
    "||youtube.com/api/stats/atr?",
    "||youtube.com/get_midroll_",
    "||youtube.com/youtubei/v1/player/ad_",
    "||youtube.com/youtubei/v1/ad_",
    "||youtube.com/pcs/activeview",
    "||youtube.com/api/stats/qoe?adformat",
    "||youtube.com/api/stats/playback?adformat",
    "||ad.youtube.com^",
    "||ads.youtube.com^",
    "||s.youtube.com/api/stats/ads",
    "||www.youtube.com/api/stats/ads",
    "||googlevideo.com/initplayback*&oad=",
    "||youtube.com/pagead/adview",
    "||youtube.com/pagead/conversion",
    "||youtube.com/pagead/interactive",
]


def write_png(path: Path, size: int, rgb: tuple[int, int, int]) -> None:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = b"".join(b"\x00" + bytes(rgb) * size for _ in range(size))
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def split_filter(line: str) -> tuple[str, str]:
    if line.startswith("||") or line.startswith("|http") or line.startswith("/"):
        dollar = line.rfind("$")
        if dollar > 0:
            return line[:dollar], line[dollar + 1 :]
        return line, ""
    dollar = line.find("$")
    if dollar >= 0:
        return line[:dollar], line[dollar + 1 :]
    return line, ""


def is_regex(pattern: str) -> bool:
    if len(pattern) < 3 or not pattern.startswith("/"):
        return False
    end = pattern.rfind("/")
    if end <= 0:
        return False
    body = pattern[1:end]
    flags = pattern[end + 1 :]
    if flags and any(ch not in "igm" for ch in flags):
        return False
    return any(ch in body for ch in r"\()[]{}|+?$")


def valid_url_filter(pattern: str) -> bool:
    if not pattern or len(pattern) > 900:
        return False
    try:
        pattern.encode("ascii")
    except UnicodeEncodeError:
        return False
    if pattern.startswith("||*"):
        return False
    if "*" in pattern and pattern.replace("*", "") == "":
        return False
    body = pattern
    if body.startswith("||"):
        body = body[2:]
    elif body.startswith("|"):
        body = body[1:]
    if body.endswith("|"):
        body = body[:-1]
    if "|" in body:
        return False
    return True


def parse_options(raw: str) -> dict | None:
    result = {
        "types": None,
        "excluded_types": set(),
        "third_party": None,
        "initiator": [],
        "excluded_initiator": [],
        "excluded_request": [],
        "important": False,
        "popup": False,
        "skip": False,
    }
    if not raw:
        return result

    for part in raw.split(","):
        option = part.strip()
        if not option:
            continue
        lower = option.lower()
        if lower in SKIP_OPTIONS or lower.startswith(SKIP_OPTION_PREFIXES):
            if lower in {"elemhide", "generichide", "specifichide"}:
                result["skip"] = True
                return result
            if lower.startswith(SKIP_OPTION_PREFIXES) or lower in SKIP_OPTIONS - {"websocket"}:
                result["skip"] = True
                return result
        if lower in {"third-party", "3p"}:
            result["third_party"] = True
            continue
        if lower in {"~third-party", "first-party", "1p"}:
            result["third_party"] = False
            continue
        if lower == "important":
            result["important"] = True
            continue
        if lower in {"popup", "document", "all"}:
            result["popup"] = lower in {"popup", "document", "all"}
            if lower == "all":
                result["types"] = list(DEFAULT_TYPES) + ["main_frame"]
            elif lower == "document":
                result["types"] = ["main_frame"]
            elif lower == "popup":
                result["types"] = ["main_frame"]
            continue
        if lower.startswith("domain="):
            for domain in option.split("=", 1)[1].split("|"):
                domain = domain.strip().lower().removeprefix("www.")
                if not domain or "*" in domain or "/" in domain:
                    continue
                if domain.startswith("~"):
                    host = domain[1:]
                    if host:
                        result["excluded_initiator"].append(host)
                else:
                    result["initiator"].append(domain)
            continue
        if lower.startswith("denyallow="):
            for domain in option.split("=", 1)[1].split("|"):
                domain = domain.strip().lower().removeprefix("www.")
                if domain and "*" not in domain:
                    result["excluded_request"].append(domain)
            continue
        negated = lower.startswith("~")
        key = lower[1:] if negated else lower
        mapped = TYPE_MAP.get(key)
        if mapped:
            if negated:
                result["excluded_types"].add(mapped)
            else:
                result["types"] = result["types"] or []
                if mapped not in result["types"]:
                    result["types"].append(mapped)
            continue
        # Unknown option: skip the filter to avoid overblocking.
        result["skip"] = True
        return result
    return result


def resource_types(options: dict) -> list[str] | None:
    types = list(options["types"] or DEFAULT_TYPES)
    types = [item for item in types if item not in options["excluded_types"]]
    if options["popup"] and "main_frame" not in types:
        types.append("main_frame")
    if not types:
        return None
    # Keep generic path filters off main_frame unless explicitly requested.
    if not options["popup"] and options["types"] is None:
        types = [item for item in types if item != "main_frame"]
    return types or None


def make_rule(rule_id: int, pattern: str, options: dict, allow: bool) -> dict | None:
    types = resource_types(options)
    if not types:
        return None
    condition: dict = {"urlFilter": pattern, "resourceTypes": types}
    if options["third_party"] is True:
        condition["domainType"] = "thirdParty"
    elif options["third_party"] is False:
        condition["domainType"] = "firstParty"
    if options["initiator"]:
        condition["initiatorDomains"] = sorted(set(options["initiator"]))[:50]
    if options["excluded_initiator"]:
        condition["excludedInitiatorDomains"] = sorted(set(options["excluded_initiator"]))[:50]
    if options["excluded_request"]:
        condition["excludedRequestDomains"] = sorted(set(options["excluded_request"]))[:50]
    priority = 100 if allow else (10 if options["important"] else 1)
    return {
        "id": rule_id,
        "priority": priority,
        "action": {"type": "allow" if allow else "block"},
        "condition": condition,
    }


def parse_network_line(line: str) -> tuple[str, dict, bool] | None:
    allow = line.startswith("@@")
    body = line[2:] if allow else line
    pattern, raw_options = split_filter(body)
    pattern = pattern.strip()
    if not pattern or is_regex(pattern) or not valid_url_filter(pattern):
        return None
    options = parse_options(raw_options)
    if not options or options["skip"]:
        return None
    return pattern, options, allow


def safe_selector(selector: str) -> bool:
    if not selector or len(selector) > 400:
        return False
    lowered = selector.lower()
    banned = ("</", "url(", "expression(", "@import", "javascript:", "+js(", ":xpath(", ":remove(", ":style(")
    return not any(token in lowered for token in banned)


def parse_cosmetic_line(line: str) -> tuple[str, list[str], str] | None:
    exception = "#@#" in line
    marker = "#@#" if exception else "##"
    if marker not in line:
        return None
    domains, selector = line.split(marker, 1)
    selector = selector.strip()
    if not safe_selector(selector):
        return None
    if any(token in selector for token in ("+js(", ":xpath(", ":has-text(", ":matches-path", ":upward(", ":nth-ancestor")):
        return None
    hosts = [item.strip().lower().removeprefix("www.") for item in domains.split(",") if item.strip()]
    kind = "exception" if exception else "hide"
    return kind, hosts, selector


def read_list(path: Path) -> list[str]:
    return path.read_text(encoding="utf-8", errors="replace").splitlines()


def convert_list(lines: list[str]) -> tuple[list[dict], dict[str, list[str]], dict[str, list[str]], list[str]]:
    rules: list[dict] = []
    specific: dict[str, list[str]] = defaultdict(list)
    exceptions: dict[str, list[str]] = defaultdict(list)
    generic: list[str] = []
    seen_rules: set[tuple] = set()
    seen_generic: set[str] = set()

    for raw in lines:
        line = raw.strip()
        if not line or line.startswith("!") or line.startswith("["):
            continue
        if "##" in line or "#@#" in line:
            parsed = parse_cosmetic_line(line)
            if not parsed:
                continue
            kind, hosts, selector = parsed
            if not hosts:
                if kind == "hide" and selector not in seen_generic:
                    seen_generic.add(selector)
                    generic.append(selector)
                continue
            target = exceptions if kind == "exception" else specific
            for host in hosts:
                if host.startswith("~"):
                    continue
                if host and selector not in target[host]:
                    target[host].append(selector)
            continue

        parsed_net = parse_network_line(line)
        if not parsed_net:
            continue
        pattern, options, allow = parsed_net
        key = (
            pattern,
            tuple(resource_types(options) or []),
            options["third_party"],
            tuple(options["initiator"]),
            tuple(options["excluded_initiator"]),
            allow,
            options["important"],
        )
        if key in seen_rules:
            continue
        seen_rules.add(key)
        rule = make_rule(len(rules) + 1, pattern, options, allow)
        if rule:
            rules.append(rule)
    return rules, dict(specific), dict(exceptions), generic


def write_chunks(prefix: str, rules: list[dict]) -> list[dict]:
    RULES_DIR.mkdir(parents=True, exist_ok=True)
    meta = []
    if not rules:
        return meta
    for index in range(0, len(rules), CHUNK_SIZE):
        chunk = rules[index : index + CHUNK_SIZE]
        for offset, rule in enumerate(chunk, start=1):
            rule["id"] = offset
        part = index // CHUNK_SIZE + 1
        name = f"{prefix}_{part}"
        path = RULES_DIR / f"{name}.json"
        path.write_text(json.dumps(chunk, separators=(",", ":")), encoding="utf-8")
        meta.append({"id": name, "path": f"rules/{name}.json", "count": len(chunk), "group": prefix})
        print(f"  wrote {path.name} ({len(chunk)} rules)")
    return meta


def write_json_map(path: Path, data: dict[str, list[str]]) -> None:
    compact = {host: selectors for host, selectors in data.items() if selectors}
    path.write_text(json.dumps(compact, separators=(",", ":")), encoding="utf-8")


def write_css(path: Path, selectors: list[str]) -> None:
    simple: list[str] = []
    complex: list[str] = []
    for selector in selectors:
        if "," in selector:
            complex.append(selector)
        else:
            simple.append(selector)
    hide = "{display:none!important;visibility:hidden!important;height:0!important;min-height:0!important;max-height:0!important;overflow:hidden!important}"
    parts: list[str] = []
    for index in range(0, len(simple), 250):
        parts.append(",".join(simple[index : index + 250]) + hide)
    for selector in complex:
        parts.append(selector + hide)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(parts), encoding="utf-8")


def youtube_rules() -> list[dict]:
    rules = []
    for index, pattern in enumerate(YOUTUBE_EXTRA, start=1):
        rules.append(
            {
                "id": index,
                "priority": 20,
                "action": {"type": "block"},
                "condition": {
                    "urlFilter": pattern,
                    "resourceTypes": DEFAULT_TYPES,
                },
            }
        )
    return rules


def main() -> None:
    FILTERS_DIR.mkdir(parents=True, exist_ok=True)
    RULES_DIR.mkdir(parents=True, exist_ok=True)
    ICONS_DIR.mkdir(parents=True, exist_ok=True)

    for old in RULES_DIR.glob("*.json"):
        old.unlink()

    sources = [
        ("ads", LISTS / "easylist.txt"),
        ("trackers", LISTS / "easyprivacy.txt"),
        ("annoyances", LISTS / "annoyances.txt"),
    ]

    meta: list[dict] = []
    cosmetics = {}

    for group, path in sources:
        print(f"converting {path.name}...")
        rules, specific, exceptions, generic = convert_list(read_list(path))
        print(f"  network={len(rules)} generic={len(generic)} specific={len(specific)}")
        meta.extend(write_chunks(group, rules))
        if specific:
            write_json_map(FILTERS_DIR / f"specific-{group}.json", specific)
        if exceptions:
            write_json_map(FILTERS_DIR / f"exceptions-{group}.json", exceptions)
        if generic:
            write_css(FILTERS_DIR / f"generic-{group}.css", generic)
        cosmetics[group] = {"generic": len(generic), "specific": len(specific), "network": len(rules)}

    yt = youtube_rules()
    (RULES_DIR / "youtube.json").write_text(json.dumps(yt, separators=(",", ":")), encoding="utf-8")
    meta.append({"id": "youtube", "path": "rules/youtube.json", "count": len(yt), "group": "youtube"})

    (RULES_DIR / "rulesets.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")

    green = (32, 201, 151)
    write_png(ICONS_DIR / "icon16.png", 16, green)
    write_png(ICONS_DIR / "icon48.png", 48, green)
    write_png(ICONS_DIR / "icon128.png", 128, green)

    print("summary", json.dumps(cosmetics, indent=2))
    print(f"rulesets: {len(meta)}")


if __name__ == "__main__":
    main()
