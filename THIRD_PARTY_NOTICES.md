# Third-party notices

ClearBlock is copyright (C) 2026 Fuzail Sohail and is licensed under the GNU General Public License version 3 or any later version (`GPL-3.0-or-later`). The license text is in [LICENSE](LICENSE).

The filter lists under `tools/lists/` come from other authors. `tools/generate_rules.py` converts those snapshots into the declarativeNetRequest rules in `rules/ads_*.json`, `rules/trackers_*.json`, and `rules/annoyances_1.json`, and into the cosmetic files `src/filters/generic-ads.css`, `src/filters/generic-annoyances.css`, `src/filters/specific-*.json`, and `src/filters/exceptions-*.json`. The conversion keeps the upstream text in `tools/lists/` and writes a modified form: filters the generator does not implement (regular expressions, scriptlets, and options such as `redirect`, `csp`, and `removeparam`) are dropped, and the rest are rewritten as network rules or element-hiding CSS.

`rules/youtube.json` and the YouTube scripts and stylesheet under `src/content/` are written for ClearBlock. They are not taken from these lists.

## Why the project uses GPL-3.0-or-later

EasyList and EasyPrivacy are dual-licensed. Their authors allow use under the GNU GPL version 3 or later, or under Creative Commons Attribution-ShareAlike 3.0 Unported or later. ClearBlock uses the GPL grant for those two lists.

The Fanboy snapshot in this repository, including the EasyList Cookie sections inside it, names [Creative Commons Attribution 3.0 Unported](https://creativecommons.org/licenses/by/3.0/) in its own header. CC BY 3.0 Unported is a free, non-copyleft license that the Free Software Foundation lists as compatible with the GPL, so those filters can be included in a GPL-3.0-or-later program when attribution is preserved and modifications are disclosed. A permissive license such as MIT would not satisfy the EasyList and EasyPrivacy GPL (or CC BY-SA) terms for the generated rules.

This is a notice of the licenses on the copies in this repository. It is not legal advice.

## EasyList

| | |
| --- | --- |
| Bundled file | `tools/lists/easylist.txt` |
| Title | EasyList |
| Snapshot | Version `202608151944`, last modified 15 Aug 2026 19:44 UTC, commit `f6697b26379fa2243a19c55ea5b849a2d1503ba1` |
| License | GNU GPL version 3 or later, **or** Creative Commons Attribution-ShareAlike 3.0 Unported or later |
| Licence page | https://easylist.to/pages/licence.html |
| Subscription | https://easylist.to/easylist/easylist.txt |
| Source | https://github.com/easylist/easylist (directories `easylist/` and `easylist_adult/`) |

The bundled file is the EasyList subscription. It includes the adult adserver, third-party, specific, and allowlist sections from `easylist_adult/`. Those sections are part of EasyList and use the same dual license. The file header points at the EasyList licence page rather than naming a different license.

The licence page states that, unless otherwise noted, the EasyList repository is dual-licensed under GPL-3.0-or-later and CC BY-SA 3.0 Unported or later, and that attribution, when required, should name "The EasyList authors (https://easylist.to/)". EasyList and EasyPrivacy are the subscriptions that page covers by name. A direct fetch of the page was blocked by the site's bot check; the wording used here matches the page text reproduced by the EasyList project and by Chromium's copy of that notice.

## EasyPrivacy

| | |
| --- | --- |
| Bundled file | `tools/lists/easyprivacy.txt` |
| Title | EasyPrivacy |
| Snapshot | Version `202608151956`, last modified 15 Aug 2026 19:56 UTC, commit `80f1cb67afed5fafe5b3d01e103e142c02e90427` |
| License | GNU GPL version 3 or later, **or** Creative Commons Attribution-ShareAlike 3.0 Unported or later |
| Licence page | https://easylist.to/pages/licence.html |
| Subscription | https://easylist.to/easylist/easyprivacy.txt |
| Source | https://github.com/easylist/easylist/tree/master/easyprivacy |

## Fanboy's Annoyance List

| | |
| --- | --- |
| Bundled file | `tools/lists/annoyances.txt` |
| Title in the file | Fanboy's Annoyance List |
| Snapshot | Version `202608151525`, last modified 2026-08-15 15:25 UTC |
| License stated in the file | Creative Commons Attribution 3.0 Unported, http://creativecommons.org/licenses/by/3.0/ |
| Homepage named in the file | https://easylist.to/ |
| Subscription | https://easylist.to/easylist/fanboy-annoyance.txt |
| Source | https://github.com/easylist/easylist |

This snapshot's header is the older Fanboy header, which states CC BY 3.0 directly. The same file is an aggregate. Section comments show that it contains all of the following:

| Component | Section comments in `tools/lists/annoyances.txt` | Source in the EasyList repository | Separate subscription, where one is published |
| --- | --- | --- | --- |
| Fanboy's Annoyance List | `fanboy_annoyance_*` | https://github.com/easylist/easylist/tree/master/fanboy-addon | https://easylist.to/easylist/fanboy-annoyance.txt |
| Fanboy's Social Blocking List | `fanboy_social_*` | same `fanboy-addon` tree | https://easylist.to/easylist/fanboy-social.txt |
| Fanboy's Notifications Blocking List | `fanboy_notifications_*` | same `fanboy-addon` tree | Included in the annoyance subscription above |
| Fanboy's Newsletter filters, including shopping newsletter sections | `fanboy_newsletter_*` | same `fanboy-addon` tree | Included in the annoyance subscription above |
| Fanboy age-gate filters | `fanboy_agegate_*` | same `fanboy-addon` tree | Included in the annoyance subscription above |
| EasyList Cookie List | `easylist_cookie_*` | https://github.com/easylist/easylist/tree/master/easylist_cookie | https://secure.fanboy.co.nz/fanboy-cookiemonster.txt and https://easylist-downloads.adblockplus.org/fanboy-cookiemonster.txt |

The published EasyList Cookie List header also states CC BY 3.0 (`http://creativecommons.org/licenses/by/3.0/`). That is the license ClearBlock follows for the cookie sections in this snapshot. The EasyList repository's default dual license says subscriptions other than EasyList, EasyPrivacy, EasyList Germany, and EasyList Italy may be offered on other terms. These Fanboy and cookie subscriptions are in that group, and the copies here say CC BY 3.0.

CC BY 3.0 requires credit to the licensor, a link to the license, and a note that the work was changed. The generated rules and stylesheets are that change. The list authors do not endorse ClearBlock.

## What to re-check when the lists are updated

The live Fanboy's Annoyance subscription on easylist.to (checked 8 Oct 2026) no longer prints the CC BY 3.0 line. Its header points at https://easylist.to/pages/licence.html, the same pointer EasyList and EasyPrivacy use. The copy in this repository is the 15 Aug 2026 snapshot, which still prints CC BY 3.0. After replacing any file in `tools/lists/`, read the new header and update this notice before publishing the generated rules.
