/* Archivio S.I. Cobas — Sanità e Pubblico Impiego
   Nessuna dipendenza esterna. Dati in assets/archivio.json, testo in assets/testi.json */

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
const COMPARTI_BREVI = {
  'pubblica': 'pubblica', 'privata': 'privata',
  'cooperative': 'cooperative sociali', 'trasversale': ''
};
const TIPI = {
  'volantino': 'Volantino', 'comunicato': 'Comunicato',
  'opuscolo': 'Opuscolo', 'iniziativa': 'Iniziativa'
};

const PASSO = 5;              // quanti documenti si vedono all'inizio

let DATI = [], ENTI = {}, TESTI = null;
let vista = [], mostrati = PASSO;
const stato = { settore: '', comparto: '', tipo: '', tema: '', q: '', ordine: 'desc' };

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const senzaAccenti = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase();

/* ---------- avvio ---------- */
fetch('assets/archivio.json')
  .then(r => r.json())
  .then(d => {
    DATI = d.documenti; ENTI = d.enti || {};
    init();
    fetch('assets/testi.json').then(r => r.json()).then(t => {
      TESTI = t;
      if (stato.q) rendi();          // la ricerca si allarga al testo appena arriva
    }).catch(() => {});
  })
  .catch(() => {
    $('#grid').innerHTML =
      '<p style="grid-column:1/-1">Non riesco a caricare l\'archivio. Apri la cartella con ' +
      '<code>python3 _sorgenti/serve.py</code>: col doppio clic il browser blocca la lettura dei dati.</p>';
  });

function init() {
  const anni = DATI.map(d => +d.data.slice(0, 4));
  $('#stat-tot').textContent = DATI.length;
  $('#stat-anni').textContent = Math.min(...anni) + '–' + Math.max(...anni);
  $('#stat-enti').textContent = Object.keys(ENTI).length;

  riempiTendina('#f-settore', 'settore', SETTORI, 'Tutti i settori');
  riempiTendina('#f-comparto', 'comparto', COMPARTI, 'Tutta la sanità');
  riempiTendina('#f-tipo', 'tipo', TIPI, 'Tutti i tipi');
  riempiTemi();

  $('#f-ordine').addEventListener('change', e => { stato.ordine = e.target.value; ripristinaPasso(); rendi(); });

  const q = $('#q');
  q.addEventListener('input', e => {
    stato.q = senzaAccenti(e.target.value.trim());
    $('#pulisci').hidden = !e.target.value;
    ripristinaPasso(); rendi();
  });
  $('#pulisci').addEventListener('click', () => {
    q.value = ''; stato.q = ''; $('#pulisci').hidden = true; q.focus(); ripristinaPasso(); rendi();
  });

  // "/" porta il cursore nella ricerca da qualunque punto della pagina
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)
        && !$('#overlay').classList.contains('is-open')) {
      e.preventDefault(); q.focus(); q.select();
    }
  });

  $('#suggeriti').addEventListener('click', e => {
    const b = e.target.closest('[data-cerca]'); if (!b) return;
    q.value = b.dataset.cerca; stato.q = senzaAccenti(b.dataset.cerca);
    $('#pulisci').hidden = false; ripristinaPasso(); rendi();
    $('#documenti').scrollIntoView({ block: 'start' });
  });

  $('#mostra-altri').addEventListener('click', () => {
    const primoNuovo = mostrati;
    mostrati += PASSO * 3;
    rendi();
    const el = $$('#grid .card')[primoNuovo];
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });

  $('#azzera').addEventListener('click', azzera);
  $('#azzera2').addEventListener('click', azzera);

  rendiEnti();
  avviaVisore();
  rendi();
  apriDaURL();
}

function azzera() {
  Object.assign(stato, { settore: '', comparto: '', tipo: '', tema: '', q: '' });
  $('#q').value = ''; $('#pulisci').hidden = true;
  ['#f-settore', '#f-comparto', '#f-tipo', '#f-tema'].forEach(s => $(s).value = '');
  $('#box-comparto').hidden = true;
  ripristinaPasso(); rendi();
}

function ripristinaPasso() { mostrati = PASSO; }

/* ---------- tendine ---------- */
function riempiTendina(sel, chiave, mappa, etichettaTutti) {
  const s = $(sel);
  s.innerHTML = `<option value="">${etichettaTutti}</option>` +
    Object.entries(mappa).map(([k, v]) =>
      `<option value="${k}">${esc(v)} (${DATI.filter(d => d[chiave] === k).length})</option>`).join('');
  s.addEventListener('change', e => {
    stato[chiave] = e.target.value;
    if (chiave === 'settore') {
      $('#box-comparto').hidden = e.target.value !== 'sanita';
      if (e.target.value !== 'sanita') { stato.comparto = ''; $('#f-comparto').value = ''; }
    }
    ripristinaPasso(); rendi();
  });
}

// i temi stanno in una tendina: i più usati in cima, poi tutti in ordine alfabetico
function riempiTemi() {
  const conta = {};
  DATI.forEach(d => d.tag.forEach(t => conta[t] = (conta[t] || 0) + 1));
  const perUso = Object.entries(conta).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const alfabetico = [...perUso].sort((a, b) => a[0].localeCompare(b[0], 'it'));
  const opt = ([t, n]) => `<option value="${esc(t)}">${esc(t)} (${n})</option>`;

  $('#f-tema').innerHTML =
    `<option value="">Tutti i temi (${perUso.length})</option>` +
    `<optgroup label="I più ricorrenti">${perUso.slice(0, 8).map(opt).join('')}</optgroup>` +
    `<optgroup label="Tutti, in ordine alfabetico">${alfabetico.map(opt).join('')}</optgroup>`;

  $('#f-tema').addEventListener('change', e => { stato.tema = e.target.value; ripristinaPasso(); rendi(); });
}

/* ---------- ricerca ---------- */
function trova(d, q) {
  const scheda = senzaAccenti([d.titolo, d.etichetta, d.hook, d.tag.join(' '),
    (d.luoghi || []).join(' '), d.data].join(' '));
  if (scheda.includes(q)) return 'scheda';
  if (TESTI && TESTI[d.slug] && TESTI[d.slug].includes(q)) return 'testo';
  return null;
}

function estratto(slug, q) {
  const t = TESTI && TESTI[slug]; if (!t) return '';
  const i = t.indexOf(q); if (i < 0) return '';
  const a = Math.max(0, i - 50), b = Math.min(t.length, i + q.length + 70);
  return (a > 0 ? '…' : '') + esc(t.slice(a, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' +
         esc(t.slice(i + q.length, b)) + (b < t.length ? '…' : '');
}

/* ---------- elenco ---------- */
function rendi() {
  vista = DATI.filter(d => {
    if (stato.settore && d.settore !== stato.settore) return false;
    if (stato.comparto && d.comparto !== stato.comparto) return false;
    if (stato.tipo && d.tipo !== stato.tipo) return false;
    if (stato.tema && !d.tag.includes(stato.tema)) return false;
    if (stato.q) { d._dove = trova(d, stato.q); if (!d._dove) return false; }
    else d._dove = null;
    return true;
  }).sort((a, b) => stato.ordine === 'desc' ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data));

  const filtrato = !!(stato.settore || stato.comparto || stato.tipo || stato.tema || stato.q);
  $('#azzera').hidden = !filtrato;

  const nelTesto = stato.q ? vista.filter(d => d._dove === 'testo').length : 0;
  const visti = Math.min(mostrati, vista.length);
  $('#conteggio').innerHTML = vista.length === 0
    ? 'nessun risultato'
    : (filtrato
        ? `<b>${vista.length}</b> ${vista.length === 1 ? 'documento' : 'documenti'}` +
          (stato.q ? ` per <em>${esc(stato.q)}</em>` : '') +
          (nelTesto ? ` · <span class="dentro">${nelTesto} dentro il testo</span>` : '')
        : `i più recenti · <b>${visti}</b> di ${vista.length} in archivio`) +
      (filtrato && vista.length > visti ? ` · ne vedi ${visti}` : '');

  $('#empty').hidden = vista.length > 0;
  $('#grid').innerHTML = vista.slice(0, mostrati).map(scheda).join('');
  $$('#grid .card').forEach((c, i) => c.addEventListener('click', () => apri(i)));

  const restanti = vista.length - mostrati;
  const b = $('#mostra-altri');
  b.hidden = restanti <= 0;
  if (restanti > 0) b.innerHTML = `Mostra altri ${Math.min(restanti, PASSO * 3)} <small>ne restano ${restanti}</small>`;
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
        ? `<span class="estratto"><b>nel testo</b> ${estratto(d.slug, stato.q)}</span>`
        : (d.comparto && d.comparto !== 'trasversale' ? `<span class="cassetto">${COMPARTI_BREVI[d.comparto]}</span>` : '')}
    </span>
  </button>`;
}

/* ---------- indice per ospedale ---------- */
function rendiEnti() {
  const box = $('#enti-grid'); if (!box) return;
  box.innerHTML = Object.entries(ENTI).sort((a, b) => b[1].n - a[1].n).map(([k, e]) => `
    <a class="ente-card" href="ente.html?e=${k}">
      <span class="tipo">${esc(e.tipo)}</span>
      <h3>${esc(e.nome)}</h3>
      <span class="citta">${esc(e.citta)}</span>
      <span class="barra-ente"><b>${e.n}</b> ${e.n === 1 ? 'documento' : 'documenti'} · ${e.dal.slice(0,4)}–${e.al.slice(0,4)}</span>
    </a>`).join('');
}

/* ---------- visore ---------- */
let indice = -1, ultimoFocus = null;

function avviaVisore() {
  $('#m-close').addEventListener('click', chiudi);
  $('#overlay').addEventListener('click', e => { if (e.target.id === 'overlay') chiudi(); });
  $('#m-prev').addEventListener('click', () => apri((indice - 1 + vista.length) % vista.length));
  $('#m-next').addEventListener('click', () => apri((indice + 1) % vista.length));
  $('#m-tags').addEventListener('click', e => {
    const t = e.target.closest('[data-tema]'), l = e.target.closest('[data-luogo]');
    if (t) { stato.tema = t.dataset.tema; $('#f-tema').value = t.dataset.tema; stato.q = ''; $('#q').value = ''; $('#pulisci').hidden = true; }
    else if (l) { stato.q = senzaAccenti(l.dataset.luogo); $('#q').value = l.dataset.luogo; $('#pulisci').hidden = false; }
    else return;
    chiudi(); ripristinaPasso(); rendi();
    $('#documenti').scrollIntoView({ block: 'start' });
  });
  document.addEventListener('keydown', e => {
    if (!$('#overlay').classList.contains('is-open')) return;
    if (e.key === 'Escape') chiudi();
    if (e.key === 'ArrowLeft') $('#m-prev').click();
    if (e.key === 'ArrowRight') $('#m-next').click();
    if (e.key === 'Tab') trappolaFocus(e);
  });
}

function apri(i) {
  const d = vista[i]; if (!d) return;
  indice = i;
  ultimoFocus = ultimoFocus || document.activeElement;
  const [aa, mm, gg] = d.data.split('-');
  $('#m-sub').textContent = [TIPI[d.tipo], SETTORI[d.settore], d.comparto ? COMPARTI[d.comparto] : '',
    d.stimata ? MESI[+mm - 1] + ' ' + aa + ' (data stimata)' : gg + '/' + mm + '/' + aa]
    .filter(Boolean).join(' · ');
  $('#m-title').textContent = d.titolo;
  $('#m-hook').textContent = d.hook;
  $('#m-tags').innerHTML =
    d.tag.map(t => `<button class="tag" data-tema="${esc(t)}">${esc(t)}</button>`).join('') +
    (d.luoghi || []).map(l => `<button class="tag luogo" data-luogo="${esc(l)}">${esc(l)}</button>`).join('');
  $('#m-dl').href = d.pdf;
  $('#m-dl').setAttribute('download', d.slug + '.pdf');

  const stretto = window.matchMedia('(max-width: 820px)').matches;
  $('#m-viewer').innerHTML = stretto
    ? `<div class="mobile-fallback">
         <img src="${d.thumb}" alt="Prima pagina di ${esc(d.titolo)}">
         <a class="btn-red" href="${d.pdf}" target="_blank" rel="noopener">Apri il documento (${d.pagine} ${d.pagine === 1 ? 'pagina' : 'pagine'})</a>
         <p class="note">Su telefono il PDF si apre nel lettore del sistema: si legge meglio.</p>
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
  history.replaceState(null, '', location.pathname);
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
  const m = location.hash.match(/doc=([\w-]+)/); if (!m) return;
  const i = vista.findIndex(d => d.slug === m[1]);
  if (i < 0) return;
  if (i >= mostrati) { mostrati = i + 1; rendi(); }
  apri(i);
}
