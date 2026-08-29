# GitHub / Cloudflare deploy status

Release candidate: **V34.7.15 Bottom Notices & Search Clarity**

## Deployment configuration

- `main` is the production branch and Cloudflare Workers Builds is connected to `comicman081-collab/nikke-growth-calculator`.
- Build command: `npm run build`; deploy command: `npm run deploy`.
- Root `index.html` and `public/index.html` are required to remain byte-identical.
- Production uses the same-origin `/api/blabla/sync` Worker bridge; its credentials remain encrypted Cloudflare runtime secrets.
- Browser-local account storage remains the single central roster sink used by My Roster, Precision, Simulation, cubes and five-deck composition.

## Preserved authority and calculations

- Character identity is imported by favorite-item TID first and BlaBla/ENIKK `nameCode` second, preventing duplicate display names from overwriting one another.
- The 21-character favorite-item registry is TID-authoritative; imported skill levels are independent of favorite phase.
- Level, limit/core, bond, skill 1/2/burst, favorite phase, cube, overload totals and observed equipment ATK/HP/DEF are propagated from one linked roster into My Roster, Precision, Simulation and five-deck calculation contexts.

## V34.7.10 linked-roster repair

- An inherited fixed-catalog `getOwned()` wrapper could expose only built-in calculation rows even after BlaBla had stored 186 owned characters. This produced the false `insufficientRoster / team count 0 / slot count 0 / duplicate members` result.
- V34.7.10 merges the dynamic catalog with the saved central document, so all 186 linked characters remain owned and visible in My Roster.
- Supplemental rows without an audited damage model remain stored and visible but are not assigned fabricated Precision, Simulation or optimizer coefficients.
- Supported linked profiles retain their imported growth values in all calculation surfaces.
- Repeated cube IDs from the linked account are preserved instead of being silently removed by the optimizer.
- If bounded low-memory search returns fewer than five disjoint teams, a bounded remaining-roster repair fills the missing team; only a validated 5-team / 25-slot / 25-unique-member result is rendered.
- Real shortages now report supported unique, B1, B2, active B3 and FLEX counts. The old combined zero-team message is removed.
- Successful results are cached by linked-roster fingerprint and invalidated on roster mutation.

## Release gates passed on the branch

- Static, favorite-item and four-surface propagation regressions: PASS.
- Cloudflare asset build and root/public mirror: PASS.
- 107-character representative mobile regression: PASS.
- 107-character repeated 96 MB low-memory regression: PASS.
- 186-character linked-roster mobile regression: 186 stored/owned, five teams, 25 unique members, unsupported supplementals selected 0, PASS.
- Current production Cloudflare origin and live same-origin BlaBla bridge preflight: PASS.

The main-only Cloudflare workflow verifies the deployed V34.7.13 HTML marker, Worker version, configured bridge and a real nonempty profile response after merge.

## V34.7.11 linked roster policy

- Linked external rows are retained in an account-scoped raw snapshot, while calculations use the current app registry and current calculation profiles dynamically.
- No 100-character hardcode exists; future app-supported characters automatically join calculation after app update.
- Thursday BlaBla refresh: 11:00 and 19:00 KST while running, with missed latest slot catch-up on next launch and a manual refresh button.

## V34.7.13 Solo Raid five-deck MVP

- All three composition modes (`auto`, `owned`, `allEqual`) normalize Solo Raid combat to level 400 and require five complete, disjoint teams.
- The production selector preserves Crown family alternatives, Maid Mast + Anchor, Pri -> Mint, Makoto + Yukiko, and boss-specific packages without forcing mutually exclusive alternatives simultaneously.
- Modernia is globally FLEX/off-burst in Solo Raid and can never occupy either active B3 slot.
- Favorite-item Phase 0 Moran, Flora, Privaty, Helm, Sugar, Centi, Zwei, Miranda and Rosanna are excluded from raid candidates; Phantom is the sole Phase 0 exception.
- Elemental shotgun shells are optional score competitors. The shotgun Soline slot means Soline: Frost Ticket, never base Soline.
- Christmas Brid is a preferred Fire B2 candidate, not a mandatory shotgun or five-deck lock. Arcana can win when healing is unnecessary; Nayuta or Naga can win for survival and mechanics.
- The exact coarse candidate-pool optimum is followed by deterministic high-resolution contender reranking, so the displayed 0.05-second timeline score—not a lower-resolution proxy—decides among realistic one- and two-team cover exchanges.
- Precision, Solo Raid, five-deck and battle-simulation timelines share the same growth, favorite item, overload, equipment and cube context. Five-deck timelines are collapsed per team and expand into a wide chart plus a five-row character damage rail.
- Linked raw roster snapshots keep every received row, while optimizer participation is restricted to app-supported calculation profiles. Character search is available at selection surfaces.

Release gates include static integration, all three production modes, multi-boss optimality, special-combination coverage, shotgun policy, favorite-item gating, linked-roster propagation, cancellation/cache, low-memory browser crash resistance, timeline browser layout, signed APK badging/signature/embedded-HTML hash, and live Cloudflare verification.
