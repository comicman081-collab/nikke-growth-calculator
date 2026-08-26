# GitHub / Cloudflare deploy status

Current production build: **V34.7.7 ENIKK Favorite Phase Skill Resolution**

## Ready

- GitHub repository content is prepared and `main` is the production branch.
- Cloudflare Workers Builds is connected to `comicman081-collab/nikke-growth-calculator`.
- Build command: `npm run build`.
- Deploy command: `npm run deploy`.
- `public/index.html` and root `index.html` are kept identical.
- Production web build forces the same-origin `/api/blabla/sync` bridge.
- BlaBla service secrets are stored only as encrypted Cloudflare runtime secrets.
- Runtime variables are preserved across Wrangler deploys.
- First successful profile/server pair is stored locally and later page visits can auto-refresh once per browser session.
- Central roster remains the single sink for external data, so Precision / My Roster / cubes / 5-team auto composition consume the same imported values.
- BlaBla/ENIKK `nameCode` is the authority key for character identity; BlaBla master names remain display metadata, so duplicate names such as Rei/Asuka variants cannot overwrite each other.

- 21-character ENIKK favorite-item registry is TID-authoritative; Phase 0 uses base skills and Phases 1-3 replace only the audited slot.
- Viper TID 200501 and Sugar TID 202101 are permanently regression-tested.
- Imported skill levels are preserved independently of favorite-item phase.

## Automatic deployment

Any future commit pushed to `main` is expected to trigger Cloudflare Workers Builds automatically. Non-production branch builds are disabled.

This documentation-only commit is intentionally used as the first production auto-deploy trigger after the Git integration was connected.
