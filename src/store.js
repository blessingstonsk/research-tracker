/* ===== Storage: artifact db (private, owner-only rules), the Google Sheet behind the Apps Script web app, or browser storage ===== */
const C = window.Core;
const COLS = ['settings','logs','tasks','objectives','milestones','papers','gaps','experiments','datasets','manuscripts','meetings','reports','backups'];
const LS_KEY = 'research-tracker-data-v1';
const HAS_GAS = !!(window.google && google.script && google.script.run);
/** Call a server function of the Apps Script web app (gas/Code.gs). Arguments and results travel as JSON strings. */
function gas(fn, ...args) { return new Promise((res, rej) => google.script.run.withSuccessHandler(res).withFailureHandler(e => rej({ code: 'sheet_error', message: (e && e.message) || String(e) }))[fn](...args)); }
const Store = {
  mode: 'loading', db: null, maps: {}, loaded: {}, inflight: 0, lastSaved: null, error: null, chains: {}, listeners: [], _snap: null, sheetUrl: '', readOnly: false,
  async init() {
    COLS.forEach(c => { this.maps[c] = new Map(); });
    let db = null;
    try { if (window.claude && typeof window.claude.use === 'function') db = await window.claude.use('db'); } catch (e) { db = null; }
    if (db) {
      this.db = db; this.mode = 'db';
      await new Promise(resolve => {
        let pending = COLS.length; const done = () => { if (--pending === 0) resolve(); };
        const timer = setTimeout(resolve, 12000);
        COLS.forEach(col => {
          let first = true;
          db.collection(col).onSnapshot(snap => {
            const m = new Map();
            snap.docs.forEach(d => { if (d.exists) m.set(d.id, Object.assign(JSON.parse(JSON.stringify(d.data())), { id: d.id })); });
            this.maps[col] = m; this._snap = null;
            if (first) { first = false; this.loaded[col] = true; done(); if (Object.keys(this.loaded).length === COLS.length) clearTimeout(timer); }
            else this.emit();
          }, err => { this.error = 'Live sync stopped (' + err.code + '). Reload the page to reconnect.'; this.emit(); });
        });
      });
    } else if (HAS_GAS) {
      this.mode = 'gas';
      // never write defaults over a sheet we could not read
      if (!(await this.reload())) { this.readOnly = true; return; }
    } else {
      this.mode = 'local';
      try { const raw = localStorage.getItem(LS_KEY); if (raw) { const d = JSON.parse(raw); COLS.forEach(c => (d[c] || []).forEach(r => this.maps[c].set(r.id, r))); } }
      catch (e) { this.error = 'Browser storage is unavailable here; changes will be lost on reload.'; }
    }
    await this.ensureDefaults();
  },
  async ensureDefaults() {
    if (!this.maps.settings.get('main')) {
      const s = JSON.parse(JSON.stringify(C.DEFAULT_SETTINGS)); s.createdAt = C.nowStamp();
      const ops = [this.put('settings', s, { silent: true })];
      if (!this.maps.objectives.size) C.DEFAULT_OBJECTIVES.forEach(o => ops.push(this.put('objectives', Object.assign({}, o, { createdAt: C.nowStamp() }), { silent: true })));
      if (!this.maps.milestones.size) C.defaultMilestones().forEach(m => ops.push(this.put('milestones', Object.assign(m, { createdAt: C.nowStamp() }), { silent: true })));
      await Promise.all(ops);
    } else {
      // forward-fill any list added in later versions
      const s = this.maps.settings.get('main'); let changed = false;
      for (const k of Object.keys(C.DEFAULT_SETTINGS)) if (s[k] === undefined) { s[k] = JSON.parse(JSON.stringify(C.DEFAULT_SETTINGS[k])); changed = true; }
      if (changed) await this.put('settings', s, { silent: true });
    }
  },
  /** Web app: (re)read every record from the sheet, e.g. after editing on another device. */
  async reload() {
    if (this.inflight) return false;
    try {
      const d = JSON.parse(await gas('loadAll')); this.sheetUrl = d.url;
      COLS.forEach(c => { const m = new Map(); (d.data[c] || []).forEach(r => m.set(r.id, r)); this.maps[c] = m; });
      this.readOnly = false; this.error = null; this._snap = null; return true;
    } catch (e) { this.error = 'Could not read your Google Sheet (' + e.message + '). Reload the page to try again.'; return false; }
  },
  on(fn) { this.listeners.push(fn); },
  emit() { this._snap = null; this.listeners.forEach(f => { try { f(); } catch (e) { console.error(e); } }); },
  /** plain-object snapshot of all collections (arrays) */
  state() {
    if (this._snap) return this._snap;
    const s = {}; COLS.forEach(c => s[c] = Array.from(this.maps[c].values()));
    s.settings = this.maps.settings.get('main') || JSON.parse(JSON.stringify(C.DEFAULT_SETTINGS));
    this._snap = s; return s;
  },
  get(col, id) { return this.maps[col].get(id); },
  saveLocal() {
    if (this.mode !== 'local') return;
    try { const d = {}; COLS.forEach(c => d[c] = Array.from(this.maps[c].values())); localStorage.setItem(LS_KEY, JSON.stringify(d)); this.lastSaved = new Date(); }
    catch (e) { this.error = 'Could not save to browser storage.'; }
  },
  _write(col, id, fn) {
    const path = col + '/' + id;
    this.inflight++; this.emitStatus();
    const p = (this.chains[path] || Promise.resolve()).then(fn).then(() => { this.lastSaved = new Date(); this.error = null; if (this.mode === 'gas') GSync.queueRefresh(); },
      async e => {
        if (e && (e.code === 'unavailable' || e.code === 'sheet_error')) { await new Promise(r => setTimeout(r, 600 + Math.random() * 800)); try { await fn(); this.lastSaved = new Date(); return; } catch (e2) { e = e2; } }
        this.error = e && e.code === 'quota_exceeded' ? 'Storage is full: ' + e.message + '. Export a backup and permanently delete items from Trash.' : 'Save failed (' + ((e && (e.code === 'sheet_error' ? e.message : e.code)) || 'error') + '). Your change is shown but may not be stored.';
        throw e;
      }).finally(() => { this.inflight--; this.emitStatus(); });
    this.chains[path] = p.catch(() => {});
    return p;
  },
  put(col, rec, opt) {
    opt = opt || {};
    if (!rec.id) rec.id = C.uid(col.slice(0, 3));
    if (!opt.keepStamp) rec.updatedAt = C.nowStamp();
    if (!rec.createdAt) rec.createdAt = rec.updatedAt;
    const clean = JSON.parse(JSON.stringify(rec));
    this.maps[col].set(rec.id, clean); this._snap = null;
    if (!opt.silent) this.emit();
    if (this.mode === 'db') return this._write(col, rec.id, () => this.db.collection(col).doc(rec.id).set(clean)).catch(() => {});
    if (this.mode === 'gas') return this.readOnly ? Promise.resolve() : this._write(col, rec.id, () => gas('saveRecords', col, JSON.stringify([clean]))).catch(() => {});
    this.saveLocal(); this.emitStatus(); return Promise.resolve();
  },
  async putMany(col, recs) { for (const r of recs) { if (!r.id) r.id = C.uid(col.slice(0, 3)); r.updatedAt = r.updatedAt || C.nowStamp(); r.createdAt = r.createdAt || r.updatedAt; this.maps[col].set(r.id, JSON.parse(JSON.stringify(r))); }
    this._snap = null; this.emit();
    if (this.mode === 'db') { const ps = recs.map(r => this._write(col, r.id, () => this.db.collection(col).doc(r.id).set(this.maps[col].get(r.id))).catch(() => {})); await Promise.all(ps); }
    else if (this.mode === 'gas') { if (this.readOnly) return; for (let i = 0; i < recs.length; i += 100) { const part = recs.slice(i, i + 100).map(r => this.maps[col].get(r.id)); await this._write(col, '_batch', () => gas('saveRecords', col, JSON.stringify(part))).catch(() => {}); } }
    else this.saveLocal(); },
  softDelete(col, id) { const r = this.get(col, id); if (!r) return; r.deleted = true; r.deletedAt = C.nowStamp(); return this.put(col, r); },
  restore(col, id) { const r = this.get(col, id); if (!r) return; delete r.deleted; delete r.deletedAt; return this.put(col, r); },
  hardDelete(col, id) {
    this.maps[col].delete(id); this._snap = null; this.emit();
    if (this.mode === 'db') return this._write(col, id, () => this.db.collection(col).doc(id).delete()).catch(() => {});
    if (this.mode === 'gas') return this.readOnly ? Promise.resolve() : this._write(col, id, () => gas('deleteRecords', col, JSON.stringify([id]))).catch(() => {});
    this.saveLocal(); return Promise.resolve();
  },
  exportAll(includeBackups) { const d = {}; COLS.forEach(c => { if (c === 'backups' && !includeBackups) return; d[c] = Array.from(this.maps[c].values()); }); return { app: 'research-tracker', version: 1, exportedAt: C.nowStamp(), timezone: C.TZ, data: d }; },
  emitStatus() { const el = document.getElementById('save-status'); if (el) el.innerHTML = saveStatusHTML(); }
};
function saveStatusHTML() {
  const S = Store; const where = S.mode === 'db' ? 'Private cloud storage' : S.mode === 'gas' ? 'Your Google Sheet' : S.mode === 'local' ? 'This browser only' : 'Connecting…';
  if (S.error) return '<span class="dot err"></span><span title="' + esc(S.error) + '">' + esc(S.error.length > 46 ? S.error.slice(0, 44) + '…' : S.error) + '</span>';
  if (S.inflight) return '<span class="dot busy"></span><span>Saving…</span>';
  const t = S.lastSaved ? ' · saved ' + S.lastSaved.toLocaleTimeString('en-GB', { timeZone: C.TZ, hour: '2-digit', minute: '2-digit' }) : '';
  return '<span class="dot ok"></span><span>' + where + t + '</span>';
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
