# Route200: project instructions

**Start of every session, and immediately after any context compaction: read `PROGRESS.md` in this same directory before doing anything else.** It has the module plan, decisions already made, and the session log. Don't re-derive architecture decisions or re-ask the user things already answered there.

This is a real product (NASA Space Apps 2026 entry, team CUET_404, Route200), not a disposable hackathon demo. Write code and docs accordingly:

- No hackathon-clock language ("demo", "judges", "36-hour build") in product code, comments, or docs.
- No em dashes in prose (README, docs, UI copy). Use periods/colons/commas. Numeric ranges use a plain en dash (`15–24`) which is fine.
- The web app consumes a mock data layer shaped exactly like the real engine's eventual output (see `docs/WEB_DATA_CONTRACT.md` once written). Don't hardcode UI logic that only works with fake data — it must be a straight swap to live data later.
- Update `PROGRESS.md` after finishing each module in the plan, and before stopping for any reason.
