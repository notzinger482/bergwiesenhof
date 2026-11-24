// Bestellsystem Bergwiesenhof – Rechenlogik
// Übersetzung der Excel-Formeln und VBA-Makros (Bestellsystem_Makros.bas) nach JavaScript.
// Reine Funktionen auf dem Datenstand "S" (state) – keine Oberfläche.
'use strict';

const ORGANE = ['Leber', 'Nieren', 'Herz', 'Zunge', 'Bäckle'];
// Ochsenschwanz: nach Stück bestellt, läuft aber über Metzgerauftrag und Kisten (gemeinsam mit den Beinscheiben)
const OCHS = 'Ochsenschwanz';
// Ochsenschwanz der Bestellung ganz lassen? (Häkchen „am Stück“)
const ochsGanz = (S, o) => { const a = S.artikel.find(x => x.name === OCHS); const p = o.pos && o.pos[OCHS]; return !!(a && a.amStueck && p && p.amStueck); };
const BEIN = 'Beinscheiben';
const HACK = 'Hackfleisch';
const GULASCH = 'Gulasch geschnitten';
const BRATEN = 'Braten';
const SK = 'Suppenknochen (SK)';
const FK = 'Soßenknochen (FK)';
const EPS = 1e-9;

// ---------- Hilfen ----------
const num = v => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  const n = parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
  return isFinite(n) ? n : 0;
};
const has = v => !(v === null || v === undefined || v === '' || (typeof v === 'number' && !isFinite(v)));
const r1 = x => Math.round(x * 10) / 10;
const r2 = x => Math.round(x * 100) / 100;
const r3 = x => Math.round(x * 1000) / 1000;
const roundUp = x => Math.ceil(x - 1e-7);
const todayISO = () => { const d = new Date(); return isoOf(d); };
const isoOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
function fmtNum(x, maxDec = 2, minDec = 0) {
  if (!has(x)) return '';
  return Number(x).toLocaleString('de-DE', { minimumFractionDigits: minDec, maximumFractionDigits: maxDec });
}
// für Eingabefelder: ohne Tausenderpunkt (sonst wird „2.500“ beim Ändern als 2,5 gelesen)
function fmtIn(x, maxDec = 2, minDec = 0) {
  if (!has(x)) return '';
  return Number(x).toLocaleString('de-DE', { minimumFractionDigits: minDec, maximumFractionDigits: maxDec, useGrouping: false });
}
const fmtKg = x => fmtNum(x, 2);
const fmtEur = x => has(x) ? Number(x).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' }) : '';
function fmtDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}
// "7.12.26", "07.12.2026", "2026-12-07" -> ISO; '' bei leer; null bei ungültig
function parseDate(t) {
  t = String(t || '').trim();
  if (!t) return '';
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return isoOf(new Date(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{1,2})\.(\d{1,2})\.?(\d{2,4})?$/.exec(t);
  if (m) {
    let y = m[3] ? +m[3] : new Date().getFullYear();
    if (y < 100) y += 2000;
    const d = new Date(y, +m[2] - 1, +m[1]);
    if (d.getMonth() !== +m[2] - 1) return null;
    return isoOf(d);
  }
  return null;
}
const sameText = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

// ---------- Artikel / Preisliste ----------
const artList = S => S.artikel;
const art = (S, name) => S.artikel.find(a => a.name === name);
const istOrgan = name => ORGANE.includes(name);
const einheitForm = a => a.beutelG > 0 ? 'Btl' : a.einheit; // wie im Eingabeblatt: kg / Btl / Stk
// Anteil am Schlachtgewicht: Bulle = a.anteil; Rind = a.anteilRind (oder Bulle-Werte, wenn „Werte übernehmen“)
// ---------- Genusspaket: feste Zusammensetzung (Einstellungen → Genusspaket) ----------
const paketListe = S => Array.isArray(S.settings.paket) ? S.settings.paket.filter(p => p && p.art) : [];
// Einzelgewicht eines Artikels (Stückgewicht bzw. Beutelgröße aus der Preisliste) – gilt auch im Genusspaket
const einzelGewicht = (S, name) => { const a = art(S, name); return !a ? 0 : num(a.beutelG) > 0 ? num(a.beutelG) : num(a.stueckG) > 0 ? num(a.stueckG) : 0; };
const paketG = (S, p) => einzelGewicht(S, p.art) || num(p.g);
// Beinscheiben „am Stück“ = ganze Wade (Anzahl = Waden)
const istWade = (a, p) => a && a.name === BEIN && a.amStueck && p && p.amStueck;
// Gewicht einer Wade = Beinscheiben-Ausbeute des Tiers ÷ Waden je Tier (ohne Tier: Standard-Rind)
const wadeKg = (S, tierName) => {
  const t = (tierName && S.tiere.find(x => sameText(x.name, tierName))) || { typ: 'Rind', sg: null };
  const n = has(S.settings.maxWaden) && num(S.settings.maxWaden) > 0 ? num(S.settings.maxWaden) : 4;
  return yieldArt(S, t, BEIN) / n;
};
const posStueckG = (S, a, p, o) => istWade(a, p) ? wadeKg(S, o && o.tier) * 1000 : num(a.stueckG);
const gText = g => g >= 1000 ? fmtNum(g / 1000, 2) + ' kg' : fmtNum(g) + ' g';
const paketKgArt = (S, name) => paketListe(S).filter(p => p.art === name).reduce((s, p) => s + num(p.anzahl) * paketG(S, p) / 1000, 0);
const paketGewicht = S => paketListe(S).reduce((s, p) => s + num(p.anzahl) * paketG(S, p) / 1000, 0);
const imPaket = (S, name) => paketKgArt(S, name) > 0;
const paketStueck = (S, name) => paketListe(S).filter(p => p.art === name).reduce((s, p) => s + num(p.anzahl), 0);
// Hack im Paket: offen = 1 Tüte, vakuumiert = Portionen à hackPaketG
function hackPaketText(S, pakete, pakVak) {
  const kg = paketKgArt(S, HACK), hp = num(S.settings.hackPaketG) || 500;
  const v = Math.min(num(pakVak), num(pakete)), o = num(pakete) - v, t = [];
  if (o > 0) t.push(`${fmtNum(o)} Tüte${o > 1 ? 'n' : ''} à ${fmtNum(kg, 2)} kg`);
  if (v > 0) t.push(`${fmtNum(Math.round(v * kg * 1000 / hp))} × ${fmtNum(hp)} g vakuumiert`);
  return t.join(' + ');
}
// ---------- Braten: gewachsene Stücke (Einstellungen → Ausbeute & Kisten) ----------
const bratenTeile = S => Array.isArray(S.settings.bratenTeile) ? S.settings.bratenTeile.filter(x => x && x.name && num(x.stueck) > 0 && num(x.kg) > 0) : [];
// kg je Stück nach Tiertyp (Bulle: eigene Werte, sonst Rind-Werte)
const teilKgRef = (x, typ) => typ === 'Bulle' && num(x.kgBulle) > 0 ? num(x.kgBulle) : num(x.kg);
// gemessener Wert aus dem Archiv (ab 3 Tieren) geht vor
const teilKg = (x, typ, S) => { const g = S ? gemessen(S, typ, 'teil', x.name) : null; return g ? g.wert : teilKgRef(x, typ); };
const bratenTeileKg = (S, typ) => bratenTeile(S).reduce((s, x) => s + num(x.stueck) * teilKg(x, typ, S), 0);
// Schulter-Anteil (Bug, falsches Filet) am Braten – darf bei Bedarf ins Hack
const bugAnteilVon = (S, typ) => { const g = bratenTeileKg(S, typ); return g > 0 ? bratenTeile(S).filter(x => x.bug).reduce((s, x) => s + num(x.stueck) * teilKg(x, typ, S), 0) / g : (has(S.settings.bugAnteilBraten) ? num(S.settings.bugAnteilBraten) : 0.5); };
// Referenzspannen (Anteil am Schlachtgewicht, Stückgewicht) – nur zur Prüfung beim Eintragen
const ausserhalb = (v, min, max) => has(min) && has(max) && num(max) > 0 && (v < num(min) - 1e-6 || v > num(max) + 1e-6);
const refText = (min, max, f = 100, dec = 1, eh = '%') => has(min) && has(max) && num(max) > 0 ? `${fmtNum(num(min) * f, dec)}–${fmtNum(num(max) * f, dec)} ${eh}` : '';
const rindEigene = S => S.settings.rindWieBulle === false;
// Anteil laut Einstellungen (Referenz) – und wirksamer Anteil: gemessener Durchschnitt aus dem Archiv, sobald genug Tiere erfasst sind
const anteilRef = (S, a, typ) => num(typ === 'Bulle' || !rindEigene(S) ? a.anteil : a.anteilRind);
const anteilVon = (S, a, typ) => { const g = S && S.tiere ? gemessen(S, typ, 'art', a.name) : null; return g ? g.wert : anteilRef(S, a, typ); };

// ---------- Gemessene Ausbeute (Wiegen beim Kommissionieren, Statistik aus dem Tier-Archiv) ----------
// tier.erfassung = [{ art, teil (Braten-Teilstück oder ''), kg, nr (Bestell-Nr. oder 0 = Rest/Hofladen), zeit }]
const STAT_MIN_TIERE = 3;
const statCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
// Hackfleisch, Suppen- und Soßenknochen werden nicht einzeln gewogen: ihre Ausbeute = Summe der gewogenen Kisten
// (Kisten & Ladeplan, Kistengewicht = Inhalt). Beim Hack wird abgezogen, was laut Plan an Gulasch/Bug ins Hack ging.
const KISTEN_AUSBEUTE = [HACK, SK, FK];
const kisteGewogen = k => k.art === OCHS ? has(k.gew) : k.gewogen !== undefined ? !!k.gewogen : (has(k.plan) && has(k.kg) && Math.abs(num(k.kg) - num(k.plan)) > 0.001);
function hackAbzugPlan(S, t) {
  try { const T = topfTier(S, t.name) || t; const b = fleischBilanz(S, T, ordersOfTopf(S, T)); return Math.max(0, num(b.gul.insHack) + num(b.hack.ausBug)); } catch (e) { return 0; }
}
function kistenAusbeute(t, S) {
  let rows, abzug = 0, f = 1; // f = Anteil des Tiers an gemeinsamen Kisten (Topf)
  if (t && t.abschluss && Array.isArray(t.abschluss.kisten)) { rows = t.abschluss.kisten; abzug = num(t.abschluss.hackAbzug); if (has(t.abschluss.anteil)) f = num(t.abschluss.anteil); }
  else if (t && S && !t.archiv) {
    const ctx = kistenKontext(S, t.name); rows = ctx.rows;
    if (ctx.topf) { const ges = sgRechnung(S, ctx.t); f = ges > 0 ? sgRechnung(S, t) / ges : 1; }
    if (rows.some(k => k.art === HACK && kisteGewogen(k))) abzug = hackAbzugPlan(S, t) * f;
  }
  else return {};
  const out = {};
  for (const k of rows) if (KISTEN_AUSBEUTE.includes(k.art) && kisteGewogen(k) && num(k.kg) > 0) { const x = out[k.art] = out[k.art] || { kg: 0, teile: 0, kisten: true }; x.kg += num(k.kg) * f; x.teile++; }
  if (out[HACK]) { out[HACK].kg = Math.max(0, out[HACK].kg - abzug); out[HACK].abzug = abzug; }
  return out;
}
// geplante Umleitung ins Sonder-Hack je Tier (Topf: anteilig nach Schlachtgewicht)
function umleitung(t, S) {
  if (!t) return {};
  if (t.abschluss) return t.abschluss.umleitung || {};
  if (!S || t.archiv) return {};
  try {
    const T = topfTier(S, t.name) || t, b = fleischBilanz(S, T, ordersOfTopf(S, T));
    const f = T.glieder ? sgRechnung(S, t) / (sgRechnung(S, T) || 1) : 1;
    const u = {}; if (num(b.hack.fettSied) > 0) u[SIED] = r2(b.hack.fettSied * f); if (num(b.braten.bugMager) > 0) u[BRATEN] = r2(b.braten.bugMager * f);
    return u;
  } catch (e) { return {}; }
}
function erfassungSumme(t, S) {
  const art = {}, teil = {};
  let kg = 0, teile = 0;
  const ki = kistenAusbeute(t, S);
  for (const [n, v] of Object.entries(ki)) { art[n] = { kg: v.kg, teile: v.teile, kisten: true, abzug: v.abzug }; kg += v.kg; teile += v.teile; }
  // Ausbeute-Statistik: was ins fettige/magere Hack ging (Siedfleisch, Bug), wurde nicht als Siedfleisch/Braten gewogen –
  // geplante Menge wieder dazuzählen, sonst wirken diese Teilstücke zu klein
  const um = umleitung(t, S);
  for (const e of (t && t.erfassung) || []) {
    const w = num(e.kg); if (!(w > 0)) continue;
    if (ki[e.art]) continue; // Kistengewicht hat Vorrang (alte, einzeln gewogene Hack-/Knochen-Teile)
    const a = art[e.art] = art[e.art] || { kg: 0, teile: 0 }; a.kg += w; a.teile++;
    if (e.teil) { const x = teil[e.teil] = teil[e.teil] || { kg: 0, teile: 0 }; x.kg += w; x.teile++; }
    kg += w; teile++;
  }
  for (const [n, w] of Object.entries(um)) if (art[n] && !art[n].kisten && w > 0.05) { art[n].kg += w; art[n].umleitung = w; kg += w; }
  return { art, teil, kg, teile };
}
// zählt für die Statistik: archiviert, nicht ausgeblendet, echtes Schlachtgewicht, etwas gewogen
const zaehltStatistik = t => !!(t && t.archiv) && !t.ohneStatistik && num(t.sg) > 0 && ((t.erfassung || []).length > 0 || Object.keys(kistenAusbeute(t)).length > 0);
function ausbeuteStatistik(S) {
  const tiere = (S.tiere || []).filter(zaehltStatistik);
  const sig = tiere.map(t => [t.name, t.typ, t.sg, (t.erfassung || []).length, erfassungSumme(t, S).kg].join('|')).join(';') + '#' + (S.settings.bratenTeile || []).map(x => x && x.name + ':' + x.stueck).join(',');
  const c = statCache && statCache.get(S);
  if (c && c.sig === sig) return c.stat;
  const roh = { Rind: { art: {}, teil: {} }, Bulle: { art: {}, teil: {} } };
  for (const t of tiere) {
    const typ = t.typ === 'Bulle' ? 'Bulle' : 'Rind';
    // Topf (gemeinsame Kisten): beim Kommissionieren lässt sich nicht trennen, was von welchem Tier kam –
    // jedes Tier des Topfs zählt mit dem gemeinsamen Wert (Summe gewogen ÷ Summe Schlachtgewicht)
    const partner = Array.isArray(t.topfMit) ? t.topfMit.map(n => (S.tiere || []).find(x => x.name === n)).filter(x => x && x.archiv && num(x.sg) > 0) : [t];
    const gl = partner.length ? partner : [t];
    const sg = gl.reduce((s, x) => s + num(x.sg), 0), nT = gl.length;
    const su = { art: {}, teil: {} };
    for (const x of gl) { const e = erfassungSumme(x, S); for (const k of ['art', 'teil']) for (const [n, v] of Object.entries(e[k])) { const z = su[k][n] = su[k][n] || { kg: 0 }; z.kg += v.kg; } }
    for (const [n, v] of Object.entries(su.art)) (roh[typ].art[n] = roh[typ].art[n] || []).push({ tier: t.name, wert: v.kg / sg });
    for (const x of bratenTeile(S)) { const v = su.teil[x.name]; if (v) (roh[typ].teil[x.name] = roh[typ].teil[x.name] || []).push({ tier: t.name, wert: v.kg / (num(x.stueck) * nT) }); }
  }
  const stat = { Rind: { art: {}, teil: {} }, Bulle: { art: {}, teil: {} } };
  for (const typ of ['Rind', 'Bulle']) for (const k of ['art', 'teil']) for (const [n, l] of Object.entries(roh[typ][k]))
    stat[typ][k][n] = { n: l.length, wert: l.reduce((s, v) => s + v.wert, 0) / l.length, tiere: l.map(v => v.tier) };
  if (statCache) statCache.set(S, { sig, stat });
  return stat;
}
// Messwert, der verwendet wird (erst ab STAT_MIN_TIERE Tieren), sonst null
const gemessen = (S, typ, kind, name) => { const s = ausbeuteStatistik(S)[typ === 'Bulle' ? 'Bulle' : 'Rind'][kind][name]; return s && s.n >= STAT_MIN_TIERE ? s : null; };
const gemessenRoh = (S, typ, kind, name) => ausbeuteStatistik(S)[typ === 'Bulle' ? 'Bulle' : 'Rind'][kind][name] || null;
// Wiege-Knöpfe beim Kommissionieren: Ausbeute-Artikel, Braten nach Teilstück
function wiegeArten(S) {
  const out = [];
  for (const a of ausbeuteArtikel(S)) {
    if (KISTEN_AUSBEUTE.includes(a.name)) continue; // kommt aus den gewogenen Kisten
    if (a.name === BRATEN && bratenTeile(S).length) bratenTeile(S).forEach(x => out.push({ art: BRATEN, teil: x.name }));
    else out.push({ art: a.name, teil: '' });
  }
  return out;
}
// Teile, die am Ende je Artikel zur Verfügung standen (für das Archiv)
function ausbeuteTier(S, t) {
  const su = erfassungSumme(t, S), sg = num(t.sg);
  const rows = ausbeuteArtikel(S).map(a => {
    const v = su.art[a.name];
    return { art: a.name, kg: v ? v.kg : 0, teile: v ? v.teile : 0, kisten: !!(v && v.kisten), abzug: v && v.abzug ? v.abzug : 0, anteil: v && sg > 0 ? v.kg / sg : null, ref: anteilRef(S, a, t.typ), plan: t.archiv && t.archivStand && t.archivStand.plan && has(t.archivStand.plan[a.name]) ? num(t.archivStand.plan[a.name]) : yieldArt(S, t, a.name) };
  }).concat(Object.keys(su.art).filter(n => !ausbeuteArtikel(S).some(a => a.name === n)).map(n => ({ art: n, kg: su.art[n].kg, teile: su.art[n].teile, anteil: sg > 0 ? su.art[n].kg / sg : null, ref: null, plan: null })));
  const teile = bratenTeile(S).map(x => { const v = su.teil[x.name]; return { teil: x.name, kg: v ? v.kg : 0, teile: v ? v.teile : 0, jeStueck: v ? v.kg / num(x.stueck) : null, stueck: num(x.stueck), ref: teilKgRef(x, t.typ) }; });
  return { rows, teile, kg: su.kg, anzahl: su.teile, sg };
}
const ausbeuteArtikel = S => S.artikel.filter(a => num(a.anteil) > 0 || (rindEigene(S) && num(a.anteilRind) > 0));

// ---------- Bestellung: Mengen ----------
// Menge je Artikel wie in Blatt "Bestellungen" (kg; Beutel-Artikel in kg; Stück-Artikel in Stk)
function qty(S, o, name) {
  const p = o.pos && o.pos[name];
  if (!p) return 0;
  const a = art(S, name);
  if (!a) return 0;
  if (a.beutelG > 0) return r3(num(p.menge) * a.beutelG / 1000);
  if (a.einheit === 'Stk') return num(p.menge);
  if (num(p.menge) > 0) return num(p.menge);
  if (num(p.anzahl) > 0) {
    const g = num(p.g) > 0 ? num(p.g) : posStueckG(S, a, p, o);
    if (g > 0) return r3(num(p.anzahl) * g / 1000);
  }
  return 0;
}
// Sonderwünsche einer Bestellung (eingetragene + automatisch "am Stück")
function sonderOf(S, o) {
  const out = [];
  for (const a of S.artikel) {
    const p = o.pos && o.pos[a.name];
    if (p && p.amStueck && a.amStueck && a.name !== OCHS) {
      const q = qty(S, o, a.name);
      let w = istWade(a, p) ? 'Wade am Stück' : 'am Stück';
      if (istWade(a, p)) { if (num(p.anzahl) > 0) w = `${fmtNum(p.anzahl)} ${num(p.anzahl) > 1 ? 'Waden' : 'Wade'} am Stück`; }
      else if (num(p.anzahl) > 0) w += ` (${fmtNum(p.anzahl)} Stück${num(p.g) > 0 ? ' à ' + fmtNum(p.g) + ' g' : ''})`;
      out.push({ art: a.name, menge: q > 0 ? q : null, wunsch: w, auto: true });
    }
  }
  for (const s of (o.sonder || [])) if (s && s.art) {
    const teil = s.art === BRATEN && s.teil && bratenTeile(S).some(x => x.name === s.teil) ? s.teil : '';
    const nG = num(s.ganz) > 0 && ganzArt(S, s.art) && (s.art !== BRATEN || teil) ? Math.round(num(s.ganz)) : 0;
    let menge = has(s.menge) ? num(s.menge) : null, ca = false;
    if (nG) { const g = ganzStueckKg(S, o.tier, s.art, teil); if (g) { menge = r3(nG * g.kg); ca = true; } }
    const teilTxt = nG ? (s.art === BRATEN ? `${nG === 1 ? '1 ganzes Stück' : nG + '× ganzes Stück'} ${teil}` : `${nG === 1 ? '1 ganzes' : nG + '× ganzes'} ${s.art}`) : teil ? 'aus ' + teil : '';
    out.push({ art: s.art, menge, ca, teil, ganz: nG, sorte: s.art === HACK && HACK_SORTEN[s.sorte] ? s.sorte : '',
      wunsch: [s.art === HACK && HACK_SORTEN[s.sorte] ? HACK_SORTEN[s.sorte] : '', teilTxt, s.wunsch || ''].filter(Boolean).join(' – ') });
  }
  return out;
}
// Braten-Teilstück / ganzes Stück beim Sonderwunsch (seit 3.2, Wunsch Nutzer): Braten aus einem bestimmten Teilstück (kg oder
// ganzes Stück), dazu ganze Stücke bei Artikeln mit „ganzeStuecke“ (Filet, Tafelspitz). Gewicht eines ganzen Stücks geschätzt.
const ganzArt = (S, name) => { const a = art(S, name); return !!a && (name === BRATEN ? bratenTeile(S).length > 0 : num(a.ganzeStuecke) > 0); };
function ganzStueckKg(S, tierName, artName, teil) {
  const t0 = tierName && tierName !== 'Warteliste' ? tier(S, tierName) : null, typ = t0 && t0.typ ? t0.typ : 'Rind';
  if (artName === BRATEN) {
    const x = bratenTeile(S).find(x => x.name === teil); if (!x) return null;
    const g = bratenTeileKg(S, typ), f = t0 && g > 0 ? yieldArt(S, t0, BRATEN) / g : 1;
    const kg = teilKg(x, typ, S) * (f > 0 ? f : 1);
    return { kg, min: num(x.kgMin) > 0 ? Math.min(num(x.kgMin), kg) : kg * 0.75 };
  }
  const a = art(S, artName); if (!a || !(num(a.ganzeStuecke) > 0)) return null;
  let kg = t0 ? yieldArt(S, t0, artName) / num(a.ganzeStuecke) : 0;
  if (!(kg > 0)) kg = num(a.stkMin) > 0 && num(a.stkMax) > 0 ? (num(a.stkMin) + num(a.stkMax)) / 2 : 1;
  return { kg, min: num(a.stkMin) > 0 ? Math.min(num(a.stkMin), kg) : kg * 0.75 };
}
// Teilstück-/Ganz-Wünsche gegen das, was das Tier (der Topf) hergibt – der Reihe nach: {nr: [Text]}
function ganzWunschFehlt(S, t, ords) {
  const out = {}, nT = topfN(t), typ = t.typ || 'Rind', used = {};
  const g = bratenTeileKg(S, typ) * nT, fB = g > 0 ? yieldArt(S, t, BRATEN) / g : 1;
  for (const o of ords) for (const s of sonderOf(S, o)) {
    let key, maxN, stKg, txt;
    if (s.art === BRATEN && s.teil) {
      const x = bratenTeile(S).find(x => x.name === s.teil); if (!x) continue;
      key = 'B|' + x.name; maxN = num(x.stueck) * nT; stKg = teilKg(x, typ, S) * fB;
      txt = s.ganz ? `ganzes Stück ${x.name} (max. ${fmtNum(maxN)} Stück)` : `Braten aus ${x.name} (max. ca. ${fmtNum(maxN * stKg, 1)} kg)`;
    } else if (s.ganz) {
      const a = art(S, s.art); key = 'G|' + s.art; maxN = num(a.ganzeStuecke) * nT; stKg = maxN > 0 ? yieldArt(S, t, s.art) / maxN : 0;
      txt = `ganzes ${s.art} (max. ${fmtNum(maxN)} Stück)`;
    } else continue;
    const u = used[key] = used[key] || { n: 0, kg: 0 };
    if (s.ganz) { u.n += s.ganz; u.kg += s.ganz * stKg; } else u.kg += num(s.menge);
    if (u.n > maxN || u.kg > maxN * stKg + 0.001) { const l = out[o.nr] = out[o.nr] || []; if (!l.includes(txt)) l.push(txt); }
  }
  return out;
}
// kg Braten, die eine Bestellung ausdrücklich aus dem Bug (Bug-Teilstück) wünscht
const bugWunsch = (S, o) => sonderOf(S, o).filter(s => s.art === BRATEN && s.teil && (bratenTeile(S).find(x => x.name === s.teil) || {}).bug).reduce((t, s) => t + num(s.menge), 0);
const specSum = (S, o, name) => sonderOf(S, o).filter(s => s.art === name).reduce((t, s) => t + num(s.menge), 0);
// Hack-Sorte beim Sonderwunsch (seit 3.0.5, Regel Nutzer): „fettig“ = Siedfleisch-Anteil (Standard 50 %) + Rest Hack-Material,
// „mager“ = reines Bugstück (aus dem Bug des Bratens). Die Menge bleibt Hackfleisch in der Bestellung (Preis, Sonderfall),
// gerechnet wird sie aber gegen das Material, aus dem sie wirklich gemacht wird.
const SIED = 'Siedfleisch';
const HACK_SORTEN = { mager: 'besonders mager', fettig: 'besonders fettig' };
const fettSiedAnteil = S => { const p = S && S.settings && has(S.settings.fettSiedProzent) ? num(S.settings.fettSiedProzent) : 50; return Math.min(100, Math.max(0, p)) / 100; };
function hackSorten(S, o) {
  let fett = 0, mager = 0;
  for (const s of (o.sonder || [])) if (s && s.art === HACK && num(s.menge) > 0) { if (s.sorte === 'fettig') fett += num(s.menge); else if (s.sorte === 'mager') mager += num(s.menge); }
  const sied = fett * fettSiedAnteil(S);
  return { fett, mager, sied }; // sied = Siedfleisch-Anteil; Hack-Material sinkt um sied + mager, Bug um mager
}
// Verschiebung je Artikel durch Hack-Sorten (für Mengencheck/Mengenprüfung)
function sortenAdj(S, o, name) {
  const h = hackSorten(S, o);
  if (name === HACK) return -(h.sied + h.mager);
  if (name === SIED) return h.sied;
  return 0;
}
const sonderText = (S, s) => {
  const a = art(S, s.art);
  return (has(s.menge) ? (s.ca ? 'ca. ' + fmtNum(s.menge, 1) : fmtNum(s.menge, 3)) + ' ' + (a ? a.einheit : '') + ' ' : '') + s.art + (s.wunsch ? ' – ' + s.wunsch : '');
};
// Packungen frei eingeben (seit 2.3): „2x500+2x700“ (g), „1500+1700“, „1,5kg+1,7kg“, „4+4 Stk“ oder „2x4 Stk“ (Stück je Packung).
// Ganze Zahlen unter 20 ohne Einheit gelten als Stück, ab 20 als Gramm, Kommazahlen unter 20 als kg.
function packParse(S, a, txt) {
  const t = String(txt || '').trim().toLowerCase().replace(/\s+/g, '').replace(/[×*]/g, 'x');
  if (!t) return null;
  const allesStk = /(stk|stück|stueck|st)\.?$/.test(t);
  const jeStkG = a ? num(a.stueckG) : 0;
  const teile = [];
  for (const teil of t.split('+')) {
    const m = /^(?:(\d+)x)?(\d+(?:[.,]\d+)?)(g|kg|stk\.?|stück|stueck|st\.?)?$/.exec(teil);
    if (!m) return { fehler: `„${teil}“ nicht verstanden` };
    const n = m[1] ? +m[1] : 1, z = parseFloat(m[2].replace(',', '.'));
    let eh = (m[3] || '').replace('.', '');
    if (!eh) eh = allesStk ? 'stk' : /[.,]/.test(m[2]) && z < 20 ? 'kg' : z < 20 ? 'stk' : 'g';
    if (!(n > 0) || !(z > 0)) return { fehler: `„${teil}“ nicht verstanden` };
    if (eh === 'kg') teile.push({ n, g: Math.round(z * 1000) });
    else if (eh === 'g') teile.push({ n, g: Math.round(z) });
    else { if (!(jeStkG > 0)) return { fehler: 'Stück nur bei Artikeln mit Stückgewicht – bitte in g angeben' }; teile.push({ n, stk: Math.round(z) }); }
  }
  // gleiche Packungen zusammenfassen (Reihenfolge bleibt)
  const zus = [];
  for (const x of teile) { const y = zus.find(q => q.g === x.g && q.stk === x.stk); if (y) y.n += x.n; else zus.push({ ...x }); }
  const kg = r3(zus.reduce((s, x) => s + x.n * (x.g ? x.g : x.stk * jeStkG) / 1000, 0));
  const stk = zus.reduce((s, x) => s + (x.stk ? x.n * x.stk : 0), 0);
  const packungen = zus.reduce((s, x) => s + x.n, 0);
  const text = zus.map(x => x.g ? `${fmtNum(x.n)} × ${fmtNum(x.g)} g` : `${fmtNum(x.n)} ${x.n === 1 ? 'Packung' : 'Packungen'} à ${fmtNum(x.stk)} Stück`).join(' + ');
  return { teile: zus, kg, stk, packungen, text };
}
const packGilt = (S, a, p) => { if (!p || !p.pack) return null; const r = packParse(S, a, p.pack); return r && !r.fehler && Math.abs(r.kg - num(p.menge)) < 0.006 ? r : null; };
// Portionierung: [{art, anzahl, g, text, kg}]
function portionenOf(S, o) {
  const out = [];
  for (const a of S.artikel) {
    const p = o.pos && o.pos[a.name];
    if (!p) continue;
    const pk = a.beutelG > 0 || a.einheit === 'Stk' ? null : packGilt(S, a, p);
    if (pk) { out.push({ art: a.name, anzahl: pk.packungen, g: pk.teile.length === 1 && pk.teile[0].g ? pk.teile[0].g : null, text: pk.text, kg: pk.kg, pack: true, stk: pk.teile.every(x => x.stk) ? pk.stk : 0 }); continue; }
    if (a.beutelG > 0 && num(p.menge) > 0) {
      out.push({ art: a.name, anzahl: num(p.menge), g: a.beutelG, text: `${fmtNum(p.menge)} × ${fmtNum(a.beutelG)} g`, kg: r3(num(p.menge) * a.beutelG / 1000) });
    } else if (a.einheit !== 'Stk' && num(p.anzahl) > 0) {
      const g = num(p.g);
      const kgG = g > 0 ? g : posStueckG(S, a, p, o);
      out.push({ art: a.name, anzahl: num(p.anzahl), g: g || null, stk: !(g > 0) && !istWade(a, p) ? num(p.anzahl) : 0, text: g > 0 ? `${fmtNum(p.anzahl)} × ${fmtNum(g)} g` : istWade(a, p) ? `${fmtNum(p.anzahl)} ${num(p.anzahl) > 1 ? 'Waden' : 'Wade'} am Stück` : `${fmtNum(p.anzahl)} Stück`, kg: kgG > 0 ? r3(num(p.anzahl) * kgG / 1000) : 0 });
    }
  }
  return out;
}
const portionOf = (S, o, name) => portionenOf(S, o).find(p => p.art === name);
// Vakuum-Artikel – seit 1.8.1 Standard: vakuumiert, außer ausdrücklich abgewählt (vak: false)
const istVak = p => !!p && p.vak !== false;
const vakArtikel = (S, o) => S.artikel.filter(a => { const p = o.pos && o.pos[a.name]; return istVak(p) && qty(S, o, a.name) > 0; }).map(a => a.name);
// Vakuum-Tüten (leer = automatisch)
function tuetenAuto(S, o) {
  let t = 0;
  const std = num(S.settings.tueteJeKg) > 0 ? num(S.settings.tueteJeKg) : 1;
  for (const a of S.artikel) {
    const p = o.pos && o.pos[a.name];
    if (!istVak(p) || !has(p.menge) && !has(p.anzahl)) continue;
    const q = qty(S, o, a.name);
    if (!(q > 0)) continue;
    if (a.beutelG > 0 || a.einheit === 'Stk') t += num(p.menge);
    else if (num(p.anzahl) > 0) t += num(p.anzahl);
    else t += Math.max(1, roundUp(q / std));
  }
  return t;
}
const tueten = (S, o) => has(o.tuetenManuell) ? num(o.tuetenManuell) : tuetenAuto(S, o);
// Ausnahmen vom Standard „vakuumiert“ (seit 2.2 ersetzt das die Tüten-Zählung)
const nichtVak = (S, o) => S.artikel.filter(a => { const p = o.pos && o.pos[a.name]; return p && !istVak(p) && qty(S, o, a.name) > 0 && !istOrgan(a.name); }).map(a => a.name);
// ---------- Preislisten mit „gültig ab“ ----------
// settings.preislisten = [{ ab: 'JJJJ-MM-TT', preise: { Artikel: €/kg }, preisPaketKg, preisVakPaket }]
// Maßgeblich für eine Bestellung ist der Abholtermin ihres Tiers (die Kasse rechnet ab dem Stichtag mit den neuen Preisen).
// artikel.preis und settings.preisPaketKg/preisVakPaket zeigen immer die heute gültige Preisliste (preiseAbgleichen).
const preislisten = S => (Array.isArray(S.settings.preislisten) ? S.settings.preislisten.filter(p => p && /^\d{4}-\d{2}-\d{2}$/.test(p.ab)) : []).slice().sort((a, b) => a.ab.localeCompare(b.ab));
function preislisteAm(S, iso) {
  const l = preislisten(S);
  if (!l.length) return null;
  let r = l[0];
  for (const p of l) if (p.ab <= (iso || todayISO())) r = p;
  return r;
}
// Stichtag einer Bestellung: Abholtermin des Tiers; Warteliste/ohne Termin: Wunschtermin, sonst heute
function preisDatum(S, o) {
  const t = o && o.tier && o.tier !== 'Warteliste' ? tier(S, o.tier) : null;
  if (t && t.abhol) return t.abhol;
  if (o && o.wunsch) return o.wunsch;
  return todayISO();
}
// Genusspaket einzeln gekauft (seit 3.0.7): was der Inhalt zu Einzelpreisen dieser Preisliste kosten würde – gesamt und je kg
function paketEinzelwert(S, pl) {
  let eur = 0;
  for (const p of paketListe(S)) { const a = art(S, p.art); if (a) eur += num(p.anzahl) * paketG(S, p) / 1000 * artPreis(S, a, pl); }
  const kg = paketGewicht(S);
  return { eur, kg, jeKg: kg > 0 ? eur / kg : 0 };
}
const artPreis = (S, a, pl) => pl && pl.preise && has(pl.preise[a.name]) ? num(pl.preise[a.name]) : num(a.preis);
const paketPreisKg = (S, pl) => pl && has(pl.preisPaketKg) ? num(pl.preisPaketKg) : num(S.settings.preisPaketKg);
const vakPreisPaket = (S, pl) => pl && has(pl.preisVakPaket) ? num(pl.preisVakPaket) : num(S.settings.preisVakPaket);
function preiseAbgleichen(S, heute = todayISO()) {
  const pl = preislisteAm(S, heute);
  if (!pl) return;
  for (const a of S.artikel) if (pl.preise && has(pl.preise[a.name])) a.preis = num(pl.preise[a.name]);
  if (has(pl.preisPaketKg)) S.settings.preisPaketKg = num(pl.preisPaketKg);
  if (has(pl.preisVakPaket)) S.settings.preisVakPaket = num(pl.preisVakPaket);
  S.settings.preiseAb = fmtDate(pl.ab);
}
function preislisteAus(S, ab) { return { ab, preise: Object.fromEntries(S.artikel.map(a => [a.name, num(a.preis)])), preisPaketKg: num(S.settings.preisPaketKg), preisVakPaket: num(S.settings.preisVakPaket) }; }
// Abgeholte Bestellungen und Bestellungen archivierter Tiere behalten ihren Schätzpreis (o.preisFest) –
// spätere Preisänderungen verfälschen weder Archiv noch Statistik
function preisFestsetzen(S, o) { delete o.preisFest; o.preisFest = schaetzpreis(S, o); return o.preisFest; }
const preisBleibtFest = (S, o) => (o.status || 'offen') === 'abgeholt' || !!(tier(S, o.tier) || {}).archiv;
// Schätzpreis wie Spalte AC – mit der Preisliste, die am Abholtermin gilt
function schaetzpreis(S, o) {
  if (has(o.preisFest)) return num(o.preisFest);
  const pl = preislisteAm(S, preisDatum(S, o));
  let p = num(o.pakete) * paketGewicht(S) * paketPreisKg(S, pl) + num(o.pakVak) * vakPreisPaket(S, pl);
  // alle Preise in €/kg; Stück-Artikel (Nieren, Herz, Zunge, Bäckle, Ochsenschwanz): Anzahl × Stückgewicht × €/kg
  for (const a of S.artikel) p += kgVon(S, o, a) * artPreis(S, a, pl);
  return r2(p);
}
// Bestelltext wie Spalte AJ
function bestellText(S, o) {
  const t = [];
  if (num(o.pakete) > 0) t.push(`${fmtNum(o.pakete)}x Genusspaket${num(o.pakVak) > 0 ? ` (${fmtNum(o.pakVak)} vakuumiert)` : ''}`);
  for (const a of S.artikel) {
    const q = qty(S, o, a.name);
    if (q > 0) {
      const po = portionOf(S, o, a.name);
      const ochsTxt = a.name === OCHS ? (o.pos[a.name] && o.pos[a.name].amStueck && a.amStueck ? ' (ganz)' : ' (geschnitten)') : '';
      if (po && po.stk > 0) t.push(`${fmtNum(po.stk)} ${a.name} (${po.pack ? po.text + ', ' : ''}ca. ${fmtNum(q, 1)} kg)`); // nach Stück bestellt: Stückzahl vorne
      else t.push(`${fmtNum(q, 3)} ${a.einheit === 'Stk' ? 'Stk' : 'kg'} ${a.name}${po ? ' (' + po.text + ')' : ''}${ochsTxt}`);
    }
  }
  const nv = nichtVak(S, o);
  if (nv.length) t.push(`nicht vakuumieren: ${nv.join(', ')}`);
  return t.join(', ');
}
// Gewicht einer Position in kg (Stück-Artikel über das geschätzte Stückgewicht)
const kgVon = (S, o, a) => a.einheit === 'Stk' ? qty(S, o, a.name) * num(a.stueckG) / 1000 : qty(S, o, a.name);
const einzelKg = (S, o) => S.artikel.reduce((t, a) => t + kgVon(S, o, a), 0);

// Prüfung im Formular (PortionsText / Stückgewicht fehlt)
function formFehler(S, o) {
  const f = [];
  for (const a of S.artikel) {
    if (a.beutelG > 0 || a.einheit === 'Stk') continue;
    const p = o.pos && o.pos[a.name];
    if (!p) continue;
    const m = num(p.menge), an = num(p.anzahl), g = num(p.g);
    if (p.pack) { const r = packParse(S, a, p.pack); if (r && r.fehler) f.push(`${a.name} – Packungen: ${r.fehler} (Beispiele: 2x500+2x700, 1500+1700, 4+4 Stk)`); }
    if (m > 0 && an > 0 && g > 0 && Math.abs(an * g / 1000 - m) > 0.01)
      f.push(`${a.name}: ${fmtNum(an)} × ${fmtNum(g)} g = ${fmtNum(an * g / 1000, 3)} kg, eingetragen sind aber ${fmtNum(m, 3)} kg`);
    if (istWade(a, p) && !(an > 0)) f.push(`${a.name} am Stück (Wade): bitte die Anzahl Waden eintragen`);
    if (!(m > 0) && !(g > 0) && an > 0 && !(posStueckG(S, a, p, o) > 0))
      f.push(`${a.name}: ${fmtNum(an)} Stück, aber kein Stückgewicht in der Preisliste – bitte g je Stück oder Menge in kg eintragen`);
  }
  // Sonderwünsche müssen durch die Bestellung gedeckt sein (die Menge gehört auch rechts in die Bestellung)
  const geprueft = new Set();
  for (const s of (o.sonder || [])) {
    if (!s || !s.art) continue;
    if (s.art === BRATEN && num(s.ganz) > 0 && !s.teil) f.push('Sonderwunsch Braten „ganzes Stück“: bitte das Teilstück wählen');
    const a = art(S, s.art);
    if (!a) { f.push(`Sonderwunsch: Artikel „${s.art}“ unbekannt`); continue; }
    if (geprueft.has(s.art)) continue;
    geprueft.add(s.art);
    const q = qty(S, o, s.art);
    const eh = a.beutelG > 0 ? 'kg' : a.einheit;
    if (!(q > 0)) { f.push(`Sonderwunsch ${s.art}: der Artikel ist in der Bestellung nicht eingetragen – bitte die Menge auch rechts bei „${s.art}“ eintragen`); continue; }
    // eingetragene Sonderwünsche + „am Stück“; ganze Stücke zählen mit ihrem Mindestgewicht
    const L = sonderOf(S, o).filter(x => x.art === s.art), mitGanz = L.some(x => x.ganz);
    const sum = L.reduce((t, x) => t + (x.ganz ? x.ganz * ((ganzStueckKg(S, o.tier, x.art, x.teil) || {}).min || 0) : num(x.menge)), 0);
    if (sum > q + 0.001) {
      const amSt = o.pos && o.pos[s.art] && o.pos[s.art].amStueck && a.amStueck;
      f.push(`Sonderwunsch ${s.art}: ${fmtNum(sum, mitGanz ? 1 : 3)} ${eh} als Sonderfall${mitGanz ? ' (ganze Stücke mit Mindestgewicht)' : ''}, bestellt sind aber nur ${fmtNum(q, 3)} ${eh}` +
        (amSt ? ' („am Stück“ zählt schon die ganze Menge als Sonderfall)' : '') + (mitGanz ? ` – bitte rechts bei „${s.art}“ mindestens ${fmtNum(Math.ceil(sum * 10) / 10, 1)} kg eintragen` : ''));
    }
  }
  if (num(o.pakVak) > num(o.pakete)) f.push('Mehr vakuumierte Pakete als Genusspakete');
  return f;
}

// ---------- Bestellungen allgemein ----------
const sortNr = list => list.slice().sort((a, b) => a.nr - b.nr);
// Reihenfolge innerhalb eines Tiers: „rang“ = Zeitpunkt, zu dem die Bestellung diesem Tier zugeordnet wurde
// (neue Bestellung, Tier geändert, von der Warteliste geholt). Ohne rang gilt die Bestell-Nr.
const rangVon = o => has(o.rang) ? num(o.rang) : num(o.nr);
const ordersOfTier = (S, tierName) => S.bestellungen.filter(o => o.tier === tierName && o.name).sort((a, b) => rangVon(a) - rangVon(b) || a.nr - b.nr);
const nextNr = S => S.bestellungen.reduce((m, o) => Math.max(m, o.nr), 0) + 1;
const nextRang = S => S.bestellungen.reduce((m, o) => Math.max(m, rangVon(o)), 0) + 1;

// ---------- Bestellung teilen ----------
// Zeilen, die man verschieben kann: Pakete + jede Position mit Menge. „einheit“ = Eingabeeinheit beim Verschieben.
function teilZeilen(S, o) {
  // Genusspakete sind nicht teilbar und bleiben immer beim Tier (Vorrang) – sie werden nie verschoben.
  const z = [];
  for (const a of S.artikel) {
    const p = o.pos && o.pos[a.name];
    const q = qty(S, o, a.name);
    if (!p || !(q > 0)) continue;
    const eh = einheitForm(a);
    // eingetragene Sonderwünsche bleiben bei dieser Bestellung → diese Menge muss hier bleiben
    const res = (o.sonder || []).filter(s => s && s.art === a.name).reduce((t, s) => t + num(s.menge), 0);
    let r;
    if (eh === 'kg' && num(p.anzahl) > 0 && !(num(p.menge) > 0)) {
      const g = num(p.g) > 0 ? num(p.g) : 0;
      const jeStk = q / num(p.anzahl);
      r = { key: a.name, text: a.name, bestellt: num(p.anzahl), einheit: g ? `× ${fmtNum(g)} g` : 'Stück', ganz: true, feld: 'anzahl' };
      r.max = res > 0 && jeStk > 0 ? Math.max(0, Math.floor((q - res) / jeStk + 1e-9)) : r.bestellt;
    } else {
      r = { key: a.name, text: a.name, bestellt: num(p.menge), einheit: eh, ganz: eh !== 'kg', feld: 'menge' };
      const resEh = eh === 'Btl' ? res * 1000 / a.beutelG : res;
      r.max = Math.max(0, r.bestellt - resEh);
      if (r.ganz) r.max = Math.floor(r.max + 1e-9); else r.max = Math.floor(r.max * 10 + 1e-9) / 10;
    }
    if (res > 0) r.sonderRest = `${fmtNum(res, 3)} ${a.einheit === 'Stk' ? 'Stk' : 'kg'} Sonderwunsch bleibt`;
    z.push(r);
  }
  return z;
}
// Fehlmenge je Artikel, die bei dieser Bestellung nicht mehr aus dem Tier kommt (in Eingabeeinheit der Zeile)
function teilFehlmengen(S, o) {
  const t = tier(S, o.tier);
  if (!t) return {};
  const bil = fleischBilanz(S, t, ordersOfTier(S, t.name));
  return Object.assign({}, bil.fehlt[o.nr] || {}); // kg je Artikel, die bei dieser Bestellung fehlen
}
// in Eingabeeinheit umrechnen und sinnvoll runden
function teilRunden(zeile, wert) {
  const v = Math.max(0, Math.min(zeile.max !== undefined ? zeile.max : zeile.bestellt, num(wert)));
  return zeile.ganz ? Math.round(v) : Math.round(v * 10) / 10;
}
function teilVorschlag(S, o, prozent) {
  const z = teilZeilen(S, o), v = {};
  if (prozent === 'fehl') {
    const f = teilFehlmengen(S, o);
    for (const r of z) {
      if (!f[r.key]) { v[r.key] = 0; continue; }
      const q = qty(S, o, r.key);
      const anteil = q > 0 ? f[r.key] / q : 0;
      v[r.key] = r.ganz ? Math.min(r.max, Math.ceil(r.bestellt * anteil - 1e-9)) : Math.min(r.max, Math.ceil(r.bestellt * anteil * 10 - 1e-9) / 10);
    }
  } else for (const r of z) v[r.key] = teilRunden(r, r.bestellt * prozent / 100);
  return v;
}
// führt die Teilung aus: verschiebt die angegebenen Mengen in eine neue Bestellung für „ziel“
function bestellungTeilen(S, o, mengen, ziel) {
  const z = teilZeilen(S, o);
  const neu = { nr: nextNr(S), rang: nextRang(S), eingang: o.eingang, tier: ziel, name: o.name, tel: o.tel, mail: o.mail, weg: o.weg, notiz: `Teil von Nr. ${o.nr}`, packNotiz: o.packNotiz || '', wunsch: '', pakete: 0, pakVak: 0, tuetenManuell: null, pos: {}, sonder: [], endbetrag: null, status: 'offen' };
  let bewegt = 0;
  for (const r of z) {
    const m = teilRunden(r, mengen[r.key]);
    if (!(m > 0)) continue;
    bewegt++;
    if (r.key === '__pakete') {
      neu.pakete = m;
      const bleibt = num(o.pakete) - m;
      neu.pakVak = Math.max(0, num(o.pakVak) - bleibt);
      o.pakVak = Math.min(num(o.pakVak), bleibt);
      o.pakete = bleibt;
      continue;
    }
    const p = o.pos[r.key];
    const np = neu.pos[r.key] = { menge: null, anzahl: null, g: p.g || null, amStueck: !!p.amStueck, vak: istVak(p) };
    if (r.feld === 'anzahl') { np.anzahl = m; p.anzahl = r3(num(p.anzahl) - m); if (!(p.anzahl > 0)) delete o.pos[r.key]; }
    else { np.menge = m; p.menge = r3(num(p.menge) - m); if (!(p.menge > 0)) delete o.pos[r.key]; }
  }
  if (!bewegt) return null;
  o.notiz = ((o.notiz ? o.notiz + ' · ' : '') + `Teil verschoben → Nr. ${neu.nr} (${ziel})`).trim();
  S.bestellungen.push(neu);
  return neu;
}

// ---------- Tiere ----------
const tier = (S, name) => S.tiere.find(t => sameText(t.name, name));
function sgRechnung(S, t) {
  if (num(t.sg) > 0) return num(t.sg);
  return t.typ === 'Bulle' ? num(S.settings.sgBulle) : num(S.settings.sgRind);
}
const yieldArt = (S, t, name) => { if (t && t.glieder) return t.glieder.reduce((s, n) => s + yieldArt(S, tier(S, n), name), 0); const a = art(S, name); return t && a ? sgRechnung(S, t) * anteilVon(S, a, t.typ) : 0; };
// ---------- Topf (seit 3.0): Tiere mit demselben Abholtag laufen als EIN Topf ----------
// Mengencheck über die Summe der Tiere, gemeinsame Kisten (auch gleiche Artikel zusammen), eine Reihenfolge über alle Bestellungen.
// Die Bestellung behält ihr Tier (o.tier) – angezeigt wird „Hanni + Hias“. Archiv/Ausbeute bleiben je Tier.
const TOPF_SEP = ' + ';
function topfAus(S, namen) {
  const gl = namen.map(n => tier(S, n)).filter(Boolean);
  if (gl.length < 2) return gl[0] || null;
  return { name: gl.map(t => t.name).join(TOPF_SEP), glieder: gl.map(t => t.name), topf: true, typ: gl[0].typ, abhol: gl[0].abhol, schlacht: gl[0].schlacht,
    sg: gl.reduce((s, t) => s + sgRechnung(S, t), 0) };
}
function topfTier(S, name) { const t = tier(S, name); if (!t || t.archiv) return t || null; return topfAus(S, abholGruppe(S, t.name)); }
const topfN = t => t && t.glieder ? t.glieder.length : 1;
const ordersOfTopf = (S, t) => !t ? [] : !t.glieder ? ordersOfTier(S, t.name)
  : S.bestellungen.filter(o => o.name && t.glieder.includes(o.tier)).sort((a, b) => rangVon(a) - rangVon(b) || a.nr - b.nr);
// Anzeige des Tiers einer Bestellung: bei gemeinsamer Abholung „Hanni + Hias“
const tierAnzeige = (S, name) => { const t = name && name !== 'Warteliste' ? topfTier(S, name) : null; return t ? t.name : name || ''; };
const keyNamen = k => String((k && k.tier) || '').split(TOPF_SEP);
function tierInfo(S, t) {
  const fest = t.archiv && t.archivStand ? t.archivStand : null; // Archiv ist Archiv: Werte vom Zeitpunkt des Archivierens
  const sg = fest ? num(fest.sg) : sgRechnung(S, t);
  const paketKg = fest ? num(fest.paketKg) : paketGewicht(S);
  const ords = t.glieder ? ordersOfTopf(S, t) : ordersOfTier(S, t.name);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const checks = t.glieder ? mengencheckT(S, t) : mengencheckTier(S, t.name);
  const reichtNicht = ords.filter(o => (checks[o.nr] || '').startsWith('reicht') && !o.ueberbelegt).length;
  const ueberbelegt = ords.filter(o => (checks[o.nr] || '').startsWith('reicht') && o.ueberbelegt).length;
  const maxPak = fest ? num(fest.maxPak) : maxPakete(S, t);
  return { sg, paketKg, pakete: pak, maxPak, frei: maxPak - pak, anzahl: ords.length, reichtNicht, ueberbelegt };
}
// Wie viele Genusspakete gibt das Tier her? (kleinster Wert über alle Paket-Teilstücke; Hack inkl. Gulasch;
// zusätzlich begrenzt durch „max. Genusspakete je Tier“)
function maxPakete(S, t) {
  let m = (num(S.settings.nenner) > 0 ? num(S.settings.nenner) : 16) * topfN(t);
  for (const a of ausbeuteArtikel(S)) {
    const pk = paketKgArt(S, a.name);
    if (!(pk > 0)) continue;
    const y = yieldArt(S, t, a.name) + (a.name === HACK ? yieldArt(S, t, GULASCH) : 0);
    m = Math.min(m, Math.floor(y / pk + 1e-9));
  }
  return Math.max(0, m);
}
// Fleischbilanz und Zuteilung eines Tiers.
// 1) Genusspakete haben Vorrang: ihre feste Zusammensetzung wird zuerst reserviert.
// 2) Danach bekommen die Einzelartikel ihre Mengen in der Reihenfolge, in der die Bestellungen dem Tier
//    zugeordnet wurden (ordersOfTier).
// 3) Hackfleisch ist „dehnbar“: nicht bestelltes Gulasch (Kamm/Hals) geht ins Hack; reicht das nicht,
//    werden Schulterstücke (Bug) aufgelöst. Braten kommt zuerst aus der Keule, dann aus dem Bug.
function fleischBilanz(S, t, ords) {
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const calc = name => {
    const einzeln = ords.reduce((s, o) => s + qty(S, o, name), 0);
    const separat = ords.reduce((s, o) => s + specSum(S, o, name), 0);
    const ausPak = pak * paketKgArt(S, name);
    return { einzeln, separat, ausPak, bestellt: einzeln + ausPak, ausbeute: yieldArt(S, t, name) };
  };
  const hack = calc(HACK), gul = calc(GULASCH), braten = calc(BRATEN);
  // Hack-Sorten: fettig/mager kommt nicht (ganz) aus dem Hack-Material
  const sorten = ords.reduce((a, o) => { const h = hackSorten(S, o); a.sied += h.sied; a.mager += h.mager; return a; }, { sied: 0, mager: 0 });
  hack.einzeln -= sorten.sied + sorten.mager; hack.separat -= sorten.sied + sorten.mager; hack.bestellt -= sorten.sied + sorten.mager;
  // Gulasch bleibt grundsätzlich Gulasch. Nur wenn KEIN Gulasch einzeln bestellt ist und das Hack nicht reicht,
  // geht Gulasch (Kamm/Hals) ins Hack – so viel wie fehlt; der Paket-Anteil bleibt Gulasch.
  const hackMehr = Math.max(0, hack.bestellt - hack.ausbeute);
  gul.insHack = gul.einzeln <= 0.001 && hackMehr > 0.001 ? Math.min(hackMehr, Math.max(0, gul.ausbeute - gul.ausPak)) : 0;
  gul.vorgabe = Math.max(0, r1(gul.ausbeute - gul.insHack - gul.separat));
  const bugAnteil = bugAnteilVon(S, t.typ);
  braten.bugKg = braten.ausbeute * bugAnteil;
  hack.ausbeuteMitGulasch = hack.ausbeute + gul.insHack;
  // Töpfe nach Abzug der Paket-Anteile
  const topf = {};
  for (const a of ausbeuteArtikel(S)) topf[a.name] = yieldArt(S, t, a.name) - pak * paketKgArt(S, a.name);
  // Paket-Anteil kommt anteilig aus Keule und Bug
  let bug = topf[BRATEN] === undefined || !(braten.ausbeute > 0) ? 0 : braten.bugKg * Math.max(0, topf[BRATEN]) / braten.ausbeute;
  let keule = Math.max(0, topf[BRATEN] || 0) - bug;
  let hackTopf = (topf[HACK] || 0) + gul.insHack;
  if (topf[GULASCH] !== undefined) topf[GULASCH] -= gul.insHack;
  let bugInsHack = 0, bugFuerBraten = 0, bugMager = 0;
  const fehlt = {}, pakUeber = {};
  // reicht ein Teilstück nicht einmal für alle Pakete: die zuletzt zugeordneten Paket-Bestellungen markieren
  const pakFehlt = {};
  for (const a of ausbeuteArtikel(S)) {
    const pk = paketKgArt(S, a.name); if (!(pk > 0)) continue;
    const y = yieldArt(S, t, a.name) + (a.name === HACK ? yieldArt(S, t, GULASCH) + braten.bugKg : 0);
    let c = 0;
    for (const o of ords) { c += num(o.pakete) * pk; if (num(o.pakete) > 0 && c > y + 0.001) (pakFehlt[o.nr] = pakFehlt[o.nr] || []).push(a.name); }
  }
  for (const k of Object.keys(topf)) topf[k] = Math.max(0, topf[k]);
  let pakCum = 0;
  const nen = (num(S.settings.nenner) > 0 ? num(S.settings.nenner) : 16) * topfN(t);
  for (const o of ords) {
    const f = {};
    pakCum += num(o.pakete);
    if (num(o.pakete) > 0 && pakCum > nen + 1e-9) pakUeber[o.nr] = ['mehr als ' + nen];
    if (pakFehlt[o.nr]) pakUeber[o.nr] = (pakUeber[o.nr] || []).concat(pakFehlt[o.nr]);
    // mageres Hack: reines Bugstück – kommt zuerst aus dem Bug
    const hs = hackSorten(S, o);
    if (hs.mager > 0) { const b = Math.min(hs.mager, Math.max(0, bug)); bug -= b; bugMager += b; if (hs.mager - b > 0.001) f[HACK] = (f[HACK] || 0) + hs.mager - b; }
    // Braten ausdrücklich aus dem Bug (Teilstück-Wunsch): kommt aus dem Bug, nicht aus der Keule
    let bratenBug = 0;
    const bw = Math.min(bugWunsch(S, o), qty(S, o, BRATEN));
    if (bw > 0) { bratenBug = Math.min(bw, Math.max(0, bug)); bug -= bratenBug; bugFuerBraten += bratenBug; }
    for (const name of Object.keys(topf)) {
      let q = qty(S, o, name) + (name === HACK ? -(hs.sied + hs.mager) : name === SIED ? hs.sied : 0);
      if (!(q > 0)) continue;
      if (name === HACK) {
        const a = Math.min(q, Math.max(0, hackTopf)); hackTopf -= a; q -= a;
        const b = Math.min(q, Math.max(0, bug)); bug -= b; bugInsHack += b; q -= b;
      } else if (name === BRATEN) {
        q -= bratenBug;
        const a = Math.min(q, Math.max(0, keule)); keule -= a; q -= a;
        const b = Math.min(q, Math.max(0, bug)); bug -= b; bugFuerBraten += b; q -= b;
      } else {
        const a = Math.min(q, Math.max(0, topf[name])); topf[name] -= a; q -= a;
      }
      if (q > 0.001) f[name] = (f[name] || 0) + q;
    }
    fehlt[o.nr] = f;
  }
  hack.ausBug = bugInsHack;
  hack.ueberAusbeute = bugInsHack > 0.001;
  braten.bugFuerBraten = bugFuerBraten;
  braten.bugMager = bugMager; // Bug für mageres Hack (Sonderfall)
  hack.fettSied = sorten.sied; // Siedfleisch für fettiges Hack (Sonderfall)
  // Obergrenzen (für die Anzeige in der Mengenprüfung)
  const kap = {};
  kap[HACK] = hack.ausbeuteMitGulasch + braten.bugKg - bugFuerBraten - bugMager;
  kap[BRATEN] = braten.ausbeute - bugInsHack;
  return { hack, gul, braten, kap, fehlt, pakUeber };
}
// Archiv ist Archiv: beim Archivieren Mengencheck, Pakete und Plan-Ausbeute festhalten – danach wird nichts mehr nachgerechnet
// (sonst würden alte Bestellungen mit der späteren Ausbeute-Statistik nachträglich „reicht nicht“ zeigen)
function archivStandFesthalten(S, t) {
  const a0 = t.archiv, s0 = t.archivStand;
  t.archiv = null; t.archivStand = null;
  try {
    for (const o of ordersOfTier(S, t.name)) if (!has(o.preisFest)) preisFestsetzen(S, o);
    t.archivStand = { checks: mengencheckTier(S, t.name), maxPak: maxPakete(S, t), paketKg: r2(paketGewicht(S)), sg: sgRechnung(S, t),
      plan: Object.fromEntries(ausbeuteArtikel(S).map(a => [a.name, r2(yieldArt(S, t, a.name))])) };
  } catch (e) { t.archivStand = s0 || null; }
  t.archiv = a0;
  return t.archivStand;
}
const kapazitaet = (S, t, bil, name) => bil.kap[name] !== undefined ? bil.kap[name] : yieldArt(S, t, name);

// Mengencheck aller Bestellungen eines Tiers: {nr: text}
function mengencheckTier(S, tierName) {
  const t = tier(S, tierName);
  const out = {};
  if (!t) return out;
  if (t.archiv && t.archivStand && t.archivStand.checks) { for (const o of ordersOfTier(S, t.name)) out[o.nr] = t.archivStand.checks[o.nr] || 'ok'; return out; }
  return mengencheckT(S, topfTier(S, t.name) || t);
}
// Mengencheck eines Tiers oder Topfs (t real oder virtuell)
function mengencheckT(S, t) {
  const out = {};
  const ords = ordersOfTopf(S, t);
  const bil = fleischBilanz(S, t, ords), gw = ganzWunschFehlt(S, t, ords);
  const maxW = (has(S.settings.maxWaden) ? num(S.settings.maxWaden) : 4) * topfN(t);
  let waden = 0;
  for (const o of ords) {
    const f = Object.keys(bil.fehlt[o.nr] || {});
    if (gw[o.nr]) f.push(...gw[o.nr]);
    const pw = o.pos && o.pos[BEIN], w = istWade(art(S, BEIN), pw) ? num(pw.anzahl) : 0;
    waden += w;
    if (w > 0 && waden > maxW) f.push(`Wade am Stück (max. ${maxW}${t.glieder ? ' bei ' + t.name : ' je Tier'})`);
    if (bil.pakUeber[o.nr]) f.unshift('Genusspakete (' + bil.pakUeber[o.nr].join(', ') + ')');
    const fk = bil.fehlt[o.nr] || {};
    out[o.nr] = f.length ? 'reicht nicht: ' + f.map(n => fk[n] > 0 ? `${n} −${fehlKgText(fk[n])}` : n).join(', ') : 'ok';
  }
  return out;
}
// Fehlmenge als Text: unter 1 kg auf 0,05 kg genau, sonst 0,1 kg
const fehlKgText = kg => fmtNum(kg < 1 ? Math.max(0.05, Math.round(kg * 20) / 20) : Math.round(kg * 10) / 10, 2) + ' kg';
// Fehlmengen einer Bestellung im Detail – auch für das offene Formular (o = Formular-Kopie, ersetzt die gespeicherte Fassung).
// Je Artikel: bestellt / verfügbar / fehlt in kg, dazu Stück bzw. Beutel und der Wert, auf den man kürzen könnte.
function fehlDetail(S, o) {
  const t0 = o && o.tier && o.tier !== 'Warteliste' ? tier(S, o.tier) : null;
  if (!t0 || t0.archiv) return null;
  const t = topfTier(S, t0.name) || t0, gl = t.glieder || [t0.name];
  const key = o.nr || -1;
  const kopie = Object.assign({}, o, { nr: key, tier: t0.name });
  const alt = o.nr ? S.bestellungen.find(x => x.nr === o.nr) : null;
  kopie.rang = alt && gl.some(n => sameText(alt.tier, n)) ? rangVon(alt) : 1e12; // neu oder Tier/Topf gewechselt → hinten anstellen
  const ords = S.bestellungen.filter(x => x.name && gl.some(n => sameText(x.tier, n)) && x.nr !== o.nr).concat([kopie])
    .sort((a, b) => rangVon(a) - rangVon(b) || a.nr - b.nr);
  const bil = fleischBilanz(S, t, ords);
  const f = bil.fehlt[key] || {};
  const zeilen = [];
  for (const r of teilZeilen(S, kopie)) {
    const fe0 = f[r.key];
    if (!(fe0 > 0.001)) continue;
    const a = art(S, r.key), p = kopie.pos[r.key];
    const q = qty(S, kopie, r.key), fe = Math.min(q, fe0), v = Math.max(0, q - fe);
    const z = { art: r.key, bestelltKg: q, fehltKg: fe, verfuegbarKg: v, feld: r.feld };
    if (r.feld === 'anzahl') {
      const je = q / num(p.anzahl);
      z.stkBestellt = num(p.anzahl); z.stkVerf = je > 0 ? Math.floor(v / je + 1e-9) : 0; z.neu = z.stkVerf;
      z.stkText = num(p.g) > 0 ? `× ${fmtNum(p.g)} g` : 'Stück';
    } else if (num(a.beutelG) > 0) {
      const je = a.beutelG / 1000;
      z.btlBestellt = num(p.menge); z.btlVerf = Math.floor(v / je + 1e-9); z.neu = z.btlVerf;
    } else z.neu = Math.floor(v * 10 + 1e-9) / 10;
    zeilen.push(z);
  }
  const sonst = [];
  // Fehlmengen ohne eigene Zeile (z. B. Siedfleisch für fettiges Hack)
  for (const [k, fe] of Object.entries(f)) if (fe > 0.001 && !zeilen.some(z => z.art === k)) sonst.push(`${k} −${fmtNum(fe, 1)} kg${k === SIED ? ' (für fettiges Hack)' : ''}`);
  if (bil.pakUeber[key]) sonst.push('Genusspakete (' + bil.pakUeber[key].join(', ') + ')');
  sonst.push(...(ganzWunschFehlt(S, t, ords)[key] || []));
  const maxW = (has(S.settings.maxWaden) ? num(S.settings.maxWaden) : 4) * topfN(t);
  let waden = 0;
  for (const x of ords) {
    const pw = x.pos && x.pos[BEIN], w = istWade(art(S, BEIN), pw) ? num(pw.anzahl) : 0;
    waden += w;
    if (x === kopie && w > 0 && waden > maxW) sonst.push(`Wade am Stück (max. ${maxW}${t.glieder ? ' bei ' + t.name : ' je Tier'}, davor schon ${waden - w})`);
  }
  return { tier: t.name, zeilen, sonst, ok: !zeilen.length && !sonst.length };
}
function mengencheck(S, o) {
  if (!o.name || !o.tier) return '';
  if (o.tier === 'Warteliste') return 'Warteliste – noch kein Tier';
  if (!tier(S, o.tier)) return 'Tier unbekannt';
  return mengencheckTier(S, o.tier)[o.nr] || '';
}
// TierVorschlag: Wunschtermin leer = frühestes Tier ab heute, gesetzt = letztes Tier mit Abholung vor/an dem Wunschtermin.
// Bevorzugt wird ein Tier, bei dem die GANZE Bestellung „ok“ ist; passt keins, das erste mit genug freien Paketen.
function tierVorschlag(S, wunschISO, pakete, ohneNr, best0) {
  const heute = todayISO();
  const pk = num(pakete);
  const nen = num(S.settings.nenner) || 16;
  const kand = S.tiere.filter(t => {
    if (t.archiv) return false;
    if (!t.abhol || t.abhol < heute) return false;
    if (wunschISO && t.abhol > wunschISO) return false;
    // wie beim Neu-Verteilen: höchstens … Tage vor dem Wunschtermin, sonst Warteliste
    if (wunschISO && tageZwischen(t.abhol, wunschISO) > (has(S.settings.verteilenMaxTage) && num(S.settings.verteilenMaxTage) >= 0 ? num(S.settings.verteilenMaxTage) : 5)) return false;
    if (pk > 0) {
      const T = topfTier(S, t.name) || t, gl = T.glieder || [t.name];
      const bestellt = S.bestellungen.filter(o => gl.includes(o.tier) && o.name && o.nr !== ohneNr).reduce((s, o) => s + num(o.pakete), 0);
      if (maxPakete(S, T) - bestellt < pk) return false;
    }
    return true;
  }).sort((a, b) => wunschISO ? b.abhol.localeCompare(a.abhol) : a.abhol.localeCompare(b.abhol));
  if (!kand.length) return 'Warteliste';
  if (best0) {
    const passt = kand.find(t => {
      const alt = S.bestellungen.find(x => x.nr === ohneNr && x.nr);
      const probe = Object.assign({}, best0, { nr: ohneNr || -1, name: best0.name || '?', tier: t.name,
        rang: alt && alt.tier === t.name ? rangVon(alt) : nextRang(S) });
      const T = Object.assign({}, S, { bestellungen: S.bestellungen.filter(x => x.nr !== probe.nr).concat([probe]) });
      const vor = mengencheckTier(S, t.name), nach = mengencheckTier(T, t.name);
      // die ganze Bestellung passt UND keine andere Bestellung des Tiers kippt dadurch (Genusspakete haben Vorrang)
      return nach[probe.nr] === 'ok' && !Object.keys(nach).some(nr => +nr !== probe.nr && vor[nr] === 'ok' && nach[nr] !== 'ok');
    });
    if (passt) return passt.name;
  }
  return kand[0].name;
}
// ---------- Offene Bestellungen neu verteilen ----------
// Wenn Tiere dazukommen (oder sich Termine ändern): alle offenen Bestellungen, deren Tier noch keine Kisten hat
// (dazu die Warteliste), in Eingangsreihenfolge neu auf die Tiere ohne Kisten verteilen – jeweils das erste Tier
// (bzw. mit Wunschtermin das letzte davor), bei dem die ganze Bestellung reicht und keine andere kippt.
// Fest bleiben: gepackte/abgeholte Bestellungen, Tiere mit Kistenplan, bewusst überbelegte Bestellungen.
// Passt eine Bestellung nirgends, bleibt sie, wo sie war. Ergebnis nur als Vorschlag (S bleibt unverändert).
const tageZwischen = (von, bis) => Math.round((new Date(bis + 'T12:00:00') - new Date(von + 'T12:00:00')) / 864e5);
function neuVerteilenPlan(S, fest) {
  const heute = todayISO();
  const maxTage = has(S.settings.verteilenMaxTage) && num(S.settings.verteilenMaxTage) >= 0 ? num(S.settings.verteilenMaxTage) : 5;
  const T = JSON.parse(JSON.stringify(S));
  // fest sind nur Tiere, deren Kisten schon gewogen werden (beim Metzger abgeholt); ein bloßer Kistenplan wird danach neu berechnet
  const mitKisten = new Set((T.kisten || []).filter(k => kisteGewogen(k)).flatMap(keyNamen));
  for (const t of T.tiere || []) if (!t.archiv && kistenRows(T, t.name).length && kommissionierBegonnen(T, [t.name])) mitKisten.add(t.name); // Kommissionieren läuft → fest
  const mitPlan = new Set((T.kisten || []).flatMap(keyNamen).filter(n => !mitKisten.has(n)));
  const freiesTier = t => !!t && !t.archiv && !mitKisten.has(t.name);
  const beweglich = o => o.name && (o.status || 'offen') === 'offen' && !o.ueberbelegt && !(fest && fest.has(o.nr)) &&
    (o.tier === 'Warteliste' || !o.tier || freiesTier(tier(T, o.tier)));
  const bew = T.bestellungen.filter(beweglich)
    .sort((a, b) => String(a.eingang || '').localeCompare(String(b.eingang || '')) || a.nr - b.nr);
  const vorher = new Map(bew.map(o => [o.nr, { tier: o.tier || 'Warteliste', check: o.tier && o.tier !== 'Warteliste' ? mengencheck(S, S.bestellungen.find(x => x.nr === o.nr)) : '' }]));
  const ziele = T.tiere.filter(t => freiesTier(t) && t.abhol && t.abhol >= heute);
  bew.forEach(o => { o.tier = '\u0000neu'; });
  for (const o of bew) {
    const pk = num(o.pakete);
    const kand = ziele.filter(t => {
      if (o.wunsch && t.abhol > o.wunsch) return false;
      if (o.wunsch && tageZwischen(t.abhol, o.wunsch) > maxTage) return false; // höchstens … Tage vor dem Wunschtermin
      if (pk > 0) {
        const TT = topfTier(T, t.name) || t, gl = TT.glieder || [t.name];
        const bestellt = T.bestellungen.filter(x => gl.includes(x.tier) && x.name).reduce((s, x) => s + num(x.pakete), 0);
        if (maxPakete(T, TT) - bestellt < pk) return false;
      }
      return true;
    }).sort((a, b) => o.wunsch ? b.abhol.localeCompare(a.abhol) : a.abhol.localeCompare(b.abhol));
    let ziel = null;
    for (const t of kand) {
      const vor = mengencheckTier(T, t.name);
      o.tier = t.name; o.rang = nextRang(T);
      const nach = mengencheckTier(T, t.name);
      if (nach[o.nr] === 'ok' && !Object.keys(nach).some(nr => +nr !== o.nr && vor[nr] === 'ok' && nach[nr] !== 'ok')) { ziel = t.name; break; }
    }
    // kein Tier im Zeitfenster vor dem Wunschtermin → Warteliste; sonst (passt nirgends ganz) bleibt sie, wo sie war
    if (!ziel) { o.tier = o.wunsch && !kand.length ? 'Warteliste' : vorher.get(o.nr).tier; o.rang = nextRang(T); }
  }
  const zeilen = bew.map(o => {
    const v = vorher.get(o.nr);
    return { nr: o.nr, name: o.name, eingang: o.eingang, von: v.tier, nach: o.tier, rang: o.rang, checkVorher: v.check,
      check: o.tier === 'Warteliste' ? '' : mengencheck(T, o) };
  });
  const wechsel = zeilen.filter(z => !sameText(z.von, z.nach));
  // Kistenpläne (ungewogen), die durch das Verteilen nicht mehr stimmen
  const betroffen = new Set(wechsel.flatMap(z => [z.von, z.nach]));
  const planNeu = [...mitPlan].filter(n => tier(S, n) && !tier(S, n).archiv && (betroffen.has(n) || kistenplanVeraltet(S, n)));
  return { zeilen, wechsel, maxTage, festTiere: [...mitKisten].filter(n => tier(S, n) && !tier(S, n).archiv), planNeu };
}
// nach dem Verteilen: betroffene ungewogene Kistenpläne neu berechnen (bzw. zurücksetzen, wenn das Tier keine Bestellungen mehr hat)
function kistenplaeneAktualisieren(S, namen) {
  const neu = [], weg = [];
  // alle betroffenen Tiere samt ihrer alten und neuen Abholgruppe einsammeln (nur ungewogene)
  const alle = new Set();
  for (const n of namen) { abholGruppe(S, n).forEach(x => alle.add(x)); (((S.packplaene || {})[n] || {}).tiere || []).forEach(x => alle.add(x)); alle.add(n); }
  const liste = [...alle].filter(x => tier(S, x) && !tier(S, x).archiv && !kistenGewogenAnzahl(S, [x]) && !kommissionierBegonnen(S, [x]) && kistenRows(S, x).length || namen.includes(x));
  const erledigt = new Set();
  for (const n of liste) {
    if (erledigt.has(n)) continue;
    const g = abholGruppe(S, n);
    if (kistenGewogenAnzahl(S, g) || kommissionierBegonnen(S, g)) { g.forEach(x => erledigt.add(x)); continue; }
    g.forEach(x => erledigt.add(x));
    kistenZuruecksetzen(S, g);
    if (!g.some(x => ordersOfTier(S, x).length)) { weg.push(g.join(' + ')); continue; }
    const pp = packplanGruppe(S, g);
    if (pp.fehler) { weg.push(g.join(' + ')); continue; }
    (pp.tiere || []).forEach(x => { S.packplaene[x] = pp; }); packplanUebernehmen(S, pp); neu.push(pp.tier + ' (' + pp.kisten.length + ' Kisten)');
  }
  return { neu, weg };
}
function neuVerteilenUebernehmen(S, plan) {
  for (const z of plan.zeilen) { const o = S.bestellungen.find(x => x.nr === z.nr); if (o) { o.tier = z.nach; o.rang = z.rang; } }
}
function wartelistePassend(S, t) {
  if (!t.abhol || t.abhol < todayISO()) return [];
  return S.bestellungen.filter(o => o.tier === 'Warteliste' && o.name && (!o.wunsch || t.abhol <= o.wunsch));
}
// ---------- Prüfliste Warteliste ----------
// Alle Bestellungen auf der Warteliste zusammengezählt und probeweise einem Rind und einem Bullen
// (Standard-Schlachtgewicht) zugeordnet – als Entscheidungshilfe: schlachten ja/nein, Rind oder Bulle.
function wartelistePruefung(S) {
  const ords = S.bestellungen.filter(o => o.tier === 'Warteliste' && o.name).sort((a, b) => rangVon(a) - rangVon(b) || a.nr - b.nr);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const schwelle = has(S.settings.wlSchwelle) && num(S.settings.wlSchwelle) > 0 ? num(S.settings.wlSchwelle) : 60;
  const wuensche = ords.map(o => o.wunsch).filter(Boolean).sort();
  // Probe-Tiere
  const sim = typ => {
    const t = { name: '\u0000Probe ' + typ, typ, sg: null };
    const T = Object.assign({}, S, { tiere: S.tiere.concat([t]), bestellungen: S.bestellungen.filter(o => o.tier !== 'Warteliste').concat(ords.map(o => Object.assign({}, o, { tier: t.name }))) });
    const ch = mengencheckTier(T, t.name);
    const bil = fleischBilanz(T, t, ordersOfTier(T, t.name));
    const nicht = ords.filter(o => (ch[o.nr] || '').startsWith('reicht'));
    const engpass = {};
    for (const o of nicht) {
      if (bil.pakUeber[o.nr]) engpass['Genusspakete'] = (engpass['Genusspakete'] || 0) + 1;
      for (const k of Object.keys(bil.fehlt[o.nr] || {})) engpass[k] = (engpass[k] || 0) + 1;
      if (/Wade/.test(ch[o.nr])) engpass['Waden am Stück'] = (engpass['Waden am Stück'] || 0) + 1;
    }
    // verkauft = je Artikel höchstens die Ausbeute; Hack darf sich aus übrigem Gulasch und Bug bedienen
    let ausbeute = 0;
    const best = {}, y = {};
    for (const a of ausbeuteArtikel(S)) {
      y[a.name] = yieldArt(S, t, a.name); ausbeute += y[a.name];
      best[a.name] = ords.reduce((s, o) => s + qty(S, o, a.name), 0) + pak * paketKgArt(S, a.name);
    }
    let verkauft = 0;
    for (const k in y) verkauft += Math.min(best[k], y[k]);
    const v = k => y[k] || 0, bq = k => best[k] || 0;
    const hackMehr = Math.max(0, bq(HACK) - v(HACK));
    const frei = Math.max(0, v(GULASCH) - bq(GULASCH)) + Math.min(v(BRATEN) * bugAnteilVon(S, typ), Math.max(0, v(BRATEN) - bq(BRATEN)));
    verkauft = Math.min(ausbeute, verkauft + Math.min(hackMehr, frei));
    return { typ, t, sg: sgRechnung(S, t), maxPak: maxPakete(S, t), ok: ords.length - nicht.length, nicht: nicht.map(o => o.nr), engpass,
      ausbeute, verkauft, auslastung: ausbeute > 0 ? verkauft / ausbeute : 0, rest: Math.max(0, ausbeute - verkauft) };
  };
  const R = sim('Rind'), B = sim('Bulle');
  // Mengen je Artikel
  const vorhStk = { Nieren: num(S.settings.nierenStk), Herz: num(S.settings.herzStk), Zunge: num(S.settings.zungeStk), 'Bäckle': has(S.settings.baeckleStk) ? num(S.settings.baeckleStk) : 2, [OCHS]: has(S.settings.ochsStk) ? num(S.settings.ochsStk) : 1, Leber: num(S.settings.leberKg) };
  const rows = [];
  for (const a of S.artikel) {
    const einzeln = ords.reduce((s, o) => s + qty(S, o, a.name), 0);
    const ausPak = pak * paketKgArt(S, a.name);
    const ges = einzeln + ausPak;
    if (!(ges > 0.0001)) continue;
    const mitAusbeute = ausbeuteArtikel(S).some(x => x.name === a.name);
    const kap = x => {
      if (!mitAusbeute) return has(vorhStk[a.name]) ? vorhStk[a.name] : null;
      const y = yieldArt(S, x.t, a.name);
      // Hack ist dehnbar: Gulasch (Kamm/Hals) und Bug können dazukommen
      return { y, max: a.name === HACK ? y + yieldArt(S, x.t, GULASCH) + yieldArt(S, x.t, BRATEN) * bugAnteilVon(S, x.typ) : y };
    };
    const kr = kap(R), kb = kap(B);
    const yR = kr === null ? null : typeof kr === 'object' ? kr.y : kr, yB = kb === null ? null : typeof kb === 'object' ? kb.y : kb;
    const mR = kr === null ? null : typeof kr === 'object' ? kr.max : kr, mB = kb === null ? null : typeof kb === 'object' ? kb.max : kb;
    const status = mR === null ? '' : ges <= mR + 0.001 ? 'passt bei Rind' : mB !== null && ges <= mB + 0.001 ? 'nur beim Bullen' : 'zu viel für 1 Tier';
    rows.push({ art: a.name, einheit: a.einheit === 'Stk' ? 'Stk' : 'kg', einzeln, ausPak, gesamt: ges, rind: yR, bulle: yB, dehnbar: a.name === HACK, status, organ: !mitAusbeute, rindMax: mR, bulleMax: mB });
  }
  const kgGesamt = ords.reduce((s, o) => s + S.artikel.reduce((t, a) => t + kgVon(S, o, a), 0), 0) + pak * paketGewicht(S);
  // Empfehlung
  const emp = [];
  let wahl = null;
  if (!ords.length) emp.push('Keine offenen Bestellungen auf der Warteliste.');
  else {
    const passtR = R.ok === ords.length, passtB = B.ok === ords.length;
    wahl = passtR ? R : passtB ? B : (B.ok > R.ok || (B.ok === R.ok && B.auslastung > R.auslastung)) ? B : R;
    const pz = x => fmtNum(x.auslastung * 100, 0) + ' %';
    const dat = x => x.typ === 'Bulle' ? 'Bullen' : 'Rind';
    const eng = x => Object.entries(x.engpass).sort((a, b) => b[1] - a[1]).map(e => e[0]).join(', ');
    if (passtR && passtB) emp.push(`Rind reicht für alle ${ords.length} Bestellungen (verkauft ca. ${pz(R)} der Ausbeute, Bulle nur ${pz(B)}) – ein Rind ist besser ausgelastet.`);
    else if (passtB) emp.push(`Ein Rind reicht nicht für alle Bestellungen (${R.nicht.length} würden nicht passen – Engpass: ${eng(R)}). Ein Bulle reicht für alle – verkauft ca. ${pz(B)} der Ausbeute.`);
    else {
      emp.push(`Selbst ein Bulle reicht nicht für alle Bestellungen (${B.nicht.length} passen nicht – Engpass: ${eng(B)}). Bei einem ${dat(wahl)} passen ${wahl.ok} von ${ords.length}.`);
      // grob: wie viele Tiere bräuchte die ganze Warteliste?
      const n = typ => { const x = typ === 'Rind' ? R : B; let m = x.maxPak > 0 ? pak / x.maxPak : (pak > 0 ? 99 : 0);
        for (const r of rows) { const y = typ === 'Rind' ? r.rindMax : r.bulleMax; if (y > 0) m = Math.max(m, r.gesamt / y); } return Math.ceil(m - 1e-9); };
      emp.push(`Für die ganze Warteliste bräuchte es rechnerisch ca. ${n('Bulle')} Bullen oder ${n('Rind')} Rinder – sonst einen Teil auf ein späteres Tier legen oder mit den Kunden sprechen.`);
    }
    const ziel = x => x.auslastung * 100 >= schwelle;
    // Bulle nötig für alle, aber erst ein Rind lohnt sich: Rind schlachten, Rest bleibt auf der Warteliste
    if (wahl === B && !ziel(B) && ziel(R) && R.ok > 0) {
      emp.push(`Empfehlung: schlachten – Rind. Damit sind ca. ${pz(R)} verkauft (${fmtNum(R.verkauft, 0)} von ${fmtNum(R.ausbeute, 0)} kg); ${R.nicht.length} Bestellung${R.nicht.length === 1 ? '' : 'en'} (Nr. ${R.nicht.join(', ')}) bleiben auf der Warteliste fürs nächste Tier. Ein Bulle wäre nur zu ${pz(B)} verkauft.`);
      wahl = R;
    } else if (ziel(wahl)) emp.push(`Empfehlung: schlachten – ${wahl.typ}. Ca. ${fmtNum(wahl.verkauft, 0)} kg von ${fmtNum(wahl.ausbeute, 0)} kg sind verkauft, ca. ${fmtNum(wahl.rest, 0)} kg gehen in den Hofladen.`);
    else {
      emp.push(`Empfehlung: noch warten. Bei einem ${dat(wahl)} wären erst ca. ${pz(wahl)} verkauft (Ziel ab ${fmtNum(schwelle)} %) – ca. ${fmtNum(wahl.rest, 0)} kg müssten über den Hofladen gehen.`);
      if (wahl === B && R.auslastung > B.auslastung) emp.push(`Zum Vergleich: ein Rind wäre zu ${pz(R)} verkauft, dann passen aber nur ${R.ok} von ${ords.length} Bestellungen.`);
    }
    const pFrei = wahl.maxPak - pak;
    if (pFrei > 0) emp.push(`Beim ${dat(wahl)} wären noch ca. ${fmtNum(pFrei)} Genusspakete frei.`);
    else if (pFrei < 0) emp.push(`Achtung: ${fmtNum(pak)} Genusspakete bestellt, ein ${wahl.typ} gibt nur ca. ${fmtNum(wahl.maxPak)} her.`);
    if (wuensche.length) emp.push(`Frühester Wunschtermin: ${fmtDate(wuensche[0])}.`);
    const heute = todayISO();
    const geplant = S.tiere.filter(t => !t.archiv && t.abhol && t.abhol >= heute).map(t => ({ t, n: wartelistePassend(S, t).length })).filter(x => x.n > 0);
    if (geplant.length) emp.push(`Schon geplant: ${geplant.map(x => `${x.t.name} (Abholung ${fmtDate(x.t.abhol)}, ${x.n} Bestellung${x.n === 1 ? '' : 'en'} würden passen)`).join('; ')} – erst prüfen, ob die Warteliste dort Platz hat.`);
  }
  return { anzahl: ords.length, pakete: pak, kgGesamt, rows, rind: R, bulle: B, wahl: wahl ? wahl.typ : '', emp, schwelle, ords };
}
function tierUmbenennen(S, alt, neu) {
  S.bestellungen.forEach(o => { if (o.tier === alt) o.tier = neu; });
  S.kisten.forEach(k => { if (k.tier === alt) k.tier = neu; });
  if (S.metzgerManuell[alt]) { S.metzgerManuell[neu] = S.metzgerManuell[alt]; delete S.metzgerManuell[alt]; }
  if (S.packplaene[alt]) { S.packplaene[neu] = S.packplaene[alt]; S.packplaene[neu].tier = neu; delete S.packplaene[alt]; }
}

// ---------- Kunden ----------
function kundePflegen(S, name, tel, mail, eingang) {
  name = String(name || '').trim();
  if (!name || sameText(name, ANONYM)) return false;
  const k = S.kunden.find(x => sameText(x.name, name));
  if (k) {
    if (!k.tel && tel) k.tel = tel;
    if (!k.mail && mail) k.mail = mail;
    if (eingang && eingang > (k.letzte || '')) k.letzte = eingang;
    return false;
  }
  S.kunden.push({ nr: S.kunden.reduce((m, x) => Math.max(m, x.nr), 0) + 1, name, tel: tel || '', mail: mail || '', notiz: '', angelegt: todayISO(), letzte: eingang || '' });
  return true;
}
// Kunden-Vorschläge fürs Namensfeld: jedes getippte Wort muss einen Namensteil anfangen (Groß/klein, Umlaute egal);
// ab 3 Ziffern wird auch die Telefonnummer durchsucht. Sortierung: Name beginnt mit Eingabe, dann viele Bestellungen, dann Alphabet.
function kundenVorschlaege(S, q, max = 8) {
  const n1 = s => String(s || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
  const n2 = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss');
  const woerter = s => s.split(/[\s,;.\-\/()]+/).filter(Boolean);
  const roh = String(q || '').trim();
  if (!roh) return [];
  const ziffern = roh.replace(/\D/g, '');
  const treffer = [];
  for (const k of S.kunden || []) {
    if (sameText(k.name, roh)) continue; // genau dieser Name steht schon im Feld
    let ok = false, start = false;
    for (const n of [n1, n2]) {
      const qw = woerter(n(roh)), nw = woerter(n(k.name));
      if (qw.length && qw.every(w => nw.some(x => x.startsWith(w)))) { ok = true; if (n(k.name).startsWith(n(roh))) start = true; }
    }
    if (!ok && ziffern.length >= 3 && /^[\d\s\/+\-()]+$/.test(roh) && String(k.tel || '').replace(/\D/g, '').includes(ziffern)) ok = true;
    if (!ok) continue;
    const os = (S.bestellungen || []).filter(o => sameText(o.name, k.name));
    treffer.push({ k, start, anzahl: os.length, letzteNr: os.reduce((m, o) => Math.max(m, num(o.nr)), 0) || null });
  }
  return treffer.sort((a, b) => (b.start - a.start) || (b.anzahl - a.anzahl) || a.k.name.localeCompare(b.k.name, 'de')).slice(0, max);
}
// Bestellungen je Kunde (Name ohne Groß/klein und Leerzeichen am Rand) – für Listen mit vielen Kunden einmal aufbauen
const nameKey = s => String(s || '').trim().toLowerCase();
function bestellIndex(S) {
  const m = new Map();
  for (const o of S.bestellungen || []) { const k = nameKey(o.name); if (!m.has(k)) m.set(k, []); m.get(k).push(o); }
  return m;
}
const ordersVonKunde = (S, k, idx) => idx ? (idx.get(nameKey(k.name)) || []) : (S.bestellungen || []).filter(o => sameText(o.name, k.name));
function kundenStat(S, k, idx) {
  const os = ordersVonKunde(S, k, idx);
  return {
    anzahl: os.length,
    letzte: os.reduce((m, o) => (o.eingang > m ? o.eingang : m), ''),
    pakete: os.reduce((s, o) => s + num(o.pakete), 0),
    umsatz: os.reduce((s, o) => s + num(o.endbetrag), 0)
  };
}

// ---------- Datenschutz: inaktive Kunden anonymisieren ----------
// Maßgeblich ist das letzte Lebenszeichen: letzte Bestellung (wird zusätzlich am Kunden gespeichert, falls Bestellungen gelöscht werden) oder Anlagedatum.
const ANONYM = 'anonymisiert';
function kundeLetzte(S, k, idx) {
  return ordersVonKunde(S, k, idx).reduce((m, o) => (o.eingang || '') > m ? o.eingang : m, k.letzte || k.angelegt || '');
}
function kundenFrist(S) { const j = num(S.settings.kundenFristJahre); return j >= 1 ? Math.round(j) : 3; }
function inaktiveKunden(S, heute = todayISO()) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(heute) || /^(\d{4})-(\d{2})-(\d{2})/.exec(todayISO());
  const grenze = isoOf(new Date(+m[1] - kundenFrist(S), +m[2] - 1, +m[3]));
  const archiviert = n => { const t = (S.tiere || []).find(x => x.name === n); return !!(t && t.archiv); };
  const idx = bestellIndex(S);
  return (S.kunden || []).map(k => ({ k, letzte: kundeLetzte(S, k, idx) }))
    .filter(x => x.letzte && x.letzte < grenze)
    // Bestellungen, die noch laufen (nicht abgeholt, Tier nicht im Archiv), schützen den Kunden
    .filter(x => !ordersVonKunde(S, x.k, idx).some(o => ((o.status || 'offen') !== 'abgeholt' && !archiviert(o.tier)) || zahlungOffen(o)))
    .sort((a, b) => a.letzte.localeCompare(b.letzte));
}
// Kunde aus der Kundenliste löschen; seine Bestellungen bleiben für Statistik und Ausbeute, aber ohne Name, Telefon, Mail und Notiz.
function kundeAnonymisieren(S, k) {
  let n = 0;
  for (const o of S.bestellungen) if (sameText(o.name, k.name)) { o.name = ANONYM; o.tel = ''; o.mail = ''; o.notiz = ''; o.packNotiz = ''; o.anonym = true; n++; }
  S.kunden = S.kunden.filter(x => x !== k && x.nr !== k.nr);
  return n;
}

// ---------- Mengenprüfung (Blatt "Mengenprüfung") ----------
function mengenpruefung(S, tierName) {
  const t = topfTier(S, tierName);
  if (!t) return null;
  const ords = ordersOfTopf(S, t);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const bil = fleischBilanz(S, t, ords);
  const rows = ausbeuteArtikel(S).map(a => {
    const y = kapazitaet(S, t, bil, a.name);
    const einzel = ords.reduce((s, o) => s + qty(S, o, a.name) + sortenAdj(S, o, a.name), 0) + (a.name === BRATEN ? num(bil.braten.bugMager) : 0);
    const ausPak = pak * paketKgArt(S, a.name);
    const ges = einzel + ausPak;
    return { art: a.name, ausbeute: y, ausbeuteStd: a.name === HACK ? yieldArt(S, t, HACK) : y, einzel, ausPak, gesamt: ges, frei: y - ges, auslastung: y > 0 ? ges / y : null,
      status: y === 0 ? '' : ges > y + 0.001 ? 'reicht nicht' : ges > 0.9 * y ? 'knapp' : 'ok' };
  });
  // Summen für die Gesamtübersicht. Hack zählt mit der normalen Ausbeute – was der Bug/Gulasch fürs Hack hergibt,
  // steckt schon in deren Zeilen (sonst doppelt gezählt). „noch frei“ = geht voraussichtlich in den Hofladen.
  const gruppe = f => {
    const rs = rows.filter(f);
    const aus = rs.reduce((s, r) => s + r.ausbeuteStd, 0), best = rs.reduce((s, r) => s + r.gesamt, 0);
    return { ausbeute: aus, einzel: rs.reduce((s, r) => s + r.einzel, 0), ausPak: rs.reduce((s, r) => s + r.ausPak, 0), bestellt: best, frei: aus - best, quote: aus > 0 ? best / aus : null };
  };
  const knochen = r => r.art === SK || r.art === FK;
  const sum = { fleisch: gruppe(r => !knochen(r)), knochen: gruppe(knochen), gesamt: gruppe(() => true) };
  sum.anteilSG = num(sgRechnung(S, t)) > 0 ? sum.gesamt.ausbeute / num(sgRechnung(S, t)) : null;
  sum.schaetz = ords.reduce((s, o) => s + num(schaetzpreis(S, o)), 0);
  const mitEnd = ords.filter(o => has(o.endbetrag));
  sum.endbetrag = mitEnd.reduce((s, o) => s + num(o.endbetrag), 0); sum.mitEnd = mitEnd.length;
  sum.engpass = rows.filter(r => r.status === 'reicht nicht').map(r => r.art);
  sum.knapp = rows.filter(r => r.status === 'knapp').map(r => r.art);
  sum.innereien = [...ORGANE, OCHS].map(n => { const a = art(S, n); const q = ords.reduce((s, o) => s + qty(S, o, n), 0); return q > 0 ? `${fmtNum(q, a && a.einheit === 'Stk' ? 0 : 2)} ${a && a.einheit === 'Stk' ? 'Stk' : 'kg'} ${n}` : ''; }).filter(Boolean);
  return { tier: t, info: tierInfo(S, t), rows, bilanz: bil, summen: sum };
}

// ---------- Metzgerauftrag ----------
function metzgerauftrag(S, tierName, hackKisteKg) {
  const t = topfTier(S, tierName);
  if (!t) return null;
  const ords = ordersOfTopf(S, t);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const { hack, gul, braten } = fleischBilanz(S, t, ords);
  // Hackfleisch: Ausbeute + nicht bestelltes Gulasch – oder mehr, wenn mehr bestellt ist (dann Bug auflösen).
  // Separat vorbereitetes Hack (z. B. besonders mager) steht unten bei den Sonderfällen und geht hier ab.
  hack.vorgabe = Math.max(0, roundUp(hack.ausbeuteMitGulasch + hack.ausBug - hack.separat));
  const hk = num(hackKisteKg) > 0 ? num(hackKisteKg) : num(S.settings.hackKiste) || 20;
  // gleiche Aufteilung wie im Ladeplan (kein neuer Hack-Kiste für einen kleinen Rest)
  const hTeile = hackAufteilung(hack.vorgabe, hk, num(S.settings.kisteAusnahme) || 25);
  hack.kisten = hTeile.length;
  hack.kistenText = hackKistenText(hTeile);
  const separat = [];
  // Kistennummer je Sonderfall aus dem gespeicherten Kistenplan (seit 3.2.1, Wunsch Nutzer) – wie beim Kommissionieren
  const skAlle = kistenKontext(S, tierName).rows.filter(k => k.art === SONDERKISTE), mitPlan = skAlle.length > 0;
  for (const o of ords) for (const s of sonderOf(S, o)) {
    const a = art(S, s.art);
    const sk = num(s.menge) > 0 && !istOrgan(s.art) ? skAlle.find(k => k.sonder && k.sonder.includes(o.nr + '|' + s.art)) || skAlle.find(k => !k.sonder) || null : null;
    separat.push({ nr: o.nr, name: o.name, art: s.art, kiste: sk ? sk.nr : null, menge: has(s.menge) ? (s.ca ? 'ca. ' + fmtNum(s.menge, 1) : fmtNum(s.menge, 3)) + ' ' + (a ? a.einheit : '') : '', hinweis: s.wunsch });
  }
  const waden = ords.reduce((s, o) => { const p = o.pos && o.pos[BEIN]; return s + (istWade(art(S, BEIN), p) ? num(p.anzahl) : 0); }, 0);
  const ochsB = ords.reduce((s, o) => s + qty(S, o, OCHS), 0);
  // Ochsenschwanz: nur „am Stück“ bestellte bleiben ganz (Zeile im Metzgerauftrag), alle anderen schneidet der Metzger wie gewohnt
  const ochsGanzListe = ords.filter(o => qty(S, o, OCHS) > 0 && ochsGanz(S, o)).map(o => ({ nr: o.nr, name: o.name, stk: qty(S, o, OCHS) }));
  const ochs = { bestellt: ochsB, vorhanden: (has(S.settings.ochsStk) ? num(S.settings.ochsStk) : 1) * topfN(t), ganz: ochsGanzListe.reduce((s, x) => s + x.stk, 0), ganzListe: ochsGanzListe };
  return { tier: t, anzahl: ords.length, pakete: pak, hack, gulasch: gul, separat, mitPlan, waden, ochs, bugMager: num(braten.bugMager), fettSied: num(hack.fettSied) };
}

// ---------- Packplan (Makro PackplanFuer) ----------
// Diese Artikel kommen immer in genau eine eigene Kiste (sortenrein) – geht in der Praxis immer auf
const EINE_KISTE = ['Rouladen', 'Steak', 'Rostbraten', 'Beinscheiben', 'Suppenknochen (SK)', 'Soßenknochen (FK)'];
function mischGruppe(a) {
  if (a === 'Filet' || a === 'Braten' || a === 'Tafelspitz') return 2;
  return 0;
}
function kisteGruppe(items) {
  let g = -1;
  for (const it of items) {
    const g1 = mischGruppe(it.art);
    if (g1 === 0) return 0;
    if (g === -1) g = g1; else if (g !== g1) return 0;
  }
  return g === -1 ? 0 : g;
}
const kistenTxt = items => items.map(i => i.art === OCHS ? `${OCHS} ${fmtNum(i.kg)} Stk${i.info ? ' (' + i.info + ')' : ''}` : `${i.art}${i.info ? ' (' + i.info + ')' : ''} ~${Math.round(i.kg)} kg`).join(' + ');
// Abholgruppe: aktive Tiere mit demselben Abholtermin werden gemeinsam geholt (ein Ladeplan, eine Kistennummerierung, ein Metzgerauftrag)
function abholGruppe(S, tierName) {
  const t = tier(S, tierName);
  if (!t) return [];
  if (t.archiv || !t.abhol) return [t.name];
  const g = S.tiere.filter(x => !x.archiv && x.abhol === t.abhol);
  return g.sort((a, b) => String(a.schlacht || '').localeCompare(String(b.schlacht || '')) || S.tiere.indexOf(a) - S.tiere.indexOf(b)).map(x => x.name);
}
const PP_BIG = 100000;
// ---------- Kommissionieren mit Ist-Gewicht (seit 3.1, Wunsch Nutzer) ----------
// Jede Pick-Zeile wird gewogen (Summe der Teile der Zeile, z. B. 6 Steaks zusammen); Hack und Innereien sind vorgepackt → nur abhaken.
// Abweichung über der Toleranz (Standard ±15 %) braucht einen Vermerk an der Bestellung. Preis bleibt bei der Waage beim Abholen –
// die Ist-Gewichte sind für die Ausbeute-Statistik und die Referenz-Einzelgewichte.
const ohneWiegen = name => name === HACK || istOrgan(name);
const kommToleranz = S => (has(S.settings.kommToleranz) ? num(S.settings.kommToleranz) : 15) / 100;
const mitStueck = (S, name) => name === OCHS || (art(S, name) && num(art(S, name).stueckG) > 0 && !(num(art(S, name).beutelG) > 0));
function stkSoll(S, p) {
  if (p.einheit === 'Stk') return Math.round(num(p.menge));
  const a = art(S, p.art);
  if (!a || !mitStueck(S, p.art)) return null;
  return Math.max(1, Math.round(num(p.menge) * 1000 / num(a.stueckG)));
}
// Abweichung Ist zu Soll (Anteil); bei Stück-Artikeln zählt die Stückzahl
function kommAbweichung(S, p, ist) {
  if (p.einheit === 'Stk') return num(p.menge) > 0 ? Math.abs(num(ist.stk) - num(p.menge)) / num(p.menge) : 0;
  return num(p.menge) > 0 ? Math.abs(num(ist.kg) - num(p.menge)) / num(p.menge) : 0;
}
function kommSetzen(S, o, p, ist) {
  o.komm = o.komm || {};
  const e = { kg: has(ist.kg) ? r3(num(ist.kg)) : null, stk: has(ist.stk) ? num(ist.stk) : null, soll: p.menge, einheit: p.einheit, art: p.art, kiste: p.kiste, zeit: new Date().toISOString() };
  if (ist.vermerk) e.vermerk = String(ist.vermerk).trim();
  if (ist.ok) e.ok = true;
  o.komm[p.key] = e;
  // Statistik: als Erfassung beim Tier der Bestellung (ersetzt die Karte „Ausbeute wiegen“)
  const t = tier(S, o.tier);
  if (t) {
    const k = 'K' + o.nr + '|' + p.key;
    t.erfassung = (t.erfassung || []).filter(x => x.key !== k);
    if (p.wiegen && num(e.kg) > 0) t.erfassung.push({ art: p.art, teil: '', kg: e.kg, nr: o.nr, key: k, zeit: e.zeit });
  }
}
function kommLoeschen(S, o, p) {
  if (o.komm) delete o.komm[p.key];
  const t = tier(S, o.tier); if (t && t.erfassung) t.erfassung = t.erfassung.filter(x => x.key !== 'K' + o.nr + '|' + p.key);
}
const kommVermerke = o => Object.values(o.komm || {}).filter(e => e.vermerk).map(e => `${e.art}: ${e.vermerk}`);

// ---------- Hofladen-Päckchen beim Kommissionieren (seit 3.1) ----------
// Was nach allen Bestellungen in den Kisten übrig ist, wird vakuumiert und gewogen; Lagerplatz Kühlhaus-Kiste je Päckchen.
const HOF_REGELN = {
  Beinscheiben: { r: 'stk', n: 1 }, Rostbraten: { r: 'stk', n: 2 }, Steak: { r: 'stk', n: 2 }, Rouladen: { r: 'stk', n: 4 },
  Braten: { r: 'kg', von: 1, bis: 1.5 }, Tafelspitz: { r: 'kg', von: 1.5, bis: 2 }, Filet: { r: 'halb' }, 'Gulasch geschnitten': { r: 'kg', von: 1, bis: 1 },
  Siedfleisch: { r: 'kg', von: 1, bis: 1.5 }, Ochsenschwanz: { r: 'ganz' }, 'Suppenknochen (SK)': { r: 'kiste' }, 'Soßenknochen (FK)': { r: 'kiste' }
};
const HOF_REGEL_ARTEN = ['stk', 'kg', 'ganz', 'halb', 'kiste'];
function hofRegel(S, name) { const x = (S.settings.hofPack || {})[name]; return Object.assign({}, HOF_REGELN[name] || { r: 'kg', von: 1, bis: 1.5 }, x || {}); }
function hofRegelText(S, name) {
  const g = hofRegel(S, name);
  let t = g.r === 'stk' ? `je ${fmtNum(g.n)} Stück vakuumieren` : g.r === 'kg' ? (num(g.von) === num(g.bis) ? `je ${fmtNum(g.von, 2)} kg vakuumieren` : `je ${fmtNum(g.von, 2)}–${fmtNum(g.bis, 2)} kg vakuumieren, Reste kleiner`)
    : g.r === 'ganz' ? 'ganz lassen, vakuumieren' : g.r === 'halb' ? 'ganze Stücke halbieren, vakuumieren' : 'bleibt in der Kiste';
  if (name === BRATEN) t += ' · Teilstück angeben · Bürgermeisterstück ganz (oder Rest)';
  return t;
}
// Träger der Hofladen-Daten: Tier bzw. bei gemeinsamer Abholung das erste Tier des Topfs
function hofTraeger(S, tierName) { const c = kistenKontext(S, tierName); return c.topf ? tier(S, c.t.glieder[0]) : tier(S, tierName); }
function hofListe(S, tierName) {
  const T = hofTraeger(S, tierName); if (!T) return [];
  const packs = T.hofPacks || [], fertig = T.hofFertig || {};
  return kistenCalc(S, tierName).filter(c => c.rest > 0.05 && c.k.art !== HACK && c.k.art !== SONDERKISTE && !istOrgan(c.k.art)).map(c => {
    const key = c.k.nr + '|' + c.k.art, pk = packs.filter(x => x.key === key);
    return { key, kiste: c.k.nr, art: c.k.art, rest: c.rest, einheit: c.einheit, platz: c.k.platz || '', regel: hofRegel(S, c.k.art), regelText: hofRegelText(S, c.k.art),
      packs: pk, kg: pk.reduce((s, x) => s + num(x.kg), 0), fertig: !!fertig[key] };
  });
}
function hofPackDazu(S, tierName, key, p) {
  const T = hofTraeger(S, tierName); if (!T) return null;
  T.hofPacks = T.hofPacks || [];
  const id = (T.hofPacks.reduce((m, x) => Math.max(m, num(x.id)), 0) || 0) + 1;
  const [kiste, ...an] = key.split('|'), artName = an.join('|');
  const e = { id, key, kiste: +kiste, art: artName, teil: p.teil || '', kg: has(p.kg) ? r3(num(p.kg)) : null, stk: has(p.stk) ? num(p.stk) : null, kh: has(p.kh) && num(p.kh) > 0 ? num(p.kh) : null, zeit: new Date().toISOString() };
  T.hofPacks.push(e);
  if (num(e.kg) > 0 && !ohneWiegen(artName)) { T.erfassung = T.erfassung || []; T.erfassung.push({ art: artName, teil: '', kg: e.kg, nr: 0, key: 'H' + id, zeit: e.zeit }); }
  return e;
}
function hofPackWeg(S, tierName, id) {
  const T = hofTraeger(S, tierName); if (!T) return;
  T.hofPacks = (T.hofPacks || []).filter(x => x.id !== id);
  T.erfassung = (T.erfassung || []).filter(x => x.key !== 'H' + id);
}
function hofFertigSetzen(S, tierName, key, wert) { const T = hofTraeger(S, tierName); if (!T) return; T.hofFertig = T.hofFertig || {}; if (wert) T.hofFertig[key] = true; else delete T.hofFertig[key]; }
// Vorauswahl Kühlhaus-Kiste: wie beim letzten Päckchen desselben Artikels
function hofLetzteKiste(S, tierName, artName) { const T = hofTraeger(S, tierName); const l = (T && T.hofPacks || []).filter(x => x.art === artName && x.kh).pop(); return l ? l.kh : null; }

// ---------- Referenz-Einzelgewichte aus den Ist-Werten (seit 3.1) ----------
// g je Stück aus allen gewogenen Zeilen mit Stückzahl (Bestellungen und Hofladen-Päckchen, auch Archiv)
function kommReferenz(S) {
  const r = {};
  const dazu = (name, kg, stk) => { if (!(num(kg) > 0) || !(num(stk) > 0) || !mitStueck(S, name)) return; const x = r[name] = r[name] || { kg: 0, stk: 0, n: 0 }; x.kg += num(kg); x.stk += num(stk); x.n++; };
  for (const o of S.bestellungen) for (const e of Object.values(o.komm || {})) if (e.einheit !== 'Stk' || e.art === OCHS) dazu(e.art, e.kg, e.stk);
  for (const t of S.tiere || []) for (const p of t.hofPacks || []) dazu(p.art, p.kg, p.stk);
  for (const x of Object.values(r)) x.g = x.stk > 0 ? x.kg * 1000 / x.stk : 0;
  return r;
}

// Hack-Kisten (seit 3.0.3, Wunsch Nutzer): jede Kiste auf hk kg (20 kg) füllen. Eine weitere Kiste wird nur angefangen,
// wenn der Rest nicht mehr auf die vollen Kisten passt, ohne dass eine über „max“ (25 kg) kommt –
// bei 4 vollen Kisten also erst, wenn noch mehr als 20 kg offen sind. Sonst wird der Rest gleichmäßig auf die vollen Kisten verteilt.
function hackAufteilung(kg, hk, max) {
  if (!(kg > 0.05) || !(hk > 0)) return [];
  max = Math.min(30, Math.max(max || 25, hk + 5)); // normal 20 → bis 25 kg; überladen (z. B. 24) → bis 29 kg, höchstens 30
  const voll = Math.floor((kg + 1e-9) / hk), rest = kg - voll * hk;
  if (voll === 0) return [kg];
  if (rest < 0.05) return Array(voll).fill(hk);
  if (kg <= voll * max + 1e-9) return Array(voll).fill(kg / voll); // Rest auf die vollen Kisten verteilen
  return Array(voll).fill(hk).concat([rest]);
}
function hackKistenText(teile) {
  const g = [];
  for (const w of teile.map(x => r1(x))) { const l = g[g.length - 1]; if (l && l.w === w) l.n++; else g.push({ w, n: 1 }); }
  return g.map(x => `${x.n} × ${fmtNum(x.w)} kg`).join(' + ');
}
const SONDERKISTE = 'Sonderfälle (beschriftet)';
const SONDER_MAX = 30; // Kiste mit Sonderfällen: höchstens 30 kg
// Sonderfälle einer Bestellung als Teile (ganze Bestellung, wenn sie in eine Kiste passt, sonst je Artikel)
function sonderTeile(S, ords) {
  const T = [];
  ords.forEach((o, k) => {
    const L = sonderOf(S, o).filter(s => { const a = art(S, s.art); return a && a.einheit === 'kg' && num(s.menge) > 0 && !istOrgan(s.art); })
      .map(s => ({ key: o.nr + '|' + s.art, nr: o.nr, kg: num(s.menge) }));
    if (!L.length) return;
    const sum = L.reduce((x, s) => x + s.kg, 0);
    const gruppen = sum <= SONDER_MAX + 0.001 ? [L] : [];
    if (!gruppen.length) for (const s of L.sort((a, b) => b.kg - a.kg)) {
      let g = gruppen.find(g => g.reduce((x, y) => x + y.kg, 0) + s.kg <= SONDER_MAX + 0.001);
      if (!g) { g = []; gruppen.push(g); }
      g.push(s);
    }
    for (const g of gruppen) T.push({ need: k + 1, nr: o.nr, kg: g.reduce((x, y) => x + y.kg, 0), keys: g.map(s => s.key) });
  });
  return T;
}
function sonderItem(c) { let it = c.items.find(i => i.art === SONDERKISTE); if (!it) { it = { art: SONDERKISTE, kg: 0, info: '', sonder: [], nrn: [] }; c.items.push(it); } return it; }
function sonderVerteilen(S, ords, C, maxKg, warn) {
  const T = sonderTeile(S, ords);
  const hatHack = c => c.items.some(i => i.art === HACK);
  let eigene = 0;
  for (const p of T) {
    // 1) normale Kiste, die bei dieser Bestellung schon in Gebrauch ist (need ≤ Bestellung), mit Platz bis zur normalen Füllgrenze
    let best = null;
    for (const c of C) {
      if (hatHack(c) || c.nurSonder || c.need > p.need) continue;
      const neuItem = !c.items.some(i => i.art === SONDERKISTE);
      if (neuItem && c.items.length >= 3) continue;
      if (c.w + p.kg > maxKg + 0.001) continue;
      if (!best || c.need > best.need || (c.need === best.need && c.w < best.w)) best = c; // die zuletzt geöffnete Kiste zuerst
    }
    // 2) sonst eine eigene Sonderfälle-Kiste mit Platz (bis 30 kg), 3) sonst eine neue
    if (!best) best = C.find(c => c.nurSonder && c.w + p.kg <= SONDER_MAX + 0.001) || null;
    if (!best) { best = { items: [], w: 0, need: p.need, nurSonder: true }; C.push(best); eigene++; }
    const it = sonderItem(best);
    it.kg = r1(it.kg + p.kg); it.sonder.push(...p.keys); if (!it.nrn.includes(p.nr)) it.nrn.push(p.nr);
    it.info = 'Nr. ' + it.nrn.join(', ');
    best.w += p.kg;
    if (p.need < best.need) best.need = p.need;
    if (p.kg > SONDER_MAX + 0.001) warn.push(`Sonderfall Nr. ${p.nr}: ein Stück mit ca. ${fmtNum(p.kg, 1)} kg – Kiste über ${SONDER_MAX} kg.`);
  }
  return eigene;
}
function packplan(S, tierName) { return packplanGruppe(S, abholGruppe(S, tierName)); }
// Teil 1 je Tier: welche Stücke in welche Kiste (noch ohne Stellplatz)
function packplanKisten(S, tierName, f = 1) {
  const t = topfTier(S, tierName);
  if (!t) return { fehler: 'Tier unbekannt' };
  const nT0 = topfN(t); // Anzahl Tiere im Topf (gewachsene Stücke × Tiere)
  const st = S.settings;
  const maxKg = (num(st.kisteMax) > 0 ? num(st.kisteMax) : 20) * f;
  const dv = num(st.nenner) > 0 ? num(st.nenner) : 16;
  const hackKg = Math.round((num(st.hackKiste) > 0 ? num(st.hackKiste) : 20) * f);
  const ma = metzgerauftrag(S, tierName);
  const ords = ordersOfTopf(S, t);
  // Sonderwünsche je Bestellung und gesamt
  const specT = {}; let specTier = 0;
  const specO = {};
  for (const o of ords) for (const s of sonderOf(S, o)) {
    specT[s.art] = (specT[s.art] || 0) + num(s.menge);
    specO[o.nr + '|' + s.art] = (specO[o.nr + '|' + s.art] || 0) + num(s.menge);
    const a = art(S, s.art);
    if (a && a.einheit === 'kg') specTier += num(s.menge);
  }
  const A = S.artikel.map(a => {
    let yt = yieldArt(S, t, a.name);
    const isOrg = istOrgan(a.name);
    const shr = paketKgArt(S, a.name); // je Genusspaket (feste Zusammensetzung)
    let kg = 0;
    if (a.name === HACK) kg = ma.hack.vorgabe;
    else if (a.name === GULASCH) kg = ma.gulasch.vorgabe;
    else if (a.name === BRATEN) kg = Math.max(0, yt - ma.hack.ausBug - num(ma.bugMager) - (specT[a.name] || 0)); // Bug ging ins Hack (auch mageres Hack)
    else if (a.name === SIED) kg = Math.max(0, yt - num(ma.fettSied) - (specT[a.name] || 0)); // Siedfleisch ging ins fettige Hack
    else if (!isOrg) kg = Math.max(0, yt - (specT[a.name] || 0));
    return { art: a.name, isOrg, shr, kg };
  });
  // Verbrauch je Bestellung als Abschnitte auf der Mengenachse: erst alle Genusspaket-Anteile
  // (Vorrang), danach die Einzelartikel – jeweils in Reihenfolge der Bestell-Nr.
  const BIG = PP_BIG;
  const pakGes = ords.reduce((s, o) => s + num(o.pakete), 0);
  const abschn = A.map(a => {
    let pk = 0, ez = pakGes * a.shr;
    return ords.map(o => {
      const p = num(o.pakete) * a.shr;
      const e = Math.max(0, qty(S, o, a.art) - (specO[o.nr + '|' + a.art] || 0));
      const r = [[pk, pk + p], [ez, ez + e]]; pk += p; ez += e; return r;
    });
  });
  // erste Bestellung (1-basiert), die Ware aus dem Bereich [von, bis) braucht
  const ersteBestellung = (i, von, bis) => {
    for (let k = 0; k < ords.length; k++)
      if (abschn[i][k].some(([s, e]) => e - s > 1e-9 && s < bis - 0.001 && e > von + 0.001)) return k + 1;
    return BIG;
  };
  // Teilkisten
  let P = [];
  const warnVorab = [];
  // Plan stimmt erst, wenn alle Bestellungen ok sind (Sonderwünsche/„am Stück“ werden zuerst zurückgelegt)
  const mcTier = mengencheckTier(S, tierName);
  const nichtOk = ords.filter(o => (mcTier[o.nr] || '').startsWith('reicht') && !o.ueberbelegt);
  const ueb = ords.filter(o => (mcTier[o.nr] || '').startsWith('reicht') && o.ueberbelegt);
  if (ueb.length) warnVorab.push(`Bewusst überbelegt: Nr. ${ueb.map(o => o.nr).join(', ')} – dort fehlt beim Kommissionieren Ware.`);
  if (nichtOk.length) warnVorab.push(`${nichtOk.length} Bestellung${nichtOk.length === 1 ? ' reicht' : 'en reichen'} nicht (Nr. ${nichtOk.map(o => o.nr).join(', ')}). Der Plan stimmt erst, wenn alle Bestellungen „ok“ sind – Sonderwünsche und „am Stück“ werden zuerst zurückgelegt, dann kann anderen Bestellungen etwas fehlen. Bitte erst umstellen (Mengenprüfung) und den Plan neu berechnen.`);
  A.forEach((a, i) => {
    if (a.isOrg || !(a.kg > 0.05)) return;
    const artDef = art(S, a.art);
    const ganze = artDef && num(artDef.ganzeStuecke) > 0 ? Math.round(num(artDef.ganzeStuecke)) : 0;
    if ((a.art === BRATEN && bratenTeile(S).length) || ganze > 0) {
      // gewachsene Stücke, auf das Tier hochgerechnet; Bug-Stücke, die ins Hack gehen, fallen weg
      let stuecke = [];
      if (a.art === BRATEN && bratenTeile(S).length) {
        const yB = yieldArt(S, t, BRATEN), f = yB > 0 ? yB / (bratenTeileKg(S, t.typ) * nT0) : 1;
        for (const x of bratenTeile(S)) for (let n = 0; n < num(x.stueck) * nT0; n++) stuecke.push({ name: x.name, kg: teilKg(x, t.typ, S) * f, bug: !!x.bug });
      } else {
        // ganze Stücke (z. B. 2 Filets, 2 Roastbeef-Stränge, 2 Hüften, 2 Tafelspitze)
        const y = yieldArt(S, t, a.art), gz = ganze * nT0;
        for (let n = 0; n < gz; n++) stuecke.push({ name: a.art, kg: y / gz, bug: false });
      }
      // Sonderwünsche: ganze Stücke und kg aus einem Teilstück liegen beim Sonderfall – diese Stücke gehen hier ab
      for (const o of ords) for (const s of sonderOf(S, o)) {
        if (s.art !== a.art) continue;
        const nm = a.art === BRATEN ? s.teil : a.art;
        if (!nm) continue;
        if (s.ganz) { for (let n = 0; n < s.ganz; n++) { const x = stuecke.find(x => x.name === nm && !x.weg); if (x) x.weg = true; } }
        else if (a.art === BRATEN) {
          let r = num(s.menge);
          for (const x of stuecke.filter(x => x.name === nm && !x.weg).sort((p, q) => p.kg - q.kg)) { if (r <= 0) break; const d = Math.min(r, x.kg); x.kg -= d; r -= d; if (x.kg < 0.3) x.weg = true; }
        }
      }
      stuecke = stuecke.filter(s => !s.weg);
      let insHack = ma.hack.ausBug;
      for (const s of stuecke.filter(s => s.bug).sort((p, q) => q.kg - p.kg)) if (insHack > s.kg / 2) { s.weg = true; insHack -= s.kg; }
      stuecke = stuecke.filter(s => !s.weg);
      const ges = stuecke.reduce((s, x) => s + x.kg, 0), k = ges > 0 ? Math.min(1, a.kg / ges) : 1; // Sonderwünsche gehen ab
      stuecke.forEach(s => { s.kg *= k; });
      // Keule zuerst (wird zuerst gebraucht), große Stücke zuerst, je Kiste höchstens maxKg
      stuecke.sort((p, q) => (p.bug - q.bug) || q.kg - p.kg);
      const kisten = [];
      for (const s of stuecke) {
        let kk = kisten.find(c => c.w + s.kg <= maxKg + 0.001);
        if (!kk) { kk = { w: 0, st: [] }; kisten.push(kk); }
        kk.w += s.kg; kk.st.push(s);
      }
      let start = 0;
      for (const c of kisten) {
        const z = {}; c.st.forEach(s => { z[s.name] = (z[s.name] || 0) + 1; });
        const info = Object.entries(z).map(([n, c]) => n === a.art ? (c > 1 ? `${c} ganze Stücke` : '1 ganzes Stück') : `${c}× ${n.replace(/ \(.*\)$/, '')}`).join(', ');
        P.push({ art: a.art, w: c.w, need: ersteBestellung(i, start, start + c.w), info });
        start += c.w;
      }
      return;
    }
    let nT, stueck;
    const ausnahme = (num(st.kisteAusnahme) > 0 ? num(st.kisteAusnahme) : 25) * f;
    if (a.art === FK && a.kg > 0.05) {
      // Soßenknochen aus Platzgründen immer in 2 Kisten (Topf: mehr, wenn sonst zu schwer), ganze Beutel (kein Beutel über zwei Kisten)
      const bg = num((art(S, FK) || {}).beutelG) / 1000 || 1, nb = Math.round(a.kg / bg);
      const nK = Math.max(2, Math.ceil(a.kg / maxKg - 1e-9)), teileFK = [];
      if (nb > 1) { let rest = nb; for (let j = nK; j >= 1; j--) { const b = Math.ceil(rest / j); teileFK.push(Math.min(b * bg, a.kg - teileFK.reduce((x, y) => x + y, 0))); rest -= b; } }
      else teileFK.push(a.kg / 2, a.kg / 2);
      for (let j = teileFK.length - 1; j >= 0; j--) if (!(teileFK[j] > 0.05)) teileFK.splice(j, 1);
      let von = 0;
      for (const w of teileFK) { P.push({ art: a.art, w, need: ersteBestellung(i, von, von + w) }); von += w; }
      return;
    }
    if (EINE_KISTE.includes(a.art)) { nT = a.kg <= ausnahme + 0.001 ? 1 : Math.ceil(a.kg / maxKg - 1e-9); stueck = a.kg / nT; }
    else if (a.art === HACK) {
      // Hack: neue Kiste erst ab 10 kg, sonst Rest auf die vollen Kisten (bis 25 kg) verteilen
      for (const w of hackAufteilung(a.kg, hackKg, num(st.kisteAusnahme) || 25)) P.push({ art: a.art, w, need: 0 });
      return;
    }
    else { nT = Math.floor((a.kg - 0.001) / maxKg) + 1; stueck = a.kg / nT; }
    for (let j = 1; j <= nT; j++) {
      let w = stueck, need = BIG;
      if (a.art === HACK) need = 0;
      else need = ersteBestellung(i, (j - 1) * stueck, j * stueck);
      P.push({ art: a.art, w, need });
    }
  });
  for (const p of P) if (EINE_KISTE.includes(p.art) && p.w > maxKg + 0.05) warnVorab.push(`${p.art}: eine Kiste mit ca. ${fmtNum(p.w, 1)} kg (über ${fmtNum(maxKg)} kg, Ausnahme).`);
  if (!P.length) return { fehler: `Für ${t.name} gibt es noch keine Mengen.` };
  // stabil sortieren wie Auswahlsort: need aufsteigend, bei gleichem need schwerer zuerst
  P = selSort(P, (x, y) => x.need < y.need || (x.need === y.need && x.w > y.w));
  // Kisten füllen
  let C = [];
  for (const p of P) {
    let k = -1;
    const g = mischGruppe(p.art);
    if (g > 0) {
      for (let j = 0; j < C.length; j++)
        if (C[j].w + p.w <= maxKg + 0.001 && kisteGruppe(C[j].items) === g && !C[j].items.some(i => i.art === p.art)) { k = j; break; }
    }
    if (k === -1) { C.push({ items: [], w: 0, need: p.need }); k = C.length - 1; }
    C[k].w += p.w;
    if (p.need < C[k].need) C[k].need = p.need;
    C[k].items.push({ art: p.art, kg: r1(p.w), info: p.info || '' });
  }
  // Ochsenschwanz (ganz, nach Stück) kommt mit in die Beinscheiben-/Waden-Kiste
  const ochsN = Math.max(ma.ochs.vorhanden, ma.ochs.bestellt);
  if (ochsN > 0) {
    const kOchs = num((art(S, OCHS) || {}).stueckG) / 1000 || 2;
    let needO = BIG;
    ords.forEach((o, k) => { if (needO === BIG && qty(S, o, OCHS) > 0) needO = k + 1; });
    let c = C.find(c => c.items.some(i => i.art === BEIN));
    if (!c) { c = { items: [], w: 0, need: needO }; C.push(c); }
    c.items.push({ art: OCHS, kg: ochsN, info: ma.ochs.ganz > 0 ? `${fmtNum(ma.ochs.ganz)} ganz` : '' });
    c.w += ochsN * kOchs;
    if (needO < c.need) c.need = needO;
    if (ma.ochs.bestellt > ma.ochs.vorhanden) warnVorab.push(`Ochsenschwanz: ${fmtNum(ma.ochs.bestellt)} Stk bestellt, aber nur ca. ${fmtNum(ma.ochs.vorhanden)}${nT0 > 1 ? ' bei ' + t.name : ' je Tier'}.`);
  }
  // Sonderfälle vom Metzger (je Bestellung beschriftet): auf die normalen Kisten verteilen, die zu dieser Bestellung
  // schon gebraucht werden und noch Platz haben; nur der Rest kommt in eigene Sonderfälle-Kisten (höchstens 30 kg je Kiste)
  if (specTier > 0) sonderVerteilen(S, ords, C, maxKg, warnVorab);
  C.forEach(c => { c.tier = t.name; c.ab = c.need === 0 ? 'von Anfang an' : c.need >= BIG ? 'Rest / Hofladen' : `ab Nr. ${ords[c.need - 1].nr}`; });
  return { t, C, warnVorab, ords, maxKg, hackKg };
}
// Teil 2: Kisten einer Abholgruppe (ein oder mehrere Tiere) gemeinsam ins Auto stellen und durchnummerieren.
// Mehrere Tiere: erst werden die Bestellungen von Tier 1 kommissioniert, dann Tier 2 – danach richtet sich, welche Kiste wie gut erreichbar steht.
function packplanGruppe(S, namen) {
  const st = S.settings;
  const BIG = PP_BIG;
  // Mehrere Tiere: Kisten so weit schwerer beladen (in 1-kg-Schritten), bis alles auf die Plätze im Auto passt (höchstens 29 Etiketten)
  const platz = Math.min(29, S.auto.reduce((s, f) => s + num(f.hoehe), 0));
  const basis = num(st.kisteMax) > 0 ? num(st.kisteMax) : 20;
  let teile, warnVorab, faktor = 1;
  for (let schritt = 0; ; schritt++) {
    faktor = (basis + schritt) / basis;
    teile = []; warnVorab = [];
    // seit 3.0: mehrere Tiere mit gleichem Abholtag = ein Topf → ein gemeinsamer Kistenplan
    const r = packplanKisten(S, namen[0], faktor);
    if (r.fehler) return namen.length > 1 ? { fehler: `Für ${namen.join(' + ')} gibt es noch keine Mengen.` } : r;
    teile.push(r);
    const anzahl = r.C.length;
    // höchstens bis zur Ausnahme-Grenze (Standard 25 kg) schwerer beladen – danach werden leichte Kisten zusammengelegt
    const grenze = num(st.kisteAusnahme) > 0 ? num(st.kisteAusnahme) : 25;
    if (!r.t.glieder || anzahl <= platz || basis + schritt >= grenze) break;
  }
  const kisteKg = teile[0].maxKg, hackKisteKg = teile[0].hackKg;
  if (faktor > 1) warnVorab.unshift(`Damit alles in ein Auto passt: Kisten bis ca. ${fmtNum(kisteKg, 0)} kg beladen (statt ${fmtNum(basis)} kg), Hackfleisch ${fmtNum(hackKisteKg)} kg je Kiste.`);
  const gruppe = !!teile[0].t.glieder, topfName = teile[0].t.name;
  let C = teile[0].C;
  teile[0].warnVorab.forEach(w => warnVorab.push(w));
  // Passt es immer noch nicht: die leichtesten Kisten desselben Tiers zusammenlegen (nicht Hackfleisch, nicht die Sonderfälle-Kiste)
  if (gruppe && C.length > platz) {
    const nurH = c => c.items.every(i => i.art === HACK), sonder = c => false;
    let zusammen = 0;
    let grenzeKg = kisteKg;
    while (C.length > platz) {
      let best = null;
      for (let a = 0; a < C.length; a++) for (let b = a + 1; b < C.length; b++) {
        const x = C[a], y = C[b];
        if (x.tier !== y.tier || nurH(x) || nurH(y) || sonder(x) || sonder(y) || x.items.length + y.items.length > 3) continue;
        const w = x.w + y.w;
        if (w <= grenzeKg + 0.001 && (!best || w < best.w)) best = { a, b, w };
      }
      if (!best && grenzeKg < kisteKg + 5) { grenzeKg = kisteKg + 5; continue; } // notfalls bis 5 kg schwerer
      if (!best) break;
      const x = C[best.a], y = C[best.b];
      if (y.need < x.need) x.ab = y.ab;
      x.items = x.items.concat(y.items); x.w = best.w; x.need = Math.min(x.need, y.need);
      C.splice(best.b, 1); zusammen++;
    }
    if (zusammen) warnVorab.push(`${zusammen}× zwei Kisten zusammengelegt (gemischt, bis ${fmtNum(grenzeKg, 0)} kg), damit alles ins Auto passt.`);
  }
  if (gruppe) warnVorab.unshift(`Gemeinsame Abholung: ${topfName} laufen als ein Topf – gemeinsame Kisten (gleiche Artikel zusammen), kommissioniert wird über alle Bestellungen in einer Reihenfolge.`);
  // Stellplätze vorbereiten
  const auto = S.auto;
  const warn = warnVorab.slice();
  const nurHack = c => c.items.length > 0 && c.items.every(i => i.art === HACK);
  const hackIdx = auto.findIndex(f => sameText(f.name, st.hackPlatz || 'vorne rechts') && num(f.hoehe) > 0);
  const hatHack = C.some(nurHack);
  // jedes Feld im Auto braucht mindestens eine Kiste (Hack-Platz nur, wenn es Hack gibt)
  const nFeld = auto.filter((f, i) => num(f.hoehe) > 0 && (i !== hackIdx || hatHack)).length;
  while (C.length < nFeld) {
    let aMax = -1, wMax = 0;
    C.forEach((c, j) => { if (c.w > wMax && !c.items.some(i => i.art === 'Sonderfälle (beschriftet)' || i.art === HACK || i.art === OCHS || EINE_KISTE.includes(i.art))) { wMax = c.w; aMax = j; } });
    if (aMax < 0 || wMax < 1) break;
    const c = C[aMax];
    let neu;
    if (c.items.length >= 2) neu = { items: [c.items.pop()], need: c.need };
    else { const h = r1(c.items[0].kg / 2); c.items = [{ art: c.items[0].art, kg: h }]; neu = { items: [{ art: c.items[0].art, kg: h }], need: c.need }; }
    c.w = c.items.reduce((s, i) => s + i.kg, 0);
    neu.w = neu.items.reduce((s, i) => s + i.kg, 0);
    C.push(neu);
  }
  C = selSort(C, (x, y) => x.need < y.need || (x.need === y.need && x.w > y.w));
  // Hackfleisch-Kisten zuerst nummerieren (K1, K2 … der Reihe nach vom Hack-Platz)
  if (hackIdx >= 0) C = C.filter(nurHack).concat(C.filter(c => !nurHack(c)));
  const cap = auto.reduce((s, f) => s + num(f.hoehe), 0);
  const ordW = (f, i) => (num(f.reihenfolge) > 0 ? num(f.reihenfolge) : 99) * 100 + i;
  const fo = auto.map((f, i) => i).sort((a, b) => ordW(auto[a], a) - ordW(auto[b], b));
  const cnt = auto.map(() => 0);
  const liste = auto.map(() => []);   // Kisten je Feld in Entnahme-Reihenfolge (erste = oben)
  // 1) Hackfleisch fest auf den Hack-Platz, der Reihe nach (erste Kiste oben)
  let pool = C;
  if (hackIdx >= 0) {
    const hk = C.filter(nurHack);
    const passt = hk.slice(0, num(auto[hackIdx].hoehe));
    passt.forEach(c => liste[hackIdx].push(c));
    if (hk.length > passt.length) warn.push(`${hk.length} Hack-Kisten, aber auf „${auto[hackIdx].name}“ passen nur ${passt.length} übereinander – der Rest steht woanders.`);
    pool = C.filter(c => !passt.includes(c));
  }
  // 2) übrige Kisten: Plätze zählen – erst je Feld eine, dann die bevorzugten Felder füllen,
  //    Felder mit „erst stapeln, wenn Rest voll“ (hinten links/rechts) zuletzt, Hack-Platz nur als Notreserve
  const felderRest = fo.filter(i => i !== hackIdx && num(auto[i].hoehe) > 0);
  const anz = auto.map(() => 0);
  let rest = pool.length;
  for (const i of felderRest) if (rest > 0) { anz[i] = 1; rest--; }
  const auffuellen = ids => { for (const i of ids) if (rest > 0) { const j = Math.min(num(auto[i].hoehe) - anz[i], rest); if (j > 0) { anz[i] += j; rest -= j; } } };
  auffuellen(felderRest.filter(i => !auto[i].spaeter));
  auffuellen(felderRest.filter(i => auto[i].spaeter));
  if (hackIdx >= 0 && rest > 0) {
    const frei = num(auto[hackIdx].hoehe) - liste[hackIdx].length;
    const j = Math.min(frei, rest);
    if (j > 0) { anz[hackIdx] = j; rest -= j; warn.push(`Platz wird knapp: ${j} Kiste(n) stehen unter dem Hackfleisch auf „${auto[hackIdx].name}“.`); }
  }
  // 3) verteilen: früh gebrauchte Kisten an die zuerst erreichbaren Plätze (Entnahme-Reihenfolge), jeweils oben
  //    Lagenweise statt Feld für Feld: erst die obersten Kisten aller Felder einer Reihe (hinten → Mitte → vorne),
  //    dann die zweite Lage usw. So liegen Kisten, die dieselbe (frühe) Bestellung braucht, nebeneinander statt übereinander.
  const reiheVon = i => { const n = String(auto[i].name || '').toLowerCase(); return /^hinten/.test(n) ? 0 : /^mitte/.test(n) ? 1 : /^vorne/.test(n) ? 2 : 1; };
  const slots = [];
  felderRest.forEach((i, r) => { for (let j = 0; j < anz[i]; j++) slots.push({ i, j, reihe: reiheVon(i), r }); });
  slots.sort((a, b) => a.reihe - b.reihe || a.j - b.j || a.r - b.r);
  let p = 0;
  for (const sl of slots) if (p < pool.length) liste[sl.i].push(pool[p++]);
  if (hackIdx >= 0) for (let j = 0; j < anz[hackIdx]; j++) if (p < pool.length) liste[hackIdx].push(pool[p++]);
  auto.forEach((f, i) => {
    cnt[i] = liste[i].length;
    liste[i].forEach((c, j) => { c.platz = i; c.ebene = cnt[i] - j; }); // erste = oberste Ebene
  });
  if (C.length < nFeld) warn.push(`Nur ${C.length} Kisten – es können nicht alle ${nFeld} Felder im Auto belegt werden.`);
  if (C.length > cap) warn.push(`Achtung: ${C.length} Kisten, aber nur ${cap} Plätze im Auto. Die Kisten ohne Platz sind markiert.`);
  if (C.length > 29) warn.push(`${C.length} Kisten – es gibt nur 29 Etiketten${gruppe ? ' (zweite Fahrt bzw. zweites Fahrzeug oder Etiketten nachbeschriften)' : ''}.`);
  if (C.length > cap && gruppe) warn.push(`Die Kisten ohne Platz werden zuletzt gebraucht – die gehen auf die zweite Fahrt.`);
  const kisten = C.map((c, i) => {
    const hatPlatz = c.platz !== undefined;
    const f = hatPlatz ? auto[c.platz] : null;
    return {
      nr: i + 1, tier: c.tier, items: c.items, w: r1(c.w), text: kistenTxt(c.items),
      teile: c.items.map(it => { const a = art(S, it.art); return a && a.teile && it.art !== HACK && !it.info ? `${it.art}: ${a.teile}` : ''; }).filter(Boolean),
      platz: hatPlatz ? f.name : 'KEIN PLATZ',
      ebene: hatPlatz ? (c.ebene === cnt[c.platz] ? 'oben' : `${c.ebene}. von unten`) : '',
      platzKurz: hatPlatz ? `${f.name}, ${c.ebene === cnt[c.platz] ? 'oben' : c.ebene + '. v. u.'}` : 'KEIN PLATZ',
      ab: c.ab,
      platzIdx: hatPlatz ? c.platz : -1, ebeneNr: c.ebene || 0
    };
  });
  // Draufsicht je Feld
  const felder = auto.map((f, i) => {
    const ks = kisten.filter(k => k.platzIdx === i).sort((a, b) => b.ebeneNr - a.ebeneNr);
    return { name: f.name, belegt: cnt[i], hoehe: num(f.hoehe), kisten: ks.map(k => ({ nr: k.nr, text: k.text, oben: k.ebeneNr === cnt[i] })) };
  });
  // Einladereihenfolge: umgekehrt zur Entnahme – hinterste Plätze zuletzt, je Feld von unten nach oben
  const einladen = [];
  for (const i of fo.slice().reverse()) {
    kisten.filter(k => k.platzIdx === i).sort((a, b) => a.ebeneNr - b.ebeneNr)
      .forEach(k => einladen.push(`${einladen.length + 1}. Kiste ${k.nr} (${k.text}) → ${k.platz}, ${k.ebeneNr === 1 ? 'unten' : k.ebeneNr + '. Ebene'}`));
  }
  const tiere = teile[0].t.glieder || [teile[0].t.name];
  return { tier: topfName, tiere, gruppe, kisteKg, hackKisteKg, fp: Object.fromEntries(tiere.map(n => [n, bestellFingerabdruck(S, n)])), erstellt: new Date().toISOString(), kisten, felder, einladen, cap, warn };
}
function selSort(arr, less) {
  const a = arr.slice();
  for (let i = 0; i < a.length - 1; i++) for (let j = i + 1; j < a.length; j++) if (less(a[j], a[i])) { const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
// Packplan ins Kistenblatt übernehmen (max. 29 Kisten, max. 3 Inhalte je Kiste)
function packplanUebernehmen(S, pp) {
  const tiere = pp.tiere || [pp.tier];
  S.kisten = S.kisten.filter(k => !keyNamen(k).some(n => tiere.includes(n)));
  let id = S.kisten.reduce((m, k) => Math.max(m, k.id || 0), 0);
  for (const k of pp.kisten) {
    if (k.nr > 99) break;
    k.items.slice(0, 3).forEach(it => S.kisten.push({ id: ++id, tier: k.tier || pp.tier, nr: k.nr, art: it.art, kg: it.kg, plan: it.kg, platz: k.platzKurz, gewogen: false, info: it.info || '', ...(it.sonder ? { sonder: it.sonder.slice() } : {}) }));
  }
}

// ---------- Kisten ----------
// Kistenzeilen eines Tiers – bei einem Topf die gemeinsamen Zeilen (k.tier = „Hanni + Hias“)
function kistenRows(S, tierName) {
  return S.kisten.filter(k => k.tier === tierName || keyNamen(k).includes(tierName)).map((k, i) => ({ k, i })).sort((a, b) => a.k.nr - b.k.nr || a.i - b.i).map(x => x.k);
}
// Fingerabdruck der Bestellungen eines Tiers (für „Plan veraltet?“): Reihenfolge, Pakete, Positionen, Sonderwünsche
function bestellFingerabdruck(S, tierName) {
  const txt = JSON.stringify(ordersOfTopf(S, topfTier(S, tierName)).map(o => [o.nr, num(o.pakete), num(o.pakVak), o.pos || {}, o.sonder || []]));
  let h = 5381; for (let i = 0; i < txt.length; i++) h = ((h * 33) ^ txt.charCodeAt(i)) >>> 0;
  return h.toString(36) + ':' + txt.length;
}
// Ist der Kistenplan eines Tiers (bzw. seiner Abholgruppe) noch aktuell? → null = ok, sonst Grund
function kistenplanVeraltet(S, tierName) {
  const rows = kistenRows(S, tierName);
  if (!rows.length) return null;
  if (kommissionierBegonnen(S, [tierName])) return null; // Plan gesperrt – Kisten sind schon im Haus
  const pp = S.packplaene && S.packplaene[tierName];
  const namen = pp && pp.tiere ? pp.tiere : [...new Set(rows.flatMap(keyNamen))];
  if (namen.every(n => !ordersOfTier(S, n).length)) return 'keine Bestellungen mehr';
  const g = abholGruppe(S, tierName);
  if ((g.length > 1 || namen.length > 1) && (g.length !== namen.length || g.some(n => !namen.includes(n)))) return 'gemeinsame Abholung hat sich geändert';
  if (g.length > 1 && !rows.some(k => String(k.tier).includes(TOPF_SEP))) return 'die Kisten sind noch nach Tieren getrennt – seit 3.0 laufen beide Tiere als ein Topf';
  if (pp && pp.fp) for (const n of namen) if (pp.fp[n] !== bestellFingerabdruck(S, n)) return 'Bestellungen haben sich geändert';
  return null;
}
function kistenZuruecksetzen(S, namen) {
  const nn = namen.flatMap(n => String(n).split(TOPF_SEP));
  S.kisten = S.kisten.filter(k => !keyNamen(k).some(n => nn.includes(n)));
  for (const n of nn) delete S.packplaene[n];
}
const kistenGewogenAnzahl = (S, namen) => { const nn = namen.flatMap(n => String(n).split(TOPF_SEP)); return S.kisten.filter(k => keyNamen(k).some(n => nn.includes(n)) && kisteGewogen(k)).length; };
const kistenTiere = S => [...new Set(S.kisten.flatMap(keyNamen))];
// seit 3.1.1 (Wunsch Nutzer): sobald kommissioniert wird (erste gewogene/abgehakte Zeile, gepackte Bestellung oder Hofladen-Päckchen),
// ist der Kistenplan des Tiers bzw. Topfs gesperrt – kein Neuberechnen/Zurücksetzen, kein automatisches Umplanen
function kommissionierBegonnen(S, namen) {
  const nn = [...new Set(namen.flatMap(n => String(n).split(TOPF_SEP)).flatMap(n => tier(S, n) && !tier(S, n).archiv ? abholGruppe(S, n) : [n]))];
  if (S.bestellungen.some(o => nn.includes(o.tier) && (Object.keys(o.komm || {}).length || o.status === 'gepackt' || o.status === 'abgeholt'))) return true;
  return nn.some(n => ((tier(S, n) || {}).hofPacks || []).length > 0);
}
// Zu welchen Bestellungen gehören die Kisten eines Tiers? Gemeinsame Kisten (Topf) → alle Bestellungen des Topfs
function kistenKontext(S, tierName) {
  const rows = kistenRows(S, tierName);
  const key = (rows.find(k => String(k.tier).includes(TOPF_SEP)) || {}).tier;
  if (key) { const t = topfAus(S, key.split(TOPF_SEP)); return { t, ords: ordersOfTopf(S, t), rows: rows.filter(k => k.tier === key), key, topf: !!(t && t.glieder) }; }
  const t = tier(S, tierName);
  return { t, ords: t ? ordersOfTier(S, t.name) : [], rows, key: tierName, topf: false };
}
function kistenSumme(S, tierName, artName) { return S.kisten.filter(k => k.tier === tierName && k.art === artName).reduce((s, k) => s + num(k.kg), 0); }
// Menge je Genusspaket (feste Zusammensetzung aus den Einstellungen)
function anteilJePaket(S, t, artName) { return paketKgArt(S, artName); }
// Berechnung Kistenblatt: je Zeile Start, Bedarf, verplant, Rest
function kistenCalc(S, tierName) {
  const { t, rows, ords } = kistenKontext(S, tierName);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const startMap = {};
  return rows.map(k => {
    const start = startMap[k.art] || 0;
    startMap[k.art] = start + num(k.kg);
    const anteil = t ? anteilJePaket(S, t, k.art, true) : 0;
    const bedarf = ords.reduce((s, o) => s + qty(S, o, k.art) - specSum(S, o, k.art), 0) + pak * anteil;
    const verplant = Math.max(0, Math.min(start + num(k.kg), bedarf) - start);
    const a = art(S, k.art);
    const sonderInhalt = k.art === SONDERKISTE ? ords.flatMap(o => sonderOf(S, o).filter(s => num(s.menge) > 0 && !istOrgan(s.art) && (!k.sonder || k.sonder.includes(o.nr + '|' + s.art))).map(s => `Nr. ${o.nr}: ${s.art} ${fmtNum(s.menge, 3)} ${(art(S, s.art) || {}).einheit || 'kg'}${s.wunsch ? ' ' + s.wunsch : ''}`)).join(' · ') : '';
    return { k, start, anteil, bedarf, verplant, rest: num(k.kg) - verplant, einheit: a ? a.einheit : '', teile: sonderInhalt || (k.info ? k.info : a && k.art !== HACK ? a.teile : '') };
  });
}
// Tier abgeschlossen: Reste an Hofladen, Kisten leeren
// Topf (gemeinsame Kisten): alle Tiere des Topfs werden zusammen abgeschlossen
const abschlussNamen = (S, tierName) => { const c = kistenKontext(S, tierName); return c.topf ? c.t.glieder.slice() : [tierName]; };
function tierAbschliessen(S, tierName) {
  const ctx = kistenKontext(S, tierName);
  const namen = ctx.topf ? ctx.t.glieder : [tierName];
  const calc = kistenCalc(S, tierName);
  let n = 0;
  const heute = todayISO();
  // seit 3.1: gewogene Hofladen-Päckchen (mit Kühlhaus-Kiste) statt rechnerischem Rest, wo es sie gibt
  const T0 = hofTraeger(S, tierName), packs = (T0 && T0.hofPacks) || [];
  const hofName = ctx.topf ? ctx.key : tierName;
  for (const c of calc) {
    if (c.k.art === 'Sonderfälle (beschriftet)') continue;
    const pk = packs.filter(x => x.key === c.k.nr + '|' + c.k.art);
    if (pk.length) { for (const x of pk) { S.hofladen.push({ datum: heute, tier: hofName, kiste: c.k.nr, art: c.k.art, ...(x.teil ? { teil: x.teil } : {}), rest: c.einheit === 'Stk' ? num(x.stk) || 1 : r3(num(x.kg)), einheit: c.einheit, ...(x.stk && c.einheit !== 'Stk' ? { stk: x.stk } : {}), ...(c.einheit === 'Stk' && x.kg ? { kg: x.kg } : {}), ...(x.kh ? { kuehlhaus: x.kh } : {}), paeckchen: true }); n++; } }
    else if (c.rest > 0.0001) { S.hofladen.push({ datum: heute, tier: hofName, kiste: c.k.nr, art: c.k.art, rest: r2(c.rest), einheit: c.einheit }); n++; }
  }
  // Archiv: Stand der Kisten am Ende festhalten, Tier(e) archivieren (wird nicht gelöscht).
  // Topf: erst für alle Tiere festhalten, dann archivieren (sonst zerfällt der Topf mittendrin).
  // Gewogene Kisten (Hack/Knochen) zählen für die Ausbeute anteilig nach Schlachtgewicht.
  const tiere = namen.map(x => tier(S, x)).filter(Boolean);
  const sgSum = tiere.reduce((s, t) => s + sgRechnung(S, t), 0);
  const hackGes = tiere.length ? hackAbzugPlan(S, tiere[0]) : 0;
  const kisten = calc.map(c => ({ nr: c.k.nr, art: c.k.art, kg: r2(num(c.k.kg)), gewogen: kisteGewogen(c.k), plan: has(c.k.plan) ? r2(num(c.k.plan)) : null, gew: has(c.k.gew) ? num(c.k.gew) : null, info: c.k.info || '', bedarf: r2(c.bedarf), verplant: r2(c.verplant), rest: r2(c.rest), einheit: c.einheit }));
  const umlAlle = Object.fromEntries(tiere.map(t => [t.name, umleitung(t, S)]));
  tiere.forEach(t => archivStandFesthalten(S, t));
  for (const t of tiere) {
    const anteil = ctx.topf && sgSum > 0 ? sgRechnung(S, t) / sgSum : 1;
    t.abschluss = { datum: heute, hackAbzug: r2(hackGes * anteil), kisten };
    if (Object.keys(umlAlle[t.name] || {}).length) t.abschluss.umleitung = umlAlle[t.name];
    if (ctx.topf) { t.abschluss.anteil = r3(anteil); t.abschluss.topf = namen.slice(); t.topfMit = namen.slice(); }
  }
  tiere.forEach(t => { t.archiv = heute; });
  S.kisten = S.kisten.filter(k => !(k.tier === tierName || (ctx.topf && k.tier === ctx.key)));
  return n;
}

// ---------- Kommissionierung ----------
function kommissionierung(S, nr) {
  const o = S.bestellungen.find(x => x.nr === nr);
  if (!o) return null;
  const t0 = tier(S, o.tier);
  const ctx = t0 ? kistenKontext(S, t0.name) : null; // Topf: gemeinsame Kisten, Reihenfolge über alle Bestellungen
  const t = ctx ? ctx.t : null;
  const alle = ctx ? ctx.ords : [];
  const idx = alle.findIndex(x => x.nr === nr);
  const vorher = idx > 0 ? alle.slice(0, idx) : [];
  const pakGes = alle.reduce((s, x) => s + num(x.pakete), 0);
  // Aufteilung der Kisten: zuerst alle Genusspaket-Anteile (Vorrang), dann die Einzelartikel nach Bestell-Nr.
  const rows = S.artikel.map(a => {
    const D = t ? anteilJePaket(S, t, a.name, false) : 0;
    const E = Math.max(0, qty(S, o, a.name) - specSum(S, o, a.name));
    const F = num(o.pakete) * D;
    const G = E + F;
    const pakVorher = vorher.reduce((s, x) => s + num(x.pakete) * D, 0);
    const einzVorher = pakGes * D + vorher.reduce((s, x) => s + Math.max(0, qty(S, x, a.name) - specSum(S, x, a.name)), 0);
    return { art: a.name, einheit: a.einheit, anteil: D, einzeln: E, ausPak: F, bedarf: G, vorher: pakVorher + (einzVorher - pakGes * D),
      bereiche: [[pakVorher, pakVorher + F], [einzVorher, einzVorher + E]] };
  });
  const picks = [];
  if (t) {
    for (const c of kistenCalc(S, t0.name)) {
      const r = rows.find(x => x.art === c.k.art);
      if (!r) continue;
      const von = c.start, bis = c.start + num(c.k.kg);
      const m = r.bereiche.reduce((s, [a0, a1]) => s + Math.max(0, Math.min(bis, a1) - Math.max(von, a0)), 0);
      if (m > 0.0001) {
        let verp = '';
        if (c.k.art === HACK) verp = 'vom Hack-Tisch (fertig verpackt)';
        else if (c.k.art === OCHS) verp = ochsGanz(S, o) ? 'ganz – wiegen, Preis nach kg' : 'geschnitten – wiegen, Preis nach kg';
        else {
          const po = portionOf(S, o, c.k.art); if (po) verp = po.stk > 0 ? `einzeln ${fmtNum(po.stk)} Stück${po.pack ? ' (' + po.text + ')' : ''}, ca. ${fmtNum(po.kg, 1)} kg` : (po.kg > 0 ? `einzeln ${fmtNum(po.kg, 2)} kg als ` : '') + po.text;
          const pz = num(o.pakete) > 0 ? paketListe(S).filter(x => x.art === c.k.art) : [];
          if (pz.length) verp += (verp ? ' · ' : '') + 'Paket: ' + pz.map(x => `${fmtNum(num(o.pakete) * num(x.anzahl))} × ${gText(paketG(S, x))}`).join(' + ');
        }
        if (c.k.info && c.k.art !== OCHS) verp = `Kiste enthält: ${c.k.info}` + (verp ? ' · ' + verp : '');
        picks.push({ kiste: c.k.nr, menge: r2(m + 1e-9), roh: m, einheit: c.einheit, art: c.k.art, verpacken: verp, platz: c.k.platz || '' });
      }
    }
    // Hackfleisch packt die Hilfsperson vorab am Hack-Tisch – hier nur als fertige Tüten, ohne Kistennummer
    const hp = picks.filter(p => p.art === HACK);
    if (hp.length) {
      const r = rows.find(x => x.art === HACK), teile = [];
      if (r.einzeln > 0) { const po = portionOf(S, o, HACK); teile.push(po ? po.text : `${fmtNum(r.einzeln, 2)} kg in 1 Tüte`); }
      if (r.ausPak > 0) teile.push('Paket: ' + hackPaketText(S, o.pakete, o.pakVak));
      const roh = hp.reduce((s, p) => s + p.roh, 0), summe = r2(roh + 1e-9);
      for (const p of hp) picks.splice(picks.indexOf(p), 1);
      picks.push({ kiste: null, hackTisch: true, menge: summe, roh, einheit: 'kg', art: HACK, verpacken: 'vom Hack-Tisch, fertig verpackt: ' + teile.join(' + '), platz: '' });
    }
    // Sonderfälle vom Metzger (beschriftet mit der Bestell-Nr.) liegen in der Sonderfälle-Kiste
    const skAlle = ctx.rows.filter(k => k.art === SONDERKISTE);
    let si = 0;
    for (const s of sonderOf(S, o)) {
      si++;
      if (!(num(s.menge) > 0) || istOrgan(s.art)) continue;
      const a = art(S, s.art);
      const sk = skAlle.find(k => k.sonder && k.sonder.includes(o.nr + '|' + s.art)) || skAlle.find(k => !k.sonder) || null;
      picks.push({ kiste: sk ? sk.nr : null, sonderfall: true, key: 'S' + si + '|' + s.art, menge: r2(num(s.menge)), roh: 0, einheit: a ? a.einheit : 'kg', art: s.art,
        verpacken: `Sonderfall${s.wunsch ? ' „' + s.wunsch + '“' : ''} – beim Metzger mit Nr. ${o.nr} beschriftet${sk ? '' : ' (keine Kiste dafür im Plan)'}`, platz: sk ? sk.platz || '' : '' });
    }
    picks.sort((a, b) => (a.kiste === null ? -1 : a.kiste) - (b.kiste === null ? -1 : b.kiste));
  }
  rows.forEach(r => { r.ausKisten = picks.filter(p => p.art === r.art).reduce((s, p) => s + p.roh, 0); r.fehlt = istOrgan(r.art) ? 0 : (r.bedarf - r.ausKisten > 0.05 ? r.bedarf - r.ausKisten : 0); });
  const innereien = ORGANE.map(n => { const q = qty(S, o, n); const a = art(S, n); return q > 0 ? `${fmtNum(q, 3)} ${a ? a.einheit : ''} ${n}` : ''; }).filter(Boolean);
  const sonder = sonderOf(S, o).map(s => sonderText(S, s));
  // Ist-Werte (seit 3.1): je Pick-Zeile gespeichert (o.komm[key]); Hack/Innereien nur abhaken
  for (const p of picks) {
    if (!p.key) p.key = (p.hackTisch ? 'H' : p.kiste === null ? '-' : p.kiste) + '|' + p.art;
    p.wiegen = !ohneWiegen(p.art);
    p.ist = (o.komm || {})[p.key] || null;
    p.stkSoll = stkSoll(S, p);
  }
  return { o, tier: t, rows, picks, innereien, sonder, nichtVak: nichtVak(S, o) };
}

// ---------- Hackfleisch-Zettel ----------
// Portionierung für den Hack-Zettel: geht ein Teil als Sonderwunsch separat (z. B. mager), nur den Rest portionieren
function hackPortionText(po, ein, gesamt) {
  if (!po) return `${fmtNum(ein, 3)} kg in 1 Tüte`;
  if (ein >= gesamt - 0.0005) return po.text;
  if (po.g > 0) {
    const n = Math.round(ein * 1000 / po.g);
    if (n > 0 && Math.abs(n * po.g / 1000 - ein) < 0.0005) return `${fmtNum(n)} × ${fmtNum(po.g)} g`;
    return `${fmtNum(ein, 3)} kg (Portionen à ${fmtNum(po.g)} g)`;
  }
  return `${fmtNum(ein, 3)} kg in 1 Tüte`;
}
// Hack insgesamt: gewogene/geplante Hack-Kisten, sonst Metzger-Vorgabe
function hackGesamt(S, tierName) {
  const ctx = kistenKontext(S, tierName), hk = ctx.rows.filter(k => k.art === HACK);
  if (hk.length) return { kg: hk.reduce((s, k) => s + num(k.kg), 0), gewogen: hk.every(k => kisteGewogen(k)), quelle: 'kisten' };
  const pp = S.packplaene && S.packplaene[tierName];
  const ma = metzgerauftrag(S, tierName, pp && pp.gruppe ? pp.hackKisteKg : null);
  return { kg: ma ? num(ma.hack.vorgabe) : 0, gewogen: false, quelle: 'plan' };
}
function hackHofladen(S, tierName, t, bestellt) {
  const g = hackGesamt(S, tierName), rest = g.kg - bestellt;
  const T = t && t.glieder ? tier(S, t.glieder[0]) : t;
  const out = { gesamt: g.kg, gewogen: g.gewogen, rest, n500: 0, n1000: 0, restG: 0, text: '', ok: !!(T && T.hackHofOk) };
  if (!(rest > 0.25)) return out;
  const p = Math.min(100, Math.max(0, has(S.settings.hackHof500Prozent) ? num(S.settings.hackHof500Prozent) : 50)) / 100;
  let g500 = Math.floor(rest * p / 0.5 + 1e-9);
  let n1000 = Math.floor((rest - g500 * 0.5) + 1e-9);
  let uebrig = rest - g500 * 0.5 - n1000;
  const dazu = Math.floor(uebrig / 0.5 + 1e-9); g500 += dazu; uebrig -= dazu * 0.5; // was für 1 kg nicht reicht, in 500-g-Päckchen
  out.n500 = g500; out.n1000 = n1000; out.restG = Math.round(uebrig * 1000);
  out.text = [g500 ? `${g500} × 500 g` : '', n1000 ? `${n1000} × 1 kg` : ''].filter(Boolean).join(' + ') + (out.restG >= 50 ? ` + Rest ca. ${out.restG} g` : '');
  return out;
}
function hackHofUmschalten(S, tierName) {
  const T = topfTier(S, tierName); if (!T) return;
  const neu = !hackHofladen(S, tierName, T, 0).ok;
  for (const n of T.glieder || [T.name]) { const x = tier(S, n); if (x) { if (neu) x.hackHofOk = true; else delete x.hackHofOk; } }
}
function hackZettel(S, tierName) {
  const t = topfTier(S, tierName);
  if (!t) return null;
  const hackPk = paketKgArt(S, HACK);
  const rows = [];
  for (const o of ordersOfTopf(S, t)) {
    const ein = qty(S, o, HACK) - specSum(S, o, HACK);
    const pak = num(o.pakete);
    if (!(ein > 0) && !(pak > 0)) continue;
    const po = portionOf(S, o, HACK);
    const vak = vakArtikel(S, o).includes(HACK);
    const ausPak = pak > 0 && hackPk > 0 ? r3(pak * hackPk) : null;
    const pv = num(o.pakVak);
    rows.push({
      nr: o.nr, name: o.name,
      einzeln: ein > 0 ? r3(ein) : null,
      einzelnAls: ein > 0 ? hackPortionText(po, ein, qty(S, o, HACK)) : '',
      einzelnVak: ein > 0 ? (vak ? 'VAKUUM' : 'Tüte') : '',
      pakete: pak > 0 ? pak : null,
      ausPak,
      ausPakAls: ausPak ? hackPaketText(S, pak, pv) : '',
      pakVak: pak > 0 ? (pv >= pak ? 'VAKUUM' : pv > 0 ? `${pv} Paket(e) VAKUUM, Rest Tüte` : 'Tüte') : '',
      ok: !!o.hackOk
    });
  }
  const sumEinzeln = rows.reduce((s, r) => s + num(r.einzeln), 0), sumPak = rows.reduce((s, r) => s + num(r.ausPak), 0);
  // Hofladen (seit 3.0.8): was an Hack nach allen Bestellungen übrig bleibt – alles vakuumiert, x % in 500-g-, Rest in 1-kg-Päckchen
  const hof = hackHofladen(S, tierName, t, sumEinzeln + sumPak);
  return { tier: t, rows, sumEinzeln, sumPak, hof };
}

// ---------- Innereien ----------
// Abhaken (seit 3.0.6): erledigt-Häkchen auf Hack-Zettel (o.hackOk) und Innereien (o.innOk, Rest je Tier t.innRestOk)
// Topf: Rest-Häkchen stehen bei allen Tieren des Topfs gleich
function innRestOk(S, t, art) { const t0 = t && t.glieder ? tier(S, t.glieder[0]) : t; return !!(t0 && t0.innRestOk && t0.innRestOk[art]); }
function innRestUmschalten(S, tierName, art) {
  const T = topfTier(S, tierName); if (!T) return;
  const neu = !innRestOk(S, T, art);
  for (const n of T.glieder || [T.name]) { const x = tier(S, n); if (!x) continue; x.innRestOk = x.innRestOk || {}; if (neu) x.innRestOk[art] = true; else delete x.innRestOk[art]; }
}
// Nach dem Zuschnitt (seit 3.0.6): tatsächlich vorhandene Innereien (Leber kg gewogen, sonst Stück) – Topf: gilt für alle Tiere zusammen
function innIst(S, t) { const t0 = t && t.glieder ? tier(S, t.glieder[0]) : t; return (t0 && t0.innIst) || {}; }
function innIstSetzen(S, tierName, art, wert) {
  const T = topfTier(S, tierName); if (!T) return;
  for (const n of T.glieder || [T.name]) { const x = tier(S, n); if (!x) continue; x.innIst = x.innIst || {}; if (wert === null) delete x.innIst[art]; else x.innIst[art] = wert; if (!Object.keys(x.innIst).length) delete x.innIst; }
}
function innereien(S, tierName) {
  const t = topfTier(S, tierName);
  if (!t) return null;
  const st = S.settings;
  const ords = ordersOfTopf(S, t);
  const lp = num(st.leberPortionG) || 500;
  const nT = topfN(t);
  const schaetz = { Leber: num(st.leberKg) * nT, Nieren: num(st.nierenStk) * nT, Herz: num(st.herzStk) * nT, Zunge: num(st.zungeStk) * nT, 'Bäckle': (has(st.baeckleStk) ? num(st.baeckleStk) : 2) * nT };
  const ist = innIst(S, t), vorh = {};
  for (const n of ORGANE) vorh[n] = has(ist[n]) ? num(ist[n]) : schaetz[n];
  const uebersicht = ORGANE.map(n => {
    const best = ords.reduce((s, o) => s + qty(S, o, n), 0);
    const rest = vorh[n] - best;
    let txt;
    if (rest < -1e-9) txt = 'ZU VIEL BESTELLT';
    else if (n === 'Leber') {
      if (rest < 0.05) txt = '–';
      else { const g = Math.round(rest * 1000); txt = `${Math.floor(g / lp)} × ${lp} g vakuumieren` + (g % lp > 0 ? ` + Rest ca. ${g % lp} g` : ''); }
    } else if (Math.abs(rest) < 1e-9) txt = '–';
    else if (n === 'Nieren') txt = `${fmtNum(rest)} × einzeln vakuumieren`;
    else txt = `${fmtNum(rest)} × vakuumieren`;
    return { art: n, vorhanden: vorh[n], schaetz: schaetz[n], gewogen: has(ist[n]), bestellt: best, rest, txt, einheit: n === 'Leber' ? 'kg' : 'Stk', ok: innRestOk(S, t, n) };
  });
  // Zuteilung in Reihenfolge der Bestellungen: reicht es nicht (z. B. nach dem Zuschnitt), fehlt es den letzten
  const pool = Object.assign({}, vorh);
  const rows = ords.filter(o => ORGANE.some(n => qty(S, o, n) > 0)).map(o => {
    const v = vakArtikel(S, o).filter(n => ORGANE.includes(n));
    const po = portionOf(S, o, 'Leber');
    const lq = qty(S, o, 'Leber');
    const fehlt = {};
    for (const n of ORGANE) { const q = qty(S, o, n); if (!(q > 0)) continue; const a = Math.min(q, Math.max(0, pool[n])); pool[n] -= q; if (q - a > 0.001) fehlt[n] = q - a; }
    return { nr: o.nr, name: o.name, fehlt, leber: lq || null, leberAls: lq > 0 ? (po ? po.text : fmtNum(lq, 3) + ' kg') : '',
      nieren: qty(S, o, 'Nieren') || null, herz: qty(S, o, 'Herz') || null, zunge: qty(S, o, 'Zunge') || null, baeckle: qty(S, o, 'Bäckle') || null,
      vak: v.length ? v.join(' ') : 'nein', ok: !!o.innOk };
  });
  return { tier: t, uebersicht, rows };
}

// ---------- Packliste Kühlhaus ----------
function packliste(S, tierName) {
  const t = topfTier(S, tierName);
  if (!t) return null;
  return { tier: t, rows: ordersOfTopf(S, t).map(o => ({
    nr: o.nr, name: o.name, tel: o.tel, text: bestellText(S, o), sonder: sonderOf(S, o).map(s => sonderText(S, s)).join('; '),
    schaetz: schaetzpreis(S, o), endbetrag: has(o.endbetrag) ? num(o.endbetrag) : null, status: o.status || 'offen', notiz: o.packNotiz || '', zahlOffen: zahlungOffen(o), lager: lagerText(o), lagerVorschlag: lagerVorschlag(S, o).ort })) };
}

// ---------- Lagerplatz nach dem Packen ----------
// Regel: weniger als X Artikel UND leichter als Y kg -> Kühlschrank, sonst Metzgerkiste im Kühlraum
const LAGER = ['Kühlschrank', 'Kühlraum'];
function lagerVorschlag(S, o) {
  const st = S.settings;
  const maxArt = num(st.lagerMaxArtikel) || 3, maxKg = num(st.lagerMaxKg) || 5;
  let artikel = S.artikel.filter(a => qty(S, o, a.name) > 0).length + (num(o.pakete) > 0 ? 1 : 0);
  const t = tier(S, o.tier);
  const paketKg = paketGewicht(S);
  const kg = einzelKg(S, o) + num(o.pakete) * paketKg;
  const klein = artikel < maxArt && kg < maxKg;
  return { ort: klein ? 'Kühlschrank' : 'Kühlraum', artikel, kg, grund: `${artikel} Artikel, ca. ${fmtNum(kg, 1)} kg` };
}
// Lagerplatz-Nummer (seit 1.9.7 nur Zahl): Kühlschrank → „Fach n“, Kühlraum → „Kiste n“; alte Freitexte bleiben lesbar
const lagerNr = o => { const m = String((o && o.lagerPlatz) || '').match(/\d+/); return m ? +m[0] : null; };
const lagerPlatzText = o => { const p = String(o.lagerPlatz || '').trim(); if (!p) return ''; return /^\d+$/.test(p) ? (o.lagerOrt === 'Kühlschrank' ? 'Fach ' : 'Kiste ') + p : p; };
// Bezahlung (seit 1.9.7): abgeholt, aber noch nicht bezahlt → Erinnerung auf der Übersicht
const zahlungOffen = o => !!o && (o.status || 'offen') === 'abgeholt' && !!o.zahlungOffen;
const offeneZahlungen = S => (S.bestellungen || []).filter(zahlungOffen).sort((a, b) => String(a.abgeholtAm || '').localeCompare(String(b.abgeholtAm || '')) || a.nr - b.nr);
// Status setzen mit allem, was dazugehört (abgeholt am, fester Preis, Lager leeren bei „offen“)
function statusSetzen(S, o, neu, zahlungOffenJa) {
  o.status = neu;
  if (neu === 'offen') { o.lagerOrt = ''; o.lagerPlatz = ''; o.gepacktAm = null; }
  if (neu === 'abgeholt') { o.abgeholtAm = o.abgeholtAm || todayISO(); if (zahlungOffenJa !== undefined) o.zahlungOffen = !!zahlungOffenJa; preisFestsetzen(S, o); }
  else { delete o.abgeholtAm; delete o.zahlungOffen; if (!preisBleibtFest(S, o)) delete o.preisFest; }
}
const lagerText = o => o.lagerOrt ? (o.lagerOrt === 'Kühlraum' ? 'Kühlraum (Metzgerkiste)' : o.lagerOrt) + (o.lagerPlatz ? ' – ' + lagerPlatzText(o) : '') : '';

// ---------- Hofladen ----------
function hofladenSummen(S, jahr) {
  const m = {};
  for (const h of S.hofladen) {
    if (jahr && !String(h.datum).startsWith(String(jahr))) continue;
    const key = h.art + '|' + h.einheit;
    m[key] = (m[key] || 0) + num(h.rest);
  }
  return Object.entries(m).map(([k, v]) => ({ art: k.split('|')[0], einheit: k.split('|')[1], summe: r2(v) }));
}

// ---------- Datenstand ----------
function leererStand() {
  const d = JSON.parse(JSON.stringify(DEFAULTS));
  const S0 = {
    app: 'Bestellsystem Bergwiesenhof', version: 1, schema: 9, gespeichert: null,
    artikel: d.artikel, settings: d.settings, auto: d.auto, wege: d.wege,
    kunden: [], tiere: [], bestellungen: [], kisten: [], hofladen: [],
    metzgerManuell: {}, packplaene: {}, letzteSicherung: null
  };
  S0.settings.preislisten = [preislisteAus(S0, parseDate(S0.settings.preiseAb) || '2000-01-01')];
  return S0;
}
function bewegungsdatenLeeren(S, mitKunden) {
  S.bestellungen = []; S.tiere = []; S.kisten = []; S.hofladen = []; S.metzgerManuell = {}; S.packplaene = {};
  if (mitKunden) S.kunden = [];
}
function standPruefen(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.bestellungen) || !Array.isArray(x.artikel)) throw new Error('Keine gültige Sicherungsdatei des Bestellsystems.');
  const base = leererStand();
  const altSchema = num(x.schema);
  if (!(altSchema >= 8)) throw new Error('Die Sicherung stammt aus einer Version vor 1.9.0 und kann nicht mehr eingespielt werden.');
  const hattePreislisten = !!(x.settings && Array.isArray(x.settings.preislisten) && x.settings.preislisten.length);
  for (const k of Object.keys(base)) if (x[k] === undefined) x[k] = base[k];
  x.settings = Object.assign({}, base.settings, x.settings);
  // letzte Bestellung und Anlagedatum je Kunde (für die Löschfrist; bleibt auch erhalten, wenn Bestellungen gelöscht werden)
  (x.kunden || []).forEach(k => {
    k.letzte = (x.bestellungen || []).filter(o => sameText(o.name, k.name)).reduce((m, o) => (o.eingang || '') > m ? o.eingang : m, k.letzte || '');
    if (!k.angelegt) k.angelegt = k.letzte || todayISO();
  });
  // Version 1.9.6: Sicherungen vor 1.9.0 werden nicht mehr umgebaut (alte Umbauschritte entfernt)
  ['preislisteTitel', 'skKg', 'fkKg', 'preisTuete'].forEach(f => delete x.settings[f]);
  if (!(altSchema >= 9)) {
    // Bäckle bekommt einen Preis (15 €/kg) in der aktuellen und allen kommenden Preislisten, falls dort noch 0 €/kg
    const heute = todayISO(), akt = Array.isArray(x.settings.preislisten) && x.settings.preislisten.length ? preislisteAm(x, heute) : null;
    (x.settings.preislisten || []).forEach(p => { if ((p === akt || p.ab > heute) && p.preise && !(num(p.preise['Bäckle']) > 0)) p.preise['Bäckle'] = 15; });
    const bk = (x.artikel || []).find(a => a.name === 'Bäckle'); if (bk && !(num(bk.preis) > 0)) bk.preis = 15;
    x.schema = 9;
  }
  // Version 1.9.5: Preislisten mit „gültig ab“ – bisherige Preise werden die erste Preisliste
  if (!hattePreislisten) {
    const ab = parseDate(x.settings.preiseAb) || '2000-01-01';
    x.settings.preislisten = [preislisteAus(x, ab)];
  }
  preiseAbgleichen(x);
  (x.bestellungen || []).forEach(o => { if (!has(o.preisFest) && o.name && preisBleibtFest(x, o)) preisFestsetzen(x, o); });
  // Version 1.9.3: Archiv ist Archiv – Stand archivierter Tiere einmalig festhalten (falls noch nicht geschehen)
  (x.tiere || []).forEach(t => { if (t.archiv && !t.archivStand) archivStandFesthalten(x, t); });
  return x;
}

if (typeof module !== 'undefined') module.exports = {
  num, has, r1, r2, r3, roundUp, fmtNum, fmtIn, fmtKg, fmtEur, fmtDate, parseDate, todayISO, sameText,
  art, einheitForm, istOrgan, ausbeuteArtikel, qty, sonderOf, specSum, sonderText, ganzArt, ganzStueckKg, ganzWunschFehlt, bugWunsch, bratenTeile, portionenOf, portionOf, vakArtikel, istVak,
  tuetenAuto, tueten, nichtVak, packParse, packGilt, schaetzpreis, bestellText, einzelKg, formFehler, ordersOfTier, nextNr, tier, sgRechnung, yieldArt,
  tierInfo, lagerVorschlag, lagerText, zahlungOffen, offeneZahlungen, statusSetzen, lagerNr, lagerPlatzText, anteilVon, teilZeilen, teilFehlmengen, fehlDetail, fehlKgText, teilVorschlag, bestellungTeilen, mengencheckTier, mengencheck, tierVorschlag, neuVerteilenPlan, neuVerteilenUebernehmen, kistenplaeneAktualisieren, wartelistePassend, wartelistePruefung, tierUmbenennen, kundePflegen, kundenStat, kundenVorschlaege, bestellIndex, ANONYM, kundeLetzte, kundenFrist, inaktiveKunden, kundeAnonymisieren,
  mengenpruefung, metzgerauftrag, topfTier, topfAus, topfN, ordersOfTopf, tierAnzeige, kistenKontext, abschlussNamen, mengencheckT, TOPF_SEP, packplan, packplanUebernehmen, packplanGruppe, abholGruppe, kistenRows, kistenTiere, SONDERKISTE, bestellFingerabdruck, kistenplanVeraltet, kistenZuruecksetzen, kistenGewogenAnzahl, kistenCalc, tierAbschliessen,
  kommissionierung, hackZettel, innereien, packliste, hofladenSummen, leererStand, bewegungsdatenLeeren, standPruefen,
  HACK, GULASCH, ORGANE, OCHS, ochsGanz, anteilRef, teilKgRef, ausbeuteStatistik, gemessen, gemessenRoh, wiegeArten, ausbeuteTier, erfassungSumme, preislisten, preislisteAm, preisFestsetzen, preisBleibtFest, preisDatum, artPreis, paketPreisKg, vakPreisPaket, preiseAbgleichen, preislisteAus, kistenAusbeute, kisteGewogen, KISTEN_AUSBEUTE, archivStandFesthalten, zaehltStatistik, STAT_MIN_TIERE, setDefaults: d => { global.DEFAULTS = d; }
};
