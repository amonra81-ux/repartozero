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

const VETRINA = 5;            // quanti se ne vedono entrando, senza filtri
const PER_PAGINA = 20;        // quanti per pagina quando si sfoglia

let DATI = [], ENTI = {}, TESTI = null, STILI = {}, ICONE = {};
let vista = [];
const stato = { settore: '', comparto: '', tipo: '', tema: '', q: '',
                ordine: 'desc', pagina: 1, sfoglia: false };

// i dati cambiano insieme al codice: la versione evita che il browser
// serva un archivio vecchio tenuto in cache
const VERSIONE = '11';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));
const senzaAccenti = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'").toLowerCase();

/* ---------- avvio ---------- */
fetch('assets/archivio.json?v=' + VERSIONE)
  .then(r => r.json())
  .then(d => {
    DATI = d.documenti; ENTI = d.enti || {};
    STILI = d.stili || {}; ICONE = d.icone || {};
    init();
    fetch('assets/testi.json?v=' + VERSIONE).then(r => r.json()).then(t => {
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
  let attesa;
  q.addEventListener('input', e => {
    $('#pulisci').hidden = !e.target.value;
    clearTimeout(attesa);                     // non si ridisegna a ogni tasto
    attesa = setTimeout(() => {
      stato.q = senzaAccenti(e.target.value.trim());
      ripristinaPasso(); rendi();
    }, 180);
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

  $('#sfoglia').addEventListener('click', () => {
    stato.sfoglia = true; stato.pagina = 1; rendi();
    $('#documenti').scrollIntoView({ block: 'start' });
  });

  $('#pagine').addEventListener('click', e => {
    const b = e.target.closest('[data-pagina]'); if (!b) return;
    stato.pagina = +b.dataset.pagina;
    rendi();
    $('#documenti').scrollIntoView({ block: 'start' });
  });

  // su telefono i filtri si aprono quando servono
  $('#apri-filtri').addEventListener('click', e => {
    const b = e.currentTarget;
    const aperto = b.getAttribute('aria-expanded') === 'true';
    b.setAttribute('aria-expanded', String(!aperto));
    $('#pannello').classList.toggle('aperto', !aperto);
  });

  $('#azzera').addEventListener('click', azzera);
  $('#azzera2').addEventListener('click', azzera);

  rendiEnti();
  avviaVisore();
  rendi();
  apriDaURL();
}

function azzera() {
  Object.assign(stato, { settore: '', comparto: '', tipo: '', tema: '', q: '',
                         pagina: 1, sfoglia: false });
  $('#q').value = ''; $('#pulisci').hidden = true;
  ['#f-settore', '#f-comparto', '#f-tipo', '#f-tema'].forEach(s => $(s).value = '');
  $('#box-comparto').hidden = true;
  ripristinaPasso(); rendi();
}

function ripristinaPasso() { stato.pagina = 1; }

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

// dodici temi, elencati una volta sola, dal più al meno documentato
function riempiTemi() {
  const conta = {};
  DATI.forEach(d => (d.temi || []).forEach(t => conta[t] = (conta[t] || 0) + 1));
  const ordinati = Object.entries(conta).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'it'));

  $('#f-tema').innerHTML =
    `<option value="">Tutti i temi</option>` +
    ordinati.map(([t, n]) => `<option value="${esc(t)}">${esc(t)} (${n})</option>`).join('');

  $('#f-tema').addEventListener('change', e => { stato.tema = e.target.value; ripristinaPasso(); rendi(); });
}

/* ---------- ricerca ---------- */
function trova(d, q) {
  const scheda = senzaAccenti([d.titolo, d.etichetta, d.hook, d.tag.join(' '),
    (d.temi || []).join(' '), (d.luoghi || []).join(' '), d.data].join(' '));
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
    if (stato.tema && !(d.temi || []).includes(stato.tema)) return false;
    if (stato.q) { d._dove = trova(d, stato.q); if (!d._dove) return false; }
    else d._dove = null;
    return true;
  }).sort((a, b) => stato.ordine === 'desc' ? b.data.localeCompare(a.data) : a.data.localeCompare(b.data));

  const filtrato = !!(stato.settore || stato.comparto || stato.tipo || stato.tema || stato.q);
  $('#azzera').disabled = !filtrato && !stato.sfoglia;

  const attivi = [stato.settore, stato.comparto, stato.tipo, stato.tema].filter(Boolean).length;
  const conta = $('#conta-filtri');
  conta.hidden = attivi === 0;
  conta.textContent = attivi;

  // entrando si vedono i cinque piu recenti; filtrando o sfogliando si va a pagine
  const aPagine = filtrato || stato.sfoglia;
  const perPagina = aPagine ? PER_PAGINA : VETRINA;
  const pagine = Math.max(1, Math.ceil(vista.length / perPagina));
  if (stato.pagina > pagine) stato.pagina = pagine;
  const da = (stato.pagina - 1) * perPagina;
  const fetta = vista.slice(da, da + perPagina);

  const nelTesto = stato.q ? vista.filter(d => d._dove === 'testo').length : 0;
  $('#conteggio').innerHTML = vista.length === 0
    ? 'nessun risultato'
    : (aPagine
        ? `<b>${vista.length}</b> ${vista.length === 1 ? 'documento' : 'documenti'}` +
          (stato.q ? ` per <em>${esc(stato.q)}</em>` : '') +
          (nelTesto ? ` · <span class="dentro">${nelTesto} dentro il testo</span>` : '') +
          (pagine > 1 ? ` · ${da + 1}-${da + fetta.length}` : '')
        : `i più recenti · <b>${fetta.length}</b> di ${vista.length} in archivio`);

  $('#empty').hidden = vista.length > 0;
  disegnaSchede(fetta, da);

  // il bottone per passare dalla vetrina allo sfoglio
  const b = $('#sfoglia');
  b.hidden = aPagine || vista.length <= VETRINA;
  if (!b.hidden) b.innerHTML = `Sfoglia tutto l'archivio <small>${vista.length} documenti</small>`;

  disegnaPagine(aPagine ? pagine : 1);
}

function dataBreve(d) {
  const [a, m] = d.data.split('-');
  return MESI[+m - 1] + ' ' + a + (d.stimata ? ' <span class="q" title="data ricavata dal testo, da confermare">?</span>' : '');
}

/* Le schede vengono tenute da parte e rimesse in fila: ricostruirle a ogni
   battuta faceva ricaricare tutte le immagini, e la pagina tremava. */
const schedeFatte = new Map();

function disegnaSchede(fetta, da) {
  const griglia = $('#grid');
  const pezzi = fetta.map((d, i) => {
    let el = schedeFatte.get(d.slug);
    if (!el) {
      const t = document.createElement('template');
      t.innerHTML = scheda(d).trim();
      el = t.content.firstElementChild;
      schedeFatte.set(d.slug, el);
    }
    aggiornaScheda(el, d);
    el.onclick = () => apri(da + i);
    return el;
  });
  griglia.replaceChildren(...pezzi);          // le sposta, non le ricrea
}

// cambia solo la riga sotto la data: l'estratto della ricerca
function aggiornaScheda(el, d) {
  const sotto = el.querySelector('.estratto, .cassetto');
  const nuovo = d._dove === 'testo'
    ? `<span class="estratto"><b>nel testo</b> ${estratto(d.slug, stato.q)}</span>`
    : (d.comparto && d.comparto !== 'trasversale'
        ? `<span class="cassetto">${COMPARTI_BREVI[d.comparto]}</span>` : '');
  if (sotto) { if (sotto.outerHTML !== nuovo) sotto.outerHTML = nuovo || '<span class="cassetto"></span>'; }
  else if (nuovo) el.querySelector('.meta').insertAdjacentHTML('beforeend', nuovo);
}

function copertina(d) {
  const st = STILI[d.stile] || STILI._neutro || { colore: '#2B2F36', icona: 'file-text' };
  const icona = ICONE[st.icona] || '';
  return `
    <img class="cop-pagina" src="${d.thumb}" alt="Prima pagina di: ${esc(d.titolo)}" loading="lazy" decoding="async">
    <span class="cop" style="--cop:${st.colore}">
      <span class="cop-riga">
        <svg class="cop-icona" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icona}</svg>
        <span class="cop-tema">${esc(st.breve || d.stile)}</span>
      </span>
      <span class="cop-testo">${esc(d.etichetta)}</span>
    </span>`;
}

function scheda(d) {
  return `<button class="card" type="button" aria-label="Apri: ${esc(d.titolo)}">
    <span class="thumb">
      <span class="badge ${d.tipo}">${TIPI[d.tipo]}</span>
      <span class="pagebadge">${d.pagine} ${d.pagine === 1 ? 'pag' : 'pagg'}</span>
      ${copertina(d)}
    </span>
    <span class="meta">
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
    (d.temi || []).map(t => `<button class="tag" data-tema="${esc(t)}">${esc(t)}</button>`).join('') +
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


/* ---------- pagine ----------
   con poche decine di documenti basterebbe un bottone "mostra altri", ma
   fra dieci anni saranno migliaia: le pagine reggono, lo scorrimento no. */
function disegnaPagine(pagine) {
  const nav = $('#pagine');
  nav.hidden = pagine <= 1;
  if (nav.hidden) { nav.innerHTML = ''; return; }

  const p = stato.pagina;
  const nums = new Set([1, pagine, p, p - 1, p + 1]);
  if (p <= 3) { nums.add(2); nums.add(3); }
  if (p >= pagine - 2) { nums.add(pagine - 1); nums.add(pagine - 2); }
  const elenco = [...nums].filter(n => n >= 1 && n <= pagine).sort((a, b) => a - b);

  let html = `<button class="pag-freccia" data-pagina="${p - 1}" ${p === 1 ? 'disabled' : ''}
                 aria-label="Pagina precedente">←</button>`;
  let ultimo = 0;
  for (const n of elenco) {
    if (n - ultimo > 1) html += `<span class="pag-salto">…</span>`;
    html += `<button class="pag-num" data-pagina="${n}" ${n === p ? 'aria-current="page"' : ''}>${n}</button>`;
    ultimo = n;
  }
  html += `<button class="pag-freccia" data-pagina="${p + 1}" ${p === pagine ? 'disabled' : ''}
              aria-label="Pagina successiva">→</button>
           <span class="pag-di">pagina ${p} di ${pagine}</span>`;
  nav.innerHTML = html;
}
