/* ===== Record schemas + generic drawer editor ===== */
const opt = {
  focus: s => s.settings.focusAreas.map(f => f.name),
  types: s => s.settings.taskTypes,
  statuses: s => s.settings.statuses,
  priorities: s => s.settings.priorities,
  objectives: s => C.live(s.objectives).sort((a, b) => (a.code || '').localeCompare(b.code || '')).map(o => [o.id, o.code + ' — ' + trunc(o.title, 60)]),
  tasks: s => C.live(s.tasks).map(t => [t.id, trunc(t.title, 70) + (t.status === 'Done' ? ' (done)' : '')]),
  milestones: s => C.live(s.milestones).map(m => [m.id, trunc(m.title, 70)]),
  papers: s => C.live(s.papers).map(p => [p.id, trunc(p.title, 70)]),
  experiments: s => C.live(s.experiments).map(e => [e.id, (e.expId ? e.expId + ' · ' : '') + trunc(e.title || 'Untitled', 60)]),
  manuscripts: s => C.live(s.manuscripts).map(m => [m.id, trunc(m.title, 70)]),
  datasets: s => C.live(s.datasets).map(d => [d.id, d.name + (d.version ? ' (' + d.version + ')' : '')]),
  objFocus: s => [['', '—']].concat(s.settings.focusAreas.filter(f => f.objectiveId).map(f => [f.name, f.name])).concat(C.live(s.objectives).map(o => [o.code, o.code])),
};
function trunc(s, n) { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

const SCHEMA = {
  logs: { label: 'work session', fields: [
    { k: 'date', l: 'Date', t: 'date', req: true, hint: 'Day is calculated from the date' },
    { k: 'hours', l: 'Hours', t: 'number', step: 0.25, min: 0, max: 24, hint: 'Leave blank if not tracked' },
    { k: 'focus', l: 'Focus Area', t: 'select', o: opt.focus, req: true },
    { k: 'taskType', l: 'Task Type', t: 'select', o: opt.types, req: true },
    { k: 'what', l: 'What I Worked On', t: 'textarea', req: true, full: true },
    { k: 'status', l: 'Status', t: 'select', o: opt.statuses },
    { k: 'output', l: 'Output / Deliverable', t: 'text' },
    { k: 'papersRead', l: 'Papers Read', t: 'number', step: 1, min: 0, more: true, hint: 'Legacy count; separate from the literature library' },
    { k: 'productivity', l: 'Productivity (1–5, self-reported)', t: 'select', o: () => [['', '—'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']], num: true, more: true },
    { k: 'blockers', l: 'Blockers / Issues', t: 'textarea', more: true, full: true },
    { k: 'nextStep', l: 'Next Step', t: 'text', more: true, full: true },
    { k: 'links.taskId', l: 'Linked task', t: 'select', o: opt.tasks, blank: true, more: true },
    { k: 'links.milestoneId', l: 'Linked milestone', t: 'select', o: opt.milestones, blank: true, more: true },
    { k: 'links.paperId', l: 'Linked paper', t: 'select', o: opt.papers, blank: true, more: true },
    { k: 'links.experimentId', l: 'Linked experiment', t: 'select', o: opt.experiments, blank: true, more: true },
    { k: 'links.manuscriptId', l: 'Linked manuscript', t: 'select', o: opt.manuscripts, blank: true, more: true },
    { k: 'links.outputUrl', l: 'Output file link', t: 'url', more: true },
  ] },
  tasks: { label: 'task', fields: [
    { k: 'title', l: 'Title', t: 'text', req: true, full: true },
    { k: 'objectiveId', l: 'Objective', t: 'select', o: opt.objectives, blank: true },
    { k: 'focus', l: 'Focus area', t: 'select', o: opt.focus, blank: true },
    { k: 'priority', l: 'Priority', t: 'select', o: opt.priorities, def: 'Medium' },
    { k: 'status', l: 'Status', t: 'select', o: opt.statuses, def: 'Planned' },
    { k: 'dueDate', l: 'Due date', t: 'date' },
    { k: 'estHours', l: 'Estimated effort (h)', t: 'number', step: 0.5, min: 0, hint: 'Planned effort; actual effort comes from linked log sessions' },
    { k: 'nextAction', l: 'Next action', t: 'text', full: true },
    { k: 'blocker', l: 'Blocker', t: 'text', full: true },
    { k: 'dependsOn', l: 'Depends on', t: 'multi', o: opt.tasks, full: true, more: true, selfExclude: true },
    { k: 'milestoneId', l: 'Milestone', t: 'select', o: opt.milestones, blank: true, more: true },
    { k: 'manuscriptId', l: 'Manuscript', t: 'select', o: opt.manuscripts, blank: true, more: true },
    { k: 'owner', l: 'Owner', t: 'text', more: true, hint: 'Defaults to you' },
    { k: 'completedDate', l: 'Completed on', t: 'date', more: true, hint: 'Filled automatically when status becomes Done' },
    { k: 'notes', l: 'Notes', t: 'textarea', full: true, more: true },
  ] },
  objectives: { label: 'objective', fields: [
    { k: 'code', l: 'Code', t: 'text', req: true },
    { k: 'focus', l: 'Linked focus area', t: 'select', o: opt.focus, blank: true, hint: 'Log sessions in this focus area count toward this objective' },
    { k: 'title', l: 'Objective', t: 'textarea', req: true, full: true },
    { k: 'description', l: 'Description', t: 'textarea', full: true },
    { k: 'contribution', l: 'Expected contribution', t: 'textarea', full: true },
    { k: 'successCriteria', l: 'Success criteria', t: 'textarea', full: true },
    { k: 'evidence', l: 'Evidence so far', t: 'textarea', full: true },
  ] },
  milestones: { label: 'milestone', fields: [
    { k: 'title', l: 'Milestone', t: 'text', req: true, full: true },
    { k: 'kind', l: 'Type', t: 'select', o: s => s.settings.milestoneKinds },
    { k: 'objectiveId', l: 'Objective', t: 'select', o: opt.objectives, blank: true, blankLabel: 'Programme-level (no single objective)' },
    { k: 'targetDate', l: 'Target date', t: 'date' },
    { k: 'status', l: 'Status', t: 'select', o: opt.statuses, def: 'Planned' },
    { k: 'completedDate', l: 'Completed on', t: 'date' },
    { k: 'deliverable', l: 'Deliverable', t: 'text' },
    { k: 'criteria', l: 'Success criteria', t: 'textarea', full: true },
    { k: 'evidence', l: 'Evidence / link', t: 'textarea', full: true },
  ] },
  papers: { label: 'paper', fields: [
    { k: 'title', l: 'Title', t: 'text', req: true, full: true },
    { k: 'authors', l: 'Authors', t: 'text', full: true, hint: 'Separate with semicolons: Last, First; Last, First' },
    { k: 'venueYear', l: 'Venue / Year', t: 'text' },
    { k: 'readingStatus', l: 'Reading status', t: 'select', o: s => s.settings.readingStatuses, blank: true, blankLabel: 'Not set' },
    { k: 'dateRead', l: 'Date read', t: 'date' },
    { k: 'objective', l: 'Relevant objective', t: 'select', o: opt.objFocus, raw: true },
    { k: 'cite', l: 'Cite? (Y/N)', t: 'select', o: () => [['', '—'], ['Y', 'Y'], ['N', 'N']], raw: true },
    { k: 'keywords', l: 'Keywords / tags', t: 'tags' },
    { k: 'doi', l: 'DOI', t: 'text' },
    { k: 'url', l: 'URL', t: 'url' },
    { k: 'pdf', l: 'PDF link', t: 'url', full: true },
    { k: 'researchQuestion', l: 'Research question', t: 'textarea', full: true },
    { k: 'keyIdea', l: 'Key Idea', t: 'textarea', full: true },
    { k: 'methodDataset', l: 'Method / Dataset', t: 'textarea', full: true },
    { k: 'findings', l: 'Main findings', t: 'textarea', full: true },
    { k: 'limitation', l: 'Limitation / Gap', t: 'textarea', full: true },
    { k: 'useInWork', l: 'Use in My Work', t: 'textarea', full: true },
    { k: 'notes', l: 'Personal notes', t: 'textarea', full: true },
  ] },
  gaps: { label: 'research gap', fields: [
    { k: 'title', l: 'Gap', t: 'text', req: true, full: true },
    { k: 'objectiveId', l: 'Objective', t: 'select', o: opt.objectives, blank: true },
    { k: 'status', l: 'Status', t: 'select', o: s => s.settings.gapStatuses, def: 'Proposed' },
    { k: 'description', l: 'Description', t: 'textarea', full: true },
    { k: 'paperIds', l: 'Supporting papers', t: 'multi', o: opt.papers, full: true },
    { k: 'experimentId', l: 'Possible experiment', t: 'select', o: opt.experiments, blank: true },
    { k: 'experimentIdea', l: 'Experiment idea (if not created yet)', t: 'textarea', full: true },
  ] },
  experiments: { label: 'experiment', groups: ['Overview', 'Model', 'Data', 'Code & environment', 'Run', 'Results'], fields: [
    { k: 'expId', l: 'Experiment ID', t: 'text', g: 0, hint: 'e.g. EXP-001' },
    { k: 'status', l: 'Status', t: 'select', o: s => s.settings.experimentStatuses, def: 'Planned', g: 0 },
    { k: 'title', l: 'Title', t: 'text', req: true, full: true, g: 0 },
    { k: 'objectiveId', l: 'Objective', t: 'select', o: opt.objectives, blank: true, g: 0 },
    { k: 'baseline', l: 'Baseline', t: 'text', g: 0 },
    { k: 'hypothesis', l: 'Hypothesis', t: 'textarea', full: true, g: 0 },
    { k: 'model', l: 'Model name', t: 'text', g: 1 }, { k: 'modelVersion', l: 'Model version / checkpoint', t: 'text', g: 1 },
    { k: 'config', l: 'Configuration', t: 'textarea', full: true, g: 1 }, { k: 'hyperparams', l: 'Hyperparameters', t: 'textarea', g: 1 }, { k: 'seed', l: 'Random seed', t: 'text', g: 1 },
    { k: 'datasetId', l: 'Dataset', t: 'select', o: opt.datasets, blank: true, g: 2 }, { k: 'datasetVersion', l: 'Dataset version', t: 'text', g: 2 },
    { k: 'split', l: 'Train / val / test split', t: 'text', g: 2 }, { k: 'evalSetting', l: 'Evaluation setting', t: 'text', g: 2, hint: 'Runs are compared only when dataset, version, split and this setting match' },
    { k: 'preprocessing', l: 'Preprocessing', t: 'textarea', full: true, g: 2 },
    { k: 'repo', l: 'Code repository', t: 'url', g: 3 }, { k: 'commit', l: 'Commit', t: 'text', g: 3 },
    { k: 'env', l: 'Environment', t: 'textarea', g: 3, hint: 'GPU, CUDA, packages' }, { k: 'prompts', l: 'Prompts', t: 'textarea', g: 3 },
    { k: 'startDate', l: 'Run start', t: 'date', g: 4 }, { k: 'endDate', l: 'Run end', t: 'date', g: 4 },
    { k: 'computeHours', l: 'Compute time (GPU h)', t: 'number', step: 0.1, min: 0, g: 4 }, { k: 'outputs', l: 'Output / checkpoint location', t: 'text', g: 4, hint: 'External path or URL' },
    { k: 'metrics', l: 'Metrics', t: 'rows', full: true, g: 5, sub: [
      { k: 'name', l: 'Metric', t: 'text' }, { k: 'category', l: 'Evaluates', t: 'select', o: s => s.settings.metricCategories, blank: true },
      { k: 'value', l: 'Value', t: 'number', step: 'any' }, { k: 'unit', l: 'Unit', t: 'text' },
      { k: 'better', l: 'Better', t: 'select', o: () => [['higher', 'Higher'], ['lower', 'Lower']] } ] },
    { k: 'results', l: 'Results', t: 'textarea', full: true, g: 5 }, { k: 'observations', l: 'Observations', t: 'textarea', full: true, g: 5 },
    { k: 'failures', l: 'Failures / negative findings', t: 'textarea', full: true, g: 5 }, { k: 'nextSteps', l: 'Next steps', t: 'textarea', full: true, g: 5 },
  ] },
  datasets: { label: 'dataset', fields: [
    { k: 'name', l: 'Name', t: 'text', req: true }, { k: 'version', l: 'Version', t: 'text' },
    { k: 'source', l: 'Source', t: 'text', full: true }, { k: 'access', l: 'Access conditions / licence', t: 'text', full: true },
    { k: 'annotations', l: 'Annotations', t: 'textarea', full: true },
    { k: 'status', l: 'Preparation status', t: 'select', o: s => s.settings.datasetStatuses, def: 'Not started' },
    { k: 'location', l: 'Storage location', t: 'text', hint: 'External path; large files are not stored here' },
    { k: 'notes', l: 'Notes', t: 'textarea', full: true },
  ] },
  manuscripts: { label: 'manuscript', fields: [
    { k: 'title', l: 'Title', t: 'text', req: true, full: true },
    { k: 'kind', l: 'Type', t: 'select', o: () => ['Paper', 'Thesis chapter', 'Report', 'Other'], def: 'Paper' },
    { k: 'stage', l: 'Stage', t: 'select', o: s => s.settings.writingStages, def: 'Idea' },
    { k: 'objectiveIds', l: 'Linked objectives', t: 'multi', o: opt.objectives },
    { k: 'venue', l: 'Target venue', t: 'text' }, { k: 'deadline', l: 'Deadline', t: 'date' },
    { k: 'coauthors', l: 'Co-authors', t: 'text', full: true }, { k: 'draftLinks', l: 'Draft links', t: 'textarea', full: true },
    { k: 'sections', l: 'Section checklist', t: 'rows', full: true, sub: [{ k: 'name', l: 'Section', t: 'text' }, { k: 'done', l: 'Done', t: 'check' }] },
    { k: 'submissions', l: 'Submission history', t: 'rows', full: true, sub: [
      { k: 'date', l: 'Submitted', t: 'date' }, { k: 'msId', l: 'Manuscript ID', t: 'text' }, { k: 'status', l: 'Editorial status', t: 'text' },
      { k: 'revisionDeadline', l: 'Revision due', t: 'date' }, { k: 'feedback', l: 'Reviewer feedback', t: 'text' } ] },
    { k: 'claims', l: 'Claims, figures & tables → evidence', t: 'rows', full: true, sub: [
      { k: 'kind', l: 'Kind', t: 'select', o: () => ['Claim', 'Figure', 'Table'] }, { k: 'text', l: 'Text / caption', t: 'text' },
      { k: 'paperId', l: 'Paper', t: 'select', o: opt.papers, blank: true }, { k: 'experimentId', l: 'Experiment', t: 'select', o: opt.experiments, blank: true } ] },
    { k: 'notes', l: 'Notes', t: 'textarea', full: true },
  ] },
  meetings: { label: 'meeting', fields: [
    { k: 'date', l: 'Meeting date', t: 'date', req: true }, { k: 'nextDate', l: 'Next meeting', t: 'date' },
    { k: 'participants', l: 'Participants', t: 'text', full: true },
    { k: 'agenda', l: 'Agenda', t: 'textarea', full: true }, { k: 'progress', l: 'Progress discussed', t: 'textarea', full: true },
    { k: 'feedback', l: 'Feedback', t: 'textarea', full: true }, { k: 'decisions', l: 'Decisions', t: 'textarea', full: true },
    { k: 'questions', l: 'Unresolved questions', t: 'textarea', full: true },
    { k: 'actions', l: 'Agreed actions', t: 'rows', full: true, sub: [{ k: 'text', l: 'Action', t: 'text' }, { k: 'owner', l: 'Owner', t: 'text' }, { k: 'due', l: 'Deadline', t: 'date' }] },
  ] },
};

function getPath(o, k) { return k.split('.').reduce((a, p) => a == null ? undefined : a[p], o); }
function setPath(o, k, v) { const ps = k.split('.'); let a = o; ps.slice(0, -1).forEach(p => { if (a[p] == null || typeof a[p] !== 'object') a[p] = {}; a = a[p]; }); a[ps[ps.length - 1]] = v; }
function optList(f, s) { let o = typeof f.o === 'function' ? f.o(s) : (f.o || []); return o.map(x => Array.isArray(x) ? x : [x, x]); }

function fieldHTML(f, val, s, name, ctx) {
  name = name || 'f_' + f.k; const id = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  const req = f.req ? ' required' : '';
  let input;
  if (f.t === 'textarea') input = '<textarea id="' + id + '" name="' + name + '"' + req + '>' + esc(val ?? '') + '</textarea>';
  else if (f.t === 'select') {
    let o = optList(f, s); const cur = val == null ? '' : String(val);
    if (cur && !o.some(x => String(x[0]) === cur)) o = o.concat([[cur, cur + ' (not in list)']]);
    const blank = f.blank ? '<option value="">' + esc(f.blankLabel || '—') + '</option>' : '';
    input = '<select id="' + id + '" name="' + name + '"' + req + '>' + blank + o.map(x => '<option value="' + esc(x[0]) + '"' + (String(x[0]) === cur ? ' selected' : '') + '>' + esc(x[1]) + '</option>').join('') + '</select>';
  } else if (f.t === 'multi') {
    const cur = new Set(val || []); let o = optList(f, s); if (f.selfExclude && ctx && ctx.id) o = o.filter(x => x[0] !== ctx.id);
    input = o.length ? '<div class="checks" id="' + id + '">' + o.map(x => '<label><input type="checkbox" name="' + name + '" value="' + esc(x[0]) + '"' + (cur.has(x[0]) ? ' checked' : '') + '> <span>' + esc(x[1]) + '</span></label>').join('') + '</div>' : '<div class="hint">Nothing to link yet.</div>';
  } else if (f.t === 'check') input = '<input type="checkbox" id="' + id + '" name="' + name + '"' + (val ? ' checked' : '') + '>';
  else if (f.t === 'tags') input = '<input id="' + id + '" name="' + name + '" value="' + esc((val || []).join(', ')) + '" placeholder="comma-separated">';
  else if (f.t === 'rows') {
    const rows = val || [];
    input = '<div class="subrows" data-rows="' + f.k + '">' + rows.map((r, i) => '<div class="subrow">' + f.sub.map(sf => fieldHTML(sf, r[sf.k], s, name + '__' + i + '__' + sf.k)).join('') + '<button type="button" class="btn sm ghost danger" data-act="row-del" data-k="' + f.k + '" data-i="' + i + '" aria-label="Remove row">Remove</button></div>').join('') +
      '<div><button type="button" class="btn sm" data-act="row-add" data-k="' + f.k + '">+ Add ' + esc(f.l.toLowerCase().split(' ')[0]) + '</button></div></div>';
    return '<div class="f full"><div class="eyebrow" style="margin-bottom:6px">' + esc(f.l) + '</div>' + input + '</div>';
  } else {
    const type = f.t === 'number' ? 'number' : f.t === 'date' ? 'date' : f.t === 'url' ? 'url' : 'text';
    const extra = f.t === 'number' ? ' step="' + (f.step ?? 'any') + '"' + (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') + ' inputmode="decimal"' : '';
    input = '<input id="' + id + '" type="' + type + '" name="' + name + '" value="' + esc(val ?? '') + '"' + extra + req + '>';
  }
  return '<label class="f' + (f.full ? ' full' : '') + (f.req ? ' req' : '') + '" for="' + id + '"><span>' + esc(f.l) + '</span>' + input + (f.hint ? '<span class="hint">' + esc(f.hint) + '</span>' : '') + '</label>';
}

function readField(form, f, name) {
  name = name || 'f_' + f.k;
  if (f.t === 'multi') return Array.from(form.querySelectorAll('input[name="' + CSS.escape(name) + '"]:checked')).map(i => i.value);
  const el = form.elements[name]; if (!el) return undefined;
  if (f.t === 'check') return el.checked;
  const v = el.value;
  if (f.t === 'number' || f.num) { if (v === '' || v == null) return null; const n = Number(v); return isFinite(n) ? n : null; }
  if (f.t === 'tags') return v.split(',').map(x => x.trim()).filter(Boolean);
  if (f.t === 'date') return v || null;
  return v.trim();
}
function readRows(form, f) {
  const box = form.querySelector('[data-rows="' + f.k + '"]'); if (!box) return [];
  const n = box.querySelectorAll(':scope > .subrow').length; const out = [];
  for (let i = 0; i < n; i++) { const r = {}; f.sub.forEach(sf => r[sf.k] = readField(form, sf, 'f_' + f.k + '__' + i + '__' + sf.k)); out.push(r); }
  return out;
}
function readForm(form, schema, base) {
  const rec = JSON.parse(JSON.stringify(base || {}));
  for (const f of schema.fields) { const v = f.t === 'rows' ? readRows(form, f) : readField(form, f); if (v !== undefined) setPath(rec, f.k, v); }
  return rec;
}

/* ---------- drawer ---------- */
let DR = null; // {col, rec, isNew, onSave}
function openEditor(col, id, defaults, onSave) {
  const s = Store.state(); const schema = SCHEMA[col];
  const existing = id ? Store.get(col, id) : null;
  const rec = existing ? JSON.parse(JSON.stringify(existing)) : Object.assign({}, defaults || {});
  if (!existing) schema.fields.forEach(f => { if (f.def !== undefined && getPath(rec, f.k) === undefined) setPath(rec, f.k, f.def); });
  DR = { col, rec, isNew: !existing, onSave };
  renderDrawer();
}
function renderDrawer() {
  const host = document.getElementById('drawer-host');
  if (!DR) { host.innerHTML = ''; document.body.style.overflow = ''; return; }
  const s = Store.state(); const sc = SCHEMA[DR.col]; const r = DR.rec;
  const main = sc.fields.filter(f => !f.more), more = sc.fields.filter(f => f.more);
  let body = '';
  if (sc.groups) body = sc.groups.map((g, gi) => '<fieldset class="grp"><legend>' + esc(g) + '</legend><div class="fgrid">' + sc.fields.filter(f => f.g === gi).map(f => fieldHTML(f, getPath(r, f.k), s, null, r)).join('') + '</div></fieldset>').join('');
  else {
    body = '<div class="fgrid">' + main.map(f => fieldHTML(f, getPath(r, f.k), s, null, r)).join('') + '</div>';
    if (more.length) { const anyMore = more.some(f => { const v = getPath(r, f.k); return v != null && v !== '' && !(Array.isArray(v) && !v.length); }); body += '<details class="more"' + (anyMore ? ' open' : '') + '><summary>Optional details & links</summary><div class="fgrid" style="margin-top:10px">' + more.map(f => fieldHTML(f, getPath(r, f.k), s, null, r)).join('') + '</div></details>'; }
  }
  body += extraInfo(DR.col, r, s);
  host.innerHTML = '<div class="drawer-scrim" data-act="drawer-close"></div><form class="drawer" id="drawer-form" role="dialog" aria-modal="true" aria-labelledby="drawer-title" novalidate>' +
    '<header><h2 id="drawer-title">' + (DR.isNew ? 'New ' : 'Edit ') + esc(sc.label) + '</h2><button type="button" class="btn ghost icon" data-act="drawer-close" aria-label="Close">' + ICON.x + '</button></header>' +
    '<div class="body">' + body + '<div id="drawer-err"></div></div>' +
    '<footer><div class="row">' + (!DR.isNew ? '<button type="button" class="btn danger" data-act="drawer-delete">Move to Trash</button>' : '') + '</div><div class="row"><button type="button" class="btn" data-act="drawer-close">Cancel</button><button type="submit" class="btn primary">Save</button></div></footer></form>';
  document.body.style.overflow = 'hidden';
  const first = host.querySelector('input:not([type=checkbox]),select,textarea'); if (first && DR.isNew) setTimeout(() => first.focus(), 30);
}
function extraInfo(col, r, s) {
  if (col === 'tasks' && !DR.isNew) { const a = C.taskActualHours(s, r.id); return '<div class="note">Actual effort from linked log sessions: <b class="num">' + a.hours + ' h</b> across ' + a.sessions + ' session(s)' + (C.isNum(r.estHours) ? ' · planned ' + r.estHours + ' h' : '') + '.' + (r.sourceLogId ? ' Created from a log next step.' : '') + (r.sourceMeetingId ? ' Created from a meeting action.' : '') + '</div>'; }
  if (col === 'logs' && r.source && r.source.sheet) return '<div class="note">Imported from ' + esc(r.source.file || 'workbook') + ' · ' + esc(r.source.sheet) + ' row ' + r.source.row + '.</div>';
  if (col === 'milestones' && r.template) return '<div class="note warn">Suggested milestone. It is not counted in progress until you save it (set a target date or edit any field and save).</div>';
  return '';
}
function drawerRowAdd(k) { const f = SCHEMA[DR.col].fields.find(x => x.k === k); DR.rec = readForm(document.getElementById('drawer-form'), SCHEMA[DR.col], DR.rec); const rows = getPath(DR.rec, k) || []; const blank = {}; f.sub.forEach(sf => blank[sf.k] = sf.t === 'select' && !sf.blank ? optList(sf, Store.state())[0]?.[0] : (sf.t === 'check' ? false : null)); rows.push(blank); setPath(DR.rec, k, rows); renderDrawer(); }
function drawerRowDel(k, i) { DR.rec = readForm(document.getElementById('drawer-form'), SCHEMA[DR.col], DR.rec); const rows = getPath(DR.rec, k) || []; rows.splice(i, 1); setPath(DR.rec, k, rows); renderDrawer(); }
function closeDrawer() { DR = null; renderDrawer(); }
function saveDrawer() {
  const form = document.getElementById('drawer-form'); const sc = SCHEMA[DR.col];
  const rec = readForm(form, sc, DR.rec);
  const missing = sc.fields.filter(f => f.req && (getPath(rec, f.k) == null || getPath(rec, f.k) === ''));
  const errs = missing.map(f => f.l + ' is required.');
  if (DR.col === 'logs' && C.isNum(rec.hours) && (rec.hours < 0 || rec.hours > 24)) errs.push('Hours must be between 0 and 24.');
  if (errs.length) { document.getElementById('drawer-err').innerHTML = '<div class="note bad">' + errs.map(esc).join('<br>') + '</div>'; return; }
  normalizeRecord(DR.col, rec, DR.isNew ? null : Store.get(DR.col, rec.id));
  const cb = DR.onSave; const col = DR.col; const isNew = DR.isNew;
  Store.put(col, rec); closeDrawer(); toast((isNew ? 'Added ' : 'Saved ') + SCHEMA[col].label);
  if (cb) cb(rec);
}
/** shared rules applied on every save */
function normalizeRecord(col, rec, prev) {
  if ((col === 'tasks' || col === 'milestones') ) {
    if (rec.status === 'Done' && !rec.completedDate) rec.completedDate = C.todayISO();
    if (rec.status !== 'Done' && prev && prev.status === 'Done' && prev.completedDate === rec.completedDate) rec.completedDate = null;
  }
  if (col === 'milestones') delete rec.template;
  if (col === 'logs') { rec.links = rec.links || {}; if (rec.importKey && prev && prev.importKey) rec.importKey = prev.importKey; }
  if (col === 'papers' && rec.readingStatus === 'Read' && !rec.dateRead) rec.dateRead = C.todayISO();
}
