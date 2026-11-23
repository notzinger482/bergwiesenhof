// Bestellsystem Bergwiesenhof – Oberfläche (Teil 2: Schlachttag, Kommissionieren, Hofladen, Einstellungen, Start)
'use strict';

const REITER = [['menge', 'Mengenprüfung'], ['metzger', 'Metzgerauftrag'], ['packplan', 'Packplan'], ['kisten', 'Kisten'], ['hack', 'Hack-Zettel'], ['innereien', 'Innereien'], ['packliste', 'Packliste Kühlhaus']];
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
      { type: 'text', text: 'Reihenfolge: kleinere Bestell-Nr. zuerst. Ausbeute = Richtwerte, „knapp“ = über 90 % vergeben. Knochen und Innereien werden nicht geprüft.' }], footer: fussZeile() };
}
function docMetzger(ma) {
  const t = ma.tier, hk = num(S.settings.hackKiste) || 20;
  return { title: `Auftrag Metzger – ${t.name}`, sub: [abholTxt(t)],
    blocks: [{ type: 'h', text: 'Gesamtmengen' },
      { type: 'kv', rows: [['Hackfleisch', `${fmtNum(ma.hack.vorgabe)} kg`, ma.hack.vorgabe > 0 ? `(${ma.hack.kisten} ${ma.hack.kisten === 1 ? 'Kiste' : 'Kisten'} à ${fmtNum(hk)} kg)` : ''], ['Gulasch', `${fmtNum(ma.gulasch.vorgabe)} kg`, '']] },
      { type: 'text', text: 'Alle übrigen Stücke bitte wie gewohnt zuschneiden.' },
      { type: 'h', text: 'Separat vorbereiten – bitte mit Namen beschriften' },
      { type: 'table', head: ['Nr.', 'Name', 'Artikel', 'Menge', 'Hinweis'], widths: [1, 3.2, 3, 1.6, 3.6], align: ['r', '', '', 'r', ''], rows: ma.separat.map(s => [s.nr, s.name, s.art, s.menge, s.hinweis]) }],
    footer: fussZeile() };
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
      { type: 'table', head: ['Nr.', 'Name', 'Leber kg', 'Leber verpacken', 'Nieren', 'Herz', 'Zunge', 'Ochsenschw.', 'vakuumieren', '✓'], widths: [0.8, 2.6, 1, 1.7, 0.9, 0.8, 0.8, 1.2, 1.7, 0.5], align: ['r', '', 'r', '', 'r', 'r', 'r', 'r', '', ''],
        rows: ii.rows.map(r => [r.nr, r.name, fmtNum(r.leber, 3), r.leberAls, r.nieren || '', r.herz || '', r.zunge || '', r.ochs || '', r.vak, '☐']) },
      { type: 'text', text: '„vorhanden“ = Schätzwerte aus den Einstellungen (Innereien je Tier).' }], footer: fussZeile() };
}
function docPackliste(pl) {
  return { title: `Packliste Kühlhaus – ${pl.tier.name}`, sub: [abholTxt(pl.tier)],
    blocks: [{ type: 'table', head: ['Nr.', 'Name', 'Telefon', 'Bestellung', 'Sonderfälle (separat)', 'Schätzpreis', 'Endbetrag', 'gepackt', 'abgeholt'], widths: [0.7, 2.2, 1.7, 5, 2.6, 1.3, 1.3, 0.9, 0.9], align: ['r', '', '', '', '', 'r', 'r', '', ''],
      rows: pl.rows.map(r => [r.nr, r.name, r.tel, r.text, r.sonder, fmtEur(r.schaetz), r.endbetrag !== null ? fmtEur(r.endbetrag) : '', r.status !== 'offen' ? '☑' : '☐', r.status === 'abgeholt' ? '☑' : '☐']) }], footer: fussZeile() };
}
function docPick(ko) {
  const o = ko.o;
  return { title: `Kommissionierung Nr. ${o.nr} – ${o.name}`, sub: [`Tier: ${o.tier}`, `Genusspakete: ${fmtNum(o.pakete)}${num(o.pakVak) ? ` (davon ${fmtNum(o.pakVak)} vakuumieren)` : ''} · Vakuum-Tüten: ${ko.tueten || '–'}`],
    blocks: [{ type: 'kv', rows: [['Separat vom Metzger', ko.sonder.join('; ') || '–'], ['Innereien (separat)', ko.innereien.join(', ') || '–']] },
      { type: 'table', head: ['☐', 'Kiste', 'Menge', 'Inhalt', 'verpacken', 'Stellplatz'], widths: [0.5, 0.9, 1.2, 2.4, 4, 2.4], align: ['', 'r', 'r', '', '', ''],
        rows: ko.picks.map(p => ['☐', p.kiste, `${fmtNum(p.menge, 1)} ${p.einheit}`, p.art, p.verpacken, p.platz]), leer: 'keine Kisten eingetragen' },
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
    <div class="reiter">${REITER.map(([k, t]) => `<a href="#/schlachttag/${k}" class="${k === tab ? 'aktiv' : ''}">${t}</a>`).join('')}</div><div id="tabinhalt"></div>`;
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
  else if (tab === 'packplan') tabPackplan(tn, ziel, zeige);
  else if (tab === 'kisten') tabKisten(tn, ziel);
  else if (tab === 'hack') zeige(docHack(hackZettel(S, tn)));
  else if (tab === 'innereien') zeige(docInnereien(innereien(S, tn)));
  else if (tab === 'packliste') tabPackliste(tn, ziel);
}

function tabMetzger(tn, ziel, zeige) {
  const ma = metzgerauftrag(S, tn);
  const zeile = (l, h, g) => `<tr><td>${l}</td><td class="r">${h}</td><td class="r">${g}</td></tr>`;
  const vor = `<div class="karte" style="max-width:720px"><h3 style="margin-top:0">Berechnung (${ma.anzahl} Bestellungen, ${fmtNum(ma.pakete)} Genusspakete)</h3>
    <table class="tab"><thead><tr><th></th><th class="r">Hackfleisch (kg)</th><th class="r">Gulasch (kg)</th></tr></thead><tbody>
    ${zeile('einzeln bestellt', fmtNum(ma.hack.einzeln, 2), fmtNum(ma.gulasch.einzeln, 2))}
    ${zeile('davon separat (Sonderfall / am Stück)', fmtNum(ma.hack.separat, 2), fmtNum(ma.gulasch.separat, 2))}
    ${zeile('+ aus Genusspaketen', fmtNum(ma.hack.ausPak, 2), fmtNum(ma.gulasch.ausPak, 2))}
    ${zeile('<b>Vorschlag (aufgerundet)</b>', '<b>' + fmtNum(ma.hack.vorschlag) + '</b>', '<b>' + fmtNum(ma.gulasch.vorschlag) + '</b>')}
    <tr><td>Vorgabe manuell (überschreibt, leer = Vorschlag)</td><td class="r"><input class="feld zahl" style="width:110px" inputmode="decimal" data-ch="man" data-f="hack" value="${ma.hack.manuell !== null ? fmtNum(ma.hack.manuell, 1) : ''}"></td><td class="r"><input class="feld zahl" style="width:110px" inputmode="decimal" data-ch="man" data-f="gulasch" value="${ma.gulasch.manuell !== null ? fmtNum(ma.gulasch.manuell, 1) : ''}"></td></tr>
    ${zeile('Hack-Kisten à ' + fmtNum(S.settings.hackKiste) + ' kg', ma.hack.kisten + ` <span class="klein">(volle Kisten = ${fmtNum(ma.hack.vollKisten)} kg)</span>`, '')}
    </tbody></table><div class="klein" style="margin-top:6px">Volle Kisten gewünscht? Diese Zahl bei „Vorgabe manuell“ eintragen.</div></div>`;
  zeige(docMetzger(ma), '', vor);
  ui.acts.man = el => {
    const m = S.metzgerManuell[tn] = S.metzgerManuell[tn] || {};
    m[el.dataset.f] = el.value.trim() === '' ? null : num(el.value);
    speichern(); render();
  };
}

function tabPackplan(tn, ziel, zeige) {
  const pp = S.packplaene[tn];
  const t = tier(S, tn);
  const knoepfe = `<button class="btn braun" data-act="erstellen">${pp ? 'Packplan neu berechnen' : 'Packplan erstellen'}</button>${pp ? '<button class="btn" data-act="uebernehmen">In „Kisten“ übernehmen</button>' : ''}`;
  if (!pp) {
    ziel.innerHTML = `<div class="karte"><p>Für <b>${esc(tn)}</b> gibt es noch keinen Packplan.</p><p class="klein">Der Packplan rechnet aus, welche Stücke in welche Metzgerkiste kommen (max. ${fmtNum(S.settings.kisteMax)} kg, nur Rostbraten + Steak und Filet + Braten + Tafelspitz gemischt), wo jede Kiste im Auto steht und in welcher Reihenfolge eingeladen wird.</p><div class="knopfleiste">${knoepfe}</div></div>`;
  } else {
    const draufsicht = autoDraufsicht(pp);
    zeige(docPackplan(pp, t), knoepfe, draufsicht);
  }
  ui.acts.erstellen = () => {
    const neu = packplan(S, tn);
    if (neu.fehler) return meldung(neu.fehler, true);
    S.packplaene[tn] = neu; speichern(); render();
    if (neu.warn.length) dialog('Hinweis zum Packplan', neu.warn.map(w => `<p class="warn">${esc(w)}</p>`).join(''));
  };
  ui.acts.uebernehmen = async () => {
    const vorh = S.kisten.filter(k => k.tier === tn).length;
    const andere = kistenTiere(S).filter(x => x !== tn);
    let txt = `Packplan für ${esc(tn)}: ${pp.kisten.length} Kisten (Platz im Auto: ${pp.cap}).<br><br>Vorschlag ins Kisten-Blatt eintragen?${vorh ? ' <b>Die bisherigen Kisten dieses Tiers werden überschrieben.</b>' : ''}<br>Die kg sind Schätzwerte – nach dem Wiegen bitte die echten Gewichte eintragen.`;
    if (andere.length >= 2) txt += `<br><br><span class="warn">Achtung: Es sind schon Kisten für ${andere.map(esc).join(' und ')} eingetragen (max. zwei Tiere gleichzeitig).</span>`;
    if (!(await frage('In Kisten übernehmen', txt, 'Übernehmen'))) return;
    packplanUebernehmen(S, pp); speichern(); meldung('Kisten eingetragen.'); gehe('#/schlachttag/kisten');
  };
}
function autoDraufsicht(pp) {
  const pos = name => {
    const n = name.toLowerCase();
    const reihe = n.includes('vorne') ? 1 : n.includes('mitte') && !n.startsWith('hinten') ? 2 : n.includes('hinten') ? 3 : 0;
    const sp = n.includes('links') ? 1 : n.includes('rechts') ? 3 : 2;
    return { reihe, sp };
  };
  const felder = pp.felder.map(f => ({ ...f, p: pos(f.name) }));
  const zelle = f => `<div class="auto-feld ${f.kisten.length ? '' : 'leer'}" style="grid-row:${f.p.reihe + 1};grid-column:${f.p.reihe === 3 ? (f.p.sp === 1 ? '1 / span 3' : '4 / span 3') : (f.p.sp - 1) * 2 + 1 + ' / span 2'}"><div class="fn">${esc(f.name)} (${f.belegt}/${f.hoehe})</div>${f.kisten.map(k => `<div>${k.oben ? '<b>oben:</b> ' : ''}K${k.nr} ${esc(k.text)}</div>`).join('')}</div>`;
  if (felder.some(f => !f.p.reihe)) return `<div class="karte"><h3 style="margin-top:0">Stellplätze</h3>${felder.map(f => `<div><b>${esc(f.name)}</b>: ${f.kisten.map(k => 'K' + k.nr).join(', ')}</div>`).join('')}</div>`;
  return `<div class="karte"><h3 style="margin-top:0">Draufsicht Auto (oben = vorne)</h3><div class="zeile oben"><div class="auto-grid" style="grid-template-columns:repeat(6,1fr);flex:1">
    <div class="auto-tuer" style="grid-row:1;grid-column:1 / -1">— Fahrerhaus / vorne —</div>${felder.map(zelle).join('')}
    <div class="auto-tuer" style="grid-row:5;grid-column:1 / -1">— Tür hinten —</div></div><div class="klein" style="writing-mode:vertical-rl;align-self:center">rechte Tür ▸</div></div></div>`;
}

function tabKisten(tn, ziel) {
  const calc = kistenCalc(S, tn);
  const tiereMitKisten = kistenTiere(S);
  const artOpt = sel => S.artikel.filter(a => !istOrgan(a.name)).map(a => opt(a.name, a.name, a.name === sel)).join('') + opt('Sonderfälle (beschriftet)', 'Sonderfälle (beschriftet)', sel === 'Sonderfälle (beschriftet)');
  ziel.innerHTML = `${tiereMitKisten.length > 2 ? `<div class="hinweis">Es sind Kisten für ${tiereMitKisten.length} Tiere eingetragen (${tiereMitKisten.map(esc).join(', ')}). Fertige Tiere bitte abschließen.</div>` : ''}
    <div class="klein" style="margin-bottom:8px">Nach dem Wiegen beim Metzger die echten kg eintragen. „Rest“ = was nach allen Bestellungen in der Kiste übrig bleibt.</div>
    <div class="tabwrap"><table class="tab"><thead><tr><th class="r">Kiste</th><th>Inhalt</th><th class="r">kg gewogen</th><th class="r">Plan</th><th>Stellplatz</th><th class="r">Bedarf</th><th class="r">verplant</th><th class="r">Rest</th><th></th></tr></thead><tbody>
    ${calc.map(c => `<tr data-id="${c.k.id}"><td style="width:84px"><input class="feld zahl" inputmode="numeric" data-ch="kf" data-f="nr" value="${c.k.nr}"></td>
      <td><select class="feld" data-ch="kf" data-f="art">${artOpt(c.k.art)}</select></td>
      <td style="width:110px"><input class="feld zahl" inputmode="decimal" data-ch="kf" data-f="kg" value="${has(c.k.kg) ? fmtNum(c.k.kg, 2) : ''}"></td>
      <td class="r klein">${has(c.k.plan) ? fmtNum(c.k.plan, 1) : ''}</td>
      <td><input class="feld" data-ch="kf" data-f="platz" value="${esc(c.k.platz || '')}"></td>
      <td class="r">${fmtNum(c.bedarf, 1)}</td><td class="r">${fmtNum(c.verplant, 1)}</td><td class="r fett">${fmtNum(c.rest, 1)}</td>
      <td><button class="btn klein rot" data-act="kweg" data-id="${c.k.id}">✕</button></td></tr>`).join('') || '<tr><td colspan="9" class="klein">Keine Kisten eingetragen. Am einfachsten über „Packplan“ → „In Kisten übernehmen“.</td></tr>'}
    </tbody></table></div>
    <div class="knopfleiste" style="margin-top:12px"><button class="btn" data-act="kneu">+ Kistenzeile</button><button class="btn haupt" data-act="teilen">Als Bild teilen</button><button class="btn" data-act="drucken">Drucken</button>
    ${calc.length ? '<button class="btn braun" data-act="abschluss">Tier abgeschlossen – Reste an Hofladen, Kisten leeren</button>' : ''}</div>`;
  const find = id => S.kisten.find(k => k.id === +id);
  ui.acts.kf = el => {
    const k = find(el.closest('tr').dataset.id); const f = el.dataset.f;
    if (f === 'nr') { const n = Math.round(num(el.value)); if (n < 1 || n > 29) { meldung('Kistennummer 1 bis 29', true); render(); return; } k.nr = n; }
    else if (f === 'kg') k.kg = el.value.trim() === '' ? null : num(el.value);
    else k[f] = el.value;
    speichern(); render();
  };
  ui.acts.kweg = el => { S.kisten = S.kisten.filter(k => k.id !== +el.dataset.id); speichern(); render(); };
  ui.acts.kneu = () => {
    const id = S.kisten.reduce((m, k) => Math.max(m, k.id || 0), 0) + 1;
    const nr = Math.min(29, calc.reduce((m, c) => Math.max(m, c.k.nr), 0) + 1);
    S.kisten.push({ id, tier: tn, nr, art: 'Braten', kg: null, plan: null, platz: '' }); speichern(); render();
  };
  ui.acts.teilen = async () => { const d = docKisten(tn, calc); const r = await docTeilen(d, d.title); if (r === 'gespeichert') meldung('Bild gespeichert.'); };
  ui.acts.drucken = () => docDrucken(docKisten(tn, calc));
  ui.acts.abschluss = async () => {
    const reste = calc.filter(c => c.rest > 0.0001);
    if (!(await frage('Tier abschließen', `${calc.length} Kistenzeilen von <b>${esc(tn)}</b> abschließen?<br>${reste.length} Reste gehen an den Hofladen, danach werden die Kisten geleert.`, 'Abschließen'))) return;
    const n = tierAbschliessen(S, tn); speichern();
    meldung(`${tn} abgeschlossen: ${n} Reste ins Hofladen-Blatt übernommen, Kisten geleert.`); render();
  };
}

function tabPackliste(tn, ziel) {
  const pl = packliste(S, tn);
  ziel.innerHTML = `<div class="knopfleiste" style="margin-bottom:10px"><button class="btn haupt" data-act="teilen">Als Bild teilen</button><button class="btn" data-act="drucken">Drucken</button></div>
    <div class="klein" style="margin-bottom:8px">Endbetrag nach dem Wiegen eintragen. Status antippen: offen → gepackt → abgeholt.</div>
    <div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Name</th><th>Telefon</th><th>Bestellung</th><th>Sonderfälle</th><th class="r">Schätzpreis</th><th class="r">Endbetrag</th><th>Status</th></tr></thead><tbody>
    ${pl.rows.map(r => `<tr data-nr="${r.nr}"><td class="r"><a href="#/bestellung/${r.nr}">${r.nr}</a></td><td class="fett">${esc(r.name)}</td><td>${r.tel ? `<a href="tel:${esc(r.tel)}">${esc(r.tel)}</a>` : ''}</td><td class="klein">${esc(r.text)}</td><td class="klein">${esc(r.sonder)}</td><td class="r">${fmtEur(r.schaetz)}</td>
      <td style="width:120px"><input class="feld zahl" inputmode="decimal" data-ch="betrag" value="${r.endbetrag !== null ? fmtNum(r.endbetrag, 2, 2) : ''}"></td><td><button class="btn klein" data-act="status">${statusMarke(r.status)}</button></td></tr>`).join('') || '<tr><td colspan="8" class="klein">Keine Bestellungen für dieses Tier.</td></tr>'}
    </tbody></table></div>`;
  const best = el => S.bestellungen.find(o => o.nr === +el.closest('tr').dataset.nr);
  ui.acts.betrag = el => { const o = best(el); o.endbetrag = el.value.trim() === '' ? null : r2(num(el.value)); speichern(); };
  ui.acts.status = el => { const o = best(el); const f = ['offen', 'gepackt', 'abgeholt']; o.status = f[(f.indexOf(o.status || 'offen') + 1) % 3]; speichern(); el.innerHTML = statusMarke(o.status); };
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
    ${ohneKisten ? '<div class="hinweis">Für dieses Tier sind noch keine Kisten eingetragen (Schlachttag → Packplan → „In Kisten übernehmen“).</div>' : ''}
    <div class="spalten2"><div class="karte">
      <h2 style="margin-top:0">Nr. ${ko.o.nr} – ${esc(ko.o.name)} ${statusMarke(ko.o.status)}</h2>
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
      ${ko.picks.map((p, i) => `<div class="pick ${ticks[i] ? 'erledigt' : ''}" data-act="tick" data-i="${i}"><div class="kiste">${p.kiste}</div><div class="menge">${fmtNum(p.menge, 1)} ${p.einheit}</div><div><b>${esc(p.art)}</b>${p.verpacken ? `<div class="klein">${esc(p.verpacken)}</div>` : ''}</div><div class="klein">${esc(p.platz)}</div></div>`).join('') || '<div style="padding:16px" class="klein">Nichts aus den Kisten zu holen.</div>'}
    </div></div>`;
  inhalt().innerHTML = h;
  ui.acts.tierwahl = el => { ui.tierWahl = el.value; ui.kommiNr = null; render(); };
  ui.acts.nrwahl = el => { ui.kommiNr = +el.value; gehe('#/kommissionierung?nr=' + el.value); };
  ui.acts.vor = el => { const o = ords[idx + num(el.dataset.d)]; if (o) gehe('#/kommissionierung?nr=' + o.nr); };
  ui.acts.tick = el => { const i = +el.dataset.i; ticks[i] = !ticks[i]; el.classList.toggle('erledigt', ticks[i]); };
  ui.acts.gepackt = () => {
    const o = S.bestellungen.find(x => x.nr === nr); if ((o.status || 'offen') === 'offen') o.status = 'gepackt'; speichern();
    const naechste = ords.slice(idx + 1).find(x => (x.status || 'offen') === 'offen') || ords[idx + 1];
    meldung(`Nr. ${nr} gepackt.`);
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
    <div class="klein" style="margin-bottom:10px">Wird von „Tier abgeschlossen“ (Schlachttag → Kisten) gefüllt: was nach dem Kommissionieren in den Kisten übrig bleibt.</div>
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
const EREITER = [['daten', 'Daten & Sicherung'], ['preise', 'Preisliste'], ['ausbeute', 'Ausbeute & Kisten'], ['auto', 'Auto (Stellplätze)'], ['hof', 'Hof & Hilfe']];
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
  else tabHof(z);
}
async function tabDaten(z) {
  const tage = S.letzteSicherung ? new Date(S.letzteSicherung).toLocaleString('de-DE') : 'noch nie';
  const snaps = await schnappschuesse();
  if (!document.body.contains(z)) return;
  z.innerHTML = `<div class="spalten2"><div>
    <div class="karte"><h3 style="margin-top:0">Datensicherung</h3>
      <p>Letzte Sicherung: <b>${tage}</b><br><span class="klein">Alle Daten liegen nur auf diesem Tablet. Bitte regelmäßig (z. B. jeden Sonntag) zu Hause im WLAN sichern und die Datei in OneDrive/Google Drive oder per Mail ablegen.</span></p>
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
   <div class="karte"><h3 style="margin-top:0">Genusspaket</h3><div class="zeile">
    ${[['preisPaketKg', 'Preis je kg (€)'], ['preisVakPaket', 'Vakuumieren je Paket (€)'], ['preisTuete', 'Vakuumieren je Tüte (€)'], ['paketVon', 'Gewicht ca. von (kg)'], ['paketBis', 'Gewicht ca. bis (kg)']].map(([f, t]) => `<label class="f" style="width:180px">${t}<input class="feld zahl" inputmode="decimal" data-ch="st" data-f="${f}" value="${fmtNum(st[f], 2)}"></label>`).join('')}</div></div>
   <div class="tabwrap"><table class="tab"><thead><tr><th>Artikel</th><th>bestellt in</th><th class="r">Preis (€/kg)</th><th class="c">im Genusspaket</th><th class="r">Stückgewicht (g)</th><th class="c">„am Stück“ möglich</th><th class="r">fester Beutel (g)</th></tr></thead><tbody>
   ${S.artikel.map((a, i) => `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td><td>${esc(a.einheit)}</td>
     <td style="width:110px"><input class="feld zahl" inputmode="decimal" data-ch="art" data-f="preis" value="${fmtNum(a.preis, 2)}"></td>
     <td class="c"><label class="check"><input type="checkbox" data-ch="art" data-f="inPaket"${a.inPaket ? ' checked' : ''}></label></td>
     <td style="width:110px"><input class="feld zahl" inputmode="numeric" data-ch="art" data-f="stueckG" value="${num(a.stueckG) || ''}"></td>
     <td class="c"><label class="check"><input type="checkbox" data-ch="art" data-f="amStueck"${a.amStueck ? ' checked' : ''}></label></td>
     <td style="width:110px"><input class="feld zahl" inputmode="numeric" data-ch="art" data-f="beutelG" value="${num(a.beutelG) || ''}"></td></tr>`).join('')}
   </tbody></table></div><p class="klein">„im Genusspaket“: davon bekommt jedes Paket 1/${num(st.nenner)}. Stückgewicht: für Bestellungen nach Stück (z. B. 4 Rostbraten). Preisänderungen gelten sofort auch für die Schätzpreise bestehender Bestellungen.</p>`;
  ui.acts.st = el => { S.settings[el.dataset.f] = el.type === 'text' && !el.classList.contains('zahl') ? el.value : num(el.value); speichern(); meldung('Gespeichert.'); };
  ui.acts.art = el => { const a = S.artikel[+el.closest('tr').dataset.i]; a[el.dataset.f] = el.type === 'checkbox' ? el.checked : num(el.value); speichern(); meldung('Gespeichert.'); };
}
function tabAusbeute(z) {
  const st = S.settings;
  const summe = S.artikel.reduce((s, a) => s + num(a.anteil), 0);
  const feld = (f, t, dec = 0) => `<label class="f" style="width:250px">${t}<input class="feld zahl" inputmode="decimal" data-ch="st" data-f="${f}" value="${fmtNum(st[f], dec || 2)}"></label>`;
  z.innerHTML = `<div class="karte"><h3 style="margin-top:0">Ausbeute je Tier (Anteil am Schlachtgewicht)</h3>
   <div class="tabwrap"><table class="tab"><thead><tr><th>Bestellartikel</th><th class="r">Anteil (%)</th><th class="r">Bulle ${fmtNum(st.sgBulle)} kg</th><th class="r">Rind ${fmtNum(st.sgRind)} kg</th><th>Teilstücke für die Kistenfüllung</th></tr></thead><tbody>
   ${S.artikel.map((a, i) => num(a.anteil) > 0 || !istOrgan(a.name) && !a.beutelG ? `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td><td style="width:110px"><input class="feld zahl" inputmode="decimal" data-ch="anteil" value="${fmtNum(num(a.anteil) * 100, 2)}"></td><td class="r">${fmtNum(num(a.anteil) * st.sgBulle, 1)} kg</td><td class="r">${fmtNum(num(a.anteil) * st.sgRind, 1)} kg</td><td><input class="feld" data-ch="teile" value="${esc(a.teile || '')}"></td></tr>` : '').join('')}
   <tr><td class="fett">Summe</td><td class="r fett">${fmtNum(summe * 100, 1)} %</td><td colspan="3"></td></tr></tbody></table></div></div>
   <div class="karte"><h3 style="margin-top:0">Einstellungen</h3><div class="zeile oben">
    ${feld('sgBulle', 'Standard-Schlachtgewicht Bulle (kg)')}${feld('sgRind', 'Standard-Schlachtgewicht Rind/Färse (kg)')}${feld('nenner', 'Ein Genusspaket = 1 / … des Tiers')}
    ${feld('hackKiste', 'Hackfleisch je Metzgerkiste (kg)')}${feld('kisteMax', 'Kiste max. (kg) – Packplan')}${feld('kisteAusnahme', 'Kiste in Ausnahmen bis (kg)')}
    ${feld('hackPaketG', 'Hack im Genusspaket portioniert à (g)')}${feld('tueteJeKg', 'Vakuumieren ohne Portionsangabe: 1 Tüte je … kg')}
    ${feld('skKg', 'Suppenknochen (SK) je Tier ca. (kg)')}${feld('fkKg', 'Soßenknochen (FK) je Tier ca. (kg)')}</div></div>
   <div class="karte"><h3 style="margin-top:0">Innereien je Tier (werden vorab separat geholt)</h3><div class="zeile oben">
    ${feld('leberKg', 'Leber ca. (kg)')}${feld('nierenStk', 'Nieren ca. (Stk)')}${feld('herzStk', 'Herz ca. (Stk)')}${feld('zungeStk', 'Zunge ca. (Stk)')}${feld('ochsStk', 'Ochsenschwanz ca. (Stk)')}${feld('leberPortionG', 'Leber-Rest vakuumiert à (g)')}</div></div>`;
  ui.acts.st = el => { S.settings[el.dataset.f] = num(el.value); speichern(); render(); };
  ui.acts.anteil = el => { S.artikel[+el.closest('tr').dataset.i].anteil = num(el.value) / 100; speichern(); render(); };
  ui.acts.teile = el => { S.artikel[+el.closest('tr').dataset.i].teile = el.value; speichern(); meldung('Gespeichert.'); };
}
function tabAuto(z) {
  z.innerHTML = `<div class="karte"><p class="klein">Reihenfolge = in welcher Folge man an die Stapel herankommt (1 = zuerst). Stapelhöhe = max. Kisten übereinander. Jedes Feld bekommt mindestens eine Kiste.</p>
   <div class="tabwrap"><table class="tab"><thead><tr><th>Stellplatz</th><th class="r">Stapelhöhe</th><th class="r">Reihenfolge (Entnahme)</th><th>Zugang</th></tr></thead><tbody>
   ${S.auto.map((f, i) => `<tr data-i="${i}"><td class="fett">${esc(f.name)}</td><td style="width:120px"><input class="feld zahl" inputmode="numeric" data-ch="auto" data-f="hoehe" value="${num(f.hoehe)}"></td><td style="width:150px"><input class="feld zahl" inputmode="numeric" data-ch="auto" data-f="reihenfolge" value="${num(f.reihenfolge)}"></td><td><input class="feld" data-ch="auto" data-f="zugang" value="${esc(f.zugang || '')}"></td></tr>`).join('')}
   <tr><td class="fett">Kisten gesamt (max. pro Tier)</td><td class="r fett">${S.auto.reduce((s, f) => s + num(f.hoehe), 0)}</td><td colspan="2"></td></tr></tbody></table></div></div>`;
  ui.acts.auto = el => { const f = S.auto[+el.closest('tr').dataset.i]; f[el.dataset.f] = el.dataset.f === 'zugang' ? el.value : num(el.value); speichern(); render(); };
}
function tabHof(z) {
  z.innerHTML = `<div class="karte"><label class="f">Fußzeile auf allen Unterlagen (Metzgerauftrag usw.)<input class="feld" data-ch="hz" value="${esc(S.settings.hofZeile || '')}"></label>
    <label class="f" style="margin-top:12px">Bestellwege (mit Komma getrennt)<input class="feld" data-ch="wege" value="${esc(S.wege.join(', '))}"></label></div>
   <div class="karte"><h3 style="margin-top:0">Kurzanleitung</h3><ol style="padding-left:20px;margin:0;line-height:1.6">
    <li><b>Tiere</b> anlegen (Typ, Schlacht- und Abholtermin). Passende Bestellungen von der Warteliste werden angeboten.</li>
    <li><b>Bestellung</b> erfassen: Name tippen (bekannte Kunden werden vorgeschlagen), Pakete und Einzelartikel. Tier leer lassen = automatisch nächstes passendes Tier.</li>
    <li><b>Schlachttag → Mengenprüfung</b>: reicht das Tier? Rot markierte Bestellungen aufs nächste Tier umstellen.</li>
    <li><b>Schlachttag → Metzgerauftrag</b>: „Als Bild teilen“ → WhatsApp → Metzger.</li>
    <li><b>Schlachttag → Packplan</b> erstellen und „In Kisten übernehmen“. Beim Metzger die Kisten nach Plan packen, wiegen und die kg unter <b>Kisten</b> eintragen.</li>
    <li><b>Hack-Zettel</b> und <b>Innereien</b> an die Helfer geben (teilen oder drucken).</li>
    <li><b>Kommissionieren</b>: je Bestellung „aus Kiste 3 → 2,0 kg Braten“, antippen wenn erledigt, dann „Gepackt ✓ und weiter“.</li>
    <li><b>Packliste Kühlhaus</b>: Endbetrag eintragen, Status „abgeholt“ setzen.</li>
    <li>Am Ende: <b>Kisten → Tier abgeschlossen</b> – Reste gehen an den Hofladen.</li>
    <li>Jede Woche: <b>Einstellungen → Sicherung teilen</b> (zu Hause im WLAN).</li></ol></div>`;
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
  ui.dauerhaft = await istDauerhaft();
  if (!ui.dauerhaft) ui.dauerhaft = await dauerhaftAnfordern();
  kopfStatus();
  render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller)
            dialog('Neue Version', '<p>Eine neue Version der App ist geladen. Jetzt neu starten? (Die Daten bleiben erhalten.)</p>', [{ k: 'x', t: 'Später' }, { k: 'ok', t: 'Neu starten', cls: 'haupt' }]).then(k => { if (k === 'ok') { navigator.serviceWorker.addEventListener('controllerchange', () => location.reload()); nw.postMessage('jetztAktualisieren'); } });
        });
      });
      if (navigator.onLine) reg.update().catch(() => { });
    }).catch(() => { });
  }
}
document.addEventListener('DOMContentLoaded', start);
