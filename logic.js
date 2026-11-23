// Bestellsystem Bergwiesenhof – Rechenlogik
// Übersetzung der Excel-Formeln und VBA-Makros (Bestellsystem_Makros.bas) nach JavaScript.
// Reine Funktionen auf dem Datenstand "S" (state) – keine Oberfläche.
'use strict';

const ORGANE = ['Leber', 'Nieren', 'Herz', 'Zunge', 'Ochsenschwanz'];
const HACK = 'Hackfleisch';
const GULASCH = 'Gulasch geschnitten';
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
const ausbeuteArtikel = S => S.artikel.filter(a => num(a.anteil) > 0);

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
    const g = num(p.g) > 0 ? num(p.g) : num(a.stueckG);
    if (g > 0) return r3(num(p.anzahl) * g / 1000);
  }
  return 0;
}
// Sonderwünsche einer Bestellung (eingetragene + automatisch "am Stück")
function sonderOf(S, o) {
  const out = [];
  for (const a of S.artikel) {
    const p = o.pos && o.pos[a.name];
    if (p && p.amStueck && a.amStueck) {
      const q = qty(S, o, a.name);
      let w = 'am Stück';
      if (num(p.anzahl) > 0) w += ` (${fmtNum(p.anzahl)} Stück${num(p.g) > 0 ? ' à ' + fmtNum(p.g) + ' g' : ''})`;
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
      const kgG = g > 0 ? g : num(a.stueckG);
      out.push({ art: a.name, anzahl: num(p.anzahl), g: g || null, text: g > 0 ? `${fmtNum(p.anzahl)} × ${fmtNum(g)} g` : `${fmtNum(p.anzahl)} Stück`, kg: kgG > 0 ? r3(num(p.anzahl) * kgG / 1000) : 0 });
    }
  }
  return out;
}
const portionOf = (S, o, name) => portionenOf(S, o).find(p => p.art === name);
// Vakuum-Artikel
const vakArtikel = (S, o) => S.artikel.filter(a => { const p = o.pos && o.pos[a.name]; return p && p.vak && qty(S, o, a.name) > 0; }).map(a => a.name);
// Vakuum-Tüten (leer = automatisch)
function tuetenAuto(S, o) {
  let t = 0;
  const std = num(S.settings.tueteJeKg) > 0 ? num(S.settings.tueteJeKg) : 1;
  for (const a of S.artikel) {
    const p = o.pos && o.pos[a.name];
    if (!p || !p.vak || !has(p.menge) && !has(p.anzahl)) continue;
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
  let p = num(o.pakete) * (num(st.paketVon) + num(st.paketBis)) / 2 * num(st.preisPaketKg) + num(o.pakVak) * num(st.preisVakPaket);
  for (const a of S.artikel) if (a.einheit !== 'Stk') p += qty(S, o, a.name) * num(a.preis);
  p += tueten(S, o) * num(st.preisTuete);
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
      t.push(`${fmtNum(q, 3)} ${a.einheit === 'Stk' ? 'Stk' : 'kg'} ${a.name}${po ? ' (' + po.text + ')' : ''}`);
    }
  }
  const tu = tueten(S, o);
  if (tu > 0) t.push(`${fmtNum(tu)} Tüten vakuumieren`);
  return t.join(', ');
}
const einzelKg = (S, o) => S.artikel.reduce((t, a) => t + (a.einheit !== 'Stk' ? qty(S, o, a.name) : 0), 0);

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
    if (!(m > 0) && !(g > 0) && an > 0 && !(num(a.stueckG) > 0))
      f.push(`${a.name}: ${fmtNum(an)} Stück, aber kein Stückgewicht in der Preisliste – bitte g je Stück oder Menge in kg eintragen`);
  }
  for (const s of (o.sonder || [])) {
    if (!s || !s.art) continue;
    if (!art(S, s.art)) f.push(`Sonderwunsch: Artikel „${s.art}“ unbekannt`);
  }
  if (num(o.pakVak) > num(o.pakete)) f.push('Mehr vakuumierte Pakete als Genusspakete');
  return f;
}

// ---------- Bestellungen allgemein ----------
const sortNr = list => list.slice().sort((a, b) => a.nr - b.nr);
const ordersOfTier = (S, tierName) => sortNr(S.bestellungen.filter(o => o.tier === tierName && o.name));
const nextNr = S => S.bestellungen.reduce((m, o) => Math.max(m, o.nr), 0) + 1;

// ---------- Tiere ----------
const tier = (S, name) => S.tiere.find(t => sameText(t.name, name));
function sgRechnung(S, t) {
  if (num(t.sg) > 0) return num(t.sg);
  return t.typ === 'Bulle' ? num(S.settings.sgBulle) : num(S.settings.sgRind);
}
const yieldArt = (S, t, name) => { const a = art(S, name); return t && a ? sgRechnung(S, t) * num(a.anteil) : 0; };
function tierInfo(S, t) {
  const sg = sgRechnung(S, t);
  const nen = num(S.settings.nenner) || 16;
  const paketKg = S.artikel.filter(a => a.inPaket && num(a.anteil) > 0).reduce((s, a) => s + num(a.anteil), 0) * sg / nen;
  const ords = ordersOfTier(S, t.name);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const checks = mengencheckTier(S, t.name);
  const reichtNicht = ords.filter(o => (checks[o.nr] || '').startsWith('reicht')).length;
  return { sg, paketKg, pakete: pak, frei: nen - pak, anzahl: ords.length, reichtNicht };
}
// Mengencheck aller Bestellungen eines Tiers: {nr: text}
function mengencheckTier(S, tierName) {
  const t = tier(S, tierName);
  const out = {};
  if (!t) return out;
  const nen = num(S.settings.nenner) || 16;
  const arts = ausbeuteArtikel(S);
  const cum = {}; arts.forEach(a => cum[a.name] = 0);
  for (const o of ordersOfTier(S, t.name)) {
    const fehlt = [];
    for (const a of arts) {
      const y = yieldArt(S, t, a.name);
      cum[a.name] += qty(S, o, a.name) + (a.inPaket ? num(o.pakete) * y / nen : 0);
      if (cum[a.name] > y + 0.001) fehlt.push(a.name);
    }
    out[o.nr] = fehlt.length ? 'reicht nicht: ' + fehlt.join(', ') : 'ok';
  }
  return out;
}
function mengencheck(S, o) {
  if (!o.name || !o.tier) return '';
  if (o.tier === 'Warteliste') return 'Warteliste – noch kein Tier';
  if (!tier(S, o.tier)) return 'Tier unbekannt';
  return mengencheckTier(S, o.tier)[o.nr] || '';
}
// TierVorschlag (Wunschtermin leer: nächstes Tier ab heute mit genug freien Paketen;
// gesetzt: letztes Tier mit Abholtermin vor/an dem Wunschtermin)
function tierVorschlag(S, wunschISO, pakete, ohneNr) {
  const heute = todayISO();
  const pk = num(pakete);
  let best = '', bestD = '';
  for (const t of S.tiere) {
    if (!t.abhol || t.abhol < heute) continue;
    if (pk > 0) {
      const nen = num(S.settings.nenner) || 16;
      const bestellt = S.bestellungen.filter(o => o.tier === t.name && o.name && o.nr !== ohneNr).reduce((s, o) => s + num(o.pakete), 0);
      if (nen - bestellt < pk) continue;
    }
    if (wunschISO) { if (t.abhol <= wunschISO && (!best || t.abhol > bestD)) { best = t.name; bestD = t.abhol; } }
    else if (!best || t.abhol < bestD) { best = t.name; bestD = t.abhol; }
  }
  return best || 'Warteliste';
}
function wartelistePassend(S, t) {
  if (!t.abhol || t.abhol < todayISO()) return [];
  return S.bestellungen.filter(o => o.tier === 'Warteliste' && o.name && (!o.wunsch || t.abhol <= o.wunsch));
}
function tierUmbenennen(S, alt, neu) {
  S.bestellungen.forEach(o => { if (o.tier === alt) o.tier = neu; });
  S.kisten.forEach(k => { if (k.tier === alt) k.tier = neu; });
  if (S.metzgerManuell[alt]) { S.metzgerManuell[neu] = S.metzgerManuell[alt]; delete S.metzgerManuell[alt]; }
  if (S.packplaene[alt]) { S.packplaene[neu] = S.packplaene[alt]; S.packplaene[neu].tier = neu; delete S.packplaene[alt]; }
}

// ---------- Kunden ----------
function kundePflegen(S, name, tel, mail) {
  name = String(name || '').trim();
  if (!name) return false;
  const k = S.kunden.find(x => sameText(x.name, name));
  if (k) {
    if (!k.tel && tel) k.tel = tel;
    if (!k.mail && mail) k.mail = mail;
    return false;
  }
  S.kunden.push({ nr: S.kunden.reduce((m, x) => Math.max(m, x.nr), 0) + 1, name, tel: tel || '', mail: mail || '', strasse: '', ort: '', notiz: '' });
  return true;
}
function kundenStat(S, k) {
  const os = S.bestellungen.filter(o => sameText(o.name, k.name));
  return {
    anzahl: os.length,
    letzte: os.reduce((m, o) => (o.eingang > m ? o.eingang : m), ''),
    pakete: os.reduce((s, o) => s + num(o.pakete), 0),
    umsatz: os.reduce((s, o) => s + num(o.endbetrag), 0)
  };
}

// ---------- Mengenprüfung (Blatt "Mengenprüfung") ----------
function mengenpruefung(S, tierName) {
  const t = tier(S, tierName);
  if (!t) return null;
  const nen = num(S.settings.nenner) || 16;
  const ords = ordersOfTier(S, t.name);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const rows = ausbeuteArtikel(S).map(a => {
    const y = yieldArt(S, t, a.name);
    const einzel = ords.reduce((s, o) => s + qty(S, o, a.name), 0);
    const ausPak = a.inPaket ? pak * y / nen : 0;
    const ges = einzel + ausPak;
    return { art: a.name, ausbeute: y, einzel, ausPak, gesamt: ges, frei: y - ges, auslastung: y > 0 ? ges / y : null,
      status: y === 0 ? '' : ges > y + 0.001 ? 'reicht nicht' : ges > 0.9 * y ? 'knapp' : 'ok' };
  });
  return { tier: t, info: tierInfo(S, t), rows };
}

// ---------- Metzgerauftrag ----------
function metzgerauftrag(S, tierName) {
  const t = tier(S, tierName);
  if (!t) return null;
  const nen = num(S.settings.nenner) || 16;
  const ords = ordersOfTier(S, t.name);
  const pak = ords.reduce((s, o) => s + num(o.pakete), 0);
  const calc = name => {
    const a = art(S, name);
    const einzeln = ords.reduce((s, o) => s + qty(S, o, name), 0);
    const separat = ords.reduce((s, o) => s + specSum(S, o, name), 0);
    const ausPak = a && a.inPaket ? pak * yieldArt(S, t, name) / nen : 0;
    const vorschlag = roundUp(einzeln - separat + ausPak);
    return { einzeln, separat, standard: einzeln - separat, ausPak, vorschlag };
  };
  const man = S.metzgerManuell[t.name] || {};
  const hack = calc(HACK), gul = calc(GULASCH);
  hack.manuell = has(man.hack) ? num(man.hack) : null;
  gul.manuell = has(man.gulasch) ? num(man.gulasch) : null;
  hack.vorgabe = hack.manuell !== null ? hack.manuell : hack.vorschlag;
  gul.vorgabe = gul.manuell !== null ? gul.manuell : gul.vorschlag;
  const hk = num(S.settings.hackKiste) || 20;
  hack.kisten = hack.vorgabe > 0 ? roundUp(hack.vorgabe / hk) : 0;
  hack.vollKisten = hack.kisten * hk;
  const separat = [];
  for (const o of ords) for (const s of sonderOf(S, o)) {
    const a = art(S, s.art);
    separat.push({ nr: o.nr, name: o.name, art: s.art, menge: has(s.menge) ? fmtNum(s.menge, 3) + ' ' + (a ? a.einheit : '') : '', hinweis: s.wunsch });
  }
  return { tier: t, anzahl: ords.length, pakete: pak, hack, gulasch: gul, separat };
}

// ---------- Packplan (Makro PackplanFuer) ----------
function mischGruppe(a) {
  if (a === 'Rostbraten' || a === 'Steak') return 1;
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
const kistenTxt = items => items.map(i => `${i.art} ~${Math.round(i.kg)} kg`).join(' + ');
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
    if (a.name === SK) yt = num(st.skKg);
    if (a.name === FK) yt = num(st.fkKg);
    const isOrg = istOrgan(a.name);
    const shr = a.inPaket ? yt / dv : 0;
    let kg = 0;
    if (a.name === HACK) kg = ma.hack.vorgabe;
    else if (a.name === GULASCH) kg = ma.gulasch.vorgabe;
    else if (!isOrg) kg = Math.max(0, yt - (specT[a.name] || 0));
    return { art: a.name, isOrg, shr, kg };
  });
  // kumulierter Bedarf je Bestellung
  const BIG = 100000;
  const cum = A.map(() => [0]);
  ords.forEach((o, k) => {
    A.forEach((a, i) => {
      const yt = Math.max(0, qty(S, o, a.art) - (specO[o.nr + '|' + a.art] || 0));
      cum[i][k + 1] = cum[i][k] + yt + num(o.pakete) * a.shr;
    });
  });
  // Teilkisten
  let P = [];
  A.forEach((a, i) => {
    if (a.isOrg || !(a.kg > 0.05)) return;
    let nT, stueck;
    if (a.art === HACK) { stueck = hackKg; nT = Math.floor((a.kg - 0.001) / stueck) + 1; }
    else { nT = Math.floor((a.kg - 0.001) / maxKg) + 1; stueck = a.kg / nT; }
    for (let j = 1; j <= nT; j++) {
      let w = stueck, need = BIG;
      if (a.art === HACK && j === nT) w = a.kg - (nT - 1) * stueck;
      if (a.art === HACK) need = 0;
      else {
        const thr = (j - 1) * stueck;
        for (let k = 1; k <= ords.length; k++) if (cum[i][k] > thr + 0.001) { need = k; break; }
      }
      P.push({ art: a.art, w, need });
    }
  });
  if (specTier > 0) P.push({ art: 'Sonderfälle (beschriftet)', w: specTier, need: 0 });
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
    C[k].items.push({ art: p.art, kg: r1(p.w) });
  }
  // Stellplätze vorbereiten
  const auto = S.auto;
  const warn = [];
  const nurHack = c => c.items.length > 0 && c.items.every(i => i.art === HACK);
  const hackIdx = auto.findIndex(f => sameText(f.name, st.hackPlatz || 'vorne rechts') && num(f.hoehe) > 0);
  const hatHack = C.some(nurHack);
  // jedes Feld im Auto braucht mindestens eine Kiste (Hack-Platz nur, wenn es Hack gibt)
  const nFeld = auto.filter((f, i) => num(f.hoehe) > 0 && (i !== hackIdx || hatHack)).length;
  while (C.length < nFeld) {
    let aMax = -1, wMax = 0;
    C.forEach((c, j) => { if (c.w > wMax && !c.items.some(i => i.art === 'Sonderfälle (beschriftet)' || i.art === HACK)) { wMax = c.w; aMax = j; } });
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
      teile: c.items.map(it => { const a = art(S, it.art); return a && a.teile && it.art !== HACK ? `${it.art}: ${a.teile}` : ''; }).filter(Boolean),
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
    k.items.slice(0, 3).forEach(it => S.kisten.push({ id: ++id, tier: pp.tier, nr: k.nr, art: it.art, kg: it.kg, plan: it.kg, platz: k.platzKurz }));
  }
}

// ---------- Kisten ----------
function kistenRows(S, tierName) {
  return S.kisten.filter(k => k.tier === tierName).map((k, i) => ({ k, i })).sort((a, b) => a.k.nr - b.k.nr || a.i - b.i).map(x => x.k);
}
const kistenTiere = S => [...new Set(S.kisten.map(k => k.tier))];
function kistenSumme(S, tierName, artName) { return S.kisten.filter(k => k.tier === tierName && k.art === artName).reduce((s, k) => s + num(k.kg), 0); }
// Anteil je Paket für die Kommissionierung (Kisten-Gewicht wenn eingetragen, sonst Ausbeute)
function anteilJePaket(S, t, artName, nurKisten) {
  const a = art(S, artName);
  if (!a || !a.inPaket) return 0;
  const nen = num(S.settings.nenner) || 16;
  const ks = kistenSumme(S, t.name, artName);
  if (artName === HACK || artName === GULASCH) return yieldArt(S, t, artName) / nen;
  if (nurKisten) return ks / nen;
  return (ks > 0 ? ks : yieldArt(S, t, artName)) / nen;
}
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
    return { k, start, anteil, bedarf, verplant, rest: num(k.kg) - verplant, einheit: a ? a.einheit : '', teile: a && k.art !== HACK ? a.teile : '' };
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
  S.kisten = S.kisten.filter(k => k.tier !== tierName);
  return n;
}

// ---------- Kommissionierung ----------
function kommissionierung(S, nr) {
  const o = S.bestellungen.find(x => x.nr === nr);
  if (!o) return null;
  const t = tier(S, o.tier);
  const vorher = t ? ordersOfTier(S, t.name).filter(x => x.nr < nr) : [];
  const rows = S.artikel.map(a => {
    const D = t ? anteilJePaket(S, t, a.name, false) : 0;
    const E = Math.max(0, qty(S, o, a.name) - specSum(S, o, a.name));
    const F = num(o.pakete) * D;
    const G = E + F;
    const H = vorher.reduce((s, x) => s + qty(S, x, a.name) - specSum(S, x, a.name) + num(x.pakete) * D, 0);
    return { art: a.name, einheit: a.einheit, anteil: D, einzeln: E, ausPak: F, bedarf: G, vorher: H };
  });
  const picks = [];
  if (t) {
    for (const c of kistenCalc(S, t.name)) {
      const r = rows.find(x => x.art === c.k.art);
      if (!r) continue;
      const m = Math.max(0, Math.min(c.start + num(c.k.kg), r.vorher + r.bedarf) - Math.max(c.start, r.vorher));
      if (m > 0.0001) {
        let verp = '';
        if (c.k.art === HACK) verp = 'vom Hack-Tisch (fertig verpackt)';
        else { const po = portionOf(S, o, c.k.art); if (po) verp = (po.kg > 0 ? `davon ${fmtNum(po.kg, 2)} kg als ` : '') + po.text; }
        picks.push({ kiste: c.k.nr, menge: r1(m), einheit: c.einheit, art: c.k.art, verpacken: verp, platz: c.k.platz || '' });
      }
    }
    picks.sort((a, b) => a.kiste - b.kiste);
  }
  rows.forEach(r => { r.ausKisten = picks.filter(p => p.art === r.art).reduce((s, p) => s + p.menge, 0); r.fehlt = istOrgan(r.art) ? 0 : (r.bedarf - r.ausKisten > 0.05 ? r.bedarf - r.ausKisten : 0); });
  const innereien = ORGANE.map(n => { const q = qty(S, o, n); const a = art(S, n); return q > 0 ? `${fmtNum(q, 3)} ${a ? a.einheit : ''} ${n}` : ''; }).filter(Boolean);
  const sonder = sonderOf(S, o).map(s => sonderText(S, s));
  return { o, tier: t, rows, picks, innereien, sonder, tueten: tueten(S, o) };
}

// ---------- Hackfleisch-Zettel ----------
function hackZettel(S, tierName) {
  const t = tier(S, tierName);
  if (!t) return null;
  const nen = num(S.settings.nenner) || 16;
  const hp = num(S.settings.hackPaketG) || 500;
  const hackY = yieldArt(S, t, HACK);
  const hackInPak = (art(S, HACK) || {}).inPaket;
  const rows = [];
  for (const o of ordersOfTier(S, t.name)) {
    const ein = qty(S, o, HACK) - specSum(S, o, HACK);
    const pak = num(o.pakete);
    if (!(ein > 0) && !(pak > 0)) continue;
    const po = portionOf(S, o, HACK);
    const vak = vakArtikel(S, o).includes(HACK);
    const ausPak = pak > 0 && hackInPak ? r1(pak * hackY / nen) : null;
    const pv = num(o.pakVak);
    rows.push({
      nr: o.nr, name: o.name,
      einzeln: ein > 0 ? r3(ein) : null,
      einzelnAls: ein > 0 ? (po ? po.text : `${fmtNum(ein, 3)} kg in 1 Tüte`) : '',
      einzelnVak: ein > 0 ? (vak ? 'VAKUUM' : 'Tüte') : '',
      pakete: pak > 0 ? pak : null,
      ausPak,
      ausPakAls: ausPak ? `${Math.round(ausPak * 1000 / hp)} × ${hp} g` : '',
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
  const vorh = { Leber: num(st.leberKg), Nieren: num(st.nierenStk), Herz: num(st.herzStk), Zunge: num(st.zungeStk), Ochsenschwanz: num(st.ochsStk) };
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
    else if (n === 'Ochsenschwanz') txt = `${fmtNum(rest)} Stk übrig`;
    else txt = `${fmtNum(rest)} × vakuumieren`;
    return { art: n, vorhanden: vorh[n], bestellt: best, rest, txt, einheit: n === 'Leber' ? 'kg' : 'Stk' };
  });
  const rows = ords.filter(o => ORGANE.some(n => qty(S, o, n) > 0)).map(o => {
    const v = vakArtikel(S, o).filter(n => ORGANE.includes(n));
    const po = portionOf(S, o, 'Leber');
    const lq = qty(S, o, 'Leber');
    return { nr: o.nr, name: o.name, leber: lq || null, leberAls: lq > 0 ? (po ? po.text : fmtNum(lq, 3) + ' kg') : '',
      nieren: qty(S, o, 'Nieren') || null, herz: qty(S, o, 'Herz') || null, zunge: qty(S, o, 'Zunge') || null, ochs: qty(S, o, 'Ochsenschwanz') || null,
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
    schaetz: schaetzpreis(S, o), endbetrag: has(o.endbetrag) ? num(o.endbetrag) : null, status: o.status || 'offen' })) };
}

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
    app: 'Bestellsystem Bergwiesenhof', version: 1, gespeichert: null,
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
  for (const k of Object.keys(base)) if (x[k] === undefined) x[k] = base[k];
  x.settings = Object.assign({}, base.settings, x.settings);
  if (!x.settings.hackPlatz) x.settings.hackPlatz = 'vorne rechts';
  (x.auto || []).forEach(f => { if (f.spaeter === undefined) f.spaeter = /^hinten/i.test(f.name || ''); });
  return x;
}

if (typeof module !== 'undefined') module.exports = {
  num, has, r1, r2, r3, roundUp, fmtNum, fmtKg, fmtEur, fmtDate, parseDate, todayISO, sameText,
  art, einheitForm, istOrgan, ausbeuteArtikel, qty, sonderOf, specSum, sonderText, portionenOf, portionOf, vakArtikel,
  tuetenAuto, tueten, schaetzpreis, bestellText, einzelKg, formFehler, ordersOfTier, nextNr, tier, sgRechnung, yieldArt,
  tierInfo, mengencheckTier, mengencheck, tierVorschlag, wartelistePassend, tierUmbenennen, kundePflegen, kundenStat,
  mengenpruefung, metzgerauftrag, packplan, packplanUebernehmen, kistenRows, kistenTiere, kistenCalc, tierAbschliessen,
  kommissionierung, hackZettel, innereien, packliste, hofladenSummen, leererStand, bewegungsdatenLeeren, standPruefen,
  HACK, GULASCH, ORGANE, setDefaults: d => { global.DEFAULTS = d; }
};
