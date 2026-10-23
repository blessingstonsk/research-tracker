# PhD Research Tracker

## Your own web app (saves into Google Sheets, works on any device)
The tracker runs as a Google Apps Script web app attached to the "Research Tracker" Google Sheet.
Every entry is written into the sheet's hidden `_data` tab, and the readable tabs (Daily Log, Tasks, …)
are rebuilt from it a few seconds after each change. Open the web app link on any phone, tablet or computer
signed in to the same Google account.

Set up once (files are in `src/dist/gas/`, made by `python build.py`):
1. Open the Google Sheet → Extensions → Apps Script.
2. Replace the contents of `Code.gs` with `src/dist/gas/Code.gs`.
3. Click + → Script, name it `Lib`, paste `src/dist/gas/Lib.gs`.
4. Click + → HTML, name it `Index`, paste `src/dist/gas/Index.html`. Click Save.
5. Deploy → New deployment → gear icon → Web app. Execute as: Me. Who has access: Only myself. Deploy.
6. Authorise (Advanced → Go to project, since it is your own unverified script), then copy the Web app URL.
7. Open that URL on your phone and use "Add to Home screen" for an app icon.

After changing the source: run `python build.py`, paste the changed files again, then
Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy. The URL stays the same.

## Claude version (earlier)
https://claude.ai/artifact/NKdfxP6Y3RupEM91inCwKW keeps its own separate copy of the records.
Its automatic Google Sheets sync is switched off so it does not overwrite the sheet; use the web app instead.

## Offline copy
Open `research-tracker.html` in Chrome or Edge. Records are kept in that browser's storage only
(separate from the online version). Use More → Import workbook to load the Excel file, and
More → Export & backup to move data between the two (backup .json → Restore).

## Source
`src/` holds the source. Run `python build.py` inside `src/` to rebuild `dist/index.html` (online) and `dist/local.html` (offline).
`scene3d.js` draws the interactive 3D effort street (three.js). `core.js` contains all calculations (hours, days worked, averages, progress, import, citations, reports).

## How progress is calculated
- Total hours = sum of session hours; blank hours are flagged, never counted as 0.
- Days worked = distinct dates with at least one session. Average = total hours ÷ days worked, same period.
- Research, teaching and admin hours are separated by each focus area's kind.
- Objective progress = completed milestones ÷ confirmed milestones; shown as unavailable when none exist. Hours are shown separately as effort.
- Tasks count once each; a log session's status is never counted as task completion.
- A paper is fully read only when marked Read; the log's Papers Read number is a separate count.

## Google Sheets sync (Claude version only)
In the Claude version: Settings & data → Google Sheets.
1. Create a blank sheet at sheets.new and copy its link.
2. Paste the link, click Save link, then "Set up template & sync" (allow Google Sheets when Claude asks).
3. The tracker builds the tabs (Dashboard, Daily Log, Tasks, Objectives, Milestones, Literature, Research Gaps,
   Experiments, Datasets, Writing, Meetings, Lists) and copies every record. Click "Sync now" after changes,
   or tick automatic sync.
The sheet is a one-way copy: edit in the tracker, because each sync replaces the data tabs.
`src/sheetspec.js` defines the sheet layout and formulas; `src/gsync.js` does the sync.
In the web app, `src/gas/Code.gs` stores the records and rebuilds the tabs with the same layout.
