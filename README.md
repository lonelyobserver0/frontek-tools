# Frontek Tools — `tools.frontek.dev`

Hub di micro-tool per sviluppatori, **100% client-side**: nessun input lascia il
browser, nessun backend, nessuna dipendenza, nessun build step. Stesso stack
statico di `start.frontek.dev` / `feeds.frontek.dev`.

## Strumenti inclusi (34)
JSON formatter · Base64 · JWT decoder · URL encode/decode · UUID v4 ·
Hash (SHA-1/256/384/512) · Timestamp/epoch · Text & case · Color converter ·
Regex tester · Regex builder · Cron explainer · Text diff · HTML entities ·
Lorem ipsum · Number base converter · Password generator · Markdown preview ·
Chmod calculator · Query string ↔ JSON · CSV ↔ JSON · Case converter ·
Contrast checker (WCAG) · Line tools · URL parser · Unicode inspector ·
JSON → TypeScript · String escape/unescape · Roman numerals · Text ↔ binary ·
Image → Base64 · cURL → fetch · JSON path query · QR code generator.

### QR code generator
Encoder QR completo scritto da zero (byte mode UTF-8, ECC L/M/Q/H, versioni
1–40, Reed-Solomon, selezione maschera per penalità), **100% client-side** —
niente librerie, niente rete. Output PNG (canvas) o SVG vettoriale. Ogni codice
generato è stato verificato decodificandolo con `zxing-cpp` (186/186 casi,
versioni 1–40) e con OpenCV.

## Riordino strumenti
L'utente può riordinare le card e mettere per primi i tool preferiti: **Riordina
strumenti** attiva la modalità edit (frecce su/giù/in cima per card), l'ordine è
salvato in `localStorage` (`tools.order`), **Ripristina ordine** torna al default.

## Architettura
- `index.html` — hub statico (le card sono nel markup ⇒ indicizzabili) + modale impostazioni.
- `js/main.js` — registry `TOOLS`, router a hash (`#/json`, `#/base64`, …), filtro,
  tema chiaro/scuro, i18n della shell (en/it, le altre lingue ricadono su en),
  slot sponsor first-party (`SPONSOR = null` finché non valorizzato).
- `css/style.css` — palette brand frontek, tema, componenti.

Aggiungere uno strumento = aggiungere una voce a `TOOLS` in `main.js` **e** una
`.tcard` in `index.html` (stesso `data-id`).

## Deploy
```
sudo bash ~/deploy_tools.sh
```
Crea/aggiorna il vhost nginx `tools.frontek.dev`, cache-busting su CSS/JS,
TLS via certbot (serve il record DNS A → 217.154.149.234). Nessun proxy: il
sito non fa richieste di rete.

## SEO — prossimo passo
Per massimizzare la long-tail, si possono generare pagine statiche per singolo
tool (`/json/`, `/base64/`, …) con contenuto indicizzabile dedicato, riusando lo
stesso `main.js`. L'hub attuale è già crawlabile.
