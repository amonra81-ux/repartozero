/* Fascicolo di un ospedale / ente: timeline cronologica + azione finale */

const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
const TIPI = { volantino:'Volantino', comunicato:'Comunicato', opuscolo:'Opuscolo', iniziativa:'Iniziativa' };
const SETTORI = { 'sanita':'Sanità', 'pubblico-impiego':'Pubblico impiego', 'rnls':'Rete Nazionale Lavoro Sicuro' };
const COMPARTI = { 'pubblica':'Sanità pubblica', 'privata':'Sanità privata e accreditata',
  'cooperative':'Cooperative sociali e terzo settore', 'trasversale':'Trasversale al settore' };

// i dati cambiano insieme al codice: la versione evita che il browser
// serva un archivio vecchio tenuto in cache
const VERSIONE = '8';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c]));

let vista = [], indice = -1, ultimoFocus = null;
const chiave = new URLSearchParams(location.search).get('e') || '';

fetch('assets/archivio.json?v=' + VERSIONE).then(r => r.json()).then(d => {
  const ente = (d.enti || {})[chiave];
  if (!ente) {
    $('#e-nome').textContent = 'Fascicolo non trovato';
    $('#e-nota').innerHTML = 'Torna all\'<a href="index.html#enti">indice degli ospedali ed enti</a>.';
    return;
  }
  document.title = ente.nome + ' — Archivio S.I. Cobas';
  $('#e-tipo').textContent = ente.tipo;
  $('#e-nome').textContent = ente.nome;
  $('#e-nota').textContent = ente.nota;
  $('#e-stats').innerHTML = `
    <div class="stat"><b>${ente.n}</b><span>documenti</span></div>
    <div class="stat"><b>${ente.dal.slice(0,4)}</b><span>primo documento</span></div>
    <div class="stat"><b>${ente.al.slice(0,4)}</b><span>ultimo documento</span></div>
    <div class="stat"><b>${esc(ente.citta)}</b><span>luogo</span></div>`;

  // dal più vecchio al più recente: si legge come una storia
  vista = d.documenti.filter(x => x.ente === chiave).sort((a, b) => a.data.localeCompare(b.data));
  $('#timeline').innerHTML = vista.map(riga).join('');
  $$('#timeline .tl-card').forEach((c, i) => c.addEventListener('click', () => apri(i)));

  // documenti che nominano questo ente senza esserne il soggetto principale
  const citati = (ente.citazioni || [])
    .map(s => d.documenti.find(x => x.slug === s)).filter(Boolean)
    .sort((a, b) => a.data.localeCompare(b.data));
  if (citati.length) {
    const base = vista.length;
    vista = vista.concat(citati);
    $('#timeline').insertAdjacentHTML('beforeend', `
      <div class="citazioni">
        <b>Citato anche in ${citati.length} ${citati.length === 1 ? 'documento' : 'documenti'}</b>
        <div class="cit-lista">${citati.map((c, i) => `
          <button class="cit" type="button" data-i="${base + i}">
            <span class="cit-data">${c.data.slice(0, 4)}</span>
            <span class="cit-tx"><b>${esc(c.etichetta)}</b> — ${esc(c.titolo)}</span>
          </button>`).join('')}</div>
      </div>`);
    $$('#timeline .cit').forEach(b => b.addEventListener('click', () => apri(+b.dataset.i)));
  }

  if (ente.mancanti && ente.mancanti.length) {
    $('#timeline').insertAdjacentHTML('beforeend', `
      <div class="buchi">
        <b>Manca all'archivio</b>
        <ul>${ente.mancanti.map(m => `<li>${esc(m)}</li>`).join('')}</ul>
        <p>Se hai il file, mandalo al coordinamento: il fascicolo si chiude solo se il pezzo torna dentro.</p>
      </div>`);
  }

  if (ente.azione) mostraAzione(ente.azione);
  avviaModale();
});

function dataLunga(d) {
  const [a, m, g] = d.data.split('-');
  return (d.stimata ? '' : +g + ' ') + MESI[+m - 1] + ' ' + a;
}

function riga(d) {
  const [a, m] = d.data.split('-');
  return `<div class="tl-item">
    <div class="tl-date"><b>${a}</b>${MESI[+m-1].slice(0,3)}${d.stimata ? ' <span style="color:var(--red)" title="data ricavata dal testo, da confermare">?</span>' : ''}</div>
    <button class="tl-card" type="button" aria-label="Apri: ${esc(d.titolo)}">
      <img src="${d.thumb}" alt="" loading="lazy" decoding="async">
      <span class="tx">
        <span class="k">${TIPI[d.tipo]}${d.pagine > 1 ? ' · ' + d.pagine + ' pagine' : ''}</span>
        <h3>${esc(d.etichetta)}</h3>
        <p>${esc(d.hook)}</p>
      </span>
    </button>
  </div>`;
}

function mostraAzione(a) {
  $('#azione').hidden = false;
  $('#a-bozza').hidden = !a.bozza;
  $('#a-titolo').textContent = a.titolo;
  $('#a-testo').textContent = a.testo;
  $('#a-quando').textContent = a.quando;
  $('#a-dove').textContent = a.dove;
  $('#a-passi').innerHTML = a.passi.map(p => `<li>${esc(p)}</li>`).join('');
  $('#a-cta').textContent = a.cta;
  $('#a-cta').href = a.link;
}

/* ---------- modale (identica all'archivio) ---------- */
function avviaModale() {
  $('#m-close').addEventListener('click', chiudi);
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
  $('#m-sub').textContent = [TIPI[d.tipo], SETTORI[d.settore], d.comparto ? COMPARTI[d.comparto] : '', dataLunga(d)]
    .filter(Boolean).join(' · ');
  $('#m-title').textContent = d.titolo;
  $('#m-hook').textContent = d.hook;
  $('#m-tags').innerHTML = d.tag.map(t => `<span class="tag">${esc(t)}</span>`).join('');
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
  $('#m-close').focus();
}

function chiudi() {
  $('#overlay').classList.remove('is-open');
  $('#m-viewer').innerHTML = '';
  document.body.style.overflow = '';
  if (ultimoFocus) { ultimoFocus.focus(); ultimoFocus = null; }
}

function trappolaFocus(e) {
  const f = $$('#overlay button, #overlay a[href], #overlay iframe');
  if (!f.length) return;
  const primo = f[0], ultimo = f[f.length - 1];
  if (e.shiftKey && document.activeElement === primo) { e.preventDefault(); ultimo.focus(); }
  else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primo.focus(); }
}
