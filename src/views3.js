/* ===== Experiments & datasets, Writing, Meetings ===== */
function viewExperiments() {
  const s = Store.state(); const E = U.exp;
  const tabs = '<div class="tabs" role="tablist">' + [['runs', 'Experiment runs'], ['compare', 'Compare runs'], ['datasets', 'Dataset register']].map(([k, l]) => '<button role="tab" aria-selected="' + (E.tab === k) + '" data-act="exp-tab" data-tab="' + k + '">' + l + '</button>').join('') + '</div>';
  let exps = C.live(s.experiments);
  if (E.q) { const t = E.q.toLowerCase(); exps = exps.filter(e => [e.expId, e.title, e.hypothesis, e.model, e.observations, e.failures, e.results].some(v => v && String(v).toLowerCase().includes(t))); }
  exps.sort((a, b) => (b.startDate || b.createdAt || '').localeCompare(a.startDate || a.createdAt || ''));
  let body = '';
  if (E.tab === 'runs') {
    body = '<div class="filters"><input type="search" id="e-q" placeholder="Search experiments" value="' + esc(E.q) + '" data-input="exp:q"><button class="btn primary" data-act="new" data-col="experiments">' + ICON.plus + ' Experiment</button></div>' +
      (exps.length ? '<div class="grid g2">' + exps.map(e => { const d = e.datasetId && Store.get('datasets', e.datasetId); const o = e.objectiveId && Store.get('objectives', e.objectiveId);
        const sessions = C.live(s.logs).filter(l => l.links && l.links.experimentId === e.id); const h = C.round2(sessions.reduce((a, l) => a + (C.isNum(l.hours) ? l.hours : 0), 0));
        return '<section class="card" data-tilt><header><div><span class="mono small muted">' + esc(e.expId || 'No ID') + '</span><a href="#" data-act="edit" data-col="experiments" data-id="' + e.id + '"><h3>' + esc(e.title || 'Untitled') + '</h3></a></div>' + statusPill(e.status) + '</header>' +
          '<div class="row small" style="gap:6px;margin-bottom:6px">' + (o ? '<span class="chip">' + esc(o.code) + '</span>' : '') + (e.model ? '<span class="chip">' + esc(e.model + (e.modelVersion ? ' ' + e.modelVersion : '')) + '</span>' : '') + (d ? '<span class="chip">' + esc(d.name + (e.datasetVersion ? ' ' + e.datasetVersion : '')) + '</span>' : '') + (e.split ? '<span class="chip">' + esc(e.split) + '</span>' : '') + '</div>' +
          (e.hypothesis ? '<p class="small" style="margin:0 0 6px"><b>H:</b> ' + esc(e.hypothesis) + '</p>' : '') +
          ((e.metrics || []).length ? '<div class="tbl-wrap" style="margin:6px 0"><table class="tbl"><tbody>' + e.metrics.map(m => '<tr><td>' + esc(m.name || '') + (m.category ? ' <span class="muted small">' + esc(m.category) + '</span>' : '') + '</td><td class="n">' + (C.isNum(m.value) ? m.value : '<span class="muted">—</span>') + ' ' + esc(m.unit || '') + '</td><td class="small muted">' + (m.better === 'lower' ? '↓ lower is better' : '↑ higher is better') + '</td></tr>').join('') + '</tbody></table></div>' : '') +
          (e.failures ? '<p class="small" style="margin:0;color:var(--bad)"><b>Failures / negative findings:</b> ' + esc(e.failures) + '</p>' : '') +
          '<div class="small muted" style="margin-top:6px">' + [e.startDate && 'Run ' + C.fmtDate(e.startDate) + (e.endDate ? ' – ' + C.fmtDate(e.endDate) : ''), C.isNum(e.computeHours) && e.computeHours + ' GPU h', sessions.length && sessions.length + ' log session(s), ' + h + ' h', e.commit && 'commit ' + e.commit].filter(Boolean).join(' · ') + '</div></section>'; }).join('') + '</div>' : '<div class="empty"><b>No experiments yet</b>Record each run with its configuration, data split and seed. Failed runs and negative findings stay in the register.</div>');
  } else if (E.tab === 'compare') {
    const names = Array.from(new Set(C.live(s.experiments).flatMap(e => (e.metrics || []).map(m => m.name).filter(Boolean)))).sort();
    const metric = E.metric && names.includes(E.metric) ? E.metric : names[0];
    if (!metric) body = '<div class="empty">Add metrics to experiment runs to compare them.</div>';
    else {
      const groups = C.compatGroups(C.live(s.experiments).filter(e => (e.metrics || []).some(m => m.name === metric)));
      body = '<div class="filters"><label class="f"><span>Metric</span>' + selectHTML('e-metric', names, metric, null, 'exp:metric') + '</label></div><div class="note">Runs are grouped by dataset, dataset version, split and evaluation setting. Only runs inside the same group are ranked against each other.</div>' +
        Object.entries(groups).map(([k, es]) => { const rows = es.map(e => ({ e, m: e.metrics.find(m => m.name === metric) }));
          const better = rows[0].m.better || 'higher'; const ranked = rows.filter(r => C.isNum(r.m.value)).sort((a, b) => better === 'lower' ? a.m.value - b.m.value : b.m.value - a.m.value); const missing = rows.filter(r => !C.isNum(r.m.value));
          const ds = es[0].datasetId && Store.get('datasets', es[0].datasetId); const parts = k.split(' | ');
          const unitsDiffer = new Set(rows.map(r => r.m.unit || '')).size > 1;
          return '<section class="card"><header><h3>' + esc(ds ? ds.name : 'Dataset not set') + ' · version ' + esc(parts[1]) + ' · split ' + esc(parts[2]) + ' · eval ' + esc(parts[3]) + '</h3><span class="small muted">' + es.length + ' run(s) · ' + (better === 'lower' ? 'lower' : 'higher') + ' is better</span></header>' +
            (k.includes('?') ? '<div class="note warn small">Some comparability details are missing (shown as “?”). Fill them in before relying on this ranking.</div>' : '') + (unitsDiffer ? '<div class="note bad small">Units differ within this group; values are not ranked.</div>' : '') +
            (es.length < 2 ? '<p class="small muted">Only one run in this group — nothing to compare yet.</p>' : '') +
            '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>#</th><th>Run</th><th>Status</th><th>Model</th><th class="n">' + esc(metric) + '</th></tr></thead><tbody>' + (unitsDiffer ? rows : ranked).concat(unitsDiffer ? [] : missing).map((r, i) => '<tr class="click" data-act="edit" data-col="experiments" data-id="' + r.e.id + '"><td class="mono">' + (!unitsDiffer && C.isNum(r.m.value) && es.length > 1 ? i + 1 : '') + '</td><td>' + esc((r.e.expId ? r.e.expId + ' · ' : '') + (r.e.title || '')) + '</td><td>' + statusPill(r.e.status) + '</td><td class="small">' + esc(r.e.model || '') + '</td><td class="n">' + (C.isNum(r.m.value) ? r.m.value + ' ' + esc(r.m.unit || '') : '<span class="muted">not recorded</span>') + '</td></tr>').join('') + '</tbody></table></div></section>'; }).join('');
    }
  } else {
    const ds = C.live(s.datasets);
    body = '<div class="row between"><p class="small muted" style="margin:0">Large datasets and checkpoints are recorded by location only.</p><button class="btn primary" data-act="new" data-col="datasets">' + ICON.plus + ' Dataset</button></div>' +
      (ds.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Dataset</th><th>Version</th><th>Source</th><th>Access</th><th>Annotations</th><th>Status</th><th>Location</th><th>Experiments</th></tr></thead><tbody>' + ds.map(d => { const ex = C.live(s.experiments).filter(e => e.datasetId === d.id);
        return '<tr class="click" data-act="edit" data-col="datasets" data-id="' + d.id + '"><td><b>' + esc(d.name) + '</b></td><td>' + esc(d.version || '') + '</td><td class="small wrap">' + esc(d.source || '') + '</td><td class="small wrap">' + esc(d.access || '') + '</td><td class="small wrap">' + esc(d.annotations || '') + '</td><td>' + statusPill(d.status) + '</td><td class="small mono">' + esc(d.location || '') + '</td><td class="small">' + (ex.length ? ex.map(e => esc(e.expId || trunc(e.title, 20))).join(', ') : '<span class="muted">none</span>') + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">No datasets registered.</div>');
  }
  return '<div class="page-head"><div><h1>Experiments</h1><p>Hypotheses, configurations, data splits and results, including failed runs and negative findings.</p></div></div>' + tabs + body;
}

function viewWriting() {
  const s = Store.state(); const today = C.todayISO(); const ms = C.live(s.manuscripts); const stages = s.settings.writingStages;
  const pipe = '<section class="kpis">' + stages.map(st => '<div class="kpi"><div class="l">' + esc(st) + '</div><div class="v">' + ms.filter(m => m.stage === st).length + '</div></div>').join('') + '</section>';
  const writeTasks = C.live(s.tasks).filter(t => !C.isDone(t.status) && (t.manuscriptId || t.focus === 'Paper Writing'));
  const dl = writingDeadlines(s, today);
  const cards = ms.length ? '<div class="grid g2">' + ms.sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999')).map(m => {
    const idx = stages.indexOf(m.stage); const secs = m.sections || []; const done = secs.filter(x => x.done).length;
    const objs = (m.objectiveIds || []).map(id => Store.get('objectives', id)).filter(Boolean);
    const sessions = C.live(s.logs).filter(l => l.links && l.links.manuscriptId === m.id); const h = C.round2(sessions.reduce((a, l) => a + (C.isNum(l.hours) ? l.hours : 0), 0));
    const lastSub = (m.submissions || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0];
    return '<section class="card" data-tilt><header><div><span class="eyebrow">' + esc(m.kind || 'Paper') + '</span><a href="#" data-act="edit" data-col="manuscripts" data-id="' + m.id + '"><h3>' + esc(m.title) + '</h3></a></div>' + statusPill(m.stage) + '</header>' +
      '<div class="stage-track" aria-label="Workflow stage">' + stages.map((st, i) => '<span class="' + (i === idx ? 'on' : i < idx && !['Rejected'].includes(st) ? 'past' : '') + '">' + esc(st) + '</span>').join('') + '</div>' +
      '<div class="small" style="margin-top:8px;display:grid;gap:3px">' + (m.venue ? '<div>Target: <b>' + esc(m.venue) + '</b></div>' : '') + (m.deadline ? '<div>Deadline: <span class="mono">' + C.fmtDate(m.deadline) + '</span>' + (m.deadline < today && !['Submitted', 'Under Review', 'Accepted', 'Published'].includes(m.stage) ? ' <span class="pill bad nodot">passed</span>' : '') + '</div>' : '') +
      (m.coauthors ? '<div>Co-authors: ' + esc(m.coauthors) + '</div>' : '') + (objs.length ? '<div>' + objs.map(o => '<span class="chip">' + esc(o.code) + '</span>').join(' ') + '</div>' : '') +
      (secs.length ? '<div>Sections: ' + done + ' / ' + secs.length + ' done</div><div class="bar"><i style="width:' + (100 * done / secs.length) + '%"></i></div>' : '<div class="muted">No section checklist yet</div>') +
      (lastSub ? '<div>Last submission ' + C.fmtDate(lastSub.date) + (lastSub.msId ? ' · ID ' + esc(lastSub.msId) : '') + (lastSub.status ? ' · ' + esc(lastSub.status) : '') + (lastSub.revisionDeadline ? ' · revision due ' + C.fmtDate(lastSub.revisionDeadline) : '') + '</div>' : '') +
      ((m.claims || []).length ? '<div>' + m.claims.length + ' claim/figure/table link(s)' + (m.claims.filter(c => !c.paperId && !c.experimentId).length ? ' · <span style="color:var(--warn)">' + m.claims.filter(c => !c.paperId && !c.experimentId).length + ' without evidence</span>' : '') + '</div>' : '') +
      '<div class="muted">Effort: ' + h + ' h over ' + sessions.length + ' linked session(s)</div></div></section>'; }).join('') + '</div>' : '<div class="empty"><b>No manuscripts or chapters yet</b>Track papers and thesis chapters from idea to publication.</div>';
  return '<div class="page-head"><div><h1>Writing & publications</h1><p>Manuscripts and thesis chapters, submissions, reviews and the evidence behind each claim.</p></div><button class="btn primary" data-act="new" data-col="manuscripts">' + ICON.plus + ' Manuscript</button></div>' + pipe +
    '<div class="grid g2"><section class="card"><header><h2>Upcoming writing deadlines</h2></header>' + (dl.length ? '<div class="list">' + dl.map(d => '<div class="li"><a href="#" class="t" data-act="edit" data-col="manuscripts" data-id="' + d.m.id + '">' + esc(d.label) + '</a><div class="m">' + C.fmtDate(d.date) + '</div></div>').join('') + '</div>' : '<div class="small muted">No deadlines in the next 60 days.</div>') + '</section>' +
    '<section class="card"><header><h2>Open writing & revision tasks</h2><button class="btn sm" data-act="new" data-col="tasks" data-focus="Paper Writing">' + ICON.plus + ' Task</button></header>' + (writeTasks.length ? '<div class="list">' + writeTasks.map(t => '<div class="li"><div class="row between"><a href="#" class="t" data-act="edit" data-col="tasks" data-id="' + t.id + '">' + esc(t.title) + '</a>' + statusPill(t.status) + '</div><div class="m">' + (t.dueDate ? 'Due ' + C.fmtDate(t.dueDate) : 'No due date') + '</div></div>').join('') + '</div>' : '<div class="small muted">None. Tasks linked to a manuscript or in the Paper Writing focus area appear here.</div>') + '</section></div>' + cards;
}

function viewMeetings() {
  const s = Store.state(); const M = U.meet; const today = C.todayISO();
  const meets = C.live(s.meetings).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const tabs = '<div class="tabs" role="tablist">' + [['list', 'Meeting records'], ['prep', 'Prepare for next meeting']].map(([k, l]) => '<button role="tab" aria-selected="' + (M.tab === k) + '" data-act="meet-tab" data-tab="' + k + '">' + l + '</button>').join('') + '</div>';
  let body;
  if (M.tab === 'prep') {
    const last = meets.find(m => m.date && m.date <= today); const since = last ? last.date : C.addDays(today, -13);
    const from = C.addDays(since, last ? 1 : 0);
    const logs = C.filterLogs(s, { from, to: today }); const sum = C.summarizeLogs(s, logs);
    const outs = logs.filter(l => l.output); const doneT = C.live(s.tasks).filter(t => C.isDone(t.status) && C.inRange(t.completedDate, from, today));
    const blockers = logs.filter(l => l.blockers).map(l => ({ col: 'logs', id: l.id, t: l.blockers, m: 'Log ' + C.fmtDate(l.date) })).concat(C.live(s.tasks).filter(t => t.status === 'Blocked').map(t => ({ col: 'tasks', id: t.id, t: t.title + (t.blocker ? ' — ' + t.blocker : ''), m: 'Blocked task' })));
    const openActs = C.live(s.tasks).filter(t => t.sourceMeetingId && !C.isDone(t.status));
    const msDone = C.live(s.milestones).filter(m => C.isDone(m.status) && C.inRange(m.completedDate, from, today));
    const exps = C.live(s.experiments).filter(e => C.inRange(e.endDate || e.startDate, from, today));
    const papers = C.papersFullyRead(s, from, today);
    body = '<div class="note">' + (last ? 'Since the last meeting on <b>' + C.fmtDate(last.date) + '</b>' : 'No previous meeting recorded; showing the last 14 days') + ' (' + C.fmtDate(from) + ' – ' + C.fmtDate(today) + ').' + (last && last.nextDate ? ' Next meeting planned for <b>' + C.fmtDate(last.nextDate) + '</b>.' : '') + '</div>' +
      '<section class="kpis"><div class="kpi" data-tilt><div class="l">Hours logged</div><div class="v">' + fmtH(sum.totalHours) + '<small>h</small></div><div class="s">Research ' + fmtH(sum.byKind.research) + ' h</div></div><div class="kpi"><div class="l">Days worked</div><div class="v">' + sum.days + '</div></div><div class="kpi"><div class="l">Outputs</div><div class="v">' + outs.length + '</div></div><div class="kpi"><div class="l">Tasks completed</div><div class="v">' + doneT.length + '</div></div><div class="kpi"><div class="l">Papers fully read</div><div class="v">' + papers.length + '</div></div><div class="kpi"><div class="l">Experiments run</div><div class="v">' + exps.length + '</div></div></section>' +
      '<div class="grid g2">' + '<section class="card">' + attnList('Completed outputs', outs.map(l => ({ col: 'logs', id: l.id, t: l.output, m: C.fmtDate(l.date) + ' · ' + trunc(l.what, 70) })).concat(doneT.map(t => ({ col: 'tasks', id: t.id, t: 'Task done: ' + t.title, m: C.fmtDate(t.completedDate) }))).concat(msDone.map(m => ({ col: 'milestones', id: m.id, t: 'Milestone: ' + m.title, m: C.fmtDate(m.completedDate) }))), 'No outputs recorded in this window.') + '</section>' +
      '<section class="card">' + attnList('Unresolved blockers', blockers, 'No blockers recorded.') + '</section>' +
      '<section class="card">' + attnList('Open actions from earlier meetings', openActs.map(t => ({ col: 'tasks', id: t.id, t: t.title, m: (t.owner ? t.owner + ' · ' : '') + (t.dueDate ? 'due ' + C.fmtDate(t.dueDate) : 'no deadline'), pill: t.status })), 'All agreed actions are done.') + '</section>' +
      '<section class="card">' + attnList('Unresolved questions from last meeting', last && last.questions ? last.questions.split(/\n+/).filter(Boolean).map(q => ({ col: 'meetings', id: last.id, t: q, m: C.fmtDate(last.date) })) : [], 'None recorded.') + '</section></div>' +
      '<div class="row"><button class="btn primary" data-act="new-meeting-prefill">Start meeting record with this summary</button></div>';
  } else body = meets.length ? '<div class="grid" style="gap:12px">' + meets.map(m => { const acts = m.actions || []; const linked = acts.filter(a => a.taskId && Store.get('tasks', a.taskId));
    return '<section class="card"><header><div><span class="eyebrow">' + C.dayName(m.date) + '</span><a href="#" data-act="edit" data-col="meetings" data-id="' + m.id + '"><h3>' + C.fmtDate(m.date) + (m.participants ? ' · ' + esc(m.participants) : '') + '</h3></a></div>' + (m.nextDate ? '<span class="small muted">Next: ' + C.fmtDate(m.nextDate) + '</span>' : '') + '</header>' +
      '<dl class="det" style="background:none;padding:0">' + [['Agenda', m.agenda], ['Progress discussed', m.progress], ['Feedback', m.feedback], ['Decisions', m.decisions], ['Unresolved questions', m.questions]].filter(x => x[1]).map(x => '<div><dt>' + x[0] + '</dt><dd style="white-space:pre-line">' + esc(x[1]) + '</dd></div>').join('') + '</dl>' +
      (acts.length ? '<h3 style="margin:10px 0 4px">Agreed actions</h3><div class="list">' + acts.map((a, i) => { const t = a.taskId && Store.get('tasks', a.taskId);
        return '<div class="li"><div class="row between"><span>' + esc(a.text || '(blank action)') + '</span>' + (t ? '<a href="#" data-act="edit" data-col="tasks" data-id="' + t.id + '">' + statusPill(t.status) + '</a>' : '<button class="btn sm" data-act="action-task" data-id="' + m.id + '" data-i="' + i + '">Make task</button>') + '</div><div class="m">' + (a.owner ? 'Owner: ' + esc(a.owner) : 'No owner') + ' · ' + (a.due ? 'Due ' + C.fmtDate(a.due) : 'No deadline') + '</div></div>'; }).join('') + '</div>' + (acts.length > linked.length ? '<button class="btn sm" style="margin-top:6px" data-act="actions-all" data-id="' + m.id + '">Turn all ' + (acts.length - linked.length) + ' remaining action(s) into tasks</button>' : '') : '') + '</section>'; }).join('') + '</div>'
    : '<div class="empty"><b>No meetings recorded</b>Record supervisor and committee meetings; agreed actions become linked tasks.</div>';
  return '<div class="page-head"><div><h1>Supervisor meetings</h1><p>Feedback, decisions and follow-ups. Agreed actions become tasks with owners and deadlines.</p></div><button class="btn primary" data-act="new" data-col="meetings">' + ICON.plus + ' Meeting</button></div>' + tabs + body;
}
function actionToTask(meetId, i) {
  const m = Store.get('meetings', meetId); if (!m) return null; const a = (m.actions || [])[i]; if (!a || (a.taskId && Store.get('tasks', a.taskId))) return null;
  const t = { title: a.text || 'Meeting action', owner: a.owner || '', dueDate: a.due || null, status: 'Planned', priority: 'Medium', focus: 'Admin / Meetings', sourceMeetingId: m.id, notes: 'Agreed at meeting on ' + C.fmtDate(m.date) };
  Store.put('tasks', t); a.taskId = t.id; Store.put('meetings', m); return t;
}
