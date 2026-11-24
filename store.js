// Speicher (IndexedDB), Datensicherung, Excel-Export, Teilen
'use strict';

const DB_NAME = 'bergwiesenhof';
const DB_STORE = 'daten';

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(DB_STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbGet(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).get(key);
    t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error);
  });
}
async function idbSet(key, val) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(val, key);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}
async function idbDel(key) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
}

// Tages-Schnappschüsse (automatisch, die letzten 14 Tage) – Schutz gegen Fehlbedienung
async function schnappschussAnlegen(S) {
  const heute = todayISO();
  const liste = (await idbGet('snapshots')) || [];
  if (liste.includes(heute)) return;
  await idbSet('snap_' + heute, JSON.stringify(S));
  liste.push(heute); liste.sort();
  while (liste.length > 14) { const alt = liste.shift(); await idbDel('snap_' + alt); }
  await idbSet('snapshots', liste);
}
async function schnappschuesse() { return ((await idbGet('snapshots')) || []).slice().reverse(); }
async function schnappschussLaden(tag) { const t = await idbGet('snap_' + tag); return t ? JSON.parse(t) : null; }

async function dauerhaftAnfordern() {
  try { if (navigator.storage && navigator.storage.persist) return await navigator.storage.persist(); } catch (e) { }
  return false;
}
async function istDauerhaft() {
  try { if (navigator.storage && navigator.storage.persisted) return await navigator.storage.persisted(); } catch (e) { }
  return false;
}

// ---------- Dateien ausgeben ----------
const stempel = () => { const d = new Date(); return isoOf(d) + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); };
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
// Teilen über das Android-Teilen-Menü (WhatsApp, Mail, Drive …); sonst Download
async function teilenDatei(blob, name, titel, text) {
  const file = new File([blob], name, { type: blob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: titel, text: text || '' }); return 'geteilt'; }
    catch (e) { if (e && e.name === 'AbortError') return 'abgebrochen'; }
  }
  download(blob, name);
  return 'gespeichert';
}
// ---------- Verschlüsselte Sicherung ----------
// Alles, was das Tablet verlässt (Google Drive, Teilen, Archiv), wird mit dem Sicherungs-Passwort verschlüsselt:
// AES-GCM 256 Bit, Schlüssel aus dem Passwort über PBKDF2-SHA256. Das Passwort bleibt nur auf dem Tablet (nicht in der Sicherung).
const KRYPTO_ITER = 250000;
let sicherungPw = null;
async function pwLaden() { sicherungPw = (await idbGet('sicherungPw')) || null; }
async function pwSetzen(pw) { if (pw) await idbSet('sicherungPw', pw); else await idbDel('sicherungPw'); sicherungPw = pw || null; }
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function kryptoSchluessel(pw, salt, iter) {
  const basis = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: iter, hash: 'SHA-256' }, basis, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function verschluesseln(text, pw) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await kryptoSchluessel(pw, salt, KRYPTO_ITER);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)));
  return JSON.stringify({ format: 'bwh-verschluesselt', v: 1, app: 'Bestellsystem Bergwiesenhof', erstellt: new Date().toISOString(), kdf: 'PBKDF2-SHA256', iter: KRYPTO_ITER, salt: b64(salt), iv: b64(iv), daten: b64(ct) });
}
const istVerschluesselt = x => !!(x && typeof x === 'object' && x.format === 'bwh-verschluesselt');
async function entschluesseln(x, pw) {
  const key = await kryptoSchluessel(pw, unb64(x.salt), num(x.iter) || KRYPTO_ITER);
  let pt;
  try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(x.iv) }, key, unb64(x.daten)); }
  catch (e) { throw new Error('Passwort falsch (oder Datei beschädigt).'); }
  return new TextDecoder().decode(pt);
}
const PW_FEHLT = 'Kein Sicherungs-Passwort festgelegt (Einstellungen → Daten & Sicherung).';
async function sicherungInhalt(S) { if (!sicherungPw) throw new Error(PW_FEHLT); return verschluesseln(JSON.stringify(S), sicherungPw); }
async function sicherungBlob(S) { return new Blob([await sicherungInhalt(S)], { type: 'application/json' }); }

// Kopien vor Import/Zurücksetzen/Wiederherstellen (vor_…) nach 30 Tagen vom Tablet löschen
async function idbKeys() {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAllKeys(); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
}
async function alteKopienAufraeumen(tage = 30) {
  const grenze = isoOf(new Date(Date.now() - tage * 864e5));
  for (const k of await idbKeys()) {
    const m = /^vor_.*?(\d{4}-\d{2}-\d{2})/.exec(String(k));
    if (m && m[1] < grenze) await idbDel(k);
  }
}
const sicherungName = () => `Bergwiesenhof_Sicherung_${stempel()}.json`;

// ---------- Minimaler XLSX-Schreiber (ZIP ohne Kompression) ----------
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function zip(files) { // files: [{name, data(Uint8Array)}]
  const enc = new TextEncoder(); const parts = []; const central = []; let off = 0;
  for (const f of files) {
    const nm = enc.encode(f.name), d = f.data, crc = crc32(d);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
    h.setUint16(10, 0, true); h.setUint16(12, 0x21, true); h.setUint32(14, crc, true); h.setUint32(18, d.length, true); h.setUint32(22, d.length, true);
    h.setUint16(26, nm.length, true); h.setUint16(28, 0, true);
    parts.push(new Uint8Array(h.buffer), nm, d);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
    c.setUint16(12, 0, true); c.setUint16(14, 0x21, true); c.setUint32(16, crc, true); c.setUint32(20, d.length, true); c.setUint32(24, d.length, true);
    c.setUint16(28, nm.length, true); c.setUint16(30, 0, true); c.setUint16(32, 0, true); c.setUint16(34, 0, true); c.setUint16(36, 0, true);
    c.setUint32(38, 0, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + d.length;
  }
  const cLen = central.reduce((s, p) => s + p.length, 0);
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
  e.setUint32(12, cLen, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...central, new Uint8Array(e.buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
function colName(i) { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function excelDatum(iso) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return null; return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000); }
// sheets: [{name, cols:[{h, w, typ:'text'|'num'|'date'|'eur'}], rows:[[...]]}]
function xlsx(sheets) {
  const enc = new TextEncoder(); const files = [];
  const sheetXml = sh => {
    let x = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>';
    sh.cols.forEach((c, i) => { x += `<col min="${i + 1}" max="${i + 1}" width="${c.w || 14}" customWidth="1"/>`; });
    x += '</cols><sheetData><row r="1">';
    sh.cols.forEach((c, i) => { x += `<c r="${colName(i)}1" t="inlineStr" s="1"><is><t>${xmlEsc(c.h)}</t></is></c>`; });
    x += '</row>';
    sh.rows.forEach((row, ri) => {
      const r = ri + 2; x += `<row r="${r}">`;
      row.forEach((v, ci) => {
        if (v === null || v === undefined || v === '') return;
        const ref = colName(ci) + r, typ = (sh.cols[ci] || {}).typ;
        if (typ === 'date') { const d = excelDatum(v); if (d !== null) { x += `<c r="${ref}" s="2"><v>${d}</v></c>`; return; } }
        if ((typ === 'num' || typ === 'eur') && typeof v === 'number' && isFinite(v)) { x += `<c r="${ref}"${typ === 'eur' ? ' s="3"' : ''}><v>${v}</v></c>`; return; }
        x += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
      });
      x += '</row>';
    });
    x += `</sheetData><autoFilter ref="A1:${colName(sh.cols.length - 1)}${Math.max(1, sh.rows.length + 1)}"/></worksheet>`;
    return x;
  };
  files.push({ name: '[Content_Types].xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' + sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') + '</Types>') });
  files.push({ name: '_rels/.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>') });
  files.push({ name: 'xl/workbook.xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>' + sheets.map((s, i) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>' + sheets.map((s, i) => `<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="${i}" hidden="1">'${xmlEsc(s.name.slice(0, 31))}'!$A$1:$${colName(s.cols.length - 1)}$${Math.max(1, s.rows.length + 1)}</definedName></definedNames>`).slice(0, 0).join('') + '</workbook>') });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' + sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`) });
  files.push({ name: 'xl/styles.xml', data: enc.encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;€&quot;"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE3EFD3"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="4"><xf/><xf fontId="1" fillId="2" applyFont="1" applyFill="1"/><xf numFmtId="14" applyNumberFormat="1"/><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>') });
  sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(sheetXml(s)) }));
  return zip(files);
}

// Excel-Export des gesamten Datenstands (für Auswertungen am PC)
function excelExport(S) {
  const n = v => (v === null || v === undefined || v === '' ? '' : num(v));
  const best = sortNr(S.bestellungen);
  const B = {
    name: 'Bestellungen', cols: [
      { h: 'Bestell-Nr.', typ: 'num', w: 10 }, { h: 'Eingang', typ: 'date', w: 11 }, { h: 'Tier', w: 14 }, { h: 'Name', w: 22 }, { h: 'Telefon', w: 15 }, { h: 'Mail', w: 22 }, { h: 'Bestellweg', w: 11 },
      { h: 'Genusspakete', typ: 'num', w: 9 }, { h: 'davon vakuumiert', typ: 'num', w: 9 },
      ...S.artikel.map(a => ({ h: `${a.name} (${a.einheit === 'Stk' ? 'Stk' : 'kg'})`, typ: 'num', w: 10 })),
      { h: 'Vakuum-Tüten', typ: 'num', w: 9 }, { h: 'Sonderwünsche', w: 30 }, { h: 'Schätzpreis', typ: 'eur', w: 11 }, { h: 'Endbetrag', typ: 'eur', w: 11 },
      { h: 'Status', w: 9 }, { h: 'Lagerort', w: 12 }, { h: 'Fach / Kiste', w: 10 }, { h: 'gepackt am', typ: 'date', w: 11 }, { h: 'Mengencheck', w: 22 }, { h: 'Notiz intern', w: 24 }, { h: 'Wunschtermin', typ: 'date', w: 11 }, { h: 'vakuumieren (Artikel)', w: 24 }, { h: 'Bestellung (Text)', w: 60 }
    ],
    rows: best.map(o => [o.nr, o.eingang, o.tier, o.name, o.tel, o.mail, o.weg, n(o.pakete), n(o.pakVak),
      ...S.artikel.map(a => { const q = qty(S, o, a.name); return q > 0 ? q : ''; }),
      tueten(S, o) || '', sonderOf(S, o).map(s => sonderText(S, s)).join('; '), schaetzpreis(S, o), n(o.endbetrag),
      o.status || 'offen', o.lagerOrt || '', o.lagerPlatz || '', o.gepacktAm || '', mengencheck(S, o), o.notiz, o.wunsch, vakArtikel(S, o).join('; '), bestellText(S, o)])
  };
  const SW = { name: 'Sonderwünsche', cols: [{ h: 'Bestell-Nr.', typ: 'num' }, { h: 'Name', w: 22 }, { h: 'Tier' }, { h: 'Artikel', w: 20 }, { h: 'Menge', typ: 'num' }, { h: 'Einheit' }, { h: 'Wunsch / Vorgabe', w: 30 }], rows: [] };
  const PO = { name: 'Portionen', cols: [{ h: 'Bestell-Nr.', typ: 'num' }, { h: 'Name', w: 22 }, { h: 'Artikel', w: 20 }, { h: 'Anzahl', typ: 'num' }, { h: 'je Portion (g)', typ: 'num' }, { h: 'verpacken als', w: 18 }, { h: 'ergibt ca. kg', typ: 'num' }], rows: [] };
  for (const o of best) {
    for (const s of sonderOf(S, o)) { const a = art(S, s.art); SW.rows.push([o.nr, o.name, o.tier, s.art, has(s.menge) ? num(s.menge) : '', a ? a.einheit : '', s.wunsch]); }
    for (const p of portionenOf(S, o)) PO.rows.push([o.nr, o.name, p.art, p.anzahl, p.g || '', p.text, p.kg || '']);
  }
  const K = { name: 'Kunden', cols: [{ h: 'Kd-Nr.', typ: 'num' }, { h: 'Name', w: 24 }, { h: 'Telefon', w: 15 }, { h: 'Mail', w: 24 }, { h: 'Notiz', w: 30 }, { h: 'angelegt', typ: 'date' }, { h: 'Bestellungen', typ: 'num' }, { h: 'letzte Bestellung', typ: 'date' }, { h: 'Pakete gesamt', typ: 'num' }, { h: 'Summe Endbeträge', typ: 'eur' }],
    rows: S.kunden.slice().sort((a, b) => a.nr - b.nr).map(k => { const st = kundenStat(S, k); return [k.nr, k.name, k.tel, k.mail, k.notiz, k.angelegt || '', st.anzahl, kundeLetzte(S, k), st.pakete, st.umsatz]; }) };
  const T = { name: 'Tiere', cols: [{ h: 'Tier', w: 14 }, { h: 'Ohrmarke / Notiz', w: 20 }, { h: 'Typ' }, { h: 'Schlachtgewicht', typ: 'num' }, { h: 'Schlachttermin', typ: 'date' }, { h: 'Abholtermin', typ: 'date' }, { h: 'SG für Rechnung', typ: 'num' }, { h: 'Paketgewicht ca.', typ: 'num' }, { h: 'bestellte Pakete', typ: 'num' }, { h: 'Pakete frei', typ: 'num' }, { h: 'Bestellungen', typ: 'num' }, { h: 'davon reicht nicht', typ: 'num' }, { h: 'Archiv seit', typ: 'date' }, { h: 'Statistik' }, { h: 'gewogen kg', typ: 'num' }, { h: 'gewogene Teile', typ: 'num' }, { h: 'Kommentar', w: 30 }],
    rows: S.tiere.map(t => { const i = tierInfo(S, t); const su = erfassungSumme(t); return [t.name, t.notiz, t.typ, n(t.sg), t.schlacht, t.abhol, i.sg, r2(i.paketKg), i.pakete, i.frei, i.anzahl, i.reichtNicht, t.archiv || '', zaehltStatistik(t) ? 'zählt' : t.ohneStatistik ? 'ausgeblendet' : 'nein', r2(su.kg), su.teile, t.kommentar || '']; }) };
  const AU = { name: 'Ausbeute gewogen', cols: [{ h: 'Tier', w: 14 }, { h: 'Typ' }, { h: 'Schlachtgewicht', typ: 'num' }, { h: 'Artikel', w: 20 }, { h: 'Teilstück', w: 28 }, { h: 'kg', typ: 'num' }, { h: 'für Bestell-Nr.', typ: 'num' }, { h: 'Zeit', w: 20 }],
    rows: S.tiere.flatMap(t => (t.erfassung || []).map(e => [t.name, t.typ, n(t.sg), e.art, e.teil || '', n(e.kg), num(e.nr) || '', e.zeit || ''])) };
  const KI = { name: 'Kisten', cols: [{ h: 'Tier' }, { h: 'Kiste Nr.', typ: 'num' }, { h: 'Inhalt', w: 20 }, { h: 'Menge (kg gewogen)', typ: 'num' }, { h: 'Plan kg', typ: 'num' }, { h: 'Stellplatz', w: 22 }], rows: S.kisten.map(k => [k.tier, k.nr, k.art, n(k.kg), n(k.plan), k.platz]) };
  const H = { name: 'Hofladen', cols: [{ h: 'Datum', typ: 'date' }, { h: 'Tier' }, { h: 'Kiste', typ: 'num' }, { h: 'Artikel', w: 20 }, { h: 'Rest', typ: 'num' }, { h: 'Einheit' }], rows: S.hofladen.map(h => [h.datum, h.tier, h.kiste, h.art, n(h.rest), h.einheit]) };
  const P = { name: 'Preisliste', cols: [{ h: 'Artikel', w: 20 }, { h: 'bestellt in' }, { h: 'Preis', typ: 'eur' }, { h: 'im Genusspaket' }, { h: 'Stückgewicht (g)', typ: 'num' }, { h: 'am Stück möglich' }, { h: 'fester Beutel (g)', typ: 'num' }, { h: 'Anteil Bulle', typ: 'num' }, { h: 'Anteil Rind', typ: 'num' }, { h: 'Teilstücke', w: 50 }],
    rows: S.artikel.map(a => [a.name, a.einheit, n(a.preis), paketListe(S).filter(p => p.art === a.name).map(p => `${p.anzahl} × ${paketG(S, p)} g`).join(' + ') || 'nein', n(a.stueckG) || '', a.amStueck ? 'ja' : 'nein', n(a.beutelG) || '', n(a.anteil) || '', anteilVon(S, a, 'Rind') || '', a.teile]) };
  return xlsx([B, SW, PO, K, T, AU, KI, H, P]);
}

// ---------- Automatische Sicherung in Google Drive (über eigenes Google-Skript) ----------
const autoMeta = { gesendetAm: null, stand: null, letzterVersuch: 0, fehler: null, datei: null };
let autoLaeuft = false;
async function autoMetaLaden() { Object.assign(autoMeta, (await idbGet('autoSicherung')) || {}); }
const autoMetaSpeichern = () => idbSet('autoSicherung', { ...autoMeta }).catch(() => { });
function sicherungsAdresse(roh) {
  const t = String(roh || '').trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    const k = u.searchParams.get('k');
    u.searchParams.delete('k');
    if (u.protocol !== 'https:' || !k) return null;
    return { url: u.toString(), k };
  } catch (e) { return null; }
}
// Sendet die Sicherung; ohne "erzwingen" nur bei Änderungen, mit Internet und höchstens 1× pro Stunde
async function autoSicherung(erzwingen, test) {
  const a = sicherungsAdresse(S && S.settings.sicherungUrl);
  if (!a) return { ok: false, fehler: 'Keine gültige Sicherungs-Adresse eingetragen.' };
  if (!navigator.onLine) return { ok: false, fehler: 'Kein Internet.' };
  if (!erzwingen && !test) {
    if (autoMeta.stand && autoMeta.stand === S.gespeichert) return { ok: true, uebersprungen: 'keine Änderungen' };
    if (autoMeta.gesendetAm && Date.now() - new Date(autoMeta.gesendetAm) < 60 * 60e3) return { ok: true, uebersprungen: 'letzte Sicherung < 1 Std.' };
    if (autoMeta.fehler && Date.now() - autoMeta.letzterVersuch < 15 * 60e3) return { ok: false, uebersprungen: 'letzter Versuch fehlgeschlagen' };
  }
  if (autoLaeuft) return { ok: false, uebersprungen: 'läuft schon' };
  autoLaeuft = true;
  const stand = S.gespeichert;
  try {
    autoMeta.letzterVersuch = Date.now();
    const body = test ? { k: a.k, test: true } : { k: a.k, inhalt: await sicherungInhalt(S) };
    const r = await fetch(a.url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow' });
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) { throw new Error('Antwort ist keine Sicherungsbestätigung – ist das Skript als Web-App „für jeden“ bereitgestellt?'); }
    if (!j.ok) throw new Error(j.fehler || 'unbekannter Fehler');
    if (!test) { autoMeta.gesendetAm = new Date().toISOString(); autoMeta.stand = stand; autoMeta.datei = j.datei || null; }
    autoMeta.fehler = null;
    await autoMetaSpeichern();
    if (typeof kopfStatus === 'function') kopfStatus();
    return { ok: true, datei: j.datei, test: !!j.test };
  } catch (e) {
    autoMeta.fehler = e.message || String(e);
    await autoMetaSpeichern();
    if (typeof kopfStatus === 'function') kopfStatus();
    return { ok: false, fehler: autoMeta.fehler };
  } finally { autoLaeuft = false; }
}
function autoSicherungStarten() {
  const versuch = () => { if (S && S.settings.sicherungUrl) autoSicherung(false).catch(() => { }); };
  setTimeout(versuch, 8000);                       // kurz nach dem Start
  setInterval(versuch, 5 * 60e3);                  // alle 5 Minuten prüfen
  window.addEventListener('online', () => setTimeout(versuch, 5000)); // sobald wieder Internet da ist
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(versuch, 3000); });
}
// letzte Sicherung egal ob von Hand oder automatisch
function letzteSicherungZeit() {
  const a = S.letzteSicherung ? new Date(S.letzteSicherung).getTime() : 0;
  const b = autoMeta.gesendetAm ? new Date(autoMeta.gesendetAm).getTime() : 0;
  return Math.max(a, b) || null;
}
