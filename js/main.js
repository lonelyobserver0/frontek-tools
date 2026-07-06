/* ============================================================
   Frontek Tools — hub di micro-tool (vanilla, zero dipendenze)
   Tutto gira nel browser: nessun input lascia il dispositivo.
   Stato minimo (tema + lingua) in localStorage. Router a hash.
   ============================================================ */
(function () {
  'use strict';

  // ---- config / stato ----
  var LS = { settings: 'tools.settings', sponsorHidden: 'tools.sponsorHidden', order: 'tools.order' };
  var DEFAULT_SETTINGS = { lang: 'auto', theme: 'auto' };
  var SPONSOR = null;   // { text:'…', url:'https://…' }  -> valorizzabile in seguito

  var settings = mergeSettings(load(LS.settings, null));

  // ---- utils base ----
  function $(id){ return document.getElementById(id); }
  function load(k, def){ try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch(e){ return def; } }
  function save(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  function mergeSettings(s){
    var out = { lang: DEFAULT_SETTINGS.lang, theme: DEFAULT_SETTINGS.theme };
    if (s && typeof s === 'object'){ if (s.lang) out.lang = s.lang; if (s.theme) out.theme = s.theme; }
    return out;
  }
  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function pad2(n){ return (n < 10 ? '0' : '') + n; }

  function copy(text){
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
    return new Promise(function(res){
      var ta = document.createElement('textarea'); ta.value = text;
      ta.style.position = 'fixed'; ta.style.left = '-9999px';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch(e){}
      document.body.removeChild(ta); res();
    });
  }
  function flashCopy(btn, text){
    if (!text) return;
    copy(text).then(function(){
      var old = btn.getAttribute('data-label') || btn.textContent;
      btn.setAttribute('data-label', old);
      btn.textContent = 'Copied ✓';
      setTimeout(function(){ btn.textContent = btn.getAttribute('data-label'); }, 1200);
    });
  }

  // ---- Base64 / UTF-8 ----
  function b64encode(str, urlsafe){
    var bytes = new TextEncoder().encode(str), bin = '';
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    var out = btoa(bin);
    if (urlsafe) out = out.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
    return out;
  }
  function b64decode(str){
    var s = str.trim().replace(/\s+/g,'').replace(/-/g,'+').replace(/_/g,'/');
    while (s.length % 4) s += '=';
    var bin = atob(s), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }
  function hexOf(buf){
    var v = new Uint8Array(buf), s = '';
    for (var i = 0; i < v.length; i++){ var h = v[i].toString(16); s += (h.length === 1 ? '0' : '') + h; }
    return s;
  }
  function uuidv4(){
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    var h = []; for (var i = 0; i < 16; i++){ var x = b[i].toString(16); h.push((x.length === 1 ? '0' : '') + x); }
    return h.slice(0,4).join('') + '-' + h.slice(4,6).join('') + '-' +
           h.slice(6,8).join('') + '-' + h.slice(8,10).join('') + '-' + h.slice(10,16).join('');
  }

  // ============================================================
  //  i18n (shell) — en/it pieni, le altre lingue ricadono su en
  // ============================================================
  var SUPPORTED = ['en','it','pt','fr','ru','pl','ar'];
  var LOCALE = { en:'en', it:'it', pt:'pt', fr:'fr', ru:'ru', pl:'pl', ar:'ar' };

  function detectLang(){
    var langs = navigator.languages || [navigator.language || 'en'];
    for (var i = 0; i < langs.length; i++){
      var code = (langs[i] || '').slice(0,2).toLowerCase();
      if (SUPPORTED.indexOf(code) >= 0) return code;
    }
    return 'en';
  }
  function currentLang(){ return settings.lang === 'auto' ? detectLang() : (SUPPORTED.indexOf(settings.lang) >= 0 ? settings.lang : 'en'); }

  var I18N = {
    en:{ skip_to_tools:'Skip to tools', settings:'Settings',
      hub_title:'Developer tools that stay in your browser',
      hub_sub:'Fast, private utilities. Nothing is uploaded — everything runs client-side.',
      filter_ph:'Filter tools…', no_tools:'No tools match your filter.',
      sponsor:'Sponsor', footer_privacy:'No tracking · everything runs in your browser',
      language:'Language', lang_auto:'Automatic (browser)', theme:'Theme',
      theme_auto:'Automatic (system)', theme_light:'Light', theme_dark:'Dark',
      settings_privacy:'All tools run locally in your browser. No input is ever sent to a server.',
      all_tools:'All tools', customize:'Reorder tools', done:'Done', reset_order:'Reset order' },
    it:{ skip_to_tools:'Salta agli strumenti', settings:'Impostazioni',
      hub_title:'Strumenti per sviluppatori che restano nel tuo browser',
      hub_sub:'Utility veloci e private. Nessun caricamento — tutto gira lato client.',
      filter_ph:'Filtra strumenti…', no_tools:'Nessuno strumento corrisponde al filtro.',
      sponsor:'Sponsor', footer_privacy:'Nessun tracciamento · tutto gira nel tuo browser',
      language:'Lingua', lang_auto:'Automatica (browser)', theme:'Tema',
      theme_auto:'Automatico (sistema)', theme_light:'Chiaro', theme_dark:'Scuro',
      settings_privacy:'Tutti gli strumenti girano nel tuo browser. Nessun dato viene inviato a un server.',
      all_tools:'Tutti gli strumenti', customize:'Riordina strumenti', done:'Fatto', reset_order:'Ripristina ordine' }
  };
  function dict(){ return I18N[currentLang()] || I18N.en; }
  function t(key){ var d = dict(); return (d && d[key]) || I18N.en[key] || key; }

  function applyI18n(){
    var lang = currentLang();
    document.documentElement.lang = LOCALE[lang] || 'en';
    document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++){ nodes[i].textContent = t(nodes[i].getAttribute('data-i18n')); }
    setAttr('[data-i18n-ph]',   'data-i18n-ph',   'placeholder');
    setAttr('[data-i18n-aria]', 'data-i18n-aria', 'aria-label');
    setAttr('[data-i18n-title]','data-i18n-title','title');
  }
  function setAttr(sel, dataAttr, target){
    var nodes = document.querySelectorAll(sel);
    for (var i = 0; i < nodes.length; i++){ nodes[i].setAttribute(target, t(nodes[i].getAttribute(dataAttr))); }
  }

  // ---- tema ----
  function applyTheme(){
    var mode = settings.theme;
    if (mode === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', mode);
    var dark = mode === 'dark' || (mode === 'auto' && window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', dark ? '#0f1a1f' : '#264653');
  }

  // ============================================================
  //  STRUMENTI
  //  Ognuno: { title, lead, html(): stringa, init(root): wiring }
  // ============================================================
  function outBlock(id, withCopy){
    return '<div class="out">' +
      (withCopy ? '<div class="copybar"><span class="status" id="' + id + 'St"></span>' +
        '<button class="btn btn--light" data-copy="' + id + 'Out" type="button">Copy</button></div>' :
        '<p class="status" id="' + id + 'St"></p>') +
      '<pre class="out__box" id="' + id + 'Out"></pre></div>';
  }

  // ============================================================
  //  QR ENCODER (byte mode, ECC L/M/Q/H, versions 1-40)
  //  Self-contained; every generated code verified to decode via zxing-cpp.
  // ============================================================
  var QR_ECC_CW = [
    [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
    [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
    [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]
  ];
  var QR_ECC_BLK = [
    [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
    [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
    [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
    [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]
  ];
  var QR_FMT = [1,0,3,2]; // format bits per ecl index L,M,Q,H

  function qrGetBit(x, i){ return ((x >>> i) & 1) != 0; }
  function qrRawModules(ver){
    var result = (16*ver + 128)*ver + 64;
    if (ver >= 2){ var na = Math.floor(ver/7) + 2; result -= (25*na - 10)*na - 55; if (ver >= 7) result -= 36; }
    return result;
  }
  function qrDataCodewords(ver, ecl){ return Math.floor(qrRawModules(ver)/8) - QR_ECC_CW[ecl][ver]*QR_ECC_BLK[ecl][ver]; }
  function qrRsMul(x, y){ var z = 0; for (var i=7;i>=0;i--){ z = (z<<1) ^ ((z>>>7)*0x11D); z ^= ((y>>>i)&1)*x; } return z & 0xFF; }
  function qrRsDivisor(degree){
    var result = []; for (var i=0;i<degree-1;i++) result.push(0); result.push(1);
    var root = 1;
    for (var i=0;i<degree;i++){ for (var j=0;j<result.length;j++){ result[j] = qrRsMul(result[j], root); if (j+1 < result.length) result[j] ^= result[j+1]; } root = qrRsMul(root, 0x02); }
    return result;
  }
  function qrRsRemainder(data, divisor){
    var result = divisor.map(function(){ return 0; });
    data.forEach(function(b){ var factor = b ^ result.shift(); result.push(0); divisor.forEach(function(coef,i){ result[i] ^= qrRsMul(coef, factor); }); });
    return result;
  }
  function qrUtf8(str){ var out = [], b = unescape(encodeURIComponent(str)); for (var i=0;i<b.length;i++) out.push(b.charCodeAt(i)); return out; }
  function qrInterleave(data, ver, ecl){
    var numBlocks = QR_ECC_BLK[ecl][ver], blockEcc = QR_ECC_CW[ecl][ver];
    var raw = Math.floor(qrRawModules(ver)/8), numShort = numBlocks - raw % numBlocks, shortLen = Math.floor(raw/numBlocks);
    var blocks = [], div = qrRsDivisor(blockEcc);
    for (var i=0,k=0;i<numBlocks;i++){
      var dat = data.slice(k, k + shortLen - blockEcc + (i < numShort ? 0 : 1)); k += dat.length;
      var ecc = qrRsRemainder(dat, div);
      if (i < numShort) dat = dat.concat([0]);
      blocks.push(dat.concat(ecc));
    }
    var result = [];
    for (var i=0;i<blocks[0].length;i++) for (var j=0;j<blocks.length;j++) if (i != shortLen - blockEcc || j >= numShort) result.push(blocks[j][i]);
    return result;
  }
  function qrAlign(ver){
    if (ver == 1) return [];
    var na = Math.floor(ver/7) + 2, step = (ver == 32) ? 26 : Math.ceil((ver*4 + 4)/(na*2 - 2))*2;
    var size = ver*4 + 17, result = [6];
    for (var pos = size - 7; result.length < na; pos -= step) result.splice(1, 0, pos);
    return result;
  }
  function qrBuild(ver, ecl, dataCw){
    var size = ver*4 + 17, mods = [], isFn = [];
    for (var y=0;y<size;y++){ mods.push(new Array(size).fill(false)); isFn.push(new Array(size).fill(false)); }
    function set(x,y,d){ mods[y][x] = d; isFn[y][x] = true; }
    for (var i=0;i<size;i++){ set(6,i,i%2==0); set(i,6,i%2==0); }
    [[3,3],[size-4,3],[3,size-4]].forEach(function(p){
      for (var dy=-4;dy<=4;dy++) for (var dx=-4;dx<=4;dx++){ var dist = Math.max(Math.abs(dx),Math.abs(dy)), xx=p[0]+dx, yy=p[1]+dy; if (xx>=0&&xx<size&&yy>=0&&yy<size) set(xx,yy, dist!=2 && dist!=4); }
    });
    var ap = qrAlign(ver), n = ap.length;
    for (var i=0;i<n;i++) for (var j=0;j<n;j++){ if ((i==0&&j==0)||(i==0&&j==n-1)||(i==n-1&&j==0)) continue; for (var dy=-2;dy<=2;dy++) for (var dx=-2;dx<=2;dx++) set(ap[i]+dx, ap[j]+dy, Math.max(Math.abs(dx),Math.abs(dy))!=1); }
    function drawFormat(mask){
      var data = QR_FMT[ecl] << 3 | mask, rem = data;
      for (var i=0;i<10;i++) rem = (rem<<1) ^ ((rem>>>9)*0x537);
      var bits = (data<<10 | rem) ^ 0x5412;
      for (var i=0;i<=5;i++) set(8,i, qrGetBit(bits,i));
      set(8,7, qrGetBit(bits,6)); set(8,8, qrGetBit(bits,7)); set(7,8, qrGetBit(bits,8));
      for (var i=9;i<15;i++) set(14-i,8, qrGetBit(bits,i));
      for (var i=0;i<8;i++) set(size-1-i,8, qrGetBit(bits,i));
      for (var i=8;i<15;i++) set(8,size-15+i, qrGetBit(bits,i));
      set(8,size-8, true);
    }
    drawFormat(0);
    if (ver >= 7){
      var rem = ver; for (var i=0;i<12;i++) rem = (rem<<1) ^ ((rem>>>11)*0x1F25);
      var bits = ver << 12 | rem;
      for (var i=0;i<18;i++){ var bit = qrGetBit(bits,i), a = size-11 + i%3, b = Math.floor(i/3); set(a,b,bit); set(b,a,bit); }
    }
    var all = qrInterleave(dataCw, ver, ecl), idx = 0;
    for (var right=size-1; right>=1; right-=2){
      if (right==6) right=5;
      for (var vert=0; vert<size; vert++) for (var jj=0;jj<2;jj++){
        var x = right - jj, up = ((right+1) & 2) == 0, y = up ? size-1-vert : vert;
        if (!isFn[y][x] && idx < all.length*8){ mods[y][x] = qrGetBit(all[idx>>>3], 7 - (idx&7)); idx++; }
      }
    }
    function maskFn(m,x,y){
      switch(m){
        case 0: return (x+y)%2==0; case 1: return y%2==0; case 2: return x%3==0; case 3: return (x+y)%3==0;
        case 4: return (Math.floor(x/3)+Math.floor(y/2))%2==0; case 5: return x*y%2 + x*y%3 == 0;
        case 6: return (x*y%2 + x*y%3)%2==0; case 7: return ((x+y)%2 + x*y%3)%2==0;
      }
    }
    function applyMask(m){ for (var y=0;y<size;y++) for (var x=0;x<size;x++) if (!isFn[y][x] && maskFn(m,x,y)) mods[y][x] = !mods[y][x]; }
    function addHist(run, h){ if (h[0]==0) run += size; h.pop(); h.unshift(run); }
    function countPat(h){ var nn = h[1], core = nn>0 && h[2]==nn && h[3]==nn*3 && h[4]==nn && h[5]==nn; return (core && h[0]>=nn*4 && h[6]>=nn ? 1:0) + (core && h[6]>=nn*4 && h[0]>=nn ? 1:0); }
    function term(c, run, h){ if (c){ addHist(run,h); run=0; } run += size; addHist(run,h); return countPat(h); }
    function penalty(){
      var res = 0;
      for (var y=0;y<size;y++){ var c=false, run=0, h=[0,0,0,0,0,0,0]; for (var x=0;x<size;x++){ if (mods[y][x]==c){ run++; if (run==5) res+=3; else if (run>5) res++; } else { addHist(run,h); if (!c) res += countPat(h)*40; c=mods[y][x]; run=1; } } res += term(c,run,h)*40; }
      for (var x=0;x<size;x++){ var c=false, run=0, h=[0,0,0,0,0,0,0]; for (var y=0;y<size;y++){ if (mods[y][x]==c){ run++; if (run==5) res+=3; else if (run>5) res++; } else { addHist(run,h); if (!c) res += countPat(h)*40; c=mods[y][x]; run=1; } } res += term(c,run,h)*40; }
      for (var y=0;y<size-1;y++) for (var x=0;x<size-1;x++){ var cc=mods[y][x]; if (cc==mods[y][x+1] && cc==mods[y+1][x] && cc==mods[y+1][x+1]) res += 3; }
      var dark=0; for (var y=0;y<size;y++) for (var x=0;x<size;x++) if (mods[y][x]) dark++;
      var total = size*size, k = Math.ceil(Math.abs(dark*20 - total*10)/total) - 1;
      return res + k*10;
    }
    var mask = 0, minP = Infinity;
    for (var m=0;m<8;m++){ applyMask(m); drawFormat(m); var p = penalty(); if (p < minP){ minP = p; mask = m; } applyMask(m); }
    applyMask(mask); drawFormat(mask);
    return { size: size, mods: mods, mask: mask, version: ver };
  }
  // qrMatrix(text, ecl) -> { size, mods:[size][size] bool, version, mask }
  function qrMatrix(text, ecl){
    var bytes = qrUtf8(text), ver;
    if (!bytes.length) throw new Error('Enter some text or a URL.');
    for (ver=1;;ver++){ var cap = qrDataCodewords(ver, ecl)*8, cc = ver <= 9 ? 8 : 16; if (4 + cc + 8*bytes.length <= cap) break; if (ver >= 40) throw new Error('Too much data for a QR code (max ~2953 bytes).'); }
    var capBits = qrDataCodewords(ver, ecl)*8, cc = ver <= 9 ? 8 : 16, bb = [];
    function append(v, l){ for (var i=l-1;i>=0;i--) bb.push((v>>>i)&1); }
    append(0x4, 4); append(bytes.length, cc); bytes.forEach(function(b){ append(b, 8); });
    append(0, Math.min(4, capBits - bb.length)); append(0, (8 - bb.length % 8) % 8);
    for (var pad=0xEC; bb.length < capBits; pad ^= 0xEC ^ 0x11) append(pad, 8);
    var dataCw = new Array(bb.length/8).fill(0);
    bb.forEach(function(bit,i){ dataCw[i>>>3] |= bit << (7 - (i&7)); });
    return qrBuild(ver, ecl, dataCw);
  }

  var TOOLS = {

    json: {
      title: 'JSON Formatter', lead: 'Format, minify and validate JSON — entirely in your browser.',
      html: function(){
        return '<label class="lbl">Input JSON</label>' +
          '<textarea class="ta" id="jIn" spellcheck="false" placeholder=\'{"hello":"world"}\'></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="jFmt" type="button">Format</button>' +
            '<button class="btn btn--light" id="jMin" type="button">Minify</button>' +
            '<label class="check">Indent&nbsp;<select class="sel" id="jInd"><option value="2">2</option><option value="4">4</option><option value="tab">Tab</option></select></label>' +
          '</div>' + outBlock('j', true);
      },
      init: function(r){
        var inp = r.querySelector('#jIn'), out = r.querySelector('#jOut'), st = r.querySelector('#jSt');
        function parse(){ return JSON.parse(inp.value); }
        function ok(msg){ st.className = 'status status--ok'; st.textContent = msg; }
        function err(e){ st.className = 'status status--err'; st.textContent = String(e.message || e); out.textContent = ''; }
        r.querySelector('#jFmt').onclick = function(){
          try { var ind = r.querySelector('#jInd').value; var sp = ind === 'tab' ? '\t' : parseInt(ind,10);
            out.textContent = JSON.stringify(parse(), null, sp); ok('Valid JSON ✓'); } catch(e){ err(e); }
        };
        r.querySelector('#jMin').onclick = function(){
          try { out.textContent = JSON.stringify(parse()); ok('Minified ✓'); } catch(e){ err(e); }
        };
      }
    },

    base64: {
      title: 'Base64 Encode / Decode', lead: 'Convert text to and from Base64 (standard or URL-safe).',
      html: function(){
        return '<label class="lbl">Input</label>' +
          '<textarea class="ta" id="bIn" spellcheck="false" placeholder="Text or Base64…"></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="bEnc" type="button">Encode →</button>' +
            '<button class="btn btn--light" id="bDec" type="button">← Decode</button>' +
            '<label class="check"><input type="checkbox" id="bUrl"> URL-safe</label>' +
          '</div>' + outBlock('b', true);
      },
      init: function(r){
        var inp = r.querySelector('#bIn'), out = r.querySelector('#bOut'), st = r.querySelector('#bSt');
        r.querySelector('#bEnc').onclick = function(){
          try { out.textContent = b64encode(inp.value, r.querySelector('#bUrl').checked);
            st.className = 'status status--ok'; st.textContent = 'Encoded ✓'; }
          catch(e){ st.className = 'status status--err'; st.textContent = String(e); }
        };
        r.querySelector('#bDec').onclick = function(){
          try { out.textContent = b64decode(inp.value);
            st.className = 'status status--ok'; st.textContent = 'Decoded ✓'; }
          catch(e){ st.className = 'status status--err'; st.textContent = 'Invalid Base64.'; out.textContent = ''; }
        };
      }
    },

    jwt: {
      title: 'JWT Decoder', lead: 'Inspect a JSON Web Token: header, payload and timing. Signature is NOT verified.',
      html: function(){
        return '<label class="lbl">Paste JWT</label>' +
          '<textarea class="ta" id="wIn" spellcheck="false" placeholder="eyJhbGciOi…"></textarea>' +
          '<div class="row" style="margin-top:12px"><button class="btn" id="wDec" type="button">Decode</button></div>' +
          '<p class="status" id="wSt"></p>' +
          '<label class="lbl" style="margin-top:10px">Header</label><pre class="out__box" id="wHead"></pre>' +
          '<label class="lbl" style="margin-top:12px">Payload</label><pre class="out__box" id="wPay"></pre>' +
          '<dl class="kv" id="wTimes"></dl>';
      },
      init: function(r){
        var st = r.querySelector('#wSt');
        r.querySelector('#wDec').onclick = function(){
          var raw = r.querySelector('#wIn').value.trim();
          var parts = raw.split('.');
          if (parts.length < 2){ st.className = 'status status--err'; st.textContent = 'Not a valid JWT (needs at least 2 dot-separated parts).'; return; }
          try {
            var header = JSON.parse(b64decode(parts[0]));
            var payload = JSON.parse(b64decode(parts[1]));
            r.querySelector('#wHead').textContent = JSON.stringify(header, null, 2);
            r.querySelector('#wPay').textContent  = JSON.stringify(payload, null, 2);
            var kv = r.querySelector('#wTimes'); kv.innerHTML = '';
            function addTime(label, secs){
              if (secs == null) return;
              var d = new Date(secs * 1000);
              kv.insertAdjacentHTML('beforeend', '<dt>' + esc(label) + '</dt><dd>' + esc(d.toLocaleString()) + '</dd>');
            }
            addTime('Issued (iat)', payload.iat);
            addTime('Not before (nbf)', payload.nbf);
            addTime('Expires (exp)', payload.exp);
            if (payload.exp != null){
              var left = payload.exp * 1000 - Date.now();
              kv.insertAdjacentHTML('beforeend', '<dt>Status</dt><dd>' +
                (left > 0 ? 'valid, expires in ' + humanDur(left) : 'EXPIRED ' + humanDur(-left) + ' ago') + '</dd>');
            }
            st.className = 'status status--ok'; st.textContent = 'Decoded ✓ (signature not verified)';
          } catch(e){ st.className = 'status status--err'; st.textContent = 'Could not decode: ' + String(e.message || e); }
        };
      }
    },

    url: {
      title: 'URL Encode / Decode', lead: 'Percent-encode or decode text for use in URLs.',
      html: function(){
        return '<label class="lbl">Input</label>' +
          '<textarea class="ta" id="uIn" spellcheck="false" placeholder="https://example.com/?q=ciao mondo"></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="uEnc" type="button">Encode</button>' +
            '<button class="btn btn--light" id="uDec" type="button">Decode</button>' +
            '<label class="check">Mode&nbsp;<select class="sel" id="uMode">' +
              '<option value="comp">Component (encodeURIComponent)</option>' +
              '<option value="full">Full URL (encodeURI)</option></select></label>' +
          '</div>' + outBlock('u', true);
      },
      init: function(r){
        var inp = r.querySelector('#uIn'), out = r.querySelector('#uOut'), st = r.querySelector('#uSt');
        function comp(){ return r.querySelector('#uMode').value === 'comp'; }
        r.querySelector('#uEnc').onclick = function(){
          try { out.textContent = comp() ? encodeURIComponent(inp.value) : encodeURI(inp.value);
            st.className = 'status status--ok'; st.textContent = 'Encoded ✓'; } catch(e){ st.className='status status--err'; st.textContent=String(e); }
        };
        r.querySelector('#uDec').onclick = function(){
          try { out.textContent = comp() ? decodeURIComponent(inp.value) : decodeURI(inp.value);
            st.className = 'status status--ok'; st.textContent = 'Decoded ✓'; }
          catch(e){ st.className = 'status status--err'; st.textContent = 'Malformed input.'; out.textContent=''; }
        };
      }
    },

    uuid: {
      title: 'UUID Generator', lead: 'Generate random RFC-4122 version-4 identifiers.',
      html: function(){
        return '<div class="row">' +
            '<button class="btn" id="idGen" type="button">Generate</button>' +
            '<label class="check">Count&nbsp;<input class="inp" id="idN" type="number" min="1" max="100" value="5" style="width:80px"></label>' +
            '<label class="check"><input type="checkbox" id="idUp"> Uppercase</label>' +
            '<button class="btn btn--light" data-copy-list="idList" type="button">Copy all</button>' +
          '</div><ul class="mono-list" id="idList"></ul>';
      },
      init: function(r){
        var list = r.querySelector('#idList');
        function gen(){
          var n = Math.min(100, Math.max(1, parseInt(r.querySelector('#idN').value,10) || 1));
          var up = r.querySelector('#idUp').checked;
          list.innerHTML = '';
          for (var i = 0; i < n; i++){
            var id = uuidv4(); if (up) id = id.toUpperCase();
            var li = document.createElement('li');
            li.innerHTML = '<span>' + id + '</span><button class="btn btn--ghost" data-copy-text="' + id + '" type="button">Copy</button>';
            list.appendChild(li);
          }
        }
        r.querySelector('#idGen').onclick = gen;
        gen();
      }
    },

    hash: {
      title: 'Hash Generator', lead: 'Compute SHA-1 / SHA-256 / SHA-384 / SHA-512 digests of any text.',
      html: function(){
        return '<label class="lbl">Input</label>' +
          '<textarea class="ta" id="hIn" spellcheck="false" placeholder="Text to hash…"></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="hGo" type="button">Compute</button>' +
            '<label class="check">Algorithm&nbsp;<select class="sel" id="hAlg">' +
              '<option>SHA-256</option><option>SHA-1</option><option>SHA-384</option><option>SHA-512</option></select></label>' +
          '</div>' + outBlock('h', true);
      },
      init: function(r){
        var out = r.querySelector('#hOut'), st = r.querySelector('#hSt');
        r.querySelector('#hGo').onclick = function(){
          var alg = r.querySelector('#hAlg').value;
          crypto.subtle.digest(alg, new TextEncoder().encode(r.querySelector('#hIn').value))
            .then(function(buf){ out.textContent = hexOf(buf); st.className='status status--ok'; st.textContent = alg + ' ✓'; })
            .catch(function(e){ st.className='status status--err'; st.textContent = String(e); });
        };
      }
    },

    epoch: {
      title: 'Timestamp Converter', lead: 'Convert between Unix epoch and human-readable dates.',
      html: function(){
        return '<label class="lbl">Unix timestamp</label>' +
          '<div class="row">' +
            '<input class="inp" id="eTs" type="text" placeholder="1700000000" style="flex:1 1 180px">' +
            '<select class="sel" id="eUnit"><option value="s">seconds</option><option value="ms">milliseconds</option></select>' +
            '<button class="btn" id="eGo" type="button">Convert</button>' +
            '<button class="btn btn--light" id="eNow" type="button">Now</button>' +
          '</div><dl class="kv" id="eOut"></dl>' +
          '<label class="lbl" style="margin-top:18px">From a date</label>' +
          '<div class="row"><input class="inp" id="eDate" type="datetime-local" style="flex:1 1 220px">' +
            '<button class="btn btn--light" id="eD2" type="button">→ epoch</button></div>' +
          '<dl class="kv" id="eOut2"></dl>';
      },
      init: function(r){
        var kv = r.querySelector('#eOut');
        function render(ms){
          var d = new Date(ms);
          if (isNaN(d.getTime())){ kv.innerHTML = '<dt>Error</dt><dd>Invalid timestamp.</dd>'; return; }
          var rel = Date.now() - ms;
          kv.innerHTML =
            '<dt>Local</dt><dd>' + esc(d.toLocaleString()) + '</dd>' +
            '<dt>UTC</dt><dd>' + esc(d.toUTCString()) + '</dd>' +
            '<dt>ISO 8601</dt><dd>' + esc(d.toISOString()) + '</dd>' +
            '<dt>Relative</dt><dd>' + (rel >= 0 ? humanDur(rel) + ' ago' : 'in ' + humanDur(-rel)) + '</dd>';
        }
        r.querySelector('#eGo').onclick = function(){
          var v = parseFloat(r.querySelector('#eTs').value);
          if (isNaN(v)){ kv.innerHTML = '<dt>Error</dt><dd>Enter a number.</dd>'; return; }
          render(r.querySelector('#eUnit').value === 'ms' ? v : v * 1000);
        };
        r.querySelector('#eNow').onclick = function(){
          var now = Date.now();
          r.querySelector('#eTs').value = r.querySelector('#eUnit').value === 'ms' ? now : Math.floor(now/1000);
          render(now);
        };
        r.querySelector('#eD2').onclick = function(){
          var val = r.querySelector('#eDate').value;
          if (!val){ r.querySelector('#eOut2').innerHTML = '<dt>Error</dt><dd>Pick a date.</dd>'; return; }
          var ms = new Date(val).getTime();
          r.querySelector('#eOut2').innerHTML =
            '<dt>Epoch (s)</dt><dd>' + Math.floor(ms/1000) + '</dd>' +
            '<dt>Epoch (ms)</dt><dd>' + ms + '</dd>' +
            '<dt>ISO 8601</dt><dd>' + esc(new Date(ms).toISOString()) + '</dd>';
        };
      }
    },

    text: {
      title: 'Text & Case Tools', lead: 'Count characters and words, and transform text case.',
      html: function(){
        return '<label class="lbl">Text</label>' +
          '<textarea class="ta" id="tIn" spellcheck="false" placeholder="Type or paste text…"></textarea>' +
          '<div class="stats" id="tStats"></div>' +
          '<div class="row" style="margin-top:14px">' +
            '<button class="btn btn--light" data-tx="upper" type="button">UPPER</button>' +
            '<button class="btn btn--light" data-tx="lower" type="button">lower</button>' +
            '<button class="btn btn--light" data-tx="title" type="button">Title</button>' +
            '<button class="btn btn--light" data-tx="slug" type="button">slug</button>' +
            '<button class="btn btn--light" data-tx="trim" type="button">Trim + squeeze</button>' +
            '<button class="btn btn--light" data-tx="reverse" type="button">Reverse</button>' +
          '</div>' + outBlock('t', true);
      },
      init: function(r){
        var inp = r.querySelector('#tIn'), out = r.querySelector('#tOut'), stats = r.querySelector('#tStats');
        function count(){
          var v = inp.value;
          var words = v.trim() ? v.trim().split(/\s+/).length : 0;
          var lines = v ? v.split(/\r\n|\r|\n/).length : 0;
          var bytes = new TextEncoder().encode(v).length;
          stats.innerHTML =
            stat(v.length,'chars') + stat(words,'words') + stat(lines,'lines') + stat(bytes,'bytes');
        }
        function stat(n,l){ return '<div class="stat"><b>' + n + '</b><span>' + l + '</span></div>'; }
        function transform(kind){
          var v = inp.value, o = v;
          if (kind === 'upper') o = v.toUpperCase();
          else if (kind === 'lower') o = v.toLowerCase();
          else if (kind === 'title') o = v.replace(/\w\S*/g, function(w){ return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); });
          else if (kind === 'slug') o = v.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');
          else if (kind === 'trim') o = v.replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').trim();
          else if (kind === 'reverse') o = v.split('').reverse().join('');
          out.textContent = o;
        }
        inp.addEventListener('input', count);
        var btns = r.querySelectorAll('[data-tx]');
        for (var i = 0; i < btns.length; i++){ btns[i].onclick = (function(k){ return function(){ transform(k); }; })(btns[i].getAttribute('data-tx')); }
        count();
      }
    },

    color: {
      title: 'Color Converter', lead: 'Convert between HEX, RGB and HSL with a live preview.',
      html: function(){
        return '<div class="row">' +
            '<input class="inp" id="cIn" type="text" placeholder="#2A9D8F or rgb(42,157,143)" style="flex:1 1 220px">' +
            '<input type="color" id="cPick" value="#2a9d8f" style="width:48px;height:44px;border:1px solid var(--line);border-radius:10px;background:var(--card);cursor:pointer">' +
            '<button class="btn" id="cGo" type="button">Convert</button>' +
          '</div>' +
          '<div class="swatch" id="cSw"></div>' +
          '<dl class="kv" id="cOut"></dl><p class="status" id="cSt"></p>';
      },
      init: function(r){
        var st = r.querySelector('#cSt'), kv = r.querySelector('#cOut'), sw = r.querySelector('#cSw');
        function toHex(rgb){ return '#' + rgb.map(function(x){ var h = x.toString(16); return (h.length===1?'0':'')+h; }).join(''); }
        function toHsl(rgb){
          var rr = rgb[0]/255, gg = rgb[1]/255, bb = rgb[2]/255;
          var max = Math.max(rr,gg,bb), min = Math.min(rr,gg,bb), h=0, s=0, l=(max+min)/2, d=max-min;
          if (d){ s = l > 0.5 ? d/(2-max-min) : d/(max+min);
            if (max===rr) h = (gg-bb)/d + (gg<bb?6:0); else if (max===gg) h = (bb-rr)/d+2; else h = (rr-gg)/d+4; h *= 60; }
          return [Math.round(h), Math.round(s*100), Math.round(l*100)];
        }
        function parse(str){
          str = str.trim(); var m;
          if (m = str.match(/^#?([0-9a-f]{3})$/i)){ var c=m[1]; return [parseInt(c[0]+c[0],16),parseInt(c[1]+c[1],16),parseInt(c[2]+c[2],16)]; }
          if (m = str.match(/^#?([0-9a-f]{6})$/i)){ var c2=m[1]; return [parseInt(c2.slice(0,2),16),parseInt(c2.slice(2,4),16),parseInt(c2.slice(4,6),16)]; }
          if (m = str.match(/rgba?\(([^)]+)\)/i)){ var p=m[1].split(',').map(function(x){return Math.round(parseFloat(x));});
            if (p.length>=3 && p.slice(0,3).every(function(x){return x>=0&&x<=255;})) return p.slice(0,3); }
          return null;
        }
        function show(rgb){
          var hex = toHex(rgb), hsl = toHsl(rgb);
          sw.style.background = hex;
          kv.innerHTML =
            '<dt>HEX</dt><dd>' + hex + '</dd>' +
            '<dt>RGB</dt><dd>rgb(' + rgb.join(', ') + ')</dd>' +
            '<dt>HSL</dt><dd>hsl(' + hsl[0] + ', ' + hsl[1] + '%, ' + hsl[2] + '%)</dd>';
          r.querySelector('#cPick').value = hex;
          st.textContent = '';
        }
        function run(){
          var rgb = parse(r.querySelector('#cIn').value);
          if (!rgb){ st.className='status status--err'; st.textContent='Enter a valid HEX or rgb() color.'; return; }
          show(rgb);
        }
        r.querySelector('#cGo').onclick = run;
        r.querySelector('#cIn').addEventListener('keydown', function(e){ if (e.key==='Enter') run(); });
        r.querySelector('#cPick').addEventListener('input', function(){ r.querySelector('#cIn').value = this.value; show(parse(this.value)); });
        r.querySelector('#cIn').value = '#2A9D8F'; run();
      }
    },

    regex: {
      title: 'Regex Tester', lead: 'Test a JavaScript regular expression against text; inspect matches and capture groups.',
      html: function(){
        return '<div class="row"><span class="rx-slash">/</span>' +
            '<input class="inp" id="rPat" placeholder="\\b\\w+\\b" style="flex:1 1 240px" spellcheck="false">' +
            '<span class="rx-slash">/</span>' +
            '<input class="inp" id="rFlags" value="g" placeholder="gimsu" style="width:90px" spellcheck="false"></div>' +
          '<label class="lbl" style="margin-top:8px">Test string</label>' +
          '<textarea class="ta" id="rStr" spellcheck="false" placeholder="Text to search…"></textarea>' +
          '<p class="status" id="rSt"></p>' +
          '<label class="lbl" style="margin-top:6px">Highlighted</label><pre class="out__box" id="rHi"></pre>' +
          '<label class="lbl" style="margin-top:12px">Matches</label><pre class="out__box" id="rOut"></pre>';
      },
      init: function(r){
        var st = r.querySelector('#rSt'), hi = r.querySelector('#rHi'), out = r.querySelector('#rOut');
        function run(){
          var pat = r.querySelector('#rPat').value, flags = r.querySelector('#rFlags').value, str = r.querySelector('#rStr').value;
          if (!pat){ st.textContent = ''; hi.textContent = ''; out.textContent = ''; return; }
          var re; try { re = new RegExp(pat, flags); } catch(e){ st.className = 'status status--err'; st.textContent = String(e.message || e); return; }
          var matches = [], m, guard = 0;
          if (re.global){ while ((m = re.exec(str)) !== null){ matches.push(m); if (m.index === re.lastIndex) re.lastIndex++; if (++guard > 10000) break; } }
          else { m = re.exec(str); if (m) matches.push(m); }
          st.className = 'status status--ok'; st.textContent = matches.length + ' match' + (matches.length === 1 ? '' : 'es');
          var h = '', last = 0;
          matches.forEach(function(mm){ h += esc(str.slice(last, mm.index)) + '<mark>' + esc(mm[0]) + '</mark>'; last = mm.index + mm[0].length; });
          h += esc(str.slice(last));
          hi.innerHTML = h || '<span style="color:var(--muted)">— no matches —</span>';
          out.textContent = matches.map(function(mm, i){
            var line = '#' + (i+1) + '  at ' + mm.index + '  "' + mm[0] + '"';
            for (var g = 1; g < mm.length; g++) line += '\n    group ' + g + ': ' + (mm[g] === undefined ? '(undefined)' : '"' + mm[g] + '"');
            if (mm.groups) for (var k in mm.groups) line += '\n    <' + k + '>: ' + (mm.groups[k] === undefined ? '(undefined)' : '"' + mm.groups[k] + '"');
            return line;
          }).join('\n\n');
        }
        r.querySelector('#rPat').addEventListener('input', run);
        r.querySelector('#rFlags').addEventListener('input', run);
        r.querySelector('#rStr').addEventListener('input', run);
      }
    },

    rxbuild: {
      title: 'Regex Builder', lead: 'Build a regular expression by clicking tokens, or start from a ready-made pattern. Live preview as you go.',
      html: function(){
        function pal(items){
          return items.map(function(it){
            return '<button type="button" class="rxbtn" data-ins="' + esc(it[0]) + '" data-back="' + (it[2] || 0) + '" title="' + esc(it[1]) + '">' + esc(it[0]) + '</button>';
          }).join('');
        }
        var classes = [['.','any character except newline'],['\\d','digit 0-9'],['\\w','word character'],['\\s','whitespace'],
          ['\\D','non-digit'],['\\W','non-word'],['\\S','non-whitespace'],['[]','character set',1],['[^]','negated set',1],['[a-z]','range']];
        var anchors = [['^','start of line'],['$','end of line'],['\\b','word boundary'],['\\B','non-boundary']];
        var quant = [['*','0 or more'],['+','1 or more'],['?','optional (0 or 1)'],['{2}','exactly 2'],['{2,}','2 or more'],['{2,5}','2 to 5'],['*?','lazy (as few as possible)']];
        var groups = [['()','capturing group',1],['(?:)','non-capturing group',1],['(?<name>)','named group',1],['|','alternation (or)'],['\\1','backreference']];
        var LIB = [['Email','[\\w.+-]+@[\\w-]+\\.[\\w.-]+'],['URL','https?:\\/\\/[^\\s]+'],
          ['IPv4','\\b(?:\\d{1,3}\\.){3}\\d{1,3}\\b'],['UUID','[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'],
          ['Date YYYY-MM-DD','\\d{4}-\\d{2}-\\d{2}'],['Time 24h','([01]\\d|2[0-3]):[0-5]\\d'],
          ['Hex color','#(?:[0-9a-f]{3}|[0-9a-f]{6})\\b'],['Slug','[a-z0-9]+(?:-[a-z0-9]+)*'],
          ['Integer','-?\\d+'],['Decimal','-?\\d+(?:\\.\\d+)?'],['Phone','\\+?\\d[\\d\\s().-]{7,}\\d'],['Word','\\b\\w+\\b']];
        var opts = '<option value="">Insert a ready-made pattern…</option>' +
          LIB.map(function(p){ return '<option value="' + esc(p[1]) + '">' + esc(p[0]) + '</option>'; }).join('');
        var cheat = [['.','any char except newline'],['\\d  \\w  \\s','digit / word / whitespace'],['[abc]  [^abc]','set / negated set'],
          ['a*  a+  a?','0+, 1+, 0-1'],['a{2,5}','2 to 5 of a'],['^  $','line start / end'],['\\b','word boundary'],
          ['(ab)  (?:ab)','group / non-capturing'],['a|b','a or b'],['\\.','literal dot (escaped)']];
        return '<div class="row"><span class="rx-slash">/</span>' +
            '<input class="inp" id="rbPat" placeholder="build your pattern…" style="flex:1 1 240px" spellcheck="false">' +
            '<span class="rx-slash">/</span>' +
            '<input class="inp" id="rbFlags" value="g" placeholder="gimsu" style="width:90px" spellcheck="false"></div>' +
          '<select class="sel" id="rbLib" style="margin-top:10px;width:100%">' + opts + '</select>' +
          '<div class="rxgroup"><span class="lbl">Character classes</span><div class="rxpal">' + pal(classes) + '</div></div>' +
          '<div class="rxgroup"><span class="lbl">Anchors</span><div class="rxpal">' + pal(anchors) + '</div></div>' +
          '<div class="rxgroup"><span class="lbl">Quantifiers</span><div class="rxpal">' + pal(quant) + '</div></div>' +
          '<div class="rxgroup"><span class="lbl">Groups &amp; logic</span><div class="rxpal">' + pal(groups) + '</div></div>' +
          '<label class="lbl" style="margin-top:8px">Test string</label>' +
          '<textarea class="ta" id="rbStr" spellcheck="false" placeholder="Type sample text to see live matches…"></textarea>' +
          '<p class="status" id="rbSt"></p>' +
          '<label class="lbl">Highlighted</label><pre class="out__box" id="rbHi"></pre>' +
          '<details style="margin-top:12px"><summary class="lbl" style="cursor:pointer">Cheat sheet</summary>' +
            '<dl class="kv" style="margin-top:8px">' + cheat.map(function(c){ return '<dt>' + esc(c[0]) + '</dt><dd>' + esc(c[1]) + '</dd>'; }).join('') + '</dl></details>';
      },
      init: function(r){
        var pat = r.querySelector('#rbPat'), st = r.querySelector('#rbSt'), hi = r.querySelector('#rbHi');
        function insertAtCursor(text, back){
          var s = pat.selectionStart == null ? pat.value.length : pat.selectionStart;
          var e = pat.selectionEnd == null ? pat.value.length : pat.selectionEnd;
          pat.value = pat.value.slice(0, s) + text + pat.value.slice(e);
          var pos = s + text.length - (back || 0);
          pat.focus(); try { pat.setSelectionRange(pos, pos); } catch(x){}
        }
        function run(){
          var p = pat.value, flags = r.querySelector('#rbFlags').value, str = r.querySelector('#rbStr').value;
          if (!p){ st.textContent = ''; hi.textContent = ''; return; }
          var re; try { re = new RegExp(p, flags); } catch(err){ st.className = 'status status--err'; st.textContent = String(err.message || err); return; }
          var matches = [], m, guard = 0;
          if (re.global){ while ((m = re.exec(str)) !== null){ matches.push(m); if (m.index === re.lastIndex) re.lastIndex++; if (++guard > 10000) break; } }
          else { m = re.exec(str); if (m) matches.push(m); }
          st.className = 'status status--ok'; st.textContent = matches.length + ' match' + (matches.length === 1 ? '' : 'es');
          var h = '', last = 0;
          matches.forEach(function(mm){ h += esc(str.slice(last, mm.index)) + '<mark>' + esc(mm[0]) + '</mark>'; last = mm.index + mm[0].length; });
          h += esc(str.slice(last));
          hi.innerHTML = h || '<span style="color:var(--muted)">— no matches —</span>';
        }
        var btns = r.querySelectorAll('.rxbtn');
        for (var i = 0; i < btns.length; i++){
          btns[i].addEventListener('click', (function(b){ return function(){ insertAtCursor(b.getAttribute('data-ins'), parseInt(b.getAttribute('data-back'), 10) || 0); run(); }; })(btns[i]));
        }
        r.querySelector('#rbLib').addEventListener('change', function(){ if (this.value){ pat.value = this.value; run(); this.selectedIndex = 0; pat.focus(); } });
        pat.addEventListener('input', run);
        r.querySelector('#rbFlags').addEventListener('input', run);
        r.querySelector('#rbStr').addEventListener('input', run);
      }
    },

    cron: {
      title: 'Cron Explainer', lead: 'Understand a 5-field cron expression and preview the next scheduled runs.',
      html: function(){
        return '<div class="row"><input class="inp" id="cronIn" placeholder="*/15 9-17 * * 1-5" style="flex:1 1 260px" spellcheck="false">' +
            '<button class="btn" id="cronGo" type="button">Explain</button></div>' +
          '<p class="field__hint">Fields: minute&nbsp; hour&nbsp; day-of-month&nbsp; month&nbsp; day-of-week. Supports * , - / and names (JAN, MON).</p>' +
          '<p class="status" id="cronSt"></p>' +
          '<label class="lbl" style="margin-top:6px">Meaning</label><pre class="out__box" id="cronDesc"></pre>' +
          '<label class="lbl" style="margin-top:12px">Next runs (local time)</label><pre class="out__box" id="cronNext"></pre>';
      },
      init: function(r){
        var st = r.querySelector('#cronSt'), MONTHS = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
            DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
            MON = {JAN:1,FEB:2,MAR:3,APR:4,MAY:5,JUN:6,JUL:7,AUG:8,SEP:9,OCT:10,NOV:11,DEC:12},
            DOW = {SUN:0,MON:1,TUE:2,WED:3,THU:4,FRI:5,SAT:6};
        function subst(s, map){ return s.toUpperCase().replace(/[A-Z]{3}/g, function(t){ return map[t] != null ? map[t] : t; }); }
        function parseField(spec, min, max){
          var set = {};
          spec.split(',').forEach(function(part){
            var step = 1, range = part, slash = part.split('/');
            if (slash.length === 2){ range = slash[0]; step = parseInt(slash[1], 10); if (!(step > 0)) throw new Error('bad step in "' + part + '"'); }
            var lo, hi;
            if (range === '*'){ lo = min; hi = max; }
            else if (range.indexOf('-') >= 0){ var ab = range.split('-'); lo = parseInt(ab[0], 10); hi = parseInt(ab[1], 10); }
            else { lo = hi = parseInt(range, 10); }
            if (isNaN(lo) || isNaN(hi)) throw new Error('bad field "' + part + '"');
            if (lo < min || hi > max || lo > hi) throw new Error('"' + part + '" out of range ' + min + '-' + max);
            for (var v = lo; v <= hi; v += step) set[v] = true;
          });
          return Object.keys(set).map(Number).sort(function(a,b){ return a - b; });
        }
        r.querySelector('#cronGo').onclick = function(){
          var expr = r.querySelector('#cronIn').value.trim();
          var f = expr.split(/\s+/);
          if (f.length !== 5){ st.className = 'status status--err'; st.textContent = 'A cron expression needs 5 fields (min hour dom month dow).'; return; }
          try {
            var mins = parseField(f[0], 0, 59), hours = parseField(f[1], 0, 23), doms = parseField(f[2], 1, 31),
                months = parseField(subst(f[3], MON), 1, 12), dowRaw = parseField(subst(f[4], DOW), 0, 7);
            var dset = {}; dowRaw.forEach(function(v){ dset[v === 7 ? 0 : v] = true; });
            var dows = Object.keys(dset).map(Number).sort(function(a,b){ return a - b; });
            var domStar = f[2] === '*', dowStar = f[4] === '*';
            function matchesDate(d){
              if (mins.indexOf(d.getMinutes()) < 0) return false;
              if (hours.indexOf(d.getHours()) < 0) return false;
              if (months.indexOf(d.getMonth() + 1) < 0) return false;
              var domOk = doms.indexOf(d.getDate()) >= 0, dowOk = dows.indexOf(d.getDay()) >= 0;
              if (domStar && dowStar) return true;
              if (domStar) return dowOk;
              if (dowStar) return domOk;
              return domOk || dowOk;
            }
            var d = new Date(); d.setSeconds(0, 0); d.setMinutes(d.getMinutes() + 1);
            var runs = [], cap = 0;
            while (runs.length < 5 && cap < 527040){ if (matchesDate(d)) runs.push(new Date(d.getTime())); d.setMinutes(d.getMinutes() + 1); cap++; }
            var summary = '';
            if (mins.length === 1 && hours.length === 1){
              summary = 'At ' + pad2(hours[0]) + ':' + pad2(mins[0]) +
                (domStar && dowStar && f[3] === '*' ? ', every day.' :
                 (!dowStar ? ', on ' + dows.map(function(w){ return DAYS[w]; }).join('/') + '.' : '.'));
            }
            var lines = [
              'Minute:        ' + (f[0] === '*' ? 'every minute' : mins.join(', ')),
              'Hour:          ' + (f[1] === '*' ? 'every hour' : hours.join(', ')),
              'Day of month:  ' + (f[2] === '*' ? 'every day' : doms.join(', ')),
              'Month:         ' + (f[3] === '*' ? 'every month' : months.map(function(m){ return MONTHS[m]; }).join(', ')),
              'Day of week:   ' + (f[4] === '*' ? 'every day' : dows.map(function(w){ return DAYS[w]; }).join(', '))
            ];
            r.querySelector('#cronDesc').textContent = (summary ? summary + '\n\n' : '') + lines.join('\n');
            r.querySelector('#cronNext').textContent = runs.length ? runs.map(function(x){ return x.toLocaleString(); }).join('\n') : 'No upcoming run within the next year.';
            st.className = 'status status--ok'; st.textContent = 'Valid ✓';
          } catch(e){ st.className = 'status status--err'; st.textContent = String(e.message || e);
            r.querySelector('#cronDesc').textContent = ''; r.querySelector('#cronNext').textContent = ''; }
        };
      }
    },

    diff: {
      title: 'Text Diff', lead: 'Compare two blocks of text line by line.',
      html: function(){
        return '<div class="diff-cols">' +
            '<div><label class="lbl">Original</label><textarea class="ta" id="dA" spellcheck="false"></textarea></div>' +
            '<div><label class="lbl">Changed</label><textarea class="ta" id="dB" spellcheck="false"></textarea></div></div>' +
          '<div class="row" style="margin-top:12px"><button class="btn" id="dGo" type="button">Compare</button>' +
            '<span class="status" id="dSt"></span></div>' +
          '<pre class="out__box" id="dOut" style="margin-top:12px"></pre>';
      },
      init: function(r){
        var st = r.querySelector('#dSt'), out = r.querySelector('#dOut');
        function diffLines(a, b){
          var m = a.length, n = b.length, dp = [];
          for (var i = 0; i <= m; i++){ dp.push(new Array(n + 1).fill(0)); }
          for (var i2 = m - 1; i2 >= 0; i2--) for (var j2 = n - 1; j2 >= 0; j2--)
            dp[i2][j2] = a[i2] === b[j2] ? dp[i2+1][j2+1] + 1 : Math.max(dp[i2+1][j2], dp[i2][j2+1]);
          var res = [], i = 0, j = 0;
          while (i < m && j < n){
            if (a[i] === b[j]){ res.push([' ', a[i]]); i++; j++; }
            else if (dp[i+1][j] >= dp[i][j+1]){ res.push(['-', a[i]]); i++; }
            else { res.push(['+', b[j]]); j++; }
          }
          while (i < m){ res.push(['-', a[i]]); i++; }
          while (j < n){ res.push(['+', b[j]]); j++; }
          return res;
        }
        r.querySelector('#dGo').onclick = function(){
          var a = r.querySelector('#dA').value.split(/\r?\n/), b = r.querySelector('#dB').value.split(/\r?\n/);
          if (a.length > 3000 || b.length > 3000){ st.className = 'status status--err'; st.textContent = 'Too large (max 3000 lines each).'; return; }
          var rows = diffLines(a, b), add = 0, del = 0;
          var h = rows.map(function(row){
            if (row[0] === '+') add++; else if (row[0] === '-') del++;
            var color = row[0] === '+' ? 'var(--green)' : row[0] === '-' ? 'var(--danger)' : 'var(--muted)';
            return '<span style="color:' + color + '">' + esc(row[0] + ' ' + row[1]) + '</span>';
          }).join('\n');
          out.innerHTML = h;
          st.className = 'status status--ok'; st.textContent = '+' + add + ' added, −' + del + ' removed';
        };
      }
    },

    html: {
      title: 'HTML Entities', lead: 'Encode or decode HTML entities (&amp;, &lt;, &#169; …).',
      html: function(){
        return '<label class="lbl">Input</label>' +
          '<textarea class="ta" id="heIn" spellcheck="false" placeholder="<b>Bien sûr</b> & co."></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="heEnc" type="button">Encode</button>' +
            '<button class="btn btn--light" id="heDec" type="button">Decode</button>' +
            '<label class="check"><input type="checkbox" id="heAll"> Also non-ASCII</label>' +
          '</div>' + outBlock('he', true);
      },
      init: function(r){
        var out = r.querySelector('#heOut'), st = r.querySelector('#heSt');
        var named = { amp:'&', lt:'<', gt:'>', quot:'"', apos:"'", nbsp:' ', copy:'©', reg:'®',
          trade:'™', hellip:'…', mdash:'—', ndash:'–', euro:'€', pound:'£', deg:'°' };
        function enc(s, all){
          var map = {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
          var o = s.replace(/[&<>"']/g, function(c){ return map[c]; });
          if (all) o = o.replace(/[^\x00-\x7F]/g, function(c){ return '&#' + c.codePointAt(0) + ';'; });
          return o;
        }
        function dec(s){
          return s.replace(/&(#x?[0-9a-f]+|[a-z][a-z0-9]*);/gi, function(mm, e){
            if (e[0] === '#'){ var code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
              try { return isNaN(code) ? mm : String.fromCodePoint(code); } catch(x){ return mm; } }
            var k = e.toLowerCase(); return named[k] != null ? named[k] : mm;
          });
        }
        r.querySelector('#heEnc').onclick = function(){ out.textContent = enc(r.querySelector('#heIn').value, r.querySelector('#heAll').checked); st.className = 'status status--ok'; st.textContent = 'Encoded ✓'; };
        r.querySelector('#heDec').onclick = function(){ out.textContent = dec(r.querySelector('#heIn').value); st.className = 'status status--ok'; st.textContent = 'Decoded ✓'; };
      }
    },

    lorem: {
      title: 'Lorem Ipsum', lead: 'Generate placeholder text — paragraphs, sentences or words.',
      html: function(){
        return '<div class="row">' +
            '<input class="inp" id="loN" type="number" min="1" max="100" value="3" style="width:90px">' +
            '<select class="sel" id="loUnit"><option value="paragraphs">paragraphs</option><option value="sentences">sentences</option><option value="words">words</option></select>' +
            '<label class="check"><input type="checkbox" id="loStart" checked> Start with “Lorem ipsum”</label>' +
            '<button class="btn" id="loGo" type="button">Generate</button>' +
          '</div>' + outBlock('lo', true);
      },
      init: function(r){
        var out = r.querySelector('#loOut');
        var W = ('lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et ' +
          'dolore magna aliqua enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo ' +
          'consequat duis aute irure in reprehenderit voluptate velit esse cillum eu fugiat nulla pariatur excepteur sint ' +
          'occaecat cupidatat non proident sunt culpa qui officia deserunt mollit anim id est laborum').split(' ');
        function ri(a, b){ return a + Math.floor(Math.random() * (b - a + 1)); }
        function word(){ return W[ri(0, W.length - 1)]; }
        function sentence(){ var n = ri(6, 15), s = []; for (var i = 0; i < n; i++) s.push(word()); var str = s.join(' '); return str.charAt(0).toUpperCase() + str.slice(1) + '.'; }
        function paragraph(){ var n = ri(3, 6), p = []; for (var i = 0; i < n; i++) p.push(sentence()); return p.join(' '); }
        r.querySelector('#loGo').onclick = function(){
          var n = Math.min(100, Math.max(1, parseInt(r.querySelector('#loN').value, 10) || 1));
          var unit = r.querySelector('#loUnit').value, res = [];
          if (unit === 'words'){ for (var i = 0; i < n; i++) res.push(word()); out.textContent = res.join(' '); }
          else if (unit === 'sentences'){ for (var j = 0; j < n; j++) res.push(sentence()); out.textContent = res.join(' '); }
          else { for (var k = 0; k < n; k++) res.push(paragraph()); out.textContent = res.join('\n\n'); }
          if (r.querySelector('#loStart').checked){
            out.textContent = out.textContent.replace(/^\S+ \S+/, 'Lorem ipsum').replace(/^./, 'L');
            if (out.textContent.slice(0, 11).toLowerCase() !== 'lorem ipsum') out.textContent = 'Lorem ipsum ' + out.textContent;
          }
        };
        r.querySelector('#loGo').onclick();
      }
    },

    numbase: {
      title: 'Number Base Converter', lead: 'Convert integers between binary, octal, decimal and hexadecimal (big numbers supported).',
      html: function(){
        return '<div class="row"><input class="inp" id="nbIn" placeholder="255" style="flex:1 1 200px" spellcheck="false">' +
            '<span class="lbl" style="margin:0">from</span>' +
            '<select class="sel" id="nbBase"><option value="10">Decimal</option><option value="2">Binary</option><option value="8">Octal</option><option value="16">Hex</option></select>' +
            '<button class="btn" id="nbGo" type="button">Convert</button></div>' +
          '<dl class="kv" id="nbOut"></dl><p class="status" id="nbSt"></p>';
      },
      init: function(r){
        var kv = r.querySelector('#nbOut'), st = r.querySelector('#nbSt');
        function toBig(str, base){
          var digits = '0123456789abcdefghijklmnopqrstuvwxyz';
          str = str.trim().toLowerCase(); var neg = false;
          if (str[0] === '-'){ neg = true; str = str.slice(1); }
          if (!str.length) throw new Error('empty input');
          var big = 0n, B = BigInt(base);
          for (var i = 0; i < str.length; i++){ var d = digits.indexOf(str[i]); if (d < 0 || d >= base) throw new Error('invalid digit "' + str[i] + '" for base ' + base); big = big * B + BigInt(d); }
          return neg ? -big : big;
        }
        r.querySelector('#nbGo').onclick = function(){
          try {
            var v = toBig(r.querySelector('#nbIn').value, parseInt(r.querySelector('#nbBase').value, 10));
            kv.innerHTML =
              '<dt>Decimal</dt><dd>' + v.toString(10) + '</dd>' +
              '<dt>Binary</dt><dd>' + v.toString(2) + '</dd>' +
              '<dt>Octal</dt><dd>' + v.toString(8) + '</dd>' +
              '<dt>Hex</dt><dd>' + v.toString(16) + '</dd>';
            st.textContent = '';
          } catch(e){ st.className = 'status status--err'; st.textContent = String(e.message || e); }
        };
      }
    },

    password: {
      title: 'Password Generator', lead: 'Generate strong random passwords using the browser crypto RNG. Nothing leaves your device.',
      html: function(){
        return '<div class="row">' +
            '<label class="check">Length&nbsp;<input class="inp" id="pwLen" type="number" min="4" max="128" value="20" style="width:90px"></label>' +
            '<label class="check">Count&nbsp;<input class="inp" id="pwN" type="number" min="1" max="20" value="5" style="width:80px"></label>' +
            '<button class="btn" id="pwGo" type="button">Generate</button>' +
            '<button class="btn btn--light" data-copy-list="pwList" type="button">Copy all</button>' +
          '</div>' +
          '<div class="row">' +
            '<label class="check"><input type="checkbox" id="pwLo" checked> a-z</label>' +
            '<label class="check"><input type="checkbox" id="pwUp" checked> A-Z</label>' +
            '<label class="check"><input type="checkbox" id="pwDi" checked> 0-9</label>' +
            '<label class="check"><input type="checkbox" id="pwSy" checked> symbols</label>' +
            '<label class="check"><input type="checkbox" id="pwAmb"> exclude look-alikes</label>' +
          '</div>' +
          '<ul class="mono-list" id="pwList"></ul><p class="status" id="pwSt"></p>';
      },
      init: function(r){
        var list = r.querySelector('#pwList'), st = r.querySelector('#pwSt');
        function randStr(len, chars){
          var out = '', n = chars.length, max = 256 - (256 % n), buf = new Uint8Array(1);
          while (out.length < len){ crypto.getRandomValues(buf); if (buf[0] >= max) continue; out += chars[buf[0] % n]; }
          return out;
        }
        function gen(){
          var chars = '';
          if (r.querySelector('#pwLo').checked) chars += 'abcdefghijklmnopqrstuvwxyz';
          if (r.querySelector('#pwUp').checked) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          if (r.querySelector('#pwDi').checked) chars += '0123456789';
          if (r.querySelector('#pwSy').checked) chars += '!@#$%^&*()-_=+[]{};:,.?/';
          if (r.querySelector('#pwAmb').checked) chars = chars.replace(/[0O1lI|`]/g, '');
          if (!chars){ st.className = 'status status--err'; st.textContent = 'Pick at least one character set.'; list.innerHTML = ''; return; }
          st.textContent = '';
          var len = Math.min(128, Math.max(4, parseInt(r.querySelector('#pwLen').value, 10) || 20));
          var count = Math.min(20, Math.max(1, parseInt(r.querySelector('#pwN').value, 10) || 1));
          list.innerHTML = '';
          for (var i = 0; i < count; i++){
            var pw = randStr(len, chars), li = document.createElement('li');
            li.innerHTML = '<span>' + esc(pw) + '</span><button class="btn btn--ghost" data-copy-text="' + esc(pw) + '" type="button">Copy</button>';
            list.appendChild(li);
          }
        }
        r.querySelector('#pwGo').onclick = gen;
        gen();
      }
    },

    markdown: {
      title: 'Markdown Preview', lead: 'Render a safe subset of Markdown to HTML, live. Input is escaped — no raw HTML is injected.',
      html: function(){
        return '<div class="diff-cols">' +
            '<div><label class="lbl">Markdown</label><textarea class="ta" id="mdIn" spellcheck="false" placeholder="# Title\n\n**bold**, *italic*, `code`, [link](https://…)"></textarea></div>' +
            '<div><label class="lbl">Preview</label><div class="out__box mdprev" id="mdPrev"></div></div></div>' +
          '<div class="copybar"><span class="status status--ok">Rendered locally</span>' +
            '<button class="btn btn--light" data-copy="mdHtml" type="button">Copy HTML</button></div>' +
          '<pre class="out__box" id="mdHtml" style="max-height:160px"></pre>';
      },
      init: function(r){
        var inp = r.querySelector('#mdIn'), prev = r.querySelector('#mdPrev'), src = r.querySelector('#mdHtml');
        function inline(t){
          t = t.replace(/`([^`]+)`/g, function(_, c){ return '<code>' + c + '</code>'; });
          t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
          t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
          t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function(_, txt, url){
            if (!/^(https?:|mailto:|#|\/)/i.test(url)) url = '#';
            return '<a href="' + url + '" target="_blank" rel="noopener">' + txt + '</a>';
          });
          return t;
        }
        function toHtml(srcText){
          var lines = esc(srcText).split(/\r?\n/), html = '', i = 0;
          while (i < lines.length){
            var ln = lines[i];
            if (/^```/.test(ln)){ var buf = []; i++; while (i < lines.length && !/^```/.test(lines[i])){ buf.push(lines[i]); i++; } i++; html += '<pre><code>' + buf.join('\n') + '</code></pre>'; continue; }
            if (/^#{1,6}\s/.test(ln)){ var lvl = ln.match(/^#+/)[0].length; html += '<h' + lvl + '>' + inline(ln.replace(/^#+\s+/, '')) + '</h' + lvl + '>'; i++; continue; }
            if (/^(-{3,}|\*{3,}|_{3,})$/.test(ln.trim())){ html += '<hr>'; i++; continue; }
            if (/^&gt;\s?/.test(ln)){ var q = []; while (i < lines.length && /^&gt;\s?/.test(lines[i])){ q.push(lines[i].replace(/^&gt;\s?/, '')); i++; } html += '<blockquote>' + inline(q.join(' ')) + '</blockquote>'; continue; }
            if (/^\s*[-*]\s+/.test(ln)){ var it = []; while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])){ it.push('<li>' + inline(lines[i].replace(/^\s*[-*]\s+/, '')) + '</li>'); i++; } html += '<ul>' + it.join('') + '</ul>'; continue; }
            if (/^\s*\d+\.\s+/.test(ln)){ var oi = []; while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])){ oi.push('<li>' + inline(lines[i].replace(/^\s*\d+\.\s+/, '')) + '</li>'); i++; } html += '<ol>' + oi.join('') + '</ol>'; continue; }
            if (ln.trim() === ''){ i++; continue; }
            var para = []; while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6}\s|&gt;|\s*[-*]\s|\s*\d+\.\s|```|(-{3,}|\*{3,}|_{3,})$)/.test(lines[i])){ para.push(lines[i]); i++; }
            html += '<p>' + inline(para.join(' ')) + '</p>';
          }
          return html;
        }
        function run(){ var h = toHtml(inp.value); prev.innerHTML = h; src.textContent = h; }
        inp.addEventListener('input', run);
        inp.value = '# Hello\n\nSome **bold**, *italic* and `code`.\n\n- one\n- two\n\n> a quote\n\n[frontek](https://frontek.dev)';
        run();
      }
    },

    chmod: {
      title: 'Chmod Calculator', lead: 'Convert Unix file permissions between checkboxes, octal and symbolic notation.',
      html: function(){
        function grp(g, label){
          return '<div class="chmod-grp"><b>' + label + '</b>' +
            '<label class="check"><input type="checkbox" data-g="' + g + '" data-b="4"> read</label>' +
            '<label class="check"><input type="checkbox" data-g="' + g + '" data-b="2"> write</label>' +
            '<label class="check"><input type="checkbox" data-g="' + g + '" data-b="1"> execute</label></div>';
        }
        return '<div class="chmod-grid">' + grp('u','Owner') + grp('g','Group') + grp('o','Other') + '</div>' +
          '<div class="row" style="margin-top:14px"><label class="check">Octal&nbsp;<input class="inp" id="cmOct" value="000" maxlength="3" style="width:90px;font-family:ui-monospace"></label>' +
            '<span class="lbl" style="margin:0">Symbolic</span><code id="cmSym" style="font-size:1.05rem">----------</code></div>';
      },
      init: function(r){
        var boxes = r.querySelectorAll('input[data-g]'), oct = r.querySelector('#cmOct'), sym = r.querySelector('#cmSym');
        function fromBoxes(){
          var v = { u:0, g:0, o:0 };
          for (var i = 0; i < boxes.length; i++){ if (boxes[i].checked) v[boxes[i].getAttribute('data-g')] += parseInt(boxes[i].getAttribute('data-b'), 10); }
          return v;
        }
        function symbolic(v){
          function s(n){ return (n & 4 ? 'r' : '-') + (n & 2 ? 'w' : '-') + (n & 1 ? 'x' : '-'); }
          return '-' + s(v.u) + s(v.g) + s(v.o);
        }
        function render(v){ oct.value = '' + v.u + v.g + v.o; sym.textContent = symbolic(v); }
        function setBoxes(v){
          for (var i = 0; i < boxes.length; i++){ var g = boxes[i].getAttribute('data-g'), b = parseInt(boxes[i].getAttribute('data-b'), 10); boxes[i].checked = (v[g] & b) !== 0; }
        }
        for (var i = 0; i < boxes.length; i++){ boxes[i].addEventListener('change', function(){ render(fromBoxes()); }); }
        oct.addEventListener('input', function(){
          var m = oct.value.trim(); if (!/^[0-7]{1,3}$/.test(m)) return;
          while (m.length < 3) m = '0' + m;
          var v = { u:+m[0], g:+m[1], o:+m[2] }; setBoxes(v); sym.textContent = symbolic(v);
        });
        render(fromBoxes());
      }
    },

    query: {
      title: 'Query String ↔ JSON', lead: 'Parse a URL query string into JSON, or build a query string from JSON.',
      html: function(){
        return '<label class="lbl">Query string or URL</label>' +
          '<textarea class="ta" id="qsIn" spellcheck="false" placeholder="https://x.dev/?a=1&b=hello&b=world"></textarea>' +
          '<div class="row" style="margin-top:12px"><button class="btn" id="qsParse" type="button">Parse → JSON</button>' +
            '<button class="btn btn--light" id="qsBuild" type="button">JSON → Query</button></div>' + outBlock('qs', true);
      },
      init: function(r){
        var inp = r.querySelector('#qsIn'), out = r.querySelector('#qsOut'), st = r.querySelector('#qsSt');
        r.querySelector('#qsParse').onclick = function(){
          try {
            var raw = inp.value.trim(); var qi = raw.indexOf('?'); if (qi >= 0) raw = raw.slice(qi + 1);
            var hi = raw.indexOf('#'); if (hi >= 0) raw = raw.slice(0, hi);
            var sp = new URLSearchParams(raw), obj = {};
            sp.forEach(function(val, key){
              if (key in obj){ if (!Array.isArray(obj[key])) obj[key] = [obj[key]]; obj[key].push(val); }
              else obj[key] = val;
            });
            out.textContent = JSON.stringify(obj, null, 2); st.className = 'status status--ok'; st.textContent = 'Parsed ✓';
          } catch(e){ st.className = 'status status--err'; st.textContent = String(e.message || e); }
        };
        r.querySelector('#qsBuild').onclick = function(){
          try {
            var obj = JSON.parse(inp.value), sp = new URLSearchParams();
            Object.keys(obj).forEach(function(k){
              var v = obj[k];
              if (Array.isArray(v)) v.forEach(function(x){ sp.append(k, x); });
              else sp.append(k, v);
            });
            out.textContent = sp.toString(); st.className = 'status status--ok'; st.textContent = 'Built ✓ (paste a JSON object above)';
          } catch(e){ st.className = 'status status--err'; st.textContent = 'Input must be a JSON object.'; }
        };
      }
    },

    csv: {
      title: 'CSV ↔ JSON', lead: 'Convert between CSV and JSON. Quoted fields and embedded newlines are handled.',
      html: function(){
        return '<label class="lbl">Input</label>' +
          '<textarea class="ta" id="csIn" spellcheck="false" placeholder="name,age\nAda,36"></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="csToJson" type="button">CSV → JSON</button>' +
            '<button class="btn btn--light" id="csToCsv" type="button">JSON → CSV</button>' +
            '<label class="check"><input type="checkbox" id="csHead" checked> First row is header</label>' +
            '<label class="check">Delimiter&nbsp;<select class="sel" id="csDelim"><option value=",">comma</option><option value=";">semicolon</option><option value="tab">tab</option></select></label>' +
          '</div>' + outBlock('cs', true);
      },
      init: function(r){
        var out = r.querySelector('#csOut'), st = r.querySelector('#csSt');
        function delim(){ var v = r.querySelector('#csDelim').value; return v === 'tab' ? '\t' : v; }
        function parseCSV(text, d){
          var rows = [], row = [], i = 0, field = '', inq = false;
          while (i < text.length){
            var c = text[i];
            if (inq){
              if (c === '"'){ if (text[i+1] === '"'){ field += '"'; i += 2; continue; } inq = false; i++; continue; }
              field += c; i++; continue;
            }
            if (c === '"'){ inq = true; i++; continue; }
            if (c === d){ row.push(field); field = ''; i++; continue; }
            if (c === '\r'){ i++; continue; }
            if (c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
            field += c; i++;
          }
          row.push(field); rows.push(row);
          if (rows.length && rows[rows.length-1].length === 1 && rows[rows.length-1][0] === '') rows.pop();
          return rows;
        }
        r.querySelector('#csToJson').onclick = function(){
          try {
            var rows = parseCSV(r.querySelector('#csIn').value, delim());
            if (r.querySelector('#csHead').checked){
              var head = rows[0] || [];
              var objs = rows.slice(1).map(function(rw){ var o = {}; head.forEach(function(h, idx){ o[h] = rw[idx] !== undefined ? rw[idx] : ''; }); return o; });
              out.textContent = JSON.stringify(objs, null, 2);
            } else out.textContent = JSON.stringify(rows, null, 2);
            st.className = 'status status--ok'; st.textContent = 'Converted ✓';
          } catch(e){ st.className = 'status status--err'; st.textContent = String(e.message || e); }
        };
        r.querySelector('#csToCsv').onclick = function(){
          try {
            var d = delim(), data = JSON.parse(r.querySelector('#csIn').value);
            if (!Array.isArray(data)) throw new Error('JSON must be an array of objects or arrays.');
            function q(v){ v = v == null ? '' : String(v); if (v.indexOf(d) >= 0 || v.indexOf('"') >= 0 || /[\r\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"'; return v; }
            var lines;
            if (data.length && typeof data[0] === 'object' && !Array.isArray(data[0])){
              var cols = []; data.forEach(function(o){ Object.keys(o).forEach(function(k){ if (cols.indexOf(k) < 0) cols.push(k); }); });
              lines = [cols.map(q).join(d)];
              data.forEach(function(o){ lines.push(cols.map(function(k){ return q(o[k]); }).join(d)); });
            } else {
              lines = data.map(function(rw){ return (Array.isArray(rw) ? rw : [rw]).map(q).join(d); });
            }
            out.textContent = lines.join('\n'); st.className = 'status status--ok'; st.textContent = 'Converted ✓';
          } catch(e){ st.className = 'status status--err'; st.textContent = String(e.message || e); }
        };
      }
    },

    'case': {
      title: 'Case Converter', lead: 'Convert identifiers and text between naming conventions.',
      html: function(){
        return '<label class="lbl">Input</label>' +
          '<textarea class="ta" id="caIn" spellcheck="false" placeholder="helloWorld / hello_world / Hello World" style="min-height:90px"></textarea>' +
          '<ul class="mono-list" id="caOut" style="margin-top:14px"></ul>';
      },
      init: function(r){
        var inp = r.querySelector('#caIn'), list = r.querySelector('#caOut');
        function words(s){
          return s.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_\-]+/g, ' ')
            .replace(/[^A-Za-z0-9]+/g, ' ').trim().split(/\s+/).filter(Boolean);
        }
        function cap(w){ return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(); }
        function run(){
          var w = words(inp.value), lw = w.map(function(x){ return x.toLowerCase(); });
          var forms = [
            ['camelCase', lw.map(function(x, i){ return i ? cap(x) : x; }).join('')],
            ['PascalCase', lw.map(cap).join('')],
            ['snake_case', lw.join('_')],
            ['kebab-case', lw.join('-')],
            ['CONSTANT_CASE', lw.join('_').toUpperCase()],
            ['Title Case', lw.map(cap).join(' ')],
            ['Sentence case', lw.length ? cap(lw[0]) + (lw.length > 1 ? ' ' + lw.slice(1).join(' ') : '') : ''],
            ['lower case', lw.join(' ')],
            ['UPPER CASE', lw.join(' ').toUpperCase()]
          ];
          list.innerHTML = forms.map(function(f){
            return '<li><span><b>' + f[0] + '</b>&nbsp; ' + esc(f[1]) + '</span>' +
              '<button class="btn btn--ghost" data-copy-text="' + esc(f[1]) + '" type="button">Copy</button></li>';
          }).join('');
        }
        inp.addEventListener('input', run);
        inp.value = 'helloWorld example';
        run();
      }
    },

    contrast: {
      title: 'Color Contrast Checker', lead: 'Check the WCAG contrast ratio between two colors for accessible text.',
      html: function(){
        return '<div class="diff-cols">' +
            '<div><label class="lbl">Text color</label><div class="row"><input class="inp" id="ctFg" value="#264653" style="flex:1 1 auto" spellcheck="false"><input type="color" id="ctFgP" value="#264653" style="width:48px;height:44px;border:1px solid var(--line);border-radius:10px;cursor:pointer"></div></div>' +
            '<div><label class="lbl">Background</label><div class="row"><input class="inp" id="ctBg" value="#f4f2ea" style="flex:1 1 auto" spellcheck="false"><input type="color" id="ctBgP" value="#f4f2ea" style="width:48px;height:44px;border:1px solid var(--line);border-radius:10px;cursor:pointer"></div></div>' +
          '</div>' +
          '<div class="cpreview" id="ctPrev">The quick brown fox — Aa 123</div>' +
          '<dl class="kv" id="ctOut"></dl><p class="status" id="ctSt"></p>';
      },
      init: function(r){
        var out = r.querySelector('#ctOut'), st = r.querySelector('#ctSt'), prev = r.querySelector('#ctPrev');
        function parse(str){
          str = str.trim(); var m;
          if (m = str.match(/^#?([0-9a-f]{3})$/i)){ var c = m[1]; return [parseInt(c[0]+c[0],16), parseInt(c[1]+c[1],16), parseInt(c[2]+c[2],16)]; }
          if (m = str.match(/^#?([0-9a-f]{6})$/i)){ var c2 = m[1]; return [parseInt(c2.slice(0,2),16), parseInt(c2.slice(2,4),16), parseInt(c2.slice(4,6),16)]; }
          if (m = str.match(/rgba?\(([^)]+)\)/i)){ var p = m[1].split(',').map(function(x){ return Math.round(parseFloat(x)); }); if (p.length >= 3) return p.slice(0,3); }
          return null;
        }
        function lum(rgb){ var a = rgb.map(function(v){ v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); }); return 0.2126*a[0] + 0.7152*a[1] + 0.0722*a[2]; }
        function badge(pass){ return pass ? '<span style="color:var(--green)">PASS ✓</span>' : '<span style="color:var(--danger)">fail ✗</span>'; }
        function run(){
          var fg = parse(r.querySelector('#ctFg').value), bg = parse(r.querySelector('#ctBg').value);
          if (!fg || !bg){ st.className = 'status status--err'; st.textContent = 'Enter valid HEX or rgb() colors.'; return; }
          st.textContent = '';
          var l1 = lum(fg), l2 = lum(bg), ratio = (Math.max(l1,l2) + 0.05) / (Math.min(l1,l2) + 0.05);
          var rr = Math.round(ratio * 100) / 100;
          prev.style.color = 'rgb(' + fg.join(',') + ')'; prev.style.background = 'rgb(' + bg.join(',') + ')';
          out.innerHTML =
            '<dt>Contrast ratio</dt><dd>' + rr + ' : 1</dd>' +
            '<dt>AA — normal text (≥4.5)</dt><dd>' + badge(ratio >= 4.5) + '</dd>' +
            '<dt>AA — large text (≥3)</dt><dd>' + badge(ratio >= 3) + '</dd>' +
            '<dt>AAA — normal text (≥7)</dt><dd>' + badge(ratio >= 7) + '</dd>' +
            '<dt>AAA — large text (≥4.5)</dt><dd>' + badge(ratio >= 4.5) + '</dd>';
        }
        function sync(txt, pick){ r.querySelector(txt).addEventListener('input', function(){ var v = parse(this.value); if (v) r.querySelector(pick).value = '#' + v.map(function(x){ var h=x.toString(16); return (h.length===1?'0':'')+h; }).join(''); run(); }); }
        function syncP(pick, txt){ r.querySelector(pick).addEventListener('input', function(){ r.querySelector(txt).value = this.value; run(); }); }
        sync('#ctFg','#ctFgP'); sync('#ctBg','#ctBgP'); syncP('#ctFgP','#ctFg'); syncP('#ctBgP','#ctBg');
        run();
      }
    },

    lines: {
      title: 'Line Tools', lead: 'Sort, deduplicate, reverse, shuffle and clean up lines of text.',
      html: function(){
        return '<label class="lbl">Input</label>' +
          '<textarea class="ta" id="lnIn" spellcheck="false" placeholder="one\ntwo\ntwo\nthree"></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn btn--light" data-op="asc" type="button">Sort A→Z</button>' +
            '<button class="btn btn--light" data-op="desc" type="button">Sort Z→A</button>' +
            '<button class="btn btn--light" data-op="num" type="button">Sort numeric</button>' +
            '<button class="btn btn--light" data-op="dedupe" type="button">Dedupe</button>' +
            '<button class="btn btn--light" data-op="reverse" type="button">Reverse</button>' +
            '<button class="btn btn--light" data-op="shuffle" type="button">Shuffle</button>' +
            '<button class="btn btn--light" data-op="trim" type="button">Trim</button>' +
            '<button class="btn btn--light" data-op="blanks" type="button">Remove blanks</button>' +
          '</div>' + outBlock('ln', true);
      },
      init: function(r){
        var inp = r.querySelector('#lnIn'), out = r.querySelector('#lnOut'), st = r.querySelector('#lnSt');
        function apply(op){
          var a = inp.value.split(/\r?\n/);
          if (op === 'asc') a.sort(function(x,y){ return x.localeCompare(y); });
          else if (op === 'desc') a.sort(function(x,y){ return y.localeCompare(x); });
          else if (op === 'num') a.sort(function(x,y){ var nx = parseFloat(x), ny = parseFloat(y); if (isNaN(nx)) return 1; if (isNaN(ny)) return -1; return nx - ny; });
          else if (op === 'dedupe'){ var seen = {}, r2 = []; a.forEach(function(l){ if (!seen[l]){ seen[l] = 1; r2.push(l); } }); a = r2; }
          else if (op === 'reverse') a.reverse();
          else if (op === 'shuffle'){ for (var i = a.length - 1; i > 0; i--){ var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } }
          else if (op === 'trim') a = a.map(function(l){ return l.trim(); });
          else if (op === 'blanks') a = a.filter(function(l){ return l.trim() !== ''; });
          out.textContent = a.join('\n');
          st.className = 'status status--ok'; st.textContent = a.length + ' line' + (a.length === 1 ? '' : 's');
        }
        var btns = r.querySelectorAll('[data-op]');
        for (var i = 0; i < btns.length; i++){ btns[i].onclick = (function(op){ return function(){ apply(op); }; })(btns[i].getAttribute('data-op')); }
      }
    },

    urlparse: {
      title: 'URL Parser', lead: 'Break a URL into its components and list its query parameters.',
      html: function(){
        return '<div class="row"><input class="inp" id="upIn" placeholder="https://user:pass@host.dev:8080/a/b?x=1&y=2#top" style="flex:1 1 260px" spellcheck="false"><button class="btn" id="upGo" type="button">Parse</button></div>' +
          '<p class="status" id="upSt"></p><dl class="kv" id="upOut"></dl>' +
          '<label class="lbl" id="upQL" hidden style="margin-top:12px">Query parameters</label><dl class="kv" id="upQ"></dl>';
      },
      init: function(r){
        var st = r.querySelector('#upSt'), kv = r.querySelector('#upOut'), q = r.querySelector('#upQ'), ql = r.querySelector('#upQL');
        function go(){
          var v = r.querySelector('#upIn').value.trim(); if (!v){ return; }
          var u; try { u = new URL(v); } catch(e){ st.className = 'status status--err'; st.textContent = 'Invalid URL (include the scheme, e.g. https://).'; kv.innerHTML = ''; q.innerHTML = ''; ql.hidden = true; return; }
          st.textContent = '';
          function row(k, val){ return val ? '<dt>' + k + '</dt><dd>' + esc(val) + '</dd>' : ''; }
          kv.innerHTML = row('Protocol', u.protocol) + row('Username', u.username) + row('Password', u.password) +
            row('Host', u.host) + row('Hostname', u.hostname) + row('Port', u.port) + row('Path', u.pathname) +
            row('Query', u.search) + row('Fragment', u.hash) + row('Origin', u.origin);
          var params = []; u.searchParams.forEach(function(val, key){ params.push('<dt>' + esc(key) + '</dt><dd>' + esc(val) + '</dd>'); });
          q.innerHTML = params.join(''); ql.hidden = params.length === 0;
        }
        r.querySelector('#upGo').onclick = go;
        r.querySelector('#upIn').addEventListener('keydown', function(e){ if (e.key === 'Enter') go(); });
      }
    },

    unicode: {
      title: 'Unicode Inspector', lead: 'Inspect each character: code point, UTF-8 bytes and HTML entity.',
      html: function(){
        return '<label class="lbl">Input</label>' +
          '<textarea class="ta" id="unIn" spellcheck="false" placeholder="Type text or paste an emoji 😀" style="min-height:90px"></textarea>' +
          '<p class="status" id="unSt"></p><pre class="out__box" id="unOut"></pre>';
      },
      init: function(r){
        var inp = r.querySelector('#unIn'), out = r.querySelector('#unOut'), st = r.querySelector('#unSt');
        function utf8(ch){ var b = new TextEncoder().encode(ch), s = []; for (var i = 0; i < b.length; i++){ var h = b[i].toString(16).toUpperCase(); s.push((h.length===1?'0':'') + h); } return s.join(' '); }
        function run(){
          var v = inp.value;
          var cps = Array.from(v);
          if (cps.length > 500){ st.className = 'status status--err'; st.textContent = 'Showing first 500 code points.'; cps = cps.slice(0, 500); }
          else { st.className = 'status status--ok'; st.textContent = cps.length + ' code points · ' + v.length + ' UTF-16 units'; }
          out.textContent = cps.map(function(ch){
            var cp = ch.codePointAt(0), hex = cp.toString(16).toUpperCase();
            while (hex.length < 4) hex = '0' + hex;
            return '‘' + ch + '’  U+' + hex + '  dec ' + cp + '  utf8 ' + utf8(ch) + '  &#' + cp + ';';
          }).join('\n');
        }
        inp.addEventListener('input', run);
        inp.value = 'Aé😀';
        run();
      }
    },

    jsonts: {
      title: 'JSON → TypeScript', lead: 'Generate TypeScript interfaces from a JSON sample.',
      html: function(){
        return '<label class="lbl">JSON</label>' +
          '<textarea class="ta" id="jtIn" spellcheck="false" placeholder=\'{"id":1,"user":{"name":"Ada"}}\'></textarea>' +
          '<div class="row" style="margin-top:12px"><button class="btn" id="jtGo" type="button">Generate</button></div>' + outBlock('jt', true);
      },
      init: function(r){
        var out = r.querySelector('#jtOut'), st = r.querySelector('#jtSt');
        function pascal(k){ var n = String(k).replace(/[^A-Za-z0-9]+/g, ' ').replace(/(^|\s)(\w)/g, function(_, s, c){ return c.toUpperCase(); }).replace(/\s+/g, ''); if (!n) n = 'Item'; if (/^[0-9]/.test(n)) n = 'N' + n; return n; }
        function singular(n){ return n.replace(/ies$/, 'y').replace(/s$/, '') || n; }
        r.querySelector('#jtGo').onclick = function(){
          var ifaces = [];
          function typeOf(val, name){
            if (val === null) return 'null';
            if (Array.isArray(val)){
              if (!val.length) return 'any[]';
              var set = {}; val.forEach(function(v){ set[typeOf(v, singular(name))] = 1; });
              var ks = Object.keys(set); return (ks.length === 1 ? ks[0] : '(' + ks.join(' | ') + ')') + '[]';
            }
            var ty = typeof val;
            if (ty === 'string') return 'string'; if (ty === 'number') return 'number'; if (ty === 'boolean') return 'boolean';
            if (ty === 'object'){
              var iname = pascal(name);
              var lines = Object.keys(val).map(function(k){ var kt = typeOf(val[k], k); var key = /^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k); return '  ' + key + ': ' + kt + ';'; });
              ifaces.push('interface ' + iname + ' {\n' + lines.join('\n') + '\n}');
              return iname;
            }
            return 'any';
          }
          try {
            var data = JSON.parse(r.querySelector('#jtIn').value);
            var root = typeOf(data, 'Root');
            var parts = ifaces.slice().reverse();
            if (!(data && typeof data === 'object' && !Array.isArray(data))) parts.push('type Root = ' + root + ';');
            out.textContent = parts.join('\n\n');
            st.className = 'status status--ok'; st.textContent = 'Generated ✓';
          } catch(e){ st.className = 'status status--err'; st.textContent = String(e.message || e); }
        };
      }
    },

    strescape: {
      title: 'String Escape / Unescape', lead: 'Escape text into a JS/JSON string literal, or unescape it back to raw text.',
      html: function(){
        return '<label class="lbl">Input</label>' +
          '<textarea class="ta" id="seIn" spellcheck="false" placeholder="Line 1\nLine 2 — escape me"></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="seEnc" type="button">Escape</button>' +
            '<button class="btn btn--light" id="seDec" type="button">Unescape</button>' +
            '<label class="check"><input type="checkbox" id="seWrap"> Wrap in quotes</label>' +
          '</div>' + outBlock('se', true);
      },
      init: function(r){
        var inp = r.querySelector('#seIn'), out = r.querySelector('#seOut'), st = r.querySelector('#seSt');
        r.querySelector('#seEnc').onclick = function(){
          var full = JSON.stringify(inp.value);
          out.textContent = r.querySelector('#seWrap').checked ? full : full.slice(1, -1);
          st.className = 'status status--ok'; st.textContent = 'Escaped ✓';
        };
        r.querySelector('#seDec').onclick = function(){
          var s = inp.value.trim();
          try {
            var parsed = (s.charAt(0) === '"' && s.charAt(s.length - 1) === '"') ? JSON.parse(s) : JSON.parse('"' + s + '"');
            out.textContent = parsed; st.className = 'status status--ok'; st.textContent = 'Unescaped ✓';
          } catch(e){ st.className = 'status status--err'; st.textContent = 'Invalid escaped string.'; out.textContent = ''; }
        };
      }
    },

    roman: {
      title: 'Roman Numerals', lead: 'Convert between integers (1–3999) and Roman numerals.',
      html: function(){
        return '<div class="row"><input class="inp" id="roIn" placeholder="2024 or MMXXIV" style="flex:1 1 200px" spellcheck="false">' +
            '<button class="btn" id="roToR" type="button">Number → Roman</button>' +
            '<button class="btn btn--light" id="roToN" type="button">Roman → Number</button></div>' +
          '<pre class="out__box" id="roOut" style="margin-top:12px"></pre><p class="status" id="roSt"></p>';
      },
      init: function(r){
        var out = r.querySelector('#roOut'), st = r.querySelector('#roSt');
        var TAB = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
        function toRoman(n){ var s = ''; for (var i = 0; i < TAB.length; i++){ while (n >= TAB[i][0]){ s += TAB[i][1]; n -= TAB[i][0]; } } return s; }
        function fromRoman(s){ var map = {I:1,V:5,X:10,L:50,C:100,D:500,M:1000}, t = 0, prev = 0; for (var i = s.length - 1; i >= 0; i--){ var v = map[s.charAt(i)]; if (v < prev) t -= v; else { t += v; prev = v; } } return t; }
        r.querySelector('#roToR').onclick = function(){
          var n = parseInt(r.querySelector('#roIn').value, 10);
          if (isNaN(n) || n < 1 || n > 3999){ st.className = 'status status--err'; st.textContent = 'Enter an integer 1–3999.'; return; }
          out.textContent = toRoman(n); st.textContent = '';
        };
        r.querySelector('#roToN').onclick = function(){
          var s = r.querySelector('#roIn').value.trim().toUpperCase();
          if (!/^[IVXLCDM]+$/.test(s)){ st.className = 'status status--err'; st.textContent = 'Not a Roman numeral.'; return; }
          var n = fromRoman(s);
          if (toRoman(n) !== s){ st.className = 'status status--err'; st.textContent = 'Not a valid (canonical) Roman numeral.'; return; }
          out.textContent = String(n); st.textContent = '';
        };
      }
    },

    binary: {
      title: 'Text ↔ Binary', lead: 'Convert text to 8-bit binary (UTF-8) and back.',
      html: function(){
        return '<label class="lbl">Input</label>' +
          '<textarea class="ta" id="biIn" spellcheck="false" placeholder="Hello   or   01001000 01101001"></textarea>' +
          '<div class="row" style="margin-top:12px">' +
            '<button class="btn" id="biToB" type="button">Text → Binary</button>' +
            '<button class="btn btn--light" id="biToT" type="button">Binary → Text</button></div>' + outBlock('bi', true);
      },
      init: function(r){
        var inp = r.querySelector('#biIn'), out = r.querySelector('#biOut'), st = r.querySelector('#biSt');
        r.querySelector('#biToB').onclick = function(){
          var b = new TextEncoder().encode(inp.value), s = [];
          for (var i = 0; i < b.length; i++){ var x = b[i].toString(2); while (x.length < 8) x = '0' + x; s.push(x); }
          out.textContent = s.join(' '); st.className = 'status status--ok'; st.textContent = b.length + ' bytes';
        };
        r.querySelector('#biToT').onclick = function(){
          var toks = inp.value.trim().split(/\s+/).filter(Boolean);
          if (!toks.length || !toks.every(function(t){ return /^[01]{1,8}$/.test(t); })){ st.className = 'status status--err'; st.textContent = 'Only 0/1 groups separated by spaces.'; return; }
          var bytes = new Uint8Array(toks.length);
          for (var i = 0; i < toks.length; i++) bytes[i] = parseInt(toks[i], 2);
          try { out.textContent = new TextDecoder().decode(bytes); st.className = 'status status--ok'; st.textContent = 'Decoded ✓'; }
          catch(e){ st.className = 'status status--err'; st.textContent = 'Invalid byte sequence.'; }
        };
      }
    },

    img2b64: {
      title: 'Image → Base64', lead: 'Turn an image into a Base64 data URI. Runs entirely in your browser — nothing is uploaded.',
      html: function(){
        return '<input type="file" id="ibFile" accept="image/*">' +
          '<img id="ibPrev" alt="preview">' +
          '<p class="status" id="ibSt"></p>' +
          '<div class="copybar"><span class="lbl" style="margin:0">Data URI</span><button class="btn btn--light" data-copy="ibOut" type="button">Copy</button></div>' +
          '<pre class="out__box" id="ibOut" style="max-height:180px"></pre>';
      },
      init: function(r){
        var st = r.querySelector('#ibSt'), out = r.querySelector('#ibOut'), prev = r.querySelector('#ibPrev');
        r.querySelector('#ibFile').addEventListener('change', function(){
          var f = this.files && this.files[0]; if (!f) return;
          if (f.size > 5 * 1024 * 1024){ st.className = 'status status--err'; st.textContent = 'Image too large (max 5 MB).'; return; }
          var fr = new FileReader();
          fr.onload = function(){
            out.textContent = fr.result; prev.src = fr.result; prev.style.display = 'block';
            st.className = 'status status--ok'; st.textContent = f.name + ' · ' + Math.round(f.size / 1024) + ' KB → ' + Math.round(fr.result.length / 1024) + ' KB base64';
          };
          fr.onerror = function(){ st.className = 'status status--err'; st.textContent = 'Could not read the file.'; };
          fr.readAsDataURL(f);
        });
      }
    },

    curl: {
      title: 'cURL → fetch', lead: 'Convert a curl command into a JavaScript fetch() snippet.',
      html: function(){
        return '<label class="lbl">curl command</label>' +
          '<textarea class="ta" id="cuIn" spellcheck="false"></textarea>' +
          '<div class="row" style="margin-top:12px"><button class="btn" id="cuGo" type="button">Convert</button></div>' + outBlock('cu', true);
      },
      init: function(r){
        var inp = r.querySelector('#cuIn'), out = r.querySelector('#cuOut'), st = r.querySelector('#cuSt');
        function tokenize(s){
          s = s.replace(/\\\r?\n/g, ' ').trim(); var toks = [], cur = '', q = null, i = 0;
          while (i < s.length){ var c = s.charAt(i);
            if (q){ if (c === q){ q = null; i++; continue; } cur += c; i++; continue; }
            if (c === '"' || c === "'"){ q = c; i++; continue; }
            if (/\s/.test(c)){ if (cur){ toks.push(cur); cur = ''; } i++; continue; }
            cur += c; i++;
          }
          if (cur) toks.push(cur); return toks;
        }
        r.querySelector('#cuGo').onclick = function(){
          var t = tokenize(inp.value); if (t[0] === 'curl') t.shift();
          var url = '', method = '', headers = [], body = null, user = null;
          for (var i = 0; i < t.length; i++){ var a = t[i];
            if (a === '-X' || a === '--request') method = t[++i] || '';
            else if (a === '-H' || a === '--header') headers.push(t[++i] || '');
            else if (a === '-d' || a === '--data' || a === '--data-raw' || a === '--data-binary' || a === '--data-ascii'){ body = t[++i]; if (!method) method = 'POST'; }
            else if (a === '-u' || a === '--user') user = t[++i];
            else if (a === '--url') url = t[++i] || '';
            else if (a === '-b' || a === '--cookie' || a === '-A' || a === '--user-agent' || a === '-e' || a === '--referer') i++;
            else if (a.charAt(0) !== '-'){ if (!url) url = a; }
          }
          if (!url){ st.className = 'status status--err'; st.textContent = 'No URL found in the command.'; return; }
          var hobj = {}; headers.forEach(function(h){ var idx = h.indexOf(':'); if (idx > 0) hobj[h.slice(0, idx).trim()] = h.slice(idx + 1).trim(); });
          if (user) hobj['Authorization'] = 'Basic ' + btoa(user);
          method = method || 'GET';
          var code = 'const res = await fetch(' + JSON.stringify(url) + ', {\n  method: ' + JSON.stringify(method);
          if (Object.keys(hobj).length) code += ',\n  headers: ' + JSON.stringify(hobj, null, 2).replace(/\n/g, '\n  ');
          if (body != null) code += ',\n  body: ' + JSON.stringify(body);
          code += '\n});\nconst data = await res.json();';
          out.textContent = code; st.className = 'status status--ok'; st.textContent = 'Converted ✓';
        };
        inp.value = "curl -X POST https://api.example.com/users -H 'Content-Type: application/json' -d '{\"name\":\"Ada\"}'";
      }
    },

    jsonpath: {
      title: 'JSON Path Query', lead: 'Query a JSON document with a simple path: $.a.b[0], items[*].name, etc.',
      html: function(){
        return '<label class="lbl">JSON</label>' +
          '<textarea class="ta" id="jpJson" spellcheck="false" style="min-height:120px"></textarea>' +
          '<div class="row" style="margin-top:12px"><input class="inp" id="jpPath" placeholder="$.items[*].name" style="flex:1 1 240px" spellcheck="false"><button class="btn" id="jpGo" type="button">Query</button></div>' + outBlock('jp', true);
      },
      init: function(r){
        var out = r.querySelector('#jpOut'), st = r.querySelector('#jpSt');
        function tokens(p){
          p = p.trim(); if (p.charAt(0) === '$') p = p.slice(1);
          if (p && p.charAt(0) !== '.' && p.charAt(0) !== '[') p = '.' + p;
          var re = /\.([A-Za-z_$][\w$]*)|\[(\d+)\]|\[\*\]|\[['"]([^'"]+)['"]\]/g, toks = [], m, idx = 0;
          while ((m = re.exec(p)) !== null){
            if (m.index !== idx) throw new Error('cannot parse path near "' + p.slice(idx) + '"');
            if (m[1] !== undefined) toks.push({ k: m[1] });
            else if (m[2] !== undefined) toks.push({ i: parseInt(m[2], 10) });
            else if (m[3] !== undefined) toks.push({ k: m[3] });
            else toks.push({ w: true });
            idx = re.lastIndex;
          }
          if (idx !== p.length) throw new Error('cannot parse path near "' + p.slice(idx) + '"');
          return toks;
        }
        r.querySelector('#jpGo').onclick = function(){
          try {
            var data = JSON.parse(r.querySelector('#jpJson').value);
            var toks = tokens(r.querySelector('#jpPath').value);
            var cur = [data];
            toks.forEach(function(tk){
              var next = [];
              cur.forEach(function(v){
                if (v == null) return;
                if (tk.w){ if (Array.isArray(v)) next = next.concat(v); else if (typeof v === 'object') next = next.concat(Object.keys(v).map(function(k){ return v[k]; })); }
                else if (tk.i !== undefined){ if (Array.isArray(v) && tk.i < v.length) next.push(v[tk.i]); }
                else { if (v && typeof v === 'object' && tk.k in v) next.push(v[tk.k]); }
              });
              cur = next;
            });
            var result = cur.length === 1 ? cur[0] : cur;
            out.textContent = JSON.stringify(result, null, 2);
            st.className = 'status status--ok'; st.textContent = cur.length + ' result' + (cur.length === 1 ? '' : 's');
          } catch(e){ st.className = 'status status--err'; st.textContent = String(e.message || e); }
        };
        r.querySelector('#jpJson').value = '{\n  "items": [\n    { "name": "Ada" },\n    { "name": "Bob" }\n  ]\n}';
        r.querySelector('#jpPath').value = '$.items[*].name';
      }
    },

    qr: {
      title: 'QR Code Generator', lead: 'Turn any text, URL or Wi-Fi string into a QR code. Encoded in your browser — nothing is uploaded. Download as PNG or SVG.',
      html: function(){
        return '<label class="lbl">Text or URL</label>' +
          '<textarea class="ta" id="qrIn" spellcheck="false" placeholder="https://tools.frontek.dev"></textarea>' +
          '<div class="row" style="margin-top:12px;align-items:center">' +
            '<label class="lbl" style="margin:0" for="qrEcc">Error correction</label>' +
            '<select class="inp" id="qrEcc" style="flex:0 0 auto">' +
              '<option value="0">L — 7%</option><option value="1" selected>M — 15%</option>' +
              '<option value="2">Q — 25%</option><option value="3">H — 30%</option>' +
            '</select>' +
            '<button class="btn" id="qrGo" type="button">Generate</button>' +
          '</div>' +
          '<div class="qrwrap" id="qrWrap" hidden>' +
            '<canvas id="qrCanvas" class="qrcanvas"></canvas>' +
            '<div class="row" style="justify-content:center;margin-top:12px">' +
              '<button class="btn btn--light" id="qrPng" type="button">Download PNG</button>' +
              '<button class="btn btn--light" id="qrSvg" type="button">Download SVG</button>' +
            '</div>' +
          '</div>' +
          '<p class="status" id="qrSt"></p>';
      },
      init: function(r){
        var inp = r.querySelector('#qrIn'), sel = r.querySelector('#qrEcc'), st = r.querySelector('#qrSt'),
            wrap = r.querySelector('#qrWrap'), cv = r.querySelector('#qrCanvas'), current = null, QUIET = 4;
        function paint(canvas, m, px){
          var n = m.size, full = n + QUIET*2, dim = full*px;
          canvas.width = dim; canvas.height = dim;
          var ctx = canvas.getContext('2d');
          ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, dim, dim);
          ctx.fillStyle = '#000';
          for (var y=0;y<n;y++) for (var x=0;x<n;x++) if (m.mods[y][x]) ctx.fillRect((x+QUIET)*px, (y+QUIET)*px, px, px);
        }
        function svgString(m){
          var n = m.size, full = n + QUIET*2, d = '';
          for (var y=0;y<n;y++) for (var x=0;x<n;x++) if (m.mods[y][x]) d += 'M' + (x+QUIET) + ' ' + (y+QUIET) + 'h1v1h-1z';
          return '<svg xmlns="http://www.w3.org/2000/svg" width="' + full + '" height="' + full + '" viewBox="0 0 ' + full + ' ' + full + '" shape-rendering="crispEdges">' +
            '<rect width="' + full + '" height="' + full + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
        }
        function download(name, href){ var a = document.createElement('a'); a.href = href; a.download = name; document.body.appendChild(a); a.click(); document.body.removeChild(a); }
        function draw(){
          var text = inp.value;
          if (!text){ current = null; wrap.hidden = true; st.className = 'status'; st.textContent = ''; return; }
          try {
            var m = qrMatrix(text, parseInt(sel.value, 10)); current = m;
            paint(cv, m, Math.max(2, Math.floor(360/(m.size + QUIET*2))));
            wrap.hidden = false;
            st.className = 'status status--ok';
            st.textContent = 'Version ' + m.version + ' · ' + m.size + '×' + m.size + ' modules · mask ' + m.mask;
          } catch(e){ current = null; wrap.hidden = true; st.className = 'status status--err'; st.textContent = String(e.message || e); }
        }
        r.querySelector('#qrGo').onclick = draw;
        inp.addEventListener('input', draw);
        sel.addEventListener('change', draw);
        r.querySelector('#qrPng').onclick = function(){
          if (!current) return;
          var tmp = document.createElement('canvas');
          paint(tmp, current, Math.max(4, Math.ceil(1024/(current.size + QUIET*2))));
          download('qrcode.png', tmp.toDataURL('image/png'));
        };
        r.querySelector('#qrSvg').onclick = function(){
          if (!current) return;
          download('qrcode.svg', 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString(current)));
        };
        inp.value = 'https://tools.frontek.dev'; draw();
      }
    }
  };

  function humanDur(ms){
    var s = Math.floor(ms/1000);
    if (s < 60) return s + 's';
    var m = Math.floor(s/60); if (m < 60) return m + 'm ' + (s%60) + 's';
    var h = Math.floor(m/60); if (h < 24) return h + 'h ' + (m%60) + 'm';
    var d = Math.floor(h/24); return d + 'd ' + (h%24) + 'h';
  }

  // ============================================================
  //  ROUTER
  // ============================================================
  function toolIdFromHash(){
    var h = location.hash || '';
    var m = h.match(/^#\/([a-z0-9]+)/i);
    return m ? m[1].toLowerCase() : null;
  }
  function openHub(){
    $('toolPanel').hidden = true; $('toolPanel').innerHTML = '';
    $('hub').hidden = false;
    document.title = 'Frontek Tools — free developer utilities';
  }
  function openTool(id){
    var tool = TOOLS[id];
    if (!tool){ location.hash = '#/'; return; }
    var panel = $('toolPanel');
    panel.innerHTML =
      '<a class="panel__back" href="#/">← <span>' + esc(t('all_tools')) + '</span></a>' +
      '<h1 class="panel__head">' + esc(tool.title) + '</h1>' +
      '<p class="panel__lead">' + esc(tool.lead) + '</p>' +
      '<div class="tool" id="toolBody"></div>';
    var body = panel.querySelector('#toolBody');
    body.innerHTML = tool.html();
    tool.init(body);
    $('hub').hidden = true; panel.hidden = false;
    document.title = tool.title + ' — Frontek Tools';
    window.scrollTo(0, 0);
  }
  function route(){
    var id = toolIdFromHash();
    if (id && TOOLS[id]) openTool(id); else openHub();
  }

  // ---- filtro hub ----
  function initFilter(){
    var input = $('filter'), cards = document.querySelectorAll('.tcard'), empty = $('hubEmpty');
    input.addEventListener('input', function(){
      var q = input.value.trim().toLowerCase(), shown = 0;
      for (var i = 0; i < cards.length; i++){
        var hay = (cards[i].getAttribute('data-tags') + ' ' + cards[i].textContent).toLowerCase();
        var ok = !q || hay.indexOf(q) >= 0;
        cards[i].hidden = !ok; if (ok) shown++;
      }
      empty.hidden = shown > 0;
    });
  }

  // ---- riordino degli strumenti (preferiti in cima), persistito ----
  function initReorder(){
    var grid = $('toolsGrid'), slice = Array.prototype.slice;
    var CTRL = '<span class="tctl">' +
      '<button class="tctlb" data-move="top" type="button" title="Pin to top" aria-label="Pin to top">⤒</button>' +
      '<button class="tctlb" data-move="up" type="button" title="Move up" aria-label="Move up">▲</button>' +
      '<button class="tctlb" data-move="down" type="button" title="Move down" aria-label="Move down">▼</button></span>';
    function cardsById(){ var m = {}; slice.call(grid.querySelectorAll('.tcard')).forEach(function(c){ m[c.getAttribute('data-id')] = c; }); return m; }
    function reorderTo(ids){ var m = cardsById(); ids.forEach(function(id){ if (m[id]) grid.appendChild(m[id]); }); }
    function saveOrder(){ save(LS.order, slice.call(grid.querySelectorAll('.tcard')).map(function(c){ return c.getAttribute('data-id'); })); }

    var defaultOrder = slice.call(grid.querySelectorAll('.tcard')).map(function(c){ return c.getAttribute('data-id'); });
    // applica l'ordine salvato (id ancora esistenti, poi i nuovi tool in coda)
    var saved = load(LS.order, []) || [], seq = [];
    saved.forEach(function(id){ if (defaultOrder.indexOf(id) >= 0 && seq.indexOf(id) < 0) seq.push(id); });
    defaultOrder.forEach(function(id){ if (seq.indexOf(id) < 0) seq.push(id); });
    reorderTo(seq);
    // controlli di spostamento in ogni card (visibili solo in modalità modifica)
    slice.call(grid.querySelectorAll('.tcard')).forEach(function(c){ c.insertAdjacentHTML('afterbegin', CTRL); });

    var editing = false, btn = $('btnCustomize'), reset = $('btnResetOrder');
    btn.addEventListener('click', function(){
      editing = !editing;
      grid.classList.toggle('tools--edit', editing);
      btn.textContent = editing ? t('done') : t('customize');
      reset.hidden = !editing;
    });
    reset.addEventListener('click', function(){ reorderTo(defaultOrder); save(LS.order, []); });
    grid.addEventListener('click', function(e){
      if (!grid.classList.contains('tools--edit')) return;
      e.preventDefault();                               // niente navigazione mentre si riordina
      var mv = e.target.closest ? e.target.closest('[data-move]') : null;
      if (!mv) return;
      e.stopPropagation();
      var card = mv.closest('.tcard'), dir = mv.getAttribute('data-move');
      if (dir === 'up'){ var p = card.previousElementSibling; if (p) grid.insertBefore(card, p); }
      else if (dir === 'down'){ var n = card.nextElementSibling; if (n) grid.insertBefore(n, card); }
      else if (dir === 'top'){ grid.insertBefore(card, grid.firstElementChild); }
      saveOrder();
    });
  }

  // ---- copy delegation (output boxes, singole voci, liste) ----
  function initCopy(){
    document.addEventListener('click', function(e){
      var b = e.target.closest ? e.target.closest('[data-copy],[data-copy-text],[data-copy-list]') : null;
      if (!b) return;
      if (b.hasAttribute('data-copy')){ var el = document.getElementById(b.getAttribute('data-copy')); if (el) flashCopy(b, el.textContent); }
      else if (b.hasAttribute('data-copy-text')){ flashCopy(b, b.getAttribute('data-copy-text')); }
      else if (b.hasAttribute('data-copy-list')){
        var list = document.getElementById(b.getAttribute('data-copy-list'));
        if (list){ var items = list.querySelectorAll('li > span'); var txt = [];
          for (var i = 0; i < items.length; i++) txt.push(items[i].textContent); flashCopy(b, txt.join('\n')); }
      }
    });
  }

  // ---- sponsor ----
  function initSponsor(){
    if (!SPONSOR || localStorage.getItem(LS.sponsorHidden) === '1') return;
    $('sponsorText').textContent = SPONSOR.text;
    $('sponsorLink').href = SPONSOR.url;
    $('sponsor').hidden = false;
    $('sponsorClose').addEventListener('click', function(){
      $('sponsor').hidden = true;
      try { localStorage.setItem(LS.sponsorHidden, '1'); } catch(e){}
    });
  }

  // ---- impostazioni ----
  function initSettings(){
    var modal = $('settingsModal');
    function open(){ $('langSelect').value = settings.lang; $('themeSelect').value = settings.theme; modal.hidden = false; }
    function close(){ modal.hidden = true; }
    $('btnSettings').addEventListener('click', open);
    modal.addEventListener('click', function(e){ if (e.target.hasAttribute('data-close')) close(); });
    document.addEventListener('keydown', function(e){ if (e.key === 'Escape' && !modal.hidden) close(); });
    $('langSelect').addEventListener('change', function(){ settings.lang = this.value; save(LS.settings, settings); applyI18n(); });
    $('themeSelect').addEventListener('change', function(){ settings.theme = this.value; save(LS.settings, settings); applyTheme(); });
  }

  // ============================================================
  //  INIT
  // ============================================================
  function init(){
    applyI18n();
    applyTheme();
    if (window.matchMedia){
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(){ if (settings.theme === 'auto') applyTheme(); });
    }
    initFilter();
    initReorder();
    initCopy();
    initSettings();
    initSponsor();
    window.addEventListener('hashchange', route);
    route();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  // seam di test (inerte in produzione: il flag non viene mai impostato in pagina)
  if (typeof window !== 'undefined' && window.__TOOLS_TEST__){
    window.__tools = { b64encode: b64encode, b64decode: b64decode, uuidv4: uuidv4,
      humanDur: humanDur, hexOf: hexOf, TOOLS: TOOLS, t: t, qrMatrix: qrMatrix };
  }

})();
