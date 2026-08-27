# GitHub / Cloudflare deploy status

Current production build: **V34.7.9 BlaBla Five-Deck Stability**

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

- BlaBla four-surface propagation is verified from one central roster into Precision, My Roster, Simulation, and 5-deck calculation contexts.
- The 5-deck optimizer now preserves favorite phase and observed equipment ATK/HP/DEF instead of overwriting the rich central context.
- Live Cloudflare verification checks the deployed HTML and same-origin /api/blabla/sync bridge.


- Large synchronized owned rosters use a mobile-only bounded search mode: compact B3/flex pre-rank caches, a 180 exact-pair safety budget, cooperative yielding, and immediate cache release after candidate generation.
- Final five-team selections remain full exact recalculations; only repeated pre-ranking work is reused or bounded.
- The stability browser regression imports a 100+ character BlaBla-shaped roster on a 412×915 / 4 GB profile and requires five teams, 25 unique members, bounded candidate memory, and no crash.

- BlaBla-owned-roster five-deck composition uses the bounded yielding optimizer path; candidate scoring returns UI control in batches and releases the heavy candidate pool after selection.
- Android/WebView runs use pair/flex limits 8/3 with deterministic 10/4 fallback, preventing unbounded V34 recursive exact-cover memory growth.

## Automatic deployment

Any future commit pushed to `main` is expected to trigger Cloudflare Workers Builds automatically. Non-production branch builds are disabled.

This documentation-only commit is intentionally used as the first production auto-deploy trigger after the Git integration was connected.
