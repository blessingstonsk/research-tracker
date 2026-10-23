/* ===== Reports, settings, import/export ===== */
const SECTION_TEMPLATE = { effort: 'Effort summary', work: 'Work completed and tangible outputs', objectives: 'Progress by research objective', literature: 'Papers read and key learning', experiments: 'Experiments and recorded findings', writing: 'Manuscript and thesis progress', blockers: 'Blockers and supervisor feedback', next: 'Plans for the next period' };
function repPeriod() {
  const R = U.rep; const today = C.todayISO();
  if (R.kind === 'custom') return { from: R.from || C.addDays(today, -29), to: R.to || today, label: C.fmtDate(R.from || C.addDays(today, -29)) + ' – ' + C.fmtDate(R.to || today) };
  return C.periodFor(R.kind, R.ref || today);
}
function draftFromGenerated(g) {
  return { id: null, kind: g.kind, from: g.from, to: g.to, label: g.label, generatedAt: g.generatedAt, title: (g.kind === 'custom' ? 'Research progress report' : g.kind[0].toUpperCase() + g.kind.slice(1) + ' research report') + ' — ' + g.label,
    sections: g.sections.map(sc => ({ key: sc.key, heading: sc.heading, text: sc.items.map(i => '• ' + i.text + (i.refs.length ? ' [' + Array.from(new Set(i.refs.slice(0, 3).map(r => r.label))).join('; ') + (i.refs.length > 3 ? '; +' + (i.refs.length - 3) : '') + ']' : '')).join('\n'), missing: sc.missing, refs: dedupeRefs(sc.items.flatMap(i => i.refs)) })) };
}
function dedupeRefs(refs) { const seen = new Set(); return refs.filter(r => { const k = r.col + '/' + r.id; if (seen.has(k)) return false; seen.add(k); return true; }); }
function viewReports() {
  const s = Store.state(); const R = U.rep; const per = repPeriod();
  if (!R.draft || (!R.draft.id && !R.draft.dirty)) R.draft = draftFromGenerated(Object.assign(C.generateReport(s, { kind: R.kind, from: per.from, to: per.to, label: per.label }), { kind: R.kind }));
  const d = R.draft; const saved = C.live(s.reports).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  const ctrl = '<div class="filters card" style="padding:10px 12px"><label class="f"><span>Report type</span>' + selectHTML('r-kind', [['weekly', 'Weekly'], ['monthly', 'Monthly'], ['half-yearly', 'Half-yearly'], ['custom', 'Custom period']], R.kind, null, 'rep:kind') + '</label>' +
    (R.kind === 'custom' ? '<label class="f"><span>From</span><input type="date" id="r-from" value="' + esc(R.from || per.from) + '" data-change="rep:from"></label><label class="f"><span>To</span><input type="date" id="r-to" value="' + esc(R.to || per.to) + '" data-change="rep:to"></label>'
      : '<label class="f"><span>' + (R.kind === 'weekly' ? 'Any day in the week' : R.kind === 'monthly' ? 'Any day in the month' : 'Any day in the half-year') + '</span><input type="date" id="r-ref" value="' + esc(R.ref || C.todayISO()) + '" data-change="rep:ref"></label>') +
    '<div class="row" style="align-self:end"><button class="btn" data-act="rep-regen">Regenerate from records</button><button class="btn primary" data-act="rep-save">Save report</button><button class="btn" data-act="rep-pdf">Export PDF</button><button class="btn" data-act="rep-xlsx">Period data (Excel)</button><button class="btn" data-act="rep-csv">Period sessions (CSV)</button></div></div>';
  const missingAll = d.sections.flatMap(x => x.missing.map(m => [x.heading, m]));
  const secs = d.sections.map((x, i) => '<section class="card report-sec"><header style="margin-bottom:4px"><h3>' + esc(x.heading) + '</h3><span class="small muted">' + x.refs.length + ' source record(s)</span></header>' +
    '<textarea id="rs-' + i + '" data-input="rep-text:' + i + '" aria-label="' + esc(x.heading) + '">' + esc(x.text) + '</textarea>' +
    (x.missing.length ? '<div class="small" style="color:var(--warn)">Missing: ' + x.missing.map(esc).join(' · ') + '</div>' : '') +
    (x.refs.length ? '<div class="refs">' + x.refs.slice(0, 24).map(r => '<a href="#" class="chip" data-act="edit" data-col="' + r.col + '" data-id="' + r.id + '">' + esc(r.label) + '</a>').join('') + (x.refs.length > 24 ? '<span class="small muted">+' + (x.refs.length - 24) + '</span>' : '') + '</div>' : '') + '</section>').join('');
  return '<div class="page-head"><div><h1>Reports</h1><p>Drafts are generated from saved records. Each line cites its source in [brackets]; edit freely, then save or export. Missing information is listed under each section.</p></div></div>' + ctrl +
    '<div class="grid g-side" style="align-items:start"><div class="grid" style="gap:12px"><label class="f"><span>Report title</span><input id="r-title" value="' + esc(d.title) + '" data-input="rep-title"></label>' +
    '<div class="small muted">Period ' + C.fmtDate(d.from) + ' – ' + C.fmtDate(d.to) + ' · generated ' + new Date(d.generatedAt).toLocaleString('en-GB', { timeZone: C.TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + (d.id ? ' · saved report' : ' · unsaved draft') + '</div>' + secs + '</div>' +
    '<aside class="grid" style="gap:12px"><section class="card"><header><h2>Missing information</h2></header>' + (missingAll.length ? '<ul class="msgs">' + missingAll.map(([h, m]) => '<li><b>' + esc(h) + ':</b> ' + esc(m) + '</li>').join('') + '</ul>' : '<p class="small muted">Nothing flagged.</p>') + '</section>' +
    '<section class="card"><header><h2>Saved reports</h2></header>' + (saved.length ? '<div class="list">' + saved.map(r => '<div class="li"><div class="row between"><a href="#" class="t" data-act="rep-open" data-id="' + r.id + '">' + esc(r.title) + '</a><button class="btn sm ghost danger" data-act="del" data-col="reports" data-id="' + r.id + '">Delete</button></div><div class="m">' + C.fmtDate(r.from) + ' – ' + C.fmtDate(r.to) + ' · ' + esc(r.kind) + '</div></div>').join('') + '</div>' : '<p class="small muted">None yet.</p>') + '</section></aside></div>';
}
function saveReport() {
  const d = U.rep.draft; const rec = JSON.parse(JSON.stringify(d)); if (!rec.id) delete rec.id;
  Store.put('reports', rec); d.id = rec.id; toast('Report saved'); render();
}
function exportReportPDF() {
  const d = U.rep.draft; if (!window.jspdf) { toast('PDF library did not load; check your connection and reload.', true); return; }
  const { jsPDF } = window.jspdf; const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 54; let y = M;
  const clean = t => String(t || '').replace(/[–—]/g, '-').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/•/g, '-').replace(/[→]/g, '->').replace(/[^\x09\x0A\x0D\x20-\x7E\xA0-\xFF]/g, '');
  const line = (txt, size, style, gap, color) => { doc.setFont('helvetica', style || 'normal'); doc.setFontSize(size); doc.setTextColor(color || 20, color || 34, color || 48);
    const parts = doc.splitTextToSize(clean(txt), W - 2 * M); for (const p of parts) { if (y > H - M - 20) { doc.addPage(); y = M; } doc.text(p, M, y); y += size * 1.35; } y += gap || 0; };
  line(d.title, 16, 'bold', 4); line('Period: ' + C.fmtDate(d.from) + ' to ' + C.fmtDate(d.to) + '   |   Prepared ' + C.fmtDate(C.todayISO()) + ' (Asia/Kolkata)', 9, 'normal', 12, 90);
  d.sections.forEach(sc => { line(sc.heading, 12, 'bold', 2); (sc.text || '').split('\n').forEach(t => { if (t.trim()) line(t, 10, 'normal', 2); }); if (sc.missing.length) line('Missing information: ' + sc.missing.join(' '), 9, 'italic', 2, 120); y += 8; });
  line('Source records', 12, 'bold', 2);
  const all = dedupeRefs(d.sections.flatMap(x => x.refs)); all.forEach(r => { const rec = Store.get(r.col, r.id); line(r.label + ': ' + (rec ? (rec.what || rec.title || rec.output || rec.code || '') : '(record no longer exists)'), 8.5, 'normal', 0, 80); });
  const n = doc.getNumberOfPages(); for (let i = 1; i <= n; i++) { doc.setPage(i); doc.setFontSize(8); doc.setTextColor(120); doc.text('Generated from Research Tracker records - page ' + i + ' of ' + n, M, H - 28); }
  saveFile(slug(d.title) + '.pdf', doc.output('arraybuffer'));
}
function slug(s) { return String(s || 'export').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 80) || 'export'; }

/* ---------- downloads ---------- */
let DL = null;
async function saveFile(filename, data) {
  window.__lastDownload = { filename, data };
  try { if (!DL && window.claude && window.claude.use) DL = await window.claude.use('downloads'); } catch (e) { DL = null; }
  if (!DL && Store.mode === 'gas') { // plain browser download in the web app
    try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([data])); a.download = filename; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); toast('Saved ' + filename); return true; } catch (e) {}
  }
  if (!DL) { const text = typeof data === 'string' ? data : null; showModal('Download unavailable here', '<p>Saving files is not available in this view.' + (text ? ' You can copy the content instead:' : ' Open the tracker in the Claude app or claude.ai to download.') + '</p>' + (text ? '<textarea id="dl-text" style="min-height:260px;font-family:var(--f-mono);font-size:12px" readonly>' + esc(text) + '</textarea>' : ''), text ? '<button class="btn primary" data-act="copy-dl">Copy</button>' : ''); return false; }
  try { await DL.save({ filename, data }); toast('Saved ' + filename); return true; }
  catch (e) { if (e && e.code === 'declined') toast('Download cancelled'); else toast('Could not save file (' + ((e && e.code) || 'error') + ')', true); return false; }
}
function xlsxBuffer(sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(sh => { const ws = XLSX.utils.aoa_to_sheet([sh.cols.map(c => c.label)].concat(sh.rows.map(r => sh.cols.map(c => { const v = c.get ? c.get(r) : r[c.key]; return Array.isArray(v) ? v.join('; ') : v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : v; })))); ws['!cols'] = sh.cols.map(c => ({ wch: c.w || 16 })); XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31)); });
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}
const LOG_EXPORT = [{ label: 'Date', get: r => r.date ? C.fmtDate(r.date) : '', w: 12 }, { label: 'Day', get: r => C.dayName(r.date), w: 6 }, { label: 'Focus Area', key: 'focus', w: 28 }, { label: 'Task Type', key: 'taskType', w: 18 }, { label: 'What I Worked On', key: 'what', w: 48 }, { label: 'Hours', key: 'hours', w: 7 }, { label: 'Status', key: 'status', w: 11 }, { label: 'Output / Deliverable', key: 'output', w: 24 }, { label: 'Papers Read', key: 'papersRead', w: 8 }, { label: 'Blockers / Issues', key: 'blockers', w: 28 }, { label: 'Next Step', key: 'nextStep', w: 28 }, { label: 'Productivity (1–5)', key: 'productivity', w: 10 }, { label: 'ID', key: 'id', w: 24 }];
const PAPER_EXPORT = [{ label: 'Date Read', get: r => r.dateRead ? C.fmtDate(r.dateRead) : '' }, { label: 'Title', key: 'title', w: 50 }, { label: 'Authors', key: 'authors', w: 30 }, { label: 'Venue / Year', key: 'venueYear' }, { label: 'Relevant Objective', key: 'objective' }, { label: 'Key Idea', key: 'keyIdea', w: 40 }, { label: 'Method / Dataset', key: 'methodDataset', w: 30 }, { label: 'Limitation / Gap', key: 'limitation', w: 30 }, { label: 'Use in My Work', key: 'useInWork', w: 30 }, { label: 'Cite? (Y/N)', key: 'cite' }, { label: 'Reading Status', key: 'readingStatus' }, { label: 'DOI', key: 'doi' }, { label: 'URL', key: 'url' }, { label: 'Keywords', key: 'keywords' }, { label: 'ID', key: 'id', w: 24 }];
function genericCols(rows) { const keys = new Set(); rows.forEach(r => Object.keys(r).forEach(k => { if (!['deleted', 'deletedAt'].includes(k)) keys.add(k); })); return Array.from(keys).map(k => ({ label: k, key: k })); }
function exportWorkbook(from, to, name) {
  const s = Store.state(); const inR = d => (!from && !to) || C.inRange(d, from, to);
  const logs = C.live(s.logs).filter(l => inR(l.date)).sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const sheets = [{ name: 'Daily Log', cols: LOG_EXPORT, rows: logs }, { name: 'Reading Log', cols: PAPER_EXPORT, rows: C.live(s.papers).filter(p => (!from && !to) || inR(p.dateRead)) }];
  if (!from && !to) ['tasks', 'objectives', 'milestones', 'gaps', 'experiments', 'datasets', 'manuscripts', 'meetings'].forEach(c => { const rows = C.live(s[c]); sheets.push({ name: c[0].toUpperCase() + c.slice(1), cols: rows.length ? genericCols(rows) : [{ label: 'id', key: 'id' }], rows }); });
  else { sheets.push({ name: 'Tasks completed', cols: genericCols(C.live(s.tasks)).length ? genericCols(C.live(s.tasks)) : [{ label: 'id', key: 'id' }], rows: C.live(s.tasks).filter(t => C.inRange(t.completedDate, from, to)) }); sheets.push({ name: 'Experiments', cols: genericCols(C.live(s.experiments)).length ? genericCols(C.live(s.experiments)) : [{ label: 'id', key: 'id' }], rows: C.live(s.experiments).filter(e => C.inRange(e.startDate, from, to) || C.inRange(e.endDate, from, to)) }); }
  saveFile(name, xlsxBuffer(sheets));
}

/* ---------- import ---------- */
let IMPORT_PLAN = null;
async function handleWorkbookFile(file) {
  if (!window.XLSX) { toast('Spreadsheet library did not load; reload and try again.', true); return; }
  try { const buf = await file.arrayBuffer(); const wb = XLSX.read(buf, { type: 'array', cellFormula: true, cellDates: false }); IMPORT_PLAN = C.planImport(XLSX, wb, Store.state(), file.name); U.set.tab = 'import'; render(); }
  catch (e) { IMPORT_PLAN = { error: 'Could not read “' + file.name + '”: ' + (e.message || e) }; render(); }
}
async function commitImport() {
  const P = IMPORT_PLAN; if (!P || P.error) return; const s = Store.state();
  await autoBackup('Before import of ' + P.fileName);
  const logs = P.logs.filter(r => r.status === 'new').map(r => Object.assign({}, r.rec, { id: C.uid('log') }));
  const papers = P.papers.filter(r => r.status === 'new').map(r => Object.assign({}, r.rec, { id: C.uid('pap') }));
  if (P.lists) { const st = JSON.parse(JSON.stringify(s.settings)); let ch = false;
    P.lists.focusAreas.forEach(n => { if (!st.focusAreas.some(f => f.name === n)) { st.focusAreas.push({ name: n, kind: /teach|course/i.test(n) ? 'teaching' : /admin|meeting/i.test(n) ? 'admin' : n === 'Other' ? 'other' : 'research', objectiveId: '' }); ch = true; } });
    ['taskTypes', 'statuses'].forEach(k => P.lists[k].forEach(n => { if (!st[k].includes(n)) { st[k].push(n); ch = true; } }));
    logs.forEach(l => { if (l.focus && !st.focusAreas.some(f => f.name === l.focus)) { st.focusAreas.push({ name: l.focus, kind: 'other', objectiveId: '' }); ch = true; } if (l.taskType && !st.taskTypes.includes(l.taskType)) { st.taskTypes.push(l.taskType); ch = true; } if (l.status && !st.statuses.includes(l.status)) { st.statuses.push(l.status); ch = true; } });
    if (ch) Store.put('settings', st, { silent: true }); }
  if (logs.length) await Store.putMany('logs', logs);
  if (papers.length) await Store.putMany('papers', papers);
  toast('Imported ' + logs.length + ' session(s) and ' + papers.length + ' paper(s). ' + (P.totals.duplicate ? P.totals.duplicate + ' duplicate(s) skipped.' : ''));
  IMPORT_PLAN = { fileName: P.fileName, done: { logs: logs.length, papers: papers.length, dup: P.totals.duplicate } };
  render();
}
function importPreviewHTML() {
  const P = IMPORT_PLAN; if (!P) return '';
  if (P.error) return '<div class="note bad">' + esc(P.error) + '</div>';
  if (P.done) return '<div class="note">Import complete: ' + P.done.logs + ' session(s) and ' + P.done.papers + ' paper(s) added' + (P.done.dup ? '; ' + P.done.dup + ' duplicate(s) skipped' : '') + '. A backup point was created first.</div>';
  const rowTbl = rows => rows.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Row</th><th>Result</th><th>Record</th><th>Messages</th></tr></thead><tbody>' + rows.map(r => '<tr><td class="mono">' + r.row + '</td><td>' + (r.status === 'new' ? '<span class="pill ok">New</span>' : r.status === 'duplicate' ? '<span class="pill warn">Duplicate — skip</span>' : '<span class="pill bad">Error — skip</span>') + '</td><td class="small wrap">' + (r.rec.date ? C.fmtDate(r.rec.date) + ' · ' + esc(r.rec.focus) + ' · ' + esc(r.rec.what) + ' · ' + (C.isNum(r.rec.hours) ? r.rec.hours + ' h' : 'no hours') : esc(r.rec.title || '')) + '</td><td><ul class="msgs">' + r.msgs.map(m => '<li class="' + m.level + '">' + esc(m.text) + '</li>').join('') + '</ul></td></tr>').join('') + '</tbody></table></div>' : '';
  const newLogs = P.logs.filter(r => r.status === 'new'); const hrs = C.round2(newLogs.reduce((a, r) => a + (C.isNum(r.rec.hours) ? r.rec.hours : 0), 0)); const days = new Set(newLogs.map(r => r.rec.date)).size;
  return '<section class="card"><header><h2>Import preview · ' + esc(P.fileName) + '</h2><span class="small muted">Nothing is saved until you confirm</span></header>' +
    '<div class="tbl-wrap" style="margin-bottom:12px"><table class="tbl"><thead><tr><th>Excel sheet</th><th>Destination</th><th>Result</th></tr></thead><tbody>' + P.sheets.map(sh => '<tr><td><b>' + esc(sh.name) + '</b>' + (sh.found ? '' : ' <span class="pill warn nodot">missing</span>') + '</td><td>' + esc(sh.dest) + '</td><td class="small">' + esc(sh.note || '') + '</td></tr>').join('') + '</tbody></table></div>' +
    '<div class="note">' + P.totals.new + ' new record(s) · ' + P.totals.duplicate + ' duplicate(s) · ' + P.totals.error + ' error(s) · ' + P.totals.empty + ' empty template row(s) ignored.' + (newLogs.length ? ' New sessions total <b>' + hrs + ' h</b> on <b>' + days + '</b> date(s).' : '') + '</div>' +
    (P.logs.length ? '<h3 style="margin:12px 0 6px">Daily Log rows</h3>' + rowTbl(P.logs) : '') + (P.papers.length ? '<h3 style="margin:12px 0 6px">Reading Log rows</h3>' + rowTbl(P.papers) : '<p class="small muted">Reading Log: no paper rows found.</p>') +
    '<div class="row" style="margin-top:12px"><button class="btn primary" data-act="import-commit"' + (P.totals.new ? '' : ' disabled') + '>Import ' + P.totals.new + ' record(s)</button><button class="btn" data-act="import-cancel">Cancel</button></div></section>';
}

/* ---------- backups ---------- */
async function autoBackup(label) {
  if (Store.mode === 'gas') return false; // a backup would not fit in one sheet cell; Google Sheets keeps version history
  const json = JSON.stringify(Store.exportAll(false));
  if (json.length > 240000) return false;
  const rec = { label, createdAt: C.nowStamp(), size: json.length, json };
  await Store.put('backups', rec, { silent: true });
  const all = Array.from(Store.maps.backups.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  for (const old of all.slice(8)) Store.hardDelete('backups', old.id);
  return true;
}
let RESTORE = null;
async function handleRestoreFile(file) {
  try { const d = JSON.parse(await file.text()); if (d.app !== 'research-tracker' || !d.data) throw new Error('This is not a Research Tracker backup file.'); RESTORE = { name: file.name, d }; }
  catch (e) { RESTORE = { error: e.message }; }
  U.set.tab = 'data'; render();
}
async function doRestore(mode, payload) {
  const d = payload || (RESTORE && RESTORE.d); if (!d) return;
  await autoBackup('Before restore (' + mode + ')');
  for (const col of COLS) { if (col === 'backups') continue; const incoming = d.data[col] || [];
    if (mode === 'replace') { const keep = new Set(incoming.map(r => r.id)); for (const id of Array.from(Store.maps[col].keys())) if (!keep.has(id)) Store.hardDelete(col, id); await Store.putMany(col, incoming.map(r => Object.assign({}, r))); }
    else { const add = incoming.filter(r => { const cur = Store.get(col, r.id); return !cur || (r.updatedAt || '') > (cur.updatedAt || ''); }); if (add.length) await Store.putMany(col, add.map(r => Object.assign({}, r))); } }
  RESTORE = null; toast('Restore complete (' + mode + ')'); render();
}

/* ---------- demo data (clearly flagged; removable) ---------- */
function loadDemo() {
  const t = C.todayISO(); const tag = { demo: true };
  const ds = Object.assign({ id: 'demo-ds1', name: '[Demo] Example driving dataset', version: 'v0', status: 'Preparing', source: 'Demonstration record', location: 'external drive (example)' }, tag);
  Store.put('datasets', ds);
  Store.put('experiments', Object.assign({ id: 'demo-exp1', expId: 'DEMO-001', title: '[Demo] Example baseline run', status: 'Planned', objectiveId: 'obj-O1', datasetId: 'demo-ds1', datasetVersion: 'v0', split: 'example split', evalSetting: 'example', hypothesis: 'Demonstration only — replace with a real hypothesis.', metrics: [] }, tag));
  [['[Demo] Draft a reading list for O1', 'High', C.addDays(t, 3), 'obj-O1', 'Planned'], ['[Demo] Set up evaluation script', 'Medium', C.addDays(t, -2), 'obj-O3', 'In Progress'], ['[Demo] Waiting on dataset access', 'Medium', C.addDays(t, 10), 'obj-O1', 'Blocked']]
    .forEach((x, i) => Store.put('tasks', Object.assign({ id: 'demo-task' + i, title: x[0], priority: x[1], dueDate: x[2], objectiveId: x[3], status: x[4], blocker: x[4] === 'Blocked' ? 'Example blocker' : '' }, tag)));
  Store.put('papers', Object.assign({ id: 'demo-paper1', title: '[Demo] Example paper record — replace with a real paper', readingStatus: 'To Read', keywords: ['demo'] }, tag));
  toast('Demo data loaded (marked [Demo])');
}
function removeDemo() { let n = 0; COLS.forEach(c => Array.from(Store.maps[c].values()).filter(r => r.demo).forEach(r => { Store.hardDelete(c, r.id); n++; })); toast('Removed ' + n + ' demo record(s)'); }

/* ---------- settings view ---------- */
function viewSettings() {
  const s = Store.state(); const T = U.set.tab;
  const tabs = '<div class="tabs" role="tablist">' + [['gsheet', 'Google Sheets'], ['import', 'Import workbook'], ['data', 'Export & backup'], ['lists', 'Categories & targets'], ['trash', 'Trash'], ['demo', 'Demo data'], ['calc', 'How progress is calculated']].map(([k, l]) => '<button role="tab" aria-selected="' + (T === k) + '" data-act="settings-tab" data-tab="' + k + '">' + l + '</button>').join('') + '</div>';
  let body = '';
  if (T === 'import') body = '<section class="card"><header><h2>Import an Excel workbook</h2></header><p class="small prose" style="margin-top:0">Reads the <b>Daily Log</b>, <b>Reading Log</b> and <b>Lists</b> sheets. Empty template rows and formula-only rows are ignored, dates and blanks are preserved, and rows already in the tracker are detected as duplicates — importing the same file twice adds nothing. The <b>Summary</b> sheet is recalculated by the dashboard.</p>' +
    '<label class="btn primary" for="wb-file" style="width:max-content">Choose .xlsx file…</label><input type="file" id="wb-file" accept=".xlsx,.xlsm,.xls" hidden></section>' + importPreviewHTML();
  else if (T === 'data') {
    const bks = Array.from(Store.maps.backups.values()).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    body = '<div class="grid g2"><section class="card"><header><h2>Export</h2></header><div class="grid" style="gap:8px">' +
      '<button class="btn" data-act="export-xlsx">All records as Excel (.xlsx)</button><button class="btn" data-act="export-csv" data-col="logs">Daily log as CSV</button><button class="btn" data-act="export-csv" data-col="papers">Literature as CSV</button><button class="btn" data-act="export-csv" data-col="tasks">Tasks as CSV</button><button class="btn" data-act="export-csv" data-col="experiments">Experiments as CSV</button>' +
      '<button class="btn primary" data-act="export-json">Full backup file (.json)</button><p class="small muted" style="margin:0">The Excel export keeps the original Daily Log and Reading Log columns plus an ID column, so it can be re-imported without duplicates.</p></div></section>' +
      '<section class="card"><header><h2>Restore from a backup file</h2></header><label class="btn" for="restore-file" style="width:max-content">Choose backup .json…</label><input type="file" id="restore-file" accept=".json,application/json" hidden>' +
      (RESTORE ? RESTORE.error ? '<div class="note bad" style="margin-top:10px">' + esc(RESTORE.error) + '</div>' : '<div class="note" style="margin-top:10px">' + esc(RESTORE.name) + ' · exported ' + esc(RESTORE.d.exportedAt || '') + '<br>' + COLS.filter(c => c !== 'backups').map(c => c + ': ' + ((RESTORE.d.data[c] || []).length)).join(' · ') + '</div><div class="row" style="margin-top:8px"><button class="btn primary" data-act="restore" data-mode="merge">Merge (add missing, keep newer)</button><button class="btn danger" data-act="restore" data-mode="replace">Replace all current data</button></div>' : '') +
      '<p class="small muted">A backup point is saved automatically before every import or restore.</p></section></div>' +
      '<section class="card"><header><h2>Backup points</h2><button class="btn sm" data-act="backup-now">Create backup point</button></header>' + (bks.length ? '<div class="list">' + bks.map(b => '<div class="li"><div class="row between"><span class="t">' + esc(b.label || 'Backup') + '</span><span class="acts"><button class="btn sm" data-act="backup-restore" data-id="' + b.id + '">Restore</button><button class="btn sm ghost" data-act="backup-download" data-id="' + b.id + '">Download</button></span></div><div class="m">' + new Date(b.createdAt).toLocaleString('en-GB', { timeZone: C.TZ }) + ' · ' + Math.round((b.size || 0) / 1024) + ' KB</div></div>').join('') + '</div>' : '<p class="small muted">None yet. The latest eight are kept.</p>') + '</section>' +
      '<section class="card"><header><h2>Storage</h2></header><p class="small" style="margin:0">' + (Store.mode === 'db' ? 'Records are kept in this tracker’s private storage, readable and writable only by you as the owner, and they survive reloads and later visits. Download a backup file regularly as an extra copy.' : Store.mode === 'gas' ? 'Records are saved in your Google Sheet (hidden _data tab), so they are the same on every device you sign in with. Google Sheets keeps earlier versions under File → Version history.' : 'Records are kept in this browser only. Clearing site data removes them, so download backup files regularly.') + '</p></section>';
  } else if (T === 'gsheet') body = gsheetSettingsHTML();
  else if (T === 'lists') body = listsEditor(s);
  else if (T === 'trash') {
    const items = []; COLS.forEach(c => Array.from(Store.maps[c].values()).filter(r => r.deleted).forEach(r => items.push({ c, r })));
    items.sort((a, b) => (b.r.deletedAt || '').localeCompare(a.r.deletedAt || ''));
    body = '<section class="card"><header><h2>Trash</h2>' + (items.length ? '<button class="btn sm danger" data-act="trash-empty">Empty trash permanently</button>' : '') + '</header>' + (items.length ? '<div class="list">' + items.map(({ c, r }) => '<div class="li"><div class="row between"><span class="t">' + esc(SCHEMA[c] ? SCHEMA[c].label : c) + ': ' + esc(trunc(r.title || r.what || r.name || r.code || (r.date ? C.fmtDate(r.date) : r.id), 80)) + '</span><span class="acts"><button class="btn sm" data-act="restore-item" data-col="' + c + '" data-id="' + r.id + '">Restore</button><button class="btn sm ghost danger" data-act="purge" data-col="' + c + '" data-id="' + r.id + '">Delete forever</button></span></div><div class="m">Deleted ' + new Date(r.deletedAt).toLocaleString('en-GB', { timeZone: C.TZ }) + '</div></div>').join('') + '</div>' : '<p class="small muted">Trash is empty. Deleted records stay here until you remove them permanently.</p>') + '</section>';
  } else if (T === 'demo') body = '<section class="card"><header><h2>Demonstration data</h2></header><p class="small">Optional example tasks, an experiment, a dataset and a placeholder paper, all titled “[Demo]”, to try the Kanban, calendar and comparison views. They never mix with imported records and can be removed in one step.</p><div class="row"><button class="btn" data-act="demo-load">Load demo data</button><button class="btn danger" data-act="demo-remove">Remove all demo data</button></div></section>';
  else body = calcHelp();
  return '<div class="page-head"><div><h1>Settings & data</h1></div><div class="row"><span class="small muted" id="save-status-2">' + saveStatusHTML() + '</span></div></div>' + tabs + body;
}
function listsEditor(s) {
  const st = s.settings; const t = st.targets || {};
  const listBox = (k, label) => '<label class="f"><span>' + label + '</span><textarea id="ls-' + k + '" data-list="' + k + '" rows="6">' + esc((st[k] || []).join('\n')) + '</textarea><span class="hint">One per line. Renaming does not change existing records.</span></label>';
  return '<section class="card"><header><h2>Focus areas</h2><span class="small muted">Kind keeps research hours separate from teaching and administration</span></header><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Focus area</th><th>Kind</th><th>Counts toward objective</th><th></th></tr></thead><tbody>' +
    st.focusAreas.map((f, i) => '<tr><td><input id="fa-n-' + i + '" data-fa="' + i + '" data-k="name" value="' + esc(f.name) + '"></td><td><select id="fa-k-' + i + '" data-fa="' + i + '" data-k="kind">' + ['research', 'teaching', 'admin', 'other'].map(k => '<option value="' + k + '"' + (f.kind === k ? ' selected' : '') + '>' + KIND_LABEL[k] + '</option>').join('') + '</select></td><td><select id="fa-o-' + i + '" data-fa="' + i + '" data-k="objectiveId"><option value="">—</option>' + opt.objectives(s).map(o => '<option value="' + o[0] + '"' + (f.objectiveId === o[0] ? ' selected' : '') + '>' + esc(o[1]) + '</option>').join('') + '</select></td><td><button class="btn sm ghost danger" data-act="fa-del" data-i="' + i + '">Remove</button></td></tr>').join('') +
    '</tbody></table></div><div class="row" style="margin-top:8px"><button class="btn sm" data-act="fa-add">+ Focus area</button></div></section>' +
    '<section class="card"><header><h2>Lists</h2><button class="btn sm primary" data-act="lists-save">Save lists</button></header><div class="grid g3">' + listBox('taskTypes', 'Task types') + listBox('statuses', 'Task statuses') + listBox('readingStatuses', 'Reading statuses') + listBox('writingStages', 'Writing workflow') + listBox('milestoneKinds', 'Milestone types') + listBox('experimentStatuses', 'Experiment statuses') + listBox('datasetStatuses', 'Dataset statuses') + listBox('metricCategories', 'Metric categories') + listBox('priorities', 'Priorities') + '</div>' +
    '<p class="small muted">“Done” marks task and milestone completion, and “Read” marks a paper as fully read. Keep those two names.</p></section>' +
    '<section class="card"><header><h2>Targets</h2><button class="btn sm primary" data-act="targets-save">Save targets</button></header><div class="grid g3"><label class="f"><span>Weekly hours target</span><input type="number" id="tg-weeklyHours" min="0" step="0.5" value="' + esc(t.weeklyHours ?? '') + '"></label><label class="f"><span>Daily hours target</span><input type="number" id="tg-dailyHours" min="0" step="0.25" value="' + esc(t.dailyHours ?? '') + '"></label><label class="f"><span>Papers per month</span><input type="number" id="tg-papersPerMonth" min="0" step="1" value="' + esc(t.papersPerMonth ?? '') + '"></label></div></section>' +
    '<section class="card"><header><h2>Saved filters</h2></header>' + ((st.savedFilters || []).length ? '<div class="list">' + st.savedFilters.map(f => '<div class="li"><div class="row between"><span>' + esc(f.name) + ' <span class="muted small">(' + esc(f.scope) + ')</span></span><button class="btn sm ghost danger" data-act="sf-del" data-id="' + f.id + '">Remove</button></div></div>').join('') + '</div>' : '<p class="small muted">Use “Save filter” on the dashboard or daily log.</p>') + '</section>';
}
function calcHelp() {
  return '<section class="card prose"><h2>How progress is calculated</h2>' +
    '<h3>Effort (hours)</h3><p>Total hours = the sum of the Hours field over logged sessions in the period. Sessions without hours are listed as missing and are not treated as zero. <b>Days worked</b> counts each date with at least one session once, however many sessions it has. <b>Average hours per working day</b> = total hours ÷ days worked, both from the same period. Planned effort on tasks is kept separate from actual effort, which is the sum of hours of log sessions linked to the task.</p>' +
    '<h3>Research versus other work</h3><p>Each focus area has a kind (Research, Teaching, Administration, Other) set under Categories. Hours are split by that kind everywhere, so teaching and admin never inflate research effort.</p>' +
    '<h3>Objective progress</h3><p>Progress = completed milestones ÷ milestones defined for that objective. It is shown as <i>unavailable</i> until at least one milestone is confirmed. Suggested milestones do not count until you save them. Hours logged are reported beside progress as a separate measure of effort, together with the number of logged deliverables.</p>' +
    '<h3>Tasks</h3><p>Task counts come from the task list, so a task discussed across several sessions counts once. Log sessions keep their own Status field, which is reported separately and never counted as task completion. A task is completed when its status is Done; its completion date is recorded then.</p>' +
    '<h3>Papers</h3><p>A paper counts as fully read only when its reading status is Read. The daily log’s Papers Read number is a separate legacy count and is never added to the library count.</p>' +
    '<h3>Experiments</h3><p>Runs are compared only when dataset, dataset version, split and evaluation setting match. Missing details are flagged. Failed and abandoned runs remain visible.</p>' +
    '<h3>Productivity</h3><p>The 1–5 rating is self-reported and only averaged over sessions that have a rating.</p>' +
    '<h3>Dates</h3><p>All dates use the Asia/Kolkata time zone and are shown as “23 Oct 2026”. Weeks start on Monday.</p></section>';
}
