/* Archivio S.I. Cobas — Sanità e Pubblico Impiego
   Nessuna dipendenza esterna. I dati stanno in assets/archivio.json */

const MESI = ['gen','feb','mar','apr','mag','giu','lug','ago','set','ott','nov','dic'];
const SETTORI = {
  'sanita': 'Sanità',
  'pubblico-impiego': 'Pubblico impiego',
  'rnls': 'Rete Nazionale Lavoro Sicuro'
};
const COMPARTI = {
  'pubblica': 'Sanità pubblica',
  'privata': 'Sanità privata e accreditata',
  'cooperative': 'Cooperative sociali e terzo settore',
  'trasversale': 'Trasversale al settore'
};
// nella griglia il cassetto va corto: la scheda è stretta
const COMPARTI_BREVI = {
  'pubblica': 'pubblica', 'privata': 'privata',
  'cooperative': 'cooperative sociali', 'trasversale': ''
};
const TIPI = {
  'volantino': 'Volantino',
  'comunicato': 'Comunicato',
  'opuscolo': 'Opuscolo',
  'iniziativa': 'Iniziativa'
};

let DATI = [];
let ENTI = {};
let TESTI = null;          // indice full-text, caricato in secondo piano
let vista = [];
const stato = { settore: '', comparto: '', tipo: '', tag: '', q: '', ordine: 'desc' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- avvio ---------- */
fetch('assets/archivio.json')
  .then(r => r.json())
  .then(d => {
    DATI = d.documenti; ENTI = d.enti || {}; init();
    // il testo completo dei PDF arriva dopo: la pagina è già usabile
    fetch('assets/testi.json').then(r => r.json()).then(t => {
      TESTI = t;
      const s = $('#stato-indice');
      if (s) s.textContent = 'ricerca anche dentro il testo dei documenti';
      if (stato.q) rendi();
    }).catch(() => { const s = $('#stato-indice'); if (s) s.textContent = ''; });
  })
  .catch(() => {
    $('#grid').innerHTML =
      '<p style="grid-column:1/-1">Non riesco a caricare l\'archivio. ' +
      'Se stai aprendo il file con doppio clic, apri invece la cartella con un piccolo server ' +
      '(<code>python3 -m http.server</code>) — il browser blocca la lettura dei dati sui file locali.</p>';
  });

function init() {
  // statistiche
  const anni = DATI.map(d => +d.data.slice(0, 4));
  $('#stat-tot').textContent = DATI.length;
  $('#stat-anni').textContent = (Math.max(...anni) - Math.min(...anni)) + '+';
  $('#stat-vol').textContent = DATI.filter(d => d.tipo === 'volantino').length;
  $('#stat-op').textContent = DATI.filter(d => d.tipo === 'opuscolo').length;

  // conteggi imbuto
  $$('[data-count]').forEach(el => {
    const t = el.dataset.count;
    el.textContent = DATI.filter(d => d.tipo === t).length + ' documenti';
  });

  costruisciChip('#f-settore', SETTORI, 'settore', 'Tutti i settori');
  costruisciChip('#f-comparto', COMPARTI, 'comparto', 'Tutta la sanità');
  costruisciChip('#f-tipo', TIPI, 'tipo', 'Tutti i tipi', true);
  costruisciTemi();

  $('#q').addEventListener('input', e => { stato.q = senzaAccenti(e.target.value.trim()); rendi(); });
  $('#sort').addEventListener('click', () => {
    stato.ordine = stato.ordine === 'desc' ? 'asc' : 'desc';
    $('#sort').textContent = stato.ordine === 'desc' ? '↓ Dal più recente' : '↑ Dal più vecchio';
    rendi();
  });
  $('#reset').addEventListener('click', () => {
    Object.assign(stato, { settore: '', comparto: '', tipo: '', tag: '', q: '' });
    $('#q').value = '';
    sincronizzaChip(); rendi();
  });
  $$('.fcard').forEach(b => b.addEventListener('click', () => {
    stato.tipo = stato.tipo === b.dataset.funnel ? '' : b.dataset.funnel;
    sincronizzaChip(); rendi();
    document.getElementById('archivio').scrollIntoView({ block: 'start' });
  }));

  rendiEnti();
  avviaModale();
  rendi();
  apriDaURL();
}

/* ---------- indice per ospedale / ente ---------- */
function rendiEnti() {
  const box = $('#enti-grid'); if (!box) return;
  const righe = Object.entries(ENTI).sort((a, b) => b[1].n - a[1].n);
  box.innerHTML = righe.map(([k, e]) => `
    <a class="ente-card" href="ente.html?e=${k}">
      <span class="tipo">${esc(e.tipo)}</span>
      <h3>${esc(e.nome)}</h3>
      <span class="citta">${esc(e.citta)}</span>
      <span class="barra"><b>${e.n}</b> ${e.n === 1 ? 'documento' : 'documenti'} · ${e.dal.slice(0, 4)}–${e.al.slice(0, 4)}</span>
    </a>`).join('');
}

/* ---------- filtri ---------- */
function costruisciChip(sel, mappa, chiave, etichettaTutti, rosso) {
  const box = $(sel);
  box.innerHTML = '';
  const tutti = document.createElement('button');
  tutti.className = 'chip' + (rosso ? ' red' : '');
  tutti.textContent = etichettaTutti;
  tutti.dataset.chiave = chiave; tutti.dataset.valore = '';
  box.appendChild(tutti);
  for (const [k, v] of Object.entries(mappa)) {
    const b = document.createElement('button');
    b.className = 'chip' + (rosso ? ' red' : '');
    b.dataset.chiave = chiave; b.dataset.valore = k;
    b.innerHTML = v + ' <small>' + DATI.filter(d => d[chiave] === k).length + '</small>';
    box.appendChild(b);
  }
  box.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    stato[chiave] = b.dataset.valore;
    if (chiave === 'settore' && b.dataset.valore !== 'sanita') stato.comparto = '';
    sincronizzaChip(); rendi();
  });
  sincronizzaChip();
}

/* i temi: tutti i tag usati, i più frequenti in vista, gli altri a scomparsa */
function costruisciTemi() {
  const box = $('#f-tag'); if (!box) return;
  const conta = {};
  DATI.forEach(d => d.tag.forEach(t => conta[t] = (conta[t] || 0) + 1));
  const ordinati = Object.entries(conta).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const VISIBILI = 12;

  box.innerHTML =
    `<button class="chip" data-chiave="tag" data-valore="">Tutti i temi</button>` +
    ordinati.map(([t, n], i) =>
      `<button class="chip tema${i >= VISIBILI ? ' extra' : ''}" data-chiave="tag" data-valore="${esc(t)}"${i >= VISIBILI ? ' hidden' : ''}>${esc(t)} <small>${n}</small></button>`
    ).join('') +
    `<button class="chip mostra-tutti" id="piu-temi" aria-expanded="false">+ ${ordinati.length - VISIBILI} temi</button>`;

  box.addEventListener('click', e => {
    const p = e.target.closest('#piu-temi');
    if (p) {
      const apri = p.getAttribute('aria-expanded') === 'false';
      $$('.chip.extra', box).forEach(c => c.hidden = !apri);
      p.setAttribute('aria-expanded', String(apri));
      p.textContent = apri ? '− meno temi' : `+ ${ordinati.length - VISIBILI} temi`;
      return;
    }
    const b = e.target.closest('.chip'); if (!b || !b.dataset.chiave) return;
    stato.tag = b.dataset.valore;
    sincronizzaChip(); rendi();
  });
}

function sincronizzaChip() {
  $$('.chip').forEach(b => b.setAttribute('aria-pressed', String(stato[b.dataset.chiave] === b.dataset.valore)));
  $$('.fcard').forEach(b => b.setAttribute('aria-pressed', String(stato.tipo === b.dataset.funnel)));
  $('#row-cassetti').hidden = stato.settore !== 'sanita';
}

/* ---------- ricerca: prima le schede, poi il testo dentro i PDF ---------- */
function senzaAccenti(s) {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase();
}

function trova(d, q) {
  const scheda = senzaAccenti([d.titolo, d.etichetta, d.hook, d.tag.join(' '),
    (d.luoghi || []).join(' '), d.data].join(' '));
  if (scheda.includes(q)) return 'scheda';
  if (TESTI && TESTI[d.slug] && TESTI[d.slug].includes(q)) return 'testo';
  return null;
}

// una riga di contesto attorno alla parola cercata
function estratto(slug, q) {
  const t = TESTI && TESTI[slug]; if (!t) return '';
  const i = t.indexOf(q); if (i < 0) return '';
  const a = Math.max(0, i - 55), b = Math.min(t.length, i + q.length + 75);
  return (a > 0 ? '…' : '') + t.slice(a, i) + '<mark>' + t.slice(i, i + q.length) + '</mark>' +
         t.slice(i + q.length, b) + (b < t.length ? '…' : '');
}

/* ---------- griglia ---------- */
function rendi() {
  vista = DATI.filter(d => {
    if (stato.settore && d.settore !== stato.settore) return false;
    if (stato.comparto && d.comparto !== stato.comparto) return false;
    if (stato.tipo && d.tipo !== stato.tipo) return false;
    if (stato.tag && !d.tag.includes(stato.tag)) return false;
    if (stato.q) {
      d._dove = trova(d, stato.q);
      if (!d._dove) return false;
    }
    return true;
  }).sort((a, b) => stato.ordine === 'desc' ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data));

  $('#count').textContent = vista.length;
  const nelTesto = stato.q ? vista.filter(d => d._dove === 'testo').length : 0;
  $('#count-label').textContent = (vista.length === 1 ? 'documento' : 'documenti') +
    (nelTesto ? ` · ${nelTesto} trovati dentro il testo` : '');
  const attivi = [];
  if (stato.settore) attivi.push(SETTORI[stato.settore]);
  if (stato.comparto) attivi.push(COMPARTI[stato.comparto]);
  if (stato.tipo) attivi.push(TIPI[stato.tipo]);
  if (stato.tag) attivi.push('tema: ' + stato.tag);
  if (stato.q) attivi.push('“' + stato.q + '”');
  $('#active-filters').textContent = attivi.length ? '· ' + attivi.join(' · ') : '';

  $('#empty').hidden = vista.length > 0;
  $('#grid').innerHTML = vista.map(scheda).join('');
  $$('#grid .card').forEach((c, i) => c.addEventListener('click', () => apri(i)));
}

function dataBreve(d) {
  const [a, m] = d.data.split('-');
  return MESI[+m - 1] + ' ' + a + (d.stimata ? ' <span class="q" title="data ricavata dal testo, da confermare">?</span>' : '');
}

function scheda(d) {
  return `<button class="card" type="button" aria-label="Apri: ${esc(d.titolo)}">
    <span class="thumb">
      <span class="badge ${d.tipo}">${TIPI[d.tipo]}</span>
      <span class="pagebadge">${d.pagine} ${d.pagine === 1 ? 'pag' : 'pagg'}</span>
      <img src="${d.thumb}" alt="Prima pagina di: ${esc(d.titolo)}" loading="lazy" decoding="async">
    </span>
    <span class="meta">
      <span class="etichetta">${esc(d.etichetta)}</span>
      <span class="data">${dataBreve(d)}</span>
      ${d._dove === 'testo'
        ? `<span class="estratto"><b>nel testo:</b> ${estratto(d.slug, stato.q)}</span>`
        : (d.comparto && d.comparto !== 'trasversale' ? `<span class="cassetto">${COMPARTI_BREVI[d.comparto]}</span>` : '')}
    </span>
  </button>`;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ---------- modale ---------- */
let indice = -1, ultimoFocus = null;

function avviaModale() {
  $('#m-close').addEventListener('click', chiudi);
  $('#m-tags').addEventListener('click', e => {
    const t = e.target.closest('[data-tema]'), l = e.target.closest('[data-luogo]');
    if (t) { stato.tag = t.dataset.tema; stato.q = ''; $('#q').value = ''; }
    else if (l) { stato.q = senzaAccenti(l.dataset.luogo); $('#q').value = l.dataset.luogo; stato.tag = ''; }
    else return;
    chiudi(); sincronizzaChip(); rendi();
    document.getElementById('archivio').scrollIntoView({ block: 'start' });
  });
  $('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') chiudi(); });
  $('#m-prev').addEventListener('click', () => apri((indice - 1 + vista.length) % vista.length));
  $('#m-next').addEventListener('click', () => apri((indice + 1) % vista.length));
  document.addEventListener('keydown', e => {
    if (!$('#overlay').classList.contains('is-open')) return;
    if (e.key === 'Escape') chiudi();
    if (e.key === 'ArrowLeft') $('#m-prev').click();
    if (e.key === 'ArrowRight') $('#m-next').click();
    if (e.key === 'Tab') trappolaFocus(e);
  });
}

function apri(i) {
  indice = i;
  const d = vista[i]; if (!d) return;
  ultimoFocus = ultimoFocus || document.activeElement;
  $('#m-sub').innerHTML = [TIPI[d.tipo], SETTORI[d.settore], d.comparto ? COMPARTI[d.comparto] : '', dataBreve(d)]
    .filter(Boolean).join(' · ');
  $('#m-title').textContent = d.titolo;
  $('#m-hook').textContent = d.hook;
  $('#m-tags').innerHTML = d.tag.map(t => `<button class="tag" data-tema="${esc(t)}">${esc(t)}</button>`).join('') +
    (d.luoghi || []).map(l => `<button class="tag luogo" data-luogo="${esc(l)}">${esc(l)}</button>`).join('');
  $('#m-dl').href = d.pdf;
  $('#m-dl').setAttribute('download', d.slug + '.pdf');

  const stretto = window.matchMedia('(max-width: 820px)').matches;
  $('#m-viewer').innerHTML = stretto
    ? `<div class="mobile-fallback">
         <img src="${d.thumb}" alt="Prima pagina di ${esc(d.titolo)}">
         <a class="btn-red" href="${d.pdf}" target="_blank" rel="noopener">Apri il documento (${d.pagine} ${d.pagine === 1 ? 'pagina' : 'pagine'})</a>
         <p class="note" style="margin-top:12px">Su telefono il PDF si apre nel lettore del sistema: si legge meglio.</p>
       </div>`
    : `<iframe src="${d.pdf}#view=FitH&toolbar=1" title="Documento: ${esc(d.titolo)}" loading="lazy"></iframe>`;

  $('#overlay').classList.add('is-open');
  document.body.style.overflow = 'hidden';
  history.replaceState(null, '', '#doc=' + d.slug);
  $('#m-close').focus();
}

function chiudi() {
  $('#overlay').classList.remove('is-open');
  $('#m-viewer').innerHTML = '';
  document.body.style.overflow = '';
  history.replaceState(null, '', '#archivio');
  if (ultimoFocus) { ultimoFocus.focus(); ultimoFocus = null; }
}

function trappolaFocus(e) {
  const f = $$('#overlay button, #overlay a[href], #overlay iframe');
  if (!f.length) return;
  const primo = f[0], ultimo = f[f.length - 1];
  if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
}

function apriDaURL() {
  const m = location.hash.match(/doc=([\w-]+)/);
  if (!m) return;
  const i = vista.findIndex(d => d.slug === m[1]);
  if (i >= 0) apri(i);
}
