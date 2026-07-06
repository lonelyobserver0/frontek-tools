# Frontek Tools — `tools.frontek.dev`

A hub of developer micro-tools, **100% client-side**: no input ever leaves the
browser, no backend, no dependencies, no build step. Same static stack as
`start.frontek.dev` / `feeds.frontek.dev`.

## Included tools (34)
JSON formatter · Base64 · JWT decoder · URL encode/decode · UUID v4 ·
Hash (SHA-1/256/384/512) · Timestamp/epoch · Text & case · Color converter ·
Regex tester · Regex builder · Cron explainer · Text diff · HTML entities ·
Lorem ipsum · Number base converter · Password generator · Markdown preview ·
Chmod calculator · Query string ↔ JSON · CSV ↔ JSON · Case converter ·
Contrast checker (WCAG) · Line tools · URL parser · Unicode inspector ·
JSON → TypeScript · String escape/unescape · Roman numerals · Text ↔ binary ·
Image → Base64 · cURL → fetch · JSON path query · QR code generator.

### QR code generator
A full QR encoder written from scratch (UTF-8 byte mode, ECC L/M/Q/H, versions
1–40, Reed-Solomon, penalty-based mask selection), **100% client-side** — no
libraries, no network. Outputs PNG (canvas) or vector SVG. Every generated code
was verified by decoding it with `zxing-cpp` (186/186 cases, versions 1–40) and
with OpenCV.

## Reordering tools
Users can reorder the cards and pin their favorite tools first: **Reorder tools**
enables edit mode (up/down/move-to-top arrows per card), the order is saved to
`localStorage` (`tools.order`), and **Reset order** restores the default.

## Architecture
- `index.html` — static hub (cards live in the markup ⇒ crawlable) + settings modal.
- `js/main.js` — `TOOLS` registry, hash router (`#/json`, `#/base64`, …), filter,
  light/dark theme, shell i18n (en/it, other languages fall back to en),
  first-party sponsor slot (`SPONSOR = null` until populated).
- `css/style.css` — Frontek brand palette, theme, components.

Adding a tool = adding an entry to `TOOLS` in `main.js` **and** a `.tcard` in
`index.html` (same `data-id`).

## Deploy
```
sudo bash ~/deploy_tools.sh
```
Creates/updates the `tools.frontek.dev` nginx vhost, cache-busting on CSS/JS,
TLS via certbot (requires the DNS A record → 217.154.149.234). No proxy: the
site makes no network requests.

## SEO — next step
To maximize the long tail, per-tool static pages (`/json/`, `/base64/`, …) can be
generated with dedicated indexable content, reusing the same `main.js`. The
current hub is already crawlable.
