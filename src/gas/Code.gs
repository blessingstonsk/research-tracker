/* ===== Research Tracker web app: serves the tracker and keeps every record in this Google Sheet =====
 * Records live in the hidden "_data" tab, one row per record (collection, id, JSON, updatedAt).
 * The readable tabs (Daily Log, Tasks, Literature …) are rebuilt from those rows by refreshTabs(),
 * using the same layout as the tracker's sync (Lib.gs = core.js + sheetspec.js). */
const DATA_SHEET = '_data';
const DATA_COLS = ['settings', 'logs', 'tasks', 'objectives', 'milestones', 'papers', 'gaps', 'experiments', 'datasets', 'manuscripts', 'meetings', 'reports', 'backups'];
const CELL_LIMIT = 49000; // Google Sheets holds at most 50,000 characters per cell

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Research Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover');
}

function dataSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(DATA_SHEET);
  if (!sh) {
    sh = ss.insertSheet(DATA_SHEET);
    sh.getRange('A:D').setNumberFormat('@');
    sh.getRange(1, 1, 1, 4).setValues([['collection', 'id', 'json', 'updatedAt']]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  return sh;
}
function rows_(sh) { const n = sh.getLastRow() - 1; return n > 0 ? sh.getRange(2, 1, n, 3).getValues() : []; }
function withLock_(fn) { const lock = LockService.getScriptLock(); lock.waitLock(30000); try { return fn(); } finally { lock.releaseLock(); } }

/** Every record, grouped by collection, plus the sheet's link. */
function loadAll() {
  const data = {};
  rows_(dataSheet_()).forEach(r => { if (r[0] && r[2]) (data[r[0]] = data[r[0]] || []).push(JSON.parse(r[2])); });
  return JSON.stringify({ url: SpreadsheetApp.getActive().getUrl(), data });
}

/** Insert or replace records of one collection. `json` is an array of records with ids. */
function saveRecords(col, json) {
  if (DATA_COLS.indexOf(col) < 0) throw new Error('Unknown collection ' + col);
  const recs = JSON.parse(json);
  return withLock_(() => {
    const sh = dataSheet_(); const at = {};
    rows_(sh).forEach((r, i) => { at[r[0] + '/' + r[1]] = i + 2; });
    const add = [];
    recs.forEach(rec => {
      if (!rec || !rec.id) throw new Error('A record without an id cannot be saved');
      const s = JSON.stringify(rec);
      if (s.length > CELL_LIMIT) throw new Error('This ' + col + ' entry is too long to fit in one sheet cell; shorten its text');
      const row = [col, String(rec.id), s, rec.updatedAt || new Date().toISOString()];
      const n = at[col + '/' + rec.id];
      if (n) sh.getRange(n, 1, 1, 4).setValues([row]); else { add.push(row); at[col + '/' + rec.id] = -1; }
    });
    if (add.length) sh.getRange(sh.getLastRow() + 1, 1, add.length, 4).setValues(add);
    return 'ok';
  });
}

/** Remove records of one collection. `json` is an array of ids. */
function deleteRecords(col, json) {
  const ids = JSON.parse(json);
  return withLock_(() => {
    const sh = dataSheet_();
    const del = [];
    rows_(sh).forEach((r, i) => { if (r[0] === col && ids.indexOf(String(r[1])) >= 0) del.push(i + 2); });
    del.reverse().forEach(n => sh.deleteRow(n));
    return 'ok';
  });
}

/** Rebuild the readable tabs from the records, keeping their formatting. */
function refreshTabs() {
  return withLock_(() => {
    const all = JSON.parse(loadAll()).data;
    const s = {};
    DATA_COLS.forEach(c => { s[c] = all[c] || []; });
    s.settings = (all.settings || []).find(x => x.id === 'main') || JSON.parse(JSON.stringify(Core.DEFAULT_SETTINGS));
    const data = SheetSpec.buildData(s);
    const ss = SpreadsheetApp.getActive(); let rows = 0;
    SheetSpec.TABS.filter(t => !t.dashboard).forEach(t => {
      let sh = ss.getSheetByName(t.title);
      if (!sh) {
        sh = ss.insertSheet(t.title);
        const head = SheetSpec.headerValues(t);
        sh.getRange(1, 1).setValue(head[0][0]).setFontSize(18).setFontWeight('bold');
        sh.getRange(2, 1).setValue(head[1][0]).setFontStyle('italic');
        sh.getRange(3, 1, 1, head[2].length).setValues([head[2]]).setFontWeight('bold');
        sh.setFrozenRows(3);
      }
      if (sh.getMaxRows() > 3) sh.getRange(4, 1, sh.getMaxRows() - 3, sh.getMaxColumns()).clearContent();
      const d = data[t.title];
      if (!d.length) return;
      const w = d[0].length;
      if (sh.getMaxRows() < d.length + 3) sh.insertRowsAfter(sh.getMaxRows(), d.length + 3 - sh.getMaxRows());
      if (sh.getMaxColumns() < w) sh.insertColumnsAfter(sh.getMaxColumns(), w - sh.getMaxColumns());
      sh.getRange(4, 1, d.length, w).setValues(d);
      rows += d.length;
    });
    const at = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'd MMM yyyy, HH:mm');
    const dash = ss.getSheetByName('Dashboard');
    if (dash) dash.getRange('A2').setValue('Explainable VLMs for Autonomous Driving. Saved from Research Tracker on ' + at + ' (Asia/Kolkata). Edit records in the tracker; the data tabs are rebuilt after each change.');
    return JSON.stringify({ rows, at });
  });
}
