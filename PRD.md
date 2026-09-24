# Workout Recorder — Product Requirements Document

## 1. Overview

Workout Recorder is a Google Apps Script bound to a single Google Spreadsheet. It
lets one person log gym sets on a phone with minimal typing, derives a per-day
workout record from that log, and tracks how many prepaid trainer sessions remain.

The spreadsheet *is* the UI. There is no web app, no add-on menu, and no external
service. All logic runs either on spreadsheet events (`onEdit`, `onSelectionChange`)
or on a daily time-based trigger.

## 2. Goals

- **G1 — Frictionless logging.** Recording a set during a workout must take as few
  taps as possible: pick a drill from a dropdown, type weight and reps. Timestamps
  are never typed by hand.
- **G2 — Context while training.** While logging, the user must be able to see their
  own history for the drill they are currently doing, in order to pick the next load.
- **G3 — Automatic session accounting.** Individual sets must roll up into one
  "workout" per calendar day, with a duration, without manual bookkeeping.
- **G4 — Know the balance.** The user must always see how many paid trainer sessions
  are left, computed from payments minus sessions actually used.

## 3. Non-goals

- Multi-user support. There is one spreadsheet, one owner, no per-user data.
- Programme planning, periodisation, or workout prescription.
- Mobile app, web UI, or notifications.
- Editing or correcting historical data through code — corrections are made by
  editing the sheet directly.
- Currency handling. `money.Sum` is recorded but never read by any logic.

## 4. Users

Single user: the athlete, logging from the Google Sheets mobile app during a
workout and reviewing on desktop afterwards. Requires edit access to the
spreadsheet and ownership of the bound Apps Script project.

## 5. Data model

`initializeSpreadsheet()` provisions six sheets. It is idempotent: sheets that
already exist are reused, and headers are only written when a sheet is empty.

| Sheet | Columns | Written by | Read by |
| --- | --- | --- | --- |
| `drills` | `Mscl`, `Drill` | User | Dropdown validation for `log!B` and `rec!A1` |
| `log` | `Date`, `Drill`, `W`, `R` | User + `onEdit` | `processDailyWorkouts`, `rec!A2` formula |
| `rec` | `A1` = drill selector, `A2` = `=FILTER(log!A:D, log!B:B=A1)` | `onEdit`, `onSelectionChange` | User |
| `money` | `Date`, `Workouts`, `Sum` | User | `updateBalance` |
| `workout` | `Date`, `Duration, min`, `Work alone` | `processDailyWorkouts` + user | `updateBalance` |
| `balance` | `A1` (number) | `updateBalance` | User |

Notes on the model:

- `log.Date` holds a full timestamp, not a date. `processDailyWorkouts` relies on
  the time component to compute session duration.
- `log.W` (weight) and `log.R` (reps) are free-form; no code reads or validates them.
- `drills.Mscl` (muscle group) is organisational only; no code reads it.
- `workout."Work alone"` is a boolean the user sets manually. `processDailyWorkouts`
  always inserts `false`, so "a trainer session was used" is the default.
- Drill dropdowns are sourced from `drills!B2:B1000`, so the catalog is capped at
  999 drills and the log at 999 rows of validated entries.

## 6. Functional requirements

### FR-1 — Auto-timestamp a logged set

*Trigger:* user edits column B (`Drill`) of the `log` sheet.

When a drill is entered in `log!B{row}`, if `log!A{row}` is empty the script writes
the current date-time into it. Edits to any other column or any other sheet are
ignored.

### FR-2 — Back-fill rows left blank above the edit

*Trigger:* same edit as FR-1.

Starting one row above the edited row and walking upward, every row whose column B
is empty is filled with the same drill value; its column A is also set to the same
timestamp if empty. The walk stops at the first row that already has a value in
column B, or at row 1.

*Rationale:* the user often performs several sets of the same drill, filling only
weight and reps per row, and names the drill once at the bottom. This makes the
sheet self-repairing rather than requiring the drill to be re-typed per set.

*Known consequence:* the loop is not bounded by the header row, so a drill entered
in row 2 with an empty row 1 would overwrite the `log` header. Setup writes headers
into row 1, so in practice the loop stops there.

### FR-3 — Mirror the drill into the history view

*Trigger:* an edit (FR-1) or a selection change in column B of `log`.

The drill value is written to `rec!A1`. The `=FILTER(log!A:D, log!B:B=A1)` formula
in `rec!A2` then shows every logged set for that drill. Merely moving the cursor
onto a drill cell is enough — no edit required.

*Requirement:* this is the mechanism behind G2. `rec!A1` is script-owned and must
not be edited by hand while training.

### FR-4 — Roll the log up into daily workouts

*Trigger:* time-based, daily at 00:00 in the spreadsheet timezone (`Europe/Moscow`).

`processDailyWorkouts()`:

1. Reads `log`, locating the `Date` column by header name. A missing header is a
   fatal error.
2. Groups rows by calendar date (`yyyy-MM-dd` in the spreadsheet timezone),
   ignoring rows whose date cell is not a real `Date`.
3. For each group computes `duration = round((max timestamp − min timestamp) / 60s)`
   in minutes.
4. Appends `[date, duration, false]` to `workout` for every date not already
   present there.

The duplicate check makes the function safe to re-run: existing workout dates are
never rewritten, so manual edits to `Duration` or `Work alone` survive.

### FR-5 — Compute the session balance

*Trigger:* time-based, daily at 00:00, alongside FR-4.

`updateBalance()` writes `balance!A1` = `paid − used`, where:

- **paid** = sum of the `money.Workouts` column, skipping values that do not parse
  as numbers.
- **used** = count of non-empty `workout` rows whose `Work alone` is not exactly
  `true`.

A positive result is sessions remaining; a negative result is sessions owed.
Sessions trained alone are excluded from consumption, which is the reason the
`Work alone` flag exists.

### FR-6 — One-time setup

`initializeSpreadsheet()` creates the six sheets, writes headers, attaches drill
dropdown validation (strict on `log!B`, permissive on `rec!A1`), and installs the
`rec!A2` FILTER formula.

`setupTriggers()` deletes **all** existing project triggers, then installs daily
midnight triggers for `processDailyWorkouts` and `updateBalance`. Both functions are
idempotent and are invoked manually from the Apps Script editor.

## 7. Non-functional requirements

- **Runtime:** Apps Script V8, timezone `Europe/Moscow` (`appsscript.json`).
- **Source of truth:** this Git repository, not the Apps Script editor. Pushes to
  `main` run the Jest suite and then `clasp push --force`, overwriting the deployed
  project.
- **Testability:** every function is unit-tested against mocked `SpreadsheetApp`,
  `ScriptApp`, `Utilities`, and `Logger` globals (`tests/setup.js`,
  `tests/helpers.js`). Source files end with a `typeof module !== 'undefined'`
  export guard so the same file loads in both Apps Script and Node.
- **Deployment hygiene:** `.claspignore` keeps `node_modules`, tests, CI config, and
  package manifests out of the Apps Script project.
- **Performance:** FR-2 reads and writes cell-by-cell in a loop. Acceptable at the
  sheet sizes involved (hundreds of rows, a handful of blank rows per edit); it
  would need batching if the blank run ever grew long.

## 8. Open items

- `test()` in `Code.js` is a leftover scratch function that writes `"fsd"` into
  `rec!B1`. It is deployed but never called.
- `money.Sum` and `drills.Mscl` are captured but unused; either wire them into a
  report or drop them.
- `updateBalance` counts a `workout` row as used when `Work alone` is anything other
  than boolean `true` — a value stored as the text `"TRUE"` would be miscounted.
- Neither `processDailyWorkouts` nor `updateBalance` checks that its sheets exist;
  a renamed tab fails with a null dereference rather than a clear message.
