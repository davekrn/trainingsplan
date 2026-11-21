/* Trainingsplan – Timer & Darstellung. Inhalte und Zeiten stehen in plan.json. */
'use strict';

/* ---------- Einstellungen ---------- */
const PREP_SEC = 5;      // Vorlauf "Position einnehmen" vor Halte-/Intervall-Übungen
const SWITCH_SEC = 5;    // Seitenwechsel
const NEXT_SEC = 10;     // Übergang zur nächsten Übung (Routine am Stück)
const HOLD_TICK = 5;     // kurzer Piep alle x Sekunden während Halten/Belastung

/* ---------- Ton (Web Audio) ---------- */
let ctx = null;
function audio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC();
    // iOS: stummen Puffer abspielen, um Audio freizuschalten
    const b = ctx.createBuffer(1, 1, 22050), s = ctx.createBufferSource();
    s.buffer = b; s.connect(ctx.destination); s.start(0);
  }
  // iOS 17+: Töne auch bei Stummschalter
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}
  if (ctx.state !== 'running') ctx.resume();
  return ctx;
}
function tone(freq, dur, vol = 0.5, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = 'triangle'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.setValueAtTime(vol, t + Math.max(0.02, dur - 0.04));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(ctx.destination);
  o.start(t); o.stop(t + dur + 0.02);
}
const SND = {
  tick:  () => tone(880, 0.07, 0.45),
  count: () => tone(660, 0.10, 0.5),
  go:    () => tone(1000, 0.25, 0.6),
  phase: () => { tone(760, 0.12, 0.55); tone(760, 0.12, 0.55, 0.18); },
  end:   () => tone(1320, 0.8, 0.7),
};

/* ---------- Bildschirm wach halten ---------- */
let wakeLock = null;
const video = () => document.getElementById('nosleep');
function setWake(txt) { document.getElementById('wakeStatus').textContent = 'Bildschirm-wach: ' + txt; }
async function keepAwake() {
  if ('wakeLock' in navigator && window.isSecureContext) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      setWake('aktiv (Wake Lock)'); return;
    } catch (e) { /* weiter mit Video */ }
  }
  try { await video().play(); setWake('aktiv (Video-Methode)'); }
  catch (e) { setWake('nicht möglich – Auto-Sperre ggf. auf «Nie» stellen'); }
}
function releaseAwake() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  video().pause();
  setWake('inaktiv');
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && run && !run.paused) keepAwake();
});

/* ---------- Hilfen ---------- */
const $ = (sel, el = document) => el.querySelector(sel);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = s => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const store = {
  get(k, d) { try { const v = localStorage.getItem('tp_' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tp_' + k, JSON.stringify(v)); } catch (e) {} },
};

/* ---------- History: erledigte Trainingstage (localStorage, pro Datum) ---------- */
const WD = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const DAY = 864e5;
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmtD = dt => dt.toISOString().slice(0, 10);                       // '2026-11-21'
const dmy = dt => dt.getUTCDate() + '.' + (dt.getUTCMonth() + 1) + '.';   // '21.11.'
const wdOf = dt => (dt.getUTCDay() + 6) % 7;                             // 0 = Montag
function today() { const n = new Date(); return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate())); }
function isoWeek(dt) {   // ISO 8601: Woche beginnt Montag, KW 1 enthält den 4. Januar
  const t = new Date(dt.getTime() + (3 - wdOf(dt)) * DAY);   // Donnerstag derselben Woche
  const y = t.getUTCFullYear();
  return { y, w: 1 + Math.floor((t - Date.UTC(y, 0, 1)) / DAY / 7) };
}
const weekLabel = dt => { const k = isoWeek(dt); return 'W' + (k.y % 10) + String(k.w).padStart(2, '0'); };
const hist = {
  all() { const a = store.get('history', []); return Array.isArray(a) ? a : []; },
  save(a) { store.set('history', [...new Set(a)].filter(x => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort()); },
  has(d) { return this.all().includes(d); },
  toggle(d) { const a = this.all(); this.save(a.includes(d) ? a.filter(x => x !== d) : [...a, d]); },
};
// Datum zu einem Wochentag-Tab: der letzte solche Wochentag bis und mit heute
function dateForWeekday(i) { const t = today(); return new Date(t.getTime() - ((wdOf(t) - i + 7) % 7) * DAY); }

function buildDoneBar(i) {
  const bar = el('div', 'donebar');
  const b = el('button', 'b-hist'); b.type = 'button'; b.dataset.wd = i;
  b.addEventListener('click', () => { hist.toggle(b.dataset.date); refreshDone(); });
  bar.append(b, el('p', 'hint', 'Erneut tippen hebt die Markierung auf.'));
  return bar;
}
function refreshDone() {
  document.querySelectorAll('.b-hist').forEach(b => {
    const dt = dateForWeekday(Number(b.dataset.wd)), d = fmtD(dt), done = hist.has(d);
    b.dataset.date = d;
    b.classList.toggle('done', done);
    b.textContent = (done ? '✓ Training erledigt' : '○ Training erledigt?') + ` – ${WD[wdOf(dt)]} ${dmy(dt)}`;
    b.setAttribute('aria-pressed', done);
  });
  const h = document.getElementById('history'); if (h && h.classList.contains('on')) renderHistory(h);
}

function renderHistory(sec) {
  sec.innerHTML = '';
  sec.append(el('h2', null, 'History'));
  const set = new Set(hist.all()), t = today();
  const mon = dt => new Date(dt.getTime() - wdOf(dt) * DAY);
  const first = set.size ? mon(parseD([...set].sort()[0])) : mon(t);
  const tbl = el('table', 'ov hist');
  tbl.innerHTML = '<thead><tr><th>Woche</th>' + WD.map(w => `<th>${w}</th>`).join('') + '</tr></thead>';
  const tb = el('tbody');
  for (let m = mon(t); m >= first; m = new Date(m.getTime() - 7 * DAY)) {   // neueste Woche oben
    let row = `<td><b>${weekLabel(m)}</b><span class="from">${dmy(m)}</span></td>`;
    for (let i = 0; i < 7; i++) {
      const dt = new Date(m.getTime() + i * DAY), d = fmtD(dt);
      const cls = [set.has(d) ? 'ok' : '', d === fmtD(t) ? 'now' : '', dt > t ? 'fut' : ''].filter(Boolean).join(' ');
      row += `<td class="${cls}">${set.has(d) ? '✓' : ''}</td>`;
    }
    tb.append(el('tr', null, row));
  }
  tbl.append(tb); sec.append(tbl);
  if (!set.size) sec.append(el('p', 'hint', 'Noch keine Einträge. Am Ende jedes Tages-Tabs „Training erledigt“ antippen.'));

  sec.append(el('h3', null, 'Sicherung'));
  sec.append(el('p', 'hint', 'Die History liegt nur auf diesem Gerät (Home-Bildschirm-App und Safari getrennt). Gelegentlich exportieren, z. B. in iCloud Drive.'));
  const bar = el('div', 'histbtns');
  const ex = el('button', 'small', '⇪ Exportieren'); ex.type = 'button'; ex.addEventListener('click', exportHistory);
  const im = el('button', 'small', '⇩ Importieren'); im.type = 'button';
  const inp = el('input'); inp.type = 'file'; inp.accept = '.json,application/json'; inp.hidden = true;
  im.addEventListener('click', () => inp.click());
  inp.addEventListener('change', () => { if (inp.files[0]) importHistory(inp.files[0]); inp.value = ''; });
  bar.append(ex, im, inp); sec.append(bar);
  const st = el('p', 'hint', esc(histMsg)); st.id = 'histStatus'; sec.append(st);
  const ps = el('p', 'hint'); sec.append(ps);
  if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted()
    .then(p => { ps.textContent = 'Dauerhafte Speicherung: ' + (p ? 'gewährt' : 'nicht gewährt (Browser darf Daten bei Platzmangel löschen)'); })
    .catch(() => {});
}
let histMsg = '';   // Meldung nach Import
async function exportHistory() {
  const data = { app: 'trainingsplan', type: 'history', format: 1, exported: new Date().toISOString(), dates: hist.all() };
  const name = `trainingsplan-history-${fmtD(today())}.json`;
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
  try {
    const file = new File([blob], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return; }
  } catch (e) { if (e && e.name === 'AbortError') return; }
  const a = el('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
function importHistory(file) {
  const st = () => document.getElementById('histStatus');
  file.text().then(t => {
    const j = JSON.parse(t);
    const dates = (Array.isArray(j) ? j : j.dates || []).filter(x => typeof x === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x));
    if (!dates.length) throw new Error('leer');
    const before = new Set(hist.all());
    hist.save([...before, ...dates]);
    const added = dates.filter(d => !before.has(d)).length;
    histMsg = `Import: ${dates.length} Einträge gelesen, ${added} neu hinzugefügt.`;
    renderHistory(document.getElementById('history')); refreshDone();
  }).catch(() => { histMsg = 'Import fehlgeschlagen – keine gültige Sicherungsdatei.'; const s = st(); if (s) s.textContent = histMsg; });
}
// Browser bitten, die Daten nicht automatisch zu löschen (Safari ab iOS 17)
try { if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {}); } catch (e) {}

/* ---------- Phasen aus Timer-Konfiguration ---------- */
// Phase: {label, sec (null = manuell), kind: 'work'|'rest', tick, count (3-2-1 am Ende), w (Widget)}
function phasesFor(cfg, w, opts = {}) {
  const P = [];
  const prep = opts.noPrep ? [] : [{ label: 'Position einnehmen', sec: PREP_SEC, kind: 'rest', count: true, w }];
  if (cfg.type === 'hold') {
    P.push(...prep);
    for (let r = 1; r <= cfg.rounds; r++) {
      for (let s = 1; s <= cfg.sides; s++) {
        const parts = [];
        if (cfg.rounds > 1) parts.push(`Durchgang ${r}/${cfg.rounds}`);
        if (cfg.sides > 1) parts.push(`Seite ${s}/${cfg.sides}`);
        P.push({ label: parts.join(' · ') || 'Halten', sec: cfg.sec, kind: 'work', tick: HOLD_TICK, w });
        if (s < cfg.sides) P.push({ label: 'Seite wechseln', sec: SWITCH_SEC, kind: 'rest', count: true, w });
      }
      if (r < cfg.rounds) P.push({ label: 'Pause', sec: cfg.rest, kind: 'rest', count: true, w });
    }
  } else if (cfg.type === 'interval') {
    P.push(...prep);
    for (let r = 1; r <= cfg.rounds; r++) {
      P.push({ label: `Runde ${r}/${cfg.rounds} – Belastung`, sec: cfg.work, kind: 'work', tick: HOLD_TICK, w });
      if (r < cfg.rounds) P.push({ label: `Runde ${r}/${cfg.rounds} – Erholung`, sec: cfg.rest, kind: 'rest', count: true, w });
    }
  } else if (cfg.type === 'sets') {
    for (let i = 1; i <= cfg.sets; i++) {
      P.push({ label: `Satz ${i}/${cfg.sets} – los!`, sec: null, kind: 'work', w });
      if (i < cfg.sets) P.push({ label: `Pause nach Satz ${i}`, sec: cfg.rest, kind: 'rest', count: true, w });
    }
  } else if (cfg.type === 'duration') {
    P.push({ label: 'Läuft', sec: cfg.sec, kind: 'work', tick: cfg.tick, w });
  }
  return P;
}
function summary(cfg) {
  if (cfg.type === 'hold') return `${cfg.sec} s halten` + (cfg.sides > 1 ? ' · pro Seite' : '');
  if (cfg.type === 'interval') return `${cfg.work} s / ${cfg.rest} s`;
  if (cfg.type === 'sets') return `Pause ${cfg.rest} s zwischen den Sätzen`;
  if (cfg.type === 'duration') return `${mmss(cfg.sec)} min`;
  return '';
}
const STEP_KEY = { hold: 'rounds', interval: 'rounds', sets: 'sets' };
const STEP_LBL = { hold: 'Durchgänge', interval: 'Runden', sets: 'Sätze' };

/* ---------- Ablaufsteuerung (immer nur ein Timer aktiv) ---------- */
let run = null; // {phases, i, start, elapsedDone, paused, pausedAt, lastSec, onEnd}
let loop = null;

function startRun(phases, opts = {}) {
  stopRun(true);
  audio();
  run = { phases, i: -1, paused: false, lastSec: -1, ...opts };
  keepAwake();
  nextPhase(performance.now());
  loop = setInterval(tickLoop, 100);
}
function stopRun(silent) {
  if (!run) return;
  clearInterval(loop); loop = null;
  const ws = new Set(run.phases.map(p => p.w));
  ws.forEach(w => resetWidget(w));
  run = null;
  releaseAwake();
}
function nextPhase(at) {
  const prev = run.phases[run.i];
  run.i++;
  const p = run.phases[run.i];
  if (!p) { // fertig
    SND.end();
    const ws = new Set(run.phases.map(q => q.w));
    clearInterval(loop); loop = null; run = null; releaseAwake();
    ws.forEach(w => finishWidget(w));
    return;
  }
  if (prev && prev.w !== p.w) resetWidget(prev.w, true);
  run.start = at; run.lastSec = 0;
  if (p.kind === 'work') SND.go(); else if (prev && prev.kind === 'work') SND.phase();
  showPhase(p);
}
function tickLoop() {
  if (!run || run.paused) return;
  const p = run.phases[run.i];
  const now = performance.now();
  const el = (now - run.start) / 1000;
  const whole = Math.floor(el);
  for (let s = run.lastSec + 1; s <= whole; s++) {
    if (p.sec != null && s >= p.sec) break;
    if (p.tick && s % p.tick === 0) SND.tick();
    if (p.count && p.sec - s <= 3 && p.sec - s >= 1) SND.count();
  }
  run.lastSec = Math.max(run.lastSec, whole);
  if (p.sec != null && el >= p.sec) { nextPhase(run.start + p.sec * 1000); return; }
  updateTime(p, el);
}
function pauseRun() {
  if (!run) return;
  if (!run.paused) { run.paused = true; run.pausedAt = performance.now(); releaseAwake(); }
  else { run.start += performance.now() - run.pausedAt; run.paused = false; audio(); keepAwake(); }
  const w = run.phases[run.i].w;
  $('.b-pause', w.box).textContent = run.paused ? '▶ Weiter' : '❚❚ Pause';
}
function manualDone() { // "Satz fertig" / Phase überspringen
  if (!run) return;
  audio();
  nextPhase(performance.now());
}

/* ---------- Timer-Widget ---------- */
function buildTimer(item, key) {
  const cfg = { ...item.timer, ...store.get('ovr_' + key, {}) };
  const box = el('div', 'tw');
  const w = { box, cfg, key, item };
  const sk = STEP_KEY[cfg.type];
  box.innerHTML = `
    <div class="tsum"><span class="sm">${esc(summary(cfg))}</span>
      ${sk ? `<span class="step"><span>${STEP_LBL[cfg.type]}</span><button type="button" data-d="-1" aria-label="weniger">−</button><b>${cfg[sk]}</b><button type="button" data-d="1" aria-label="mehr">+</button></span>` : ''}
    </div>
    <div class="tdisp"><span class="tphase"></span><span class="ttime"></span></div>
    <div class="tbtns">
      <button type="button" class="b-start">▶ Start</button>
      <button type="button" class="b-done" hidden>✓ Satz fertig</button>
      <button type="button" class="b-pause" hidden>❚❚ Pause</button>
      <button type="button" class="b-skip" hidden>⏭</button>
      <button type="button" class="b-stop" hidden>■ Stop</button>
    </div>`;
  box.querySelectorAll('.step button').forEach(b => b.addEventListener('click', () => {
    cfg[sk] = Math.max(1, Math.min(20, cfg[sk] + Number(b.dataset.d)));
    $('.step b', box).textContent = cfg[sk];
    const o = store.get('ovr_' + key, {}); o[sk] = cfg[sk]; store.set('ovr_' + key, o);
  }));
  $('.b-start', box).addEventListener('click', () => startRun(phasesFor(cfg, w)));
  $('.b-stop', box).addEventListener('click', () => stopRun());
  $('.b-pause', box).addEventListener('click', pauseRun);
  $('.b-done', box).addEventListener('click', manualDone);
  $('.b-skip', box).addEventListener('click', manualDone);
  WIDGETS[key] = w;
  return box;
}
function showPhase(p) {
  const w = p.w, b = w.box;
  b.classList.add('run'); b.classList.toggle('rest', p.kind === 'rest');
  b.closest('.item').classList.add('active');
  $('.tphase', b).textContent = (run && run.seqLabel ? run.seqLabel(p) : '') + p.label;
  const manual = p.sec == null;
  $('.b-start', b).hidden = true;
  $('.b-done', b).hidden = !manual;
  $('.b-pause', b).hidden = manual;
  $('.b-pause', b).textContent = '❚❚ Pause';
  $('.b-skip', b).hidden = manual || p.kind === 'work';
  $('.b-stop', b).hidden = false;
  updateTime(p, 0);
  const r = b.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.top < 130 || r.bottom > vh) {
    // Timer an den unteren Bildschirmrand setzen, damit die Übung darüber möglichst sichtbar bleibt
    const top = Math.max(vh - r.height - 20, 130);   // nicht unter die Kopfzeile
    window.scrollTo({ top: window.scrollY + r.top - top, behavior: 'smooth' });
  }
}
function updateTime(p, el) {
  $('.ttime', p.w.box).textContent = p.sec == null ? mmss(el) : mmss(p.sec - el);
}
function resetWidget(w, keepHighlight) {
  const b = w.box;
  b.classList.remove('run', 'rest');
  b.closest('.item').classList.remove('active');
  $('.b-start', b).hidden = false; $('.b-start', b).textContent = '▶ Start';
  ['.b-done', '.b-pause', '.b-skip', '.b-stop'].forEach(s => $(s, b).hidden = true);
}
function finishWidget(w) {
  resetWidget(w);
  $('.b-start', w.box).textContent = '✓ Fertig – nochmals';
}
const WIDGETS = {};

/* ---------- Mobilitätsroutine am Stück ---------- */
function startSequence(passes) {
  showTab('mob');
  const ws = MOB_KEYS.map(k => WIDGETS[k]);
  const P = [];
  for (let pass = 1; pass <= passes; pass++) {
    ws.forEach((w, n) => {
      const first = pass === 1 && n === 0;
      if (!first) P.push({ label: 'Nächste Übung – Position einnehmen', sec: NEXT_SEC, kind: 'rest', count: true, w });
      P.push(...phasesFor(w.cfg, w, { noPrep: !first }));
    });
  }
  const total = ws.length;
  startRun(P, {
    seqLabel: p => {
      const n = ws.indexOf(p.w) + 1;
      return `Übung ${n}/${total} · `;
    },
  });
}
let MOB_KEYS = [];
let IMG_V = '';   // '?v=<version>' aus plan.json – erzwingt Neuladen der Bilder nach Änderungen

/* ---------- Darstellung ---------- */
function splitTitle(t) {
  const m = t.match(/^(.*?)\s*\(([A-Za-z0-9 /\-]+)\)$/);
  return m && /Stretch|Fold|Hip/i.test(m[2]) ? [m[1], m[2]] : [t, ''];
}
function renderItem(it, key, secId) {
  if (it.kind === 'heading') return el('h3', null, esc(it.text));
  if (it.kind === 'sub') return el('p', 'sub', esc(it.text));
  if (it.kind === 'text' && !it.timer && !it.link) return el('p', null, esc(it.text));
  const card = el('div', 'item' + (it.img ? '' : ' noimg'));
  if (it.img) { const im = el('img'); im.src = it.img + IMG_V; im.alt = ''; im.loading = 'lazy'; card.append(im); }
  const body = el('div', 'txt');
  if (it.title) {
    const [de, en] = splitTitle(it.title);
    const t = el('div', 'ttl', esc(de) + (en ? `<span class="en">${esc(en)}</span>` : ''));
    card.append(t);
  }
  body.textContent = it.text;
  card.append(body);
  if (it.timer) card.append(buildTimer(it, key));
  if (it.link) {
    const lk = el('div', 'lk');
    const go = el('button', null, '→ Zur Mobilitätsroutine'); go.type = 'button';
    go.addEventListener('click', () => showTab('mob'));
    const seq = el('button', 'seq', `▶ Routine starten${it.sequence > 1 ? ` (${it.sequence}×)` : ''}`); seq.type = 'button';
    seq.addEventListener('click', () => startSequence(it.sequence || 1));
    lk.append(seq, go);
    card.append(lk);
  }
  if (secId === 'mob' && it.timer) MOB_KEYS.push(key);
  return card;
}
/* ---------- About: README.md als einfache Markdown-Ansicht ---------- */
function mdInline(t) {
  return esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<i>$2</i>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
}
function mdToHtml(src) {
  const L = src.replace(/\r/g, '').split('\n'); let h = '', i = 0;
  const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  while (i < L.length) {
    const l = L[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)/))) { const n = Math.min(m[1].length + 1, 4); h += `<h${n}>${mdInline(m[2])}</h${n}>`; i++; continue; }
    if (l.startsWith('>')) { let q = []; while (i < L.length && L[i].startsWith('>')) q.push(L[i++].replace(/^>\s?/, '')); h += `<blockquote>${mdInline(q.join(' '))}</blockquote>`; continue; }
    if (l.trim().startsWith('|') && /^\s*\|?\s*:?-/.test(L[i + 1] || '')) {
      h += '<table class="ov md"><thead><tr>' + cells(l).map(c => `<th>${mdInline(c)}</th>`).join('') + '</tr></thead><tbody>'; i += 2;
      while (i < L.length && L[i].trim().startsWith('|')) h += '<tr>' + cells(L[i++]).map(c => `<td>${mdInline(c)}</td>`).join('') + '</tr>';
      h += '</tbody></table>'; continue;
    }
    if (/^\s*([-*]|\d+\.)\s/.test(l)) {
      const tag = /^\s*\d+\./.test(l) ? 'ol' : 'ul'; h += `<${tag}>`;
      while (i < L.length && /^\s*([-*]|\d+\.)\s/.test(L[i])) h += `<li>${mdInline(L[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''))}</li>`;
      h += `</${tag}>`; continue;
    }
    let p = []; while (i < L.length && L[i].trim() && !/^(#|>|\||\s*([-*]|\d+\.)\s)/.test(L[i])) p.push(L[i++]);
    h += `<p>${mdInline(p.join(' '))}</p>`;
  }
  return h;
}
function renderAbout(sec, lang) {
  lang = lang || store.get('aboutLang', 'en');
  const file = lang === 'de' ? 'README.de.md' : 'README.md';
  fetch(file)
    .then(r => { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(t => { // Sprachzeile für GitHub ausblenden – die App hat den E/D-Schalter
      sec.innerHTML = mdToHtml(t.split('\n').filter(l => !/\]\(README(\.de)?\.md\)/.test(l)).join('\n')); })
    .catch(() => { sec.innerHTML = `<h2>About</h2><p>${file} konnte nicht geladen werden.</p>`; })
    .finally(() => {
      // Sprachwahl E/D rechts neben dem Titel
      let h = sec.querySelector('h2'); if (!h) { h = el('h2', null, 'About'); sec.prepend(h); }
      h.classList.add('withlang');
      const sw = el('span', 'lang');
      [['en', 'E', 'English'], ['de', 'D', 'Deutsch']].forEach(([k, lbl, ttl]) => {
        const b = el('button', 'small' + (k === lang ? ' on' : ''), lbl); b.type = 'button'; b.title = ttl;
        b.setAttribute('aria-pressed', k === lang);
        b.addEventListener('click', () => { if (k !== lang) { store.set('aboutLang', k); renderAbout(sec, k); } });
        sw.append(b);
      });
      h.append(sw);
    });
}
const TABS = [];
function tabLabel(s) {
  if (s.id === 'start') return 'Übersicht';
  if (s.id === 'mob') return 'Mobilität';
  if (s.id === 'alltag') return 'Alltag';
  if (s.id === 'about') return 'About';
  if (s.id === 'history') return 'History';
  const m = s.id.match(/^tag(\d)$/); return m ? ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'][m[1] - 1] : s.title;
}
function showTab(id) {
  document.querySelectorAll('main section').forEach(s => s.classList.toggle('on', s.id === id));
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.id === id));
  const b = $(`#tabs button[data-id="${id}"]`); if (b) b.scrollIntoView({ inline: 'center', block: 'nearest' });
  window.scrollTo(0, 0);
  refreshDone();   // Datum kann sich seit dem Start geändert haben (Mitternacht)
  if (id === 'history') renderHistory(document.getElementById('history'));
  store.set('tab', id);
  if (location.hash !== '#' + id) history.replaceState(null, '', '#' + id);
}

function render(plan) {
  document.getElementById('title').textContent = 'Trainingsplan';
  document.title = 'Trainingsplan';
  const main = document.getElementById('content'); main.innerHTML = '';
  const nav = document.getElementById('tabs'); nav.innerHTML = '';

  // Übersicht = Kopfangaben + Raum-Aufteilung + Wochentabelle
  const start = el('section'); start.id = 'start';
  start.append(el('h2', null, 'Übersicht'));
  plan.meta.forEach(m => {
    if (m.list) {
      start.append(el('p', 'meta', `<b>${esc(m.label)}:</b>`));
      start.append(el('ul', 'meta', m.list.map(x => `<li><b>${esc(x.label)}:</b> ${esc(x.text)}</li>`).join('')));
    } else start.append(el('p', 'meta', `<b>${esc(m.label)}:</b> ${esc(m.text)}`));
  });
  const tbl = el('table', 'ov');
  tbl.innerHTML = '<thead><tr><th>Tag</th><th>Raum</th><th>Schwerpunkt</th></tr></thead>';
  const tb = el('tbody');
  plan.overview.forEach(r => {
    const tr = el('tr', null, `<td>${esc(r.name || r.tag)}</td><td>${esc(r.raum)}</td><td>${esc(r.fokus)}</td>`);
    tr.dataset.go = 'tag' + r.tag; tr.addEventListener('click', () => showTab(tr.dataset.go));
    tb.append(tr);
  });
  tbl.append(tb);
  start.append(el('h3', null, 'Wochenübersicht'), tbl);
  main.append(start);

  const secs = [{ id: 'start' }, ...plan.sections.filter(s => s.id !== 'raum')];
  plan.sections.filter(s => s.id !== 'raum').forEach(s => {
    const sec = el('section'); sec.id = s.id;
    sec.append(el('h2', null, esc(s.title)));
    s.items.forEach((it, n) => {
      sec.append(renderItem(it, s.id + '_' + n, s.id));
      if (s.sequence && n === 0) { // Knopf für ganze Routine nach dem Einleitungstext
        const bar = el('div', 'seqbar');
        const b1 = el('button', 'b-start', '▶ Ganze Routine starten'); b1.type = 'button';
        const b2 = el('button', 'small', '2 Durchgänge'); b2.type = 'button';
        b1.addEventListener('click', () => startSequence(1));
        b2.addEventListener('click', () => startSequence(2));
        bar.append(b1, b2); sec.append(bar);
      }
    });
    const tm = s.id.match(/^tag(\d)$/);
    if (tm) sec.append(buildDoneBar(Number(tm[1]) - 1));
    main.append(sec);
  });
  const history = el('section', 'history'); history.id = 'history';
  main.append(history); secs.push({ id: 'history' });
  const about = el('section', 'about'); about.id = 'about';
  main.append(about); secs.push({ id: 'about' }); renderAbout(about);
  secs.forEach(s => {
    const b = el('button', null, tabLabel(s)); b.type = 'button'; b.dataset.id = s.id;
    b.addEventListener('click', () => showTab(s.id));
    nav.append(b);
  });
  const want = location.hash.slice(1) || store.get('tab', 'start');
  showTab(document.getElementById(want) ? want : 'start');
}

document.getElementById('soundTest').addEventListener('click', () => {
  audio();
  SND.tick(); setTimeout(SND.tick, 400); setTimeout(SND.go, 900); setTimeout(SND.phase, 1500); setTimeout(SND.end, 2200);
});

fetch('plan.json', { cache: 'no-store' })
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(p => { IMG_V = p.version ? '?v=' + encodeURIComponent(p.version) : ''; render(p); })
  .catch(e => {
    document.getElementById('content').innerHTML =
      '<p><b>plan.json konnte nicht geladen werden.</b><br>Die Seite muss über den Webserver geöffnet werden (http://…/trainingsplan/), nicht als Datei.</p>';
  });

// Offline-Betrieb (nur über HTTPS oder localhost möglich)
if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js')
    .then(() => navigator.serviceWorker.ready)
    .then(() => { document.getElementById('offStatus').textContent = 'Offline: bereit'; })
    .catch(() => { document.getElementById('offStatus').textContent = 'Offline: Fehler'; });
} else {
  document.getElementById('offStatus').textContent = 'Offline: nicht verfügbar (kein HTTPS)';
}
