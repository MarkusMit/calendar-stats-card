# Quickstart: Replace Hardcoded Precipitation Zero-Exclusion With `show_zero`

## Prerequisites

- Node.js 24.15
- Existing `npm install` completed in `frontend/`
- Working tree on branch `010-precip-show-zero`

## Verify green baseline

Constitution Principle II requires green tests before any new work.

```bash
cd frontend
npm test
```

If the baseline is not green, **stop** and report failures to the user before proceeding (per memory `feedback-tdd-run-tests-first`).

## TDD walkthrough

### Step 1 — Red: update existing precipitation tests, add new show_zero tests

Edit the test files (do **not** touch source yet):

- `tests/unit/services/data-transform.test.ts`
  - Modify the two existing tests at lines 274 and 358 (`precipitation: zero-sum days excluded …`) to pass `excludeZero: true` derived from a row config with `show_zero: false`, not from `device_class: 'precipitation'`.
  - Add three new test cases:
    1. Cumulative entity (non-precipitation) with `show_zero: false` → summary min/avg/max exclude zero-sum days.
    2. Cumulative entity (precipitation, `device_class: 'precipitation'`) with `show_zero` omitted (default `true`) → summary min/avg/max **include** zero-sum days.
    3. All-zero month with `show_zero: false` → returned summary's `min`/`mean`/`max` are `null` (FR-006).
- `tests/component/monthly-table.test.ts`
  - Add explicit `show_zero: false` to the precipitation fixtures at lines 864, 881, 983 wherever the assertion expects zero-exclusion.
  - Add one new test: `total_increasing` entity with a counter-reset day (negative raw sum → clamped to 0) and `show_zero: false` → that day is excluded from the summary (uniformity per clarification 2026-05-30).
- `tests/component/year-table.test.ts`
  - Update the fixture at line 24 to use `show_zero: false` for the precipitation test setup.

Run tests:

```bash
npm test
```

You should see **red**.
Verify the failures are exactly the new + modified assertions; if any unrelated test breaks, stop and investigate.

### Step 2 — Green: implement the refactor

Edit source files:

1. **`frontend/src/services/data-transform.ts`**
   - `computeMonthlySummaryFromDailyValues`: rename parameter `isPrecipitation: boolean` → `excludeZero: boolean`.
     Body unchanged (the parameter was already used as the exclude-zero flag).
   - `transformMonthlyStats`: add `entityConfigs: EntityConfig[]` parameter.
     Replace `const isPrecipitation = meta.deviceClass === 'precipitation';` with `const cfg = entityConfigs.find((c) => 'entity' in c && c.entity === entityId); const excludeZero = (cfg as { show_zero?: boolean } | undefined)?.show_zero === false;`.
     Pass `excludeZero` to `computeMonthlySummaryFromDailyValues`.

2. **`frontend/src/calendar-stats-card.ts`**
   - Update the `transformMonthlyStats` call to pass `this._config.entities` as the 4th argument.
   - In the expression-row loop (≈ line 321), derive `excludeZero` from `cfg.show_zero === false` and pass it to `collectDailySums`.
   - In the current-month-fill loop (≈ line 346), replace `meta.deviceClass === 'precipitation'` with `cfg.show_zero === false`.

3. **`frontend/src/translations/en.json`**
   - Change `"show_zero": "Show zero-value days"` → `"show_zero": "Include zero-value days"`.

4. **`frontend/src/translations/de.json`**
   - Change `"show_zero": "Nullwerttage anzeigen"` → semantically equivalent translation matching the new English (e.g. `"Nullwerttage einbeziehen"`).

Re-run tests:

```bash
npm test
```

You should see **green**.

### Step 3 — Refactor / lint

```bash
npm run lint
npm run build
```

Both must pass.

### Step 4 — Doc + governance updates

Editing these files does not affect the test run but is part of the feature scope.

1. **`docs/README.md`**
   - Update the `show_zero` row in both option tables (Entity row + Expression row) to describe the dual effect.
   - Remove the bullet under **Features → Smart monthly summary** that references precipitation zero-exclusion.
2. **`.specify/memory/constitution.md`**
   - Update Principle III: remove the `device_class: precipitation` clause; replace with a generic `show_zero` rule.
   - Bump version `1.0.1` → `2.0.0`.
   - Add a new sync-impact report entry at the top of the file.
3. **`.claude/CLAUDE.md`**
   - Line 25 currently reads `Monthly summary min/avg/max; for precipitation-like, exclude zero-value days from avg/min/max`.
     Replace with `Monthly summary min/avg/max for cumulative/expression rows; zero-day inclusion controlled by per-row show_zero (default include)`.
4. **`specs/001-monthly-stats-card/spec.md`**
   - Amend FR-016: add a "Session 2026-05-30" clarification entry near the bottom of the clarifications block, noting that the precipitation-specific rule was superseded by feature 010.
     Leave FR-016 text intact for historical record but reference the new clarification.

### Step 5 — Verify in HA

Optional manual smoke test:

```bash
cd frontend
npm run build
# Deploy via your usual route (e.g. scripts/deploy.sh)
```

In HA:

1. Add or open a card with a `device_class: precipitation` entity, **no** `show_zero` field.
   Verify summary min/avg/max now include zero-rain days.
2. Add `show_zero: false` via the visual editor.
   Verify summary changes in real time and zero-rain days disappear from min/avg/max.
3. Add a non-precipitation cumulative entity (e.g. energy) with `show_zero: false`.
   Verify summary min/avg/max exclude zero days — a capability that did not exist before.
4. Verify the editor toggle label reads "Include zero-value days" (EN) or the new DE equivalent.
