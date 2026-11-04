## Summary of Changes
- **SRS Requirement ID:** `FR-XX`
- **Trello Card Link:** [Link to Trello Card]
- **Author Initials:** `THE` / `TS` / `MJA` / `SMMI`

## SRS Definition of Done Checklist (SRS §4.3)
- [ ] User story and Given/When/Then confirmation criteria pass
- [ ] Backend authorization is enforced and tested (including 401/403 negative cases)
- [ ] Preserves ECB 4-layer separation (`Routers -> Services -> Repositories -> Schemas`)
- [ ] Google-style Python docstrings / TSDoc comments added for Sphinx/TypeDoc
- [ ] Automated `pytest` tests and `ruff` PEP 8 linter checks pass in GitHub Actions
- [ ] No `.env` secrets or personal credentials committed
