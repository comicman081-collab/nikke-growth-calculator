# GitHub deployment status

Current production build: **V34.7.10 BlaBla-linked five-deck stability**

## V34.7.10 linked-roster repair staging

- The production V34.7.10 build can receive and store a large BlaBla roster, but an inherited fixed-catalog `getOwned()` wrapper may expose only built-in calculation rows to downstream consumers.
- This caused a real 186-character linked roster to be misreported as `insufficientRoster`, sometimes with `team count 0 / slot count 0 / duplicate members` even though the saved roster and role capacity were sufficient.
- V34.7.10 reconstructs ownership from the dynamic catalog plus the central saved document, keeps all 186 linked rows visible in My Roster, and uses only audited calculation profiles in Precision, Simulation and five-deck scoring.
- It preserves linked level, skills, favorite phase, cube, overload and observed equipment values across the four calculation surfaces.
- A bounded fifth-team repair fills a missing team from remaining supported owned profiles, and only a validated 5-team / 25-unique-member result is rendered.
- Real shortages are reported with supported unique, B1, B2, active B3 and FLEX counts instead of the misleading combined error.
- The release gate includes a 186-row Android-size, 4 GB device, 96 MB V8 old-space browser regression plus the existing 107-row low-memory and four-surface regressions.

The V34.7.10 canonical source and production deployment are not complete until the repair workflow, pull request, Cloudflare deployment verification and matching signed APK all pass.
