# NIKKE Growth Calculator

Current web deployment build: **V34.7.18 Presentation Stability**

## What is automatic in the deployed build

When this repository is deployed to Cloudflare Pages, the browser automatically binds BlaBlaLink sync to the **same deployment origin**:

`https://<project>.pages.dev/api/blabla/sync`

There is no bridge URL or bridge-key input in the production UI. A stale URL from an older build is cleared automatically.

After a user successfully syncs one BlaBlaLink public-profile URL, the profile URL and selected server are stored in that browser. On a later visit, the deployed build probes the same-origin bridge and automatically refreshes that roster once per browser session when auto-sync is enabled (default: ON). Imported values go to the central roster and are immediately shared by precision, My Roster, cubes, and 5-team auto composition.

A profile can also be supplied in the deployed page URL with `?blabla=...`, `?profile=...`, `?openid=...`, or `?uid=...`; it is prefilled and can be auto-synced.

## Cloudflare Pages deployment

Cloudflare Pages Functions use file-based routing from the repository-root `functions/` directory. The included function `functions/api/blabla/sync.js` therefore serves `/api/blabla/sync`.

- Build command: leave empty
- Build output directory: `public`
- Functions directory: auto-detected from repository-root `functions/`
- Recommended project name: `nikke-growth-calculator`

### One-time production secrets

The deployed browser must never contain a BlaBla service token. Add these as **encrypted Cloudflare Pages secrets** once:

- `BLABLA_29080_GAME_TOKEN`
- `BLABLA_29080_GAME_OPENID`
- `BLABLA_29080_GAME_CHANNELID` = `131` (optional; 131 is the fallback)

For HK/MC/TW also add the corresponding `BLABLA_29157_*` secrets.

For the normal same-origin production deployment, leave `BLABLA_SYNC_KEY` empty. Same-origin Origin validation is already enforced by the function; setting a browser-side shared key would defeat zero-configuration automatic linking.

## Runtime behavior

1. Page loads from HTTPS.
2. V34.7.4 forces the bridge base to `location.origin + /api/blabla`.
3. The page probes `GET /api/blabla/sync`.
4. If Cloudflare reports a configured service session, sync is ready.
5. First successful public-profile sync saves only the public profile URL/server locally.
6. Later visits automatically re-sync on the Thursday 11:00 / 19:00 KST slots (with safe catch-up when the page or APK resumes); a manual refresh button is also available.
7. The service token remains server-side only.

`index.html` mirrors `public/index.html` for inspection. Cloudflare Pages should serve `public/index.html`.

## V34.7.18 presentation stability

- The page title, runtime status and footer now have one authoritative release value; legacy compatibility timers can no longer alternate them.
- Unchanged legacy roster refreshes are ignored, while real imports, roster edits and cube changes still redraw immediately.
- S40 diagnostic badges use a high-contrast foreground, border and background instead of dark-on-dark text.
- Precision cycle/firepower output spans the same full content width as the other Precision cards, and every input/select/textarea shares the application font and field treatment.
- The deployed auto-sync description and toggle use the available horizontal space; the status remains a full-width row below them.
- The five-deck optimizer shows a compact notice above its controls that a run can take roughly 30 seconds to several minutes depending on system performance and roster size.
- Manual Precision edits and BlaBla imports are regression-tested through the central roster, My Roster, Precision, Solo Raid, single-party simulation and all three five-deck modes.
- A 193-row linked snapshot keeps all raw rows for future refreshes while only the 107 registered app characters (106 calculation-eligible profiles) can enter damage calculations.
- Bottom-note/search placement observes only its own direct containers instead of the full document subtree.
- A clean browser starts without any saved BlaBla profile or linked-roster snapshot. Each linked roster remains in that browser or APK account's scoped local storage.
