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

let DATI = [], ENTI = {}, TESTI = null, STILI = {}, ICONE = {}, LETTURA = null;
let vista = [];
const stato = { settore: '', comparto: '', tipo: '', tema: '', q: '',
                ordine: 'desc', pagina: 1, sfoglia: false };

// i dati cambiano insieme al codice: la versione evita che il browser
// serva un archivio vecchio tenuto in cache
const VERSIONE = '19';

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
    try { init(); }
    catch (err) {
      console.error('Errore durante l\'avvio della pagina:', err);
      avviso('Qualcosa non ha funzionato nel mostrare l\'archivio.');
      throw err;                       // resta nel registro per la diagnosi
    }
    fetch('assets/testi.json?v=' + VERSIONE).then(r => r.json()).then(t => {
      TESTI = t;
      if (stato.q) rendi();          // la ricerca si allarga al testo appena arriva
    }).catch(() => {});
    // il testo leggibile del documento, per il lettore
    fetch('assets/lettura.json?v=' + VERSIONE).then(r => r.json())
      .then(l => {
        LETTURA = l;
        // se stai gia leggendo un documento, il testo compare senza ricaricare
        if (indice >= 0 && $('#overlay').classList.contains('is-open')) disegnaLettore(vista[indice]);
      }).catch(() => {});
  })
  .catch(err => {
    console.error('Archivio non caricato:', err);
    avviso(location.protocol === 'file:'
      ? 'I dati non si leggono aprendo il file con un doppio clic. Serve un server: python3 _sorgenti/serve.py'
      : 'Non riesco a caricare l\'archivio in questo momento.');
  });

// un guasto non lascia la pagina muta: dice cosa e successo e come riprovare
function avviso(testo) {
  const g = $('#grid'); if (!g) return;
  g.innerHTML = `<div class="guasto">
      <b>${esc(testo)}</b>
      <button class="btn-red" onclick="location.reload()">Riprova</button>
      <p class="note">Se continua, scrivi a <a href="mailto:milano@sicobas.org">milano@sicobas.org</a>.</p>
    </div>`;
  const s = $('#sfoglia'); if (s) s.hidden = true;
  const p = $('#pagine'); if (p) p.hidden = true;
}

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
  const pannello = (apri) => {
    $('#apri-filtri').setAttribute('aria-expanded', String(apri));
    $('#pannello').classList.toggle('aperto', apri);
    $('#velo').classList.toggle('aperto', apri);
    document.body.style.overflow = apri ? 'hidden' : '';
    if (apri) $('#chiudi-pannello').focus(); else $('#apri-filtri').focus();
  };
  $('#apri-filtri').addEventListener('click', e =>
    pannello(e.currentTarget.getAttribute('aria-expanded') !== 'true'));
  $('#chiudi-pannello').addEventListener('click', () => pannello(false));
  $('#velo').addEventListener('click', () => pannello(false));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && $('#pannello').classList.contains('aperto')) pannello(false);
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
    <span class="cop">
      <span class="cop-riga">
        <svg class="cop-icona" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icona}</svg>
        <span class="cop-tema">${esc(st.breve || d.stile)}</span>
      </span>
      <span class="cop-testo">${esc(d.etichetta)}</span>
    </span>`;
}

function scheda(d) {
  const st = STILI[d.stile] || STILI._neutro || { colore: '#2B2F36' };
  return `<button class="card" type="button" style="--cop:${st.colore}" aria-label="Apri: ${esc(d.titolo)}">
    <span class="thumb">
      <span class="badge ${d.tipo}">${TIPI[d.tipo]}</span>
      <span class="pagebadge">${d.pagine} ${d.pagine === 1 ? 'pag' : 'pagg'}</span>
      ${copertina(d)}
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
    (d.temi || []).map(t => `<button class="tag" data-tema="${esc(t)}">${esc(t)}</button>`).join('') +
    (d.luoghi || []).map(l => `<button class="tag luogo" data-luogo="${esc(l)}">${esc(l)}</button>`).join('');
  $('#m-dl').href = d.pdf;
  $('#m-dl').setAttribute('download', d.slug + '.pdf');

  disegnaLettore(d);

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
  if (!DATI.some(d => d.slug === m[1])) return;
  // il documento puo stare oltre i cinque della vetrina: si passa allo
  // sfoglio e si va alla pagina che lo contiene
  stato.sfoglia = true; stato.pagina = 1; rendi();
  const i = vista.findIndex(d => d.slug === m[1]);
  if (i < 0) return;
  stato.pagina = Math.floor(i / PER_PAGINA) + 1;
  rendi();
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


/* ---------- lettore ----------
   Il testo esce dal PDF gia con la sua gerarchia: il titolo di un volantino
   e a 48-54px, il corpo a 18px. Qui si rispetta (regola visual-hierarchy:
   "Establish hierarchy via size, spacing, contrast").

   La scansione originale su telefono serve a poco: 58 documenti su 62 sono
   fogli di testo, illeggibili in miniatura. Non e piu una scelta alla pari:
   e un rimando in fondo, per i pochi con grafica e per chi vuole verificare.  */
let vistaLettore = 'testo';

const BLOCCO = {
  intestazione: t => `<p class="d-intestazione">${esc(t)}</p>`,
  titolo:       t => `<h3 class="d-titolo">${esc(t)}</h3>`,
  sottotitolo:  t => `<h4 class="d-sottotitolo">${esc(t)}</h4>`,
  rilievo:      t => `<p class="d-rilievo">${esc(t)}</p>`,
  firma:        t => `<p class="d-firma">${esc(t)}</p>`,
  testo:        t => `<p>${esc(t)}</p>`
};

function disegnaLettore(d) {
  const v = $('#m-viewer');

  if (!window.matchMedia('(max-width: 820px)').matches) {
    v.innerHTML = `<iframe src="${d.pdf}#view=FitH&toolbar=1" title="Documento: ${esc(d.titolo)}" loading="lazy"></iframe>`;
    return;
  }

  const pagine = d.immagini || [], misure = d.misure || [];
  const blocchi = LETTURA ? (LETTURA[d.slug] || []) : null;   // null = in arrivo

  if (blocchi === null && vistaLettore === 'testo') {
    v.innerHTML = `<div class="attesa" role="status">Sto aprendo il documento…</div>`;
    return;
  }

  const haTesto = blocchi && blocchi.length > 0;
  if (blocchi !== null && !haTesto) vistaLettore = 'originale';

  if (vistaLettore === 'testo' && haTesto) {
    v.innerHTML = `<article class="testo-doc">
        ${blocchi.map(b => (BLOCCO[b.t] || BLOCCO.testo)(b.testo)).join('')}
        <div class="vedi-originale">
          <button data-vista="originale">Vedi la scansione originale
            <small>${pagine.length} ${pagine.length === 1 ? 'pagina' : 'pagine'}</small></button>
        </div>
      </article>`;
  } else {
    v.innerHTML = `<div class="lettore">`
      + (haTesto ? `<div class="torna-testo"><button data-vista="testo">← Torna al testo</button></div>` : '')
      + pagine.map((p, i) => {
          const [w, h] = misure[i] || [868, 1228];
          return `<figure style="aspect-ratio:${w}/${h}">
             <img src="${p}" width="${w}" height="${h}"
                  alt="Pagina ${i + 1} di ${pagine.length}: ${esc(d.titolo)}"
                  loading="${i === 0 ? 'eager' : 'lazy'}" decoding="async">
             ${pagine.length > 1 ? `<figcaption>${i + 1} / ${pagine.length}</figcaption>` : ''}
           </figure>`; }).join('')
      + `</div>`;
  }

  v.addEventListener('click', e => {
    const b = e.target.closest('[data-vista]'); if (!b) return;
    vistaLettore = b.dataset.vista;
    disegnaLettore(d);
    v.scrollTop = 0;
  }, { once: true });
}
