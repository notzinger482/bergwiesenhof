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
function erfassungSumme(t) {
  const art = {}, teil = {};
  let kg = 0, teile = 0;
  for (const e of (t && t.erfassung) || []) {
    const w = num(e.kg); if (!(w > 0)) continue;
    const a = art[e.art] = art[e.art] || { kg: 0, teile: 0 }; a.kg += w; a.teile++;
    if (e.teil) { const x = teil[e.teil] = teil[e.teil] || { kg: 0, teile: 0 }; x.kg += w; x.teile++; }
    kg += w; teile++;
  }
  return { art, teil, kg, teile };
}
// zählt für die Statistik: archiviert, nicht ausgeblendet, echtes Schlachtgewicht, etwas gewogen
const zaehltStatistik = t => !!(t && t.archiv) && !t.ohneStatistik && num(t.sg) > 0 && ((t.erfassung || []).length > 0);
function ausbeuteStatistik(S) {
  const tiere = (S.tiere || []).filter(zaehltStatistik);
  const sig = tiere.map(t => [t.name, t.typ, t.sg, t.erfassung.length, t.erfassung.reduce((s, e) => s + num(e.kg), 0)].join('|')).join(';') + '#' + (S.settings.bratenTeile || []).map(x => x && x.name + ':' + x.stueck).join(',');
  const c = statCache && statCache.get(S);
  if (c && c.sig === sig) return c.stat;
  const roh = { Rind: { art: {}, teil: {} }, Bulle: { art: {}, teil: {} } };
  for (const t of tiere) {
    const typ = t.typ === 'Bulle' ? 'Bulle' : 'Rind', sg = num(t.sg), su = erfassungSumme(t);
    for (const [n, v] of Object.entries(su.art)) (roh[typ].art[n] = roh[typ].art[n] || []).push({ tier: t.name, wert: v.kg / sg });
    for (const x of bratenTeile(S)) { const v = su.teil[x.name]; if (v) (roh[typ].teil[x.name] = roh[typ].teil[x.name] || []).push({ tier: t.name, wert: v.kg / num(x.stueck) }); }
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
    if (a.name === BRATEN && bratenTeile(S).length) bratenTeile(S).forEach(x => out.push({ art: BRATEN, teil: x.name }));
    else out.push({ art: a.name, teil: '' });
  }
  return out;
}
// Teile, die am Ende je Artikel zur Verfügung standen (für das Archiv)
function ausbeuteTier(S, t) {
  const su = erfassungSumme(t), sg = num(t.sg);
  const rows = ausbeuteArtikel(S).map(a => {
    const v = su.art[a.name];
    return { art: a.name, kg: v ? v.kg : 0, teile: v ? v.teile : 0, anteil: v && sg > 0 ? v.kg / sg : null, ref: anteilRef(S, a, t.typ), plan: yieldArt(S, t, a.name) };
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
  for (const s of (o.sonder || [])) if (s && s.art) out.push({ art: s.art, menge: has(s.menge) ? num(s.menge) : null, wunsch: s.wunsch || '' });
  return out;
}
const specSum = (S, o, name) => sonderOf(S, o).filter(s => s.art === name).reduce((t, s) => t + num(s.menge), 0);
const sonderText = (S, s) => {
  const a = art(S, s.art);
  return (has(s.menge) ? fmtNum(s.menge, 3) + ' ' + (a ? a.einheit : '') + ' ' : '') + s.art + (s.wunsch ? ' – ' + s.wunsch : '');
};
// Portionierung: [{art, anzahl, g, text, kg}]
function portionenOf(S, o) {
  const out = [];
  for (const a of S.artikel) {
    const p = o.pos && o.pos[a.name];
    if (!p) continue;
    if (a.beutelG > 0 && num(p.menge) > 0) {
      out.push({ art: a.name, anzahl: num(p.menge), g: a.beutelG, text: `${fmtNum(p.menge)} × ${fmtNum(a.beutelG)} g`, kg: r3(num(p.menge) * a.beutelG / 1000) });
    } else if (a.einheit !== 'Stk' && num(p.anzahl) > 0) {
      const g = num(p.g);
      const kgG = g > 0 ? g : posStueckG(S, a, p, o);
      out.push({ art: a.name, anzahl: num(p.anzahl), g: g || null, text: g > 0 ? `${fmtNum(p.anzahl)} × ${fmtNum(g)} g` : istWade(a, p) ? `${fmtNum(p.anzahl)} ${num(p.anzahl) > 1 ? 'Waden' : 'Wade'} am Stück` : `${fmtNum(p.anzahl)} Stück`, kg: kgG > 0 ? r3(num(p.anzahl) * kgG / 1000) : 0 });
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
// Schätzpreis wie Spalte AC
function schaetzpreis(S, o) {
  const st = S.settings;
  let p = num(o.pakete) * paketGewicht(S) * num(st.preisPaketKg) + num(o.pakVak) * num(st.preisVakPaket);
  // alle Preise in €/kg; Stück-Artikel (Nieren, Herz, Zunge, Bäckle, Ochsenschwanz): Anzahl × Stückgewicht × €/kg
  for (const a of S.artikel) p += kgVon(S, o, a) * num(a.preis);
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
      t.push(`${fmtNum(q, 3)} ${a.einheit === 'Stk' ? 'Stk' : 'kg'} ${a.name}${po ? ' (' + po.text + ')' : ''}${ochsTxt}`);
    }
  }
  const tu = tueten(S, o);
  if (tu > 0) t.push(`${fmtNum(tu)} ${tu === 1 ? 'Tüte' : 'Tüten'} vakuumieren`);
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
    const a = art(S, s.art);
    if (!a) { f.push(`Sonderwunsch: Artikel „${s.art}“ unbekannt`); continue; }
    if (geprueft.has(s.art)) continue;
    geprueft.add(s.art);
    const q = qty(S, o, s.art);
    const eh = a.beutelG > 0 ? 'kg' : a.einheit;
    if (!(q > 0)) { f.push(`Sonderwunsch ${s.art}: der Artikel ist in der Bestellung nicht eingetragen – bitte die Menge auch rechts bei „${s.art}“ eintragen`); continue; }
    const sum = specSum(S, o, s.art); // eingetragene Sonderwünsche + „am Stück“
    if (sum > q + 0.001) {
      const amSt = o.pos && o.pos[s.art] && o.pos[s.art].amStueck && a.amStueck;
      f.push(`Sonderwunsch ${s.art}: ${fmtNum(sum, 3)} ${eh} als Sonderfall, bestellt sind aber nur ${fmtNum(q, 3)} ${eh}` +
        (amSt ? ' („am Stück“ zählt schon die ganze Menge als Sonderfall)' : ''));
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
  const neu = { nr: nextNr(S), rang: nextRang(S), eingang: o.eingang, tier: ziel, name: o.name, tel: o.tel, mail: o.mail, weg: o.weg, notiz: `Teil von Nr. ${o.nr}`, wunsch: '', pakete: 0, pakVak: 0, tuetenManuell: null, pos: {}, sonder: [], endbetrag: null, status: 'offen' };
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
  o.tuetenManuell = null;
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
const yieldArt = (S, t, name) => { const a = art(S, name); return t && a ? sgRechnung(S, t) * anteilVon(S, a, t.typ) : 0; };
function tierInfo(S, t) {
  const sg = sgRechnung(S, t);
  const paketKg = paketGewicht(S);
  const ords = ordersOfTier(S, t.name);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const checks = mengencheckTier(S, t.name);
  const reichtNicht = ords.filter(o => (checks[o.nr] || '').startsWith('reicht')).length;
  const maxPak = maxPakete(S, t);
  return { sg, paketKg, pakete: pak, maxPak, frei: maxPak - pak, anzahl: ords.length, reichtNicht };
}
// Wie viele Genusspakete gibt das Tier her? (kleinster Wert über alle Paket-Teilstücke; Hack inkl. Gulasch;
// zusätzlich begrenzt durch „max. Genusspakete je Tier“)
function maxPakete(S, t) {
  let m = num(S.settings.nenner) > 0 ? num(S.settings.nenner) : 16;
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
  let bugInsHack = 0, bugFuerBraten = 0;
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
  const nen = num(S.settings.nenner) > 0 ? num(S.settings.nenner) : 16;
  for (const o of ords) {
    const f = {};
    pakCum += num(o.pakete);
    if (num(o.pakete) > 0 && pakCum > nen + 1e-9) pakUeber[o.nr] = ['mehr als ' + nen];
    if (pakFehlt[o.nr]) pakUeber[o.nr] = (pakUeber[o.nr] || []).concat(pakFehlt[o.nr]);
    for (const name of Object.keys(topf)) {
      let q = qty(S, o, name);
      if (!(q > 0)) continue;
      if (name === HACK) {
        const a = Math.min(q, Math.max(0, hackTopf)); hackTopf -= a; q -= a;
        const b = Math.min(q, Math.max(0, bug)); bug -= b; bugInsHack += b; q -= b;
      } else if (name === BRATEN) {
        const a = Math.min(q, Math.max(0, keule)); keule -= a; q -= a;
        const b = Math.min(q, Math.max(0, bug)); bug -= b; bugFuerBraten += b; q -= b;
      } else {
        const a = Math.min(q, Math.max(0, topf[name])); topf[name] -= a; q -= a;
      }
      if (q > 0.001) f[name] = q;
    }
    fehlt[o.nr] = f;
  }
  hack.ausBug = bugInsHack;
  hack.ueberAusbeute = bugInsHack > 0.001;
  braten.bugFuerBraten = bugFuerBraten;
  // Obergrenzen (für die Anzeige in der Mengenprüfung)
  const kap = {};
  kap[HACK] = hack.ausbeuteMitGulasch + braten.bugKg - bugFuerBraten;
  kap[BRATEN] = braten.ausbeute - bugInsHack;
  return { hack, gul, braten, kap, fehlt, pakUeber };
}
const kapazitaet = (S, t, bil, name) => bil.kap[name] !== undefined ? bil.kap[name] : yieldArt(S, t, name);

// Mengencheck aller Bestellungen eines Tiers: {nr: text}
function mengencheckTier(S, tierName) {
  const t = tier(S, tierName);
  const out = {};
  if (!t) return out;
  const nen = num(S.settings.nenner) || 16;
  const ords = ordersOfTier(S, t.name);
  const bil = fleischBilanz(S, t, ords);
  const maxW = has(S.settings.maxWaden) ? num(S.settings.maxWaden) : 4;
  let waden = 0;
  for (const o of ords) {
    const f = Object.keys(bil.fehlt[o.nr] || {});
    const pw = o.pos && o.pos[BEIN], w = istWade(art(S, BEIN), pw) ? num(pw.anzahl) : 0;
    waden += w;
    if (w > 0 && waden > maxW) f.push(`Wade am Stück (max. ${maxW} je Tier)`);
    if (bil.pakUeber[o.nr]) f.unshift('Genusspakete (' + bil.pakUeber[o.nr].join(', ') + ')');
    out[o.nr] = f.length ? 'reicht nicht: ' + f.join(', ') : 'ok';
  }
  return out;
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
    if (pk > 0) {
      const bestellt = S.bestellungen.filter(o => o.tier === t.name && o.name && o.nr !== ohneNr).reduce((s, o) => s + num(o.pakete), 0);
      if (maxPakete(S, t) - bestellt < pk) return false;
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
      return mengencheckTier(T, t.name)[probe.nr] === 'ok';
    });
    if (passt) return passt.name;
  }
  return kand[0].name;
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
    .filter(x => !ordersVonKunde(S, x.k, idx).some(o => (o.status || 'offen') !== 'abgeholt' && !archiviert(o.tier)))
    .sort((a, b) => a.letzte.localeCompare(b.letzte));
}
// Kunde aus der Kundenliste löschen; seine Bestellungen bleiben für Statistik und Ausbeute, aber ohne Name, Telefon, Mail und Notiz.
function kundeAnonymisieren(S, k) {
  let n = 0;
  for (const o of S.bestellungen) if (sameText(o.name, k.name)) { o.name = ANONYM; o.tel = ''; o.mail = ''; o.notiz = ''; o.anonym = true; n++; }
  S.kunden = S.kunden.filter(x => x !== k && x.nr !== k.nr);
  return n;
}

// ---------- Mengenprüfung (Blatt "Mengenprüfung") ----------
function mengenpruefung(S, tierName) {
  const t = tier(S, tierName);
  if (!t) return null;
  const nen = num(S.settings.nenner) || 16;
  const ords = ordersOfTier(S, t.name);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const bil = fleischBilanz(S, t, ords);
  const rows = ausbeuteArtikel(S).map(a => {
    const y = kapazitaet(S, t, bil, a.name);
    const einzel = ords.reduce((s, o) => s + qty(S, o, a.name), 0);
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
function metzgerauftrag(S, tierName) {
  const t = tier(S, tierName);
  if (!t) return null;
  const nen = num(S.settings.nenner) || 16;
  const ords = ordersOfTier(S, t.name);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const { hack, gul } = fleischBilanz(S, t, ords);
  // Hackfleisch: Ausbeute + nicht bestelltes Gulasch – oder mehr, wenn mehr bestellt ist (dann Bug auflösen).
  // Separat vorbereitetes Hack (z. B. besonders mager) steht unten bei den Sonderfällen und geht hier ab.
  hack.vorgabe = Math.max(0, roundUp(hack.ausbeuteMitGulasch + hack.ausBug - hack.separat));
  const hk = num(S.settings.hackKiste) || 20;
  hack.kisten = hack.vorgabe > 0 ? roundUp(hack.vorgabe / hk) : 0;
  const voll = Math.floor((hack.vorgabe + 1e-9) / hk), rest = r1(hack.vorgabe - voll * hk);
  hack.kistenText = !hack.vorgabe ? '' : (voll ? `${voll} × ${fmtNum(hk)} kg` : '') + (rest > 0 ? `${voll ? ' + ' : ''}1 × ${fmtNum(rest)} kg` : '');
  const separat = [];
  for (const o of ords) for (const s of sonderOf(S, o)) {
    const a = art(S, s.art);
    separat.push({ nr: o.nr, name: o.name, art: s.art, menge: has(s.menge) ? fmtNum(s.menge, 3) + ' ' + (a ? a.einheit : '') : '', hinweis: s.wunsch });
  }
  const waden = ords.reduce((s, o) => { const p = o.pos && o.pos[BEIN]; return s + (istWade(art(S, BEIN), p) ? num(p.anzahl) : 0); }, 0);
  const ochsB = ords.reduce((s, o) => s + qty(S, o, OCHS), 0);
  // Ochsenschwanz: nur „am Stück“ bestellte bleiben ganz (Zeile im Metzgerauftrag), alle anderen schneidet der Metzger wie gewohnt
  const ochsGanzListe = ords.filter(o => qty(S, o, OCHS) > 0 && ochsGanz(S, o)).map(o => ({ nr: o.nr, name: o.name, stk: qty(S, o, OCHS) }));
  const ochs = { bestellt: ochsB, vorhanden: has(S.settings.ochsStk) ? num(S.settings.ochsStk) : 1, ganz: ochsGanzListe.reduce((s, x) => s + x.stk, 0), ganzListe: ochsGanzListe };
  return { tier: t, anzahl: ords.length, pakete: pak, hack, gulasch: gul, separat, waden, ochs };
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
function packplan(S, tierName) {
  const t = tier(S, tierName);
  if (!t) return { fehler: 'Tier unbekannt' };
  const st = S.settings;
  const maxKg = num(st.kisteMax) > 0 ? num(st.kisteMax) : 20;
  const dv = num(st.nenner) > 0 ? num(st.nenner) : 16;
  const hackKg = num(st.hackKiste) > 0 ? num(st.hackKiste) : 20;
  const ma = metzgerauftrag(S, t.name);
  const ords = ordersOfTier(S, t.name);
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
    else if (a.name === BRATEN) kg = Math.max(0, yt - ma.hack.ausBug - (specT[a.name] || 0)); // Bug ging ins Hack
    else if (!isOrg) kg = Math.max(0, yt - (specT[a.name] || 0));
    return { art: a.name, isOrg, shr, kg };
  });
  // Verbrauch je Bestellung als Abschnitte auf der Mengenachse: erst alle Genusspaket-Anteile
  // (Vorrang), danach die Einzelartikel – jeweils in Reihenfolge der Bestell-Nr.
  const BIG = 100000;
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
  const mcTier = mengencheckTier(S, t.name);
  const nichtOk = ords.filter(o => (mcTier[o.nr] || '').startsWith('reicht'));
  if (nichtOk.length) warnVorab.push(`${nichtOk.length} Bestellung${nichtOk.length === 1 ? ' reicht' : 'en reichen'} nicht (Nr. ${nichtOk.map(o => o.nr).join(', ')}). Der Plan stimmt erst, wenn alle Bestellungen „ok“ sind – Sonderwünsche und „am Stück“ werden zuerst zurückgelegt, dann kann anderen Bestellungen etwas fehlen. Bitte erst umstellen (Mengenprüfung) und den Plan neu berechnen.`);
  A.forEach((a, i) => {
    if (a.isOrg || !(a.kg > 0.05)) return;
    const artDef = art(S, a.art);
    const ganze = artDef && num(artDef.ganzeStuecke) > 0 ? Math.round(num(artDef.ganzeStuecke)) : 0;
    if ((a.art === BRATEN && bratenTeile(S).length) || ganze > 0) {
      // gewachsene Stücke, auf das Tier hochgerechnet; Bug-Stücke, die ins Hack gehen, fallen weg
      let stuecke = [];
      if (a.art === BRATEN && bratenTeile(S).length) {
        const yB = yieldArt(S, t, BRATEN), f = yB > 0 ? yB / bratenTeileKg(S, t.typ) : 1;
        for (const x of bratenTeile(S)) for (let n = 0; n < num(x.stueck); n++) stuecke.push({ name: x.name, kg: teilKg(x, t.typ, S) * f, bug: !!x.bug });
      } else {
        // ganze Stücke (z. B. 2 Filets, 2 Roastbeef-Stränge, 2 Hüften, 2 Tafelspitze)
        const y = yieldArt(S, t, a.art);
        for (let n = 0; n < ganze; n++) stuecke.push({ name: a.art, kg: y / ganze, bug: false });
      }
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
    const ausnahme = num(st.kisteAusnahme) > 0 ? num(st.kisteAusnahme) : 25;
    if (EINE_KISTE.includes(a.art)) { nT = a.kg <= ausnahme + 0.001 ? 1 : Math.ceil(a.kg / maxKg - 1e-9); stueck = a.kg / nT; }
    else if (a.art === HACK) { stueck = hackKg; nT = Math.floor((a.kg - 0.001) / stueck) + 1; }
    else { nT = Math.floor((a.kg - 0.001) / maxKg) + 1; stueck = a.kg / nT; }
    for (let j = 1; j <= nT; j++) {
      let w = stueck, need = BIG;
      if (a.art === HACK && j === nT) w = a.kg - (nT - 1) * stueck;
      if (a.art === HACK) need = 0;
      else need = ersteBestellung(i, (j - 1) * stueck, j * stueck);
      P.push({ art: a.art, w, need });
    }
  });
  if (specTier > 0) P.push({ art: 'Sonderfälle (beschriftet)', w: specTier, need: 0 });
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
    if (ma.ochs.bestellt > ma.ochs.vorhanden) warnVorab.push(`Ochsenschwanz: ${fmtNum(ma.ochs.bestellt)} Stk bestellt, aber nur ca. ${fmtNum(ma.ochs.vorhanden)} je Tier.`);
  }
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
  let p = 0;
  for (const i of felderRest.concat(hackIdx >= 0 ? [hackIdx] : [])) for (let j = 0; j < anz[i]; j++) if (p < pool.length) liste[i].push(pool[p++]);
  auto.forEach((f, i) => {
    cnt[i] = liste[i].length;
    liste[i].forEach((c, j) => { c.platz = i; c.ebene = cnt[i] - j; }); // erste = oberste Ebene
  });
  if (C.length < nFeld) warn.push(`Nur ${C.length} Kisten – es können nicht alle ${nFeld} Felder im Auto belegt werden.`);
  if (C.length > cap) warn.push(`Achtung: ${C.length} Kisten, aber nur ${cap} Plätze im Auto. Die Kisten ohne Platz sind markiert.`);
  if (C.length > 29) warn.push(`Mehr als 29 Kisten – es gibt nur 29 Etiketten. Nur die ersten 29 kommen ins Kisten-Blatt.`);
  const kisten = C.map((c, i) => {
    const hatPlatz = c.platz !== undefined;
    const f = hatPlatz ? auto[c.platz] : null;
    return {
      nr: i + 1, items: c.items, w: r1(c.w), text: kistenTxt(c.items),
      teile: c.items.map(it => { const a = art(S, it.art); return a && a.teile && it.art !== HACK && !it.info ? `${it.art}: ${a.teile}` : ''; }).filter(Boolean),
      platz: hatPlatz ? f.name : 'KEIN PLATZ',
      ebene: hatPlatz ? (c.ebene === cnt[c.platz] ? 'oben' : `${c.ebene}. von unten`) : '',
      platzKurz: hatPlatz ? `${f.name}, ${c.ebene === cnt[c.platz] ? 'oben' : c.ebene + '. v. u.'}` : 'KEIN PLATZ',
      ab: c.need === 0 ? 'von Anfang an' : c.need >= BIG ? 'Rest / Hofladen' : `ab Nr. ${ords[c.need - 1].nr}`,
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
  return { tier: t.name, erstellt: new Date().toISOString(), kisten, felder, einladen, cap, warn };
}
function selSort(arr, less) {
  const a = arr.slice();
  for (let i = 0; i < a.length - 1; i++) for (let j = i + 1; j < a.length; j++) if (less(a[j], a[i])) { const t = a[i]; a[i] = a[j]; a[j] = t; }
  return a;
}
// Packplan ins Kistenblatt übernehmen (max. 29 Kisten, max. 3 Inhalte je Kiste)
function packplanUebernehmen(S, pp) {
  S.kisten = S.kisten.filter(k => k.tier !== pp.tier);
  let id = S.kisten.reduce((m, k) => Math.max(m, k.id || 0), 0);
  for (const k of pp.kisten) {
    if (k.nr > 29) break;
    k.items.slice(0, 3).forEach(it => S.kisten.push({ id: ++id, tier: pp.tier, nr: k.nr, art: it.art, kg: it.kg, plan: it.kg, platz: k.platzKurz, gewogen: false, info: it.info || '' }));
  }
}

// ---------- Kisten ----------
function kistenRows(S, tierName) {
  return S.kisten.filter(k => k.tier === tierName).map((k, i) => ({ k, i })).sort((a, b) => a.k.nr - b.k.nr || a.i - b.i).map(x => x.k);
}
const kistenTiere = S => [...new Set(S.kisten.map(k => k.tier))];
function kistenSumme(S, tierName, artName) { return S.kisten.filter(k => k.tier === tierName && k.art === artName).reduce((s, k) => s + num(k.kg), 0); }
// Menge je Genusspaket (feste Zusammensetzung aus den Einstellungen)
function anteilJePaket(S, t, artName) { return paketKgArt(S, artName); }
// Berechnung Kistenblatt: je Zeile Start, Bedarf, verplant, Rest
function kistenCalc(S, tierName) {
  const t = tier(S, tierName);
  const rows = kistenRows(S, tierName);
  const ords = ordersOfTier(S, tierName);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const startMap = {};
  return rows.map(k => {
    const start = startMap[k.art] || 0;
    startMap[k.art] = start + num(k.kg);
    const anteil = t ? anteilJePaket(S, t, k.art, true) : 0;
    const bedarf = ords.reduce((s, o) => s + qty(S, o, k.art) - specSum(S, o, k.art), 0) + pak * anteil;
    const verplant = Math.max(0, Math.min(start + num(k.kg), bedarf) - start);
    const a = art(S, k.art);
    return { k, start, anteil, bedarf, verplant, rest: num(k.kg) - verplant, einheit: a ? a.einheit : '', teile: k.info ? k.info : a && k.art !== HACK ? a.teile : '' };
  });
}
// Tier abgeschlossen: Reste an Hofladen, Kisten leeren
function tierAbschliessen(S, tierName) {
  const calc = kistenCalc(S, tierName);
  let n = 0;
  const heute = todayISO();
  for (const c of calc) {
    if (c.rest > 0.0001 && c.k.art !== 'Sonderfälle (beschriftet)') { S.hofladen.push({ datum: heute, tier: tierName, kiste: c.k.nr, art: c.k.art, rest: r2(c.rest), einheit: c.einheit }); n++; }
  }
  // Archiv: Stand der Kisten am Ende festhalten, Tier archivieren (wird nicht gelöscht)
  const t = tier(S, tierName);
  if (t) {
    t.abschluss = { datum: heute, kisten: calc.map(c => ({ nr: c.k.nr, art: c.k.art, kg: r2(num(c.k.kg)), plan: has(c.k.plan) ? r2(num(c.k.plan)) : null, gew: has(c.k.gew) ? num(c.k.gew) : null, info: c.k.info || '', bedarf: r2(c.bedarf), verplant: r2(c.verplant), rest: r2(c.rest), einheit: c.einheit })) };
    t.archiv = heute;
  }
  S.kisten = S.kisten.filter(k => k.tier !== tierName);
  return n;
}

// ---------- Kommissionierung ----------
function kommissionierung(S, nr) {
  const o = S.bestellungen.find(x => x.nr === nr);
  if (!o) return null;
  const t = tier(S, o.tier);
  const alle = t ? ordersOfTier(S, t.name) : [];
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
    for (const c of kistenCalc(S, t.name)) {
      const r = rows.find(x => x.art === c.k.art);
      if (!r) continue;
      const von = c.start, bis = c.start + num(c.k.kg);
      const m = r.bereiche.reduce((s, [a0, a1]) => s + Math.max(0, Math.min(bis, a1) - Math.max(von, a0)), 0);
      if (m > 0.0001) {
        let verp = '';
        if (c.k.art === HACK) verp = 'vom Hack-Tisch (fertig verpackt)';
        else if (c.k.art === OCHS) verp = ochsGanz(S, o) ? 'ganz – wiegen, Preis nach kg' : 'geschnitten – wiegen, Preis nach kg';
        else {
          const po = portionOf(S, o, c.k.art); if (po) verp = (po.kg > 0 ? `einzeln ${fmtNum(po.kg, 2)} kg als ` : '') + po.text;
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
    picks.sort((a, b) => (a.kiste === null ? -1 : a.kiste) - (b.kiste === null ? -1 : b.kiste));
  }
  rows.forEach(r => { r.ausKisten = picks.filter(p => p.art === r.art).reduce((s, p) => s + p.roh, 0); r.fehlt = istOrgan(r.art) ? 0 : (r.bedarf - r.ausKisten > 0.05 ? r.bedarf - r.ausKisten : 0); });
  const innereien = ORGANE.map(n => { const q = qty(S, o, n); const a = art(S, n); return q > 0 ? `${fmtNum(q, 3)} ${a ? a.einheit : ''} ${n}` : ''; }).filter(Boolean);
  const sonder = sonderOf(S, o).map(s => sonderText(S, s));
  return { o, tier: t, rows, picks, innereien, sonder, tueten: tueten(S, o) };
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
function hackZettel(S, tierName) {
  const t = tier(S, tierName);
  if (!t) return null;
  const hackPk = paketKgArt(S, HACK);
  const rows = [];
  for (const o of ordersOfTier(S, t.name)) {
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
      pakVak: pak > 0 ? (pv >= pak ? 'VAKUUM' : pv > 0 ? `${pv} Paket(e) VAKUUM, Rest Tüte` : 'Tüte') : ''
    });
  }
  return { tier: t, rows, sumEinzeln: rows.reduce((s, r) => s + num(r.einzeln), 0), sumPak: rows.reduce((s, r) => s + num(r.ausPak), 0) };
}

// ---------- Innereien ----------
function innereien(S, tierName) {
  const t = tier(S, tierName);
  if (!t) return null;
  const st = S.settings;
  const ords = ordersOfTier(S, t.name);
  const lp = num(st.leberPortionG) || 500;
  const vorh = { Leber: num(st.leberKg), Nieren: num(st.nierenStk), Herz: num(st.herzStk), Zunge: num(st.zungeStk), 'Bäckle': has(st.baeckleStk) ? num(st.baeckleStk) : 2 };
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
    return { art: n, vorhanden: vorh[n], bestellt: best, rest, txt, einheit: n === 'Leber' ? 'kg' : 'Stk' };
  });
  const rows = ords.filter(o => ORGANE.some(n => qty(S, o, n) > 0)).map(o => {
    const v = vakArtikel(S, o).filter(n => ORGANE.includes(n));
    const po = portionOf(S, o, 'Leber');
    const lq = qty(S, o, 'Leber');
    return { nr: o.nr, name: o.name, leber: lq || null, leberAls: lq > 0 ? (po ? po.text : fmtNum(lq, 3) + ' kg') : '',
      nieren: qty(S, o, 'Nieren') || null, herz: qty(S, o, 'Herz') || null, zunge: qty(S, o, 'Zunge') || null, baeckle: qty(S, o, 'Bäckle') || null,
      vak: v.length ? v.join(' ') : 'nein' };
  });
  return { tier: t, uebersicht, rows };
}

// ---------- Packliste Kühlhaus ----------
function packliste(S, tierName) {
  const t = tier(S, tierName);
  if (!t) return null;
  return { tier: t, rows: ordersOfTier(S, t.name).map(o => ({
    nr: o.nr, name: o.name, tel: o.tel, text: bestellText(S, o), sonder: sonderOf(S, o).map(s => sonderText(S, s)).join('; '),
    schaetz: schaetzpreis(S, o), endbetrag: has(o.endbetrag) ? num(o.endbetrag) : null, status: o.status || 'offen', lager: lagerText(o), lagerVorschlag: lagerVorschlag(S, o).ort })) };
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
const lagerText = o => o.lagerOrt ? (o.lagerOrt === 'Kühlraum' ? 'Kühlraum (Metzgerkiste)' : o.lagerOrt) + (o.lagerPlatz ? ' – ' + o.lagerPlatz : '') : '';

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
  return {
    app: 'Bestellsystem Bergwiesenhof', version: 1, schema: 8, gespeichert: null,
    artikel: d.artikel, settings: d.settings, auto: d.auto, wege: d.wege,
    kunden: [], tiere: [], bestellungen: [], kisten: [], hofladen: [],
    metzgerManuell: {}, packplaene: {}, letzteSicherung: null
  };
}
function bewegungsdatenLeeren(S, mitKunden) {
  S.bestellungen = []; S.tiere = []; S.kisten = []; S.hofladen = []; S.metzgerManuell = {}; S.packplaene = {};
  if (mitKunden) S.kunden = [];
}
function standPruefen(x) {
  if (!x || typeof x !== 'object' || !Array.isArray(x.bestellungen) || !Array.isArray(x.artikel)) throw new Error('Keine gültige Sicherungsdatei des Bestellsystems.');
  const base = leererStand();
  const altSchema = num(x.schema);
  for (const k of Object.keys(base)) if (x[k] === undefined) x[k] = base[k];
  x.settings = Object.assign({}, base.settings, x.settings);
  if (!x.settings.hackPlatz) x.settings.hackPlatz = 'vorne rechts';
  (x.auto || []).forEach(f => { if (f.spaeter === undefined) f.spaeter = /^hinten/i.test(f.name || ''); });
  // Version 1.3: eigene Rind-Anteile, Standard-SG Rind 300 kg
  (x.artikel || []).forEach(a => { if (a.anteilRind === undefined) a.anteilRind = num(a.anteil); });
  // Version 1.5.2: Hesse wird immer Beinscheibe, nicht Gulasch
  (x.artikel || []).forEach(a => { if (a.name === GULASCH && a.teile === 'Kamm/Hals, Hesse') a.teile = 'Kamm/Hals'; });
  if (x.settings.rindWieBulle === undefined) x.settings.rindWieBulle = true;
  if (!(altSchema >= 3)) { if (num(x.settings.sgRind) === 320) x.settings.sgRind = 300; x.schema = 3; }
  // Version 1.6.2: Knochen je Tier als Anteil am Schlachtgewicht (bisher feste kg je Tier)
  if (!(altSchema >= 4)) {
    const r4 = v => Math.round(v * 10000) / 10000;
    for (const [n, f] of [[SK, 'skKg'], [FK, 'fkKg']]) {
      const a = (x.artikel || []).find(y => y.name === n);
      const kg = num(x.settings[f]);
      if (a && !(num(a.anteil) > 0) && kg > 0) { a.anteil = r4(kg / (num(x.settings.sgBulle) || 420)); a.anteilRind = r4(kg / (num(x.settings.sgRind) || 300)); }
    }
    x.schema = 4;
  }
  // Version 1.6.3: Bäckle als Innerei (wie Zunge), ca. 2 Stück je Tier
  if (!(x.artikel || []).some(a => a.name === 'Bäckle')) {
    const i = x.artikel.findIndex(a => a.name === 'Zunge');
    const neu = { name: 'Bäckle', einheit: 'Stk', preis: 0, inPaket: false, stueckG: 0, amStueck: false, beutelG: 0, anteil: 0, teile: '', anteilRind: 0 };
    x.artikel.splice(i >= 0 ? i + 1 : x.artikel.length, 0, neu);
  }
  if (!has(x.settings.baeckleStk)) x.settings.baeckleStk = 2;
  // Version 1.6.5: Ausbeute nach Referenzliste (Rind ca. 300 kg), Bratenstücke, Einzelgewichte
  if (!(altSchema >= 5)) {
    const W = {"Hackfleisch": [0.1786, 0.175, ""], "Braten": [0.1917, 0.1933, "Hochrippe, Bug, falsches Filet, Semerrolle, Kugel, Unterschale, Bürgermeisterstück"], "Gulasch geschnitten": [0.075, 0.075, null], "Rostbraten": [0.0369, 0.0367, "Roastbeef (Zwischenrippe)"], "Filet": [0.0131, 0.0133, null], "Steak": [0.0274, 0.0267, "Hüfte (dicke Hüfte & Hüftfilet)"], "Rouladen": [0.0536, 0.0533, null], "Siedfleisch": [0.094, 0.095, null], "Beinscheiben": [0.0452, 0.045, null], "Tafelspitz": [0.0137, 0.0133, null]}, G = {"Rostbraten": 275, "Steak": 225, "Rouladen": 200, "Beinscheiben": 500, "Filet": 200};
    (x.artikel || []).forEach(a => {
      if (W[a.name]) { a.anteil = W[a.name][0]; a.anteilRind = W[a.name][1]; if (W[a.name][2] !== null) a.teile = W[a.name][2]; }
      if (G[a.name]) a.stueckG = G[a.name];
    });
    x.settings.bratenTeile = [{"name": "Hochrippe", "stueck": 2, "kg": 3.5, "bug": false, "kgBulle": 4.875, "refMin": 0.02, "refMax": 0.026000000000000002, "kgMin": 3.0, "kgMax": 5.5}, {"name": "Bug (dickes Bugstück & Schaufelstück)", "stueck": 4, "kg": 4.0, "bug": true, "kgBulle": 5.625, "refMin": 0.048, "refMax": 0.057999999999999996, "kgMin": 3.5, "kgMax": 6.0}, {"name": "Falsches Filet (Buglende)", "stueck": 2, "kg": 1.75, "bug": false, "kgBulle": 2.5, "refMin": 0.01, "refMax": 0.013000000000000001, "kgMin": 1.5, "kgMax": 2.8}, {"name": "Semerrolle", "stueck": 2, "kg": 2.0, "bug": false, "kgBulle": 2.875, "refMin": 0.012, "refMax": 0.015, "kgMin": 1.8, "kgMax": 3.2}, {"name": "Kugel (Nuss)", "stueck": 4, "kg": 3.125, "bug": false, "kgBulle": 4.25, "refMin": 0.036000000000000004, "refMax": 0.045, "kgMin": 2.8, "kgMax": 4.8}, {"name": "Unterschale", "stueck": 2, "kg": 6.25, "bug": false, "kgBulle": 8.5, "refMin": 0.036000000000000004, "refMax": 0.045, "kgMin": 5.5, "kgMax": 9.5}, {"name": "Bürgermeisterstück", "stueck": 2, "kg": 1.25, "bug": false, "kgBulle": 1.75, "refMin": 0.006999999999999999, "refMax": 0.01, "kgMin": 1.0, "kgMax": 2.0}];
    x.settings.rindWieBulle = false; // Rind und Bulle getrennt
    const R = {"Filet": {"refMin": 0.012, "refMax": 0.015, "ganzeStuecke": 2, "stkMin": 1.8, "stkMax": 3.0}, "Rostbraten": {"refMin": 0.035, "refMax": 0.04, "ganzeStuecke": 0, "stkMin": 0.25, "stkMax": 0.32}, "Steak": {"refMin": 0.025, "refMax": 0.03, "ganzeStuecke": 0, "stkMin": 0.2, "stkMax": 0.26}, "Tafelspitz": {"refMin": 0.012, "refMax": 0.015, "ganzeStuecke": 2, "stkMin": 1.8, "stkMax": 3.2}, "Rouladen": {"refMin": 0.048, "refMax": 0.058, "ganzeStuecke": 0, "stkMin": 0.18, "stkMax": 0.23}, "Braten": {"refMin": 0.169, "refMax": 0.212, "ganzeStuecke": 0, "stkMin": null, "stkMax": null}, "Gulasch geschnitten": {"refMin": 0.068, "refMax": 0.082, "ganzeStuecke": 0, "stkMin": null, "stkMax": null}, "Beinscheiben": {"refMin": 0.04, "refMax": 0.05, "ganzeStuecke": 0, "stkMin": 0.45, "stkMax": 0.7}, "Siedfleisch": {"refMin": 0.085, "refMax": 0.105, "ganzeStuecke": 0, "stkMin": null, "stkMax": null}, "Hackfleisch": {"refMin": 0.16, "refMax": 0.2, "ganzeStuecke": 0, "stkMin": null, "stkMax": null}};
    (x.artikel || []).forEach(a => { if (R[a.name]) Object.assign(a, R[a.name]); });
    x.schema = 5;
  }
  // Version 1.7.0: Ochsenschwanz kann „am Stück“ (ganz) bestellt werden
  if (!(altSchema >= 6)) {
    const a = (x.artikel || []).find(y => y.name === 'Ochsenschwanz');
    if (a) a.amStueck = true;
    x.schema = 6;
  }
  // Version 1.8.1: Einzelartikel werden standardmäßig vakuumiert (kostenlos), 0,30 €/Tüte entfällt.
  // Bestehende Bestellungen behalten ihre bisherige Wahl: fehlendes Häkchen = ausdrücklich nicht vakuumieren.
  if (!(altSchema >= 7)) {
    (x.bestellungen || []).forEach(o => Object.values(o.pos || {}).forEach(p => { if (p && p.vak !== true) p.vak = false; }));
    x.schema = 7;
  }
  // Version 1.9.0 (Datenschutz): Straße und PLZ/Ort werden nicht mehr gespeichert
  if (!(altSchema >= 8)) {
    (x.kunden || []).forEach(k => { delete k.strasse; delete k.ort; });
    x.schema = 8;
  }
  // letzte Bestellung und Anlagedatum je Kunde (für die Löschfrist; bleibt auch erhalten, wenn Bestellungen gelöscht werden)
  (x.kunden || []).forEach(k => {
    k.letzte = (x.bestellungen || []).filter(o => sameText(o.name, k.name)).reduce((m, o) => (o.eingang || '') > m ? o.eingang : m, k.letzte || '');
    if (!k.angelegt) k.angelegt = k.letzte || todayISO();
  });
  delete x.settings.preisTuete;
  // Version 1.6.4: Innereien nach Stück werden in €/kg berechnet → geschätztes Stückgewicht
  const stkG = { Nieren: 700, Herz: 2500, Zunge: 1500, 'Bäckle': 400, Ochsenschwanz: 2000 };
  (x.artikel || []).forEach(a => { if (a.einheit === 'Stk' && !(num(a.stueckG) > 0) && stkG[a.name]) a.stueckG = stkG[a.name]; });
  return x;
}

if (typeof module !== 'undefined') module.exports = {
  num, has, r1, r2, r3, roundUp, fmtNum, fmtIn, fmtKg, fmtEur, fmtDate, parseDate, todayISO, sameText,
  art, einheitForm, istOrgan, ausbeuteArtikel, qty, sonderOf, specSum, sonderText, portionenOf, portionOf, vakArtikel, istVak,
  tuetenAuto, tueten, schaetzpreis, bestellText, einzelKg, formFehler, ordersOfTier, nextNr, tier, sgRechnung, yieldArt,
  tierInfo, lagerVorschlag, lagerText, anteilVon, teilZeilen, teilFehlmengen, teilVorschlag, bestellungTeilen, mengencheckTier, mengencheck, tierVorschlag, wartelistePassend, wartelistePruefung, tierUmbenennen, kundePflegen, kundenStat, kundenVorschlaege, bestellIndex, ANONYM, kundeLetzte, kundenFrist, inaktiveKunden, kundeAnonymisieren,
  mengenpruefung, metzgerauftrag, packplan, packplanUebernehmen, kistenRows, kistenTiere, kistenCalc, tierAbschliessen,
  kommissionierung, hackZettel, innereien, packliste, hofladenSummen, leererStand, bewegungsdatenLeeren, standPruefen,
  HACK, GULASCH, ORGANE, OCHS, ochsGanz, anteilRef, teilKgRef, ausbeuteStatistik, gemessen, gemessenRoh, wiegeArten, ausbeuteTier, erfassungSumme, zaehltStatistik, STAT_MIN_TIERE, setDefaults: d => { global.DEFAULTS = d; }
};
