/* ===== Google Sheets template + sync mapping (shared by the web app and the setup script) ===== */
(function (root) {
'use strict';
const C = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root.Core;
const KIND_LABEL = { research: 'Research', teaching: 'Teaching', admin: 'Administration', other: 'Other' };
const HEADER_ROW = 3, FIRST = 4; // row 1 title, row 2 note, row 3 headers, data from row 4

/** Guard text so Sheets keeps it as text (no accidental formulas, numbers or dates). */
function txt(v) {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  if (!s) return '';
  if (/^[=+\-@]/.test(s) || /^\s*[\d.,/:\- ]+\s*$/.test(s) || /^\d/.test(s) && !isNaN(Date.parse(s))) return "'" + s;
  return s;
}
const num = v => (typeof v === 'number' && isFinite(v)) ? v : '';
const date = v => (C.isISO(v) ? v : '');
const byId = (arr, id) => (arr || []).find(x => x.id === id);

/* Tab definitions. `get(r, ctx, rowNo)` returns the cell value; a string starting with "=" is written as a formula. */
const TABS = [
  { title: 'Dashboard', sheetId: 0, color: '#1667D9', dashboard: true },
  { title: 'Daily Log', sheetId: 101, color: '#3D8BFF', col: 'logs', note: 'One row per work session. Day and Kind are calculated.', cols: [
    ['ID', 120, 'id', r => txt(r.id)],
    ['Date', 100, 'date', r => date(r.date)],
    ['Day', 50, 'calc', (r, c, n) => '=IF(B' + n + '="","",TEXT(B' + n + ',"ddd"))'],
    ['Focus Area', 210, 'text', r => txt(r.focus)],
    ['Kind', 110, 'calc', (r, c, n) => '=IFERROR(VLOOKUP(D' + n + ',Lists!$A$4:$B,2,FALSE),"")'],
    ['Task Type', 150, 'text', r => txt(r.taskType)],
    ['What I Worked On', 320, 'wrap', r => txt(r.what)],
    ['Hours', 70, 'num', r => num(r.hours)],
    ['Status', 100, 'status', r => txt(r.status)],
    ['Output / Deliverable', 200, 'wrap', r => txt(r.output)],
    ['Papers Read', 80, 'num', r => num(r.papersRead)],
    ['Blockers / Issues', 220, 'wrap', r => txt(r.blockers)],
    ['Next Step', 220, 'wrap', r => txt(r.nextStep)],
    ['Productivity (1–5)', 100, 'num', r => num(r.productivity)],
    ['Linked task', 200, 'text', (r, c) => txt((byId(c.s.tasks, (r.links || {}).taskId) || {}).title)],
    ['Linked experiment', 160, 'text', (r, c) => { const e = byId(c.s.experiments, (r.links || {}).experimentId); return txt(e ? (e.expId || e.title) : ''); }],
    ['Linked paper', 200, 'text', (r, c) => txt((byId(c.s.papers, (r.links || {}).paperId) || {}).title)],
    ['Linked manuscript', 200, 'text', (r, c) => txt((byId(c.s.manuscripts, (r.links || {}).manuscriptId) || {}).title)],
    ['Output link', 200, 'text', r => txt((r.links || {}).outputUrl)],
  ], sort: (a, b) => (a.date || '').localeCompare(b.date || '') || (a.createdAt || '').localeCompare(b.createdAt || '') },
  { title: 'Tasks', sheetId: 102, color: '#22B07D', col: 'tasks', note: 'Actual effort is summed from Daily Log rows linked to the task.', cols: [
    ['ID', 120, 'id', r => txt(r.id)],
    ['Task', 280, 'wrap', r => txt(r.title)],
    ['Objective', 80, 'text', (r, c) => txt((byId(c.s.objectives, r.objectiveId) || {}).code)],
    ['Focus Area', 190, 'text', r => txt(r.focus)],
    ['Priority', 80, 'text', r => txt(r.priority)],
    ['Status', 100, 'status', r => txt(r.status)],
    ['Due date', 100, 'date', r => date(r.dueDate)],
    ['Planned effort (h)', 100, 'num', r => num(r.estHours)],
    ['Actual effort (h)', 100, 'calc', (r, c, n) => "=SUMIFS('Daily Log'!$H$4:$H,'Daily Log'!$O$4:$O,B" + n + ')'],
    ['Depends on', 200, 'wrap', (r, c) => txt((r.dependsOn || []).map(id => (byId(c.s.tasks, id) || {}).title).filter(Boolean))],
    ['Blocker', 200, 'wrap', r => txt(r.blocker)],
    ['Next action', 220, 'wrap', r => txt(r.nextAction)],
    ['Owner', 110, 'text', r => txt(r.owner)],
    ['Completed on', 100, 'date', r => date(r.completedDate)],
    ['Overdue?', 80, 'calc', (r, c, n) => '=IF(AND(G' + n + '<>"",F' + n + '<>"Done",G' + n + '<TODAY()),"Overdue","")'],
  ], sort: (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999') },
  { title: 'Objectives', sheetId: 103, color: '#1667D9', col: 'objectives', note: 'Progress = completed milestones ÷ confirmed milestones. Hours are effort, shown separately.', cols: [
    ['Code', 60, 'text', r => txt(r.code)],
    ['Objective', 320, 'wrap', r => txt(r.title)],
    ['Linked focus area', 210, 'text', r => txt(r.focus)],
    ['Description', 240, 'wrap', r => txt(r.description)],
    ['Expected contribution', 240, 'wrap', r => txt(r.contribution)],
    ['Success criteria', 240, 'wrap', r => txt(r.successCriteria)],
    ['Evidence', 240, 'wrap', r => txt(r.evidence)],
    ['Confirmed milestones', 100, 'calc', (r, c, n) => '=COUNTIFS(Milestones!$D$4:$D,A' + n + ',Milestones!$H$4:$H,"Confirmed")'],
    ['Milestones done', 100, 'calc', (r, c, n) => '=COUNTIFS(Milestones!$D$4:$D,A' + n + ',Milestones!$H$4:$H,"Confirmed",Milestones!$F$4:$F,"Done")'],
    ['Progress', 100, 'pct', (r, c, n) => '=IF(H' + n + '=0,"Unavailable",I' + n + '/H' + n + ')'],
    ['Hours logged', 100, 'calc', (r, c, n) => "=SUMIFS('Daily Log'!$H$4:$H,'Daily Log'!$D$4:$D,C" + n + ')'],
  ], sort: (a, b) => (a.code || '').localeCompare(b.code || '') },
  { title: 'Milestones', sheetId: 104, color: '#F5C04D', col: 'milestones', note: 'Suggested milestones are not counted in progress until you confirm them in the tracker.', cols: [
    ['ID', 120, 'id', r => txt(r.id)],
    ['Milestone', 260, 'wrap', r => txt(r.title)],
    ['Type', 160, 'text', r => txt(r.kind)],
    ['Objective', 80, 'text', (r, c) => txt((byId(c.s.objectives, r.objectiveId) || {}).code || 'Programme')],
    ['Target date', 100, 'date', r => date(r.targetDate)],
    ['Status', 100, 'status', r => txt(r.status)],
    ['Completed on', 100, 'date', r => date(r.completedDate)],
    ['Confirmed?', 100, 'text', r => r.template ? 'Suggested' : 'Confirmed'],
    ['Deliverable', 200, 'wrap', r => txt(r.deliverable)],
    ['Success criteria', 220, 'wrap', r => txt(r.criteria)],
    ['Evidence', 220, 'wrap', r => txt(r.evidence)],
  ], sort: (a, b) => (a.targetDate || '9999').localeCompare(b.targetDate || '9999') },
  { title: 'Literature', sheetId: 105, color: '#8CC6FF', col: 'papers', note: 'A paper counts as fully read only when Reading status is Read.', cols: [
    ['ID', 120, 'id', r => txt(r.id)],
    ['Date Read', 100, 'date', r => date(r.dateRead)],
    ['Title', 300, 'wrap', r => txt(r.title)],
    ['Authors', 220, 'wrap', r => txt(r.authors)],
    ['Venue / Year', 140, 'text', r => txt(r.venueYear)],
    ['Relevant Objective', 120, 'text', r => txt(r.objective)],
    ['Reading status', 110, 'status', r => txt(r.readingStatus)],
    ['Key Idea', 260, 'wrap', r => txt(r.keyIdea)],
    ['Method / Dataset', 220, 'wrap', r => txt(r.methodDataset)],
    ['Main findings', 240, 'wrap', r => txt(r.findings)],
    ['Limitation / Gap', 220, 'wrap', r => txt(r.limitation)],
    ['Use in My Work', 220, 'wrap', r => txt(r.useInWork)],
    ['Cite? (Y/N)', 70, 'text', r => txt(r.cite)],
    ['Keywords', 160, 'text', r => txt(r.keywords)],
    ['DOI', 160, 'text', r => txt(r.doi)],
    ['URL', 180, 'text', r => txt(r.url)],
    ['PDF', 180, 'text', r => txt(r.pdf)],
    ['Research question', 220, 'wrap', r => txt(r.researchQuestion)],
    ['Personal notes', 220, 'wrap', r => txt(r.notes)],
  ], sort: (a, b) => (b.dateRead || '').localeCompare(a.dateRead || '') },
  { title: 'Research Gaps', sheetId: 106, color: '#E8774A', col: 'gaps', note: 'Each gap linked to supporting papers and a possible experiment.', cols: [
    ['ID', 120, 'id', r => txt(r.id)],
    ['Gap', 260, 'wrap', r => txt(r.title)],
    ['Objective', 80, 'text', (r, c) => txt((byId(c.s.objectives, r.objectiveId) || {}).code)],
    ['Status', 110, 'status', r => txt(r.status)],
    ['Description', 260, 'wrap', r => txt(r.description)],
    ['Supporting papers', 280, 'wrap', (r, c) => txt((r.paperIds || []).map(id => (byId(c.s.papers, id) || {}).title).filter(Boolean))],
    ['Possible experiment', 200, 'text', (r, c) => { const e = byId(c.s.experiments, r.experimentId); return txt(e ? (e.expId ? e.expId + ' · ' : '') + (e.title || '') : ''); }],
    ['Experiment idea', 240, 'wrap', r => txt(r.experimentIdea)],
  ] },
  { title: 'Experiments', sheetId: 107, color: '#3D8BFF', col: 'experiments', note: 'Failed runs and negative findings are kept. Compare runs only when dataset, version, split and evaluation setting match.', cols: [
    ['ID', 120, 'id', r => txt(r.id)],
    ['Exp ID', 90, 'text', r => txt(r.expId)],
    ['Title', 240, 'wrap', r => txt(r.title)],
    ['Objective', 80, 'text', (r, c) => txt((byId(c.s.objectives, r.objectiveId) || {}).code)],
    ['Status', 100, 'status', r => txt(r.status)],
    ['Hypothesis', 240, 'wrap', r => txt(r.hypothesis)],
    ['Baseline', 160, 'text', r => txt(r.baseline)],
    ['Model', 140, 'text', r => txt(r.model)],
    ['Model version', 120, 'text', r => txt(r.modelVersion)],
    ['Dataset', 160, 'text', (r, c) => txt((byId(c.s.datasets, r.datasetId) || {}).name)],
    ['Dataset version', 100, 'text', r => txt(r.datasetVersion)],
    ['Split', 120, 'text', r => txt(r.split)],
    ['Evaluation setting', 140, 'text', r => txt(r.evalSetting)],
    ['Seed', 70, 'text', r => txt(r.seed)],
    ['Run start', 100, 'date', r => date(r.startDate)],
    ['Run end', 100, 'date', r => date(r.endDate)],
    ['Compute (GPU h)', 90, 'num', r => num(r.computeHours)],
    ['Metrics', 260, 'wrap', r => txt((r.metrics || []).filter(m => m.name).map(m => m.name + ' = ' + (C.isNum(m.value) ? m.value : 'not recorded') + (m.unit ? ' ' + m.unit : '') + (m.better === 'lower' ? ' (lower is better)' : ' (higher is better)')))],
    ['Results', 240, 'wrap', r => txt(r.results)],
    ['Observations', 240, 'wrap', r => txt(r.observations)],
    ['Failures / negative findings', 240, 'wrap', r => txt(r.failures)],
    ['Next steps', 220, 'wrap', r => txt(r.nextSteps)],
    ['Repository', 180, 'text', r => txt(r.repo)],
    ['Commit', 100, 'text', r => txt(r.commit)],
    ['Output location', 200, 'text', r => txt(r.outputs)],
  ], sort: (a, b) => (a.startDate || a.createdAt || '').localeCompare(b.startDate || b.createdAt || '') },
  { title: 'Datasets', sheetId: 108, color: '#22B07D', col: 'datasets', note: 'Large datasets and checkpoints are recorded by location only.', cols: [
    ['ID', 120, 'id', r => txt(r.id)],
    ['Dataset', 180, 'text', r => txt(r.name)],
    ['Version', 90, 'text', r => txt(r.version)],
    ['Source', 220, 'wrap', r => txt(r.source)],
    ['Access / licence', 200, 'wrap', r => txt(r.access)],
    ['Annotations', 220, 'wrap', r => txt(r.annotations)],
    ['Preparation status', 130, 'status', r => txt(r.status)],
    ['Location', 200, 'text', r => txt(r.location)],
    ['Linked experiments', 180, 'text', (r, c) => txt(C.live(c.s.experiments).filter(e => e.datasetId === r.id).map(e => e.expId || e.title))],
    ['Notes', 220, 'wrap', r => txt(r.notes)],
  ] },
  { title: 'Writing', sheetId: 109, color: '#8CC6FF', col: 'manuscripts', note: 'Manuscripts and thesis chapters with their latest submission.', cols: [
    ['ID', 120, 'id', r => txt(r.id)],
    ['Title', 280, 'wrap', r => txt(r.title)],
    ['Type', 110, 'text', r => txt(r.kind)],
    ['Stage', 120, 'status', r => txt(r.stage)],
    ['Objectives', 100, 'text', (r, c) => txt((r.objectiveIds || []).map(id => (byId(c.s.objectives, id) || {}).code).filter(Boolean))],
    ['Target venue', 160, 'text', r => txt(r.venue)],
    ['Deadline', 100, 'date', r => date(r.deadline)],
    ['Co-authors', 200, 'wrap', r => txt(r.coauthors)],
    ['Sections done', 90, 'num', r => (r.sections || []).filter(x => x.done).length],
    ['Sections total', 90, 'num', r => (r.sections || []).length],
    ['Latest submission', 110, 'date', r => date(latestSub(r).date)],
    ['Manuscript ID', 120, 'text', r => txt(latestSub(r).msId)],
    ['Editorial status', 140, 'text', r => txt(latestSub(r).status)],
    ['Revision due', 100, 'date', r => date(latestSub(r).revisionDeadline)],
    ['Reviewer feedback', 240, 'wrap', r => txt(latestSub(r).feedback)],
    ['Draft links', 220, 'wrap', r => txt(r.draftLinks)],
  ], sort: (a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999') },
  { title: 'Meetings', sheetId: 110, color: '#F5C04D', col: 'meetings', note: 'Supervisor and committee meetings with agreed actions.', cols: [
    ['ID', 120, 'id', r => txt(r.id)],
    ['Date', 100, 'date', r => date(r.date)],
    ['Participants', 180, 'wrap', r => txt(r.participants)],
    ['Agenda', 220, 'wrap', r => txt(r.agenda)],
    ['Progress discussed', 240, 'wrap', r => txt(r.progress)],
    ['Feedback', 240, 'wrap', r => txt(r.feedback)],
    ['Decisions', 220, 'wrap', r => txt(r.decisions)],
    ['Unresolved questions', 220, 'wrap', r => txt(r.questions)],
    ['Agreed actions', 280, 'wrap', r => txt((r.actions || []).filter(a => a.text).map(a => a.text + (a.owner ? ' (' + a.owner + ')' : '') + (a.due ? ', due ' + C.fmtDate(a.due) : '')))],
    ['Next meeting', 100, 'date', r => date(r.nextDate)],
  ], sort: (a, b) => (a.date || '').localeCompare(b.date || '') },
  { title: 'Lists', sheetId: 111, color: '#6C7C96', lists: true, note: 'Categories from the tracker. Kind keeps research hours separate from teaching and administration.' },
];
function latestSub(m) { return (m.submissions || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))[0] || {}; }
function colLetter(i) { let s = ''; i++; while (i) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }

/** Rows for every data tab, from the tracker state. */
function buildData(s) {
  const ctx = { s };
  const out = {};
  for (const t of TABS) {
    if (t.dashboard) continue;
    if (t.lists) {
      const st = s.settings; const fa = st.focusAreas || [];
      const lists = [st.taskTypes, st.statuses, st.readingStatuses, st.writingStages];
      const n = Math.max(fa.length, ...lists.map(l => (l || []).length));
      const rows = [];
      for (let i = 0; i < n; i++) { const f = fa[i];
        rows.push([f ? txt(f.name) : '', f ? KIND_LABEL[f.kind] || 'Other' : '', f ? txt((byId(s.objectives, f.objectiveId) || {}).code) : '', '', txt((st.taskTypes || [])[i]), '', txt((st.statuses || [])[i]), '', txt((st.readingStatuses || [])[i]), '', txt((st.writingStages || [])[i])]); }
      out[t.title] = rows; continue;
    }
    let recs = C.live(s[t.col]); if (t.sort) recs = recs.slice().sort(t.sort);
    out[t.title] = recs.map((r, i) => t.cols.map(c => c[3](r, ctx, FIRST + i)));
  }
  return out;
}

/* ---------- template: header block, dashboard formulas, formatting ---------- */
const HEX = h => ({ red: parseInt(h.slice(1, 3), 16) / 255, green: parseInt(h.slice(3, 5), 16) / 255, blue: parseInt(h.slice(5, 7), 16) / 255 });
const NAVY = '#0E2A57', BLUE = '#1667D9', PALE = '#EEF3FA', LINE = '#D0DBEC', INK = '#0E1B33', MUTED = '#5D6F8F', FONT = 'IBM Plex Sans';
function headerValues(t) {
  if (t.lists) return [['Lists', null, null], [t.note, null, null], ['Focus area', 'Kind', 'Objective', '', 'Task types', '', 'Task statuses', '', 'Reading statuses', '', 'Writing stages']];
  return [[t.title, null], [t.note, null], t.cols.map(c => c[0])];
}
const DL = "'Daily Log'!";
function dashboardValues() {
  const H = DL + '$H$4:$H', B = DL + '$B$4:$B', E = DL + '$E$4:$E', D = DL + '$D$4:$D';
  const g = []; const put = (r, c, v) => { while (g.length < r) g.push([]); const row = g[r - 1]; while (row.length < c) row.push(null); row[c - 1] = v; };
  put(1, 1, 'PhD Research Tracker'); put(2, 1, 'Explainable VLMs for Autonomous Driving. Not synced yet.');
  put(4, 1, 'Effort'); put(4, 2, 'Value'); put(4, 3, 'How it is calculated');
  const eff = [
    ['Total hours logged', '=SUM(' + H + ')', 'Sum of Hours over all sessions'],
    ['Sessions logged', '=COUNTA(' + DL + '$A$4:$A)', 'One row per work session'],
    ['Days worked', '=COUNTUNIQUE(' + B + ')', 'Each date counted once'],
    ['Average hours per working day', '=IF(B7=0,"-",B5/B7)', 'Total hours ÷ days worked'],
    ['Sessions without hours', '=COUNTIFS(' + DL + '$A$4:$A,"<>",' + H + ',"")', 'Not counted as zero'],
    ['Research hours', '=SUMIFS(' + H + ',' + E + ',"Research")', 'Kind from the Lists tab'],
    ['Teaching hours', '=SUMIFS(' + H + ',' + E + ',"Teaching")', ''],
    ['Administration hours', '=SUMIFS(' + H + ',' + E + ',"Administration")', ''],
    ['Other hours', '=SUMIFS(' + H + ',' + E + ',"Other")', ''],
    ['Hours today', '=SUMIFS(' + H + ',' + B + ',TODAY())', 'Live, uses today’s date'],
    ['Hours this week', '=SUMIFS(' + H + ',' + B + ',">="&(TODAY()-WEEKDAY(TODAY(),3)),' + B + ',"<="&TODAY())', 'Week starts Monday'],
    ['Hours this month', '=SUMIFS(' + H + ',' + B + ',">="&(EOMONTH(TODAY(),-1)+1),' + B + ',"<="&EOMONTH(TODAY(),0))', ''],
    ['Average productivity (self-reported, 1–5)', '=IFERROR(AVERAGE(' + DL + '$N$4:$N),"-")', 'Rated sessions only'],
  ];
  eff.forEach((r, i) => { put(5 + i, 1, r[0]); put(5 + i, 2, r[1]); put(5 + i, 3, r[2]); });
  put(4, 5, 'Tasks by status'); put(4, 6, 'Count');
  ['Planned', 'In Progress', 'Blocked', 'Done'].forEach((st, i) => { put(5 + i, 5, st); put(5 + i, 6, '=COUNTIF(Tasks!$F$4:$F,E' + (5 + i) + ')'); });
  put(9, 5, 'Overdue tasks'); put(9, 6, '=COUNTIF(Tasks!$O$4:$O,"Overdue")');
  put(11, 5, 'Outputs'); put(11, 6, 'Count');
  [['Papers fully read (status Read)', '=COUNTIF(Literature!$G$4:$G,"Read")'], ['Papers in library', '=COUNTA(Literature!$A$4:$A)'], ['Log “Papers Read” field (separate)', '=SUM(' + DL + '$K$4:$K)'],
   ['Experiments completed', '=COUNTIF(Experiments!$E$4:$E,"Completed")'], ['Experiments recorded', '=COUNTA(Experiments!$A$4:$A)'], ['Manuscripts and chapters', '=COUNTA(Writing!$A$4:$A)']]
    .forEach((r, i) => { put(12 + i, 5, r[0]); put(12 + i, 6, r[1]); });
  put(4, 8, 'Objective progress'); put(4, 9, 'Confirmed milestones'); put(4, 10, 'Done'); put(4, 11, 'Progress'); put(4, 12, 'Hours logged');
  for (let i = 0; i < 6; i++) { const r = 4 + i, rr = 5 + i; put(rr, 8, '=IF(Objectives!A' + r + '="","",Objectives!A' + r + ')'); put(rr, 9, '=IF(H' + rr + '="","",Objectives!H' + r + ')'); put(rr, 10, '=IF(H' + rr + '="","",Objectives!I' + r + ')'); put(rr, 11, '=IF(H' + rr + '="","",Objectives!J' + r + ')'); put(rr, 12, '=IF(H' + rr + '="","",Objectives!K' + r + ')'); }
  put(20, 1, 'Focus area'); put(20, 2, 'Kind'); put(20, 3, 'Hours'); put(20, 4, 'Share');
  for (let i = 0; i < 12; i++) { const r = 21 + i, l = 4 + i; put(r, 1, '=IF(Lists!A' + l + '="","",Lists!A' + l + ')'); put(r, 2, '=IF(A' + r + '="","",Lists!B' + l + ')'); put(r, 3, '=IF(A' + r + '="","",SUMIFS(' + H + ',' + D + ',A' + r + '))'); put(r, 4, '=IF(OR(A' + r + '="",$B$5=0),"",C' + r + '/$B$5)'); }
  put(19, 1, 'Hours by focus area'); put(19, 6, 'Weekly hours, last 12 weeks');
  put(20, 6, 'Week starting'); ['Research', 'Teaching', 'Administration', 'Other'].forEach((k, j) => put(20, 7 + j, k));
  for (let i = 0; i < 12; i++) { const r = 21 + i; put(r, 6, '=TODAY()-WEEKDAY(TODAY(),3)-7*(ROW($F$32)-ROW())');
    for (let j = 0; j < 4; j++) { const L = colLetter(6 + j); put(r, 7 + j, '=SUMIFS(' + H + ',' + B + ',">="&$F' + r + ',' + B + ',"<"&($F' + r + '+7),' + E + ',' + L + '$20)'); } }
  return g;
}
function gr(sheetId, r0, r1, c0, c1) { const o = { sheetId, startRowIndex: r0 }; if (r1 != null) o.endRowIndex = r1; o.startColumnIndex = c0; o.endColumnIndex = c1; return o; }
function fmtCell(f) { return { userEnteredFormat: f }; }
function formatRequests(t, isNew) {
  const id = t.sheetId; const req = [];
  const ncols = t.dashboard ? 12 : t.lists ? 11 : t.cols.length;
  req.push({ repeatCell: { range: { sheetId: id }, cell: fmtCell({ textFormat: { fontFamily: FONT, fontSize: 10, foregroundColor: HEX(INK) }, verticalAlignment: 'TOP' }), fields: 'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.fontSize,userEnteredFormat.textFormat.foregroundColor,userEnteredFormat.verticalAlignment' } });
  req.push({ repeatCell: { range: gr(id, 0, 1, 0, 1), cell: fmtCell({ textFormat: { fontFamily: FONT, fontSize: 18, bold: true, foregroundColor: HEX(BLUE) } }), fields: 'userEnteredFormat.textFormat' } });
  req.push({ repeatCell: { range: gr(id, 1, 2, 0, 1), cell: fmtCell({ textFormat: { fontFamily: FONT, fontSize: 10, italic: true, foregroundColor: HEX(MUTED) } }), fields: 'userEnteredFormat.textFormat' } });
  req.push({ updateDimensionProperties: { range: { sheetId: id, dimension: 'ROWS', startIndex: 0, endIndex: 1 }, properties: { pixelSize: 40 }, fields: 'pixelSize' } });
  req.push({ updateSheetProperties: { properties: { sheetId: id, gridProperties: { hideGridlines: true, frozenRowCount: t.dashboard ? 0 : 3 }, tabColorStyle: { rgbColor: HEX(t.color) } }, fields: 'gridProperties.hideGridlines,gridProperties.frozenRowCount,tabColorStyle' } });
  const head = (r0, c0, c1) => req.push({ repeatCell: { range: gr(id, r0, r0 + 1, c0, c1), cell: fmtCell({ backgroundColorStyle: { rgbColor: HEX(NAVY) }, textFormat: { fontFamily: FONT, bold: true, foregroundColor: HEX('#FFFFFF') }, verticalAlignment: 'MIDDLE', wrapStrategy: 'WRAP' }), fields: 'userEnteredFormat.backgroundColorStyle,userEnteredFormat.textFormat,userEnteredFormat.verticalAlignment,userEnteredFormat.wrapStrategy' } });
  const band = (r0, r1, c0, c1) => req.push({ addBanding: { bandedRange: { range: gr(id, r0, r1, c0, c1), rowProperties: { headerColorStyle: { rgbColor: HEX(NAVY) }, firstBandColorStyle: { rgbColor: HEX('#FFFFFF') }, secondBandColorStyle: { rgbColor: HEX(PALE) } } } } });
  const width = (c, px) => req.push({ updateDimensionProperties: { range: { sheetId: id, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 }, properties: { pixelSize: px }, fields: 'pixelSize' } });
  const numfmt = (range, type, pattern) => req.push({ repeatCell: { range, cell: fmtCell({ numberFormat: { type, pattern } }), fields: 'userEnteredFormat.numberFormat' } });
  if (t.dashboard) {
    [[3, 0, 3], [3, 4, 6], [3, 7, 12], [19, 0, 4], [19, 5, 10]].forEach(([r, a, b]) => head(r, a, b));
    [[18, 0], [18, 5]].forEach(([r, c]) => req.push({ repeatCell: { range: gr(id, r, r + 1, c, c + 1), cell: fmtCell({ textFormat: { fontFamily: FONT, fontSize: 12, bold: true, foregroundColor: HEX(BLUE) } }), fields: 'userEnteredFormat.textFormat' } }));
    req.push({ repeatCell: { range: gr(id, 4, 17, 1, 2), cell: fmtCell({ textFormat: { fontFamily: FONT, fontSize: 11, bold: true, foregroundColor: HEX(BLUE) }, horizontalAlignment: 'RIGHT' }), fields: 'userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment' } });
    numfmt(gr(id, 4, 17, 1, 2), 'NUMBER', '#,##0.##');
    req.push({ repeatCell: { range: gr(id, 4, 17, 2, 3), cell: fmtCell({ textFormat: { fontFamily: FONT, fontSize: 9, italic: true, foregroundColor: HEX(MUTED) } }), fields: 'userEnteredFormat.textFormat' } });
    req.push({ repeatCell: { range: gr(id, 4, 18, 5, 6), cell: fmtCell({ textFormat: { fontFamily: FONT, fontSize: 11, bold: true, foregroundColor: HEX(BLUE) }, horizontalAlignment: 'RIGHT' }), fields: 'userEnteredFormat.textFormat,userEnteredFormat.horizontalAlignment' } });
    numfmt(gr(id, 4, 10, 10, 11), 'PERCENT', '0%'); numfmt(gr(id, 4, 10, 11, 12), 'NUMBER', '#,##0.##');
    numfmt(gr(id, 20, 32, 2, 3), 'NUMBER', '#,##0.##'); numfmt(gr(id, 20, 32, 3, 4), 'PERCENT', '0%');
    numfmt(gr(id, 20, 32, 5, 6), 'DATE', 'd mmm yyyy'); numfmt(gr(id, 20, 32, 6, 10), 'NUMBER', '#,##0.##');
    [[0, 300], [1, 90], [2, 200], [3, 70], [4, 230], [5, 100], [6, 90], [7, 110], [8, 100], [9, 120], [10, 90], [11, 100]].forEach(([c, w]) => width(c, w));
    if (isNew) {
      req.push({ addChart: { chart: { spec: { title: 'Weekly hours by kind of work', basicChart: { chartType: 'COLUMN', stackedType: 'STACKED', legendPosition: 'BOTTOM_LEGEND', headerCount: 1,
        axis: [{ position: 'BOTTOM_AXIS', title: 'Week starting' }, { position: 'LEFT_AXIS', title: 'Hours' }],
        domains: [{ domain: { sourceRange: { sources: [gr(id, 19, 32, 5, 6)] } } }],
        series: ['#2A78D6', '#E0632F', '#14996A', '#8A98AD'].map((cHex, j) => ({ series: { sourceRange: { sources: [gr(id, 19, 32, 6 + j, 7 + j)] } }, targetAxis: 'LEFT_AXIS', colorStyle: { rgbColor: HEX(cHex) } })) } },
        position: { overlayPosition: { anchorCell: { sheetId: id, rowIndex: 34, columnIndex: 5 }, widthPixels: 620, heightPixels: 340 } } } } });
      req.push({ addChart: { chart: { spec: { title: 'Hours by focus area', basicChart: { chartType: 'BAR', legendPosition: 'NO_LEGEND', headerCount: 1,
        domains: [{ domain: { sourceRange: { sources: [gr(id, 19, 32, 0, 1)] } } }],
        series: [{ series: { sourceRange: { sources: [gr(id, 19, 32, 2, 3)] } }, targetAxis: 'BOTTOM_AXIS', colorStyle: { rgbColor: HEX(BLUE) } }] } },
        position: { overlayPosition: { anchorCell: { sheetId: id, rowIndex: 34, columnIndex: 0 }, widthPixels: 560, heightPixels: 340 } } } } });
    }
    return req;
  }
  if (t.lists) { [0, 1, 2, 4, 6, 8, 10].forEach(c => head(2, c, c + 1)); [[0, 230], [1, 120], [2, 90], [3, 20], [4, 170], [5, 20], [6, 130], [7, 20], [8, 130], [9, 20], [10, 140]].forEach(([c, w]) => width(c, w)); return req; }
  if (isNew) band(2, 2000, 0, ncols); else head(2, 0, ncols);
  req.push({ updateDimensionProperties: { range: { sheetId: id, dimension: 'ROWS', startIndex: 2, endIndex: 3 }, properties: { pixelSize: 34 }, fields: 'pixelSize' } });
  t.cols.forEach((c, i) => {
    width(i, c[1]);
    const rng = gr(id, 3, null, i, i + 1);
    if (c[2] === 'date') numfmt(rng, 'DATE', 'd mmm yyyy');
    else if (c[2] === 'num' || c[2] === 'calc') numfmt(rng, 'NUMBER', '#,##0.##');
    else if (c[2] === 'pct') numfmt(rng, 'PERCENT', '0%');
    else if (c[2] === 'wrap') req.push({ repeatCell: { range: rng, cell: fmtCell({ wrapStrategy: 'WRAP' }), fields: 'userEnteredFormat.wrapStrategy' } });
    else if (c[2] === 'id') req.push({ repeatCell: { range: rng, cell: fmtCell({ textFormat: { fontFamily: 'JetBrains Mono', fontSize: 8, foregroundColor: HEX(MUTED) } }), fields: 'userEnteredFormat.textFormat' } });
    if (c[2] === 'status' && isNew) {
      [['Done|Completed|Read|Ready|Accepted|Published|Addressed', '#DFF3E7', '#0A7D3C'], ['Blocked|Failed|Rejected|Abandoned|Dropped', '#FBE5E5', '#B42D2D'], ['In Progress|Running|Reading|Skimmed|Drafting|Internal Review|Submitted|Under Review|Revision|Investigating|Preparing|Downloading', '#E1ECFB', '#1453AD']]
        .forEach(([words, bg, fg]) => req.push({ addConditionalFormatRule: { rule: { ranges: [rng], booleanRule: { condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=REGEXMATCH(' + colLetter(i) + '4,"^(' + words + ')$")' }] }, format: { backgroundColorStyle: { rgbColor: HEX(bg) }, textFormat: { bold: true, foregroundColorStyle: { rgbColor: HEX(fg) } } } } } } }));
    }
  });
  if (isNew && t.title === 'Tasks') req.push({ addConditionalFormatRule: { rule: { ranges: [gr(id, 3, null, 14, 15)], booleanRule: { condition: { type: 'TEXT_EQ', values: [{ userEnteredValue: 'Overdue' }] }, format: { textFormat: { bold: true, foregroundColorStyle: { rgbColor: HEX('#B42D2D') } } } } } } });
  return req;
}
/** Requests to add any missing tabs (renaming the default first tab to Dashboard on a blank sheet). */
function structureRequests(existing) {
  const titles = new Set(existing.map(e => e.title)); const ids = new Set(existing.map(e => e.sheetId)); const req = []; const created = [];
  TABS.forEach((t, i) => {
    if (titles.has(t.title)) return;
    if (t.dashboard && existing.length === 1 && !titles.has('Dashboard') && /^(Sheet1|Sheet 1|Feuille 1|Tabelle1)$/.test(existing[0].title)) { req.push({ updateSheetProperties: { properties: { sheetId: existing[0].sheetId, title: 'Dashboard', index: 0 }, fields: 'title,index' } }); created.push(Object.assign({}, t, { sheetId: existing[0].sheetId })); return; }
    let sid = t.sheetId; while (ids.has(sid)) sid += 1000; ids.add(sid);
    req.push({ addSheet: { properties: { sheetId: sid, title: t.title, index: i, gridProperties: { rowCount: 2000, columnCount: Math.max(26, t.cols ? t.cols.length : 12) } } } });
    created.push(Object.assign({}, t, { sheetId: sid }));
  });
  return { req, created };
}
function rangeFor(title, rows, ncols) { return "'" + title + "'!A" + FIRST + ':' + colLetter(Math.max(ncols, 1) - 1) + (FIRST + Math.max(rows, 1) - 1); }
const api = { TABS, KIND_LABEL, FIRST, buildData, headerValues, dashboardValues, formatRequests, structureRequests, colLetter, rangeFor, txt };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.SheetSpec = api;
})(typeof window !== 'undefined' ? window : globalThis);
