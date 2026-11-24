// Bestellsystem Bergwiesenhof – Oberfläche (Teil 2: Schlachttag, Kommissionieren, Hofladen, Einstellungen, Start)
'use strict';

const REITER = [['menge', 'Mengenprüfung'], ['metzger', 'Metzgerauftrag'], ['kisten', 'Kisten & Ladeplan'], ['hack', 'Hack-Zettel'], ['innereien', 'Innereien'], ['packliste', 'Packliste Kühlhaus']];
const abholTxt = t => t.abhol ? 'Abholung ' + fmtDate(t.abhol) : 'Abholtermin noch offen';
const fussZeile = () => S.settings.hofZeile || '';
const knopfTeilen = (extra = '') => `<div class="knopfleiste" style="margin:10px 0">${extra}<button class="btn haupt" data-act="teilen">Als Bild teilen (WhatsApp)</button><button class="btn" data-act="drucken">Drucken</button></div>`;

// ---------- Dokumente ----------
function docWarteliste(w) {
  const st = S.settings;
  const mg = (v, eh) => v === null || v === undefined ? '' : `${fmtNum(v, eh === 'Stk' ? 0 : 1)} ${eh}`;
  const ja = (x, nr) => x.nicht.includes(nr) ? 'reicht nicht' : 'ok';
  const eng = x => Object.entries(x.engpass).sort((a, b) => b[1] - a[1]).map(e => e[0]).join(', ') || '–';
  const bl = [{ type: 'h', text: 'Empfehlung' }];
  w.emp.forEach((t, i) => bl.push({ type: 'text', text: t, bold: t.startsWith('Empfehlung') }));
  if (w.anzahl) {
    bl.push({ type: 'h', text: 'Offene Mengen auf der Warteliste' },
      { type: 'table', head: ['Artikel', 'einzeln', 'aus Paketen', 'gesamt', `Rind ca. (${fmtNum(w.rind.sg)} kg SG)`, `Bulle ca. (${fmtNum(w.bulle.sg)} kg SG)`, 'reicht?'],
        widths: [3, 1.6, 1.6, 1.6, 2.2, 2.2, 2.2], align: ['', 'r', 'r', 'r', 'r', 'r', ''],
        rows: w.rows.map(r => [r.art, r.einzeln > 0 ? mg(r.einzeln, r.einheit) : '', r.ausPak > 0 ? mg(r.ausPak, r.einheit) : '', mg(r.gesamt, r.einheit),
          mg(r.rind, r.einheit) + (r.dehnbar ? ` (bis ${fmtNum(r.rindMax, 0)})` : ''), mg(r.bulle, r.einheit) + (r.dehnbar ? ` (bis ${fmtNum(r.bulleMax, 0)})` : ''), r.status]),
        rowClass: w.rows.map(r => r.status === 'zu viel für 1 Tier' ? 'rot' : '') },
      { type: 'text', text: `Gesamt ca. ${fmtNum(w.kgGesamt, 0)} kg, davon ${fmtNum(w.pakete)} Genusspakete. Hackfleisch „bis“: mit Gulasch (Kamm/Hals) und Bug. Innereien/Ochsenschwanz: vorhanden je Tier laut Einstellungen.` },
      { type: 'h', text: 'Rind oder Bulle?' },
      { type: 'table', head: ['', 'Rind', 'Bulle'], widths: [3.5, 4, 4], align: ['', '', ''],
        rows: [['Schlachtgewicht (Standard)', `${fmtNum(w.rind.sg)} kg`, `${fmtNum(w.bulle.sg)} kg`],
          ['Bestellungen passen', `${w.rind.ok} von ${w.anzahl}`, `${w.bulle.ok} von ${w.anzahl}`],
          ['Genusspakete möglich', `ca. ${fmtNum(w.rind.maxPak)} (bestellt ${fmtNum(w.pakete)})`, `ca. ${fmtNum(w.bulle.maxPak)} (bestellt ${fmtNum(w.pakete)})`],
          ['verkauft (Fleisch + Knochen)', `ca. ${fmtNum(w.rind.verkauft, 0)} von ${fmtNum(w.rind.ausbeute, 0)} kg = ${fmtNum(w.rind.auslastung * 100, 0)} %`, `ca. ${fmtNum(w.bulle.verkauft, 0)} von ${fmtNum(w.bulle.ausbeute, 0)} kg = ${fmtNum(w.bulle.auslastung * 100, 0)} %`],
          ['Rest für den Hofladen', `ca. ${fmtNum(w.rind.rest, 0)} kg`, `ca. ${fmtNum(w.bulle.rest, 0)} kg`],
          ['Engpass', eng(w.rind), eng(w.bulle)]] },
      { type: 'h', text: 'Bestellungen auf der Warteliste' },
      { type: 'table', head: ['Nr.', 'Name', 'Eingang', 'Wunsch', 'Pakete', 'Bestellung', 'Rind', 'Bulle'], widths: [0.8, 2.4, 1.4, 1.4, 0.9, 5, 1.4, 1.4], align: ['r', '', '', '', 'r', '', '', ''],
        rows: w.ords.map(o => [o.nr, o.name, fmtDate(o.eingang), o.wunsch ? fmtDate(o.wunsch) : '', num(o.pakete) || '', bestellText(S, o), ja(w.rind, o.nr), ja(w.bulle, o.nr)]),
        rowClass: w.ords.map(o => w.bulle.nicht.includes(o.nr) ? 'rot' : '') },
      { type: 'text', text: `Probeweise Zuordnung in der Reihenfolge der Warteliste (Genusspakete zuerst), Standard-Schlachtgewichte aus den Einstellungen. Schlachten empfohlen ab ${fmtNum(w.schwelle)} % verkauft.` });
  }
  return { title: 'Prüfliste Warteliste', sub: [`Stand ${fmtDate(todayISO())} · ${w.anzahl} offene Bestellung${w.anzahl === 1 ? '' : 'en'} ohne Tier`], blocks: bl, footer: fussZeile() };
}
function viewWarteliste() {
  titel('Prüfliste Warteliste');
  const w = wartelistePruefung(S);
  const doc = docWarteliste(w);
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">Prüfliste Warteliste</h1><a class="btn" href="#/bestellungen">Zurück zu den Bestellungen</a></div>
    <div class="zeile oben" style="margin-bottom:6px"><label class="f" style="width:300px">Schlachten empfohlen ab … % verkauft<input class="feld zahl" inputmode="decimal" data-ch="wlschwelle" value="${fmtIn(w.schwelle)}"></label></div>
    ${knopfTeilen()}${docHtml(doc)}`;
  ui.acts.wlschwelle = el => { S.settings.wlSchwelle = num(el.value) > 0 ? num(el.value) : 60; speichern(); render(); };
  ui.acts.teilen = async () => { const r = await docTeilen(doc, doc.title); if (r === 'gespeichert') meldung('Bild gespeichert (Teilen wird hier nicht unterstützt).'); };
  ui.acts.drucken = () => docDrucken(doc);
}
function mengenSummen(mp) {
  const z = mp.summen, i = mp.info;
  const zeile = (n, g) => [n, fmtNum(g.ausbeute, 1), fmtNum(g.einzel, 1), fmtNum(g.ausPak, 1), fmtNum(g.bestellt, 1), fmtNum(g.frei, 1), g.quote === null ? '' : fmtNum(g.quote * 100, 0) + ' %'];
  return [{ type: 'h', text: 'Summen' },
    { type: 'table', head: ['', 'Ausbeute ca. kg', 'einzeln', 'in Paketen', 'bestellt', 'noch frei → Hofladen', 'verkauft'], align: ['', 'r', 'r', 'r', 'r', 'r', 'r'], widths: [3, 2, 2, 2, 2, 2.4, 2],
      rows: [zeile('Fleisch', z.fleisch), zeile('Knochen', z.knochen), zeile('Gesamt', z.gesamt)], rowClass: ['', '', 'fett'] },
    { type: 'kv', rows: [
      ['Ausbeute gesamt', `${fmtNum(z.gesamt.ausbeute, 0)} kg`, z.anteilSG === null ? '' : `${fmtNum(z.anteilSG * 100, 0)} % vom SG (${fmtNum(i.sg)} kg)`],
      ['Bestellungen', `${i.anzahl}`, `${fmtNum(i.pakete)} Genusspakete (frei ${fmtNum(i.frei)})`],
      ['Schätzwert Bestellungen', fmtEur(z.schaetz), z.mitEnd ? `Endbeträge eingetragen: ${fmtEur(z.endbetrag)} (${z.mitEnd} von ${i.anzahl})` : ''],
      ['Engpässe', z.engpass.length ? z.engpass.join(', ') : 'keine', z.knapp.length ? 'knapp: ' + z.knapp.join(', ') : ''],
      ['Innereien / Ochsenschwanz', z.innereien.length ? z.innereien.join(' · ') : '–', z.innereien.length ? 'nicht in der Prüfung' : '']] }];
}
function docMenge(mp) {
  const t = mp.tier, i = mp.info;
  return { title: `Mengenprüfung – ${t.name}`, sub: [`${t.typ} · ${fmtNum(i.sg)} kg SG · ${abholTxt(t)}`, `Pakete bestellt ${fmtNum(i.pakete)} / frei ${fmtNum(i.frei)} · ${i.anzahl} Bestellungen · reicht nicht: ${i.reichtNicht}`],
    blocks: [{ type: 'table', head: ['Teilstück', 'Ausbeute ca.', 'einzeln', 'in Paketen', 'gesamt', 'noch frei', 'Auslastung', 'Status'], align: ['', 'r', 'r', 'r', 'r', 'r', 'r', ''], widths: [3, 2, 2, 2, 2, 2, 2, 2.4],
      rows: mp.rows.map(r => [r.art, r.ausbeute > r.ausbeuteStd + 0.05 ? `${fmtNum(r.ausbeuteStd, 1)} (bis ${fmtNum(r.ausbeute, 1)})` : fmtNum(r.ausbeute, 1), fmtNum(r.einzel, 1), fmtNum(r.ausPak, 1), fmtNum(r.gesamt, 1), fmtNum(r.frei, 1), r.auslastung === null ? '' : fmtNum(r.auslastung * 100, 0) + ' %', r.status]),
      rowClass: mp.rows.map(r => r.status === 'reicht nicht' ? 'rot' : '') },
      ...mengenSummen(mp),
      { type: 'text', text: 'Genusspakete haben Vorrang, danach Einzelartikel in der Reihenfolge, in der die Bestellungen dem Tier zugeordnet wurden. Ausbeute = Richtwerte, „knapp“ = über 90 % vergeben. Innereien werden nicht geprüft.' }]
      .concat(mp.rows.some(r => r.ausbeute > r.ausbeuteStd + 0.05) ? [{ type: 'text', text: 'Hackfleisch „bis“: normale Hack-Ausbeute; wenn nötig zusätzlich nicht bestelltes Gulasch und der Bug (wird dann im Metzgerauftrag aufgelöst).' }] : []), footer: fussZeile() };
}
function docMetzger(ma) {
  const t = ma.tier;
  const bl = [{ type: 'h', text: 'Gesamtmengen' },
    { type: 'kv', rows: [['Hackfleisch', `${fmtNum(ma.hack.vorgabe)} kg`, ma.hack.kistenText ? `(${ma.hack.kistenText})` : ''], ['Gulasch', ma.gulasch.vorgabe > 0 ? `${fmtNum(ma.gulasch.vorgabe)} kg` : '–', '']]
      .concat(ma.waden > 0 ? [['Waden am Stück', `${fmtNum(ma.waden)} Stück`, 'nicht zu Beinscheiben schneiden – Nr. siehe unten']] : [])
      .concat(ma.ochs.ganz > 0 ? [['Ochsenschwanz', `${fmtNum(ma.ochs.ganz)} Stück ganz lassen`, `kommt zu den Beinscheiben in die Kiste – ${ma.ochs.ganzListe.map(x => 'Nr. ' + x.nr).join(', ')}`]] : [])
      .concat(ma.ochs.bestellt > ma.ochs.vorhanden ? [['Ochsenschwanz', `ACHTUNG: ${fmtNum(ma.ochs.bestellt)} Stück bestellt`, `aber nur ca. ${fmtNum(ma.ochs.vorhanden)} je Tier`]] : []) }];
  if (ma.hack.ueberAusbeute) bl.push({ type: 'text', bold: true, text: 'Mehr Hackfleisch als üblich: zuerst Schulterstücke (Bug) auflösen, Keulenstücke als Braten behalten.' });
  if (ma.gulasch.insHack > 0.05) bl.push({ type: 'text', text: `Kein Gulasch bestellt: ca. ${fmtNum(ma.gulasch.insHack, 0)} kg Kamm/Hals ins Hackfleisch.` });
  bl.push({ type: 'text', text: (ma.waden > 0 ? 'Übrige Hesse als Beinscheiben. ' : 'Hesse wie immer als Beinscheiben. ') + 'Alle übrigen Stücke bitte wie gewohnt zuschneiden.' },
    { type: 'h', text: 'Sonderfälle – separat vorbereiten, bitte mit der Bestell-Nr. beschriften' },
    { type: 'table', head: ['Nr.', 'Artikel', 'Menge', 'Hinweis'], widths: [1.2, 3.6, 1.8, 5.8], align: ['r', '', 'r', ''], rows: ma.separat.map(s => [s.nr, s.art, s.menge, s.hinweis]), leer: '– keine –' });
  return { title: `Auftrag Metzger – ${t.name}`, sub: [abholTxt(t)], blocks: bl, footer: fussZeile() };
}
function docPackplan(pp, t) {
  return { title: `Packplan & Ladeplan – ${pp.tier}`, sub: [t ? abholTxt(t) : '', `erstellt ${new Date(pp.erstellt).toLocaleString('de-DE')} · ${pp.kisten.length} Kisten · Platz im Auto: ${pp.cap}`],
    blocks: [...pp.warn.map(w => ({ type: 'text', text: w, warn: true })),
      { type: 'table', head: ['Kiste', 'Inhalt (ca.)', 'kg', 'Stellplatz', 'Ebene', 'gebraucht'], widths: [1, 5.5, 1, 2.2, 1.7, 2], align: ['r', '', 'r', '', '', ''],
        rows: pp.kisten.map(k => [k.nr, k.text + (k.teile.length ? '\n' + k.teile.join('\n') : ''), fmtNum(k.w, 1), k.platz, k.ebene, k.ab]), rowClass: pp.kisten.map(k => k.platz === 'KEIN PLATZ' ? 'rot' : '') },
      { type: 'h', text: 'Stellplätze (oben = Kiste ganz oben)' },
      { type: 'table', head: ['Stellplatz', 'Kisten (von oben nach unten)'], widths: [2, 7], rows: pp.felder.map(f => [`${f.name} (${f.belegt}/${f.hoehe})`, f.kisten.map(k => `K${k.nr} ${k.text}`).join('\n')]) },
      { type: 'h', text: 'Einladereihenfolge beim Metzger' }, { type: 'text', text: pp.einladen.join('\n') }], footer: fussZeile() };
}
function docKisten(tn, calc) {
  const t = tier(S, tn);
  return { title: `Kisten – ${tn}`, sub: [t ? abholTxt(t) : ''],
    blocks: [{ type: 'table', head: ['Kiste', 'Inhalt', 'kg', 'Stellplatz', 'Bedarf ges.', 'verplant', 'Rest', 'Teilstücke'], widths: [1, 2.6, 1.1, 2.4, 1.4, 1.3, 1.1, 4], align: ['r', '', 'r', '', 'r', 'r', 'r', ''],
      rows: calc.map(c => c.k.art === OCHS ? [c.k.nr, c.k.art, fmtNum(c.k.kg, 0) + ' Stk' + (has(c.k.gew) ? ' · ' + fmtNum(c.k.gew, 2) + ' kg' : ''), c.k.platz || '', fmtNum(c.bedarf, 0) + ' Stk', fmtNum(c.verplant, 0) + ' Stk', fmtNum(c.rest, 0) + ' Stk', c.k.info ? c.k.info + ' (am Stück bestellt)' : 'wird geschnitten'] : [c.k.nr, c.k.art, fmtNum(c.k.kg, 1), c.k.platz || '', fmtNum(c.bedarf, 1), fmtNum(c.verplant, 1), fmtNum(c.rest, 1), c.teile || '']) }], footer: fussZeile() };
}
function docHack(hz) {
  return { title: `Hackfleisch-Zettel – ${hz.tier.name}`, sub: [abholTxt(hz.tier), `Summe einzeln ${fmtNum(hz.sumEinzeln, 2)} kg · aus Paketen ${fmtNum(hz.sumPak, 1)} kg`],
    blocks: [{ type: 'text', text: 'Unabhängig von den Bestellungen vorab verpacken; Tüten mit Bestell-Nr. und Namen beschriften. Mageres Hack (Sonderfall) kommt separat vom Metzger.' },
      { type: 'table', head: ['Nr.', 'Name', 'EINZELN kg', 'verpacken als', 'vak.?', 'Pakete', 'aus PAKET kg', 'verpacken als', 'vak.?', '✓'], widths: [0.8, 2.6, 1.2, 2, 1.2, 0.9, 1.2, 1.6, 2, 0.6], align: ['r', '', 'r', '', '', 'r', 'r', '', '', ''],
        rows: hz.rows.map(r => [r.nr, r.name, fmtNum(r.einzeln, 3), r.einzelnAls, r.einzelnVak, r.pakete || '', fmtNum(r.ausPak, 1), r.ausPakAls, r.pakVak, '☐']) }], footer: fussZeile() };
}
function docInnereien(ii) {
  return { title: `Innereien – ${ii.tier.name}`, sub: [abholTxt(ii.tier)],
    blocks: [{ type: 'text', text: 'Erst die Bestellungen bedienen, dann den Rest verarbeiten. Tüten mit Bestell-Nr. und Namen beschriften.' },
      { type: 'table', head: ['Innerei', 'vorhanden ca.', 'bestellt', 'Rest', 'Rest verarbeiten'], widths: [2, 1.5, 1.3, 1.2, 4], align: ['', 'r', 'r', 'r', ''],
        rows: ii.uebersicht.map(u => [u.art, fmtNum(u.vorhanden) + ' ' + u.einheit, fmtNum(u.bestellt, 3), fmtNum(u.rest, 3), u.txt]), rowClass: ii.uebersicht.map(u => u.rest < -1e-9 ? 'rot' : '') },
      { type: 'h', text: 'Bestellungen' },
      { type: 'table', head: ['Nr.', 'Name', 'Leber kg', 'Leber verpacken', 'Nieren', 'Herz', 'Zunge', 'Bäckle', 'vakuumieren', '✓'], widths: [0.8, 2.6, 1, 1.7, 0.9, 0.8, 0.8, 0.9, 1.7, 0.5], align: ['r', '', 'r', '', 'r', 'r', 'r', 'r', '', ''],
        rows: ii.rows.map(r => [r.nr, r.name, fmtNum(r.leber, 3), r.leberAls, r.nieren || '', r.herz || '', r.zunge || '', r.baeckle || '', r.vak, '☐']) },
      { type: 'text', text: '„vorhanden“ = Schätzwerte aus den Einstellungen (Innereien je Tier).' }], footer: fussZeile() };
}
function docPackliste(pl) {
  return { title: `Packliste Kühlhaus – ${pl.tier.name}`, sub: [abholTxt(pl.tier)], quer: true,
    blocks: [{ type: 'table', head: ['Nr.', 'Name', 'Telefon', 'Bestellung', 'Sonderfälle (separat)', 'Lagerplatz', 'Schätzpreis', 'Endbetrag', 'gepackt', 'abgeholt'], fest: true, widths: [0.7, 2.4, 2.3, 6.6, 2.4, 2.2, 1.5, 1.5, 1.1, 1.1], align: ['r', '', '', '', '', '', 'r', 'r', '', ''],
      rows: pl.rows.map(r => [r.nr, r.name, r.tel, r.text, r.sonder, r.lager || `(${r.lagerVorschlag})`, fmtEur(r.schaetz), r.endbetrag !== null ? fmtEur(r.endbetrag) : '', r.status !== 'offen' ? '☑' : '☐', r.status === 'abgeholt' ? '☑' : '☐']) }], footer: fussZeile() };
}
function docPick(ko) {
  const o = ko.o;
  return { title: `Kommissionierung Nr. ${o.nr} – ${o.name}`, sub: [`Tier: ${o.tier}`, `Genusspakete: ${fmtNum(o.pakete)}${num(o.pakVak) ? ` (davon ${fmtNum(o.pakVak)} vakuumieren)` : ''} · Vakuum-Tüten: ${ko.tueten || '–'}`],
    blocks: [{ type: 'kv', rows: [['Lagerplatz', lagerText(o) || lagerVorschlag(S, o).ort, lagerText(o) ? '' : '(' + lagerVorschlag(S, o).grund + ')'], ['Separat vom Metzger', ko.sonder.join('; ') || '–'], ['Innereien (separat)', ko.innereien.join(', ') || '–']] },
      { type: 'table', head: ['☐', 'Kiste', 'Menge', 'Inhalt', 'verpacken', 'Stellplatz'], widths: [0.5, 0.9, 1.2, 2.4, 4, 2.4], align: ['', 'r', 'r', '', '', ''],
        rows: ko.picks.map(p => ['☐', p.hackTisch ? 'Hack-Tisch' : p.kiste, `${fmtNum(p.menge, 2)} ${p.einheit}`, p.art, p.verpacken, p.platz]), leer: 'keine Kisten eingetragen' },
      ...ko.rows.filter(r => r.fehlt > 0).map(r => ({ type: 'text', warn: true, text: `Fehlt: ${fmtNum(r.fehlt, 2)} ${r.einheit} ${r.art}` }))], footer: fussZeile() };
}

// =====================================================================
//  Schlachttag (Unterlagen je Tier)
// =====================================================================
function viewSchlachttag(tab, q) {
  if (q.get('tier')) ui.tierWahl = q.get('tier');
  const tn = standardTier();
  titel('Schlachttag' + (tn ? ' – ' + tn : ''));
  if (!tiereSortiert().length) { inhalt().innerHTML = '<h1>Schlachttag</h1><div class="karte">Keine aktiven Tiere angelegt. <a href="#/tier/neu">Tier anlegen</a></div>'; return; }
  let h = `<div class="zeile" style="margin-bottom:12px"><h1 class="platz" style="margin:0">Schlachttag</h1>
    <label class="f" style="min-width:320px">Tier<select class="feld" data-ch="tierwahl">${tiereSortiert().map(t => opt(t.name, `${t.name} – ${abholTxt(t)}`, t.name === tn)).join('')}</select></label></div>
    <div class="reiter">${REITER.map(([k, t]) => `<a href="#/schlachttag/${k}" class="${k === tab || (k === 'kisten' && tab === 'packplan') ? 'aktiv' : ''}">${t}</a>`).join('')}</div><div id="tabinhalt"></div>`;
  inhalt().innerHTML = h;
  ui.acts.tierwahl = el => { ui.tierWahl = el.value; render(); };
  const ziel = $('#tabinhalt');
  const zeige = (doc, extraKnopf = '', vorher = '') => {
    ziel.innerHTML = vorher + knopfTeilen(extraKnopf) + docHtml(doc);
    ui.acts.teilen = async () => { const r = await docTeilen(doc, doc.title); if (r === 'gespeichert') meldung('Bild gespeichert (Teilen wird hier nicht unterstützt).'); };
    ui.acts.drucken = () => docDrucken(doc);
  };
  if (tab === 'menge') zeige(docMenge(mengenpruefung(S, tn)));
  else if (tab === 'metzger') tabMetzger(tn, ziel, zeige);
  else if (tab === 'kisten' || tab === 'packplan') tabKisten(tn, ziel);
  else if (tab === 'hack') zeige(docHack(hackZettel(S, tn)));
  else if (tab === 'innereien') zeige(docInnereien(innereien(S, tn)));
  else if (tab === 'packliste') tabPackliste(tn, ziel);
}

function tabMetzger(tn, ziel, zeige) {
  zeige(docMetzger(metzgerauftrag(S, tn)));
}

// =====================================================================
//  Kisten & Ladeplan (Packplan und Kistenliste in einem)
// =====================================================================
// Ochsenschwanz: Stückzahl im Feld kg (Zuteilung nach Stück), Gewicht getrennt im Feld gew
const istGewogen = k => k.art === OCHS ? has(k.gew) : !!k.gewogen || (has(k.plan) && has(k.kg) && Math.abs(num(k.kg) - num(k.plan)) > 0.001);
// Draufsicht aus der aktuellen Kistenliste (Stellplatz-Text „hinten links, oben“ / „Mitte rechts, 2. v. u.“)
function felderAusKisten(tn) {
  const rows = kistenRows(S, tn);
  return S.auto.map(f => {
    const ks = {};
    rows.filter(k => sameText(String(k.platz || '').split(',')[0], f.name)).forEach(k => {
      const e = /oben/.test(k.platz) ? 99 : num((/(\d+)\./.exec(k.platz) || [])[1]);
      const x = ks[k.nr] = ks[k.nr] || { nr: k.nr, ebene: e, teile: [], gewogen: true };
      x.teile.push(k.art === OCHS ? `${k.art} ${fmtNum(k.kg, 0)} Stk${has(k.gew) ? ' ' + fmtNum(k.gew, 1) + ' kg' : ''}` : `${k.art} ${fmtNum(k.kg, 1)}`); if (!istGewogen(k)) x.gewogen = false;
    });
    const liste = Object.values(ks).sort((a, b) => b.ebene - a.ebene);
    return { name: f.name, belegt: liste.length, hoehe: num(f.hoehe), kisten: liste.map((k, i) => ({ nr: k.nr, text: k.teile.join(' + '), oben: i === 0, gewogen: k.gewogen })) };
  });
}
function autoDraufsicht(felderIn, kompakt) {
  const pos = name => {
    const n = name.toLowerCase();
    const reihe = n.includes('vorne') ? 1 : n.includes('mitte') && !n.startsWith('hinten') ? 2 : n.includes('hinten') ? 3 : 0;
    const sp = n.includes('links') ? 1 : n.includes('rechts') ? 3 : 2;
    return { reihe, sp };
  };
  const hp = S.settings.hackPlatz || 'vorne rechts';
  const felder = felderIn.map(f => ({ ...f, p: pos(f.name) }));
  const zelle = f => `<div class="auto-feld ${f.kisten.length ? '' : 'leer'}" style="grid-row:${f.p.reihe + 1};grid-column:${f.p.reihe === 3 ? (f.p.sp === 1 ? '1 / span 3' : '4 / span 3') : (f.p.sp - 1) * 2 + 1 + ' / span 2'}"><div class="fn">${esc(f.name)} <span class="klein">${f.belegt}/${f.hoehe}${sameText(f.name, hp) ? ' · Hack' : ''}</span></div>${f.kisten.map(k => `<div class="ak${k.gewogen ? ' gw' : ''}"><b>K${k.nr}</b> ${esc(k.text)}</div>`).join('')}</div>`;
  if (felder.some(f => !f.p.reihe)) return `<div class="karte"><h3 style="margin-top:0">Stellplätze</h3>${felder.map(f => `<div><b>${esc(f.name)}</b>: ${f.kisten.map(k => 'K' + k.nr).join(', ')}</div>`).join('')}</div>`;
  return `<div class="karte ${kompakt ? 'kompakt' : ''}"><h3 style="margin-top:0">Draufsicht Auto <span class="klein">(oben = vorne, je Feld oberste Kiste zuerst)</span></h3><div class="zeile oben" style="flex-wrap:nowrap"><div class="auto-grid" style="grid-template-columns:repeat(6,1fr);flex:1;max-width:none">
    <div class="auto-tuer" style="grid-row:1;grid-column:1 / -1">— Fahrerhaus / vorne —</div>${felder.map(zelle).join('')}
    <div class="auto-tuer" style="grid-row:5;grid-column:1 / -1">— Tür hinten —</div></div><div class="klein" style="writing-mode:vertical-rl;align-self:center">rechte Tür ▸</div></div></div>`;
}

function tabKisten(tn, ziel) {
  const pp = S.packplaene[tn];
  const t = tier(S, tn);
  const calc = kistenCalc(S, tn);
  const gewogen = calc.filter(c => istGewogen(c.k)).length;
  const andere = kistenTiere(S).filter(x => x !== tn);
  if (!calc.length) {
    ziel.innerHTML = `<div class="karte" style="max-width:820px"><h3 style="margin-top:0">Noch kein Plan für ${esc(tn)}</h3>
      <p>„Plan erstellen“ rechnet aus, welche Stücke in welche Metzgerkiste kommen (max. ${fmtNum(S.settings.kisteMax)} kg; gemischt nur Rostbraten + Steak bzw. Filet + Braten + Tafelspitz), wo jede Kiste im Auto steht und in welcher Reihenfolge beim Metzger eingeladen wird. Hackfleisch steht immer auf „${esc(S.settings.hackPlatz || 'vorne rechts')}“.</p>
      <p class="klein">Die Kisten werden gleich mit geschätzten kg angelegt. Beim Metzger trägst du dann die gewogenen kg ein.</p>
      ${andere.length >= 2 ? `<p class="warn">Es sind schon Kisten für ${andere.map(esc).join(' und ')} eingetragen (max. zwei Tiere gleichzeitig) – fertige Tiere bitte vorher abschließen.</p>` : ''}
      <div class="knopfleiste"><button class="btn braun" data-act="planen" style="min-height:56px;font-size:18px">Plan erstellen</button></div></div>`;
  } else {
    ziel.innerHTML = `<div class="knopfleiste" style="margin-bottom:10px">
        <button class="btn braun" data-act="planen">Plan neu berechnen</button>
        <button class="btn haupt" data-act="teilenPlan">Ladeplan teilen (Metzger)</button>
        <button class="btn" data-act="teilenKisten">Kistenliste teilen</button>
        <button class="btn" data-act="drucken">Drucken</button>
        <span class="platz"></span>
        <span class="marke ${gewogen === calc.length ? 'gruen' : gewogen ? 'gelb' : ''}" style="align-self:center;font-size:14px;padding:6px 12px">${gewogen} von ${calc.length} gewogen</span></div>
      ${pp && pp.warn.length ? pp.warn.map(w => `<div class="hinweis" style="padding:6px 12px;margin-bottom:8px">${esc(w)}</div>`).join('') : ''}
      <div class="kistenlayout">
        <div>${autoDraufsicht(felderAusKisten(tn), true)}
          ${pp ? `<details class="karte"><summary class="fett">Einladereihenfolge beim Metzger</summary><ol class="klein" style="padding-left:20px;margin:8px 0 0">${pp.einladen.map(e => `<li>${esc(e.replace(/^\d+\.\s*/, ''))}</li>`).join('')}</ol></details>` : ''}</div>
        <div class="karte" style="padding:0">
          <div class="tabwrap" style="border:none"><table class="tab ktab"><thead><tr><th class="r">Kiste</th><th>Inhalt</th><th class="r">Plan</th><th class="r">gewogen kg</th><th>Stellplatz</th><th class="r">Rest</th><th></th></tr></thead><tbody>
          ${calc.map(c => { const gw = istGewogen(c.k); return `<tr data-id="${c.k.id}" class="${gw ? 'gw' : ''}">
            <td style="width:58px"><input class="feld zahl" inputmode="numeric" data-ch="kf" data-f="nr" value="${c.k.nr}"></td>
            <td><select class="feld" data-ch="kf" data-f="art">${kistenArtOpt(c.k.art)}</select>${c.teile ? `<div class="klein teile">${esc(c.teile)}</div>` : ''}</td>
            <td class="r klein">${has(c.k.plan) ? (c.k.art === OCHS ? fmtNum(c.k.plan, 0) + ' Stk' : fmtNum(c.k.plan, 1)) : ''}</td>
            <td style="width:96px">${c.k.art === OCHS ? `<input class="feld zahl" inputmode="decimal" data-ch="kf" data-f="gew" value="${has(c.k.gew) ? fmtIn(c.k.gew, 2) : ''}" placeholder="kg" title="Ochsenschwanz gewogen (kg)"><div class="klein">Stück: <input class="feld zahl klein" style="width:44px;padding:2px 4px;min-height:0" inputmode="numeric" data-ch="kf" data-f="kg" value="${fmtIn(c.k.kg, 0)}" title="Anzahl Ochsenschwänze"></div>` : `<input class="feld zahl" inputmode="decimal" data-ch="kf" data-f="kg" value="${gw ? fmtIn(c.k.kg, 2) : ''}" placeholder="${has(c.k.plan) ? fmtNum(c.k.plan, 1) : ''}">`}</td>
            <td style="width:150px"><input class="feld klein" data-ch="kf" data-f="platz" value="${esc(c.k.platz || '')}"></td>
            <td class="r fett">${c.k.art === OCHS ? fmtNum(c.rest, 0) + ' Stk' : fmtNum(c.rest, 1)}</td>
            <td style="width:44px"><button class="btn klein rot" data-act="kweg" data-id="${c.k.id}">✕</button></td></tr>`; }).join('')}
          </tbody></table></div>
          <div class="knopfleiste" style="padding:10px 12px"><button class="btn klein" data-act="kneu">+ Kistenzeile</button><span class="platz"></span><button class="btn braun klein" data-act="abschluss">Tier abgeschlossen → Reste an Hofladen</button></div>
        </div>
      </div>
      <p class="klein">Grün = gewogen. Leeres Feld bei „gewogen“ = es wird mit dem Planwert gerechnet. „Rest“ = was nach allen Bestellungen in der Kiste übrig bleibt.</p>`;
  }
  ui.acts.planen = async () => {
    const neu = packplan(S, tn);
    if (neu.fehler) return meldung(neu.fehler, true);
    if (gewogen && !(await frage('Plan neu berechnen', `<b>${gewogen} Kistenzeilen sind schon gewogen.</b> Beim Neuberechnen werden alle Kisten von ${esc(tn)} durch den neuen Plan ersetzt und die gewogenen kg gehen verloren.`, 'Trotzdem neu berechnen', 'Abbrechen', 'rot'))) return;
    S.packplaene[tn] = neu; packplanUebernehmen(S, neu); speichern(); render();
    meldung(`Plan erstellt: ${neu.kisten.length} Kisten.`);
    if (neu.warn.length) dialog('Hinweis zum Plan', neu.warn.map(w => `<p class="warn">${esc(w)}</p>`).join(''));
  };
  const find = id => S.kisten.find(k => k.id === +id);
  ui.acts.kf = el => {
    const k = find(el.closest('tr').dataset.id); const f = el.dataset.f;
    if (f === 'nr') { const n = Math.round(num(el.value)); if (n < 1 || n > 29) { meldung('Kistennummer 1 bis 29', true); render(); return; } k.nr = n; }
    else if (f === 'gew') { k.gew = el.value.trim() === '' ? null : num(el.value); }
    else if (f === 'kg' && k.art === OCHS) { k.kg = el.value.trim() === '' ? (has(k.plan) ? k.plan : 0) : Math.max(0, Math.round(num(el.value))); }
    else if (f === 'kg') { if (el.value.trim() === '') { k.kg = has(k.plan) ? k.plan : null; k.gewogen = false; } else { k.kg = num(el.value); k.gewogen = true; } }
    else k[f] = el.value;
    speichern(); render();
  };
  ui.acts.kweg = el => { S.kisten = S.kisten.filter(k => k.id !== +el.dataset.id); speichern(); render(); };
  ui.acts.kneu = () => {
    const id = S.kisten.reduce((m, k) => Math.max(m, k.id || 0), 0) + 1;
    const nr = Math.min(29, calc.reduce((m, c) => Math.max(m, c.k.nr), 0) + 1);
    S.kisten.push({ id, tier: tn, nr, art: 'Braten', kg: null, plan: null, platz: '', gewogen: false }); speichern(); render();
  };
  const teilen = async d => { const r = await docTeilen(d, d.title); if (r === 'gespeichert') meldung('Bild gespeichert.'); };
  ui.acts.teilenPlan = () => pp ? teilen(docPackplan(pp, t)) : meldung('Bitte zuerst „Plan neu berechnen“.', true);
  ui.acts.teilenKisten = () => teilen(docKisten(tn, kistenCalc(S, tn)));
  ui.acts.drucken = () => docDrucken(pp ? [docPackplan(pp, t), docKisten(tn, kistenCalc(S, tn))] : docKisten(tn, kistenCalc(S, tn)));
  ui.acts.abschluss = async () => {
    const reste = calc.filter(c => c.rest > 0.0001 && c.k.art !== 'Sonderfälle (beschriftet)');
    const offen = ordersOfTier(S, tn).filter(o => (o.status || 'offen') === 'offen');
    if (!(num(t.sg) > 0)) return dialog('Schlachtgewicht fehlt', `<p>Bitte zuerst das echte Schlachtgewicht von ${esc(tn)} eintragen (z. B. von der Metzgerrechnung). Es wird für die Ausbeute-Statistik gebraucht.</p><p><a href="#/tier/${encodeURIComponent(tn)}">Tier ${esc(tn)} öffnen</a></p>`);
    if (offen.length) return dialog('Tier noch nicht fertig', `<p>${esc(tn)} kann erst abgeschlossen werden, wenn alle Bestellungen gepackt sind.</p><p class="warn">Noch offen: ${offen.map(o => 'Nr. ' + o.nr + ' ' + esc(o.name)).join(', ')}</p>`);
    if (!(await frage('Tier abschließen', `Alle Bestellungen von <b>${esc(tn)}</b> sind gepackt.<br>${reste.length} Reste gehen an den Hofladen, danach werden die ${calc.length} Kistenzeilen geleert und ${esc(tn)} kommt ins Archiv (mit Bestellungen, gewogener Ausbeute und Kistenstand).${(t.erfassung || []).length ? '' : '<br><b>Hinweis:</b> Bei diesem Tier wurde noch nichts gewogen (Kommissionieren → Ausbeute wiegen) – es zählt dann nicht für die Ausbeute-Statistik.'}`, 'Abschließen'))) return;
    const n = tierAbschliessen(S, tn); delete S.packplaene[tn]; speichern();
    meldung(`${tn} abgeschlossen und im Archiv: ${n} Reste ins Hofladen-Blatt übernommen, Kisten geleert.`); ui.tierWahl = ''; render();
  };
}
const kistenArtOpt = sel => S.artikel.filter(a => !istOrgan(a.name)).map(a => opt(a.name, a.name, a.name === sel)).join('') + opt('Sonderfälle (beschriftet)', 'Sonderfälle (beschriftet)', sel === 'Sonderfälle (beschriftet)');

function tabPackliste(tn, ziel) {
  const pl = packliste(S, tn);
  ziel.innerHTML = `<div class="knopfleiste" style="margin-bottom:10px"><button class="btn haupt" data-act="teilen">Als Bild teilen</button><button class="btn" data-act="drucken">Drucken</button></div>
    <div class="klein" style="margin-bottom:8px">Endbetrag nach dem Wiegen eintragen. Status antippen: offen → gepackt (mit Lagerplatz) → abgeholt.</div>
    <div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Name</th><th>Telefon</th><th>Bestellung</th><th>Sonderfälle</th><th>Lagerplatz</th><th class="r">Schätzpreis</th><th class="r">Endbetrag</th><th>Status</th></tr></thead><tbody>
    ${pl.rows.map(r => `<tr data-nr="${r.nr}"><td class="r"><a href="#/bestellung/${r.nr}">${r.nr}</a></td><td class="fett">${esc(r.name)}</td><td>${r.tel ? `<a href="tel:${esc(r.tel)}">${esc(r.tel)}</a>` : ''}</td><td class="klein">${esc(r.text)}</td><td class="klein">${esc(r.sonder)}</td><td>${r.lager ? `<b>${esc(r.lager)}</b>` : `<span class="klein">Vorschlag: ${esc(r.lagerVorschlag)}</span>`}</td><td class="r">${fmtEur(r.schaetz)}</td>
      <td style="width:120px"><input class="feld zahl" inputmode="decimal" data-ch="betrag" value="${r.endbetrag !== null ? fmtIn(r.endbetrag, 2, 2) : ''}"></td><td><button class="btn klein" data-act="status">${statusMarke(r.status)}</button></td></tr>`).join('') || '<tr><td colspan="9" class="klein">Keine Bestellungen für dieses Tier.</td></tr>'}
    </tbody></table></div>`;
  const best = el => S.bestellungen.find(o => o.nr === +el.closest('tr').dataset.nr);
  ui.acts.betrag = el => { const o = best(el); o.endbetrag = el.value.trim() === '' ? null : r2(num(el.value)); speichern(); };
  ui.acts.status = async el => {
    const o = best(el); const f = ['offen', 'gepackt', 'abgeholt']; const neu = f[(f.indexOf(o.status || 'offen') + 1) % 3];
    if (neu === 'gepackt') { if (!(await lagerDialog(o))) return; }
    else { o.status = neu; if (neu === 'offen') { o.lagerOrt = ''; o.lagerPlatz = ''; o.gepacktAm = null; } speichern(); }
    render();
  };
  ui.acts.teilen = async () => { const d = docPackliste(packliste(S, tn)); const r = await docTeilen(d, d.title); if (r === 'gespeichert') meldung('Bild gespeichert.'); };
  ui.acts.drucken = () => docDrucken(docPackliste(packliste(S, tn)));
}

// =====================================================================
//  Kommissionieren (Pick-by-Light-Liste je Bestellung)
// =====================================================================
// Ausbeute wiegen beim Kommissionieren: Gewicht eintippen, dann Teil antippen (Braten nach Teilstück)
function wiegeKarte(tn, nr) {
  const t = tier(S, tn); if (!t) return '';
  const fuer = ui.wiegeFuer === 'rest' ? 0 : nr;
  const er = (t.erfassung || []).map((e, i) => ({ e, i })).filter(x => num(x.e.nr) === fuer).reverse();
  const su = erfassungSumme(t, S);
  const knopf = w => { const v = w.teil ? su.teil[w.teil] : su.art[w.art]; return `<button class="btn" style="min-height:52px;flex:1 1 150px" data-act="wiege" data-art="${esc(w.art)}" data-teil="${esc(w.teil)}">${esc(w.teil ? w.teil.replace(/\s*\(.*\)$/, '') : w.art)}${v ? `<br><span class="klein">${v.teile} ${v.teile === 1 ? 'Teil' : 'Teile'} · ${fmtNum(v.kg, 1)} kg</span>` : ''}</button>`; };
  const arten = wiegeArten(S);
  return `<div class="karte"><div class="zeile" style="margin-bottom:8px"><h3 class="platz" style="margin:0">Ausbeute wiegen – ${esc(tn)} <span class="klein">${su.teile} ${su.teile === 1 ? 'Teil' : 'Teile'} · ${fmtNum(su.kg, 1)} kg bisher</span></h3>
      <label class="f">gewogen für<select class="feld" data-ch="wiegefuer">${opt('nr', `Nr. ${nr}`, fuer !== 0)}${opt('rest', 'Rest (Hofladen)', fuer === 0)}</select></label>
      <label class="f">Gramm<input class="feld zahl" id="wiegekg" inputmode="numeric" style="width:120px;font-size:22px" placeholder="0"></label></div>
    <div class="klein" style="margin-bottom:8px">Gewicht in <b>Gramm</b> eintippen, dann das Teil antippen. Braten nach Teilstück, alles andere nach Artikel. Hackfleisch, Suppen- und Soßenknochen werden nicht einzeln gewogen – sie zählen über die gewogenen Kisten (Kisten &amp; Ladeplan). Gesamtübersicht und Löschen beim <a href="#/tier/${encodeURIComponent(tn)}">Tier</a>.</div>
    <div class="zeile" style="gap:8px;flex-wrap:wrap">${arten.map(knopf).join('')}</div>
    ${er.length ? `<div class="klein" style="margin-top:10px"><b>Zuletzt ${fuer ? 'für Nr. ' + nr : 'als Rest'}:</b> ${er.slice(0, 12).map(({ e, i }) => `<span class="marke" style="margin:2px">${esc(e.teil ? e.teil.replace(/\s*\(.*\)$/, '') : e.art)} ${fmtNum(num(e.kg) * 1000, 0)} g <a href="#" data-act="wiegeWeg" data-i="${i}" title="löschen">✕</a></span>`).join('')}</div>` : ''}</div>`;
}
function wiegeAktionen(tn, nr) {
  const t = tier(S, tn); if (!t) return;
  // nach dem Neuzeichnen beim Wiegen bleiben (nicht nach oben springen), Feld wieder bereit
  const wiegeNeu = () => { render(); setTimeout(() => { const g = $('#wiegekg'); if (g) { g.scrollIntoView({ block: 'center' }); g.focus(); } }, 30); };
  ui.acts.wiegefuer = el => { ui.wiegeFuer = el.value; wiegeNeu(); };
  ui.acts.wiege = el => {
    // Eingabe in Gramm (ganze Zahl; „1.450“ oder „1450“), gespeichert wird weiter in kg
    const f = $('#wiegekg'); const g = Math.round(parseFloat(String(f.value).replace(/[\s.]/g, '').replace(',', '.')) || 0); const kg = g / 1000;
    if (!(g > 0)) { meldung('Bitte zuerst das Gewicht in Gramm eintippen.', true); f.focus(); return; }
    if (g < 20) { meldung(`${fmtNum(g)} g? Bitte in Gramm eintippen (z. B. 1450 für 1,45 kg).`, true); f.focus(); return; }
    if (g > 30000) { meldung(`${fmtNum(g)} g für ein Teil? Bitte prüfen (in Gramm, z. B. 1450).`, true); f.focus(); return; }
    if (!Array.isArray(t.erfassung)) t.erfassung = [];
    t.erfassung.push({ art: el.dataset.art, teil: el.dataset.teil || '', kg: r3(kg), nr: ui.wiegeFuer === 'rest' ? 0 : nr, zeit: new Date().toISOString() });
    speichern(); meldung(`${el.dataset.teil || el.dataset.art}: ${fmtNum(g)} g erfasst.`); wiegeNeu();
  };
  ui.acts.wiegeWeg = el => { t.erfassung.splice(+el.dataset.i, 1); speichern(); wiegeNeu(); };
}
function viewKommissionierung(q) {
  if (q.get('tier')) ui.tierWahl = q.get('tier');
  const tn = standardTier();
  titel('Kommissionieren' + (tn ? ' – ' + tn : ''));
  const ords = tn ? ordersOfTier(S, tn) : [];
  let nr = +q.get('nr') || ui.kommiNr;
  if (!ords.some(o => o.nr === nr)) nr = (ords.find(o => (o.status || 'offen') === 'offen') || ords[0] || {}).nr;
  ui.kommiNr = nr;
  let h = `<div class="zeile" style="margin-bottom:12px"><h1 class="platz" style="margin:0">Kommissionieren</h1>
    <label class="f" style="min-width:300px">Tier<select class="feld" data-ch="tierwahl">${tiereSortiert().map(t => opt(t.name, `${t.name} – ${abholTxt(t)}`, t.name === tn)).join('')}</select></label></div>`;
  if (!ords.length) { inhalt().innerHTML = h + '<div class="karte">Keine Bestellungen für dieses Tier.</div>'; ui.acts.tierwahl = el => { ui.tierWahl = el.value; ui.kommiNr = null; render(); }; return; }
  const ko = kommissionierung(S, nr);
  const idx = ords.findIndex(o => o.nr === nr);
  const ticks = ui.ticks[nr] = ui.ticks[nr] || {};
  const ohneKisten = !S.kisten.some(k => k.tier === tn);
  h += `<div class="zeile" style="margin-bottom:12px">
      <button class="btn" data-act="vor" data-d="-1" ${idx <= 0 ? 'disabled' : ''}>◀ vorige</button>
      <select class="feld platz" data-ch="nrwahl">${ords.map(o => opt(o.nr, `Nr. ${o.nr} – ${o.name} (${o.status || 'offen'})`, o.nr === nr)).join('')}</select>
      <button class="btn" data-act="vor" data-d="1" ${idx >= ords.length - 1 ? 'disabled' : ''}>nächste ▶</button></div>
    ${ohneKisten ? '<div class="hinweis">Für dieses Tier sind noch keine Kisten eingetragen (Schlachttag → Kisten & Ladeplan → „Plan erstellen“).</div>' : ''}
    <div class="spalten2"><div class="karte">
      <h2 style="margin-top:0">Nr. ${ko.o.nr} – ${esc(ko.o.name)} ${statusMarke(ko.o.status)}</h2>
      ${(() => { const lv = lagerVorschlag(S, ko.o); const ort = ko.o.lagerOrt || lv.ort;
        return `<div class="lagerbox ${ort === 'Kühlschrank' ? 'ks' : 'kr'}"><div class="klein">${ko.o.lagerOrt ? 'verräumt' : 'Lagerplatz nach dem Packen'}</div><div class="lagerort">${ort === 'Kühlschrank' ? '❄ Kühlschrank' : '▣ Kühlraum – Metzgerkiste'}${ko.o.lagerPlatz ? ' · ' + esc(ko.o.lagerPlatz) : ''}</div><div class="klein">${esc(lv.grund)}</div></div>`; })()}
      <table class="doc-kv"><tr><td>Genusspakete</td><td class="fett">${fmtNum(ko.o.pakete) || '–'}${num(ko.o.pakVak) ? ` (davon ${fmtNum(ko.o.pakVak)} vakuumieren)` : ''}</td></tr>
      <tr><td>Separat vom Metzger</td><td class="fett">${esc(ko.sonder.join('; ') || '–')}</td></tr>
      <tr><td>Vakuum-Tüten</td><td class="fett">${ko.tueten || '–'}</td></tr>
      <tr><td>Innereien (separat)</td><td class="fett">${esc(ko.innereien.join(', ') || '–')}</td></tr>
      ${ko.o.notiz ? `<tr><td>Notiz</td><td class="fett">${esc(ko.o.notiz)}</td></tr>` : ''}</table>
      <div class="knopfleiste" style="margin-top:14px"><button class="btn haupt" data-act="gepackt">Gepackt ✓ und weiter</button><button class="btn" data-act="teilen">Als Bild teilen</button><button class="btn" data-act="drucken">Drucken</button></div>
      <h3>Bedarf</h3><table class="tab"><thead><tr><th>Artikel</th><th class="r">einzeln</th><th class="r">aus Paketen</th><th class="r">Bedarf</th><th class="r">aus Kisten</th><th class="r">fehlt</th></tr></thead><tbody>
      ${ko.rows.filter(r => r.bedarf > 0.0001).map(r => `<tr class="${r.fehlt > 0 ? 'rot' : ''}"><td>${esc(r.art)}${istOrgan(r.art) ? ' <span class="klein">(separat)</span>' : ''}</td><td class="r">${fmtNum(r.einzeln, 2)}</td><td class="r">${fmtNum(r.ausPak, 2)}</td><td class="r">${fmtNum(r.bedarf, 2)}</td><td class="r">${fmtNum(r.ausKisten, 2)}</td><td class="r">${r.fehlt > 0 ? fmtNum(r.fehlt, 2) : ''}</td></tr>`).join('')}
      </tbody></table></div>
    <div class="karte" style="padding:0"><h3 style="margin:14px 16px 4px">Pickliste – antippen wenn erledigt</h3>
      ${ko.picks.map((p, i) => `<div class="pick ${ticks[i] ? 'erledigt' : ''}" data-act="tick" data-i="${i}"><div class="kiste${p.hackTisch ? ' hack' : ''}">${p.hackTisch ? 'Hack' : p.kiste}</div><div class="menge">${fmtNum(p.menge, 2)} ${p.einheit}</div><div><b>${esc(p.art)}</b>${p.verpacken ? `<div class="klein">${esc(p.verpacken)}</div>` : ''}</div><div class="klein">${esc(p.platz)}</div></div>`).join('') || '<div style="padding:16px" class="klein">Nichts aus den Kisten zu holen.</div>'}
    </div></div>
    ${wiegeKarte(tn, nr)}`;
  inhalt().innerHTML = h;
  wiegeAktionen(tn, nr);
  ui.acts.tierwahl = el => { ui.tierWahl = el.value; ui.kommiNr = null; render(); };
  ui.acts.nrwahl = el => { ui.kommiNr = +el.value; gehe('#/kommissionierung?nr=' + el.value); };
  ui.acts.vor = el => { const o = ords[idx + num(el.dataset.d)]; if (o) gehe('#/kommissionierung?nr=' + o.nr); };
  ui.acts.tick = el => { const i = +el.dataset.i; ticks[i] = !ticks[i]; el.classList.toggle('erledigt', ticks[i]); };
  ui.acts.gepackt = async () => {
    const o = S.bestellungen.find(x => x.nr === nr);
    if (!(await lagerDialog(o))) return;
    const naechste = ords.slice(idx + 1).find(x => (x.status || 'offen') === 'offen') || ords[idx + 1];
    meldung(`Nr. ${nr} gepackt → ${lagerText(o)}.`);
    if (naechste) gehe('#/kommissionierung?nr=' + naechste.nr); else render();
  };
  ui.acts.teilen = async () => { const d = docPick(ko); const r = await docTeilen(d, d.title); if (r === 'gespeichert') meldung('Bild gespeichert.'); };
  ui.acts.drucken = () => {
    if (ords.length > 1) {
      dialog('Drucken', '<p>Nur diese Bestellung oder alle Bestellungen des Tiers drucken?</p>', [{ k: 'x', t: 'Abbrechen' }, { k: 'eine', t: 'Nur diese' }, { k: 'alle', t: `Alle ${ords.length}`, cls: 'haupt' }])
        .then(k => { if (k === 'eine') docDrucken(docPick(ko)); if (k === 'alle') docDrucken(ords.map(o => docPick(kommissionierung(S, o.nr)))); });
    } else docDrucken(docPick(ko));
  };
}

// =====================================================================
//  Hofladen
// =====================================================================
function viewHofladen() {
  titel('Hofladen');
  const jahre = [...new Set(S.hofladen.map(h => String(h.datum).slice(0, 4)))].sort().reverse();
  const jahr = ui.hofJahr && jahre.includes(ui.hofJahr) ? ui.hofJahr : (jahre[0] || String(new Date().getFullYear()));
  const sum = hofladenSummen(S, jahr);
  const liste = S.hofladen.map((h, i) => ({ h, i })).filter(x => String(x.h.datum).startsWith(jahr)).reverse();
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:12px"><h1 class="platz" style="margin:0">Reste an den Hofladen</h1>
    ${jahre.length > 1 ? `<select class="feld" style="width:auto" data-ch="jahr">${jahre.map(j => opt(j, j, j === jahr)).join('')}</select>` : ''}</div>
    <div class="klein" style="margin-bottom:10px">Wird von „Tier abgeschlossen“ (Schlachttag → Kisten & Ladeplan) gefüllt: was nach dem Kommissionieren in den Kisten übrig bleibt.</div>
    <div class="spalten2"><div class="karte"><h3 style="margin-top:0">Summe ${jahr}</h3><table class="tab"><tbody>${sum.map(s => `<tr><td>${esc(s.art)}</td><td class="r fett">${fmtNum(s.summe, 2)} ${esc(s.einheit)}</td></tr>`).join('') || '<tr><td class="klein">noch nichts</td></tr>'}</tbody></table></div>
    <div class="tabwrap"><table class="tab"><thead><tr><th>Datum</th><th>Tier</th><th class="r">Kiste</th><th>Artikel</th><th class="r">Rest</th><th></th></tr></thead><tbody>
    ${liste.map(({ h, i }) => `<tr><td>${fmtDate(h.datum)}</td><td>${esc(h.tier)}</td><td class="r">${h.kiste}</td><td>${esc(h.art)}</td><td class="r">${fmtNum(h.rest, 2)} ${esc(h.einheit)}</td><td><button class="btn klein rot" data-act="weg" data-i="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="6" class="klein">keine Einträge</td></tr>'}
    </tbody></table></div></div>`;
  ui.acts.jahr = el => { ui.hofJahr = el.value; render(); };
  ui.acts.weg = async el => { if (!(await frage('Eintrag löschen', 'Diesen Hofladen-Eintrag löschen?', 'Löschen', 'Abbrechen', 'rot'))) return; S.hofladen.splice(+el.dataset.i, 1); speichern(); render(); };
}

// =====================================================================
//  Einstellungen & Datensicherung
// =====================================================================
const EREITER = [['daten', 'Daten & Sicherung'], ['preise', 'Preisliste'], ['paket', 'Genusspaket'], ['ausbeute', 'Ausbeute & Kisten'], ['auto', 'Auto (Stellplätze)'], ['hof', 'Hof & Hilfe']];
async function sicherungErstellen(teilen) {
  if (!sicherungPw) { meldung(PW_FEHLT, true); return gehe('#/einstellungen/daten'); }
  const blob = await sicherungBlob(S), name = sicherungName();
  const r = teilen ? await teilenDatei(blob, name, 'Sicherung Bestellsystem', '') : (download(blob, name), 'gespeichert');
  if (r !== 'abgebrochen') { S.letzteSicherung = new Date().toISOString(); speichern(); meldung(r === 'geteilt' ? 'Sicherung geteilt.' : `Sicherung „${name}“ im Ordner „Download“ gespeichert.`); if (location.hash.includes('einstellungen') || location.hash.length < 3 || location.hash.includes('start')) render(); }
}
function viewEinstellungen(tab) {
  titel('Einstellungen');
  inhalt().innerHTML = `<h1>Einstellungen</h1><div class="reiter">${EREITER.map(([k, t]) => `<a href="#/einstellungen/${k}" class="${k === tab ? 'aktiv' : ''}">${t}</a>`).join('')}</div><div id="tabinhalt"></div>`;
  const z = $('#tabinhalt');
  if (tab === 'daten') tabDaten(z);
  else if (tab === 'preise') tabPreise(z);
  else if (tab === 'ausbeute') tabAusbeute(z);
  else if (tab === 'auto') tabAuto(z);
  else if (tab === 'paket') tabPaket(z);
  else tabHof(z);
}
async function tabDaten(z) {
  const tage = S.letzteSicherung ? new Date(S.letzteSicherung).toLocaleString('de-DE') : 'noch nie';
  const snaps = await schnappschuesse();
  if (!document.body.contains(z)) return;
  const adr = sicherungsAdresse(S.settings.sicherungUrl);
  const autoTxt = !S.settings.sicherungUrl ? 'aus' : !adr ? '<span class="warn">Adresse ungültig</span>' :
    (autoMeta.gesendetAm ? `letzte: <b>${new Date(autoMeta.gesendetAm).toLocaleString('de-DE')}</b>${autoMeta.datei ? ' (' + esc(autoMeta.datei) + ')' : ''}` : 'noch keine') +
    (autoMeta.fehler ? `<br><span class="warn">Letzter Versuch fehlgeschlagen: ${esc(autoMeta.fehler)}</span>` : '');
  const inaktiv = inaktiveKunden(S);
  z.innerHTML = `<div class="spalten2"><div>
    <div class="karte"><h3 style="margin-top:0">Sicherungs-Passwort</h3>
      <p class="klein">Alle Sicherungen, die das Tablet verlassen (Google Drive, Teilen, als Datei), werden mit diesem Passwort verschlüsselt. Google sieht nur Zeichensalat. Das Passwort bleibt nur auf diesem Tablet und ist nicht in der Sicherung.</p>
      <p>Status: ${sicherungPw ? '<b class="ok">festgelegt ✓</b>' : '<b class="warn">noch nicht festgelegt – es wird nichts gesichert</b>'}</p>
      <p class="klein"><b>Wichtig:</b> Passwort aufschreiben und sicher aufbewahren (nicht auf dem Tablet). Ohne Passwort lässt sich keine Sicherung mehr einspielen – auch Claude oder Google können dann nicht helfen.</p>
      <button class="btn ${sicherungPw ? '' : 'haupt'}" data-act="pw">${sicherungPw ? 'Passwort ändern …' : 'Passwort festlegen …'}</button></div>
    <div class="karte"><h3 style="margin-top:0">Automatische Sicherung in Google Drive</h3>
      <p class="klein">Sobald das Tablet Internet hat und die App offen ist, wird bei Änderungen automatisch gesichert (höchstens 1× pro Stunde) – in den Drive-Ordner „Bergwiesenhof“.</p>
      <label class="f">Sicherungs-Adresse (aus der Mail an dich selbst einfügen)<input class="feld" id="sadr" value="${esc(S.settings.sicherungUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec?k=…" autocomplete="off"></label>
      <p class="klein">Status: ${autoTxt}</p>
      <div class="knopfleiste"><button class="btn" data-act="sadrSpeichern">Adresse speichern & testen</button>${adr ? '<button class="btn haupt" data-act="sJetzt">Jetzt sichern</button>' : ''}</div></div>
    <div class="karte"><h3 style="margin-top:0">Datensicherung von Hand</h3>
      <p>Letzte Sicherung von Hand: <b>${tage}</b><br><span class="klein">Zusätzlich oder falls die automatische Sicherung nicht eingerichtet ist: Datei per Gmail an dich selbst oder in Drive ablegen.</span></p>
      <div class="knopfleiste"><button class="btn haupt" data-act="teilen">Sicherung teilen (Drive, Mail …)</button><button class="btn" data-act="datei">Sicherung als Datei speichern</button></div></div>
    <div class="karte"><h3 style="margin-top:0">Sicherung einspielen</h3><p class="klein">Ersetzt alle Daten auf diesem Tablet durch die Sicherungsdatei (z. B. nach einem Gerätewechsel).</p>
      <input type="file" accept=".json,application/json" id="datei" style="display:none"><button class="btn" data-act="laden">Sicherungsdatei wählen …</button>
      <p class="klein">Verschlüsselte Sicherungen fragen nach dem Passwort, mit dem sie erstellt wurden.</p></div>
    <div class="karte"><h3 style="margin-top:0">Excel-Export</h3><p class="klein">Alle Bestellungen, Kunden, Tiere, Sonderwünsche, Portionen, Kisten und Hofladen als Excel-Datei – für Auswertungen am PC.</p>
      <div class="knopfleiste"><button class="btn" data-act="excel">Excel-Datei teilen</button><button class="btn" data-act="exceldatei">Excel-Datei speichern</button></div></div>
  </div><div>
    <div class="karte"><h3 style="margin-top:0">Automatische Tageskopien</h3><p class="klein">Die App legt einmal am Tag eine Kopie auf dem Tablet an (die letzten 14 Tage). Damit kann ein Versehen rückgängig gemacht werden – ersetzt aber keine Sicherung außerhalb des Tablets.</p>
      ${snaps.map(t => `<div class="zeile" style="margin-bottom:6px"><span class="platz">Stand vom ${fmtDate(t)}</span><button class="btn klein" data-act="snap" data-t="${t}">wiederherstellen</button></div>`).join('') || '<div class="klein">noch keine</div>'}</div>
    <div class="karte"><h3 style="margin-top:0">Speicher</h3><p class="klein">Dauerhafter Speicher: <b>${ui.dauerhaft ? 'ja ✓' : 'nicht bestätigt'}</b> · ${S.bestellungen.length} Bestellungen, ${S.kunden.length} Kunden, ${S.tiere.length} Tiere · App-Version ${APP_VERSION}</p>
      ${ui.dauerhaft ? '' : '<button class="btn klein" data-act="persist">Dauerhaften Speicher anfordern</button>'}</div>
    <div class="karte"><h3 style="margin-top:0">Datenschutz: inaktive Kunden</h3>
      <p class="klein">Kunden, die länger als die Frist nicht bestellt haben, werden aus der Kundenliste gelöscht. Ihre Bestellungen bleiben für Statistik und Ausbeute erhalten – aber ohne Name, Telefon, Mail und Notiz („anonymisiert“). Kunden mit laufender Bestellung sind ausgenommen.</p>
      <div class="zeile" style="gap:10px;margin-bottom:8px"><label class="f" style="max-width:220px">Frist in Jahren (ohne Bestellung)<input class="feld zahl" inputmode="numeric" id="kfrist" value="${kundenFrist(S)}"></label><button class="btn klein" data-act="kfrist">Frist speichern</button></div>
      <p>${inaktiv.length ? `<b class="warn">${inaktiv.length} Kunde${inaktiv.length > 1 ? 'n' : ''}</b> seit über ${kundenFrist(S)} Jahren ohne Bestellung.` : `Keine Kunden über der Frist von ${kundenFrist(S)} Jahren.`}</p>
      ${inaktiv.length ? '<button class="btn braun" data-act="anonym">Liste ansehen & anonymisieren …</button>' : ''}
      <p class="klein">Kopien in den Tageskopien verschwinden nach 14 Tagen, in Google Drive nach 90 Tagen von selbst.</p></div>
    <div class="karte"><h3 style="margin-top:0">Alles zurücksetzen</h3><p class="klein">Löscht Bewegungsdaten (optional auch Kunden). Preisliste und Einstellungen bleiben.</p><button class="btn rot" data-act="reset">Zurücksetzen …</button></div>
  </div></div>`;
  ui.acts.sadrSpeichern = async () => {
    const roh = $('#sadr').value.trim();
    if (roh && !sicherungsAdresse(roh)) return meldung('Die Adresse muss mit https:// beginnen und am Ende ?k=… (den Schlüssel) enthalten.', true);
    S.settings.sicherungUrl = roh; speichern();
    if (!roh) { meldung('Automatische Sicherung ausgeschaltet.'); return render(); }
    meldung('Teste Verbindung …');
    const t = await autoSicherung(true, true);
    if (!t.ok) { meldung('Test fehlgeschlagen: ' + t.fehler, true); return render(); }
    const r = await autoSicherung(true);
    meldung(r.ok ? 'Verbindung klappt – erste Sicherung in Google Drive: ' + r.datei : 'Fehler: ' + r.fehler, !r.ok); render();
  };
  ui.acts.sJetzt = async () => { meldung('Sichere …'); const r = await autoSicherung(true); meldung(r.ok ? 'Gesichert in Google Drive: ' + r.datei : 'Fehler: ' + r.fehler, !r.ok); render(); };
  ui.acts.teilen = () => sicherungErstellen(true);
  ui.acts.datei = () => sicherungErstellen(false);
  ui.acts.pw = async () => {
    const { k, werte } = await dialogFelder(sicherungPw ? 'Sicherungs-Passwort ändern' : 'Sicherungs-Passwort festlegen',
      `<p class="klein">Mindestens 10 Zeichen. Am besten ein Satz oder mehrere Wörter, z. B. „Bulle-Rind-Hack-2026“. ${sicherungPw ? 'Ältere Sicherungen lassen sich danach nur mit dem <b>alten</b> Passwort einspielen.' : ''}</p>
      <label class="f">Passwort<input class="feld" type="password" id="pw1" autocomplete="new-password"></label>
      <label class="f">Passwort wiederholen<input class="feld" type="password" id="pw2" autocomplete="new-password"></label>
      <label class="zeile" style="gap:10px;margin-top:8px"><input type="checkbox" id="pwok" style="width:24px;height:24px"> Ich habe das Passwort aufgeschrieben.</label>`,
      [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Speichern', cls: 'haupt' }]);
    if (k !== 'ok') return;
    const pw = String(werte.pw1 || '');
    if (pw.length < 10) return meldung('Das Passwort muss mindestens 10 Zeichen haben.', true);
    if (pw !== werte.pw2) return meldung('Die beiden Passwörter sind nicht gleich.', true);
    if (!werte.pwok) return meldung('Bitte das Passwort erst aufschreiben und das Häkchen setzen.', true);
    await pwSetzen(pw);
    autoMeta.fehler = null; autoMeta.stand = null; await autoMetaSpeichern();
    meldung('Sicherungs-Passwort gespeichert.' + (adr ? ' Sichere in Google Drive …' : ''));
    if (adr) { const r = await autoSicherung(true); meldung(r.ok ? 'Verschlüsselte Sicherung in Google Drive: ' + r.datei : 'Google Drive: ' + r.fehler, !r.ok); }
    render();
  };
  ui.acts.kfrist = () => {
    const j = Math.round(num($('#kfrist').value));
    if (!(j >= 1 && j <= 10)) return meldung('Bitte eine Frist von 1 bis 10 Jahren eintragen.', true);
    S.settings.kundenFristJahre = j; speichern(); meldung(`Frist: ${j} Jahre.`); render();
  };
  ui.acts.anonym = async () => {
    const liste = inaktiveKunden(S);
    if (!liste.length) return render();
    const k = await dialog('Inaktive Kunden anonymisieren', `<p>Diese ${liste.length} Kunden haben seit über ${kundenFrist(S)} Jahren nicht bestellt:</p>
      <div style="max-height:40vh;overflow:auto"><table class="tab"><thead><tr><th class="r">Kd-Nr.</th><th>Name</th><th>letzte Bestellung</th></tr></thead><tbody>${liste.map(x => `<tr><td class="r">${x.k.nr}</td><td>${esc(x.k.name)}</td><td>${fmtDate(x.letzte)}</td></tr>`).join('')}</tbody></table></div>
      <p><b>Name, Telefon, Mail und Notiz werden gelöscht.</b> Das kann nicht rückgängig gemacht werden.</p>`, [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Anonymisieren', cls: 'rot' }]);
    if (k !== 'ok') return;
    let b = 0; liste.forEach(x => { b += kundeAnonymisieren(S, x.k); });
    speichern(); meldung(`${liste.length} Kunden anonymisiert (${b} Bestellungen ohne Namen behalten).`); render();
  };
  ui.acts.excel = async () => { const r = await teilenDatei(excelExport(S), `Bergwiesenhof_Export_${stempel()}.xlsx`, 'Excel-Export', ''); if (r === 'gespeichert') meldung('Excel-Datei im Ordner „Download“ gespeichert.'); };
  ui.acts.exceldatei = () => { download(excelExport(S), `Bergwiesenhof_Export_${stempel()}.xlsx`); meldung('Excel-Datei im Ordner „Download“ gespeichert.'); };
  ui.acts.laden = () => $('#datei').click();
  $('#datei').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      let roh = JSON.parse(await f.text());
      if (istVerschluesselt(roh)) {
        let txt = null;
        if (sicherungPw) { try { txt = await entschluesseln(roh, sicherungPw); } catch (e) { } }
        if (txt === null) {
          const { k, werte } = await dialogFelder('Passwort der Sicherung', `<p>Die Datei „${esc(f.name)}“ ist verschlüsselt${roh.erstellt ? ' (erstellt ' + new Date(roh.erstellt).toLocaleString('de-DE') + ')' : ''}. Bitte das Passwort eingeben, mit dem sie erstellt wurde.</p><label class="f">Passwort<input class="feld" type="password" id="pwx" autocomplete="off"></label>`, [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Entschlüsseln', cls: 'haupt' }]);
          if (k !== 'ok') { e.target.value = ''; return; }
          txt = await entschluesseln(roh, String(werte.pwx || ''));
        }
        roh = JSON.parse(txt);
      }
      const x = standPruefen(roh);
      if (!(await frage('Sicherung einspielen', `Datei „${esc(f.name)}“: ${x.bestellungen.length} Bestellungen, ${x.kunden.length} Kunden, ${x.tiere.length} Tiere${x.gespeichert ? ', Stand ' + new Date(x.gespeichert).toLocaleString('de-DE') : ''}.<br><br><b>Alle aktuellen Daten auf diesem Tablet werden ersetzt.</b>`, 'Einspielen', 'Abbrechen', 'rot'))) return;
      await idbSet('vor_import_' + stempel(), JSON.stringify(S));
      S = x; speichern(); meldung('Sicherung eingespielt.'); render();
    } catch (err) { meldung('Datei konnte nicht gelesen werden: ' + err.message, true); }
    e.target.value = '';
  };
  ui.acts.snap = async el => {
    if (!(await frage('Tageskopie wiederherstellen', `Den Stand vom ${fmtDate(el.dataset.t)} wiederherstellen? Alles, was danach eingegeben wurde, geht verloren.`, 'Wiederherstellen', 'Abbrechen', 'rot'))) return;
    const x = await schnappschussLaden(el.dataset.t); if (!x) return meldung('Kopie nicht gefunden.', true);
    await idbSet('vor_wiederherstellen_' + stempel(), JSON.stringify(S));
    S = standPruefen(x); speichern(); meldung('Stand wiederhergestellt.'); render();
  };
  ui.acts.persist = async () => { ui.dauerhaft = await dauerhaftAnfordern(); meldung(ui.dauerhaft ? 'Dauerhafter Speicher aktiv.' : 'Noch nicht bestätigt – App zuerst auf dem Startbildschirm installieren.'); render(); };
  ui.acts.reset = async () => {
    let mitK = false, txt = '';
    const d = $('#dialog');
    const merk = () => { const a = $('#mitkunden'), b = $('#bestaet'); if (a) mitK = a.checked; if (b) txt = b.value; };
    d.addEventListener('click', merk, true);
    const k = await dialog('Alles zurücksetzen', `<p>Gelöscht werden: Bestellungen, Tiere, Kisten, Packpläne, Hofladen-Liste. Preisliste und Einstellungen bleiben.</p><label class="zeile" style="gap:10px"><input type="checkbox" id="mitkunden" style="width:24px;height:24px"> auch alle Kunden löschen</label><p>Zur Bestätigung bitte <b>LÖSCHEN</b> eintippen:</p><input class="feld" id="bestaet" autocomplete="off">`, [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Zurücksetzen', cls: 'rot' }]);
    d.removeEventListener('click', merk, true);
    if (k !== 'ok') return;
    if (txt.trim().toUpperCase() !== 'LÖSCHEN') return meldung('Nicht bestätigt – nichts gelöscht.', true);
    await idbSet('vor_reset_' + stempel(), JSON.stringify(S));
    bewegungsdatenLeeren(S, mitK); speichern(); meldung('Zurückgesetzt.'); gehe('#/start');
  };
}
function tabPreise(z) {
  const st = S.settings;
  z.innerHTML = `<div class="hinweis klein">Die Preise gelten auch für die Vordrucke (Bestellformular A4/A5, Infozettel): <a href="#/vordrucke">Vordrucke ansehen und drucken</a></div><div class="karte"><label class="f">Überschrift der Preisliste<input class="feld" data-ch="st" data-f="preislisteTitel" value="${esc(st.preislisteTitel || '')}"></label></div>
   <div class="karte"><h3 style="margin-top:0">Genusspaket <span class="klein">– Inhalt unter Einstellungen → Genusspaket, zurzeit ca. ${fmtNum(paketGewicht(S), 1)} kg</span></h3><div class="zeile">
    ${[['preisPaketKg', 'Preis je kg (€)'], ['preisVakPaket', 'Vakuumieren je Paket (€)']].map(([f, t]) => `<label class="f" style="width:180px">${t}<input class="feld zahl" inputmode="decimal" data-ch="st" data-f="${f}" value="${fmtIn(st[f], 2)}"></label>`).join('')}</div></div>
   <div class="tabwrap"><table class="tab"><thead><tr><th>Artikel</th><th>bestellt in</th><th class="r">Preis (€/kg)</th><th class="r">im Genusspaket</th><th class="c">„am Stück“ möglich</th></tr></thead><tbody>
   ${S.artikel.map((a, i) => `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td><td>${esc(a.einheit)}</td>
     <td style="width:110px"><input class="feld zahl" inputmode="decimal" data-ch="art" data-f="preis" value="${fmtIn(a.preis, 2)}"></td>
     <td class="r klein">${paketListe(S).filter(p => p.art === a.name).map(p => `${fmtNum(p.anzahl)} × ${fmtNum(paketG(S, p))} g`).join(' + ')}</td>
     <td class="c"><label class="check"><input type="checkbox" data-ch="art" data-f="amStueck"${a.amStueck ? ' checked' : ''}></label></td>
</tr>`).join('')}
   </tbody></table></div><p class="klein">Alle Preise in €/kg – auch bei Innereien, die nach Stück bestellt werden (Schätzpreis = Anzahl × Stückgewicht × €/kg). „im Genusspaket“ wird unter Einstellungen → Genusspaket festgelegt. Stück- und Beutelgewichte: unter „Ausbeute & Kisten“. Preisänderungen gelten sofort auch für die Schätzpreise bestehender Bestellungen.</p>`;
  ui.acts.st = el => { S.settings[el.dataset.f] = el.type === 'text' && !el.classList.contains('zahl') ? el.value : num(el.value); speichern(); meldung('Gespeichert.'); };
  ui.acts.art = el => { const a = S.artikel[+el.closest('tr').dataset.i]; a[el.dataset.f] = el.type === 'checkbox' ? el.checked : num(el.value); speichern(); meldung('Gespeichert.'); };
}
function tabAusbeute(z) {
  const st = S.settings;
  const eigen = st.rindWieBulle === false;
  const sB = S.artikel.reduce((s, a) => s + num(a.anteil), 0), sR = S.artikel.reduce((s, a) => s + anteilRef(S, a, 'Rind'), 0);
  const messTxt = (typ, kind, name, f = 100, dec = 2, eh = ' %') => { const g = gemessenRoh(S, typ, kind, name); return g ? `<div class="klein ${g.n >= STAT_MIN_TIERE ? 'ok fett' : ''}" title="${esc(g.tiere.join(', '))}">gemessen ${fmtNum(g.wert * f, dec)}${eh} (${g.n} ${g.n === 1 ? 'Tier' : 'Tiere'}${g.n >= STAT_MIN_TIERE ? ' – gilt' : ', ab ' + STAT_MIN_TIERE})</div>` : ''; };
  const feld = (f, t, dec = 0) => `<label class="f" style="width:250px">${t}<input class="feld zahl" inputmode="decimal" data-ch="st" data-f="${f}" value="${fmtIn(st[f], dec || 2)}"></label>`;
  z.innerHTML = `<div class="karte"><h3 style="margin-top:0">Ausbeute je Tier (Anteil am Schlachtgewicht)</h3>
   <label class="zeile" style="gap:10px;margin-bottom:10px"><input type="checkbox" data-ch="rindwie" style="width:24px;height:24px"${eigen ? '' : ' checked'}> <b>Rind: Werte vom Bullen übernehmen</b> <span class="klein">(Haken weg = eigene Prozente für Rinder eingeben)</span></label>
   <div class="tabwrap"><table class="tab"><thead><tr><th>Bestellartikel</th><th class="r">Anteil Bulle (%)</th><th class="r">Anteil Rind (%)</th><th class="r">Referenz</th><th class="r">Bulle ${fmtNum(st.sgBulle)} kg</th><th class="r">Rind ${fmtNum(st.sgRind)} kg</th><th>Teilstücke für die Kistenfüllung</th></tr></thead><tbody>
   ${S.artikel.map((a, i) => num(a.anteil) > 0 || num(a.anteilRind) > 0 || !istOrgan(a.name) && a.name !== OCHS && !a.beutelG ? `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td>
     <td style="width:120px"><input class="feld zahl${ausserhalb(num(a.anteil), a.refMin, a.refMax) ? ' fehlt' : ''}" inputmode="decimal" data-ch="anteil" data-f="anteil" value="${fmtIn(num(a.anteil) * 100, 2)}">${messTxt('Bulle', 'art', a.name)}</td>
     <td style="width:120px"><input class="feld zahl${eigen ? '' : ' auto'}${ausserhalb(anteilRef(S, a, 'Rind'), a.refMin, a.refMax) ? ' fehlt' : ''}" inputmode="decimal" data-ch="anteil" data-f="anteilRind" value="${fmtIn(anteilRef(S, a, 'Rind') * 100, 2)}"${eigen ? '' : ' readonly'}>${messTxt('Rind', 'art', a.name)}</td>
     <td class="r klein" style="white-space:nowrap">${refText(a.refMin, a.refMax)}</td>
     <td class="r">${fmtNum(anteilVon(S, a, 'Bulle') * st.sgBulle, 1)} kg</td><td class="r">${fmtNum(anteilVon(S, a, 'Rind') * st.sgRind, 1)} kg</td><td><input class="feld" data-ch="teile" value="${esc(a.teile || '')}"></td></tr>` : '').join('')}
   <tr><td class="fett">Summe</td><td class="r fett">${fmtNum(sB * 100, 1)} %</td><td class="r fett">${fmtNum(sR * 100, 1)} %</td><td colspan="4"></td></tr></tbody></table></div>
   <p class="klein">Rot = außerhalb der Referenzspanne (Tippfehler?). Gilt für alle Tiere dieses Typs ohne eingetragenes Schlachtgewicht wie mit. <b>Gemessen</b> = Durchschnitt der gewogenen Ausbeute aus dem Tier-Archiv (getrennt Rind/Bulle); ab ${STAT_MIN_TIERE} Tieren wird der gemessene Wert statt des eingetragenen verwendet (grün „gilt“; die kg-Spalten zeigen den verwendeten Wert). Tiere lassen sich beim Tier aus der Statistik ausblenden. Änderungen wirken sofort auf Mengenprüfung, Paketgewicht und Packplan.</p></div>
   <div class="karte"><h3 style="margin-top:0">Ganze Stücke für die Kisten <span class="klein">– Kistenfüllung, Stückgewichte, Bug-Anteil</span></h3>
    <p class="klein">Diese Stücke kommen ungeschnitten vom Metzger und werden Stück für Stück auf die Kisten verteilt (z. B. „Braten (2× Unterschale, 2× Hochrippe)“ oder „Filet (2 ganze Stücke)“). Werte für Rind ${fmtNum(st.sgRind)} kg und Bulle ${fmtNum(st.sgBulle)} kg; für jedes Tier wird auf dessen Ausbeute hochgerechnet. Nur angehakte Stücke (Bug) dürfen bei Bedarf ins Hack – das falsche Filet bleibt immer Braten.</p>
    <div class="tabwrap" style="max-width:980px"><table class="tab"><thead><tr><th>Artikel</th><th>Teilstück</th><th class="r">Stück</th><th class="r">kg je Stück<br>Rind</th><th class="r">kg je Stück<br>Bulle</th><th class="r">Referenz</th><th class="r">= kg Rind</th><th class="r">= kg Bulle</th><th class="c">darf bei Bedarf<br>ins Hack</th><th></th></tr></thead><tbody>
    ${(st.bratenTeile || []).map((x, i) => `<tr data-i="${i}"><td class="fett">${i === 0 ? 'Braten' : ''}</td><td><input class="feld" data-ch="bt" data-f="name" value="${esc(x.name)}"></td>
      <td style="width:76px"><input class="feld zahl" inputmode="numeric" data-ch="bt" data-f="stueck" value="${fmtIn(x.stueck)}"></td>
      <td style="width:110px"><input class="feld zahl${ausserhalb(num(x.kg), x.kgMin, x.kgMax) ? ' fehlt' : ''}" inputmode="decimal" data-ch="bt" data-f="kg" value="${fmtIn(x.kg, 3)}">${messTxt('Rind', 'teil', x.name, 1, 2, ' kg')}</td>
      <td style="width:110px"><input class="feld zahl${num(x.kgBulle) > 0 && ausserhalb(num(x.kgBulle), x.kgMin, x.kgMax) ? ' fehlt' : ''}" inputmode="decimal" data-ch="bt" data-f="kgBulle" value="${num(x.kgBulle) > 0 ? fmtIn(x.kgBulle, 3) : ''}" placeholder="wie Rind">${messTxt('Bulle', 'teil', x.name, 1, 2, ' kg')}</td>
      <td class="r klein" style="white-space:nowrap">${refText(x.kgMin, x.kgMax, 1, 2, 'kg')}${has(x.refMin) ? '<br>' + refText(x.refMin, x.refMax, 100, 1) : ''}</td>
      <td class="r">${fmtNum(num(x.stueck) * teilKg(x, 'Rind', S), 2)}</td><td class="r">${fmtNum(num(x.stueck) * teilKg(x, 'Bulle', S), 2)}</td>
      <td class="c"><label class="check"><input type="checkbox" data-ch="bt" data-f="bug"${x.bug ? ' checked' : ''}></label></td>
      <td style="width:50px"><button class="btn klein rot" data-act="btweg" data-i="${i}">✕</button></td></tr>`).join('')}
    <tr><td></td><td class="klein">Summe Braten · ins Hack möglich: Rind ${fmtNum(bugAnteilVon(S, 'Rind') * 100, 0)} %, Bulle ${fmtNum(bugAnteilVon(S, 'Bulle') * 100, 0)} %</td><td></td><td></td><td></td><td></td><td class="r fett">${fmtNum(bratenTeileKg(S, 'Rind'), 2)} kg</td><td class="r fett">${fmtNum(bratenTeileKg(S, 'Bulle'), 2)} kg</td><td></td><td><button class="btn klein" data-act="btneu" title="Bratenstück hinzufügen">+</button></td></tr>
    ${S.artikel.map((a, i) => ({ a, i })).filter(({ a }) => num(a.ganzeStuecke) > 0 || ['Filet', 'Tafelspitz'].includes(a.name)).map(({ a, i }) => { const n = num(a.ganzeStuecke);
      const yR = yieldArt(S, { typ: 'Rind', sg: null }, a.name), yB = yieldArt(S, { typ: 'Bulle', sg: null }, a.name);
      const kR = n > 0 ? yR / n : 0, kB = n > 0 ? yB / n : 0;
      return `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td><td class="klein">ganzes Stück${n > 0 ? '' : ' – aus (wird nach kg verteilt)'}</td>
      <td style="width:76px"><input class="feld zahl" inputmode="numeric" data-ch="ganz" value="${n || 0}"></td>
      <td class="r${n > 0 && ausserhalb(kR, a.stkMin, a.stkMax) ? ' warn' : ''}">${n > 0 ? fmtNum(kR, 2) : '–'}</td><td class="r${n > 0 && ausserhalb(kB, a.stkMin, a.stkMax) ? ' warn' : ''}">${n > 0 ? fmtNum(kB, 2) : '–'}</td>
      <td class="r klein">${refText(a.stkMin, a.stkMax, 1, 2, 'kg')}</td>
      <td class="r">${n > 0 ? fmtNum(yR, 2) : ''}</td><td class="r">${n > 0 ? fmtNum(yB, 2) : ''}</td><td class="c klein">nein</td><td></td></tr>`; }).join('')}
    </tbody></table></div>
    <p class="klein" style="margin-bottom:0">Braten: kg je Stück frei eintragbar. Filet und Tafelspitz: nur die Anzahl – das Gewicht je Stück ergibt sich aus der Ausbeute (0 = nicht als ganzes Stück). Rostbraten und Hüftsteak werden geschnitten, am Stück nur als Sonderwunsch. Immer genau eine eigene Kiste (sortenrein, bis ${fmtNum(num(st.kisteAusnahme) || 25)} kg): ${EINE_KISTE.filter(x => x !== 'Soßenknochen (FK)').join(', ')}. Soßenknochen (FK) immer in 2 Kisten (Platz), ganze Beutel.</p></div>
   <div class="karte"><h3 style="margin-top:0">Einzelgewichte <span class="klein">– Schätzwerte, bitte nachwiegen</span></h3>
    <div class="zeile oben" style="margin-bottom:8px">${feld('maxWaden', 'Waden am Stück höchstens je Tier')}<p class="klein" style="max-width:420px;margin:22px 0 0">Gewicht einer Wade = Beinscheiben-Ausbeute ÷ Anzahl Waden: Rind ${fmtNum(wadeKg(S, null), 1)} kg, Bulle ${fmtNum(yieldArt(S, { typ: 'Bulle', sg: null }, 'Beinscheiben') / (num(st.maxWaden) || 4), 1)} kg.</p></div>
    <p class="klein">Damit wird überall gerechnet: Bestellungen nach Stück (z. B. „Steak 3“ = 3 × Stückgewicht), Genusspaket, Beutelgrößen der Knochen. Leer = Artikel wird nur nach kg bestellt.</p>
    <div class="tabwrap" style="max-width:640px"><table class="tab"><tbody>${S.artikel.map((a, i) => ({ a, i })).filter(({ a }) => !istOrgan(a.name) || a.einheit === 'Stk').map(({ a, i }) => { const btl = num(a.beutelG) > 0; return `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td>
      <td style="width:130px"><input class="feld zahl${!btl && !(num(a.ganzeStuecke) > 0) && num(a.stueckG) > 0 && ausserhalb(num(a.stueckG) / 1000, a.stkMin, a.stkMax) ? ' fehlt' : ''}" title="${!(num(a.ganzeStuecke) > 0) ? refText(a.stkMin, a.stkMax, 1000, 0, 'g') : ''}" inputmode="numeric" data-ch="eg" data-f="${btl ? 'beutelG' : 'stueckG'}" value="${btl ? fmtIn(a.beutelG) : num(a.stueckG) > 0 ? fmtIn(a.stueckG) : ''}" placeholder="–"></td>
      <td class="klein" style="width:110px">g je ${btl ? 'Beutel' : 'Stück'}${a.einheit === 'Stk' ? ' (für Schätzpreis)' : ''}</td><td class="klein r" style="width:110px">${!(num(a.ganzeStuecke) > 0) ? refText(a.stkMin, a.stkMax, 1000, 0, 'g') : ''}</td></tr>`; }).join('')}</tbody></table></div></div>
   <div class="karte"><h3 style="margin-top:0">Einstellungen</h3><div class="zeile oben">
    ${feld('sgBulle', 'Standard-Schlachtgewicht Bulle (kg)')}${feld('sgRind', 'Standard-Schlachtgewicht Rind/Färse (kg)')}
    ${feld('hackKiste', 'Hackfleisch je Metzgerkiste (kg)')}${feld('kisteMax', 'Kiste max. (kg) – Packplan')}${feld('kisteAusnahme', 'Kiste in Ausnahmen bis (kg)')}
    ${feld('tueteJeKg', 'Vakuumieren ohne Portionsangabe: 1 Tüte je … kg')}
</div></div>
   <div class="karte"><h3 style="margin-top:0">Lagerplatz nach dem Packen</h3><p class="klein">Kühlschrank, wenn weniger Artikel als … <b>und</b> leichter als … kg – sonst Metzgerkiste im Kühlraum. Ein Genusspaket zählt als ein Artikel.</p><div class="zeile oben">
    ${feld('lagerMaxArtikel', 'Kühlschrank bei weniger als … Artikeln')}${feld('lagerMaxKg', 'und leichter als … kg')}</div></div>
   <div class="karte"><h3 style="margin-top:0">Innereien je Tier (werden vorab separat geholt)</h3><div class="zeile oben">
    ${feld('leberKg', 'Leber ca. (kg)')}${feld('nierenStk', 'Nieren ca. (Stk)')}${feld('herzStk', 'Herz ca. (Stk)')}${feld('zungeStk', 'Zunge ca. (Stk)')}${feld('baeckleStk', 'Bäckle ca. (Stk)')}${feld('leberPortionG', 'Leber-Rest vakuumiert à (g)')}</div></div>
   <div class="karte"><h3 style="margin-top:0">Ochsenschwanz</h3><div class="zeile oben">${feld('ochsStk', 'Ochsenschwanz je Tier (Stk)')}<p class="klein" style="max-width:420px;margin:22px 0 0">Kein Innereien-Artikel: kommt immer zu den Beinscheiben/Waden in die Kiste und wird gewogen. Mit Häkchen „am Stück“ bestellt → bleibt ganz (Zeile im Metzgerauftrag), sonst schneidet der Metzger ihn wie gewohnt. Verkauf immer als ganzer Schwanz an eine Bestellung, Preis nach kg; nicht bestellte gehen beim Abschluss an den Hofladen.</p></div></div>`;
  ui.acts.st = el => { S.settings[el.dataset.f] = num(el.value); speichern(); render(); };
  ui.acts.eg = el => {
    const a = S.artikel[+el.closest('tr').dataset.i], f = el.dataset.f, v = num(el.value);
    if (f === 'beutelG' && !(v > 0)) { meldung('Beutelgröße muss größer 0 sein.', true); return render(); }
    a[f] = v > 0 ? v : 0; speichern(); meldung('Gespeichert.'); render();
  };
  ui.acts.ganz = el => { S.artikel[+el.closest('tr').dataset.i].ganzeStuecke = Math.max(0, Math.round(num(el.value))); speichern(); render(); };
  ui.acts.bt = el => { const x = S.settings.bratenTeile[+el.closest('tr').dataset.i], f = el.dataset.f; x[f] = f === 'name' ? el.value : f === 'bug' ? el.checked : f === 'kgBulle' && el.value.trim() === '' ? null : num(el.value); speichern(); render(); };
  ui.acts.btweg = el => { S.settings.bratenTeile.splice(+el.dataset.i, 1); speichern(); render(); };
  ui.acts.btneu = () => { if (!Array.isArray(S.settings.bratenTeile)) S.settings.bratenTeile = []; S.settings.bratenTeile.push({ name: 'neues Teilstück', stueck: 2, kg: 1, bug: false }); speichern(); render(); };
  ui.acts.anteil = el => { if (el.readOnly) return; S.artikel[+el.closest('tr').dataset.i][el.dataset.f] = num(el.value) / 100; speichern(); render(); };
  ui.acts.rindwie = el => {
    S.settings.rindWieBulle = el.checked;
    if (!el.checked) S.artikel.forEach(a => { if (a.anteilRind === undefined || a.anteilRind === null) a.anteilRind = num(a.anteil); });
    speichern(); render();
  };
  ui.acts.teile = el => { S.artikel[+el.closest('tr').dataset.i].teile = el.value; speichern(); meldung('Gespeichert.'); };
}
function tabPaket(z) {
  const st = S.settings;
  if (!Array.isArray(st.paket)) st.paket = [];
  const P = st.paket;
  const artOpt = sel => S.artikel.filter(a => !istOrgan(a.name)).map(a => opt(a.name, a.name, a.name === sel)).join('');
  const kg = p => num(p.anzahl) * paketG(S, p) / 1000;
  const sum = paketGewicht(S);
  const knochen = P.filter(p => p.art === 'Suppenknochen (SK)' || p.art === 'Soßenknochen (FK)').reduce((s, p) => s + kg(p), 0);
  const tierTxt = typ => { const t = { name: '', typ, sg: null }; return `${typ} ${fmtNum(sgRechnung(S, t))} kg: max. <b>${maxPakete(S, t)}</b> Pakete`; };
  z.innerHTML = `<div class="spalten2" style="grid-template-columns:minmax(560px,1.3fr) minmax(330px,1fr)"><div class="karte" style="padding:0"><div class="tabwrap" style="border:none"><table class="tab"><thead><tr><th>Inhalt je Genusspaket</th><th class="r">Anzahl</th><th class="r">g je Stück</th><th class="r">= kg</th><th></th></tr></thead><tbody>
    ${P.map((p, i) => `<tr data-i="${i}"><td><select class="feld" data-ch="pk" data-f="art">${artOpt(p.art)}</select></td>
      <td style="width:84px"><input class="feld zahl" inputmode="numeric" data-ch="pk" data-f="anzahl" value="${fmtIn(p.anzahl)}"></td>
      <td style="width:104px">${einzelGewicht(S, p.art) ? `<input class="feld zahl auto" readonly value="${fmtIn(paketG(S, p))}" title="Einzelgewicht – unter Ausbeute & Kisten ändern">` : `<input class="feld zahl" inputmode="numeric" data-ch="pk" data-f="g" value="${fmtIn(p.g)}">`}</td>
      <td class="r fett">${fmtNum(kg(p), 2)}</td><td style="width:50px"><button class="btn klein rot" data-act="pkweg" data-i="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="klein">Noch kein Inhalt.</td></tr>'}
    <tr><td class="fett">Gewicht je Paket</td><td></td><td></td><td class="r fett">${fmtNum(sum, 2)} kg</td><td></td></tr>
    <tr><td class="klein">davon Knochen</td><td></td><td></td><td class="r klein">${fmtNum(knochen, 2)} kg</td><td></td></tr>
    <tr><td class="klein">Fleisch ohne Knochen</td><td></td><td></td><td class="r klein">${fmtNum(sum - knochen, 2)} kg</td><td></td></tr></tbody></table></div>
    <div class="knopfleiste" style="padding:10px 12px"><button class="btn klein" data-act="pkneu">+ Inhalt</button><span class="klein" style="align-self:center">Grau = Einzelgewicht aus „Ausbeute & Kisten“</span></div></div>
    <div>
     <div class="karte"><h3 style="margin-top:0">Hackfleisch im Paket</h3><p class="klein">Offen: eine Tüte mit der ganzen Hack-Menge. Vakuumiert: in Portionen.</p>
      <label class="f" style="width:260px">vakuumiert portioniert à (g)<input class="feld zahl" inputmode="numeric" data-ch="st" data-f="hackPaketG" value="${fmtIn(st.hackPaketG)}"></label></div>
     <div class="karte"><h3 style="margin-top:0">Pakete je Tier</h3>
      <label class="f" style="width:260px">höchstens … Genusspakete je Tier<input class="feld zahl" inputmode="numeric" data-ch="st" data-f="nenner" value="${fmtIn(st.nenner)}"></label>
      <p class="klein" style="margin-bottom:0">Zusätzlich begrenzt durch die Ausbeute (Hack inkl. Gulasch):<br>${tierTxt('Rind')} · ${tierTxt('Bulle')}</p></div>
     <div class="karte klein">Preis: ${fmtEur(st.preisPaketKg)} je kg × ${fmtNum(sum, 2)} kg = ca. <b>${fmtEur(sum * num(st.preisPaketKg))}</b> je Paket (Preis unter „Preisliste“). Änderungen gelten sofort für Mengencheck, Metzgerauftrag, Ladeplan, Kommissionieren und Schätzpreise.</div></div></div>`;
  ui.acts.pk = el => { const p = P[+el.closest('tr').dataset.i]; const f = el.dataset.f; p[f] = f === 'art' ? el.value : num(el.value); speichern(); render(); };
  ui.acts.eg = el => { const v = num(el.value); if (!(v > 0)) { meldung('Bitte ein Gewicht größer 0 eintragen.', true); return render(); } S.artikel[+el.closest('tr').dataset.i][el.dataset.f] = v; speichern(); meldung('Gespeichert.'); render(); };
  ui.acts.pkweg = el => { P.splice(+el.dataset.i, 1); speichern(); render(); };
  ui.acts.pkneu = () => { P.push({ art: 'Braten', anzahl: 1, g: 1000 }); speichern(); render(); };
  ui.acts.st = el => { S.settings[el.dataset.f] = num(el.value); speichern(); render(); };
}
function tabAuto(z) {
  const hp = S.settings.hackPlatz || 'vorne rechts';
  z.innerHTML = `<div class="karte"><p class="klein">Reihenfolge = in welcher Folge man an die Stapel herankommt (1 = zuerst, von der Tür hinten aus). Stapelhöhe = max. Kisten übereinander. Jedes Feld bekommt mindestens eine Kiste.<br>
   Felder mit „erst stapeln, wenn Rest voll“ bekommen nur <b>eine</b> Kiste, bis alle anderen Felder voll sind. Hackfleisch steht immer auf dem Hack-Platz, Kiste 1 oben.</p>
   <label class="f" style="max-width:320px;margin-bottom:12px">Hackfleisch-Platz<select class="feld" data-ch="hackplatz">${S.auto.map(f => opt(f.name, f.name, sameText(f.name, hp))).join('')}</select></label>
   <div class="tabwrap"><table class="tab"><thead><tr><th>Stellplatz</th><th class="r">Stapelhöhe</th><th class="r">Reihenfolge (Entnahme)</th><th class="c">erst stapeln, wenn Rest voll</th><th>Zugang</th></tr></thead><tbody>
   ${S.auto.map((f, i) => `<tr data-i="${i}"><td class="fett">${esc(f.name)}${sameText(f.name, hp) ? ' <span class="marke gelb">Hack</span>' : ''}</td><td style="width:120px"><input class="feld zahl" inputmode="numeric" data-ch="auto" data-f="hoehe" value="${num(f.hoehe)}"></td><td style="width:150px"><input class="feld zahl" inputmode="numeric" data-ch="auto" data-f="reihenfolge" value="${num(f.reihenfolge)}"></td><td class="c"><label class="check"><input type="checkbox" data-ch="auto" data-f="spaeter"${f.spaeter ? ' checked' : ''}></label></td><td><input class="feld" data-ch="auto" data-f="zugang" value="${esc(f.zugang || '')}"></td></tr>`).join('')}
   <tr><td class="fett">Kisten gesamt (max. pro Tier)</td><td class="r fett">${S.auto.reduce((s, f) => s + num(f.hoehe), 0)}</td><td colspan="3"></td></tr></tbody></table></div>
   <p class="klein">Änderungen wirken beim nächsten „Packplan neu berechnen“.</p></div>`;
  ui.acts.auto = el => { const f = S.auto[+el.closest('tr').dataset.i]; const k = el.dataset.f; f[k] = k === 'zugang' ? el.value : k === 'spaeter' ? el.checked : num(el.value); speichern(); render(); };
  ui.acts.hackplatz = el => { S.settings.hackPlatz = el.value; speichern(); render(); };
}
function tabHof(z) {
  z.innerHTML = `<div class="karte"><label class="f">Fußzeile auf allen Unterlagen (Metzgerauftrag usw.)<input class="feld" data-ch="hz" value="${esc(S.settings.hofZeile || '')}"></label>
    <label class="f" style="margin-top:12px">Bestellwege (mit Komma getrennt)<input class="feld" data-ch="wege" value="${esc(S.wege.join(', '))}"></label></div>
   <div class="karte"><h3 style="margin-top:0">Kurzanleitung</h3><ol style="padding-left:20px;margin:0;line-height:1.6">
    <li><b>Tiere</b> anlegen (Typ, Schlacht- und Abholtermin). Passende Bestellungen von der Warteliste werden angeboten.</li>
    <li><b>Bestellung</b> erfassen: Name tippen (bekannte Kunden werden vorgeschlagen), Pakete und Einzelartikel. Tier leer lassen = automatisch nächstes passendes Tier.</li>
    <li><b>Schlachttag → Mengenprüfung</b>: reicht das Tier? Rot markierte Bestellungen aufs nächste Tier umstellen.</li>
    <li><b>Schlachttag → Metzgerauftrag</b>: „Als Bild teilen“ → WhatsApp → Metzger.</li>
    <li><b>Schlachttag → Kisten & Ladeplan</b>: „Plan erstellen“, Ladeplan an den Metzger teilen. Beim Metzger nach Plan packen, wiegen und die kg in derselben Liste eintragen (wird grün).</li>
    <li><b>Hack-Zettel</b> und <b>Innereien</b> an die Helfer geben (teilen oder drucken).</li>
    <li><b>Kommissionieren</b>: je Bestellung „aus Kiste 3 → 2,0 kg Braten“, antippen wenn erledigt, dann „Gepackt ✓ und weiter“.</li>
    <li><b>Packliste Kühlhaus</b>: Endbetrag eintragen, Status „abgeholt“ setzen.</li>
    <li>Am Ende: <b>Kisten & Ladeplan → Tier abgeschlossen</b> – Reste gehen an den Hofladen.</li>
    <li>Datensicherung: läuft automatisch in Google Drive, sobald Internet da ist (Einstellungen → Daten & Sicherung). Die Kopfzeile zeigt, wann zuletzt gesichert wurde.</li></ol></div>`;
  ui.acts.hz = el => { S.settings.hofZeile = el.value; speichern(); meldung('Gespeichert.'); };
  ui.acts.wege = el => { S.wege = el.value.split(',').map(x => x.trim()).filter(Boolean); speichern(); meldung('Gespeichert.'); };
}

// =====================================================================
//  Start
// =====================================================================
async function start() {
  try {
    const roh = await idbGet('stand');
    S = roh ? standPruefen(JSON.parse(roh)) : leererStand();
    if (!roh) await idbSet('stand', JSON.stringify(S));
    schnappschussAnlegen(S).catch(() => { });
  } catch (e) {
    document.body.innerHTML = `<div style="padding:30px"><h2>Daten konnten nicht geladen werden</h2><p>${esc(e.message)}</p></div>`; return;
  }
  await autoMetaLaden().catch(() => { });
  await pwLaden().catch(() => { });
  alteKopienAufraeumen().catch(() => { });
  ui.dauerhaft = await istDauerhaft();
  if (!ui.dauerhaft) ui.dauerhaft = await dauerhaftAnfordern();
  kopfStatus();
  render();
  autoSicherungStarten();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) neueVersionAnbieten(nw);
        });
      });
      // eine schon geladene, aber wartende Version sofort anbieten
      if (reg.waiting && navigator.serviceWorker.controller) neueVersionAnbieten(reg.waiting);
      if (navigator.onLine) reg.update().catch(() => { });
      // beim Zurückholen der App (ohne Neustart) erneut nach Updates schauen
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => { }); });
    }).catch(() => { });
  }
}
let updateAngeboten = false;
function neueVersionAnbieten(sw) {
  if (updateAngeboten) return; updateAngeboten = true;
  dialog('Neue Version', '<p>Eine neue Version der App ist geladen. Jetzt neu starten? (Die Daten bleiben erhalten.)</p>', [{ k: 'x', t: 'Später' }, { k: 'ok', t: 'Neu starten', cls: 'haupt' }])
    .then(k => {
      if (k !== 'ok') { updateAngeboten = false; return; }
      navigator.serviceWorker.addEventListener('controllerchange', () => location.reload());
      sw.postMessage('jetztAktualisieren');
      setTimeout(() => location.reload(), 3000);
    });
}
document.addEventListener('DOMContentLoaded', start);

// Lagerplatz beim Packen bestätigen und in der Bestellung speichern
async function lagerDialog(o) {
  const lv = lagerVorschlag(S, o);
  let ort = o.lagerOrt || lv.ort, platz = o.lagerPlatz || '';
  const d = $('#dialog');
  const klick = e => {
    const b = e.target.closest('[data-ort]');
    if (b) { e.stopPropagation(); ort = b.dataset.ort; $$('#dialog [data-ort]').forEach(x => x.classList.toggle('haupt', x.dataset.ort === ort)); }
    if (e.target.closest('[data-k="ok"]')) platz = ($('#lplatz') || {}).value || '';
  };
  d.addEventListener('click', klick, true);
  const k = await dialog(`Nr. ${o.nr} gepackt – wohin?`, `<p>${esc(o.name)} · ${esc(lv.grund)} → Vorschlag: <b>${lv.ort}</b></p>
    <div class="knopfleiste" style="margin-bottom:12px">${LAGER.map(x => `<button class="btn ${x === ort ? 'haupt' : ''}" data-ort="${x}" style="min-height:60px;font-size:18px">${x === 'Kühlschrank' ? '❄ Kühlschrank' : '▣ Kühlraum (Metzgerkiste)'}</button>`).join('')}</div>
    <label class="f">Fach / Kisten-Nr. (optional)<input class="feld" id="lplatz" value="${esc(platz)}" placeholder="z. B. Fach 2 oder Kiste 14" autocomplete="off"></label>`,
    [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Gepackt ✓', cls: 'haupt' }]);
  d.removeEventListener('click', klick, true);
  if (k !== 'ok') return false;
  if (o.status !== 'abgeholt') o.status = 'gepackt';
  o.lagerOrt = ort; o.lagerPlatz = platz.trim(); o.gepacktAm = o.gepacktAm || todayISO();
  speichern();
  return true;
}
