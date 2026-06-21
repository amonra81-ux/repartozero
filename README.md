# Reparto Zero — sito omnicanale

Replica statica del sito (stile agitprop editoriale: nero / rosso lotta / giallo cantiere,
type Archivo Black, nastro scorrevole). Una sola pagina che scorre, con tutte le sezioni.
Statico = nessun server, nessuna spesa, nessuna chiave segreta. Si apre da telefono e da PC.

## File (cosa sono)

| File | Cosa significa |
|---|---|
| `index.html` | Il **sito intero** (tutte le sezioni in una pagina) |
| `assets/style.css` | Il **vestito** (colori, font, layout) |
| `assets/app.js` | Menu mobile + bottoni lingua |
| `blog/`, `lavoro-sicuro/` | Vecchie pagine separate — ora il contenuto è già dentro `index.html`. Si possono cancellare |

## Sezioni dentro index.html
Ticker · Manifesto · Cosa facciamo · Archivio vertenze · Lavoro sicuro · Storie · Canali · Segnala · Footer.

## Come metterlo online (GitHub Pages — gratis)
1. Crea un repository GitHub `repartozero` (pubblico).
2. Carica dentro tutti i file.
3. Settings → Pages → Branch: main → Save.
4. Dopo 1 minuto online su `https://TUONOME.github.io/repartozero/`.

## Come aggiungere roba dopo
- **Nuova vertenza** → in `index.html` copia un blocco `<article class="caso">…</article>`.
- **Nuova storia** → copia un blocco `<article class="s-card">…</article>`.
- **Nuovo canale** → copia un blocco `<a class="ch">…</a>`.
- Salva, ricarica su GitHub. Fatto.

## Identità grafica
- Logo = emblema "nodo-raggi": timbro circolare rotante + "0" rosso + halftone (in `index.html`, sezione hero, SVG).
- Favicon: `assets/favicon.svg`.
- Texture grana da stampa + divisori hazard (giallo/nero) = `assets/style.css`.

## Canali collegati (link veri)
- Instagram: instagram.com/repartozero ✓
- YouTube: youtube.com/channel/UCL9aGkDKH7Mjx9azhSP3FUQ ✓
- Spotify: open.spotify.com/.../2rOtR1fiShleCM5Tt3xwaQ ✓
- E-mail: repartozero118@gmail.com ✓ (uniformata ovunque)
- TikTok / Telegram / RSS / Newsletter = ancora segnaposto (attivali e aggiorna il link).

## DA SISTEMARE
- [ ] Verifica che TikTok @repartozero e Telegram t.me/repartozero esistano (se no, togli quelle card).
- [ ] RSS e Newsletter: per ora vuoti, da collegare quando attivi.
