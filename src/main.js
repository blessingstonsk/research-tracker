/* ===== Shell, routing, events ===== */
const VIEWS = [['dashboard', 'Dashboard', viewDashboard], ['log', 'Daily Log', viewLog], ['plan', 'Research Plan', viewPlan], ['literature', 'Literature', viewLiterature], ['experiments', 'Experiments', viewExperiments], ['writing', 'Writing', viewWriting], ['meetings', 'Meetings', viewMeetings], ['reports', 'Reports', viewReports]];
const SECONDARY = [['gsheet', 'Google Sheets sync'], ['import', 'Import workbook'], ['data', 'Export & backup'], ['lists', 'Categories & targets'], ['trash', 'Trash'], ['demo', 'Demo data'], ['calc', 'How progress is calculated']];
function shell() {
  const navLinks = VIEWS.map(([k, l]) => '<li><a href="#' + k + '" data-nav="' + k + '">' + l + '</a></li>').join('');
  const sec = SECONDARY.map(([k, l]) => '<a href="#settings" data-act="settings-tab" data-tab="' + k + '">' + l + '</a>').join('');
  document.getElementById('app').innerHTML =
    '<header class="nav"><div class="nav-inner"><a class="brand" href="#dashboard" aria-label="Research Tracker home"><span class="mono-badge">SK</span><span><b>Research Tracker</b><small>Explainable VLMs · Autonomous Driving</small></span></a>' +
    '<nav aria-label="Main"><ul class="nav-links">' + navLinks + '</ul></nav>' +
    '<div class="nav-actions"><button class="btn primary" data-act="new" data-col="logs" aria-label="Log a work session">' + ICON.plus + '<span class="log-label">Log session</span></button>' +
    '<button class="icon-btn" data-act="theme" id="theme-btn" aria-label="Theme: system" title="Theme: system">' + ICON.theme + '</button>' +
    '<div class="more-wrap"><button class="icon-btn" data-act="toggle-more" aria-expanded="false" aria-haspopup="true" id="more-btn" aria-label="Settings and data" title="Settings & data">' + ICON.more + '</button>' +
    '<div class="more-menu" id="more-menu" hidden><div class="eyebrow" style="padding:6px 10px">Settings & data</div>' + sec + '<hr><div class="store-line" id="save-status" aria-live="polite">' + saveStatusHTML() + '</div></div></div>' +
    '<button class="icon-btn burger" data-act="open-rail" aria-label="Open menu">' + ICON.menu + '</button></div></div></header>' +
    '<div class="scrim" id="scrim" data-act="close-rail"></div><nav class="drawer-nav" id="drawer-nav" aria-label="Menu"><div class="eyebrow">Sections</div>' + VIEWS.map(([k, l]) => '<a href="#' + k + '" data-nav="' + k + '">' + l + '</a>').join('') + '<div class="eyebrow">Settings & data</div>' + sec + '</nav>' +
    '<div class="main"><main class="content" id="view" tabindex="-1"><div class="loading">Loading your records…</div></main></div>' +
    '<div id="drawer-host"></div><div id="modal-host"></div><div class="toasts" id="toasts" aria-live="polite"></div><div class="tip" id="tip" hidden></div>';
}
function currentView() { const h = (location.hash || '').replace('#', ''); return VIEWS.some(v => v[0] === h) || h === 'settings' ? h : 'dashboard'; }
let RENDER_PENDING = false;
function render() {
  if (Store.mode === 'loading') return;
  const v = currentView(); U.view = v; const host = document.getElementById('view');
  const active = document.activeElement; const aid = active && active.id; const sel = active && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;
  const fn = v === 'settings' ? viewSettings : VIEWS.find(x => x[0] === v)[2];
  try { host.innerHTML = fn(); } catch (e) { console.error(e); host.innerHTML = '<div class="note bad">This view hit an error: ' + esc(e.message) + '. Your data is safe; try another view or reload.</div>'; }
  document.querySelectorAll('[data-nav]').forEach(a => a.setAttribute('aria-current', a.dataset.nav === v ? 'page' : 'false'));
  document.title = (v === 'settings' ? 'Settings & data' : VIEWS.find(x => x[0] === v)[1]) + ' · Research Tracker';
  afterRender(v);
  if (aid) { const el = document.getElementById(aid); if (el && el !== document.body) { el.focus({ preventScroll: true }); if (sel && 'setSelectionRange' in el) try { el.setSelectionRange(sel[0], sel[1]); } catch (e) {} } }
  Store.emitStatus(); saveUI();
}
function scheduleRender() { if (RENDER_PENDING) return; RENDER_PENDING = true; requestAnimationFrame(() => { RENDER_PENDING = false; if (!isTyping()) render(); else PENDING_WHILE_TYPING = true; }); }
let PENDING_WHILE_TYPING = false;
function isTyping() { const a = document.activeElement; return a && /^(TEXTAREA)$/.test(a.tagName) && a.closest('#view') && a.dataset.input && a.dataset.input.startsWith('rep-'); }

/* toasts & modal */
function toast(msg, isErr, undo) {
  const el = document.createElement('div'); el.className = 'toast' + (isErr ? ' err' : ''); el.innerHTML = '<span>' + esc(msg) + '</span>' + (undo ? '<button type="button">Undo</button>' : '');
  if (undo) el.querySelector('button').onclick = () => { undo(); el.remove(); };
  document.getElementById('toasts').appendChild(el); setTimeout(() => el.remove(), undo ? 7000 : 3500);
}
function showModal(title, body, foot) {
  document.getElementById('modal-host').innerHTML = '<div class="modal" data-act="modal-bg"><div class="box" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><header><h2>' + esc(title) + '</h2><button class="btn ghost icon" data-act="modal-close" aria-label="Close">' + ICON.x + '</button></header><div class="body">' + body + '</div><footer>' + (foot || '') + '<button class="btn" data-act="modal-close">Close</button></footer></div></div>';
}
function closeModal() { document.getElementById('modal-host').innerHTML = ''; }

/* theme */
function applyTheme(t) { const r = document.documentElement; if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme'); const l = document.getElementById('theme-btn'); if (l) { l.title = 'Theme: ' + (t || 'system') + ' (click to change)'; l.setAttribute('aria-label', l.title); } if (window.City3D) City3D.recolor(); }
function cycleTheme() { let t = ''; try { t = localStorage.getItem('rt-theme') || ''; } catch (e) {} t = t === '' ? 'light' : t === 'light' ? 'dark' : ''; try { localStorage.setItem('rt-theme', t); } catch (e) {} applyTheme(t); }

/* actions */
function softDel(col, id) {
  const r = Store.get(col, id); if (!r) return; Store.softDelete(col, id);
  toast(cap(SCHEMA[col] ? SCHEMA[col].label : 'Record') + ' moved to Trash', false, () => { Store.restore(col, id); toast('Restored'); });
}
function cap(s) { return s[0].toUpperCase() + s.slice(1); }
function saveFilter(scope) {
  const name = scope === 'dashboard' ? [dashRange(C.todayISO()).label, U.dash.objectiveId && (Store.get('objectives', U.dash.objectiveId) || {}).code, U.dash.taskType].filter(Boolean).join(' · ') : ['Log', U.log.q && '“' + U.log.q + '”', U.log.focus, U.log.type, U.log.status, U.log.from && 'from ' + C.fmtDate(U.log.from), U.log.to && 'to ' + C.fmtDate(U.log.to)].filter(Boolean).join(' · ');
  const st = JSON.parse(JSON.stringify(Store.state().settings)); st.savedFilters = st.savedFilters || [];
  const filter = scope === 'dashboard' ? Object.assign({}, U.dash) : { q: U.log.q, focus: U.log.focus, type: U.log.type, status: U.log.status, from: U.log.from, to: U.log.to };
  st.savedFilters.push({ id: C.uid('sf'), scope, name: name || 'Filter', filter }); Store.put('settings', st); toast('Filter saved as “' + name + '”');
}
function citeExport(fmt) {
  const s = Store.state(); const Lt = U.lit;
  let ps = C.live(s.papers).filter(p => (!Lt.obj || p.objective === Lt.obj) && (!Lt.status || p.readingStatus === Lt.status) && (!Lt.tag || (p.keywords || []).includes(Lt.tag)));
  if (Lt.q) { const t = Lt.q.toLowerCase(); ps = ps.filter(p => [p.title, p.authors, p.keyIdea].some(v => v && v.toLowerCase().includes(t))); }
  const citeY = ps.filter(p => p.cite === 'Y');
  if (!ps.length) { showModal('Citation export', '<p>No papers in the current selection.</p>'); return; }
  const use = citeY.length ? citeY : ps; const text = fmt === 'ris' ? C.toRIS(use) : C.toBibTeX(use);
  showModal(fmt === 'ris' ? 'RIS export' : 'BibTeX export', '<p class="small">' + use.length + ' paper(s)' + (citeY.length ? ' marked Cite = Y' : ' in the current selection (none marked Cite = Y)') + '. Only fields recorded in the tracker are included; entries with missing author, year or venue are marked.</p><textarea id="cite-text" style="min-height:300px;font-family:var(--f-mono);font-size:12px" readonly>' + esc(text) + '</textarea>',
    '<button class="btn" data-act="copy-cite">Copy</button><button class="btn primary" data-act="save-cite" data-fmt="' + fmt + '">Save as file</button>');
  window.__citeText = text;
}
async function copyText(id) { const el = document.getElementById(id); if (!el) return; try { await navigator.clipboard.writeText(el.value); toast('Copied'); } catch (e) { el.select(); toast('Press Ctrl/Cmd+C to copy the selected text'); } }

document.addEventListener('click', e => {
  if (!e.target.closest('.more-wrap')) { const m = document.getElementById('more-menu'); if (m && !m.hidden) { m.hidden = true; document.getElementById('more-btn').setAttribute('aria-expanded', 'false'); } }
  const a = e.target.closest('[data-act]'); if (!a) { const nav = e.target.closest('[data-nav]'); if (nav) closeRail(); return; }
  const act = a.dataset.act; const id = a.dataset.id; const col = a.dataset.col;
  const prevent = () => { if (a.tagName === 'A' || a.tagName === 'TR') e.preventDefault(); };
  switch (act) {
    case 'new': prevent(); { const d = {}; if (col === 'logs') Object.assign(d, { date: C.todayISO(), status: 'Done', focus: QDRAFT.focus || undefined, taskType: QDRAFT.taskType || undefined }); if (a.dataset.focus) d.focus = a.dataset.focus; if (col === 'meetings') d.date = C.todayISO(); openEditor(col, null, d); } break;
    case 'edit': prevent(); if (Store.get(col, id)) openEditor(col, id); else toast('That record no longer exists', true); break;
    case 'del': prevent(); softDel(col, id); break;
    case 'drawer-close': closeDrawer(); break;
    case 'drawer-delete': { const c = DR.col, i = DR.rec.id; closeDrawer(); softDel(c, i); } break;
    case 'row-add': drawerRowAdd(a.dataset.k); break;
    case 'row-del': drawerRowDel(a.dataset.k, Number(a.dataset.i)); break;
    case 'modal-close': closeModal(); break;
    case 'modal-bg': if (e.target === a) closeModal(); break;
    case 'open-rail': document.getElementById('drawer-nav').classList.add('open'); document.getElementById('scrim').classList.add('open'); break;
    case 'close-rail': closeRail(); break;
    case 'toggle-more': { const m = document.getElementById('more-menu'); m.hidden = !m.hidden; a.setAttribute('aria-expanded', String(!m.hidden)); } break;
    case 'theme': cycleTheme(); break;
    case 'settings-tab': e.preventDefault(); U.set.tab = a.dataset.tab; closeRail(); if (location.hash !== '#settings') location.hash = 'settings'; else render(); break;
    case 'log-toggle': U.log.open[id] = !U.log.open[id]; render(); break;
    case 'log-more': U.log.days += 30; render(); break;
    case 'log-clear': Object.assign(U.log, { q: '', focus: '', type: '', status: '', from: '', to: '' }); render(); break;
    case 'make-task': makeTaskFromLog(id); break;
    case 'duplicate-log': { const l = Store.get('logs', id); if (l) { QDRAFT = { date: C.todayISO(), focus: l.focus, taskType: l.taskType, what: l.what, status: l.status, open: QDRAFT.open }; saveDraft(); if (currentView() !== 'log') location.hash = 'log'; else render(); toast('Copied into the quick entry form'); } } break;
    case '3d-toggle': U.dash.view2d = !U.dash.view2d; render(); break;
    case '3d-zoom': City3D.zoom(Number(a.dataset.f)); break;
    case '3d-reset': City3D.reset(); break;
    case 'gs-save': { const id = GSync.parseId(document.getElementById('gs-url').value); if (!id) { GSync.setStatus('That does not look like a Google Sheets link. It should contain /spreadsheets/d/…', true); break; } GSync.saveCfg({ id }); GSync.setStatus('Link saved. Click "Set up template & sync".'); } break;
    case 'gs-sync': { const el = document.getElementById('gs-url'); if (el) { const id = GSync.parseId(el.value); if (id && id !== GSync.cfg().id) GSync.saveCfg({ id }); } setTimeout(() => GSync.sync(), 0); } break;
    case 'save-filter': saveFilter(a.dataset.scope); break;
    case 'plan-mode': U.plan.mode = a.dataset.mode; render(); break;
    case 'cal-prev': case 'cal-next': { const m = U.plan.month || C.todayISO().slice(0, 7); const d = C.parseISO(m + '-01'); d.setUTCMonth(d.getUTCMonth() + (act === 'cal-next' ? 1 : -1)); U.plan.month = C.toISO(d).slice(0, 7); render(); } break;
    case 'cal-today': U.plan.month = ''; render(); break;
    case 'lit-tab': U.lit.tab = a.dataset.tab; render(); break;
    case 'exp-tab': U.exp.tab = a.dataset.tab; render(); break;
    case 'meet-tab': U.meet.tab = a.dataset.tab; render(); break;
    case 'cite-export': citeExport(a.dataset.fmt); break;
    case 'copy-cite': copyText('cite-text'); break;
    case 'copy-dl': copyText('dl-text'); break;
    case 'save-cite': saveFile('references-' + (a.dataset.fmt === 'ris' ? 'ris' : 'bibtex') + '.txt', window.__citeText); break;
    case 'gap-exp': { const g = Store.get('gaps', id); if (g) openEditor('experiments', null, { title: g.title, objectiveId: g.objectiveId, hypothesis: g.experimentIdea || '', status: 'Planned' }, ex => { const G = Store.get('gaps', id); if (G) { G.experimentId = ex.id; Store.put('gaps', G); } }); } break;
    case 'action-task': { const t = actionToTask(id, Number(a.dataset.i)); if (t) toast('Task created: ' + t.title); } break;
    case 'actions-all': { const m = Store.get('meetings', id); let n = 0; (m.actions || []).forEach((x, i) => { if (actionToTask(id, i)) n++; }); toast(n + ' task(s) created'); } break;
    case 'new-meeting-prefill': { const s = Store.state(); const meets = C.live(s.meetings).filter(m => m.date && m.date <= C.todayISO()).sort((x, y) => y.date.localeCompare(x.date)); const from = meets[0] ? C.addDays(meets[0].date, 1) : C.addDays(C.todayISO(), -13);
      const logs = C.filterLogs(s, { from, to: C.todayISO() }); const sum = C.summarizeLogs(s, logs);
      const prog = 'Since ' + C.fmtDate(from) + ': ' + sum.totalHours + ' h over ' + sum.days + ' day(s).\n' + logs.filter(l => l.output).map(l => '- ' + C.fmtDate(l.date) + ': ' + l.output).join('\n');
      openEditor('meetings', null, { date: C.todayISO(), progress: prog, questions: meets[0] && meets[0].questions || '' }); } break;
    case 'rep-regen': U.rep.draft = null; render(); toast('Report regenerated from current records'); break;
    case 'rep-save': saveReport(); break;
    case 'rep-pdf': exportReportPDF(); break;
    case 'rep-xlsx': { const p = repPeriod(); exportWorkbook(p.from, p.to, 'research-data-' + p.from + '-to-' + p.to + '.xlsx'); } break;
    case 'rep-csv': { const p = repPeriod(); const s = Store.state(); saveFile('sessions-' + p.from + '-to-' + p.to + '.csv', C.toCSV(C.filterLogs(s, { from: p.from, to: p.to }).sort((x, y) => (x.date || '').localeCompare(y.date || '')), LOG_EXPORT)); } break;
    case 'rep-open': prevent(); { const r = Store.get('reports', id); if (r) { U.rep.draft = JSON.parse(JSON.stringify(r)); U.rep.kind = r.kind || 'custom'; if (r.kind === 'custom') { U.rep.from = r.from; U.rep.to = r.to; } else U.rep.ref = r.from; render(); } } break;
    case 'import-commit': commitImport(); break;
    case 'import-cancel': IMPORT_PLAN = null; render(); break;
    case 'export-xlsx': exportWorkbook('', '', 'research-tracker-' + C.todayISO() + '.xlsx'); break;
    case 'export-json': saveFile('research-tracker-backup-' + C.todayISO() + '.json', JSON.stringify(Store.exportAll(false), null, 1)); break;
    case 'export-csv': { const s = Store.state(); const rows = C.live(s[col]); const cols = col === 'logs' ? LOG_EXPORT : col === 'papers' ? PAPER_EXPORT : (rows.length ? genericCols(rows) : [{ label: 'id', key: 'id' }]); saveFile(col + '-' + C.todayISO() + '.csv', C.toCSV(rows, cols)); } break;
    case 'restore': if (a.dataset.mode === 'replace' && a.dataset.confirm !== '1') { a.dataset.confirm = '1'; a.textContent = 'Click again to replace everything'; break; } doRestore(a.dataset.mode); break;
    case 'backup-now': autoBackup('Manual backup').then(ok => { toast(ok ? 'Backup point created' : Store.mode === 'gas' ? 'Google Sheets keeps versions under File → Version history; download a backup file for an extra copy' : 'Data is too large for a backup point; download a backup file instead', !ok); render(); }); break;
    case 'gs-reload': Store.reload().then(ok => { if (ok) { Store.emit(); toast('Records reloaded from your Google Sheet'); } else toast(Store.inflight ? 'Still saving; try again in a moment' : 'Could not read the sheet', true); }); break;
    case 'backup-restore': if (a.dataset.confirm !== '1') { a.dataset.confirm = '1'; a.textContent = 'Click again to restore'; break; } { const b = Store.get('backups', id); if (b) doRestore('replace', JSON.parse(b.json)); } break;
    case 'backup-download': { const b = Store.get('backups', id); if (b) saveFile('research-tracker-backup-' + (b.createdAt || '').slice(0, 10) + '.json', b.json); } break;
    case 'restore-item': Store.restore(col, id); toast('Restored'); break;
    case 'purge': if (a.dataset.confirm !== '1') { a.dataset.confirm = '1'; a.textContent = 'Click again'; break; } Store.hardDelete(col, id); break;
    case 'trash-empty': if (a.dataset.confirm !== '1') { a.dataset.confirm = '1'; a.textContent = 'Click again to delete forever'; break; } COLS.forEach(c => Array.from(Store.maps[c].values()).filter(r => r.deleted).forEach(r => Store.hardDelete(c, r.id))); toast('Trash emptied'); break;
    case 'demo-load': loadDemo(); break;
    case 'demo-remove': removeDemo(); break;
    case 'fa-add': { const st = JSON.parse(JSON.stringify(Store.state().settings)); st.focusAreas.push({ name: 'New focus area', kind: 'research', objectiveId: '' }); Store.put('settings', st); } break;
    case 'fa-del': { const st = JSON.parse(JSON.stringify(Store.state().settings)); const f = st.focusAreas[Number(a.dataset.i)]; const used = C.live(Store.state().logs).filter(l => l.focus === f.name).length; if (used && a.dataset.confirm !== '1') { a.dataset.confirm = '1'; a.textContent = used + ' sessions use it — click again'; break; } st.focusAreas.splice(Number(a.dataset.i), 1); Store.put('settings', st); } break;
    case 'lists-save': { const st = JSON.parse(JSON.stringify(Store.state().settings)); document.querySelectorAll('[data-list]').forEach(t => { const v = t.value.split('\n').map(x => x.trim()).filter(Boolean); if (v.length) st[t.dataset.list] = Array.from(new Set(v)); }); Store.put('settings', st); toast('Lists saved'); } break;
    case 'targets-save': { const st = JSON.parse(JSON.stringify(Store.state().settings)); st.targets = st.targets || {}; ['weeklyHours', 'dailyHours', 'papersPerMonth'].forEach(k => { const v = document.getElementById('tg-' + k).value; st.targets[k] = v === '' ? null : Number(v); }); Store.put('settings', st); toast('Targets saved'); } break;
    case 'sf-del': { const st = JSON.parse(JSON.stringify(Store.state().settings)); st.savedFilters = (st.savedFilters || []).filter(f => f.id !== id); Store.put('settings', st); } break;
  }
});
function closeRail() { const m = document.getElementById('more-menu'); if (m) { m.hidden = true; document.getElementById('more-btn').setAttribute('aria-expanded', 'false'); } document.getElementById('drawer-nav').classList.remove('open'); document.getElementById('scrim').classList.remove('open'); }

document.addEventListener('submit', e => {
  if (e.target.id === 'drawer-form') { e.preventDefault(); saveDrawer(); }
  else if (e.target.id === 'quick-form') { e.preventDefault(); submitQuick(e.target); }
});
document.addEventListener('change', e => {
  const t = e.target;
  if (t.id === 'wb-file' && t.files[0]) { handleWorkbookFile(t.files[0]); t.value = ''; return; }
  if (t.id === 'restore-file' && t.files[0]) { handleRestoreFile(t.files[0]); t.value = ''; return; }
  if (t.id === 'gs-auto') { GSync.saveCfg({ auto: t.checked }); toast(t.checked ? 'Automatic sync on' : 'Automatic sync off'); return; }
  if (t.dataset.fa != null) { const st = JSON.parse(JSON.stringify(Store.state().settings)); const f = st.focusAreas[Number(t.dataset.fa)]; const old = f.name; f[t.dataset.k] = t.value.trim();
    if (t.dataset.k === 'name' && old !== f.name && f.name) { // keep records connected when a focus area is renamed
      C.live(Store.state().logs).filter(l => l.focus === old).forEach(l => { const L = Store.get('logs', l.id); L.focus = f.name; Store.put('logs', L, { silent: true }); });
      C.live(Store.state().tasks).filter(x => x.focus === old).forEach(x => { const T = Store.get('tasks', x.id); T.focus = f.name; Store.put('tasks', T, { silent: true }); });
      C.live(Store.state().objectives).filter(x => x.focus === old).forEach(x => { const O = Store.get('objectives', x.id); O.focus = f.name; Store.put('objectives', O, { silent: true }); }); }
    Store.put('settings', st); toast('Saved'); return; }
  const ch = t.dataset.change; if (!ch) return;
  if (ch === 'qdraft') { QDRAFT[t.name] = t.value; saveDraft(); if (t.name === 'date') { const d = document.getElementById('q-day'); if (d) d.textContent = C.dayName(t.value) + ' ' + C.fmtDate(t.value); } return; }
  if (ch.startsWith('task-status:')) { const T = Store.get('tasks', ch.split(':')[1]); if (T) { const prev = JSON.parse(JSON.stringify(T)); T.status = t.value; normalizeRecord('tasks', T, prev); Store.put('tasks', T); toast('Status → ' + t.value); } return; }
  if (ch.startsWith('apply-filter:')) { const sc = ch.split(':')[1]; const f = (Store.state().settings.savedFilters || []).find(x => x.id === t.value); if (f) { if (sc === 'dashboard') Object.assign(U.dash, f.filter); else Object.assign(U.log, f.filter); render(); } return; }
  const [area, key] = ch.split(':');
  const map = { dash: U.dash, log: U.log, plan: U.plan, lit: U.lit, exp: U.exp, rep: U.rep };
  if (map[area]) { map[area][key] = t.value; if (area === 'rep') U.rep.draft = null; render(); }
});
let INPUT_T = null;
document.addEventListener('input', e => {
  const t = e.target; const k = t.dataset.input; if (!k) return;
  if (k === 'qdraft') { QDRAFT[t.name] = t.value; saveDraft(); if (t.name === 'date') { const d = document.getElementById('q-day'); if (d) d.textContent = C.dayName(t.value) + ' ' + C.fmtDate(t.value); } return; }
  if (k.startsWith('rep-text:')) { U.rep.draft.dirty = true; U.rep.draft.sections[Number(k.split(':')[1])].text = t.value; return; }
  if (k === 'rep-title') { U.rep.draft.dirty = true; U.rep.draft.title = t.value; return; }
  const [area, key] = k.split(':'); const map = { log: U.log, plan: U.plan, lit: U.lit, exp: U.exp };
  if (map[area]) { map[area][key] = t.value; clearTimeout(INPUT_T); INPUT_T = setTimeout(render, 220); }
});
document.addEventListener('toggle', e => { if (e.target.dataset && e.target.dataset.toggle === 'qmore') { QDRAFT.open = e.target.open; saveDraft(); } }, true);
document.addEventListener('focusout', e => { if (PENDING_WHILE_TYPING) setTimeout(() => { if (!isTyping() && PENDING_WHILE_TYPING) { PENDING_WHILE_TYPING = false; render(); } }, 50); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (document.getElementById('modal-host').innerHTML) closeModal(); else if (DR) closeDrawer(); else closeRail(); } });
/* drag & drop for kanban */
document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('[data-drag]'); if (c) { e.dataTransfer.setData('text/plain', c.dataset.drag); e.dataTransfer.effectAllowed = 'move'; } });
document.addEventListener('dragover', e => { const col = e.target.closest && e.target.closest('[data-drop]'); if (col) { e.preventDefault(); document.querySelectorAll('.col.over').forEach(x => x !== col && x.classList.remove('over')); col.classList.add('over'); } });
document.addEventListener('dragleave', e => { const col = e.target.closest && e.target.closest('[data-drop]'); if (col && !col.contains(e.relatedTarget)) col.classList.remove('over'); });
document.addEventListener('drop', e => { const col = e.target.closest && e.target.closest('[data-drop]'); if (!col) return; e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); const T = Store.get('tasks', id); if (T && T.status !== col.dataset.drop) { const prev = JSON.parse(JSON.stringify(T)); T.status = col.dataset.drop; normalizeRecord('tasks', T, prev); Store.put('tasks', T); toast('Moved to ' + T.status); } });
/* tooltips */
document.addEventListener('mouseover', e => { const el = e.target.closest && e.target.closest('[data-tip]'); const tip = document.getElementById('tip'); if (!tip) return; if (el) { tip.textContent = el.dataset.tip; tip.hidden = false; } else tip.hidden = true; });
document.addEventListener('mousemove', e => { const tip = document.getElementById('tip'); if (tip && !tip.hidden) { const x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 8); const y = Math.min(e.clientY + 14, window.innerHeight - tip.offsetHeight - 8); tip.style.left = x + 'px'; tip.style.top = y + 'px'; } });
/* 3D tilt on cards */
let TILT_EL = null; const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
document.addEventListener('pointermove', e => {
  if (REDUCE || e.pointerType === 'touch') return;
  const el = e.target.closest && e.target.closest('[data-tilt]');
  if (TILT_EL && TILT_EL !== el) { TILT_EL.style.removeProperty('--rx'); TILT_EL.style.removeProperty('--ry'); TILT_EL.classList.remove('tilting'); TILT_EL = null; }
  if (!el) return; TILT_EL = el; el.classList.add('tilting');
  const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
  const k = Math.min(1, 260 / Math.max(r.width, 1)) * 9;
  el.style.setProperty('--rx', (-py * k).toFixed(2) + 'deg'); el.style.setProperty('--ry', (px * k).toFixed(2) + 'deg');
});
document.addEventListener('pointerleave', () => { if (TILT_EL) { TILT_EL.style.removeProperty('--rx'); TILT_EL.style.removeProperty('--ry'); TILT_EL.classList.remove('tilting'); TILT_EL = null; } });
function afterRender(v) {
  if (v === 'dashboard') { const host = document.getElementById('stage3d'); if (host && window.LAST_WEEKS) { const ok = U.dash.view2d ? false : City3D.mount(host, window.LAST_WEEKS); if (!ok) City3D.fallback(host, window.LAST_WEEKS); } }
  else City3D.pause();
}
window.addEventListener('hashchange', () => { closeRail(); render(); const v = document.getElementById('view'); if (v) { v.focus({ preventScroll: true }); window.scrollTo(0, 0); } });

(async function boot() {
  let t = ''; try { t = localStorage.getItem('rt-theme') || ''; } catch (e) {}
  shell(); applyTheme(t);
  Store.on(scheduleRender); Store.on(() => GSync.onChange());
  await Store.init();
  render();
  GSync.onChange(); // catch up on edits made since the last sync
})();
// web app: pick up edits made on another device when this page comes back into view
let HIDDEN_AT = 0;
document.addEventListener('visibilitychange', () => {
  if (Store.mode !== 'gas') return;
  if (document.hidden) { HIDDEN_AT = Date.now(); return; }
  if (HIDDEN_AT && Date.now() - HIDDEN_AT > 30000 && !DR) Store.reload().then(ok => { if (ok) Store.emit(); });
});
