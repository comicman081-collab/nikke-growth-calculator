# GitHub / Cloudflare deploy status

Build prepared: **V34.7.4 Deploy AutoSync**

## Ready

- GitHub repository content is prepared.
- `public/index.html` and root `index.html` are identical.
- Cloudflare Pages Function route: `/api/blabla/sync`.
- Production web build forces same-origin bridge automatically.
- Manual/stale bridge URL and bridge key are cleared in deployed web mode.
- First successful profile/server pair is stored locally.
- Later page visits auto-refresh once per browser session by default.
- Central roster remains the single sink for external data, so precision/My Roster/cubes/5-team auto composition consume the same imported values.

## Still required once at deployment

Cloudflare must have an encrypted BlaBla service session (`BLABLA_29080_GAME_TOKEN` + `BLABLA_29080_GAME_OPENID`). Those secrets cannot safely be committed to GitHub or embedded in HTML.

The GitHub connector currently cannot create a brand-new repository or configure Cloudflare Pages itself. Once the repository exists and Cloudflare is connected, this tree is ready to commit and deploy.
