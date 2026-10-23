/* ===== One-way sync: tracker → the viewer's Google Sheet, through their Google Sheets connector ===== */
const GSync = {
  SERVER: 'Google Sheets', mcp: undefined, busy: false, status: '', error: '', armed: false, timer: null,
  cfg() { return Store.state().settings.gsheet || {}; },
  saveCfg(patch) { const st = JSON.parse(JSON.stringify(Store.state().settings)); st.gsheet = Object.assign({}, st.gsheet || {}, patch); Store.put('settings', st); },
  parseId(u) { u = String(u || '').trim(); const m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/); if (m) return m[1]; return /^[a-zA-Z0-9_-]{30,}$/.test(u) ? u : ''; },
  url(id) { return 'https://docs.google.com/spreadsheets/d/' + id + '/edit'; },
  async ns() { if (this.mcp !== undefined) return this.mcp; try { this.mcp = (window.claude && window.claude.use) ? await window.claude.use('mcp') : null; } catch (e) { this.mcp = null; } return this.mcp; },
  async call(tool, input) {
    const m = await this.ns(); if (!m) throw { code: 'unavailable', message: 'Connectors are not available in this view.' };
    const r = await m.callTool(this.SERVER, tool, input);
    let p = r && r.payload; if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) {} }
    return p;
  },
  explain(e) {
    const c = e && e.code;
    if (c === 'server_not_connected') return 'Google Sheets is not connected for your account. Add it in claude.ai Settings → Connectors, then try again.';
    if (c === 'needs_reauth') return 'Your Google Sheets connection expired. Reconnect it in claude.ai Settings → Connectors.';
    if (c === 'not_in_manifest' || c === 'approval_required' || c === 'consent_required') return 'The tracker was not allowed to use Google Sheets. Click Sync again and choose Allow.';
    if (c === 'unavailable' || c === 'not_granted' || c === 'capability_disabled') return 'Syncing works when the tracker is opened in Claude (claude.ai or the desktop app), not in the offline copy.';
    if (c === 'tool_error') { const m = String(e.message || ''); if (/not found|404/i.test(m)) return 'That spreadsheet was not found. Check the link and that your Google account can edit it.'; if (/permission|403/i.test(m)) return 'Your Google account cannot edit that spreadsheet.'; return 'Google Sheets reported an error: ' + m.slice(0, 200); }
    return 'Sync failed (' + (c || 'error') + '). ' + String((e && e.message) || '').slice(0, 160);
  },
  setStatus(s, err) { this.status = s; this.error = err ? s : ''; const el = document.getElementById('gs-status'); if (el) el.innerHTML = this.statusHTML(); },
  statusHTML() { return this.error ? '<div class="note bad">' + esc(this.error) + '</div>' : this.status ? '<div class="note">' + esc(this.status) + '</div>' : ''; },
  /** Create any missing tabs, their header rows, the dashboard formulas and formatting. Safe to run again. */
  async setup(id) {
    const meta = await this.call('get_spreadsheet', { spreadsheetId: id, fields: ['sheets.properties.sheetId', 'sheets.properties.title'] });
    const existing = ((meta && meta.sheets) || []).map(s => s.properties || s).filter(p => p && p.title);
    const { req, created } = SheetSpec.structureRequests(existing);
    if (!created.length) return 0;
    this.setStatus('Creating ' + created.length + ' tab(s)…');
    if (req.length) await this.call('update_spreadsheet', { spreadsheetId: id, requests: req });
    for (const t of created) {
      const vals = t.dashboard ? SheetSpec.dashboardValues() : SheetSpec.headerValues(t);
      await this.call('update_values', { spreadsheetId: id, range: "'" + t.title + "'!A1", values: vals.map(r => r.map(v => v == null ? null : v)) });
    }
    this.setStatus('Applying the template style…');
    const fmt = created.flatMap(t => SheetSpec.formatRequests(t, true));
    for (let i = 0; i < fmt.length; i += 150) await this.call('update_spreadsheet', { spreadsheetId: id, requests: fmt.slice(i, i + 150) });
    return created.length;
  },
  /** Web app: records are already in the sheet; this only rebuilds the readable tabs from them. */
  async refreshTabs(opts) {
    if (this.busy) { this.queueRefresh(); return; }
    this.busy = true; this.renderButtons();
    try { this.setStatus('Updating the sheet tabs…'); const r = JSON.parse(await gas('refreshTabs')); this.setStatus('Sheet tabs updated at ' + r.at + ' (' + r.rows + ' row(s)).'); if (!opts.auto) toast('Sheet tabs updated'); }
    catch (e) { this.setStatus('Could not update the sheet tabs: ' + e.message + '. Your records are saved; try Update tabs again.', true); }
    finally { this.busy = false; this.renderButtons(); }
  },
  queueRefresh() { clearTimeout(this.timer); this.timer = setTimeout(() => this.refreshTabs({ auto: true }), 4000); },
  async sync(opts) {
    opts = opts || {};
    if (Store.mode === 'gas') return this.refreshTabs(opts);
    if (this.busy) return; const id = this.cfg().id;
    if (!id) { this.setStatus('Paste your Google Sheet link first.', true); return; }
    this.busy = true; this.renderButtons();
    try {
      this.setStatus('Checking the spreadsheet…');
      const made = await this.setup(id);
      const s = Store.state(); const data = SheetSpec.buildData(s);
      this.setStatus('Writing your records…');
      const tabs = SheetSpec.TABS.filter(t => !t.dashboard);
      await this.call('batch_clear_values', { spreadsheetId: id, ranges: tabs.map(t => "'" + t.title + "'!A" + SheetSpec.FIRST + ':AZ') });
      let rows = 0;
      for (const t of tabs) { const d = data[t.title]; if (!d.length) continue; rows += d.length;
        await this.call('update_values', { spreadsheetId: id, range: SheetSpec.rangeFor(t.title, d.length, d[0].length), values: d }); }
      const when = new Date(); const stamp = C.fmtDate(C.todayISO(when)) + ', ' + when.toLocaleTimeString('en-GB', { timeZone: C.TZ, hour: '2-digit', minute: '2-digit' });
      await this.call('update_values', { spreadsheetId: id, range: "'Dashboard'!A2", values: [['Explainable VLMs for Autonomous Driving. Synced from Research Tracker on ' + stamp + ' (Asia/Kolkata). Edit records in the tracker; each sync replaces the data tabs.']] });
      this.sig = JSON.stringify(data);
      this.saveCfg({ lastSync: when.toISOString(), lastRows: rows, lastHash: C.fnv1a(this.sig) });
      this.armed = true;
      this.setStatus((made ? 'Template created and ' : '') + 'Synced ' + rows + ' row(s) at ' + stamp + '.');
      if (!opts.auto) toast('Synced to Google Sheets');
    } catch (e) { console.warn(e); this.setStatus(this.explain(e), true); if (!opts.auto) toast('Google Sheets sync failed', true); }
    finally { this.busy = false; this.renderButtons(); }
  },
  renderButtons() { document.querySelectorAll('[data-act="gs-sync"]').forEach(b => { b.disabled = this.busy; b.textContent = this.busy ? 'Syncing…' : (b.dataset.label || 'Sync now'); }); },
  /** Auto-sync shortly after edits, once a sync has succeeded before (in this visit or an earlier one). */
  onChange() { const c = this.cfg(); if (Store.mode !== 'db' || !c.auto || !c.id || !(this.armed || c.lastSync) || this.busy) return;
    const sig = JSON.stringify(SheetSpec.buildData(Store.state())); if (sig === this.sig || (this.sig === undefined && C.fnv1a(sig) === c.lastHash)) return;
    clearTimeout(this.timer); this.timer = setTimeout(() => this.sync({ auto: true }), 15000); }
};
function gsheetSettingsHTML() {
  if (Store.mode === 'gas') return '<div class="grid g-side" style="align-items:start"><section class="card"><header><h2>Saved in your Google Sheet</h2>' + (Store.sheetUrl ? '<a class="btn" href="' + esc(Store.sheetUrl) + '" target="_blank" rel="noopener">Open sheet ↗</a>' : '') + '</header>' +
    '<p class="small" style="margin-top:0">Every entry you make here is written straight into your Google Sheet. The Daily Log, Tasks, Literature and other tabs are rebuilt a few seconds after each change, and the Dashboard tab recalculates from them.</p>' +
    '<div class="row"><button class="btn primary" data-act="gs-sync" data-label="Update tabs now">Update tabs now</button><button class="btn" data-act="gs-reload">Reload records from the sheet</button></div><div id="gs-status" style="margin-top:10px">' + GSync.statusHTML() + '</div></section>' +
    '<section class="card prose"><h2>Good to know</h2><p class="small">Open this page on any phone, tablet or computer where you are signed in to the same Google account. Edits from another device appear when you return to this page or click Reload.</p><p class="small">The hidden <b>_data</b> tab holds the records the tracker reads. Edit entries here in the tracker, not in the sheet: the readable tabs are rebuilt on every change. Google Sheets keeps earlier versions under File → Version history.</p></section></div>';
  const c = GSync.cfg(); const last = c.lastSync ? new Date(c.lastSync).toLocaleString('en-GB', { timeZone: C.TZ, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  return '<div class="grid g-side" style="align-items:start"><section class="card"><header><h2>Save your data to Google Sheets</h2>' + (c.id ? '<a class="btn" href="' + esc(GSync.url(c.id)) + '" target="_blank" rel="noopener">Open sheet ↗</a>' : '') + '</header>' +
    '<label class="f"><span>Google Sheet link</span><input id="gs-url" type="url" placeholder="https://docs.google.com/spreadsheets/d/…/edit" value="' + esc(c.id ? GSync.url(c.id) : '') + '"></label>' +
    '<div class="row" style="margin-top:10px"><button class="btn" data-act="gs-save">Save link</button><button class="btn primary" data-act="gs-sync" data-label="' + (c.lastSync ? 'Sync now' : 'Set up template & sync') + '"' + (c.id ? '' : ' disabled') + '>' + (c.lastSync ? 'Sync now' : 'Set up template & sync') + '</button>' +
    '<label class="row small" style="gap:6px"><input type="checkbox" id="gs-auto"' + (c.auto ? ' checked' : '') + '> Sync automatically after changes</label></div>' +
    '<div class="small muted" style="margin-top:8px">' + (last ? 'Last synced ' + last + (c.lastRows != null ? ' · ' + c.lastRows + ' row(s)' : '') : 'Not synced yet.') + '</div><div id="gs-status" style="margin-top:10px">' + GSync.statusHTML() + '</div></section>' +
    '<section class="card prose"><h2>Steps</h2><ol style="padding-left:18px;margin:8px 0 0;display:grid;gap:6px"><li>Open <b>sheets.new</b> in your browser to create a blank Google Sheet, and name it.</li><li>Copy its link from the address bar and paste it here, then click <b>Save link</b>.</li><li>Click <b>Set up template & sync</b>. The first time, Claude asks you to allow Google Sheets for this tracker: choose Allow.</li><li>The tracker creates the Dashboard, Daily Log, Tasks, Objectives, Milestones, Literature, Research Gaps, Experiments, Datasets, Writing, Meetings and Lists tabs, then copies every record.</li><li>Click <b>Sync now</b> whenever you want the sheet updated, or tick automatic sync.</li></ol>' +
    '<p class="small">The sheet is a copy of the tracker. Keep editing in the tracker: each sync replaces the rows on the data tabs. Dashboard figures in the sheet are live formulas over those rows. Syncing needs the Google Sheets connector on your Claude account and works in claude.ai or the desktop app, not in the offline file.</p></section></div>';
}
