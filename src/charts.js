/* ===== Icons, pills, small SVG charts ===== */
const ic = p => '<svg viewBox="0 0 24 24" aria-hidden="true">' + p + '</svg>';
const ICON = {
  dashboard: ic('<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>'),
  log: ic('<path d="M4 4h12l4 4v12H4z"/><path d="M8 10h8M8 14h8M8 18h5"/>'),
  plan: ic('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>'),
  literature: ic('<path d="M4 5a2 2 0 0 1 2-2h5v18H6a2 2 0 0 1-2-2z"/><path d="M20 5a2 2 0 0 0-2-2h-5v18h5a2 2 0 0 0 2-2z"/>'),
  experiments: ic('<path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.7 3h10.6a2 2 0 0 0 1.7-3l-5-9V3"/><path d="M7.5 15h9"/>'),
  writing: ic('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>'),
  meetings: ic('<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M2 20c.5-3 3-5 6-5s5.5 2 6 5M14 15.3c.6-.2 1.3-.3 2-.3 3 0 5.5 2 6 5"/>'),
  reports: ic('<path d="M6 3h9l4 4v14H6z"/><path d="M10 17v-4M13 17V9M16 17v-6"/>'),
  more: ic('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  plus: ic('<path d="M12 5v14M5 12h14"/>'),
  x: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
  menu: ic('<path d="M4 7h16M4 12h16M4 17h16"/>'),
  theme: ic('<path d="M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z"/>'),
  left: ic('<path d="M15 6l-6 6 6 6"/>'), right: ic('<path d="M9 6l6 6-6 6"/>'),
};
function statusPill(s) {
  if (!s) return '<span class="pill planned nodot">No status</span>';
  const cls = /done|completed|accepted|published|read$|ready|addressed/i.test(s) ? 'done' : /progress|running|reading|drafting|review|investigat|submitted|revision|preparing|downloading|skimmed/i.test(s) ? 'progress' : /block|fail|reject|abandon|dropped/i.test(s) ? 'blocked' : 'planned';
  return '<span class="pill ' + cls + '">' + esc(s) + '</span>';
}
function kindChip(settings, focus) { if (!focus) return ''; return '<span class="chip k-' + C.focusKind(settings, focus) + '">' + esc(focus) + '</span>'; }
const KIND_LABEL = { research: 'Research', teaching: 'Teaching', admin: 'Administration', other: 'Other' };
const KIND_ORDER = ['research', 'teaching', 'admin', 'other'];
function fmtH(n) { return n == null ? '—' : (Math.round(n * 100) / 100).toString(); }

function niceMax(v) { if (v <= 0) return 4; const p = Math.pow(10, Math.floor(Math.log10(v))); const n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }

/** stacked weekly bars (research/teaching/admin/other) */
function weeklyChart(series) {
  const W = 640, H = 210, L = 34, R = 8, T = 10, B = 28; const iw = W - L - R, ih = H - T - B;
  const max = niceMax(Math.max(...series.map(s => s.total), 1)); const n = series.length; const bw = Math.min(30, iw / n * .62); const step = iw / n;
  let g = '<g class="grid">'; for (let i = 0; i <= 4; i++) { const y = T + ih - ih * i / 4; g += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (L - 6) + '" y="' + (y + 3.5) + '" text-anchor="end">' + fmtH(max * i / 4) + '</text>'; } g += '</g>';
  let bars = '';
  series.forEach((s, i) => {
    const x = L + step * i + (step - bw) / 2; let y = T + ih;
    const tip = 'Week of ' + C.fmtDate(s.start) + '\nTotal ' + fmtH(s.total) + ' h' + KIND_ORDER.filter(k => s[k]).map(k => '\n' + KIND_LABEL[k] + ': ' + fmtH(s[k]) + ' h').join('');
    const segs = KIND_ORDER.filter(k => s[k] > 0);
    segs.forEach((k, si) => { const h = ih * s[k] / max; y -= h; const top = si === segs.length - 1; bars += '<path d="' + roundTopRect(x, y + (si ? 0 : 0), bw, Math.max(h - (si < segs.length - 1 ? 0 : 0), 0.5), top ? 3 : 0) + '" fill="var(--s-' + k + ')" stroke="var(--surface)" stroke-width="' + (segs.length > 1 ? 1 : 0) + '"/>'; });
    bars += '<rect x="' + (L + step * i) + '" y="' + T + '" width="' + step + '" height="' + ih + '" fill="transparent" data-tip="' + esc(tip) + '"/>';
    if (i % Math.ceil(n / 8) === 0 || i === n - 1) bars += '<text x="' + (x + bw / 2) + '" y="' + (H - 9) + '" text-anchor="middle">' + C.fmtShort(s.start) + '</text>';
  });
  return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Hours per week, stacked by activity kind">' + g + '<line class="axis" x1="' + L + '" x2="' + (W - R) + '" y1="' + (T + ih) + '" y2="' + (T + ih) + '"/>' + bars + '</svg>';
}
function roundTopRect(x, y, w, h, r) { r = Math.min(r, w / 2, h); return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z'; }

/** horizontal bars: rows [{label, value, kind, sub}] */
function hbars(rows, unit) {
  if (!rows.length) return '<div class="empty">No hours in this selection.</div>';
  const max = Math.max(...rows.map(r => r.value), 0.0001);
  return '<div style="display:grid;gap:8px">' + rows.map(r => '<div data-tip="' + esc(r.label + ': ' + fmtH(r.value) + ' ' + unit + (r.sub ? '\n' + r.sub : '')) + '" style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;align-items:center"><span class="small" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(r.label) + '</span><span class="num small">' + fmtH(r.value) + ' ' + unit + (r.sub ? ' <span class="muted">' + esc(r.sub) + '</span>' : '') + '</span><div class="bar" style="grid-column:1/-1;height:7px"><i style="width:' + Math.max(2, 100 * r.value / max) + '%;background:var(--s-' + (r.kind || 'research') + ')"></i></div></div>').join('') + '</div>';
}

/** calendar heatmap, weeks ending at endISO */
function heatmap(daily, endISO, weeks) {
  const cell = 12, gap = 3, L = 28, T = 16; const start = C.addDays(C.weekStart(endISO), -7 * (weeks - 1));
  const W = L + weeks * (cell + gap), H = T + 7 * (cell + gap) + 4;
  const vals = Object.values(daily).map(d => d.hours).filter(v => v > 0); const mx = Math.max(...vals, 1);
  const lvl = h => h <= 0 ? 0 : h < mx * .25 ? 1 : h < mx * .5 ? 2 : h < mx * .8 ? 3 : 4;
  let out = ''; let lastM = ''; let lastX = -99;
  for (let w = 0; w < weeks; w++) {
    const ws = C.addDays(start, 7 * w); const m = ws.slice(0, 7);
    if (m !== lastM) { const x = L + w * (cell + gap); if (x - lastX > 30) { out += '<text x="' + x + '" y="10">' + C.MONTHS[Number(ws.slice(5, 7)) - 1] + '</text>'; lastX = x; } lastM = m; }
    for (let d = 0; d < 7; d++) {
      const day = C.addDays(ws, d); if (day > endISO) continue;
      const v = daily[day]; const h = v ? v.hours : 0;
      const tip = C.dayName(day) + ' ' + C.fmtDate(day) + '\n' + (v ? fmtH(v.hours) + ' h · ' + v.sessions + ' session(s)' : 'No sessions');
      out += '<rect x="' + (L + w * (cell + gap)) + '" y="' + (T + d * (cell + gap)) + '" width="' + cell + '" height="' + cell + '" rx="2.5" fill="var(--heat-' + (v && !h ? 1 : lvl(h)) + ')" data-tip="' + esc(tip) + '"/>';
    }
  }
  ['Mon', '', 'Wed', '', 'Fri', '', ''].forEach((t, i) => { if (t) out += '<text x="0" y="' + (T + i * (cell + gap) + 10) + '">' + t + '</text>'; });
  return '<div class="heat-wrap"><svg class="chart" style="min-width:' + W + 'px;max-width:' + (W * 1.25) + 'px" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Daily hours heatmap">' + out + '</svg></div>' +
    '<div class="legend" style="margin-top:6px;align-items:center"><span class="muted small">Less</span>' + [0, 1, 2, 3, 4].map(i => '<i style="background:var(--heat-' + i + ');margin:0"></i>').join('') + '<span class="muted small">More (max ' + fmtH(mx) + ' h/day)</span></div>';
}
