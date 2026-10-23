/* ===== Research Tracker core: pure logic (dates, calculations, import, citations, reports) ===== */
(function (root) {
'use strict';
const TZ = 'Asia/Kolkata';
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ---------- dates (all stored as ISO YYYY-MM-DD, interpreted in Asia/Kolkata) ---------- */
function todayISO(now) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now || new Date());
}
function isISO(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function parseISO(s) { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); }
function toISO(dt) { return dt.toISOString().slice(0, 10); }
function addDays(s, n) { const d = parseISO(s); d.setUTCDate(d.getUTCDate() + n); return toISO(d); }
function diffDays(a, b) { return Math.round((parseISO(b) - parseISO(a)) / 86400000); }
function fmtDate(s) { if (!isISO(s)) return s ? String(s) : ''; const d = parseISO(s); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
function fmtShort(s) { if (!isISO(s)) return ''; const d = parseISO(s); return d.getUTCDate() + ' ' + MONTHS[d.getUTCMonth()]; }
function dayName(s) { return isISO(s) ? DAYS[parseISO(s).getUTCDay()] : ''; }
function weekStart(s) { const d = parseISO(s); const wd = (d.getUTCDay() + 6) % 7; return addDays(s, -wd); } // Monday
function monthStart(s) { return s.slice(0, 8) + '01'; }
function monthEnd(s) { const d = parseISO(monthStart(s)); d.setUTCMonth(d.getUTCMonth() + 1); d.setUTCDate(0); return toISO(d); }
function monthLabel(s) { const d = parseISO(s); return MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear(); }
function excelSerialToISO(n) { return toISO(new Date(Math.round((Math.floor(n) - 25569) * 86400000))); }
function nowStamp() { return new Date().toISOString(); }
function inRange(d, from, to) { return isISO(d) && (!from || d >= from) && (!to || d <= to); }

/** Parse a date coming from a spreadsheet cell or user input. Returns {value, warn} */
function parseDateValue(v) {
  if (v === null || v === undefined || v === '') return { value: null };
  if (typeof v === 'number' && isFinite(v)) {
    if (v > 20000 && v < 80000) return { value: excelSerialToISO(v) };
    return { value: null, warn: 'Unrecognised date number ' + v };
  }
  if (v instanceof Date && !isNaN(v)) return { value: toISO(new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()))) };
  const s = String(v).trim();
  if (isISO(s)) return { value: s };
  let m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})$/); // DD/MM/YYYY (Indian convention)
  if (m) return { value: m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0'), warn: 'Read "' + s + '" as day/month/year' };
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})$/);
  if (m) { const mi = MONTHS.findIndex(x => x.toLowerCase() === m[2].toLowerCase()); if (mi >= 0) return { value: m[3] + '-' + String(mi + 1).padStart(2, '0') + '-' + m[1].padStart(2, '0') }; }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})T/);
  if (m) return { value: m[1] + '-' + m[2] + '-' + m[3] };
  return { value: null, warn: 'Could not read date "' + s + '"' };
}

/* ---------- ids & fingerprints ---------- */
function uid(prefix) { return (prefix || 'r') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
function fnv1a(str) { let h = 0x811c9dc5; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); }
function norm(s) { return (s === null || s === undefined) ? '' : String(s).trim().replace(/\s+/g, ' ').toLowerCase(); }
function normTitle(s) { return norm(s).replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); }
function logFingerprint(r) { return 'log:' + fnv1a([r.date, norm(r.focus), norm(r.taskType), norm(r.what), r.hours == null ? '' : Number(r.hours)].join('|')); }
function paperFingerprint(r) { return r.doi ? 'paper:doi:' + norm(r.doi) : 'paper:' + fnv1a(normTitle(r.title)); }

/* ---------- defaults ---------- */
const DEFAULT_FOCUS = [
  { name: 'O1 – VLM Adaptation (Edge Cases)', kind: 'research', objectiveId: 'obj-O1' },
  { name: 'O2 – Cross-Modal Explainability', kind: 'research', objectiveId: 'obj-O2' },
  { name: 'O3 – Faithfulness Evaluation', kind: 'research', objectiveId: 'obj-O3' },
  { name: 'Paper Writing', kind: 'research', objectiveId: '' },
  { name: 'Comprehensive Viva Prep', kind: 'research', objectiveId: '' },
  { name: 'Coursework / Teaching', kind: 'teaching', objectiveId: '' },
  { name: 'Admin / Meetings', kind: 'admin', objectiveId: '' },
  { name: 'Other', kind: 'other', objectiveId: '' }
];
const DEFAULT_SETTINGS = {
  id: 'main',
  focusAreas: DEFAULT_FOCUS,
  taskTypes: ['Literature Reading','Experiment / Coding','Dataset Work','Writing','Analysis / Results','Meeting with Guide','Presentation Prep','Revision / Review','Other'],
  statuses: ['Planned','In Progress','Blocked','Done'],
  priorities: ['High','Medium','Low'],
  readingStatuses: ['To Read','Skimmed','Reading','Read'],
  writingStages: ['Idea','Outline','Drafting','Internal Review','Submitted','Under Review','Revision','Accepted','Rejected','Published'],
  milestoneKinds: ['Comprehensive viva','Literature review','Baseline implementation','Experiments','Manuscript submission','Progress review','Thesis chapter','Other'],
  experimentStatuses: ['Planned','Running','Completed','Failed','Abandoned'],
  datasetStatuses: ['Not started','Requesting access','Downloading','Preparing','Ready','Archived'],
  gapStatuses: ['Proposed','Investigating','Addressed','Dropped'],
  metricCategories: ['Scene understanding','Explanation faithfulness','Interpretability','Uncertainty','Edge cases','Other'],
  targets: { weeklyHours: null, dailyHours: null, papersPerMonth: null },
  savedFilters: []
};
const DEFAULT_OBJECTIVES = [
  { id: 'obj-O1', code: 'O1', title: 'Adapt VLMs for contextual reasoning in complex and edge-case driving scenes.', description: '', contribution: '', successCriteria: '', evidence: '', focus: 'O1 – VLM Adaptation (Edge Cases)' },
  { id: 'obj-O2', code: 'O2', title: 'Develop cross-modal explanations connecting predictions to visual regions and language concepts.', description: '', contribution: '', successCriteria: '', evidence: '', focus: 'O2 – Cross-Modal Explainability' },
  { id: 'obj-O3', code: 'O3', title: 'Evaluate explanation faithfulness and human interpretability in autonomous driving.', description: '', contribution: '', successCriteria: '', evidence: '', focus: 'O3 – Faithfulness Evaluation' }
];
const DEFAULT_MILESTONE_TEMPLATES = [
  ['Comprehensive viva', 'Comprehensive viva', ''],
  ['Literature review completed', 'Literature review', ''],
  ['Baseline VLM implementation', 'Baseline implementation', 'obj-O1'],
  ['Edge-case adaptation experiments', 'Experiments', 'obj-O1'],
  ['Cross-modal explanation experiments', 'Experiments', 'obj-O2'],
  ['Faithfulness & interpretability evaluation', 'Experiments', 'obj-O3'],
  ['First manuscript submission', 'Manuscript submission', ''],
  ['Doctoral committee progress review', 'Progress review', ''],
  ['Thesis chapter: Literature review', 'Thesis chapter', '']
];
function defaultMilestones() {
  return DEFAULT_MILESTONE_TEMPLATES.map((t, i) => ({ id: 'ms-default-' + (i + 1), title: t[0], kind: t[1], objectiveId: t[2], targetDate: null, status: 'Planned', completedDate: null, criteria: '', evidence: '', deliverable: '', template: true }));
}

/* ---------- helpers over state ---------- */
function live(arr) { return (arr || []).filter(r => !r.deleted); }
function focusInfo(settings, name) { return (settings.focusAreas || []).find(f => f.name === name) || null; }
function focusKind(settings, name) { const f = focusInfo(settings, name); return f ? (f.kind || 'other') : 'other'; }
/** objective id of a log: via its focus area mapping, or linked task / experiment / milestone */
function logObjective(state, log) {
  const f = focusInfo(state.settings, log.focus);
  if (f && f.objectiveId) return f.objectiveId;
  const L = log.links || {};
  const find = (col, id) => id && (state[col] || []).find(x => x.id === id);
  const t = find('tasks', L.taskId); if (t && t.objectiveId) return t.objectiveId;
  const e = find('experiments', L.experimentId); if (e && e.objectiveId) return e.objectiveId;
  const m = find('milestones', L.milestoneId); if (m && m.objectiveId) return m.objectiveId;
  return '';
}
function filterLogs(state, f) {
  f = f || {};
  return live(state.logs).filter(l =>
    (!f.from || (l.date && l.date >= f.from)) &&
    (!f.to || (l.date && l.date <= f.to)) &&
    (!f.taskType || l.taskType === f.taskType) &&
    (!f.focus || l.focus === f.focus) &&
    (!f.kind || focusKind(state.settings, l.focus) === f.kind) &&
    (!f.objectiveId || logObjective(state, l) === f.objectiveId));
}
function isNum(v) { return typeof v === 'number' && isFinite(v); }
function round2(n) { return Math.round(n * 100) / 100; }

/** Core effort summary. Total hours = sum of logged session hours; each working date counted once;
 *  average = total hours / distinct working dates (same period). Missing hours are reported, never treated as zero. */
function summarizeLogs(state, logs) {
  const out = { sessions: logs.length, totalHours: 0, missingHours: 0, dates: new Set(), byKind: { research: 0, teaching: 0, admin: 0, other: 0 }, byFocus: {}, byType: {}, prodSum: 0, prodN: 0, papersReadSum: 0, papersReadN: 0, papersReadMissing: 0, logStatus: {}, withOutput: 0 };
  for (const l of logs) {
    if (l.date) out.dates.add(l.date);
    if (isNum(l.hours)) {
      out.totalHours += l.hours;
      const k = focusKind(state.settings, l.focus); out.byKind[k] = (out.byKind[k] || 0) + l.hours;
      const fk = l.focus || '(no focus area)'; out.byFocus[fk] = (out.byFocus[fk] || 0) + l.hours;
      const tk = l.taskType || '(no task type)'; out.byType[tk] = (out.byType[tk] || 0) + l.hours;
    } else out.missingHours++;
    if (isNum(l.productivity)) { out.prodSum += l.productivity; out.prodN++; }
    if (isNum(l.papersRead)) { out.papersReadSum += l.papersRead; out.papersReadN++; } else out.papersReadMissing++;
    const st = l.status || '(no status)'; out.logStatus[st] = (out.logStatus[st] || 0) + 1;
    if (l.output && String(l.output).trim()) out.withOutput++;
  }
  out.totalHours = round2(out.totalHours);
  out.days = out.dates.size;
  out.avgPerDay = out.days ? round2(out.totalHours / out.days) : null;
  out.prodAvg = out.prodN ? round2(out.prodSum / out.prodN) : null;
  return out;
}
function taskActualHours(state, taskId) {
  let h = 0, n = 0;
  for (const l of live(state.logs)) if (l.links && l.links.taskId === taskId) { n++; if (isNum(l.hours)) h += l.hours; }
  return { hours: round2(h), sessions: n };
}
function taskCounts(state, f) {
  const c = {}; (state.settings.statuses || []).forEach(s => c[s] = 0);
  for (const t of filterTasks(state, f)) c[t.status || 'Planned'] = (c[t.status || 'Planned'] || 0) + 1;
  return c;
}
function filterTasks(state, f) {
  f = f || {};
  return live(state.tasks).filter(t => (!f.objectiveId || t.objectiveId === f.objectiveId || (focusInfo(state.settings, t.focus) || {}).objectiveId === f.objectiveId));
}
function isDone(s) { return s === 'Done'; }
function overdueTasks(state, today) { return live(state.tasks).filter(t => !isDone(t.status) && t.dueDate && t.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate)); }
function depsDone(state, t) {
  const ids = t.dependsOn || []; if (!ids.length) return true;
  return ids.every(id => { const d = (state.tasks || []).find(x => x.id === id); return !d || d.deleted || isDone(d.status); });
}
/** Next priority actions: open, unblocked tasks whose dependencies are done, ranked by overdue → priority → due date. */
function priorityActions(state, today, n) {
  const pr = { High: 0, Medium: 1, Low: 2 };
  const open = live(state.tasks).filter(t => !isDone(t.status) && t.status !== 'Blocked' && depsDone(state, t));
  open.sort((a, b) => {
    const ao = a.dueDate && a.dueDate < today ? 0 : 1, bo = b.dueDate && b.dueDate < today ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const ap = pr[a.priority] ?? 1, bp = pr[b.priority] ?? 1; if (ap !== bp) return ap - bp;
    const ad = a.dueDate || '9999', bd = b.dueDate || '9999'; if (ad !== bd) return ad.localeCompare(bd);
    return (a.createdAt || '').localeCompare(b.createdAt || '');
  });
  const res = open.slice(0, n).map(t => ({ type: 'task', task: t, reason: (t.dueDate && t.dueDate < today ? 'Overdue since ' + fmtDate(t.dueDate) : t.dueDate ? 'Due ' + fmtDate(t.dueDate) : 'No due date') + ' · ' + (t.priority || 'Medium') + ' priority' }));
  if (res.length < n) {
    // fall back to recent "Next step" notes not yet turned into tasks
    const seen = new Set();
    const logs = live(state.logs).filter(l => l.nextStep && !l.nextStepTaskId).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    for (const l of logs) {
      const k = norm(l.nextStep); if (seen.has(k)) continue; seen.add(k);
      res.push({ type: 'nextStep', log: l, reason: 'Next step noted on ' + fmtDate(l.date) + ' (not yet a task)' });
      if (res.length >= n) break;
    }
  }
  return res;
}
/** Objective progress = completed milestones / milestones defined for that objective. null = no milestones defined. */
function objectiveProgress(state, objId) {
  const ms = live(state.milestones).filter(m => m.objectiveId === objId && !m.template);
  const done = ms.filter(m => isDone(m.status)).length;
  const deliverables = live(state.logs).filter(l => l.output && String(l.output).trim() && logObjective(state, l) === objId).length;
  return { total: ms.length, done, pct: ms.length ? Math.round(100 * done / ms.length) : null, deliverables };
}
function programmeProgress(state) {
  const ms = live(state.milestones).filter(m => !m.template); const done = ms.filter(m => isDone(m.status)).length;
  return { total: ms.length, done, pct: ms.length ? Math.round(100 * done / ms.length) : null };
}
function papersFullyRead(state, from, to) { return live(state.papers).filter(p => p.readingStatus === 'Read' && (!from && !to ? true : inRange(p.dateRead, from, to))); }
function weeklySeries(state, logs, endISO, weeks) {
  const end = weekStart(endISO); const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDays(end, -7 * i), we = addDays(ws, 6);
    const row = { start: ws, end: we, research: 0, teaching: 0, admin: 0, other: 0, total: 0 };
    for (const l of logs) if (inRange(l.date, ws, we) && isNum(l.hours)) { const k = focusKind(state.settings, l.focus); row[k] += l.hours; row.total += l.hours; }
    ['research','teaching','admin','other','total'].forEach(k => row[k] = round2(row[k]));
    out.push(row);
  }
  return out;
}
function dailyTotals(logs) { const m = {}; for (const l of logs) if (l.date) { m[l.date] = m[l.date] || { hours: 0, sessions: 0 }; m[l.date].sessions++; if (isNum(l.hours)) m[l.date].hours = round2(m[l.date].hours + l.hours); } return m; }

/** Experiments are comparable only when dataset, dataset version, split and evaluation setting all match. */
function compatKey(e) { return [e.datasetId || '?', norm(e.datasetVersion) || '?', norm(e.split) || '?', norm(e.evalSetting) || '?'].join(' | '); }
function compatGroups(experiments) { const g = {}; for (const e of live(experiments)) { const k = compatKey(e); (g[k] = g[k] || []).push(e); } return g; }

/* ---------- workbook import ---------- */
const LOG_COLS = { 'date': 'date', 'day': '_day', 'focus area': 'focus', 'task type': 'taskType', 'what i worked on': 'what', 'hours': 'hours', 'status': 'status', 'output / deliverable': 'output', 'papers read': 'papersRead', 'blockers / issues': 'blockers', 'next step': 'nextStep', 'productivity (1–5)': 'productivity', 'productivity (1-5)': 'productivity', 'productivity': 'productivity', 'id': '_id' };
const READ_COLS = { 'date read': 'dateRead', 'title': 'title', 'authors': 'authors', 'venue / year': 'venueYear', 'relevant objective': 'objective', 'key idea': 'keyIdea', 'method / dataset': 'methodDataset', 'limitation / gap': 'limitation', 'use in my work': 'useInWork', 'cite? (y/n)': 'cite', 'id': '_id', 'reading status': 'readingStatus', 'doi': 'doi', 'url': 'url', 'keywords': 'keywords' };
function headerKey(v) { return norm(v).replace(/\s*\/\s*/g, ' / '); }

function sheetGrid(XLSX, ws) {
  if (!ws || !ws['!ref']) return { rows: [], range: null };
  const r = XLSX.utils.decode_range(ws['!ref']); const rows = [];
  for (let R = r.s.r; R <= r.e.r; R++) {
    const row = [];
    for (let C = r.s.c; C <= r.e.c; C++) { const c = ws[XLSX.utils.encode_cell({ r: R, c: C })]; row.push(c ? { v: c.v, f: c.f, t: c.t, w: c.w } : null); }
    rows.push({ R, cells: row });
  }
  return { rows, range: r };
}
function findHeader(grid, map, required) {
  for (let i = 0; i < Math.min(grid.rows.length, 20); i++) {
    const cells = grid.rows[i].cells; const cols = {};
    cells.forEach((c, ci) => { if (c && c.v != null) { const k = map[headerKey(c.v)]; if (k && !(k in cols)) cols[k] = ci; } });
    if (required.every(k => k in cols)) return { index: i, cols };
  }
  return null;
}
function cellVal(c) { if (!c || c.v === null || c.v === undefined) return null; if (typeof c.v === 'string' && c.v.trim() === '') return null; return c.v; }
function str(v) { return v === null || v === undefined ? '' : String(v).trim(); }
function numOrNull(v, msgs, label) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!isFinite(n)) { msgs.push({ level: 'warn', text: label + ' "' + v + '" is not a number — kept as missing' }); return null; }
  return n;
}

/**
 * Parse a workbook into an import plan. `existing` = current state (for duplicate detection).
 * Rows with only formulas (e.g. the Day column template) or no values are skipped as empty template rows.
 */
function planImport(XLSX, wb, existing, fileName) {
  const plan = { fileName, sheets: [], lists: null, logs: [], papers: [], totals: { new: 0, duplicate: 0, error: 0, empty: 0 }, messages: [] };
  const existingLogKeys = new Set(live(existing.logs).concat((existing.logs || []).filter(l => l.deleted)).map(l => l.importKey || logFingerprint(l)));
  const existingIds = new Set((existing.logs || []).map(l => l.id).concat((existing.papers || []).map(p => p.id)));
  const existingPaperKeys = new Set((existing.papers || []).map(p => p.importKey || paperFingerprint(p)));
  const findSheet = (names) => wb.SheetNames.find(n => names.includes(norm(n)));

  // Summary — formulas only; recalculated by the app.
  const sumName = findSheet(['summary']);
  plan.sheets.push({ name: sumName || 'Summary', dest: 'Dashboard (recalculated)', found: !!sumName, note: sumName ? 'Formulas are recalculated from your records; nothing is imported from this sheet.' : 'Sheet not found.' });

  // Lists
  const listName = findSheet(['lists']);
  if (listName) {
    const g = sheetGrid(XLSX, wb.Sheets[listName]);
    const head = g.rows[0] ? g.rows[0].cells.map(c => norm(c && c.v)) : [];
    const col = (name) => head.indexOf(name);
    const take = (ci) => ci < 0 ? [] : g.rows.slice(1).map(r => str(cellVal(r.cells[ci]))).filter(Boolean);
    plan.lists = { focusAreas: take(col('focus area')), taskTypes: take(col('task type')), statuses: take(col('status')) };
    plan.sheets.push({ name: listName, dest: 'Settings → categories', found: true, note: plan.lists.focusAreas.length + ' focus areas, ' + plan.lists.taskTypes.length + ' task types, ' + plan.lists.statuses.length + ' statuses (merged with current lists; nothing removed).' });
  } else plan.sheets.push({ name: 'Lists', dest: 'Settings → categories', found: false, note: 'Sheet not found.' });

  // Daily log
  const logName = findSheet(['daily log']);
  const logSheet = { name: logName || 'Daily Log', dest: 'Daily Log', found: !!logName, rows: [], empty: 0 };
  plan.sheets.push(logSheet);
  if (logName) {
    const g = sheetGrid(XLSX, wb.Sheets[logName]);
    const h = findHeader(g, LOG_COLS, ['date', 'hours']);
    if (!h) { logSheet.note = 'Header row (Date … Hours …) not found.'; plan.messages.push({ level: 'error', text: 'Daily Log: header row not found' }); }
    else {
      const occ = {};
      for (let i = h.index + 1; i < g.rows.length; i++) {
        const { R, cells } = g.rows[i];
        const vals = {}; let hasReal = false;
        for (const [k, ci] of Object.entries(h.cols)) {
          const c = cells[ci]; const v = cellVal(c);
          if (k === '_day') continue; // recalculated from date
          if (v !== null && !c.f) hasReal = true;
          vals[k] = v;
        }
        if (!hasReal) { logSheet.empty++; continue; }
        const msgs = [];
        const d = parseDateValue(vals.date);
        if (d.warn) msgs.push({ level: d.value ? 'info' : 'error', text: d.warn });
        if (!d.value) msgs.push({ level: 'error', text: 'Missing or unreadable date — row not imported' });
        const rec = {
          date: d.value, focus: str(vals.focus), taskType: str(vals.taskType), what: str(vals.what),
          hours: numOrNull(vals.hours, msgs, 'Hours'), status: str(vals.status), output: str(vals.output),
          papersRead: numOrNull(vals.papersRead, msgs, 'Papers Read'), blockers: str(vals.blockers), nextStep: str(vals.nextStep),
          productivity: numOrNull(vals.productivity, msgs, 'Productivity'), links: {}
        };
        if (rec.hours === null) msgs.push({ level: 'info', text: 'Hours blank — kept as missing (not counted as 0)' });
        else if (rec.hours < 0 || rec.hours > 24) msgs.push({ level: 'warn', text: 'Hours ' + rec.hours + ' is outside 0–24' });
        if (rec.papersRead === null) msgs.push({ level: 'info', text: 'Papers Read blank — kept as not recorded' });
        if (rec.productivity !== null && (rec.productivity < 1 || rec.productivity > 5)) { msgs.push({ level: 'warn', text: 'Productivity ' + rec.productivity + ' outside 1–5 — kept as missing' }); rec.productivity = null; }
        if (!rec.what) msgs.push({ level: 'warn', text: '"What I Worked On" is blank' });
        let key = logFingerprint(rec);
        occ[key] = (occ[key] || 0) + 1; if (occ[key] > 1) { key += '#' + occ[key]; msgs.push({ level: 'warn', text: 'Identical to an earlier row in this file — imported as a separate session' }); }
        rec.importKey = key;
        rec.source = { file: fileName || '', sheet: logName, row: R + 1 };
        const fileId = str(vals._id);
        let status = 'new';
        if (!d.value) status = 'error';
        else if (existingLogKeys.has(key) || (fileId && existingIds.has(fileId))) status = 'duplicate';
        logSheet.rows.push({ row: R + 1, rec, status, msgs });
      }
      logSheet.note = logSheet.rows.length + ' rows with data, ' + logSheet.empty + ' empty template rows skipped.';
    }
  }
  // Reading log
  const rdName = findSheet(['reading log']);
  const rdSheet = { name: rdName || 'Reading Log', dest: 'Literature', found: !!rdName, rows: [], empty: 0 };
  plan.sheets.push(rdSheet);
  if (rdName) {
    const g = sheetGrid(XLSX, wb.Sheets[rdName]);
    const h = findHeader(g, READ_COLS, ['title']);
    if (!h) { rdSheet.note = 'Header row not found.'; }
    else {
      for (let i = h.index + 1; i < g.rows.length; i++) {
        const { R, cells } = g.rows[i]; const vals = {}; let hasReal = false;
        for (const [k, ci] of Object.entries(h.cols)) { const c = cells[ci]; const v = cellVal(c); if (v !== null && !c.f) hasReal = true; vals[k] = v; }
        if (!hasReal) { rdSheet.empty++; continue; }
        const msgs = []; const d = parseDateValue(vals.dateRead); if (d.warn) msgs.push({ level: 'warn', text: d.warn });
        const cite = str(vals.cite).toUpperCase();
        const rec = { dateRead: d.value, title: str(vals.title), authors: str(vals.authors), venueYear: str(vals.venueYear), objective: str(vals.objective), keyIdea: str(vals.keyIdea), methodDataset: str(vals.methodDataset), limitation: str(vals.limitation), useInWork: str(vals.useInWork), cite: cite.startsWith('Y') ? 'Y' : cite.startsWith('N') ? 'N' : '', readingStatus: str(vals.readingStatus), doi: str(vals.doi), url: str(vals.url), keywords: str(vals.keywords) ? str(vals.keywords).split(/[;,]/).map(s => s.trim()).filter(Boolean) : [], pdf: '', researchQuestion: '', findings: '', notes: '' };
        if (!rec.readingStatus) msgs.push({ level: 'info', text: 'Reading status not in workbook — left unset (not counted as fully read)' });
        let status = 'new';
        if (!rec.title) { status = 'error'; msgs.push({ level: 'error', text: 'Title is blank — row not imported' }); }
        rec.importKey = paperFingerprint(rec); rec.source = { file: fileName || '', sheet: rdName, row: R + 1 };
        if (status === 'new' && (existingPaperKeys.has(rec.importKey) || (str(vals._id) && existingIds.has(str(vals._id))))) status = 'duplicate';
        existingPaperKeys.add(rec.importKey);
        rdSheet.rows.push({ row: R + 1, rec, status, msgs });
      }
      rdSheet.note = rdSheet.rows.length + ' rows with data, ' + rdSheet.empty + ' empty template rows skipped.';
    }
  }
  for (const s of [logSheet, rdSheet]) for (const r of s.rows || []) plan.totals[r.status]++;
  plan.totals.empty = logSheet.empty + rdSheet.empty;
  plan.logs = logSheet.rows; plan.papers = rdSheet.rows;
  return plan;
}

/* ---------- citations ---------- */
function yearOf(p) { const m = String(p.venueYear || '').match(/\b(19|20)\d{2}\b/); return m ? m[0] : ''; }
function venueOf(p) { return String(p.venueYear || '').replace(/[,(]?\s*\b(19|20)\d{2}\b\)?/, '').trim().replace(/[,;]$/, ''); }
function authorList(p) { const a = String(p.authors || '').trim(); if (!a) return []; return (a.includes(';') ? a.split(';') : a.split(/\s+and\s+|,\s*(?=[A-Z][a-z]+\s)/)).map(s => s.trim()).filter(Boolean); }
function bibType(p) {
  const v = venueOf(p);
  if (/journal|trans\.|transactions|tits|tpami|tnnls|letters|ral\b|ijcv/i.test(v)) return 'article';
  if (/conf|proc|cvpr|iccv|eccv|neurips|nips|iclr|icml|iros|icra|workshop|aaai|wacv|bmvc|itsc|ivs/i.test(v)) return 'inproceedings';
  return 'misc';
}
function citeKey(p) { const a = authorList(p)[0] || 'anon'; const last = a.includes(',') ? a.split(',')[0] : a.split(' ').slice(-1)[0]; const w = normTitle(p.title).split(' ').find(x => x.length > 3) || 'paper'; return (last.replace(/[^A-Za-z]/g, '') + (yearOf(p) || 'nd') + w).toLowerCase(); }
function toBibTeX(papers) {
  const used = {}; const out = [];
  for (const p of papers) {
    let k = citeKey(p); used[k] = (used[k] || 0) + 1; if (used[k] > 1) k += String.fromCharCode(96 + used[k]);
    const t = bibType(p); const f = [];
    const esc = s => String(s).replace(/[{}]/g, '');
    f.push('  title = {{' + esc(p.title) + '}}');
    const al = authorList(p); if (al.length) f.push('  author = {' + esc(al.join(' and ')) + '}');
    const v = venueOf(p); if (v) f.push('  ' + (t === 'article' ? 'journal' : t === 'inproceedings' ? 'booktitle' : 'howpublished') + ' = {' + esc(v) + '}');
    const y = yearOf(p); if (y) f.push('  year = {' + y + '}');
    if (p.doi) f.push('  doi = {' + esc(p.doi) + '}');
    if (p.url) f.push('  url = {' + esc(p.url) + '}');
    if (p.keywords && p.keywords.length) f.push('  keywords = {' + esc(p.keywords.join(', ')) + '}');
    const missing = [!al.length && 'author', !y && 'year', !v && 'venue'].filter(Boolean);
    out.push((missing.length ? '% Missing in tracker: ' + missing.join(', ') + '\n' : '') + '@' + t + '{' + k + ',\n' + f.join(',\n') + '\n}');
  }
  return out.join('\n\n') + '\n';
}
function toRIS(papers) {
  return papers.map(p => {
    const t = bibType(p); const L = ['TY  - ' + (t === 'article' ? 'JOUR' : t === 'inproceedings' ? 'CONF' : 'GEN'), 'TI  - ' + p.title];
    authorList(p).forEach(a => L.push('AU  - ' + a));
    const v = venueOf(p); if (v) L.push((t === 'article' ? 'JO' : 'T2') + '  - ' + v);
    const y = yearOf(p); if (y) L.push('PY  - ' + y);
    if (p.doi) L.push('DO  - ' + p.doi); if (p.url) L.push('UR  - ' + p.url);
    (p.keywords || []).forEach(k => L.push('KW  - ' + k));
    L.push('ER  - '); return L.join('\r\n');
  }).join('\r\n\r\n') + '\r\n';
}

/* ---------- CSV ---------- */
function toCSV(rows, cols) {
  const esc = v => { if (v === null || v === undefined) return ''; const s = Array.isArray(v) ? v.join('; ') : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [cols.map(c => esc(c.label)).join(',')].concat(rows.map(r => cols.map(c => esc(c.get ? c.get(r) : r[c.key])).join(','))).join('\r\n') + '\r\n';
}

/* ---------- period helpers ---------- */
function periodFor(kind, ref) {
  ref = ref || todayISO();
  if (kind === 'weekly') { const s = weekStart(ref); return { from: s, to: addDays(s, 6), label: 'Week of ' + fmtDate(s) }; }
  if (kind === 'monthly') return { from: monthStart(ref), to: monthEnd(ref), label: monthLabel(ref) };
  if (kind === 'half-yearly') { const y = ref.slice(0, 4); const h1 = ref.slice(5, 7) <= '06'; return h1 ? { from: y + '-01-01', to: y + '-06-30', label: 'January–June ' + y } : { from: y + '-07-01', to: y + '-12-31', label: 'July–December ' + y }; }
  return { from: ref, to: ref, label: fmtDate(ref) };
}

/* ---------- report generation (every line carries refs to saved records) ---------- */
function generateReport(state, opt) {
  const { from, to } = opt; const S = state.settings;
  const logs = filterLogs(state, { from, to }).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const sum = summarizeLogs(state, logs);
  const ref = (col, r, label) => ({ col, id: r.id, label });
  const L = (r) => ref('logs', r, 'Log ' + fmtDate(r.date));
  const sections = [];
  const sec = (key, heading) => { const s = { key, heading, items: [], missing: [] }; sections.push(s); return s; };

  const e = sec('effort', 'Effort summary');
  if (logs.length) {
    e.items.push({ text: sum.totalHours + ' h logged across ' + sum.sessions + ' session(s) on ' + sum.days + ' working day(s); average ' + (sum.avgPerDay ?? '—') + ' h per working day.', refs: logs.map(L) });
    e.items.push({ text: 'Research ' + round2(sum.byKind.research) + ' h · Teaching ' + round2(sum.byKind.teaching) + ' h · Administration ' + round2(sum.byKind.admin) + ' h · Other ' + round2(sum.byKind.other) + ' h.', refs: [] });
    if (sum.prodN) e.items.push({ text: 'Average self-reported productivity: ' + sum.prodAvg + ' / 5 (' + sum.prodN + ' rated sessions).', refs: [] });
    if (sum.missingHours) e.missing.push(sum.missingHours + ' session(s) have no hours recorded and are excluded from totals.');
  } else e.missing.push('No work sessions logged in this period.');

  const w = sec('work', 'Work completed and tangible outputs');
  logs.filter(l => l.output).forEach(l => w.items.push({ text: fmtDate(l.date) + ' — ' + l.output + (l.what ? ' (' + l.what + ')' : ''), refs: [L(l)] }));
  live(state.tasks).filter(t => isDone(t.status) && inRange(t.completedDate, from, to)).forEach(t => w.items.push({ text: 'Task completed: ' + t.title + ' (' + fmtDate(t.completedDate) + ')', refs: [ref('tasks', t, 'Task')] }));
  live(state.milestones).filter(m => isDone(m.status) && inRange(m.completedDate, from, to)).forEach(m => w.items.push({ text: 'Milestone reached: ' + m.title + ' (' + fmtDate(m.completedDate) + ')', refs: [ref('milestones', m, 'Milestone')] }));
  if (!w.items.length) w.missing.push('No outputs, completed tasks or milestones recorded in this period.');
  const noOut = logs.filter(l => !l.output).length; if (noOut) w.missing.push(noOut + ' session(s) have no output/deliverable recorded.');

  const o = sec('objectives', 'Progress by research objective');
  live(state.objectives).sort((a, b) => (a.code || '').localeCompare(b.code || '')).forEach(ob => {
    const p = objectiveProgress(state, ob.id);
    const ol = logs.filter(l => logObjective(state, l) === ob.id);
    const h = round2(ol.reduce((s, l) => s + (isNum(l.hours) ? l.hours : 0), 0));
    o.items.push({ text: ob.code + ' — ' + (p.pct === null ? 'milestone progress unavailable (no milestones defined)' : p.done + ' of ' + p.total + ' milestones complete (' + p.pct + '%)') + '; ' + h + ' h logged this period.', refs: [ref('objectives', ob, ob.code)].concat(ol.map(L)) });
  });
  const pp = programmeProgress(state); o.items.push({ text: 'Programme milestones overall: ' + (pp.pct === null ? 'none defined' : pp.done + ' of ' + pp.total + ' complete (' + pp.pct + '%).'), refs: [] });

  const lit = sec('literature', 'Papers read and key learning');
  const read = papersFullyRead(state, from, to);
  read.forEach(p => lit.items.push({ text: p.title + (p.keyIdea ? ' — ' + p.keyIdea : ''), refs: [ref('papers', p, 'Paper')] }));
  if (!read.length) lit.missing.push('No papers marked "Read" with a read date in this period.');
  if (sum.papersReadN) lit.items.push({ text: 'Daily log "Papers Read" field (legacy count, may overlap the library): ' + sum.papersReadSum + ' across ' + sum.papersReadN + ' session(s).', refs: logs.filter(l => isNum(l.papersRead)).map(L) });
  if (sum.papersReadMissing && logs.length) lit.missing.push('"Papers Read" not recorded in ' + sum.papersReadMissing + ' session(s).');
  const noKey = read.filter(p => !p.keyIdea).length; if (noKey) lit.missing.push(noKey + ' read paper(s) have no key idea noted.');

  const ex = sec('experiments', 'Experiments and recorded findings');
  const exps = live(state.experiments).filter(x => inRange(x.startDate, from, to) || inRange(x.endDate, from, to));
  exps.forEach(x => {
    const met = (x.metrics || []).filter(m => m.name).map(m => m.name + ' = ' + (isNum(m.value) ? m.value : 'not recorded') + (m.unit ? ' ' + m.unit : '')).join('; ');
    ex.items.push({ text: (x.expId ? x.expId + ' ' : '') + (x.title || 'Untitled') + ' [' + (x.status || 'no status') + ']' + (met ? ': ' + met : '') + (x.observations ? '. Observations: ' + x.observations : '') + (x.failures ? '. Failures / negative findings: ' + x.failures : ''), refs: [ref('experiments', x, x.expId || 'Experiment')] });
    if (!(x.metrics || []).length && x.status === 'Completed') ex.missing.push((x.expId || x.title) + ': completed but no metrics recorded.');
  });
  if (!exps.length) ex.missing.push('No experiment runs dated in this period.');

  const wr = sec('writing', 'Manuscript and thesis progress');
  live(state.manuscripts).forEach(m => {
    const secs = m.sections || []; const d = secs.filter(s => s.done).length;
    const subs = (m.submissions || []).filter(s => inRange(s.date, from, to));
    wr.items.push({ text: (m.kind || 'Manuscript') + ': ' + m.title + ' — stage ' + (m.stage || 'not set') + (secs.length ? '; sections ' + d + '/' + secs.length + ' done' : '') + (m.venue ? '; target ' + m.venue : '') + (subs.length ? '; submissions this period: ' + subs.map(s => fmtDate(s.date) + (s.status ? ' (' + s.status + ')' : '')).join(', ') : ''), refs: [ref('manuscripts', m, 'Manuscript')] });
  });
  if (!live(state.manuscripts).length) wr.missing.push('No manuscripts or thesis chapters recorded.');

  const b = sec('blockers', 'Blockers and supervisor feedback');
  logs.filter(l => l.blockers).forEach(l => b.items.push({ text: 'Blocker (' + fmtDate(l.date) + '): ' + l.blockers, refs: [L(l)] }));
  live(state.tasks).filter(t => t.status === 'Blocked').forEach(t => b.items.push({ text: 'Blocked task: ' + t.title + (t.blocker ? ' — ' + t.blocker : ''), refs: [ref('tasks', t, 'Task')] }));
  const meets = live(state.meetings).filter(m => inRange(m.date, from, to));
  meets.forEach(m => { if (m.feedback) b.items.push({ text: 'Feedback (' + fmtDate(m.date) + '): ' + m.feedback, refs: [ref('meetings', m, 'Meeting')] }); if (m.decisions) b.items.push({ text: 'Decisions (' + fmtDate(m.date) + '): ' + m.decisions, refs: [ref('meetings', m, 'Meeting')] }); });
  if (!meets.length) b.missing.push('No supervisor meetings recorded in this period.');

  const n = sec('next', 'Plans for the next period');
  const nextTo = addDays(to, Math.max(7, diffDays(from, to) + 1));
  live(state.tasks).filter(t => !isDone(t.status) && (!t.dueDate || t.dueDate <= nextTo)).sort((a, c) => (a.dueDate || '9999').localeCompare(c.dueDate || '9999')).slice(0, 12)
    .forEach(t => n.items.push({ text: t.title + (t.dueDate ? ' (due ' + fmtDate(t.dueDate) + ')' : ' (no due date)') + (t.nextAction ? ' — next: ' + t.nextAction : ''), refs: [ref('tasks', t, 'Task')] }));
  live(state.milestones).filter(m => !isDone(m.status) && m.targetDate && m.targetDate > to && m.targetDate <= nextTo).forEach(m => n.items.push({ text: 'Milestone due ' + fmtDate(m.targetDate) + ': ' + m.title, refs: [ref('milestones', m, 'Milestone')] }));
  const lastLog = logs.filter(l => l.nextStep).slice(-3);
  lastLog.forEach(l => n.items.push({ text: 'Next step noted ' + fmtDate(l.date) + ': ' + l.nextStep, refs: [L(l)] }));
  if (!n.items.length) n.missing.push('No open tasks, upcoming milestones or next steps recorded.');
  return { kind: opt.kind, from, to, label: opt.label, generatedAt: nowStamp(), sections };
}

const api = { TZ, MONTHS, todayISO, isISO, parseISO, toISO, addDays, diffDays, fmtDate, fmtShort, dayName, weekStart, monthStart, monthEnd, monthLabel, excelSerialToISO, parseDateValue, inRange, nowStamp,
  uid, fnv1a, norm, normTitle, logFingerprint, paperFingerprint, DEFAULT_SETTINGS, DEFAULT_OBJECTIVES, defaultMilestones,
  live, focusInfo, focusKind, logObjective, filterLogs, summarizeLogs, taskActualHours, taskCounts, filterTasks, overdueTasks, depsDone, priorityActions, objectiveProgress, programmeProgress, papersFullyRead, weeklySeries, dailyTotals, compatKey, compatGroups,
  planImport, toBibTeX, toRIS, toCSV, periodFor, generateReport, isNum, round2, isDone, yearOf, venueOf };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Core = api;
})(typeof window !== 'undefined' ? window : globalThis);
