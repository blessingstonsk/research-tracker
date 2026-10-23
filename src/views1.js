/* ===== Dashboard + Daily Log ===== */
const U = loadUI();
function loadUI() {
  const d = { view: 'dashboard', dash: { range: 'month', from: '', to: '', objectiveId: '', taskType: '' }, log: { q: '', focus: '', type: '', status: '', from: '', to: '', days: 30, open: {} },
    plan: { mode: 'list', month: '', obj: '', status: '', q: '' }, lit: { tab: 'library', q: '', obj: '', status: '', tag: '' }, exp: { tab: 'runs', q: '', metric: '' }, write: {}, meet: { tab: 'list' }, rep: { kind: 'monthly', ref: '', from: '', to: '', draft: null, savedId: null }, set: { tab: 'import' } };
  try { const s = JSON.parse(localStorage.getItem('rt-ui') || '{}'); for (const k of Object.keys(d)) if (s[k] && typeof d[k] === 'object') Object.assign(d[k], s[k]); } catch (e) {}
  d.rep.draft = null; d.log.open = {};
  return d;
}
function saveUI() { try { const c = JSON.parse(JSON.stringify(U)); c.rep.draft = null; localStorage.setItem('rt-ui', JSON.stringify(c)); } catch (e) {} }

function dashRange(today) {
  const r = U.dash.range;
  if (r === 'week') return { from: C.weekStart(today), to: C.addDays(C.weekStart(today), 6), label: 'This week' };
  if (r === 'month') return { from: C.monthStart(today), to: C.monthEnd(today), label: 'This month' };
  if (r === '30') return { from: C.addDays(today, -29), to: today, label: 'Last 30 days' };
  if (r === '90') return { from: C.addDays(today, -89), to: today, label: 'Last 90 days' };
  if (r === 'year') return { from: today.slice(0, 4) + '-01-01', to: today.slice(0, 4) + '-12-31', label: 'This year' };
  if (r === 'custom') return { from: U.dash.from || '', to: U.dash.to || '', label: (U.dash.from ? C.fmtDate(U.dash.from) : 'Start') + ' – ' + (U.dash.to ? C.fmtDate(U.dash.to) : 'today') };
  return { from: '', to: '', label: 'All time' };
}
function selectHTML(id, opts, cur, blankLabel, act) {
  return '<select id="' + id + '" data-change="' + act + '">' + (blankLabel != null ? '<option value="">' + esc(blankLabel) + '</option>' : '') + opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>';
}
function savedFilterControls(scope) {
  const s = Store.state(); const list = (s.settings.savedFilters || []).filter(f => f.scope === scope);
  return (list.length ? selectHTML('sf-' + scope, list.map(f => [f.id, f.name]), '', 'Saved filters…', 'apply-filter:' + scope) : '') + '<button class="btn sm ghost" data-act="save-filter" data-scope="' + scope + '">Save filter</button>';
}

function viewDashboard() {
  const s = Store.state(); const today = C.todayISO(); const rg = dashRange(today);
  const base = { objectiveId: U.dash.objectiveId, taskType: U.dash.taskType };
  const sumOf = (from, to) => C.summarizeLogs(s, C.filterLogs(s, Object.assign({ from, to }, base)));
  const tdy = sumOf(today, today), wk = sumOf(C.weekStart(today), C.addDays(C.weekStart(today), 6)), mo = sumOf(C.monthStart(today), C.monthEnd(today));
  const periodLogs = C.filterLogs(s, Object.assign({ from: rg.from, to: rg.to }, base)); const per = C.summarizeLogs(s, periodLogs);
  const tc = C.taskCounts(s, { objectiveId: U.dash.objectiveId });
  const overdue = C.overdueTasks(s, today).filter(t => !U.dash.objectiveId || t.objectiveId === U.dash.objectiveId);
  const horizon = C.addDays(today, 60);
  const upcoming = C.live(s.milestones).filter(m => !C.isDone(m.status) && !m.template && m.targetDate && m.targetDate <= horizon && (!U.dash.objectiveId || m.objectiveId === U.dash.objectiveId)).sort((a, b) => a.targetDate.localeCompare(b.targetDate));
  const undated = C.live(s.milestones).filter(m => !C.isDone(m.status) && !m.targetDate).length;
  const readAll = C.papersFullyRead(s).length; const readPer = (rg.from || rg.to) ? C.papersFullyRead(s, rg.from, rg.to).length : readAll;
  const expDone = C.live(s.experiments).filter(e => e.status === 'Completed'); const expPer = (rg.from || rg.to) ? expDone.filter(e => C.inRange(e.endDate || e.startDate, rg.from, rg.to)).length : expDone.length;
  const actions = C.priorityActions(s, today, 3);
  const blockedTasks = C.live(s.tasks).filter(t => t.status === 'Blocked');
  const writing = writingDeadlines(s, today);
  const tgt = s.settings.targets || {};
  const kpi = (v, l, sub, unit) => '<div class="kpi" data-tilt><div class="l">' + l + '</div><div class="v">' + v + (unit ? '<small>' + unit + '</small>' : '') + '</div>' + (sub ? '<div class="s">' + sub + '</div>' : '') + '</div>';
  const split = x => 'Research ' + fmtH(x.byKind.research) + ' · Teaching ' + fmtH(x.byKind.teaching) + ' · Admin ' + fmtH(x.byKind.admin);
  const demo = Object.keys(s).some(k => Array.isArray(s[k]) && s[k].some(r => r.demo && !r.deleted));
  const weekly = C.weeklySeries(s, C.filterLogs(s, base), rg.to && rg.to < today ? rg.to : today, 12);
  const focusRows = Object.entries(per.byFocus).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: k, value: v, kind: C.focusKind(s.settings, k), sub: per.totalHours ? Math.round(100 * v / per.totalHours) + '%' : '' }));
  const deliverables = C.live(s.logs).filter(l => l.output).sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 5);
  const msDone = C.live(s.milestones).filter(m => C.isDone(m.status) && m.completedDate).sort((a, b) => b.completedDate.localeCompare(a.completedDate)).slice(0, 3);

  window.LAST_WEEKS = weekly;
  const nextUp = actions[0] ? (actions[0].type === 'task' ? actions[0].task.title : actions[0].log.nextStep) : '';
  return '<section class="hero"><div><div class="eyebrow">' + C.dayName(today) + ' · ' + C.fmtDate(today) + ' · Asia/Kolkata</div>' +
    '<h1 style="margin-top:10px">Research <span class="hl">overview</span></h1>' +
    '<div class="role">Ph.D. Researcher<span class="sep">|</span>Explainable VLMs for Autonomous Driving</div>' +
    (nextUp ? '<div class="callout"><small>Next up</small>' + esc(trunc(nextUp, 90)) + '</div>' : '<div class="callout"><small>Next up</small>Add a task or a next step to plan your day.</div>') +
    '<div class="row"><button class="btn primary" data-act="new" data-col="logs">' + ICON.plus + ' Log a session</button><a class="btn" href="#plan">Open research plan →</a></div>' +
    '<div class="hero-stats"><div class="hero-stat" data-tilt><b>' + fmtH(tdy.totalHours) + '<small class="muted"> h</small></b><span>Today</span></div><div class="hero-stat" data-tilt><b>' + fmtH(wk.totalHours) + '<small class="muted"> h</small></b><span>This week</span></div><div class="hero-stat" data-tilt><b>' + C.summarizeLogs(s, C.filterLogs(s, base)).days + '</b><span>Days worked (all time)</span></div></div></div>' +
    '<div class="stage3d" id="stage3d"><div class="lbl-layer" aria-hidden="true"></div><div class="stage-2d-host stage-2d" hidden></div>' +
      '<div class="stage-top"><div class="stage-title"><b>Effort street · last 12 weeks</b>Each tower is one week of logged hours</div><div class="legend stage-title" style="font-size:11px">' + KIND_ORDER.map(k => '<span><i style="background:var(--s-' + k + ')"></i>' + KIND_LABEL[k] + '</span>').join('') + '</div></div>' +
      '<span class="stage-hint">' + (U.dash.view2d ? '2D chart view' : 'Drag to orbit · scroll to zoom · hover a tower') + '</span>' +
      '<div class="stage-ctrl"><button data-act="3d-toggle" aria-label="Switch between 3D and 2D chart" title="' + (U.dash.view2d ? 'Show 3D view' : 'Show 2D chart') + '">' + (U.dash.view2d ? '3D' : '2D') + '</button>' + (U.dash.view2d ? '' : '<button data-act="3d-zoom" data-f="0.85" aria-label="Zoom in">+</button><button data-act="3d-zoom" data-f="1.18" aria-label="Zoom out">−</button><button data-act="3d-reset" aria-label="Reset view">⟲</button>') + '</div></div></section>' +
    (demo ? '<div class="note warn">Demonstration records are loaded and are included below. Remove them in Settings & data → Demo data.</div>' : '') +
    '<div class="filters card" style="padding:10px 12px"><label class="f"><span>Period</span>' + selectHTML('d-range', [['week', 'This week'], ['month', 'This month'], ['30', 'Last 30 days'], ['90', 'Last 90 days'], ['year', 'This year'], ['all', 'All time'], ['custom', 'Custom…']], U.dash.range, null, 'dash:range') + '</label>' +
    (U.dash.range === 'custom' ? '<label class="f"><span>From</span><input type="date" id="d-from" value="' + esc(U.dash.from) + '" data-change="dash:from"></label><label class="f"><span>To</span><input type="date" id="d-to" value="' + esc(U.dash.to) + '" data-change="dash:to"></label>' : '') +
    '<label class="f"><span>Objective</span>' + selectHTML('d-obj', opt.objectives(s), U.dash.objectiveId, 'All objectives', 'dash:objectiveId') + '</label>' +
    '<label class="f"><span>Activity type</span>' + selectHTML('d-type', s.settings.taskTypes, U.dash.taskType, 'All activity types', 'dash:taskType') + '</label>' +
    '<div class="row" style="align-self:end">' + savedFilterControls('dashboard') + '</div></div>' +
    '<section class="kpis" aria-label="Effort">' +
      kpi(fmtH(tdy.totalHours), 'Hours today', tdy.sessions ? tdy.sessions + ' session(s)' + (tdy.missingHours ? ' · ' + tdy.missingHours + ' without hours' : '') : 'Nothing logged yet', 'h') +
      kpi(fmtH(wk.totalHours), 'This week', split(wk) + (tgt.weeklyHours ? ' · target ' + tgt.weeklyHours + ' h' : ''), 'h') +
      kpi(fmtH(mo.totalHours), 'This month', split(mo), 'h') +
      kpi(per.days, 'Days worked', rg.label + ' · each date counted once') +
      kpi(per.avgPerDay == null ? '—' : fmtH(per.avgPerDay), 'Avg per working day', fmtH(per.totalHours) + ' h ÷ ' + per.days + ' day(s)' + (per.missingHours ? ' · ' + per.missingHours + ' session(s) missing hours' : ''), per.avgPerDay == null ? '' : 'h') +
      kpi(readPer, 'Papers fully read', (rg.from || rg.to ? rg.label + ' · ' : '') + readAll + ' in library marked Read' + (per.papersReadN ? ' · log field: ' + per.papersReadSum : '')) +
      kpi(expPer, 'Experiments completed', (rg.from || rg.to ? rg.label + ' · ' : '') + expDone.length + ' total') +
      kpi(per.prodAvg == null ? '—' : per.prodAvg, 'Productivity (self-reported)', per.prodN ? 'Average of ' + per.prodN + ' rated session(s), 1–5' : 'No ratings in period') +
    '</section>' +
    '<div class="grid g-side">' +
      '<section class="card" data-tilt><header><h2>Next three priority actions</h2><a class="btn sm ghost" href="#plan">All tasks</a></header>' + (actions.length ? '<div class="list">' + actions.map(a => a.type === 'task' ?
        '<div class="li"><div class="row between"><a href="#" class="t" data-act="edit" data-col="tasks" data-id="' + a.task.id + '">' + esc(a.task.title) + '</a>' + statusPill(a.task.status) + '</div><div class="m">' + esc(a.reason) + (a.task.nextAction ? ' · Next: ' + esc(a.task.nextAction) : '') + objChip(s, a.task.objectiveId) + '</div></div>' :
        '<div class="li"><div class="row between"><span class="t">' + esc(a.log.nextStep) + '</span><button class="btn sm" data-act="make-task" data-id="' + a.log.id + '">Make task</button></div><div class="m">' + esc(a.reason) + ' · ' + kindChip(s.settings, a.log.focus) + '</div></div>').join('') + '</div>' : '<div class="empty"><b>No open tasks</b>Add tasks in Research Plan, or turn a log’s Next Step into a task.</div>') + '</section>' +
      '<section class="card"><header><h2>Tasks by status</h2><span class="muted small">Unique tasks, not log entries</span></header>' + taskStatusBlock(s, tc) +
        '<div class="small muted" style="margin-top:10px">Log sessions by recorded status: ' + (Object.entries(C.summarizeLogs(s, C.filterLogs(s, base)).logStatus).map(([k, v]) => esc(k) + ' ' + v).join(' · ') || 'none') + '</div></section>' +
    '</div>' +
    '<section class="card"><header><h2>Needs attention</h2></header><div class="grid g3">' +
      attnList('Overdue tasks', overdue.map(t => ({ col: 'tasks', id: t.id, t: t.title, m: 'Due ' + C.fmtDate(t.dueDate) + ' · ' + C.diffDays(t.dueDate, today) + ' day(s) late', pill: t.status })), 'No overdue tasks.') +
      attnList('Blocked', blockedTasks.map(t => ({ col: 'tasks', id: t.id, t: t.title, m: t.blocker || 'No blocker described' })).concat(C.live(s.logs).filter(l => l.blockers && C.inRange(l.date, C.addDays(today, -14), today)).slice(-4).map(l => ({ col: 'logs', id: l.id, t: l.blockers, m: 'Log blocker · ' + C.fmtDate(l.date) }))), 'Nothing blocked.') +
      attnList('Upcoming milestones & writing deadlines (60 days)', upcoming.map(m => ({ col: 'milestones', id: m.id, t: m.title, m: C.fmtDate(m.targetDate) + ' · in ' + C.diffDays(today, m.targetDate) + ' day(s)', pill: m.status })).concat(writing.map(w => ({ col: 'manuscripts', id: w.m.id, t: w.label, m: C.fmtDate(w.date) + (w.date < today ? ' · overdue' : ' · in ' + C.diffDays(today, w.date) + ' day(s)') }))), undated ? undated + ' milestone(s) have no target date yet.' : 'No dated milestones in the next 60 days.') +
    '</div></section>' +
    '<div class="grid g2">' +
      '<section class="card" data-tilt><header><h2>Objective progress</h2><span class="muted small">Completed milestones ÷ milestones defined</span></header>' + objectiveBlock(s, rg) + '</section>' +
      '<section class="card" data-tilt><header><h2>Time by focus area</h2><span class="muted small">' + esc(rg.label) + ' · ' + fmtH(per.totalHours) + ' h</span></header>' + hbars(focusRows, 'h') + '</section>' +
    '</div>' +
    '<div class="grid">' +
      '<section class="card"><header><h2>Activity</h2><span class="muted small">Hours per day, last 52 weeks</span></header>' + heatmap(C.dailyTotals(C.filterLogs(s, base)), today, 52) + '</section>' +
    '</div>' +
    '<section class="card"><header><h2>Recent deliverables</h2><a class="btn sm ghost" href="#reports">Build a report</a></header>' +
      ((deliverables.length || msDone.length) ? '<div class="list">' + msDone.map(m => '<div class="li"><a href="#" class="t" data-act="edit" data-col="milestones" data-id="' + m.id + '">Milestone: ' + esc(m.title) + '</a><div class="m">' + C.fmtDate(m.completedDate) + '</div></div>').join('') + deliverables.map(l => '<div class="li"><a href="#" class="t" data-act="edit" data-col="logs" data-id="' + l.id + '">' + esc(l.output) + '</a><div class="m">' + C.fmtDate(l.date) + ' · ' + kindChip(s.settings, l.focus) + ' ' + esc(trunc(l.what, 90)) + '</div></div>').join('') + '</div>' : '<div class="empty">No outputs recorded yet. Fill “Output / Deliverable” when you log a session.</div>') +
    '</section>' +
    '<p class="small muted">Hours measure effort. Objective progress is measured only by completed milestones. Productivity ratings are self-reported. <a href="#settings" data-act="settings-tab" data-tab="calc">How these are calculated</a>.</p>';
}
function objChip(s, id) { if (!id) return ''; const o = Store.get('objectives', id); return o ? ' <span class="chip">' + esc(o.code) + '</span>' : ''; }
function writingDeadlines(s, today) {
  const out = []; const horizon = C.addDays(today, 60);
  C.live(s.manuscripts).forEach(m => {
    if (m.deadline && !['Accepted', 'Published', 'Rejected'].includes(m.stage) && m.deadline <= horizon && m.deadline >= C.addDays(today, -30)) out.push({ m, date: m.deadline, label: 'Writing: ' + m.title });
    (m.submissions || []).forEach(sb => { if (sb.revisionDeadline && sb.revisionDeadline <= horizon && sb.revisionDeadline >= C.addDays(today, -30)) out.push({ m, date: sb.revisionDeadline, label: 'Revision due: ' + m.title }); });
  });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
function attnList(title, items, emptyText) {
  return '<div><h3 style="margin-bottom:6px">' + esc(title) + ' <span class="muted num">' + items.length + '</span></h3>' + (items.length ? '<div class="list">' + items.slice(0, 6).map(i => '<div class="li"><div class="row between"><a href="#" class="t" data-act="edit" data-col="' + i.col + '" data-id="' + i.id + '">' + esc(trunc(i.t, 90)) + '</a>' + (i.pill ? statusPill(i.pill) : '') + '</div><div class="m">' + esc(i.m) + '</div></div>').join('') + (items.length > 6 ? '<div class="small muted">+ ' + (items.length - 6) + ' more</div>' : '') + '</div>' : '<div class="small muted">' + esc(emptyText) + '</div>') + '</div>';
}
function taskStatusBlock(s, tc) {
  const total = Object.values(tc).reduce((a, b) => a + b, 0);
  if (!total) return '<div class="empty"><b>No tasks yet</b><button class="btn sm" data-act="new" data-col="tasks">Add a task</button></div>';
  return '<div style="display:grid;gap:8px">' + Object.entries(tc).map(([k, v]) => '<div style="display:grid;grid-template-columns:110px minmax(0,1fr) 34px;gap:10px;align-items:center">' + statusPill(k) + '<div class="bar"><i style="width:' + (total ? 100 * v / total : 0) + '%;background:var(--accent)"></i></div><span class="num" style="text-align:right">' + v + '</span></div>').join('') + '</div>';
}
function objectiveBlock(s, rg) {
  const objs = C.live(s.objectives).sort((a, b) => (a.code || '').localeCompare(b.code || ''));
  const pp = C.programmeProgress(s);
  return objs.map(o => { const p = C.objectiveProgress(s, o.id); const h = C.summarizeLogs(s, C.filterLogs(s, { objectiveId: o.id, from: rg.from, to: rg.to })).totalHours;
    return '<div class="obj"><div class="row between"><span><span class="code">' + esc(o.code) + '</span> <a href="#" data-act="edit" data-col="objectives" data-id="' + o.id + '" class="small">' + esc(trunc(o.title, 80)) + '</a></span><span class="num small">' + (p.pct == null ? '<span class="muted">Unavailable</span>' : p.pct + '%') + '</span></div>' +
      (p.pct == null ? '<div class="small muted">No milestones defined for this objective yet.</div>' : '<div class="bar" data-tip="' + p.done + ' of ' + p.total + ' milestones complete"><i style="width:' + p.pct + '%"></i></div><div class="small muted">' + p.done + ' of ' + p.total + ' milestones complete</div>') +
      '<div class="small muted">Effort (separate measure): ' + fmtH(h) + ' h in ' + esc(rg.label.toLowerCase()) + ' · ' + p.deliverables + ' logged deliverable(s)</div></div>'; }).join('') +
    '<div class="obj"><div class="row between"><b class="small">All programme milestones</b><span class="num small">' + (pp.pct == null ? '<span class="muted">Unavailable</span>' : pp.pct + '%') + '</span></div>' + (pp.pct == null ? '<div class="small muted">Confirm suggested milestones in Research Plan to start tracking.</div>' : '<div class="bar"><i style="width:' + pp.pct + '%"></i></div><div class="small muted">' + pp.done + ' of ' + pp.total + ' complete</div>') + '</div>';
}

/* ---------- Daily Log ---------- */
let QDRAFT = loadDraft();
function loadDraft() { try { return JSON.parse(localStorage.getItem('rt-quick') || 'null') || {}; } catch (e) { return {}; } }
function saveDraft() { try { localStorage.setItem('rt-quick', JSON.stringify(QDRAFT)); } catch (e) {} }
function viewLog() {
  const s = Store.state(); const today = C.todayISO(); const q = U.log; const D = QDRAFT;
  const focus = D.focus || s.settings.focusAreas[0]?.name || ''; const type = D.taskType || s.settings.taskTypes[0] || '';
  const quick = '<form class="quick" id="quick-form" autocomplete="off"><div class="row between"><h2>Log a work session</h2><span class="small muted"><span id="q-day">' + C.dayName(D.date || today) + ' ' + C.fmtDate(D.date || today) + '</span> · day set from the date</span></div>' +
    '<div class="qrow"><label class="f req"><span>Date</span><input type="date" name="date" id="q-date" value="' + esc(D.date || today) + '" required data-input="qdraft"></label>' +
    '<label class="f req"><span>Focus Area</span>' + simpleSelect('focus', 'q-focus', s.settings.focusAreas.map(f => f.name), focus) + '</label>' +
    '<label class="f req"><span>Task Type</span>' + simpleSelect('taskType', 'q-type', s.settings.taskTypes, type) + '</label>' +
    '<label class="f"><span>Hours</span><input type="number" name="hours" id="q-hours" step="0.25" min="0" max="24" inputmode="decimal" value="' + esc(D.hours ?? '') + '" data-input="qdraft"></label>' +
    '<label class="f"><span>Status</span>' + simpleSelect('status', 'q-status', s.settings.statuses, D.status || 'Done') + '</label></div>' +
    '<div class="qrow2"><label class="f req"><span>What I Worked On</span><input name="what" id="q-what" value="' + esc(D.what || '') + '" placeholder="e.g. Ran BDD-X baseline with LLaVA-1.5" required data-input="qdraft"></label>' +
    '<label class="f"><span>Output / Deliverable</span><input name="output" id="q-output" value="' + esc(D.output || '') + '" data-input="qdraft"></label>' +
    '<button class="btn primary" type="submit">Save session</button></div>' +
    '<details class="more"' + (D.open ? ' open' : '') + ' data-toggle="qmore"><summary>Blockers, next step, papers read, productivity, links</summary><div class="more-grid">' +
    '<label class="f"><span>Blockers / Issues</span><input name="blockers" id="q-blockers" value="' + esc(D.blockers || '') + '" data-input="qdraft"></label>' +
    '<label class="f"><span>Next Step</span><input name="nextStep" id="q-next" value="' + esc(D.nextStep || '') + '" data-input="qdraft"></label>' +
    '<label class="f"><span>Papers Read (count)</span><input type="number" name="papersRead" id="q-papers" min="0" step="1" value="' + esc(D.papersRead ?? '') + '" data-input="qdraft"></label>' +
    '<label class="f"><span>Productivity 1–5 (self-reported)</span>' + simpleSelect('productivity', 'q-prod', [['', '—'], '1', '2', '3', '4', '5'], D.productivity ?? '') + '</label>' +
    '<label class="f"><span>Linked task</span>' + simpleSelect('taskId', 'q-task', [['', '—']].concat(opt.tasks(s).filter(t => !/\(done\)$/.test(t[1]))), D.taskId || '') + '</label>' +
    '<label class="f"><span>Linked experiment</span>' + simpleSelect('experimentId', 'q-exp', [['', '—']].concat(opt.experiments(s)), D.experimentId || '') + '</label>' +
    '<label class="f"><span>Linked paper</span>' + simpleSelect('paperId', 'q-paper', [['', '—']].concat(opt.papers(s)), D.paperId || '') + '</label>' +
    '<label class="f"><span>Linked manuscript</span>' + simpleSelect('manuscriptId', 'q-ms', [['', '—']].concat(opt.manuscripts(s)), D.manuscriptId || '') + '</label>' +
    '<label class="f"><span>Output file link</span><input type="url" name="outputUrl" id="q-url" value="' + esc(D.outputUrl || '') + '" data-input="qdraft"></label>' +
    '</div></details><div id="q-err"></div></form>';

  let logs = C.live(s.logs).filter(l => (!q.focus || l.focus === q.focus) && (!q.type || l.taskType === q.type) && (!q.status || l.status === q.status) && (!q.from || (l.date && l.date >= q.from)) && (!q.to || (l.date && l.date <= q.to)));
  if (q.q) { const t = q.q.toLowerCase(); logs = logs.filter(l => [l.what, l.output, l.blockers, l.nextStep, l.focus, l.taskType].some(v => v && String(v).toLowerCase().includes(t))); }
  const sum = C.summarizeLogs(s, logs);
  const byDate = {}; logs.forEach(l => (byDate[l.date || ''] = byDate[l.date || ''] || []).push(l));
  const dates = Object.keys(byDate).sort().reverse(); const shown = dates.slice(0, q.days);
  const filters = '<div class="filters"><input type="search" id="l-q" placeholder="Search what, output, blockers, next steps…" value="' + esc(q.q) + '" data-input="log:q">' +
    selectHTML('l-focus', s.settings.focusAreas.map(f => f.name), q.focus, 'All focus areas', 'log:focus') + selectHTML('l-type', s.settings.taskTypes, q.type, 'All task types', 'log:type') + selectHTML('l-status', s.settings.statuses, q.status, 'All statuses', 'log:status') +
    '<input type="date" id="l-from" value="' + esc(q.from) + '" data-change="log:from" aria-label="From date"><input type="date" id="l-to" value="' + esc(q.to) + '" data-change="log:to" aria-label="To date">' + savedFilterControls('log') + ((q.q || q.focus || q.type || q.status || q.from || q.to) ? '<button class="btn sm ghost" data-act="log-clear">Clear</button>' : '') + '</div>';
  const list = shown.length ? shown.map(d => { const ls = byDate[d].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || '')); const dh = C.round2(ls.reduce((a, l) => a + (C.isNum(l.hours) ? l.hours : 0), 0));
    return '<section class="day"><header><span><b>' + (d ? C.dayName(d) + ' ' + C.fmtDate(d) : 'No date') + '</b>' + (d === today ? ' <span class="pill info nodot">Today</span>' : '') + '</span><span class="small muted"><span class="num">' + fmtH(dh) + ' h</span> · ' + ls.length + ' session(s)</span></header>' + ls.map(l => sessionHTML(s, l)).join('') + '</section>'; }).join('') +
    (dates.length > shown.length ? '<button class="btn" data-act="log-more">Show older days (' + (dates.length - shown.length) + ' more)</button>' : '')
    : '<div class="empty"><b>No sessions match</b>' + (C.live(s.logs).length ? 'Try clearing the filters.' : 'Log your first session above, or import your workbook from More → Import.') + '</div>';
  return '<div class="page-head"><div><h1>Daily log</h1><p>Each row is one work session. Several sessions per day are fine; each date counts once toward days worked.</p></div></div>' + quick +
    '<div class="row between"><h2>Sessions</h2><span class="small muted">' + sum.sessions + ' session(s) · <span class="num">' + fmtH(sum.totalHours) + ' h</span> · ' + sum.days + ' day(s) · avg ' + fmtH(sum.avgPerDay) + ' h/day' + (sum.missingHours ? ' · ' + sum.missingHours + ' without hours' : '') + '</span></div>' + filters + '<div class="grid" style="gap:10px">' + list + '</div>';
}
function simpleSelect(name, id, opts, cur) { return '<select name="' + name + '" id="' + id + '" data-change="qdraft">' + opts.map(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; return '<option value="' + esc(v) + '"' + (String(v) === String(cur) ? ' selected' : '') + '>' + esc(l) + '</option>'; }).join('') + '</select>'; }
function sessionHTML(s, l) {
  const open = U.log.open[l.id]; const L = l.links || {};
  const links = [['tasks', L.taskId, 'Task'], ['milestones', L.milestoneId, 'Milestone'], ['papers', L.paperId, 'Paper'], ['experiments', L.experimentId, 'Experiment'], ['manuscripts', L.manuscriptId, 'Manuscript']].filter(x => x[1] && Store.get(x[0], x[1]))
    .map(x => { const r = Store.get(x[0], x[1]); return '<a href="#" class="chip" data-act="edit" data-col="' + x[0] + '" data-id="' + r.id + '">' + x[2] + ': ' + esc(trunc(r.title || r.expId || '', 40)) + '</a>'; }).join('');
  return '<div class="sess" data-log="' + l.id + '"><div class="what">' + esc(l.what || '(no description)') + '</div><div class="hrs">' + (C.isNum(l.hours) ? fmtH(l.hours) + ' h' : '<span class="muted small">no hours</span>') + '</div>' +
    '<div class="meta">' + kindChip(s.settings, l.focus) + (l.taskType ? '<span class="chip">' + esc(l.taskType) + '</span>' : '') + statusPill(l.status) + (l.output ? '<span class="small">Output: <b>' + esc(l.output) + '</b></span>' : '') + (l.blockers ? '<span class="pill warn">Blocker</span>' : '') + links +
    '<span class="grow"></span><span class="acts"><button class="btn sm ghost" data-act="log-toggle" data-id="' + l.id + '" aria-expanded="' + !!open + '">' + (open ? 'Less' : 'Details') + '</button>' +
    (l.nextStep && !l.nextStepTaskId ? '<button class="btn sm ghost" data-act="make-task" data-id="' + l.id + '">Next step → task</button>' : '') +
    '<button class="btn sm ghost" data-act="edit" data-col="logs" data-id="' + l.id + '">Edit</button><button class="btn sm ghost" data-act="duplicate-log" data-id="' + l.id + '">Repeat</button><button class="btn sm ghost danger" data-act="del" data-col="logs" data-id="' + l.id + '">Delete</button></span></div>' +
    (open ? '<dl class="det"><div><dt>Blockers / Issues</dt><dd>' + (esc(l.blockers) || '<span class="muted">—</span>') + '</dd></div><div><dt>Next Step</dt><dd>' + (esc(l.nextStep) || '<span class="muted">—</span>') + (l.nextStepTaskId && Store.get('tasks', l.nextStepTaskId) ? ' <a href="#" class="chip" data-act="edit" data-col="tasks" data-id="' + l.nextStepTaskId + '">Task created</a>' : '') + '</dd></div>' +
      '<div><dt>Papers Read</dt><dd>' + (C.isNum(l.papersRead) ? l.papersRead : '<span class="muted">not recorded</span>') + '</dd></div><div><dt>Productivity (self-reported)</dt><dd>' + (C.isNum(l.productivity) ? l.productivity + ' / 5' : '<span class="muted">not rated</span>') + '</dd></div>' +
      (L.outputUrl ? '<div><dt>Output file</dt><dd><a href="' + esc(L.outputUrl) + '" target="_blank" rel="noopener">' + esc(trunc(L.outputUrl, 50)) + '</a></dd></div>' : '') + (l.source && l.source.sheet ? '<div><dt>Source</dt><dd>' + esc(l.source.sheet) + ' row ' + l.source.row + '</dd></div>' : '') + '</dl>' : '') + '</div>';
}
function submitQuick(form) {
  const s = Store.state(); const g = n => form.elements[n] ? form.elements[n].value.trim() : '';
  const num = n => { const v = g(n); if (v === '') return null; const x = Number(v); return isFinite(x) ? x : null; };
  const rec = { date: g('date'), focus: g('focus'), taskType: g('taskType'), what: g('what'), hours: num('hours'), status: g('status'), output: g('output'), papersRead: num('papersRead'), blockers: g('blockers'), nextStep: g('nextStep'), productivity: num('productivity'),
    links: { taskId: g('taskId'), experimentId: g('experimentId'), paperId: g('paperId'), manuscriptId: g('manuscriptId'), outputUrl: g('outputUrl') } };
  const errs = []; if (!rec.date) errs.push('Date is required.'); if (!rec.what) errs.push('Describe what you worked on.'); if (rec.hours != null && (rec.hours < 0 || rec.hours > 24)) errs.push('Hours must be between 0 and 24.');
  if (errs.length) { document.getElementById('q-err').innerHTML = '<div class="note bad">' + errs.join('<br>') + '</div>'; return; }
  Object.keys(rec.links).forEach(k => { if (!rec.links[k]) delete rec.links[k]; });
  Store.put('logs', rec);
  QDRAFT = { date: rec.date, focus: rec.focus, taskType: rec.taskType, status: rec.status, open: QDRAFT.open }; saveDraft();
  toast('Session saved · ' + (C.isNum(rec.hours) ? rec.hours + ' h on ' : '') + C.fmtDate(rec.date));
  setTimeout(() => { const w = document.getElementById('q-what'); if (w) w.focus(); }, 30);
}
function makeTaskFromLog(id) {
  const l = Store.get('logs', id); if (!l) return; const s = Store.state(); const f = C.focusInfo(s.settings, l.focus);
  openEditor('tasks', null, { title: l.nextStep, focus: l.focus, objectiveId: f && f.objectiveId ? f.objectiveId : '', status: 'Planned', priority: 'Medium', sourceLogId: l.id, notes: 'From log on ' + C.fmtDate(l.date) + ': ' + (l.what || '') }, t => { const L = Store.get('logs', id); if (L) { L.nextStepTaskId = t.id; Store.put('logs', L); } });
}
