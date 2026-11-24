// Bestellsystem Bergwiesenhof – Oberfläche (Teil 2: Schlachttag, Kommissionieren, Hofladen, Einstellungen, Start)
'use strict';

const REITER = [['menge', 'Mengenprüfung'], ['metzger', 'Metzgerauftrag'], ['kisten', 'Kisten & Ladeplan'], ['hack', 'Hack-Zettel'], ['innereien', 'Innereien'], ['packliste', 'Packliste Kühlhaus']];
const abholTxt = t => t.abhol ? 'Abholung ' + fmtDate(t.abhol) : 'Abholtermin noch offen';
const fussZeile = () => S.settings.hofZeile || '';
const knopfTeilen = (extra = '') => `<div class="knopfleiste" style="margin:10px 0">${extra}<button class="btn haupt" data-act="teilen">Als Bild teilen (WhatsApp)</button><button class="btn" data-act="drucken">Drucken</button></div>`;

// ---------- Dokumente ----------
function docMenge(mp) {
  const t = mp.tier, i = mp.info;
  return { title: `Mengenprüfung – ${t.name}`, sub: [`${t.typ} · ${fmtNum(i.sg)} kg SG · ${abholTxt(t)}`, `Pakete bestellt ${fmtNum(i.pakete)} / frei ${fmtNum(i.frei)} · ${i.anzahl} Bestellungen · reicht nicht: ${i.reichtNicht}`],
    blocks: [{ type: 'table', head: ['Teilstück', 'Ausbeute ca.', 'einzeln', 'in Paketen', 'gesamt', 'noch frei', 'Auslastung', 'Status'], align: ['', 'r', 'r', 'r', 'r', 'r', 'r', ''], widths: [3, 2, 2, 2, 2, 2, 2, 2.4],
      rows: mp.rows.map(r => [r.art, fmtNum(r.ausbeute, 1), fmtNum(r.einzel, 1), fmtNum(r.ausPak, 1), fmtNum(r.gesamt, 1), fmtNum(r.frei, 1), r.auslastung === null ? '' : fmtNum(r.auslastung * 100, 0) + ' %', r.status]),
      rowClass: mp.rows.map(r => r.status === 'reicht nicht' ? 'rot' : '') },
      { type: 'text', text: 'Genusspakete haben Vorrang, danach Einzelartikel in der Reihenfolge, in der die Bestellungen dem Tier zugeordnet wurden. Ausbeute = Richtwerte, „knapp“ = über 90 % vergeben. Innereien werden nicht geprüft.' }], footer: fussZeile() };
}
function docMetzger(ma) {
  const t = ma.tier;
  const bl = [{ type: 'h', text: 'Gesamtmengen' },
    { type: 'kv', rows: [['Hackfleisch', `${fmtNum(ma.hack.vorgabe)} kg`, ma.hack.kistenText ? `(${ma.hack.kistenText})` : ''], ['Gulasch', ma.gulasch.vorgabe > 0 ? `${fmtNum(ma.gulasch.vorgabe)} kg` : '–', '']]
      .concat(ma.waden > 0 ? [['Waden am Stück', `${fmtNum(ma.waden)} Stück`, 'nicht zu Beinscheiben schneiden – Namen siehe unten']] : []) }];
  if (ma.hack.ueberAusbeute) bl.push({ type: 'text', bold: true, text: 'Mehr Hackfleisch als üblich: zuerst Schulterstücke (Bug) auflösen, Keulenstücke als Braten behalten.' });
  if (ma.gulasch.insHack > 0.05) bl.push({ type: 'text', text: `Kein Gulasch bestellt: ca. ${fmtNum(ma.gulasch.insHack, 0)} kg Kamm/Hals ins Hackfleisch.` });
  bl.push({ type: 'text', text: (ma.waden > 0 ? 'Übrige Hesse als Beinscheiben. ' : 'Hesse wie immer als Beinscheiben. ') + 'Alle übrigen Stücke bitte wie gewohnt zuschneiden.' },
    { type: 'h', text: 'Sonderfälle – separat vorbereiten, bitte mit Namen beschriften' },
    { type: 'table', head: ['Nr.', 'Name', 'Artikel', 'Menge', 'Hinweis'], widths: [1, 3.2, 3, 1.6, 3.6], align: ['r', '', '', 'r', ''], rows: ma.separat.map(s => [s.nr, s.name, s.art, s.menge, s.hinweis]), leer: '– keine –' });
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
      rows: calc.map(c => [c.k.nr, c.k.art, fmtNum(c.k.kg, 1), c.k.platz || '', fmtNum(c.bedarf, 1), fmtNum(c.verplant, 1), fmtNum(c.rest, 1), c.teile || '']) }], footer: fussZeile() };
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
      { type: 'table', head: ['Nr.', 'Name', 'Leber kg', 'Leber verpacken', 'Nieren', 'Herz', 'Zunge', 'Bäckle', 'Ochsenschw.', 'vakuumieren', '✓'], widths: [0.8, 2.6, 1, 1.7, 0.9, 0.8, 0.8, 0.8, 1.2, 1.7, 0.5], align: ['r', '', 'r', '', 'r', 'r', 'r', 'r', 'r', '', ''],
        rows: ii.rows.map(r => [r.nr, r.name, fmtNum(r.leber, 3), r.leberAls, r.nieren || '', r.herz || '', r.zunge || '', r.baeckle || '', r.ochs || '', r.vak, '☐']) },
      { type: 'text', text: '„vorhanden“ = Schätzwerte aus den Einstellungen (Innereien je Tier).' }], footer: fussZeile() };
}
function docPackliste(pl) {
  return { title: `Packliste Kühlhaus – ${pl.tier.name}`, sub: [abholTxt(pl.tier)],
    blocks: [{ type: 'table', head: ['Nr.', 'Name', 'Telefon', 'Bestellung', 'Sonderfälle (separat)', 'Lagerplatz', 'Schätzpreis', 'Endbetrag', 'gepackt', 'abgeholt'], widths: [0.7, 2.2, 1.6, 4.6, 2.2, 2, 1.3, 1.3, 0.9, 0.9], align: ['r', '', '', '', '', '', 'r', 'r', '', ''],
      rows: pl.rows.map(r => [r.nr, r.name, r.tel, r.text, r.sonder, r.lager || `(${r.lagerVorschlag})`, fmtEur(r.schaetz), r.endbetrag !== null ? fmtEur(r.endbetrag) : '', r.status !== 'offen' ? '☑' : '☐', r.status === 'abgeholt' ? '☑' : '☐']) }], footer: fussZeile() };
}
function docPick(ko) {
  const o = ko.o;
  return { title: `Kommissionierung Nr. ${o.nr} – ${o.name}`, sub: [`Tier: ${o.tier}`, `Genusspakete: ${fmtNum(o.pakete)}${num(o.pakVak) ? ` (davon ${fmtNum(o.pakVak)} vakuumieren)` : ''} · Vakuum-Tüten: ${ko.tueten || '–'}`],
    blocks: [{ type: 'kv', rows: [['Lagerplatz', lagerText(o) || lagerVorschlag(S, o).ort, lagerText(o) ? '' : '(' + lagerVorschlag(S, o).grund + ')'], ['Separat vom Metzger', ko.sonder.join('; ') || '–'], ['Innereien (separat)', ko.innereien.join(', ') || '–']] },
      { type: 'table', head: ['☐', 'Kiste', 'Menge', 'Inhalt', 'verpacken', 'Stellplatz'], widths: [0.5, 0.9, 1.2, 2.4, 4, 2.4], align: ['', 'r', 'r', '', '', ''],
        rows: ko.picks.map(p => ['☐', p.hackTisch ? 'Hack-Tisch' : p.kiste, `${fmtNum(p.menge, 1)} ${p.einheit}`, p.art, p.verpacken, p.platz]), leer: 'keine Kisten eingetragen' },
      ...ko.rows.filter(r => r.fehlt > 0).map(r => ({ type: 'text', warn: true, text: `Fehlt: ${fmtNum(r.fehlt, 2)} ${r.einheit} ${r.art}` }))], footer: fussZeile() };
}

// =====================================================================
//  Schlachttag (Unterlagen je Tier)
// =====================================================================
function viewSchlachttag(tab, q) {
  if (q.get('tier')) ui.tierWahl = q.get('tier');
  const tn = standardTier();
  titel('Schlachttag' + (tn ? ' – ' + tn : ''));
  if (!S.tiere.length) { inhalt().innerHTML = '<h1>Schlachttag</h1><div class="karte">Noch keine Tiere angelegt. <a href="#/tier/neu">Tier anlegen</a></div>'; return; }
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
const istGewogen = k => !!k.gewogen || (has(k.plan) && has(k.kg) && Math.abs(num(k.kg) - num(k.plan)) > 0.001);
// Draufsicht aus der aktuellen Kistenliste (Stellplatz-Text „hinten links, oben“ / „Mitte rechts, 2. v. u.“)
function felderAusKisten(tn) {
  const rows = kistenRows(S, tn);
  return S.auto.map(f => {
    const ks = {};
    rows.filter(k => sameText(String(k.platz || '').split(',')[0], f.name)).forEach(k => {
      const e = /oben/.test(k.platz) ? 99 : num((/(\d+)\./.exec(k.platz) || [])[1]);
      const x = ks[k.nr] = ks[k.nr] || { nr: k.nr, ebene: e, teile: [], gewogen: true };
      x.teile.push(`${k.art} ${fmtNum(k.kg, 1)}`); if (!istGewogen(k)) x.gewogen = false;
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
            <td class="r klein">${has(c.k.plan) ? fmtNum(c.k.plan, 1) : ''}</td>
            <td style="width:96px"><input class="feld zahl" inputmode="decimal" data-ch="kf" data-f="kg" value="${gw ? fmtNum(c.k.kg, 2) : ''}" placeholder="${has(c.k.plan) ? fmtNum(c.k.plan, 1) : ''}"></td>
            <td style="width:150px"><input class="feld klein" data-ch="kf" data-f="platz" value="${esc(c.k.platz || '')}"></td>
            <td class="r fett">${fmtNum(c.rest, 1)}</td>
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
    if (offen.length) return dialog('Tier noch nicht fertig', `<p>${esc(tn)} kann erst abgeschlossen werden, wenn alle Bestellungen gepackt sind.</p><p class="warn">Noch offen: ${offen.map(o => 'Nr. ' + o.nr + ' ' + esc(o.name)).join(', ')}</p>`);
    if (!(await frage('Tier abschließen', `Alle Bestellungen von <b>${esc(tn)}</b> sind gepackt.<br>${reste.length} Reste gehen an den Hofladen, danach werden die ${calc.length} Kistenzeilen geleert.`, 'Abschließen'))) return;
    const n = tierAbschliessen(S, tn); delete S.packplaene[tn]; speichern();
    meldung(`${tn} abgeschlossen: ${n} Reste ins Hofladen-Blatt übernommen, Kisten geleert.`); render();
  };
}
const kistenArtOpt = sel => S.artikel.filter(a => !istOrgan(a.name)).map(a => opt(a.name, a.name, a.name === sel)).join('') + opt('Sonderfälle (beschriftet)', 'Sonderfälle (beschriftet)', sel === 'Sonderfälle (beschriftet)');

function tabPackliste(tn, ziel) {
  const pl = packliste(S, tn);
  ziel.innerHTML = `<div class="knopfleiste" style="margin-bottom:10px"><button class="btn haupt" data-act="teilen">Als Bild teilen</button><button class="btn" data-act="drucken">Drucken</button></div>
    <div class="klein" style="margin-bottom:8px">Endbetrag nach dem Wiegen eintragen. Status antippen: offen → gepackt (mit Lagerplatz) → abgeholt.</div>
    <div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Name</th><th>Telefon</th><th>Bestellung</th><th>Sonderfälle</th><th>Lagerplatz</th><th class="r">Schätzpreis</th><th class="r">Endbetrag</th><th>Status</th></tr></thead><tbody>
    ${pl.rows.map(r => `<tr data-nr="${r.nr}"><td class="r"><a href="#/bestellung/${r.nr}">${r.nr}</a></td><td class="fett">${esc(r.name)}</td><td>${r.tel ? `<a href="tel:${esc(r.tel)}">${esc(r.tel)}</a>` : ''}</td><td class="klein">${esc(r.text)}</td><td class="klein">${esc(r.sonder)}</td><td>${r.lager ? `<b>${esc(r.lager)}</b>` : `<span class="klein">Vorschlag: ${esc(r.lagerVorschlag)}</span>`}</td><td class="r">${fmtEur(r.schaetz)}</td>
      <td style="width:120px"><input class="feld zahl" inputmode="decimal" data-ch="betrag" value="${r.endbetrag !== null ? fmtNum(r.endbetrag, 2, 2) : ''}"></td><td><button class="btn klein" data-act="status">${statusMarke(r.status)}</button></td></tr>`).join('') || '<tr><td colspan="9" class="klein">Keine Bestellungen für dieses Tier.</td></tr>'}
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
      ${ko.rows.filter(r => r.bedarf > 0.0001).map(r => `<tr class="${r.fehlt > 0 ? 'rot' : ''}"><td>${esc(r.art)}${istOrgan(r.art) ? ' <span class="klein">(separat)</span>' : ''}</td><td class="r">${fmtNum(r.einzeln, 2)}</td><td class="r">${fmtNum(r.ausPak, 2)}</td><td class="r">${fmtNum(r.bedarf, 2)}</td><td class="r">${fmtNum(r.ausKisten, 1)}</td><td class="r">${r.fehlt > 0 ? fmtNum(r.fehlt, 2) : ''}</td></tr>`).join('')}
      </tbody></table></div>
    <div class="karte" style="padding:0"><h3 style="margin:14px 16px 4px">Pickliste – antippen wenn erledigt</h3>
      ${ko.picks.map((p, i) => `<div class="pick ${ticks[i] ? 'erledigt' : ''}" data-act="tick" data-i="${i}"><div class="kiste${p.hackTisch ? ' hack' : ''}">${p.hackTisch ? 'Hack' : p.kiste}</div><div class="menge">${fmtNum(p.menge, 1)} ${p.einheit}</div><div><b>${esc(p.art)}</b>${p.verpacken ? `<div class="klein">${esc(p.verpacken)}</div>` : ''}</div><div class="klein">${esc(p.platz)}</div></div>`).join('') || '<div style="padding:16px" class="klein">Nichts aus den Kisten zu holen.</div>'}
    </div></div>`;
  inhalt().innerHTML = h;
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
  const blob = sicherungBlob(S), name = sicherungName();
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
  z.innerHTML = `<div class="spalten2"><div>
    <div class="karte"><h3 style="margin-top:0">Automatische Sicherung in Google Drive</h3>
      <p class="klein">Sobald das Tablet Internet hat und die App offen ist, wird bei Änderungen automatisch gesichert (höchstens 1× pro Stunde) – in den Drive-Ordner „Bergwiesenhof“.</p>
      <label class="f">Sicherungs-Adresse (aus der Mail an dich selbst einfügen)<input class="feld" id="sadr" value="${esc(S.settings.sicherungUrl || '')}" placeholder="https://script.google.com/macros/s/…/exec?k=…" autocomplete="off"></label>
      <p class="klein">Status: ${autoTxt}</p>
      <div class="knopfleiste"><button class="btn" data-act="sadrSpeichern">Adresse speichern & testen</button>${adr ? '<button class="btn haupt" data-act="sJetzt">Jetzt sichern</button>' : ''}</div></div>
    <div class="karte"><h3 style="margin-top:0">Datensicherung von Hand</h3>
      <p>Letzte Sicherung von Hand: <b>${tage}</b><br><span class="klein">Zusätzlich oder falls die automatische Sicherung nicht eingerichtet ist: Datei per Gmail an dich selbst oder in Drive ablegen.</span></p>
      <div class="knopfleiste"><button class="btn haupt" data-act="teilen">Sicherung teilen (Drive, Mail …)</button><button class="btn" data-act="datei">Sicherung als Datei speichern</button></div></div>
    <div class="karte"><h3 style="margin-top:0">Sicherung einspielen</h3><p class="klein">Ersetzt alle Daten auf diesem Tablet durch die Sicherungsdatei (z. B. nach einem Gerätewechsel).</p>
      <input type="file" accept=".json,application/json" id="datei" style="display:none"><button class="btn" data-act="laden">Sicherungsdatei wählen …</button></div>
    <div class="karte"><h3 style="margin-top:0">Excel-Export</h3><p class="klein">Alle Bestellungen, Kunden, Tiere, Sonderwünsche, Portionen, Kisten und Hofladen als Excel-Datei – für Auswertungen am PC.</p>
      <div class="knopfleiste"><button class="btn" data-act="excel">Excel-Datei teilen</button><button class="btn" data-act="exceldatei">Excel-Datei speichern</button></div></div>
  </div><div>
    <div class="karte"><h3 style="margin-top:0">Automatische Tageskopien</h3><p class="klein">Die App legt einmal am Tag eine Kopie auf dem Tablet an (die letzten 14 Tage). Damit kann ein Versehen rückgängig gemacht werden – ersetzt aber keine Sicherung außerhalb des Tablets.</p>
      ${snaps.map(t => `<div class="zeile" style="margin-bottom:6px"><span class="platz">Stand vom ${fmtDate(t)}</span><button class="btn klein" data-act="snap" data-t="${t}">wiederherstellen</button></div>`).join('') || '<div class="klein">noch keine</div>'}</div>
    <div class="karte"><h3 style="margin-top:0">Speicher</h3><p class="klein">Dauerhafter Speicher: <b>${ui.dauerhaft ? 'ja ✓' : 'nicht bestätigt'}</b> · ${S.bestellungen.length} Bestellungen, ${S.kunden.length} Kunden, ${S.tiere.length} Tiere · App-Version ${APP_VERSION}</p>
      ${ui.dauerhaft ? '' : '<button class="btn klein" data-act="persist">Dauerhaften Speicher anfordern</button>'}</div>
    <div class="karte"><h3 style="margin-top:0">Neues Jahr beginnen</h3><p class="klein">Erst wird eine Sicherung (Archiv) erstellt, danach werden Bestellungen, Tiere, Kisten, Packpläne und die Hofladen-Liste geleert. Kunden, Preisliste und Einstellungen bleiben. Die Bestellnummern beginnen wieder bei 1.</p>
      <button class="btn braun" data-act="jahr">Neues Jahr beginnen …</button></div>
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
  ui.acts.excel = async () => { const r = await teilenDatei(excelExport(S), `Bergwiesenhof_Export_${stempel()}.xlsx`, 'Excel-Export', ''); if (r === 'gespeichert') meldung('Excel-Datei im Ordner „Download“ gespeichert.'); };
  ui.acts.exceldatei = () => { download(excelExport(S), `Bergwiesenhof_Export_${stempel()}.xlsx`); meldung('Excel-Datei im Ordner „Download“ gespeichert.'); };
  ui.acts.laden = () => $('#datei').click();
  $('#datei').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const x = standPruefen(JSON.parse(await f.text()));
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
  ui.acts.jahr = async () => {
    if (!(await frage('Neues Jahr beginnen', 'Zuerst wird eine Archiv-Sicherung erstellt. Danach werden Bestellungen, Tiere, Kisten und die Hofladen-Liste geleert. Kunden, Preisliste und Einstellungen bleiben.', 'Weiter'))) return;
    const blob = sicherungBlob(S), name = `Bergwiesenhof_Archiv_${todayISO()}.json`;
    const r = await teilenDatei(blob, name, 'Archiv Bestellsystem', '');
    if (r === 'abgebrochen') return meldung('Abgebrochen – es wurde nichts geändert.');
    if (!(await frage('Archiv gespeichert?', `Ist das Archiv „${esc(name)}“ sicher abgelegt? Erst dann die Daten leeren.`, 'Ja, jetzt leeren', 'Abbrechen', 'rot'))) return;
    bewegungsdatenLeeren(S, false); S.letzteSicherung = new Date().toISOString(); speichern(); meldung('Neues Jahr ist angelegt.'); gehe('#/start');
  };
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
  z.innerHTML = `<div class="karte"><label class="f">Überschrift der Preisliste<input class="feld" data-ch="st" data-f="preislisteTitel" value="${esc(st.preislisteTitel || '')}"></label></div>
   <div class="karte"><h3 style="margin-top:0">Genusspaket <span class="klein">– Inhalt unter Einstellungen → Genusspaket, zurzeit ca. ${fmtNum(paketGewicht(S), 1)} kg</span></h3><div class="zeile">
    ${[['preisPaketKg', 'Preis je kg (€)'], ['preisVakPaket', 'Vakuumieren je Paket (€)'], ['preisTuete', 'Vakuumieren je Tüte (€)']].map(([f, t]) => `<label class="f" style="width:180px">${t}<input class="feld zahl" inputmode="decimal" data-ch="st" data-f="${f}" value="${fmtNum(st[f], 2)}"></label>`).join('')}</div></div>
   <div class="tabwrap"><table class="tab"><thead><tr><th>Artikel</th><th>bestellt in</th><th class="r">Preis (€/kg)</th><th class="r">im Genusspaket</th><th class="c">„am Stück“ möglich</th></tr></thead><tbody>
   ${S.artikel.map((a, i) => `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td><td>${esc(a.einheit)}</td>
     <td style="width:110px"><input class="feld zahl" inputmode="decimal" data-ch="art" data-f="preis" value="${fmtNum(a.preis, 2)}"></td>
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
  const sB = S.artikel.reduce((s, a) => s + num(a.anteil), 0), sR = S.artikel.reduce((s, a) => s + anteilVon(S, a, 'Rind'), 0);
  const feld = (f, t, dec = 0) => `<label class="f" style="width:250px">${t}<input class="feld zahl" inputmode="decimal" data-ch="st" data-f="${f}" value="${fmtNum(st[f], dec || 2)}"></label>`;
  z.innerHTML = `<div class="karte"><h3 style="margin-top:0">Ausbeute je Tier (Anteil am Schlachtgewicht)</h3>
   <label class="zeile" style="gap:10px;margin-bottom:10px"><input type="checkbox" data-ch="rindwie" style="width:24px;height:24px"${eigen ? '' : ' checked'}> <b>Rind: Werte vom Bullen übernehmen</b> <span class="klein">(Haken weg = eigene Prozente für Rinder eingeben)</span></label>
   <div class="tabwrap"><table class="tab"><thead><tr><th>Bestellartikel</th><th class="r">Anteil Bulle (%)</th><th class="r">Anteil Rind (%)</th><th class="r">Referenz</th><th class="r">Bulle ${fmtNum(st.sgBulle)} kg</th><th class="r">Rind ${fmtNum(st.sgRind)} kg</th><th>Teilstücke für die Kistenfüllung</th></tr></thead><tbody>
   ${S.artikel.map((a, i) => num(a.anteil) > 0 || num(a.anteilRind) > 0 || !istOrgan(a.name) && !a.beutelG ? `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td>
     <td style="width:110px"><input class="feld zahl${ausserhalb(num(a.anteil), a.refMin, a.refMax) ? ' fehlt' : ''}" inputmode="decimal" data-ch="anteil" data-f="anteil" value="${fmtNum(num(a.anteil) * 100, 2)}"></td>
     <td style="width:110px"><input class="feld zahl${eigen ? '' : ' auto'}${ausserhalb(anteilVon(S, a, 'Rind'), a.refMin, a.refMax) ? ' fehlt' : ''}" inputmode="decimal" data-ch="anteil" data-f="anteilRind" value="${fmtNum(anteilVon(S, a, 'Rind') * 100, 2)}"${eigen ? '' : ' readonly'}></td>
     <td class="r klein" style="white-space:nowrap">${refText(a.refMin, a.refMax)}</td>
     <td class="r">${fmtNum(num(a.anteil) * st.sgBulle, 1)} kg</td><td class="r">${fmtNum(anteilVon(S, a, 'Rind') * st.sgRind, 1)} kg</td><td><input class="feld" data-ch="teile" value="${esc(a.teile || '')}"></td></tr>` : '').join('')}
   <tr><td class="fett">Summe</td><td class="r fett">${fmtNum(sB * 100, 1)} %</td><td class="r fett">${fmtNum(sR * 100, 1)} %</td><td colspan="4"></td></tr></tbody></table></div>
   <p class="klein">Rot = außerhalb der Referenzspanne (Tippfehler?). Gilt für alle Tiere dieses Typs ohne eingetragenes Schlachtgewicht wie mit. Änderungen wirken sofort auf Mengenprüfung, Paketgewicht und Packplan.</p></div>
   <div class="karte"><h3 style="margin-top:0">Braten – gewachsene Stücke <span class="klein">– für Kistenfüllung, Gewichte und den Bug-Anteil</span></h3>
    <p class="klein">Werte für Rind und Bulle mit Standard-Schlachtgewicht. Für jedes Tier werden die Stücke auf dessen Braten-Ausbeute hochgerechnet (Rind ${fmtNum(st.sgRind)} kg: ${fmtNum(yieldArt(S, { typ: 'Rind', sg: null }, 'Braten'), 1)} kg, Bulle ${fmtNum(st.sgBulle)} kg: ${fmtNum(yieldArt(S, { typ: 'Bulle', sg: null }, 'Braten'), 1)} kg). Nur die angehakten Stücke (Bug) dürfen bei Bedarf ins Hack – das falsche Filet bleibt immer Braten.</p>
    <div class="tabwrap" style="max-width:860px"><table class="tab"><thead><tr><th>Teilstück</th><th class="r">Stück</th><th class="r">kg je Stück<br>Rind</th><th class="r">kg je Stück<br>Bulle</th><th class="r">Referenz</th><th class="r">= kg Rind</th><th class="r">= kg Bulle</th><th class="c">darf bei Bedarf<br>ins Hack</th><th></th></tr></thead><tbody>
    ${(st.bratenTeile || []).map((x, i) => `<tr data-i="${i}"><td><input class="feld" data-ch="bt" data-f="name" value="${esc(x.name)}"></td>
      <td style="width:80px"><input class="feld zahl" inputmode="numeric" data-ch="bt" data-f="stueck" value="${fmtNum(x.stueck)}"></td>
      <td style="width:96px"><input class="feld zahl${ausserhalb(num(x.kg), x.kgMin, x.kgMax) ? ' fehlt' : ''}" inputmode="decimal" data-ch="bt" data-f="kg" value="${fmtNum(x.kg, 3)}"></td>
      <td style="width:96px"><input class="feld zahl${num(x.kgBulle) > 0 && ausserhalb(num(x.kgBulle), x.kgMin, x.kgMax) ? ' fehlt' : ''}" inputmode="decimal" data-ch="bt" data-f="kgBulle" value="${num(x.kgBulle) > 0 ? fmtNum(x.kgBulle, 3) : ''}" placeholder="wie Rind"></td>
      <td class="r klein" style="white-space:nowrap">${refText(x.kgMin, x.kgMax, 1, 2, 'kg')}${has(x.refMin) ? '<br>' + refText(x.refMin, x.refMax, 100, 1) : ''}</td>
      <td class="r">${fmtNum(num(x.stueck) * teilKg(x, 'Rind'), 2)}</td><td class="r">${fmtNum(num(x.stueck) * teilKg(x, 'Bulle'), 2)}</td>
      <td class="c"><label class="check"><input type="checkbox" data-ch="bt" data-f="bug"${x.bug ? ' checked' : ''}></label></td>
      <td style="width:50px"><button class="btn klein rot" data-act="btweg" data-i="${i}">✕</button></td></tr>`).join('')}
    <tr><td class="fett">Summe</td><td></td><td></td><td></td><td></td><td class="r fett">${fmtNum(bratenTeileKg(S, 'Rind'), 2)} kg</td><td class="r fett">${fmtNum(bratenTeileKg(S, 'Bulle'), 2)} kg</td><td class="c klein">ins Hack möglich:<br>Rind ${fmtNum(bugAnteilVon(S, 'Rind') * 100, 0)} % · Bulle ${fmtNum(bugAnteilVon(S, 'Bulle') * 100, 0)} %</td><td></td></tr></tbody></table></div>
    <div class="knopfleiste" style="margin-top:8px"><button class="btn klein" data-act="btneu">+ Teilstück</button></div></div>
   <div class="karte"><h3 style="margin-top:0">Ganze Stücke für die Kisten</h3>
    <p class="klein">Diese Artikel kommen als ganze Stücke vom Metzger und werden Stück für Stück auf die Kisten verteilt (z. B. „2 ganze Stücke Filet“). Rostbraten und Steak werden geschnitten – am Stück nur als Sonderwunsch. Rouladen, Steak, Rostbraten, Beinscheiben und die Knochen kommen sortenrein in je eine eigene Kiste (bis zur Ausnahme-Grenze, sonst geteilt). Immer genau eine eigene Kiste (sortenrein, bis ${fmtNum(num(st.kisteAusnahme) || 25)} kg): ${EINE_KISTE.join(', ')}. Mehrere Kisten gibt es nur bei Braten (nach Stücken), Siedfleisch, Gulasch, Beinscheiben und Hackfleisch. Gewicht je Stück = Ausbeute des Tiers ÷ Anzahl. 0 = nicht als ganzes Stück.</p>
    <div class="tabwrap" style="max-width:760px"><table class="tab"><thead><tr><th>Artikel</th><th class="r">Anzahl je Tier</th><th class="r">kg je Stück Rind</th><th class="r">kg je Stück Bulle</th><th class="r">Referenz</th></tr></thead><tbody>
    ${S.artikel.map((a, i) => ({ a, i })).filter(({ a }) => num(a.ganzeStuecke) > 0 || ['Filet', 'Tafelspitz'].includes(a.name)).map(({ a, i }) => { const n = num(a.ganzeStuecke);
      const kR = n > 0 ? yieldArt(S, { typ: 'Rind', sg: null }, a.name) / n : 0, kB = n > 0 ? yieldArt(S, { typ: 'Bulle', sg: null }, a.name) / n : 0;
      return `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td><td style="width:110px"><input class="feld zahl" inputmode="numeric" data-ch="ganz" value="${n || 0}"></td>
      <td class="r${n > 0 && ausserhalb(kR, a.stkMin, a.stkMax) ? ' warn' : ''}">${n > 0 ? fmtNum(kR, 2) + ' kg' : '–'}</td><td class="r${n > 0 && ausserhalb(kB, a.stkMin, a.stkMax) ? ' warn' : ''}">${n > 0 ? fmtNum(kB, 2) + ' kg' : '–'}</td>
      <td class="r klein">${refText(a.stkMin, a.stkMax, 1, 2, 'kg')}</td></tr>`; }).join('')}</tbody></table></div></div>
   <div class="karte"><h3 style="margin-top:0">Einzelgewichte <span class="klein">– Schätzwerte, bitte nachwiegen</span></h3>
    <div class="zeile oben" style="margin-bottom:8px">${feld('maxWaden', 'Waden am Stück höchstens je Tier')}<p class="klein" style="max-width:420px;margin:22px 0 0">Gewicht einer Wade = Beinscheiben-Ausbeute ÷ Anzahl Waden: Rind ${fmtNum(wadeKg(S, null), 1)} kg, Bulle ${fmtNum(yieldArt(S, { typ: 'Bulle', sg: null }, 'Beinscheiben') / (num(st.maxWaden) || 4), 1)} kg.</p></div>
    <p class="klein">Damit wird überall gerechnet: Bestellungen nach Stück (z. B. „Steak 3“ = 3 × Stückgewicht), Genusspaket, Beutelgrößen der Knochen. Leer = Artikel wird nur nach kg bestellt.</p>
    <div class="tabwrap" style="max-width:640px"><table class="tab"><tbody>${S.artikel.map((a, i) => ({ a, i })).filter(({ a }) => !istOrgan(a.name) || a.einheit === 'Stk').map(({ a, i }) => { const btl = num(a.beutelG) > 0; return `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td>
      <td style="width:130px"><input class="feld zahl${!btl && !(num(a.ganzeStuecke) > 0) && num(a.stueckG) > 0 && ausserhalb(num(a.stueckG) / 1000, a.stkMin, a.stkMax) ? ' fehlt' : ''}" title="${!(num(a.ganzeStuecke) > 0) ? refText(a.stkMin, a.stkMax, 1000, 0, 'g') : ''}" inputmode="numeric" data-ch="eg" data-f="${btl ? 'beutelG' : 'stueckG'}" value="${btl ? fmtNum(a.beutelG) : num(a.stueckG) > 0 ? fmtNum(a.stueckG) : ''}" placeholder="–"></td>
      <td class="klein" style="width:110px">g je ${btl ? 'Beutel' : 'Stück'}${a.einheit === 'Stk' ? ' (für Schätzpreis)' : ''}</td><td class="klein r" style="width:110px">${!(num(a.ganzeStuecke) > 0) ? refText(a.stkMin, a.stkMax, 1000, 0, 'g') : ''}</td></tr>`; }).join('')}</tbody></table></div></div>
   <div class="karte"><h3 style="margin-top:0">Einstellungen</h3><div class="zeile oben">
    ${feld('sgBulle', 'Standard-Schlachtgewicht Bulle (kg)')}${feld('sgRind', 'Standard-Schlachtgewicht Rind/Färse (kg)')}
    ${feld('hackKiste', 'Hackfleisch je Metzgerkiste (kg)')}${feld('kisteMax', 'Kiste max. (kg) – Packplan')}${feld('kisteAusnahme', 'Kiste in Ausnahmen bis (kg)')}
    ${feld('tueteJeKg', 'Vakuumieren ohne Portionsangabe: 1 Tüte je … kg')}
</div></div>
   <div class="karte"><h3 style="margin-top:0">Lagerplatz nach dem Packen</h3><p class="klein">Kühlschrank, wenn weniger Artikel als … <b>und</b> leichter als … kg – sonst Metzgerkiste im Kühlraum. Ein Genusspaket zählt als ein Artikel.</p><div class="zeile oben">
    ${feld('lagerMaxArtikel', 'Kühlschrank bei weniger als … Artikeln')}${feld('lagerMaxKg', 'und leichter als … kg')}</div></div>
   <div class="karte"><h3 style="margin-top:0">Innereien je Tier (werden vorab separat geholt)</h3><div class="zeile oben">
    ${feld('leberKg', 'Leber ca. (kg)')}${feld('nierenStk', 'Nieren ca. (Stk)')}${feld('herzStk', 'Herz ca. (Stk)')}${feld('zungeStk', 'Zunge ca. (Stk)')}${feld('baeckleStk', 'Bäckle ca. (Stk)')}${feld('ochsStk', 'Ochsenschwanz ca. (Stk)')}${feld('leberPortionG', 'Leber-Rest vakuumiert à (g)')}</div></div>`;
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
      <td style="width:84px"><input class="feld zahl" inputmode="numeric" data-ch="pk" data-f="anzahl" value="${fmtNum(p.anzahl)}"></td>
      <td style="width:104px">${einzelGewicht(S, p.art) ? `<input class="feld zahl auto" readonly value="${fmtNum(paketG(S, p))}" title="Einzelgewicht – unter Ausbeute & Kisten ändern">` : `<input class="feld zahl" inputmode="numeric" data-ch="pk" data-f="g" value="${fmtNum(p.g)}">`}</td>
      <td class="r fett">${fmtNum(kg(p), 2)}</td><td style="width:50px"><button class="btn klein rot" data-act="pkweg" data-i="${i}">✕</button></td></tr>`).join('') || '<tr><td colspan="5" class="klein">Noch kein Inhalt.</td></tr>'}
    <tr><td class="fett">Gewicht je Paket</td><td></td><td></td><td class="r fett">${fmtNum(sum, 2)} kg</td><td></td></tr>
    <tr><td class="klein">davon Knochen</td><td></td><td></td><td class="r klein">${fmtNum(knochen, 2)} kg</td><td></td></tr>
    <tr><td class="klein">Fleisch ohne Knochen</td><td></td><td></td><td class="r klein">${fmtNum(sum - knochen, 2)} kg</td><td></td></tr></tbody></table></div>
    <div class="knopfleiste" style="padding:10px 12px"><button class="btn klein" data-act="pkneu">+ Inhalt</button><span class="klein" style="align-self:center">Grau = Einzelgewicht aus „Ausbeute & Kisten“</span></div></div>
    <div>
     <div class="karte"><h3 style="margin-top:0">Hackfleisch im Paket</h3><p class="klein">Offen: eine Tüte mit der ganzen Hack-Menge. Vakuumiert: in Portionen.</p>
      <label class="f" style="width:260px">vakuumiert portioniert à (g)<input class="feld zahl" inputmode="numeric" data-ch="st" data-f="hackPaketG" value="${fmtNum(st.hackPaketG)}"></label></div>
     <div class="karte"><h3 style="margin-top:0">Pakete je Tier</h3>
      <label class="f" style="width:260px">höchstens … Genusspakete je Tier<input class="feld zahl" inputmode="numeric" data-ch="st" data-f="nenner" value="${fmtNum(st.nenner)}"></label>
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
