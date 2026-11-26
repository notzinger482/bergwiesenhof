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
      { type: 'text', text: `Gesamt ca. ${fmtNum(w.kgGesamt, 0)} kg, davon ${fmtNum(w.pakete)} Genusspakete. Hackfleisch „bis“: mit Gulasch (Kamm/Hals), Bug und höchstens ${fmtNum(siedHackAnteil(S) * 100, 0)} % des Siedfleischs. Innereien/Ochsenschwanz: vorhanden je Tier laut Einstellungen.` },
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
        rows: w.ords.map(o => [nrText(o), o.name, fmtDate(o.eingang), o.wunsch ? fmtDate(o.wunsch) : '', num(o.pakete) || '', bestellText(S, o), ja(w.rind, o.nr), ja(w.bulle, o.nr)]),
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
// =====================================================================
//  Abholtermine (seit 3.5) – Bestellungen auf den Termin, Tier später drüberlegen
// =====================================================================
const terminTxt = x => `Abholtermin ${fmtDate(x.datum)}`;
function viewTermine() {
  titel('Abholtermine');
  const heute = todayISO(), alt = isoOf(new Date(Date.now() - 14 * 864e5));
  const liste = termine(S).filter(x => x.datum >= alt || ordersOfTermin(S, x).some(o => (o.status || 'offen') === 'offen'));
  const zus = (x, f) => x[f] ? `<span class="marke gruen">${esc(zusageText(x, f))}</span>` : '<span class="marke gelb">offen</span>';
  const zeile = x => {
    if (terminAbgeschlossen(S, x)) {
      const at = terminArchivTiere(S, x), ob = terminArchivBestellungen(S, x);
      return `<tr class="klick grau" data-act="oeffnen" data-id="${esc(x.id)}"><td class="fett">${fmtDate(x.datum)}</td><td>${at.map(t => esc(t.name)).join(' + ')} <span class="klein">(Archiv)</span></td><td class="r">${ob.length}</td><td class="r">${fmtNum(ob.reduce((s, o) => s + num(o.pakete), 0))}</td><td colspan="2" class="klein">–</td><td><span class="marke blau">abgeschlossen</span></td><td class="klein">${esc(x.notiz || '')}</td></tr>`;
    }
    const gl = terminTiere(S, x), os = ordersOfTermin(S, x);
    const pak = os.reduce((s, o) => s + num(o.pakete), 0);
    let status = '';
    if (gl.length) { const T = topfAus(S, gl.map(t => t.name)) || gl[0]; const ch = mengencheckT(S, T); const n = os.filter(o => (ch[o.nr] || '').startsWith('reicht') && !o.ueberbelegt).length; status = n ? `<span class="marke rot">${n} reicht nicht</span>` : os.length ? '<span class="marke gruen">ok</span>' : ''; }
    else status = os.length ? '<span class="marke gelb">Tier fehlt – Vorschlag ansehen</span>' : '<span class="klein">noch keine Bestellungen</span>';
    return `<tr class="klick${x.datum < heute ? ' grau' : ''}" data-act="oeffnen" data-id="${esc(x.id)}"><td class="fett">${fmtDate(x.datum)}</td><td>${gl.length ? gl.map(t => `${esc(t.name)} <span class="klein">(${esc(t.typ)}${num(t.sg) ? ', ' + fmtNum(t.sg) + ' kg' : ''})</span>`).join(' + ') : '<span class="klein">noch kein Tier</span>'}</td>
      <td class="r">${os.length}</td><td class="r">${fmtNum(pak)}</td><td>${zus(x, 'zusageSchlachter')}</td><td>${zus(x, 'zusageMetzger')}</td><td>${status}</td><td class="klein">${esc(x.notiz || '')}</td></tr>`;
  };
  const ohne = S.bestellungen.filter(o => o.tier === 'Warteliste' && o.name && !istTerminWarte(o)).length;
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">Abholtermine</h1>${ohne ? `<a class="btn" href="#/warteliste">Warteliste ohne Termin (${ohne})</a>` : ''}<button class="btn" data-act="mehrere">Mehrere anlegen …</button><button class="btn haupt" data-act="neu">+ Neuer Abholtermin</button></div>
    ${(() => { const bis = isoOf(new Date(Date.now() + 80 * 864e5)), letzter = termine(S).filter(x => x.datum >= heute).pop(); return !letzter || letzter.datum < bis ? `<div class="hinweis">Termine reichen nur bis ${letzter ? fmtDate(letzter.datum) : '–'} – bitte Termine für die nächsten ca. 3 Monate anlegen.</div>` : ''; })()}
    <p class="klein" style="margin-top:0">Wir sagen „nächste Woche gibt es Fleisch“: Abholtermin anlegen, Bestellungen darauf legen – das passende Tier kommt später dazu. Die App sagt, wie schwer ein Rind bzw. ein Bulle mindestens sein muss. Unverbindliche Anfragen („melde mich nochmal“) bleiben auf der Warteliste.</p>
    ${liste.length ? `<div class="tabwrap"><table class="tab"><thead><tr><th>Abholung</th><th>Tier(e)</th><th class="r">Bestellungen</th><th class="r">Pakete</th><th>Zusage Schlachter</th><th>Zusage Metzger</th><th>Stand</th><th>Notiz</th></tr></thead><tbody>${liste.map(zeile).join('')}</tbody></table></div>` : '<div class="karte">Noch keine Abholtermine.</div>'}`;
  ui.acts.oeffnen = el => gehe('#/termin/' + encodeURIComponent(el.dataset.id));
  ui.acts.neu = () => terminNeuDialog();
  ui.acts.mehrere = () => termineMehrereDialog();
}
async function terminNeuDialog() {
  const { k, werte } = await dialogFelder('Neuer Abholtermin', `<label class="f">Datum der Abholung<input class="feld" type="date" id="tdat"></label>
    <label class="f" style="margin-top:10px">Notiz <span class="klein">(optional, z. B. „Rind von Hof X“)</span><input class="feld" id="tnot"></label>`, [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Anlegen', cls: 'haupt' }]);
  if (k !== 'ok') return;
  try { const x = terminAnlegen(S, werte.tdat, werte.tnot); speichern(); meldung(`${terminTxt(x)} angelegt.`); gehe('#/termin/' + x.id); }
  catch (e) { meldung(e.message, true); }
}
// Kandidaten zum Vorziehen (seit 3.5, Entscheidung Nutzer 25.11.): wenn ein Tier dazwischenkommt (z. B. Verletzung).
// Nur eine Liste – vorgezogen wird ausschließlich von Hand nach Rücksprache mit dem Kunden (Gefriertruhe, Abholung).
function kandidatenKarte(x) {
  if (!x || x.datum < todayISO()) return '';
  const k = vorziehKandidaten(S, x);
  if (!k.length) return '';
  const zeile = c => `<tr class="${c.passt ? '' : 'grau'}"><td class="r fett">${esc(nrText(c.o))}</td><td class="fett">${esc(c.o.name)}</td><td>${c.o.tel ? `<a href="tel:${esc(c.o.tel)}">${esc(c.o.tel)}</a>` : ''}</td><td>${esc(c.von)}${c.o.wunsch ? `<div class="klein">Wunsch ${fmtDate(c.o.wunsch)}</div>` : ''}</td>
    <td class="r">${num(c.o.pakete) || ''}</td><td class="klein" style="max-width:320px">${esc(kurzText(c.o))}</td><td>${c.passt ? '<span class="marke gruen">passt</span>' : '<span class="marke rot">passt nicht ganz</span>'}</td>
    <td class="r"><button class="btn klein" data-act="vorziehen" data-nr="${c.o.nr}">Vorziehen …</button></td></tr>`;
  const fr = k.filter(c => !c.warte), wl = k.filter(c => c.warte);
  return `<div class="karte"><h3 style="margin-top:0">Kandidaten zum Vorziehen auf ${fmtDate(x.datum)} <span class="klein">– nur nach Rücksprache mit dem Kunden, nie automatisch</span></h3>
    ${fr.length ? `<p class="klein" style="margin:0 0 6px">Bestellungen mit Häkchen „früher möglich“ von späteren Terminen (der Reihe nach). „passt“ = reicht hier allein – nach jedem Vorziehen neu gerechnet.</p>
    <div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Name</th><th>Telefon</th><th>jetzt</th><th class="r">Pakete</th><th>Bestellung</th><th>hier</th><th></th></tr></thead><tbody>${fr.map(zeile).join('')}</tbody></table></div>` : '<p class="klein" style="margin:0">Keine Bestellung mit „früher möglich“ auf späteren Terminen.</p>'}
    ${wl.length ? `<p class="klein" style="margin:10px 0 6px">Warteliste (unverbindliche Anfragen):</p><div class="tabwrap"><table class="tab"><tbody>${wl.map(zeile).join('')}</tbody></table></div>` : ''}</div>`;
}
function kandidatenAktionen(x) {
  ui.acts.vorziehen = async el => {
    const o = S.bestellungen.find(y => y.nr === +el.dataset.nr); if (!o || !x) return;
    const fd = passtAufZiel(S, o, (terminTiere(S, x)[0] || {}).name || 'termin:' + x.id);
    if (!(await frage('Vorziehen', `Nr. ${esc(nrText(o))} – <b>${esc(o.name)}</b>${o.tel ? ' (' + esc(o.tel) + ')' : ''}<br>von <b>${esc(tierText(S, o))}</b> auf den <b>Abholtermin ${fmtDate(x.datum)}</b> vorziehen?<br><br>Mit dem Kunden geklärt (Gefriertruhe, Abholung am ${fmtDate(x.datum)})?${fd && !fd.ok ? '<br><span class="warn">Achtung: reicht hier nicht ganz – ' + esc([...fd.zeilen.map(z => z.art), ...fd.sonst].join(', ')) + '.</span>' : ''}`, 'Ja, geklärt – vorziehen', 'Abbrechen'))) return;
    vorziehen(S, o.nr, x); speichern(); meldung(`Nr. ${nrText(o)} ist jetzt beim Abholtermin ${fmtDate(x.datum)}.`); render();
  };
}
async function termineMehrereDialog() {
  const felder = [1, 2, 3, 4, 5, 6].map(i => `<input class="feld" type="date" id="td${i}" style="max-width:220px">`).join('');
  const { k, werte } = await dialogFelder('Mehrere Abholtermine anlegen', `<p class="klein" style="margin-top:0">Termine für die nächsten ca. 3 Monate – leere Felder werden übersprungen.</p><div class="zeile oben" style="flex-wrap:wrap;gap:8px">${felder}</div>`, [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Anlegen', cls: 'haupt' }]);
  if (k !== 'ok') return;
  const ok = [], fehl = [];
  for (let i = 1; i <= 6; i++) { const d = werte['td' + i]; if (!d) continue; try { terminAnlegen(S, d, ''); ok.push(fmtDate(d)); } catch (e) { fehl.push(e.message); } }
  if (ok.length) speichern();
  meldung((ok.length ? `Angelegt: ${ok.join(', ')}.` : 'Nichts angelegt.') + (fehl.length ? ' ' + fehl.join(' ') : ''), !ok.length && fehl.length > 0);
  render();
}
// Gewichtsvorschlag + Mengenliste als Dokument (teilen/drucken)
function docTermin(x, gv, ml) {
  const gl = terminTiere(S, x);
  const mg = v => v.mindest ? `${v.n > 1 ? v.n + ' × ' : ''}${fmtNum(v.mindest)} kg` : 'reicht nicht';
  const bl = gv ? [{ type: 'h', text: 'Vorschlag Schlachtgewicht' }] : [];
  if (gv) gv.hinweis.forEach((t, i) => bl.push({ type: 'text', text: t, bold: i === 0 }));
  if (gv && gv.anzahl) {
    const R = gv.rind, B = gv.bulle;
    const arts = [...new Set(R.artikel.concat(B.artikel).map(a => a.art))];
    const z = (v, a) => { const r = v.artikel.find(y => y.art === a); return !r ? '' : r.minSG === null ? 'zu viel' : fmtNum(r.minSG) + ' kg'; };
    const best = a => { const r = R.artikel.find(y => y.art === a) || B.artikel.find(y => y.art === a); return r && r.bestellt !== null ? fmtNum(r.bestellt, 1) + ' kg' : ''; };
    bl.push({ type: 'table', head: ['Artikel', 'bestellt (mit Paketen)', `Rind braucht mind.${R.n > 1 ? ' (je Tier, ' + R.n + ' Tiere)' : ''}`, `Bulle braucht mind.${B.n > 1 ? ' (je Tier, ' + B.n + ' Tiere)' : ''}`], align: ['', 'r', 'r', 'r'],
      rows: arts.map(a => [a, best(a), z(R, a), z(B, a)]).concat([['Mindest-Schlachtgewicht', '', mg(R), mg(B)]]),
      rowClass: arts.map(a => R.grenze.includes(a) || B.grenze.includes(a) ? 'fett' : '').concat(['fett']) });
    const st = [...new Set(R.stueck.concat(B.stueck))];
    if (st.length) bl.push({ type: 'text', warn: true, text: 'Für ein Tier zu viele Stücke: ' + st.join('; ') + '.' });
    bl.push({ type: 'text', text: `Gerechnet wie der Mengencheck: Genusspakete zuerst, dann die Bestellungen der Reihe nach. Hackfleisch darf nicht bestelltes Gulasch, den Bug und zuletzt höchstens ${fmtNum(siedHackAnteil(S) * 100, 0)} % des Siedfleischs aufbrauchen – falsches Filet und Keule bleiben Braten. Innereien und Ochsenschwanz sind nicht dabei.` });
  }
  if (ml) {
    bl.push({ type: 'h', text: `Mengenliste – ${ml.n > 1 ? ml.n + ' × ' : ''}${ml.typ} mit ${fmtNum(ml.sgJe)} kg Schlachtgewicht` });
    bl.push({ type: 'table', head: ['Artikel', 'aus dem Tier ca.', 'bestellt', 'frei', 'fehlt', 'reicht ab'], align: ['', 'r', 'r', 'r', 'r', 'r'],
      rows: ml.rows.map(r => [r.art, fmtNum(r.ausbeute, 1) + ' kg', r.gesamt > 0 ? fmtNum(r.gesamt, 1) + ' kg' : '', fmtNum(Math.max(0, r.frei), 1) + ' kg', r.fehlt > 0.001 ? '−' + fmtKgFehl(r.fehlt) : '', r.minSG ? fmtNum(r.minSG) + ' kg SG' : r.gesamt > 0 && r.minSG === null ? 'zu viel' : '']),
      ...(ml.mindest ? {} : { head: ['Artikel', 'aus dem Tier ca.', 'bestellt', 'frei', 'fehlt', ''] }),
      rowClass: ml.rows.map(r => r.fehlt > 0.001 ? 'rot' : '') });
    const rs = ml.reserven, teile = [];
    if (rs.gulasch > 0.05) teile.push(`${fmtNum(rs.gulasch, 1)} kg Gulasch (Kamm/Hals)`);
    if (rs.bug > 0.05) teile.push(`${fmtNum(rs.bug, 1)} kg Bug`);
    if (rs.sied > 0.05) teile.push(`${fmtNum(rs.sied, 1)} kg Siedfleisch (höchstens ${fmtNum(rs.siedReserve, 1)} kg möglich)`);
    bl.push({ type: 'text', text: teile.length ? 'Fürs Hack aufgelöst: ' + teile.join(', ') + '.' : 'Hack reicht ohne Gulasch, Bug oder Siedfleisch.' });
    bl.push({ type: 'text', text: `Hack „aus dem Tier“: mit den Reserven, die noch frei sind. Verkauft ca. ${fmtNum((ml.summen.gesamt.quote || 0) * 100, 0)} % (Fleisch + Knochen), Rest ca. ${fmtNum(Math.max(0, ml.summen.gesamt.frei), 0)} kg → Hofladen.` });
    if (ml.stueck.length) bl.push({ type: 'text', warn: true, text: 'Reicht bei dieser Anzahl Tiere nicht: ' + ml.stueck.join('; ') + '.' });
    bl.push({ type: 'h', text: `Bestellungen (${ords0(x).length})` });
  } else bl.push({ type: 'h', text: `Bestellungen (${ords0(x).length})` });
  // Bestellungen des Termins sortierbar (seit 3.5.5, Wunsch Nutzer) – Standard: Reihenfolge der Zuteilung
  const ST = ui.sortT = ui.sortT || { k: 'rang', d: 1 };
  const chk = o => { const c = ml ? ml.checks[o.nr] || '' : ''; return c.startsWith('reicht') ? 0 : c === 'ok' ? 2 : 1; };
  const os = sortiere(ords0(x), ST, (o, k) => k === 'rang' ? rangVon(o) : k === 'nr' ? (o.teilVon || o.nr) + (o.teilVon ? (o.teilNr || 2) / 1000 : 0) : k === 'name' ? o.name || '' : k === 'wunsch' ? o.wunsch || '' : k === 'pakete' ? num(o.pakete) : k === 'probe' ? chk(o) : k === 'kg' ? einzelKg(S, o) + num(o.pakete) * paketGewicht(S) : '');
  bl.push({ type: 'table', head: ['Nr.', 'Name', 'Wunsch', 'Pakete', 'Bestellung'].concat(ml ? ['Probe'] : []), align: ['r', '', '', 'r', ''], sort: { st: ST, keys: ['nr', 'name', 'wunsch', 'pakete', 'kg', 'probe'] },
    rows: os.map(o => [nrText(o), o.name, o.wunsch ? fmtDate(o.wunsch) : '', num(o.pakete) || '', bestellText(S, o)].concat(ml ? [ml.checks[o.nr] || ''] : [])),
    rowClass: os.map(o => ml && (ml.checks[o.nr] || '').startsWith('reicht') ? 'rot' : '') });
  const anz = os.length, pak = os.reduce((s, o) => s + num(o.pakete), 0);
  return { title: `${terminTxt(x)}${gl.length ? ' – ' + gl.map(t => t.name).join(' + ') : ' – Tier gesucht'}`, sub: [`Stand ${fmtDate(todayISO())} · ${anz} Bestellung${anz === 1 ? '' : 'en'} · ${fmtNum(pak)} Genusspakete${x.notiz ? ' · ' + x.notiz : ''}`], blocks: bl, footer: fussZeile() };
}
const ords0 = x => ordersOfTermin(S, x);
const fmtKgFehl = kg => fehlKgText(kg);
function viewTermin(id) {
  const x = terminById(S, id);
  if (!x) { inhalt().innerHTML = '<div class="fehlerbox">Abholtermin nicht gefunden.</div>'; return; }
  titel(terminTxt(x));
  if (terminAbgeschlossen(S, x)) {
    const at = terminArchivTiere(S, x), ob = terminArchivBestellungen(S, x);
    inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">${terminTxt(x)} <span class="marke blau" style="font-size:15px">abgeschlossen</span></h1><a class="btn" href="#/termine">Alle Termine</a></div>
      <div class="karte"><p style="margin-top:0">Alle Tiere dieses Termins sind abgeschlossen und im Archiv.</p>
      <p>${at.map(t => `<a href="#/tier/${encodeURIComponent(t.name)}"><b>${esc(t.name)}</b></a> – ${esc(t.typ)}${num(t.sg) ? ', ' + fmtNum(t.sg) + ' kg' : ''}`).join('<br>')}</p>
      <p>${ob.length} Bestellungen · ${fmtNum(ob.reduce((s, o) => s + num(o.pakete), 0))} Genusspakete · Zusage Schlachter ${esc(zusageText(x, 'zusageSchlachter'))} · Zusage Metzger ${esc(zusageText(x, 'zusageMetzger'))}</p>
      <label class="f">Notiz<input class="feld" data-ch="tnotiz" value="${esc(x.notiz || '')}"></label></div>`;
    ui.acts.tnotiz = el => { x.notiz = el.value.trim(); speichern(); meldung('Notiz gespeichert.'); };
    return;
  }
  const gl = terminTiere(S, x), ords = ordersOfTermin(S, x);
  ui.terminProbe = ui.terminProbe || {};
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">${terminTxt(x)}</h1><a class="btn" href="#/termine">Alle Termine</a></div><div id="tinhalt"><div class="karte">wird berechnet …</div></div>`;
  // Rechnen kann auf dem Tablet etwas dauern – Seite erst zeigen
  setTimeout(() => { if (location.hash.startsWith('#/termin/') && $('#tinhalt')) terminInhalt(x, gl, ords); }, 30);
}
// Gewichtsvorschlag merken, solange sich Bestellungen/Einstellungen nicht ändern (seit 3.5.4 – auf dem Tablet sonst Sekunden je Klick)
function gvGemerkt(x, gl, ords) {
  const sig = JSON.stringify([ords.map(o => [o.nr, rangVon(o), o.pos, o.sonder, o.pakete]), gl.map(t => [t.name, t.typ, t.sg]), S.settings, S.artikel.map(a => [a.anteil, a.anteilRind, a.stueckG, a.beutelG]), statSig(S)]);
  ui.gvCache = ui.gvCache || {};
  const c = ui.gvCache[x.id];
  if (c && c.sig === sig) return c.gv;
  const gv = gewichtsvorschlag(S, ords, gl.length || 1);
  ui.gvCache[x.id] = { sig, gv };
  return gv;
}
function terminInhalt(x, gl, ords) {
  // Termin mit Tier: Gewichtsvorschlag nur auf Knopfdruck (das Tier steht ja schon fest) – Seite öffnet sofort
  ui.gvZeigen = ui.gvZeigen || {};
  const mitGv = !gl.length || ui.gvZeigen[x.id];
  const gv = mitGv ? gvGemerkt(x, gl, ords) : null;
  // Probe: Vorgabe = Tiere des Termins, sonst der Vorschlag (Rind, wenn ein übliches Rind reicht, sonst Bulle)
  let p = ui.terminProbe[x.id];
  if (!p && !gv) p = { typ: gl[0].typ === 'Bulle' ? 'Bulle' : 'Rind', sg: Math.round(gl.reduce((s, t) => s + sgRechnung(S, t), 0) / gl.length), n: gl.length };
  if (!p) {
    const R = gv.rind, B = gv.bulle;
    const v = R.mindest && R.n === 1 && R.mindest <= R.std * 1.15 ? R : B.mindest ? B : R;
    p = gl.length ? { typ: gl[0].typ === 'Bulle' ? 'Bulle' : 'Rind', sg: Math.round(gl.reduce((s, t) => s + sgRechnung(S, t), 0) / gl.length), n: gl.length }
      : { typ: v.typ, sg: Math.max(v.mindest ? Math.ceil(v.mindest / 5) * 5 : 0, v.typ === 'Bulle' ? num(S.settings.sgBulle) : num(S.settings.sgRind)), n: v.n || 1 }; // übliches Tier, schwerer nur wenn nötig
  }
  const mgP = !gv ? false : (p.typ === 'Bulle' ? gv.bulle : gv.rind);
  const ml = ords.length ? terminMengenliste(S, ords, p.typ, p.sg, p.n, mgP) : null;
  const doc = docTermin(x, gv, ml);
  const freieTiere = tiereSortiert().filter(t => !gl.includes(t) && !kistenRows(S, t.name).length);
  const vorschlagTyp = !gv ? '' : (gv.rind.mindest && gv.rind.n === 1 && gv.rind.mindest <= gv.rind.std * 1.15) ? 'Rind' : 'Bulle';
  $('#tinhalt').innerHTML = `<div class="spalten2"><div class="karte"><h3 style="margin-top:0">Termin</h3>
      <div class="zeile oben"><label class="f" style="width:200px">Datum<input class="feld" type="date" data-ch="tdatum" value="${esc(x.datum)}"></label><label class="f platz">Notiz<input class="feld" data-ch="tnotiz" value="${esc(x.notiz || '')}"></label></div>
      <div class="zeile oben" style="margin-top:10px;gap:18px">${[['zusageSchlachter', 'Zusage Schlachter'], ['zusageMetzger', 'Zusage Metzger']].map(([f, t]) => `<label class="zeile" style="gap:8px;align-items:center"><input type="checkbox" style="width:26px;height:26px;accent-color:var(--gruen-d)" data-ch="zusage" data-f="${f}"${x[f] ? ' checked' : ''}> <b>${t}</b> <span class="klein">${x[f] ? 'am ' + fmtDate(x[f]) : 'offen'}</span></label>`).join('')}</div>
      <div class="knopfleiste" style="margin-top:10px"><a class="btn haupt" href="#/neu?termin=${encodeURIComponent(x.id)}">+ Bestellung für diesen Termin</a><a class="btn" href="#/bestellungen" data-act="liste">Bestellliste</a>${gl.length ? '' : '<button class="btn rot" data-act="loeschen">Termin löschen</button>'}</div></div>
    <div class="karte"><h3 style="margin-top:0">Tier${gl.length > 1 ? 'e' : ''}</h3>
      ${gl.length ? `<p style="margin-top:0">${gl.map(t => `<a href="#/tier/${encodeURIComponent(t.name)}"><b>${esc(t.name)}</b></a> – ${esc(t.typ)}, ${fmtNum(sgRechnung(S, t))} kg${num(t.sg) ? '' : ' (Standard)'}`).join('<br>')}</p><div class="knopfleiste"><a class="btn" href="#/schlachttag/menge?tier=${encodeURIComponent(gl[0].name)}">Mengenprüfung</a></div>` : `<p class="klein" style="margin-top:0">Noch kein Tier. Vorschlag: <b>${vorschlagTyp}</b> – Mindestgewicht siehe unten.</p>`}
      <div class="zeile oben" style="margin-top:8px"><label class="f platz">${gl.length ? 'weiteres Tier dazunehmen' : 'vorhandenes Tier zuordnen'}<select class="feld" id="tzu">${opt('', '– Tier wählen –', true)}${freieTiere.map(t => opt(t.name, `${t.name} (${t.typ}${num(t.sg) ? ', ' + fmtNum(t.sg) + ' kg' : ''})${t.abhol ? ' – bisher ' + fmtDate(t.abhol) : ' – ohne Termin'}`, false)).join('')}</select></label><button class="btn" data-act="zuordnen" style="margin-top:22px">Zuordnen</button></div>
      <div class="knopfleiste" style="margin-top:6px"><a class="btn" href="#/tier/neu?abhol=${encodeURIComponent(x.datum)}&typ=${encodeURIComponent(p.typ)}">+ Neues Tier für diesen Termin</a></div></div></div>
    ${ords.length ? `<div class="karte"><h3 style="margin-top:0">Probe-Tier <span class="klein">– Gewicht eintippen und sehen, ob es reicht</span></h3><div class="zeile oben">
      <label class="f" style="width:140px">Typ<select class="feld" data-ch="ptyp">${['Rind', 'Bulle'].map(v => opt(v, v, p.typ === v)).join('')}</select></label>
      <label class="f" style="width:200px">Schlachtgewicht je Tier (kg)<input class="feld zahl" inputmode="decimal" data-ch="psg" value="${fmtIn(p.sg)}"></label>
      <label class="f" style="width:140px">Anzahl Tiere<select class="feld" data-ch="pn">${[1, 2, 3, 4].map(v => opt(v, v, p.n === v)).join('')}</select></label>
      <div style="margin-top:22px" class="knopfleiste">${gv ? '<button class="btn" data-act="pmin" data-t="Rind">Rind mit Mindestgewicht</button><button class="btn" data-act="pmin" data-t="Bulle">Bulle mit Mindestgewicht</button>' : '<button class="btn" data-act="gvzeigen">Gewichtsvorschlag rechnen …</button>'}</div></div>
      ${ml ? `<p class="${ml.nicht.length || ml.stueck.length ? 'warn' : 'ok'}" style="margin:6px 0 0">${ml.nicht.length || ml.stueck.length ? `Reicht nicht für ${ml.nicht.length} Bestellung${ml.nicht.length === 1 ? '' : 'en'}${ml.nicht.length ? ': ' + ml.nicht.map(n => 'Nr. ' + (n.nrT || n.nr)).join(', ') : ''}` : 'Reicht für alle Bestellungen.'}</p>` : ''}</div>` : ''}
    ${kandidatenKarte(x)}${knopfTeilen()}${docHtml(doc)}`;
  kandidatenAktionen(x);
  const neuRechnen = () => { ui.terminProbe[x.id] = p; terminInhalt(x, gl, ords); };
  ui.acts.ptyp = el => { p = Object.assign({}, p, { typ: el.value }); neuRechnen(); };
  ui.acts.psg = el => { const v = num(el.value); if (!(v > 0)) return meldung('Bitte ein Schlachtgewicht in kg eintragen.', true); p = Object.assign({}, p, { sg: v }); neuRechnen(); };
  ui.acts.pn = el => { p = Object.assign({}, p, { n: +el.value || 1 }); neuRechnen(); };
  ui.acts.gvzeigen = () => { ui.gvZeigen[x.id] = true; $('#tinhalt').insertAdjacentHTML('afterbegin', '<div class="hinweis">Gewichtsvorschlag wird berechnet …</div>'); setTimeout(() => terminInhalt(x, gl, ords), 30); };
  ui.acts.pmin = el => { const v = el.dataset.t === 'Bulle' ? gv.bulle : gv.rind; if (!v.mindest) return meldung(`Mit bis zu 4 ${el.dataset.t === 'Bulle' ? 'Bullen' : 'Rindern'} reicht es nicht.`, true); p = { typ: v.typ, sg: v.mindest, n: v.n }; neuRechnen(); };
  ui.acts.liste = () => { ui.filter.tier = 'termin:' + x.id; ui.filter.archiv = false; gehe('#/bestellungen'); };
  ui.acts.tnotiz = el => { x.notiz = el.value.trim(); speichern(); meldung('Notiz gespeichert.'); };
  // Zusage: nur speichern und den Text daneben ändern – nichts neu rechnen (seit 3.5.4; vorher Sekunden je Haken, zweiter Haken ging verloren)
  ui.acts.docsort = el => { sortKlick(ui.sortT, el.dataset.k, ['pakete', 'kg']); terminInhalt(x, gl, ords); };
  ui.acts.zusage = el => { zusageSetzen(S, x.id, el.dataset.f, el.checked); speichern(); const k = el.parentElement.querySelector('.klein'); if (k) k.textContent = el.checked ? 'am ' + fmtDate(x[el.dataset.f]) : 'offen'; meldung(el.checked ? 'Zusage eingetragen.' : 'Zusage entfernt.'); };
  ui.acts.tdatum = async el => {
    const neu = el.value; if (!neu || neu === x.datum) return;
    if (!(await frage('Datum ändern', `Abholtermin von ${fmtDate(x.datum)} auf <b>${fmtDate(neu)}</b> verlegen?${gl.length ? ' Die Tiere des Termins gehen mit.' : ''} Alle Bestellungen bleiben auf dem Termin.`, 'Verlegen', 'Abbrechen'))) { el.value = x.datum; return; }
    try {
      const unpass = terminDatumAendern(S, x.id, neu); speichern();
      if (unpass.length) await dialog('Wunschtermine prüfen', `<p>Der Termin ist verlegt. Bei diesen Bestellungen passt der neue Termin nicht mehr zum Wunschtermin (danach oder mehr als ${fmtNum(has(S.settings.verteilenMaxTage) ? num(S.settings.verteilenMaxTage) : 5)} Tage davor):</p><p>${unpass.map(o => `Nr. ${nrText(o)} – ${esc(o.name)} (Wunsch ${fmtDate(o.wunsch)})`).join('<br>')}</p><p class="klein">Bitte mit den Kunden klären oder die Bestellungen auf einen anderen Termin legen.</p>`);
      else meldung('Termin verlegt.');
      render();
    } catch (e) { el.value = x.datum; meldung(e.message, true); }
  };
  ui.acts.loeschen = async () => {
    const n = ords.length;
    if (!(await frage('Termin löschen', `${terminTxt(x)} löschen?${n ? ` ${n} Bestellung${n === 1 ? '' : 'en'} kommen auf die Warteliste (ohne Termin).` : ''}`, 'Löschen', 'Abbrechen', 'rot'))) return;
    terminLoeschen(S, x.id); speichern(); gehe('#/termine');
  };
  ui.acts.zuordnen = async () => {
    const tn = $('#tzu').value; if (!tn) return meldung('Bitte ein Tier wählen.', true);
    const t = tier(S, tn);
    const alt = t.abhol ? ordersOfTier(S, t.name).length : 0;
    if (!(await frage('Tier zuordnen', `<b>${esc(t.name)}</b> (${esc(t.typ)}${num(t.sg) ? ', ' + fmtNum(t.sg) + ' kg' : ''}) zum ${terminTxt(x)} nehmen?${t.abhol && t.abhol !== x.datum ? ` Bisheriger Abholtermin ${fmtDate(t.abhol)}${alt ? ` – seine ${alt} Bestellung${alt === 1 ? ' geht' : 'en gehen'} mit` : ''}.` : ''}${gl.length ? ` Das Tier läuft dann mit ${gl.map(y => esc(y.name)).join(' + ')} wie ein Topf.` : ''}`, 'Zuordnen', 'Abbrechen'))) return;
    try {
      const geb = terminTierZuordnen(S, x.id, tn); termineAbgleichen(S); speichern();
      meldung(`${t.name} ist beim ${terminTxt(x)}${geb.length ? ` – ${geb.length} Bestellung${geb.length === 1 ? '' : 'en'} jetzt bei ${t.name}` : ''}.`);
      delete ui.terminProbe[x.id]; render();
    } catch (e) { meldung(e.message, true); }
  };
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
// Stückzahl ca. aus kg über die Einzelgewichte (Einstellungen → Ausbeute & Kisten), seit 3.5.2 (Wunsch Nutzer): „Ausbeute / frei“
function stkCa(r) {
  const g = einzelGewicht(S, r.art), a = art(S, r.art); if (!(g > 0)) return '';
  const eh = num(a && a.beutelG) > 0 ? ' Btl' : '';
  const n = kg => Math.floor(kg * 1000 / g + 1e-9);
  const frei = r.frei >= 0 ? n(r.frei) : -Math.ceil(-r.frei * 1000 / g - 1e-9);
  return `${n(r.ausbeuteStd)} / ${frei < 0 ? '−' + (-frei) : frei}${eh}`;
}
function docMenge(mp) {
  const t = mp.tier, i = mp.info;
  return { title: `Mengenprüfung – ${t.name}`, sub: [`${t.typ} · ${fmtNum(i.sg)} kg SG · ${abholTxt(t)}`, `Pakete bestellt ${fmtNum(i.pakete)} / frei ${fmtNum(i.frei)} · ${i.anzahl} Bestellungen · reicht nicht: ${i.reichtNicht}`],
    blocks: [{ type: 'table', head: ['Teilstück', 'Ausbeute ca.', 'einzeln', 'in Paketen', 'gesamt', 'noch frei', 'Stk ca. (Ausbeute / frei)', 'Auslastung', 'Status'], align: ['', 'r', 'r', 'r', 'r', 'r', 'r', 'r', ''], widths: [3, 2, 2, 2, 2, 2, 2.4, 2, 2.4],
      rows: mp.rows.map(r => [r.art, r.ausbeute > r.ausbeuteStd + 0.05 ? `${fmtNum(r.ausbeuteStd, 1)} (bis ${fmtNum(r.ausbeute, 1)})` : fmtNum(r.ausbeute, 1), fmtNum(r.einzel, 1), fmtNum(r.ausPak, 1), fmtNum(r.gesamt, 1), fmtNum(r.frei, 1), stkCa(r), r.auslastung === null ? '' : fmtNum(r.auslastung * 100, 0) + ' %', r.status]),
      rowClass: mp.rows.map(r => r.status === 'reicht nicht' ? 'rot' : '') },
      ...mengenSummen(mp),
      { type: 'text', text: 'Genusspakete haben Vorrang, danach Einzelartikel in der Reihenfolge, in der die Bestellungen dem Tier zugeordnet wurden. Ausbeute = Richtwerte, „knapp“ = über 90 % vergeben. Innereien werden nicht geprüft. Stk ca. = kg ÷ Einzelgewicht aus den Einstellungen (abgerundet).' }]
      .concat(mp.rows.some(r => r.ausbeute > r.ausbeuteStd + 0.05) ? [{ type: 'text', text: `Hackfleisch „bis“: normale Hack-Ausbeute; wenn nötig zusätzlich nicht bestelltes Gulasch, der Bug und zuletzt höchstens ${fmtNum(siedHackAnteil(S) * 100, 0)} % des nicht bestellten Siedfleischs (wird dann im Metzgerauftrag aufgelöst).` }] : []), footer: fussZeile() };
}
function docMetzger(ma) {
  const t = ma.tier;
  // feste Hinweise oben (seit 3.5.2, Wunsch Nutzer 25.11.)
  const bl = [{ type: 'text', bold: true, text: 'Oberschale komplett in Rouladen.' },
    { type: 'text', bold: true, text: 'Bratenstücke parieren, aber nicht küchenfertig schneiden (außer Sonderwünsche unten).' },
    { type: 'text', bold: true, text: `Reicht das Hackfleisch nicht für die ${fmtNum(ma.hack.vorgabe)} kg: übriges Gulasch${ma.gulasch.bestelltKiste > 0.05 ? ` (über die bestellten ${fmtNum(ma.gulasch.bestelltKiste, 1)} kg hinaus)` : ''} zu Hackfleisch machen.` },
    { type: 'h', text: 'Gesamtmengen' },
    { type: 'kv', rows: [['Hackfleisch', `${fmtNum(ma.hack.vorgabe)} kg`, [ma.hack.kistenText ? `(${ma.hack.kistenText})` : '', `davon bestellt ${fmtNum(ma.hack.bestelltKiste, 1)} kg (ohne Sonderwünsche)`].filter(Boolean).join(' – ')], ['Gulasch', ma.gulasch.vorgabe > 0 ? `${fmtNum(ma.gulasch.vorgabe)} kg` : '–', ma.gulasch.vorgabe > 0 ? `(erwartet) – davon bestellt ${fmtNum(ma.gulasch.bestelltKiste, 1)} kg${ma.gulasch.mitSonder ? ' (ohne Sonderwünsche)' : ''}` : '']]
      .concat(ma.waden > 0 ? [['Waden am Stück', `${fmtNum(ma.waden)} Stück`, 'nicht zu Beinscheiben schneiden – Nr. siehe unten']] : [])
      .concat(ma.ochs.ganz > 0 ? [['Ochsenschwanz', `${fmtNum(ma.ochs.ganz)} Stück ganz lassen`, `kommt zu den Beinscheiben in die Kiste – ${ma.ochs.ganzListe.map(x => 'Nr. ' + (x.nrT || x.nr)).join(', ')}`]] : [])
      .concat(ma.ochs.bestellt > ma.ochs.vorhanden ? [['Ochsenschwanz', `ACHTUNG: ${fmtNum(ma.ochs.bestellt)} Stück bestellt`, `aber nur ca. ${fmtNum(ma.ochs.vorhanden)}${t.glieder ? ' bei ' + t.name : ' je Tier'}`]] : []) }];
  if (ma.gulasch.insHack > 0.05) bl.push({ type: 'text', text: `Kein Gulasch bestellt: ca. ${fmtNum(ma.gulasch.insHack, 0)} kg Kamm/Hals ins Hackfleisch.` });
  if (ma.siedInsHack > 0.05) bl.push({ type: 'text', text: `Siedfleisch: ca. ${fmtNum(ma.siedInsHack, 0)} kg ins Hackfleisch (Hack reicht sonst nicht).` });
  bl.push({ type: 'text', text: (ma.waden > 0 ? 'Übrige Hesse als Beinscheiben. ' : 'Hesse wie immer als Beinscheiben. ') + 'Alle übrigen Stücke bitte wie gewohnt zuschneiden.' },
    { type: 'h', text: 'Sonderfälle – separat vorbereiten, bitte mit der Bestell-Nr. beschriften' + (ma.mitPlan ? ' und in die angegebene Kiste legen' : '') },
    // seit 3.7 (Kisten von Hand): Spalte „Kiste“ nur, wenn Sonderfälle schon einer Kiste zugeordnet sind – vorher weiß das keiner
    ma.mitPlan ? { type: 'table', head: ['Nr.', 'Artikel', 'Menge', 'Hinweis', 'Kiste'], widths: [1.2, 3.4, 1.8, 5.2, 1.2], align: ['r', '', 'r', '', 'r'],
      rows: ma.separat.map(s => [s.nrT || s.nr, s.art, s.menge, s.hinweis, s.kiste ? String(s.kiste) : istOrgan(s.art) ? 'Innereien' : '–']), leer: '– keine –' }
      : { type: 'table', head: ['Nr.', 'Artikel', 'Menge', 'Hinweis'], widths: [1.2, 3.4, 1.8, 6.4], align: ['r', '', 'r', ''],
      rows: ma.separat.map(s => [s.nrT || s.nr, s.art, s.menge, s.hinweis]), leer: '– keine –' });
  if (t.glieder) bl.unshift({ type: 'text', bold: true, text: `Gemeinsame Abholung: ${t.name} (zusammen ca. ${fmtNum(t.sg)} kg Schlachtgewicht) – Mengen für alle Tiere zusammen, die Stücke müssen nicht nach Tieren getrennt werden.` });
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
function docKisten(tn, calc, tG) {
  const t = tG || tier(S, tn), mehr = calc.some(c => c.tier && c.tier !== calc[0].tier);
  const vor = c => mehr ? c.tier + ': ' : '';
  return { title: `Kisten – ${tn}`, sub: [t ? abholTxt(t) : ''],
    blocks: [{ type: 'table', head: ['Kiste', 'Inhalt', 'kg', 'Stellplatz', 'Bedarf ges.', 'verplant', 'Rest', 'Teilstücke'], widths: [1, 2.6, 1.1, 2.4, 1.4, 1.3, 1.1, 4], align: ['r', '', 'r', '', 'r', 'r', 'r', ''],
      rows: calc.map(c => c.k.art === OCHS ? [c.k.nr, vor(c) + c.k.art, fmtNum(c.k.kg, 0) + ' Stk' + (has(c.k.gew) ? ' · ' + fmtNum(c.k.gew, 2) + ' kg' : ''), c.k.platz || '', fmtNum(c.bedarf, 0) + ' Stk', fmtNum(c.verplant, 0) + ' Stk', fmtNum(c.rest, 0) + ' Stk', c.k.info ? c.k.info + ' (am Stück bestellt)' : 'wird geschnitten'] : [c.k.nr, vor(c) + c.k.art, fmtNum(c.k.kg, 1), c.k.platz || '', ...(c.k.art === SONDERKISTE ? ['–', '–', '–'] : [fmtNum(c.bedarf, 1), fmtNum(c.verplant, 1), fmtNum(c.rest, 1)]), c.teile || '']) }], footer: fussZeile() };
}
function docHack(hz) {
  return { title: `Hackfleisch-Zettel – ${hz.tier.name}`, sub: [abholTxt(hz.tier), `Summe einzeln ${fmtNum(hz.sumEinzeln, 2)} kg · aus Paketen ${fmtNum(hz.sumPak, 1)} kg`],
    blocks: [{ type: 'text', text: 'Unabhängig von den Bestellungen vorab verpacken; Tüten mit Bestell-Nr. und Namen beschriften. Mageres Hack (Sonderfall) kommt separat vom Metzger.' },
      { type: 'table', head: ['Nr.', 'Name', 'EINZELN kg', 'verpacken als', 'vak.?', 'Pakete', 'aus PAKET kg', 'verpacken als', 'vak.?', '✓'], widths: [0.8, 2.6, 1.2, 2, 1.2, 0.9, 1.2, 1.6, 2, 0.6], align: ['r', '', 'r', '', '', 'r', 'r', '', '', ''],
        rows: hz.rows.map(r => [r.nrT || r.nr, r.name, fmtNum(r.einzeln, 3), r.einzelnAls, r.einzelnVak, r.pakete || '', fmtNum(r.ausPak, 1), r.ausPakAls, r.pakVak, r.ok ? '✓' : '☐'])
          .concat(hz.hof.text ? [['', 'HOFLADEN', fmtNum(hz.hof.rest, 1), hz.hof.text, 'VAKUUM', '', '', '', '', hz.hof.ok ? '✓' : '☐']] : []),
        rowClass: hz.rows.map(r => r.ok ? 'erledigt' : '').concat(hz.hof.text ? [hz.hof.ok ? 'erledigt' : 'fett'] : []), abhaken: 'hack' },
      { type: 'text', text: hz.hof.text ? `Hofladen: übriges Hack nach allen Bestellungen – Hack ${hz.hof.gewogen ? 'gewogen' : 'geplant'} ${fmtNum(hz.hof.gesamt, 1)} kg − bestellt ${fmtNum(hz.sumEinzeln + hz.sumPak, 1)} kg = ${fmtNum(hz.hof.rest, 1)} kg, alles vakuumieren (${fmtNum(has(S.settings.hackHof500Prozent) ? num(S.settings.hackHof500Prozent) : 50, 0)} % in 500-g-Päckchen, Rest 1 kg).` : (hz.hof.rest < -0.25 ? `Achtung: bestellt ist ${fmtNum(-hz.hof.rest, 1)} kg mehr Hack, als in den Kisten ist.` : 'Kein Hack für den Hofladen übrig.') }], footer: fussZeile() };
}
// Eingabe „Nach dem Zuschnitt“ über dem Innereien-Zettel (leer = Schätzwert)
function innZuschnittKarte(ii) {
  return `<div class="karte"><h3 style="margin-top:0">Nach dem Zuschnitt <span class="klein">– was wirklich da ist (leer lassen = Schätzwert)</span></h3><div class="zeile oben">
    ${ii.uebersicht.map(u => `<label class="f" style="width:150px">${esc(u.art)} (${u.einheit === 'kg' ? 'kg gewogen' : 'Stück'})<input class="feld zahl" inputmode="decimal" data-ch="innist" data-f="${esc(u.art)}" value="${u.gewogen ? fmtIn(u.vorhanden, 2) : ''}" placeholder="ca. ${fmtNum(u.schaetz, 2)}"></label>`).join('')}
    </div><p class="klein" style="margin:4px 0 0">Unbrauchbares (z. B. eine ganze Leber) einfach weglassen. Beim Herz zählt nur die Stückzahl – abgerechnet wird beim Abholen nach Gewicht.</p></div>`;
}
// Tabellen eines Zettels zum Abhaken klickbar machen: listen = { hack|inn|innrest: [Schlüssel je Zeile] }
function abhakenAn(ziel, listen) {
  const tabs = [...ziel.querySelectorAll('table.doc-tab')];
  // seit 3.4: Hinweis sichtbar (Tooltip gibt es am Tablet nicht)
  if (tabs.length && !ziel.querySelector('.abhakhinweis')) { const d = ziel.querySelector('.doc'); if (d) d.insertAdjacentHTML('beforebegin', '<p class="klein abhakhinweis">Zeile antippen = erledigt ✓ · nochmal antippen = wieder offen</p>'); }
  const reihen = { innrest: tabs.length > 1 ? tabs[0] : null, inn: tabs[tabs.length - 1], hack: tabs[tabs.length - 1] };
  for (const [art, keys] of Object.entries(listen)) {
    const tab = reihen[art]; if (!tab) continue;
    [...tab.querySelectorAll('tbody tr')].forEach((tr, i) => { if (keys[i] === undefined) return; tr.classList.add('klick'); tr.dataset.act = 'abhaken'; tr.dataset.abh = art; tr.dataset.key = keys[i]; tr.title = 'antippen = erledigt / wieder offen'; });
  }
}
function docInnereien(ii) {
  return { title: `Innereien – ${ii.tier.name}`, sub: [abholTxt(ii.tier)],
    blocks: [{ type: 'text', text: 'Erst die Bestellungen bedienen, dann den Rest verarbeiten. Tüten mit Bestell-Nr. und Namen beschriften.' },
      { type: 'table', head: ['Innerei', 'vorhanden', 'bestellt', 'Rest', 'Rest verarbeiten', '✓'], widths: [2, 1.8, 1.2, 1.1, 3.9, 0.5], align: ['', 'r', 'r', 'r', '', ''],
        rows: ii.uebersicht.map(u => [u.art, (u.gewogen ? '' : 'ca. ') + fmtNum(u.vorhanden, 2) + ' ' + u.einheit + (u.gewogen ? (u.einheit === 'kg' ? ' gewogen' : ' gezählt') : ''), fmtNum(u.bestellt, 3), fmtNum(u.rest, 3), u.txt, u.ok ? '✓' : '☐']), rowClass: ii.uebersicht.map(u => u.rest < -1e-9 ? 'rot' : u.ok ? 'erledigt' : ''), abhaken: 'innrest' },
      { type: 'h', text: 'Bestellungen' },
      { type: 'table', head: ['Nr.', 'Name', 'Leber kg', 'Leber verpacken', 'Nieren', 'Herz', 'Zunge', 'Bäckle', 'vakuumieren', '✓'], widths: [0.8, 2.6, 1, 1.7, 0.9, 0.8, 0.8, 0.9, 1.7, 0.5], align: ['r', '', 'r', '', 'r', 'r', 'r', 'r', '', ''],
        rows: ii.rows.map(r => [r.nrT || r.nr, r.name + (Object.keys(r.fehlt).length ? '\nfehlt: ' + Object.entries(r.fehlt).map(([n, q]) => n + ' ' + (n === 'Leber' ? fmtNum(q, 2) + ' kg' : fmtNum(q) + ' Stk')).join(', ') : ''), fmtNum(r.leber, 3), r.leberAls, r.nieren || '', r.herz || '', r.zunge || '', r.baeckle || '', r.vak, r.ok ? '✓' : '☐']), rowClass: ii.rows.map(r => r.ok ? 'erledigt' : Object.keys(r.fehlt).length ? 'rot' : ''), abhaken: 'inn' },
      { type: 'text', text: '„ca.“ = Schätzwert aus den Einstellungen (Innereien je Tier); „gewogen/gezählt“ = nach dem Zuschnitt eingetragen. Reicht es nicht, fehlt es den zuletzt zugeordneten Bestellungen.' }], footer: fussZeile() };
}
function docPackliste(pl) {
  return { title: `Packliste Kühlhaus – ${pl.tier.name}`, sub: [abholTxt(pl.tier)], quer: true,
    blocks: [{ type: 'table', head: ['Nr.', 'Name', 'Telefon', 'Bestellung', 'Sonderfälle (separat)', 'Lagerplatz', 'Schätzpreis', 'Endbetrag', 'gepackt', 'abgeholt'], fest: true, widths: [0.7, 2.4, 2.3, 6.6, 2.4, 2.2, 1.5, 1.5, 1.1, 1.1], align: ['r', '', '', '', '', '', 'r', 'r', '', ''],
      rows: pl.rows.map(r => [r.nrT || r.nr, r.name, r.tel, r.text + (r.notiz ? '\nNOTIZ: ' + r.notiz : ''), r.sonder, r.lager || `(${r.lagerVorschlag})`, fmtEur(r.schaetz), r.endbetrag !== null ? fmtEur(r.endbetrag) : '', r.status !== 'offen' ? '☑' : '☐', r.status === 'abgeholt' ? '☑' : '☐']) }], footer: fussZeile() };
}
// Ist-Wert einer Pick-Zeile als Text
function istText(e, p) {
  if (!e) return '';
  if (e.ok && !has(e.kg) && !has(e.stk)) return 'erledigt';
  const kg = has(e.kg) ? fmtNum(e.kg, 3) + ' kg' : '', stk = has(e.stk) ? fmtNum(e.stk) + ' Stk' : '';
  return p && (p.einheit === 'Stk' || (p.anz ? p.anz.nachStk : p.stkSoll)) ? [stk, kg].filter(Boolean).join(' · ') : [kg, stk && p && p.stkSoll ? stk : ''].filter(Boolean).join(' · ');
}
// Menge einer Pick-Zeile (seit 3.7.2, Wunsch Nutzer): Stückartikel (Rouladen, Steak …) groß in Stück, kg klein als ca.-Wert
// seit 3.7.3: genau so, wie bestellt (2 kg / 4 × 4 Stk / 16 Stk) – Text kommt aus pickAnzeige (logic.js)
function pickMengeHtml(p) {
  if (p.anz) return `${esc(p.anz.gross)}${p.anz.klein ? `<div class="klein">${esc(p.anz.klein)}</div>` : ''}`;
  return `${fmtNum(p.menge, 2)} ${esc(p.einheit)}`;
}
const pickMengeText = p => p.anz ? p.anz.gross + (p.anz.klein ? ` (${p.anz.klein})` : '') : `${fmtNum(p.menge, 2)} ${p.einheit}`;
// Gewicht in Gramm aus einer Eingabe („1.450“, „1450“, „1,45 kg“)
function grammAus(v) {
  const t = String(v || '').trim().toLowerCase();
  if (!t) return 0;
  if (/kg$/.test(t)) return Math.round(parseFloat(t.replace(/kg$/, '').replace(/\s/g, '').replace(',', '.')) * 1000) || 0;
  return Math.round(parseFloat(t.replace(/[\s.]/g, '').replace(',', '.')) || 0);
}
// Pick-Zeile wiegen (seit 3.1): Gewicht (und ggf. Stück) eintragen; Abweichung über Toleranz → Vermerk nötig
async function pickDialog(o, p) {
  if (!p.wiegen) { if (p.ist) kommLoeschen(S, o, p); else kommSetzen(S, o, p, { ok: true }); speichern(); return true; }
  const stkFeld = p.einheit === 'Stk' || !!p.stkSoll, tol = kommToleranz(S);
  let w = { pg: p.ist && has(p.ist.kg) ? fmtIn(num(p.ist.kg) * 1000, 0) : '', pstk: p.ist && has(p.ist.stk) ? String(p.ist.stk) : p.stkSoll ? String(p.stkSoll) : '', pverm: p.ist && p.ist.vermerk || '' }, fehler = '';
  for (;;) {
    const sollTxt = pickMengeText(p);
    const { k, werte } = await dialogFelder(`${p.kiste !== null ? 'Kiste ' + p.kiste + ' – ' : ''}${p.art}`, `
      <p>Nr. ${nrText(o)} ${esc(o.name)} · Soll <b>${esc(sollTxt)}</b> · Toleranz ±${fmtNum(tol * 100, 0)} %</p>
      ${fehler ? `<div class="fehlerbox">${esc(fehler)}</div>` : ''}
      <div class="zeile oben">
        <label class="f" style="width:200px">Gewicht in Gramm${p.einheit === 'Stk' ? ' (optional)' : ''}<input class="feld zahl" id="pg" inputmode="numeric" style="font-size:24px" value="${esc(w.pg)}" placeholder="z. B. 1450"></label>
        ${stkFeld ? `<label class="f" style="width:140px">Stückzahl<input class="feld zahl" id="pstk" inputmode="numeric" style="font-size:24px" value="${esc(w.pstk)}"></label>` : ''}
      </div>
      <label class="f">Vermerk an die Bestellung <span class="klein">(Pflicht bei Abweichung über ±${fmtNum(tol * 100, 0)} %)</span><input class="feld" id="pverm" value="${esc(w.pverm)}" placeholder="z. B. Steaks kleiner, Kunde informieren"></label>
      <p class="klein">Alle Teile der Zeile zusammen wiegen (z. B. alle Steaks). Der Preis bleibt bei der Waage beim Abholen – das Gewicht ist für die Auswertung.</p>`,
      [{ k: 'x', t: 'Abbrechen' }, ...(p.ist ? [{ k: 'weg', t: 'Wert löschen', cls: 'rot' }] : []), { k: 'ok', t: 'Bestätigen ✓', cls: 'haupt' }]);
    if (k === 'weg') { kommLoeschen(S, o, p); speichern(); return true; }
    if (k !== 'ok') return false;
    w = Object.assign(w, werte);
    const g = grammAus(w.pg), stk = stkFeld ? Math.round(num(w.pstk)) : null;
    if (p.einheit !== 'Stk' && !(g > 0)) { fehler = 'Bitte das Gewicht in Gramm eintragen.'; continue; }
    if (g > 0 && g < 20) { fehler = `${fmtNum(g)} g? Bitte in Gramm eintippen (z. B. 1450 für 1,45 kg).`; continue; }
    if (g > 80000) { fehler = `${fmtNum(g)} g? Bitte prüfen (in Gramm).`; continue; }
    if (stkFeld && p.einheit === 'Stk' && !(stk > 0)) { fehler = 'Bitte die Stückzahl eintragen.'; continue; }
    const ist = { kg: g > 0 ? g / 1000 : null, stk: stkFeld && stk > 0 ? stk : null, vermerk: String(w.pverm || '').trim() };
    const ab = kommAbweichung(S, p, ist);
    if (ab > tol + 1e-9 && !ist.vermerk) { fehler = `Abweichung ${fmtNum(ab * 100, 0)} % (Toleranz ±${fmtNum(tol * 100, 0)} %) – bitte einen Vermerk an die Bestellung schreiben.`; continue; }
    kommSetzen(S, o, p, ist); speichern(); meldung(`${p.art}: ${istText(o.komm[p.key], p)} gespeichert.`);
    return true;
  }
}
// Rest-Text einer Hofladen-Zeile (seit 3.7 auch Kisten von Hand: Stück bzw. unbekannt)
const hofRestText = r => r.restStk !== null && r.restStk !== undefined ? `ca. ${fmtNum(r.restStk, 0)} Stk` : r.rest === null ? 'Rest' : `ca. ${fmtNum(r.rest, r.einheit === 'Stk' ? 0 : 1)} ${r.einheit}`;
// Hofladen am Ende des Kommissionierens (seit 3.1): Reste je Kiste verpacken, jedes Päckchen wiegen, Kühlhaus-Kiste wählen
function kommiHofladen(tn, h) {
  const L = hofListe(S, tn);
  const offen = L.filter(r => !r.fertig).length;
  h += `<div class="karte" style="padding:0"><div class="zeile" style="margin:14px 16px 4px"><h3 class="platz" style="margin:0">Hofladen – Reste verpacken <span class="klein">${L.length ? (offen ? offen + ' von ' + L.length + ' offen' : 'alles erledigt ✓') : ''}</span></h3><button class="btn" data-act="hofdruck">Drucken</button></div>
    <p class="klein" style="margin:0 16px 8px">Zeile antippen → jedes Päckchen vakuumieren, wiegen, Kühlhaus-Kiste wählen. Hack und Innereien stehen auf ihren Zetteln.</p>
    ${L.map((r, i) => `<div class="pick ${r.fertig ? 'erledigt' : ''}" data-act="hofzeile" data-i="${i}"><div class="kiste">${r.kiste}</div><div class="menge">${esc(hofRestText(r))}</div>
      <div><b>${esc(r.art)}</b>${r.teile && r.teile.length ? ` <span class="klein">(${esc(r.teile.join(', '))})</span>` : ''}<div class="klein">${esc(r.regelText)}</div>${r.packs.length ? `<div class="klein">${r.packs.map(x => `${x.teil ? esc(x.teil) + ' ' : ''}${has(x.kg) ? fmtNum(x.kg, 3) + ' kg' : ''}${x.stk ? ' · ' + fmtNum(x.stk) + ' Stk' : ''}${x.kh ? ' → KH ' + x.kh : ''}`).join(' | ')}</div>` : ''}</div>
      <div class="klein r">${r.packs.length ? `<span class="ist">${r.packs.length} Päckchen · ${fmtNum(r.kg, 2)} kg</span><br>` : ''}${esc(r.platz)}</div></div>`).join('') || '<div style="padding:16px" class="klein">Nichts übrig – oder noch kein Kistenplan.</div>'}</div>`;
  inhalt().innerHTML = h;
  ui.acts.hofzeile = async el => { const r = L[+el.dataset.i]; if (r && (await hofDialog(tn, r))) render(); };
  ui.acts.hofdruck = () => docDrucken(docHofladen(tn, hofListe(S, tn)));
}
function docHofladen(tn, L) {
  return { title: `Hofladen – Reste verpacken – ${tierAnzeige(S, tn)}`, sub: [abholTxt(tier(S, tn))],
    blocks: [{ type: 'table', head: ['✓', 'Kiste', 'Artikel', 'Rest ca.', 'verpacken', 'Päckchen (Gewicht → Kühlhaus-Kiste)'], widths: [0.5, 0.8, 2, 1.2, 3.4, 5], align: ['', 'r', '', 'r', '', ''],
      rows: L.map(r => [r.fertig ? '✓' : '☐', r.kiste, r.art + (r.teile && r.teile.length ? ' (' + r.teile.join(', ') + ')' : ''), hofRestText(r), r.regelText, r.packs.map(x => `${x.teil ? x.teil + ' ' : ''}${has(x.kg) ? fmtNum(x.kg, 3) + ' kg' : ''}${x.stk ? ' (' + fmtNum(x.stk) + ' Stk)' : ''}${x.kh ? ' → KH ' + x.kh : ''}`).join('\n')]),
      rowClass: L.map(r => r.fertig ? 'erledigt' : '') }], footer: fussZeile() };
}
async function hofDialog(tn, r) {
  if (r.regel.r === 'kiste') { hofFertigSetzen(S, tn, r.key, !r.fertig); speichern(); meldung(r.fertig ? `${r.art}: wieder offen.` : `${r.art}: bleibt in Kiste ${r.kiste} ✓`); return true; }
  const anzKH = () => { const n = num(S.settings.lagerKuehlhaus); return n >= 1 ? Math.min(99, Math.round(n)) : 30; };
  const braten = r.art === BRATEN, stkFeld = r.regel.r === 'stk' || mitStueck(S, r.art) || r.art === OCHS;
  let kh = hofLetzteKiste(S, tn, r.art), fehler = '', aenderung = false, teil = '';
  const d = $('#dialog');
  const klick = e => { const b = e.target.closest('[data-kh]'); if (!b) return; e.stopPropagation(); kh = +b.dataset.kh; $$('#dialog [data-kh]').forEach(x => x.classList.toggle('haupt', +x.dataset.kh === kh)); };
  for (;;) {
    const L = hofListe(S, tn).find(x => x.key === r.key) || r;
    const restNoch = L.rest === null ? null : Math.max(0, L.rest - L.kg);
    d.addEventListener('click', klick, true);
    const { k, werte } = await dialogFelder(`Hofladen: Kiste ${r.kiste} – ${r.art}`, `
      <p><b>${esc(hofRegelText(S, r.art))}</b> · ${L.rest === null ? 'Rest: was in der Kiste übrig ist' : 'Rest ' + esc(hofRestText(L))}${L.teile && L.teile.length ? ' (' + esc(L.teile.join(', ')) + ')' : ''}${L.packs.length ? ` · schon ${L.packs.length} Päckchen (${fmtNum(L.kg, 2)} kg)${restNoch !== null ? `, noch ca. ${fmtNum(restNoch, 1)} kg` : ''}` : ''}</p>
      ${fehler ? `<div class="fehlerbox">${esc(fehler)}</div>` : ''}
      ${L.packs.length ? `<div class="klein" style="margin-bottom:8px">${L.packs.map(x => `<span class="marke" style="margin:2px">${x.teil ? esc(x.teil) + ' ' : ''}${has(x.kg) ? fmtNum(x.kg, 3) + ' kg' : ''}${x.stk ? ' · ' + x.stk + ' Stk' : ''}${x.kh ? ' → KH ' + x.kh : ''} <button class="btn klein rot" data-k="weg:${x.id}" style="min-height:0;padding:0 6px">✕</button></span>`).join('')}</div>` : ''}
      <div class="zeile oben">
        <label class="f" style="width:190px">Gewicht in Gramm<input class="feld zahl" id="hg" inputmode="numeric" style="font-size:24px" placeholder="z. B. 1250"></label>
        ${stkFeld ? `<label class="f" style="width:120px">Stück${r.regel.r === 'stk' ? '' : ' (optional)'}<input class="feld zahl" id="hs" inputmode="numeric" style="font-size:24px" value="${r.regel.r === 'stk' ? fmtNum(r.regel.n) : r.art === OCHS ? '1' : ''}"></label>` : ''}
        ${braten ? `<label class="f" style="width:220px">Teilstück (Pflicht)<select class="feld" id="ht">${opt('', 'bitte wählen …', !teil)}${bratenTeile(S).map(x => opt(x.name, x.name, x.name === teil)).join('')}</select></label>` : ''}
      </div>
      <div class="klein fett" style="margin:8px 0 6px">Kühlhaus-Kiste</div>
      <div class="lnr">${Array.from({ length: anzKH() }, (_, i) => i + 1).map(n => `<button class="btn ${n === kh ? 'haupt' : ''}" data-kh="${n}">${n}</button>`).join('')}</div>`,
      [{ k: 'x', t: 'Schließen' }, { k: 'fertig', t: L.fertig ? 'Zeile wieder öffnen' : 'Zeile fertig ✓' }, { k: 'ok', t: 'Päckchen speichern', cls: 'haupt' }]);
    d.removeEventListener('click', klick, true);
    if (k && k.startsWith('weg:')) { hofPackWeg(S, tn, +k.slice(4)); speichern(); aenderung = true; fehler = ''; continue; }
    if (k === 'fertig') { hofFertigSetzen(S, tn, r.key, !L.fertig); speichern(); return true; }
    if (k !== 'ok') return aenderung;
    const g = grammAus(werte.hg), stk = stkFeld ? Math.round(num(werte.hs)) : null; teil = werte.ht || '';
    if (!(g > 0)) { fehler = 'Bitte das Gewicht des Päckchens in Gramm eintragen.'; continue; }
    if (g < 20 || g > 30000) { fehler = `${fmtNum(g)} g? Bitte in Gramm eintippen (z. B. 1250).`; continue; }
    if (braten && !teil) { fehler = 'Bitte das Teilstück wählen – es wird aufs Päckchen geschrieben.'; continue; }
    if (!kh) { fehler = 'Bitte die Kühlhaus-Kiste wählen.'; continue; }
    hofPackDazu(S, tn, r.key, { kg: g / 1000, stk: stk > 0 ? stk : null, teil, kh }); speichern(); aenderung = true; fehler = '';
    meldung(`Päckchen ${fmtNum(g)} g → Kühlhaus-Kiste ${kh} gespeichert.`);
  }
}
function docPick(ko) {
  const o = ko.o;
  return { title: `Kommissionierung Nr. ${nrText(o)} – ${o.name}`, sub: [`Tier: ${o.tier}`, `Genusspakete: ${fmtNum(o.pakete)}${num(o.pakVak) ? ` (davon ${fmtNum(o.pakVak)} vakuumieren)` : ''}${ko.nichtVak.length ? ' · nicht vakuumieren: ' + ko.nichtVak.join(', ') : ''}`],
    blocks: [{ type: 'kv', rows: [['Lagerplatz', lagerText(o) || lagerVorschlag(S, o).ort, lagerText(o) ? '' : '(' + lagerVorschlag(S, o).grund + ')'], ['Sonderfälle (Metzger)', ko.sonder.join('; ') || '–']] },
      ...(o.packNotiz ? [{ type: 'text', bold: true, text: 'Notiz: ' + o.packNotiz }] : []),
      { type: 'table', head: ['✓', 'Kiste', 'Soll', 'Ist', 'Inhalt', 'verpacken', 'Stellplatz'], widths: [0.5, 0.9, 1.1, 1.3, 2.2, 3.8, 2.2], align: ['', 'r', 'r', 'r', '', '', ''],
        rows: ko.picks.map(p => [p.ist ? '✓' : '☐', p.hackTisch ? 'Hack-Tisch' : p.innTisch ? 'Innereien' : p.kiste === null ? '–' : p.kiste, pickMengeText(p), p.ist ? istText(p.ist, p) : '', p.art, (p.nichtVak ? `NICHT VAKUUMIEREN${p.nichtVak === 'einzeln' ? ' (einzeln)' : ''}\n` : '') + p.verpacken + (p.ist && p.ist.vermerk ? '\nVermerk: ' + p.ist.vermerk : ''), p.platz]),
        rowClass: ko.picks.map(p => p.ist && p.ist.vermerk ? 'rot' : p.ist ? 'erledigt' : ''), leer: 'keine Kisten eingetragen' },
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
    <label class="f" style="min-width:320px">Tier<select class="feld" data-ch="tierwahl">${tiereSortiert().map(t => { const g = abholGruppe(S, t.name); return opt(t.name, `${t.name} – ${abholTxt(t)}${g.length > 1 ? ' (gemeinsam mit ' + g.filter(n => n !== t.name).join(', ') + ')' : ''}`, t.name === tn); }).join('')}</select></label></div>
    <div class="reiter">${REITER.map(([k, t]) => `<a href="#/schlachttag/${k}" class="${k === tab || (k === 'kisten' && tab === 'packplan') ? 'aktiv' : ''}">${t}</a>`).join('')}</div><div id="tabinhalt"></div>`;
  inhalt().innerHTML = h;
  ui.acts.tierwahl = el => { ui.tierWahl = el.value; render(); };
  const ziel = $('#tabinhalt');
  const zeige = (doc, extraKnopf = '', vorher = '') => {
    ziel.innerHTML = vorher + knopfTeilen(extraKnopf) + docHtml(doc);
    ui.acts.teilen = async () => { const r = await docTeilen(doc, doc.title); if (r === 'gespeichert') meldung('Bild gespeichert (Teilen wird hier nicht unterstützt).'); };
    ui.acts.drucken = () => docDrucken(doc);
  };
  if (tab === 'menge') { const xK = tier(S, tn) && tier(S, tn).abhol ? terminAm(S, tier(S, tn).abhol) : null; zeige(docMenge(mengenpruefung(S, tn)), '', kandidatenKarte(xK)); kandidatenAktionen(xK); }
  else if (tab === 'metzger') tabMetzger(tn, ziel, zeige);
  else if (tab === 'kisten' || tab === 'packplan') tabKisten(tn, ziel);
  else if (tab === 'hack') { const hz = hackZettel(S, tn); zeige(docHack(hz)); abhakenAn(ziel, { hack: hz.rows.map(r => r.nr).concat(hz.hof.text ? ['hof'] : []) }); }
  else if (tab === 'innereien') { const ii = innereien(S, tn); zeige(docInnereien(ii), '', innZuschnittKarte(ii)); abhakenAn(ziel, { inn: ii.rows.map(r => r.nr), innrest: ii.uebersicht.map(u => u.art) }); }
  else if (tab === 'packliste') tabPackliste(tn, ziel);
  ui.acts.innist = el => { const v = el.value.trim(); innIstSetzen(S, tn, el.dataset.f, v === '' ? null : Math.max(0, num(v))); speichern(); render(); };
  // Abhaken (seit 3.0.6): Zeile antippen → erledigt (grün, ✓), nochmal antippen → wieder offen
  ui.acts.abhaken = el => {
    const art = el.dataset.abh, key = el.dataset.key;
    if (art === 'innrest') innRestUmschalten(S, tn, key);
    else if (art === 'hack' && key === 'hof') hackHofUmschalten(S, tn);
    else { const o = S.bestellungen.find(x => x.nr === +key); if (!o) return; if (art === 'hack') { if (o.hackOk) delete o.hackOk; else o.hackOk = true; } else innOkUmschalten(S, o); }
    speichern(); render();
  };
}

function tabMetzger(tn, ziel, zeige) {
  const g = abholGruppe(S, tn);
  if (g.length > 1) zeige(docMetzger(metzgerauftrag(S, tn, (S.packplaene[tn] || {}).gruppe ? S.packplaene[tn].hackKisteKg : null)), '', `<div class="hinweis"><b>Gemeinsame Abholung ${fmtDate(tier(S, tn).abhol)}:</b> ${g.map(esc).join(' + ')} laufen als ein Topf – ein Auftrag, Mengen für alle Tiere zusammen.</div>`);
  else zeige(docMetzger(metzgerauftrag(S, tn)));
}

// =====================================================================
//  Kisten & Ladeplan (Packplan und Kistenliste in einem)
// =====================================================================
// Ochsenschwanz: Stückzahl im Feld kg (Zuteilung nach Stück), Gewicht getrennt im Feld gew
const istGewogen = k => k.art === OCHS ? has(k.gew) : !!k.gewogen || (has(k.plan) && has(k.kg) && Math.abs(num(k.kg) - num(k.plan)) > 0.001);
// Stellplatz-Auswahl (seit 3.0.4): je Feld im Auto „oben“ und „n. v. u.“ – gleiche Schreibweise wie der Ladeplan
function stellplatzOptionen(aktuell) {
  const werte = [];
  for (const f of S.auto) { const h = Math.max(1, Math.round(num(f.hoehe)) || 4); werte.push(`${f.name}, oben`); for (let e = h - 1; e >= 1; e--) werte.push(`${f.name}, ${e}. v. u.`); }
  const a = String(aktuell || '');
  let h = opt('', '– kein Platz –', !a);
  if (a && !werte.some(w => sameText(w, a))) h += opt(a, a, true); // alter/eigener Eintrag bleibt sichtbar
  return h + werte.map(w => opt(w, w, sameText(w, a))).join('');
}
// Draufsicht aus der aktuellen Kistenliste (Stellplatz-Text „hinten links, oben“ / „Mitte rechts, 2. v. u.“)
function felderAusKisten(tn) {
  const namen = Array.isArray(tn) ? tn : [tn];
  const rows = [...new Map(namen.flatMap(n => kistenRows(S, n)).map(k => [k.id, k])).values()];
  const mehr = new Set(rows.map(k => k.tier)).size > 1; // alte, nach Tieren getrennte Kisten
  return S.auto.map(f => {
    const ks = {};
    rows.filter(k => sameText(String(k.platz || '').split(',')[0], f.name)).forEach(k => {
      const e = /oben/.test(k.platz) ? 99 : num((/(\d+)\./.exec(k.platz) || [])[1]);
      const x = ks[k.nr] = ks[k.nr] || { nr: k.nr, ebene: e, teile: [], gewogen: true };
      if (mehr && !x.teile.length) x.teile.push(k.tier + ':');
      x.teile.push(k.hand ? handZeileText(S, k) : k.art === OCHS ? `${k.art} ${fmtNum(k.kg, 0)} Stk${has(k.gew) ? ' ' + fmtNum(k.gew, 1) + ' kg' : ''}` : `${k.art} ${fmtNum(k.kg, 1)}`); if (!k.hand && !istGewogen(k)) x.gewogen = false;
    });
    const liste = Object.values(ks).sort((a, b) => b.ebene - a.ebene);
    return { name: f.name, belegt: liste.length, hoehe: num(f.hoehe), kisten: liste.map((k, i) => ({ nr: k.nr, text: k.teile.join(' + '), oben: i === 0, gewogen: k.gewogen })) };
  });
}
// Lage eines Felds in der Draufsicht (Reihe 1 = vorne … 3 = hinten, Spalte 1 = links … 3 = rechts)
function autoPos(name) {
  const n = String(name).toLowerCase();
  const reihe = n.includes('vorne') ? 1 : n.includes('mitte') && !n.startsWith('hinten') ? 2 : n.includes('hinten') ? 3 : 0;
  const sp = n.includes('links') ? 1 : n.includes('rechts') ? 3 : 2;
  return { reihe, sp };
}
const autoSpalte = p => p.reihe === 3 ? (p.sp === 1 ? '1 / span 3' : '4 / span 3') : (p.sp - 1) * 2 + 1 + ' / span 2';
function autoDraufsicht(felderIn, kompakt) {
  const pos = autoPos;
  const hp = S.settings.hackPlatz || 'vorne rechts';
  const felder = felderIn.map(f => ({ ...f, p: pos(f.name) }));
  const zelle = f => `<div class="auto-feld ${f.kisten.length ? '' : 'leer'}" style="grid-row:${f.p.reihe + 1};grid-column:${f.p.reihe === 3 ? (f.p.sp === 1 ? '1 / span 3' : '4 / span 3') : (f.p.sp - 1) * 2 + 1 + ' / span 2'}"><div class="fn">${esc(f.name)} <span class="klein">${f.belegt}/${f.hoehe}${sameText(f.name, hp) ? ' · Hack' : ''}</span></div>${f.kisten.map(k => `<div class="ak${k.gewogen ? ' gw' : ''}"><b>K${k.nr}</b> ${esc(k.text)}</div>`).join('')}</div>`;
  if (felder.some(f => !f.p.reihe)) return `<div class="karte"><h3 style="margin-top:0">Stellplätze</h3>${felder.map(f => `<div><b>${esc(f.name)}</b>: ${f.kisten.map(k => 'K' + k.nr).join(', ')}</div>`).join('')}</div>`;
  return `<div class="karte ${kompakt ? 'kompakt' : ''}"><h3 style="margin-top:0">Draufsicht Auto <span class="klein">(oben = vorne, je Feld oberste Kiste zuerst)</span></h3><div class="zeile oben" style="flex-wrap:nowrap"><div class="auto-grid" style="grid-template-columns:repeat(6,1fr);flex:1;max-width:none">
    <div class="auto-tuer" style="grid-row:1;grid-column:1 / -1">— Fahrerhaus / vorne —</div>${felder.map(zelle).join('')}
    <div class="auto-tuer" style="grid-row:5;grid-column:1 / -1">— Tür hinten —</div></div><div class="klein" style="writing-mode:vertical-rl;align-self:center">rechte Tür ▸</div></div></div>`;
}

function tabKisten(tn, ziel) {
  // seit 3.7: ohne Kisten oder mit Kisten von Hand → neue Erfassung; alter Kistenplan bleibt lesbar und lässt sich umstellen
  const rows0 = kistenKontext(S, tn).rows;
  if (!rows0.length || handModus(rows0)) return tabKistenHand(tn, ziel);
  const pp = S.packplaene[tn];
  const t = tier(S, tn);
  // Gemeinsame Abholung: Tiere mit gleichem Abholtermin teilen sich Ladeplan und Kistennummern
  const gruppe = abholGruppe(S, tn), isG = gruppe.length > 1;
  const ctx = kistenKontext(S, tn), topf = ctx.topf; // Topf: gemeinsame Kisten für alle Tiere des Abholtags
  const calc = topf ? kistenCalc(S, tn).map(c => Object.assign(c, { tier: ctx.key }))
    : (isG ? gruppe : [tn]).flatMap(n => kistenCalc(S, n).map(c => Object.assign(c, { tier: n }))).sort((a, b) => a.k.nr - b.k.nr);
  const zeigTier = isG && !topf;
  const gewogen = calc.filter(c => istGewogen(c.k)).length;
  const andere = kistenTiere(S).filter(x => !gruppe.includes(x));
  const ohnePlan = isG && !topf ? gruppe.filter(n => !calc.some(c => c.tier === n)) : [];
  const veraltet = calc.length ? kistenplanVeraltet(S, tn) : null;
  const gesperrt = calc.length > 0 && kommissionierBegonnen(S, isG ? gruppe : [tn]);
  const planNamen = (pp && pp.tiere) || (isG ? gruppe : [tn]);
  const veraltetHinweis = veraltet ? `<div class="fehlerbox zeile" style="gap:10px;flex-wrap:wrap"><div class="platz"><b>Kistenplan passt nicht mehr:</b> ${esc(veraltet)}. Bitte neu berechnen – oder zurücksetzen, wenn das Tier noch nicht beim Metzger war.</div><button class="btn braun" data-act="planen">Plan neu berechnen</button><button class="btn rot" data-act="kreset">Kisten zurücksetzen</button></div>` : '';
  const umstellHinweis = `<div class="hinweis zeile" style="gap:10px;flex-wrap:wrap"><div class="platz"><b>Alter, berechneter Kistenplan.</b> Seit 3.7 werden Kisten von Hand eingetragen (Kiste, Artikel, Menge, Platz im Auto). Umstellen übernimmt Nummern, Artikel und Plätze, die Mengen werden aus den kg geschätzt – bitte danach prüfen. Schon Kommissioniertes bleibt erhalten.</div><button class="btn haupt" data-act="handUm">Auf Kisten von Hand umstellen</button></div>`;
  const gruppeHinweis = umstellHinweis + veraltetHinweis + (gesperrt ? `<div class="hinweis"><b>Kommissionieren läuft – Kistenplan gesperrt.</b> „Plan neu berechnen“ und „Kisten zurücksetzen“ gehen nicht mehr, weil die Kisten schon im Haus sind und gewogen wird. Einzelne Zeilen (gewogene kg, Stellplatz) lassen sich weiter ändern.</div>` : '') + (isG ? `<div class="hinweis"><b>Gemeinsame Abholung ${fmtDate(t.abhol)}:</b> ${gruppe.map(esc).join(' + ')} laufen als ein Topf – gemeinsame Kisten, Mengencheck über alle Tiere, kommissioniert wird über alle Bestellungen.${calc.length && ohnePlan.length ? ` <span class="warn">Für ${ohnePlan.map(esc).join(', ')} gibt es noch keine Kisten – bitte „Plan neu berechnen“.</span>` : ''}</div>` : '');
  if (!calc.length) {
    ziel.innerHTML = gruppeHinweis + `<div class="karte" style="max-width:820px"><h3 style="margin-top:0">Noch kein Plan für ${esc(isG ? gruppe.join(' + ') : tn)}</h3>
      <p>„Plan erstellen“ rechnet aus, welche Stücke in welche Metzgerkiste kommen (max. ${fmtNum(S.settings.kisteMax)} kg; gemischt nur Rostbraten + Steak bzw. Filet + Braten + Tafelspitz), wo jede Kiste im Auto steht und in welcher Reihenfolge beim Metzger eingeladen wird. Hackfleisch steht immer auf „${esc(S.settings.hackPlatz || 'vorne rechts')}“.</p>
      <p class="klein">Die Kisten werden gleich mit geschätzten kg angelegt. Beim Metzger trägst du dann die gewogenen kg ein.</p>
      ${andere.length >= 2 ? `<p class="warn">Es sind schon Kisten für ${andere.map(esc).join(' und ')} eingetragen (max. zwei Tiere gleichzeitig) – fertige Tiere bitte vorher abschließen.</p>` : ''}
      <div class="knopfleiste"><button class="btn braun" data-act="planen" style="min-height:56px;font-size:18px">Plan erstellen</button></div></div>`;
  } else {
    ziel.innerHTML = gruppeHinweis + `<div class="knopfleiste" style="margin-bottom:10px">
        <button class="btn braun" data-act="planen" ${gesperrt ? 'disabled title="gesperrt – Kommissionieren läuft"' : ''}>Plan neu berechnen</button>
        <button class="btn haupt" data-act="teilenPlan">Ladeplan teilen (Metzger)</button>
        <button class="btn" data-act="teilenKisten">Kistenliste teilen</button>
        <button class="btn" data-act="drucken">Drucken</button>
        <button class="btn rot" data-act="kreset" ${gesperrt ? 'disabled title="gesperrt – Kommissionieren läuft"' : ''}>Kisten zurücksetzen</button>
        <span class="platz"></span>
        <span class="marke ${gewogen === calc.length ? 'gruen' : gewogen ? 'gelb' : ''}" style="align-self:center;font-size:14px;padding:6px 12px">${gewogen} von ${calc.length} gewogen</span></div>
      ${pp && pp.warn.length ? pp.warn.map(w => `<div class="hinweis" style="padding:6px 12px;margin-bottom:8px">${esc(w)}</div>`).join('') : ''}
      <div class="kistenlayout">
        <div>${autoDraufsicht(felderAusKisten(isG ? gruppe : tn), true)}
          ${pp ? `<details class="karte"><summary class="fett">Einladereihenfolge beim Metzger</summary><ol class="klein" style="padding-left:20px;margin:8px 0 0">${pp.einladen.map(e => `<li>${esc(e.replace(/^\d+\.\s*/, ''))}</li>`).join('')}</ol></details>` : ''}</div>
        <div class="karte" style="padding:0">
          <div class="tabwrap" style="border:none"><table class="tab ktab"><thead><tr><th class="r">Kiste</th><th>Inhalt</th><th class="r">Plan</th><th class="r">gewogen kg</th><th>Stellplatz</th><th class="r">Rest</th><th></th></tr></thead><tbody>
          ${calc.map(c => { const gw = istGewogen(c.k); return `<tr data-id="${c.k.id}" class="${gw ? 'gw' : ''}">
            <td style="width:58px"><input class="feld zahl" inputmode="numeric" data-ch="kf" data-f="nr" value="${c.k.nr}">${zeigTier ? `<div class="klein fett" style="text-align:center">${esc(c.tier)}</div>` : ''}</td>
            <td><select class="feld" style="max-width:205px" data-ch="kf" data-f="art">${kistenArtOpt(c.k.art)}</select>${c.teile ? `<div class="klein teile">${esc(c.teile)}</div>` : ''}</td>
            <td class="r klein">${has(c.k.plan) ? (c.k.art === OCHS ? fmtNum(c.k.plan, 0) + ' Stk' : fmtNum(c.k.plan, 1)) : ''}</td>
            <td style="width:96px">${c.k.art === OCHS ? `<input class="feld zahl" inputmode="decimal" data-ch="kf" data-f="gew" value="${has(c.k.gew) ? fmtIn(c.k.gew, 2) : ''}" placeholder="kg" title="Ochsenschwanz gewogen (kg)"><div class="klein">Stück: <input class="feld zahl klein" style="width:52px;padding:2px 6px;min-height:40px;margin-top:4px" inputmode="numeric" data-ch="kf" data-f="kg" value="${fmtIn(c.k.kg, 0)}" title="Anzahl Ochsenschwänze"></div>` : `<input class="feld zahl" inputmode="decimal" data-ch="kf" data-f="kg" value="${gw ? fmtIn(c.k.kg, 2) : ''}" placeholder="${has(c.k.plan) ? fmtNum(c.k.plan, 1) : ''}">`}</td>
            <td style="width:172px"><select class="feld klein" style="min-width:168px;padding-left:6px;padding-right:2px" data-ch="kf" data-f="platz">${stellplatzOptionen(c.k.platz)}</select></td>
            <td class="r fett">${c.k.art === SONDERKISTE ? '–' : c.k.art === OCHS ? fmtNum(c.rest, 0) + ' Stk' : fmtNum(c.rest, 1)}</td>
            <td style="width:44px"><button class="btn klein rot" data-act="kweg" data-id="${c.k.id}">✕</button></td></tr>`; }).join('')}
          </tbody></table></div>
          <div class="knopfleiste" style="padding:10px 12px"><button class="btn klein" data-act="kneu">+ Kistenzeile${zeigTier ? ' (' + esc(tn) + ')' : ''}</button><span class="platz"></span><button class="btn braun klein" data-act="abschluss">${topf ? esc(ctx.key) : isG ? esc(tn) : 'Tier'} abgeschlossen → Reste an Hofladen</button></div>
        </div>
      </div>
      <p class="klein">Grün = gewogen. Leeres Feld bei „gewogen“ = es wird mit dem Planwert gerechnet. „Rest“ = was nach allen Bestellungen in der Kiste übrig bleibt (geht an den Hofladen; Sonderfälle-Kisten gehören ganz den Kunden: –).</p>`;
  }
  ui.acts.planen = async () => {
    if (gesperrt) return meldung('Kistenplan gesperrt – Kommissionieren läuft.', true);
    const neu = packplan(S, tn);
    if (neu.fehler) return meldung(neu.fehler, true);
    if (gewogen && !(await frage('Plan neu berechnen', `<b>${gewogen} Kistenzeilen sind schon gewogen.</b> Beim Neuberechnen werden alle Kisten von ${esc(neu.tier)} durch den neuen Plan ersetzt und die gewogenen kg gehen verloren.`, 'Trotzdem neu berechnen', 'Abbrechen', 'rot'))) return;
    (neu.tiere || [tn]).forEach(n => { S.packplaene[n] = neu; }); packplanUebernehmen(S, neu); speichern(); render();
    meldung(`Plan erstellt: ${neu.kisten.length} Kisten${neu.gruppe ? ' für ' + neu.tier : ''}.`);
    if (neu.warn.length) dialog('Hinweis zum Plan', neu.warn.map(w => `<p class="warn">${esc(w)}</p>`).join(''));
  };
  ui.acts.kreset = async () => {
    if (gesperrt) return meldung('Kistenplan gesperrt – Kommissionieren läuft.', true);
    const namen = [...new Set(calc.map(c => c.tier || c.k.tier).concat(planNamen))].filter(n => S.kisten.some(k => k.tier === n));
    const gw = kistenGewogenAnzahl(S, namen);
    if (!(await frage('Kisten zurücksetzen', `Alle ${calc.length} Kistenzeilen von <b>${namen.map(esc).join(' + ')}</b> löschen? Danach gibt es keinen Ladeplan mehr; die Bestellungen bleiben unverändert und lassen sich wieder neu verteilen.${gw ? `<br><b class="warn">${gw} Kisten sind schon gewogen – diese Gewichte gehen verloren.</b>` : ''}`, 'Zurücksetzen', 'Abbrechen', 'rot'))) return;
    kistenZuruecksetzen(S, namen); speichern(); meldung(`Kisten von ${namen.join(' + ')} zurückgesetzt.`); render();
  };
  const find = id => S.kisten.find(k => k.id === +id);
  ui.acts.kf = async el => {
    if ($('#dialog.auf')) return; // eine Nachfrage läuft schon (z. B. Feld verliert beim Antippen des Knopfs den Fokus)
    const k = find(el.closest('tr').dataset.id); const f = el.dataset.f;
    // Plausibilität (seit 3.4.1): gewogene kg fließen in die Ausbeute-Statistik – Tippfehler wie 195 statt 19,5 abfangen
    if ((f === 'kg' && k.art !== OCHS) || f === 'gew') {
      const v = num(el.value), plan = num(k.plan);
      if (el.value.trim() !== '') {
        if (!(v > 0)) { meldung('Gewicht: bitte eine Zahl über 0 kg eintragen (Komma oder Punkt).', true); render(); return; }
        const grenze = f === 'gew' ? 15 : 35;
        const auffaellig = v > grenze ? `${fmtNum(v, 2)} kg ist sehr viel für eine Kiste.` : f === 'kg' && plan > 1 && v < plan * 0.5 ? `${fmtNum(v, 2)} kg ist weniger als die Hälfte vom Plan (${fmtNum(plan, 1)} kg).` : '';
        if (auffaellig && !(await frage('Gewicht prüfen', `Kiste <b>${esc(k.nr)}</b> – ${esc(k.art)}: ${auffaellig}<br>Stimmt das? <span class="klein">(Komma beachten, z. B. 19,5)</span>`, 'Ja, stimmt', 'Korrigieren'))) { render(); return; }
      }
    }
    if (f === 'nr') { const n = Math.round(num(el.value)); if (n < 1 || n > 99) { meldung('Kistennummer 1 bis 99', true); render(); return; } k.nr = n; }
    else if (f === 'gew') { k.gew = el.value.trim() === '' ? null : num(el.value); }
    else if (f === 'kg' && k.art === OCHS) { k.kg = el.value.trim() === '' ? (has(k.plan) ? k.plan : 0) : Math.max(0, Math.round(num(el.value))); }
    else if (f === 'kg') { if (el.value.trim() === '') { k.kg = has(k.plan) ? k.plan : null; k.gewogen = false; } else { k.kg = num(el.value); k.gewogen = true; } }
    else k[f] = el.value;
    speichern(); render();
  };
  ui.acts.kweg = async el => { const k0 = S.kisten.find(k => k.id === +el.dataset.id); if (k0 && !(await frage('Kistenzeile löschen', `Kiste <b>${esc(k0.nr)}</b> – ${esc(k0.art)}${k0.gewogen && has(k0.kg) ? ' (gewogen ' + fmtNum(k0.kg, 2) + ' kg)' : ''} aus dem Kistenplan löschen?`, 'Löschen', 'Abbrechen', 'rot'))) return; S.kisten = S.kisten.filter(k => k.id !== +el.dataset.id); speichern(); render(); };
  ui.acts.kneu = () => {
    const id = S.kisten.reduce((m, k) => Math.max(m, k.id || 0), 0) + 1;
    const nr = Math.min(99, calc.reduce((m, c) => Math.max(m, c.k.nr), 0) + 1);
    S.kisten.push({ id, tier: topf ? ctx.key : tn, nr, art: 'Braten', kg: null, plan: null, platz: '', gewogen: false }); speichern(); render();
  };
  const teilen = async d => { const r = await docTeilen(d, d.title); if (r === 'gespeichert') meldung('Bild gespeichert.'); };
  ui.acts.teilenPlan = () => pp ? teilen(docPackplan(pp, t)) : meldung('Bitte zuerst „Plan neu berechnen“.', true);
  const kistenDoc = () => topf ? docKisten(ctx.key, calc, ctx.t) : isG ? docKisten(gruppe.join(' + '), calc, t) : docKisten(tn, kistenCalc(S, tn));
  ui.acts.teilenKisten = () => teilen(kistenDoc());
  ui.acts.drucken = () => docDrucken(pp ? [docPackplan(pp, t), kistenDoc()] : kistenDoc());
  ui.acts.handUm = async () => {
    if (!(await frage('Auf Kisten von Hand umstellen', 'Der berechnete Plan wird zu Kisten von Hand: Nummern, Artikel und Plätze bleiben, Mengen werden aus den kg geschätzt (Braten ohne Teilstück und Menge – bitte nachtragen). Danach gibt es kein „Plan neu berechnen“ mehr.', 'Umstellen'))) return;
    handUmstellen(S, tn); speichern(); ui.kistenSicht = 'fuellen'; meldung('Umgestellt – bitte Mengen und Teilstücke prüfen.'); render();
  };
  ui.acts.abschluss = () => kistenAbschluss(tn, calc, topf);
}
// Tier abschließen (aus „Kisten & Ladeplan“ bzw. seit 3.7 auch aus „Kisten von Hand“)
async function kistenAbschluss(tn, calc, topf) {
  // Topf: alle Tiere des Abholtags werden zusammen abgeschlossen (gemeinsame Kisten)
  const namen = abschlussNamen(S, tn), wer = namen.join(' + ');
  const reste = calc.filter(c => (topf || c.k.tier === tn) && c.rest > 0.0001 && c.k.art !== 'Sonderfälle (beschriftet)');
  const offen = namen.flatMap(n => ordersOfTier(S, n)).filter(o => (o.status || 'offen') === 'offen');
  const ohneSg = namen.filter(n => !(num((tier(S, n) || {}).sg) > 0));
  if (ohneSg.length) return dialog('Schlachtgewicht fehlt', `<p>Bitte zuerst das echte Schlachtgewicht von ${ohneSg.map(esc).join(' und ')} eintragen (z. B. von der Metzgerrechnung). Es wird für die Ausbeute-Statistik gebraucht.</p>${ohneSg.map(n => `<p><a href="#/tier/${encodeURIComponent(n)}">Tier ${esc(n)} öffnen</a></p>`).join('')}`);
  if (offen.length) return dialog('Noch nicht fertig', `<p>${esc(wer)} kann erst abgeschlossen werden, wenn alle Bestellungen gepackt sind.</p><p class="warn">Noch offen: ${offen.map(o => 'Nr. ' + nrText(o) + ' ' + esc(o.name)).join(', ')}</p>`);
  // seit 3.3: was nicht vollständig gewogen ist, zählt bei diesem Tier nicht für die Ausbeute-Statistik
  const lk = erfassungLuecken(S, tn), lArt = [...new Set(lk.map(l => l.art))];
  const lueckenHtml = lk.length ? `<span class="hinweis" style="display:block;margin-top:10px"><b>Nicht vollständig gewogen – zählt bei ${namen.length > 1 ? 'diesen Tieren' : 'diesem Tier'} nicht für die Ausbeute-Statistik:</b><br>${lArt.map(a => `${esc(a)}: ${esc(lk.filter(l => l.art === a).map(l => l.grund).join(', '))}`).join('<br>')}<br><span class="klein">Wer das noch nachholen will: abbrechen, beim Kommissionieren die offenen Zeilen wiegen bzw. die Hofladen-Reste verpacken und „fertig“ setzen.</span></span>` : '';
  if (!(await frage('Tier abschließen', `Alle Bestellungen von <b>${esc(wer)}</b> sind gepackt.<br>${reste.length} Reste gehen an den Hofladen, danach werden die ${calc.filter(c => topf || c.k.tier === tn).length} Kistenzeilen geleert und ${esc(wer)} ${namen.length > 1 ? 'kommen' : 'kommt'} ins Archiv (mit Bestellungen, gewogener Ausbeute und Kistenstand).${lueckenHtml}`, 'Abschließen'))) return;
  const n = tierAbschliessen(S, tn); namen.forEach(x => { delete S.packplaene[x]; }); speichern();
  meldung(`${wer} abgeschlossen und im Archiv: ${n} Reste ins Hofladen-Blatt übernommen, Kisten geleert.`); ui.tierWahl = ''; render();
}
const kistenArtOpt = sel => S.artikel.filter(a => !istOrgan(a.name)).map(a => opt(a.name, a.name, a.name === sel)).join('') + opt('Sonderfälle (beschriftet)', 'Sonderfälle (beschriftet)', sel === 'Sonderfälle (beschriftet)');

// =====================================================================
//  Kisten von Hand (seit 3.7, Wunsch Nutzer 26.11.): 1) Kisten füllen – Zeile für Zeile „Kiste 1 – 1 Filet“, darunter „+“;
//  2) Auto beladen – je Kiste der Platz im Auto. Kein Plan, kein Wiegen; das Kommissionieren rechnet daraus, wer aus welcher Kiste nimmt.
// =====================================================================
function tabKistenHand(tn, ziel) {
  const t = tier(S, tn);
  const gruppe = abholGruppe(S, tn), isG = gruppe.length > 1;
  const tp = topfTier(S, tn), schluessel = tp && tp.glieder ? tp.name : tn;
  const ctx = kistenKontext(S, tn);
  const rows = ctx.rows;
  const calc = rows.length ? kistenCalc(S, tn) : [];
  const sicht = ui.kistenSicht === 'auto' ? 'auto' : 'fuellen';
  const nummern = [...new Set(rows.map(k => k.nr))].sort((a, b) => a - b);
  const sl = handSonderListe(S, tn);
  const sOffen = sl.filter(x => x.kiste === null);
  const kopf = `${isG ? `<div class="hinweis"><b>Gemeinsame Abholung ${esc(gruppe.join(' + '))}</b> – ein gemeinsamer Satz Kisten für alle Tiere.</div>` : ''}
    <div class="knopfleiste" style="margin-bottom:10px">
      <button class="btn ${sicht === 'fuellen' ? 'haupt' : ''}" data-act="sicht" data-s="fuellen" style="min-height:52px">1 · Kisten füllen</button>
      <button class="btn ${sicht === 'auto' ? 'haupt' : ''}" data-act="sicht" data-s="auto" style="min-height:52px">2 · Auto beladen</button>
      <span class="platz"></span>
      <button class="btn" data-act="teilenKisten" ${rows.length ? '' : 'disabled'}>Kistenliste teilen</button>
      <button class="btn" data-act="drucken" ${rows.length ? '' : 'disabled'}>Drucken</button></div>`;
  let h = kopf;
  if (sicht === 'fuellen') {
    const su = handSummen(S, tn);
    h += `<div class="karte" style="padding:0">
      <div class="tabwrap" style="border:none"><table class="tab ktab"><thead><tr><th class="r">Kiste</th><th>Artikel</th><th>Teilstück / Inhalt</th><th class="r">Menge</th><th class="r">gewogen kg <span class="klein">(freiwillig)</span></th><th>Platz im Auto</th><th></th></tr></thead><tbody>
      ${calc.map(c => { const k = c.k, sk = k.art === SONDERKISTE, e = k.einh || handEinheit(S, k.art);
        return `<tr data-id="${k.id}">
        <td style="width:64px"><input class="feld zahl" inputmode="numeric" data-ch="hf" data-f="nr" value="${k.nr}" style="font-size:20px"></td>
        <td style="width:250px"><select class="feld" style="min-width:230px" data-ch="hf" data-f="art">${kistenArtOpt(k.art)}</select></td>
        <td>${k.art === BRATEN ? `<select class="feld" style="min-width:230px" data-ch="hf" data-f="teil">${opt('', '– Teilstück –', !k.teil)}${bratenTeile(S).map(x => opt(x.name, x.name, x.name === k.teil)).join('')}</select>`
          : sk ? `<button class="btn" data-act="hsonder" data-id="${k.id}">Sonderfälle wählen (${(k.sonder || []).length})</button>${c.teile ? `<div class="klein teile">${esc(c.teile)}</div>` : ''}` : ''}</td>
        <td style="width:150px">${sk ? '' : `<div class="zeile" style="gap:6px;flex-wrap:nowrap"><input class="feld zahl" inputmode="decimal" data-ch="hf" data-f="menge" value="${has(k.menge) ? fmtIn(k.menge, e === 'kg' ? 2 : 0) : ''}" placeholder="${e === 'kg' ? 'ca. kg' : 'Anzahl'}" style="width:84px;font-size:20px"><span>${e === 'kg' ? 'kg' : e === 'Btl' ? 'Btl' : 'Stk'}</span></div>`}
          ${k.leer ? `<button class="btn klein" data-act="hleer" data-id="${k.id}" title="beim Kommissionieren als leer gemeldet – antippen, um es zurückzunehmen"><span class="marke rot">leer</span></button>` : ''}</td>
        <td style="width:96px">${sk ? '' : `<input class="feld zahl" inputmode="decimal" data-ch="hf" data-f="kgIst" value="${num(k.kgIst) > 0 ? fmtIn(k.kgIst, 2) : ''}" placeholder="–" style="width:84px">`}</td>
        <td class="klein">${esc(k.platz || '–')}</td>
        <td style="width:44px"><button class="btn klein rot" data-act="hweg" data-id="${k.id}">✕</button></td></tr>`; }).join('') || '<tr><td colspan="7" class="klein" style="padding:16px">Noch keine Kisten eingetragen. Unten mit „+“ die erste Zeile anlegen.</td></tr>'}
      </tbody></table></div>
      <div class="knopfleiste" style="padding:10px 12px">
        <button class="btn haupt" data-act="hneu" style="min-height:56px;font-size:20px">+ Zeile${rows.length ? ' (Kiste ' + rows[rows.length - 1].nr + ')' : ''}</button>
        ${rows.length ? `<button class="btn" data-act="hneuK" style="min-height:56px">+ neue Kiste (${Math.min(99, Math.max(...nummern) + 1)})</button>` : ''}
        <span class="platz"></span>
        ${rows.length ? `<button class="btn braun klein" data-act="abschluss">${tp && tp.glieder ? esc(tp.name) : 'Tier'} abgeschlossen → Reste an Hofladen</button>` : ''}</div></div>
      <div class="spalten2" style="margin-top:14px"><div class="karte"><h3 style="margin-top:0">Eingetragen / gebraucht</h3>
        ${su.length ? `<table class="tab"><thead><tr><th>Artikel</th><th class="r">in Kisten</th><th class="r">bestellt</th><th>Kisten</th></tr></thead><tbody>${su.map(x => `<tr class="${x.zuWenig ? 'rot' : ''}"><td>${esc(x.art)}</td><td class="r">${x.kisten.length ? esc(x.eingetragenText) + (x.ohneMenge ? ' + ?' : '') : '<span class="warn">–</span>'}</td><td class="r">${esc(x.bedarfText)}</td><td class="klein">${x.kisten.join(', ')}</td></tr>`).join('')}</tbody></table>` : '<p class="klein">Keine Bestellungen.</p>'}
        <p class="klein">„bestellt“ = Einzelbestellungen + Genusspakete, ohne Sonderfälle. Stück grob aus dem Einzelgewicht. Rot = weniger eingetragen als bestellt.</p></div>
        <div>${sl.length ? `<div class="karte"><h3 style="margin-top:0">Sonderfälle ${sOffen.length ? `<span class="marke gelb">${sOffen.length} ohne Kiste</span>` : '<span class="marke gruen">alle in Kisten</span>'}</h3>
          <div class="klein">${sl.map(x => `${x.kiste !== null ? '<b>K' + x.kiste + '</b>' : '<span class="warn">–</span>'} ${esc(x.text)}`).join('<br>')}</div>
          <p class="klein">Zeile mit Artikel „Sonderfälle (beschriftet)“ anlegen und dort „Sonderfälle wählen“.</p></div>` : ''}
        <div class="karte klein">So geht's: Kiste füllen, dann je Artikel eine Zeile – z. B. Kiste 1 · Filet · 2 Stk, „+“, Kiste 1 · Braten · Kugel · 2 Stk. Braten nach Teilstück, Steak/Rouladen/Rostbraten/Beinscheiben in Stück, Gulasch/Siedfleisch in ca. kg, Knochen in Beuteln. Menge leer = unbekannt. Gewicht ist freiwillig – gewogene Hack- und Knochenkisten zählen wieder für die Ausbeute-Statistik. Beim Kommissionieren zeigt die App, wer aus welcher Kiste nimmt; ist eine Kiste früher leer, dort „Kiste leer“ antippen.</div></div></div>`;
  } else {
    // seit 3.7.1: Kisten aufs Feld ziehen (Maus oder Finger) – im Feld wird von unten nach oben gestapelt
    const inhaltVon = n => rows.filter(k => k.nr === n).map(k => handZeileText(S, k)).join(' + ');
    const sel = ui.kSel && nummern.includes(ui.kSel) ? ui.kSel : null;
    const chip = (n, e) => `<div class="kchip${sel === n ? ' sel' : ''}" data-act="kwahl" data-knr="${n}"${e ? ` data-e="${e}"` : ''}><b>K${n}</b> <span>${esc(inhaltVon(n))}</span></div>`;
    const imAuto = new Set();
    const hp = S.settings.hackPlatz || 'vorne rechts';
    const felder = S.auto.map(f => { const st = autoStapel(S, rows, f.name); st.forEach(n => imAuto.add(n)); return { f, st, h: Math.max(1, Math.round(num(f.hoehe)) || 4), p: autoPos(f.name) }; });
    const draussen = nummern.filter(n => !imAuto.has(n));
    const feldHtml = x => `<div class="auto-feld dz${x.st.length ? '' : ' leer'}${x.st.length >= x.h ? ' voll' : ''}" data-act="kfeld" data-feld="${esc(x.f.name)}" style="grid-row:${x.p.reihe + 1};grid-column:${autoSpalte(x.p)}">
      <div class="fn">${esc(x.f.name)} <span class="klein">${x.st.length}/${x.h}${sameText(x.f.name, hp) ? ' · Hack' : ''}</span></div>
      <div class="stapel">${x.st.map((n, i) => chip(n, i + 1)).join('')}${Array.from({ length: Math.max(0, x.h - x.st.length) }, () => '<div class="kfrei"></div>').join('')}</div></div>`;
    const gridOk = felder.every(x => x.p.reihe);
    h += `<div id="autoDnd" class="dndlayout">
      <div class="karte dz kablagekarte" data-act="kaus" data-dz="aus"><h3 style="margin-top:0">Noch nicht im Auto <span class="klein">(${draussen.length} von ${nummern.length})</span></h3>
        <div class="kablage">${draussen.map(n => chip(n)).join('') || `<span class="klein">${nummern.length ? 'Alle Kisten stehen im Auto. Zum Herausnehmen eine Kiste hierher ziehen.' : 'Erst unter „1 · Kisten füllen“ Kisten eintragen.'}</span>`}</div></div>
      <div class="karte" style="margin:0"><h3 style="margin-top:0">Auto <span class="klein">(oben = vorne · im Feld unten = unterste Kiste)</span></h3>
        ${gridOk ? `<div class="zeile oben" style="flex-wrap:nowrap"><div class="auto-grid dnd" style="grid-template-columns:repeat(6,1fr);flex:1;max-width:none">
          <div class="auto-tuer" style="grid-row:1;grid-column:1 / -1">— Fahrerhaus / vorne —</div>${felder.map(feldHtml).join('')}
          <div class="auto-tuer" style="grid-row:5;grid-column:1 / -1">— Tür hinten —</div></div><div class="klein" style="writing-mode:vertical-rl;align-self:center">rechte Tür ▸</div></div>`
          : `<div class="auto-grid dnd">${felder.map(x => feldHtml(Object.assign({}, x, { p: { reihe: 0, sp: 1 } }))).join('').replace(/style="grid-row:1;grid-column:[^"]*"/g, '')}</div>`}
        <p class="klein" style="margin:8px 0 0">Kiste mit dem Finger aufs Feld ziehen – sie kommt oben auf den Stapel, die erste Kiste steht unten. Auf eine Kiste ziehen = an ihre Stelle, die anderen rutschen hoch. Zurück in „Noch nicht im Auto“ ziehen = aus dem Auto. Geht auch mit Antippen: erst die Kiste, dann das Feld.</p></div></div>`;
  }
  ziel.innerHTML = h;
  const find = id => S.kisten.find(k => k.id === +id);
  const tierFuer = () => String(schluessel).split(TOPF_SEP)[0];
  ui.acts.sicht = el => { ui.kistenSicht = el.dataset.s; render(); };
  ui.acts.hneu = () => {
    const letzte = rows[rows.length - 1];
    const k = handNeueZeile(S, schluessel, letzte ? letzte.nr : 1, letzte && letzte.art !== SONDERKISTE ? letzte.art : BRATEN);
    if (letzte && letzte.platz) k.platz = letzte.platz;
    speichern(); render();
  };
  ui.acts.hneuK = () => { handNeueZeile(S, schluessel, Math.min(99, Math.max(...nummern) + 1), BRATEN); speichern(); render(); };
  ui.acts.hf = async el => {
    if ($('#dialog.auf')) return;
    const k = find(el.closest('tr').dataset.id); if (!k) return; const f = el.dataset.f;
    if (f === 'nr') {
      const n = Math.round(num(el.value)); if (n < 1 || n > 99) { meldung('Kistennummer 1 bis 99', true); render(); return; }
      k.nr = n; const andere = rows.find(x => x !== k && x.nr === n && x.platz); if (andere) k.platz = andere.platz; // gleiche Kiste = gleicher Platz
    } else if (f === 'menge') {
      if (el.value.trim() === '') k.menge = null;
      else { const v = num(el.value); if (!(v > 0) || v > 999) { meldung('Menge: bitte eine Zahl über 0 (oder leer lassen).', true); render(); return; }
        k.menge = (k.einh || handEinheit(S, k.art)) === 'kg' ? r2(v) : Math.round(v); }
    } else if (f === 'art') { k.art = el.value; if (k.art === HACK && !has(k.menge)) k.menge = num(S.settings.hackKiste) || 20; if (k.art !== HACK && k.einh !== handEinheit(S, k.art)) k.menge = null; if (k.art === BRATEN && !k.teil && bratenTeile(S).length) k.teil = bratenTeile(S)[0].name; }
    else if (f === 'teil') k.teil = el.value;
    else if (f === 'kgIst') {
      if (el.value.trim() === '') delete k.kgIst;
      else { const v = num(el.value), grenze = k.art === OCHS ? 15 : 35;
        if (!(v > 0)) { meldung('Gewicht: bitte eine Zahl über 0 kg (oder leer lassen).', true); render(); return; }
        if (v > grenze && !(await frage('Gewicht prüfen', `Kiste <b>${esc(k.nr)}</b> – ${esc(k.art)}: ${fmtNum(v, 2)} kg ist sehr viel für eine Kiste. Stimmt das? <span class="klein">(Komma beachten, z. B. 19,5)</span>`, 'Ja, stimmt', 'Korrigieren'))) { render(); return; }
        k.kgIst = r3(v); } }
    handZeileRechnen(S, k, tierFuer()); speichern(); render();
  };
  ui.acts.hweg = async el => { const k = find(el.dataset.id); if (!k) return;
    if (!(await frage('Zeile löschen', `Kiste <b>${esc(k.nr)}</b> – ${esc(handZeileText(S, k))} löschen?`, 'Löschen', 'Abbrechen', 'rot'))) return;
    S.kisten = S.kisten.filter(x => x !== k); speichern(); render(); };
  ui.acts.hleer = async el => { const k = find(el.dataset.id); if (!k) return;
    if (!(await frage('Kiste wieder voll?', `Kiste <b>${esc(k.nr)}</b> – ${esc(k.art)} ist als <b>leer</b> gemeldet. Zurücknehmen? Dann bekommen offene Bestellungen wieder daraus.`, 'Zurücknehmen'))) return;
    kisteLeerSetzen(S, tn, k.nr, k.art, false); speichern(); render(); };
  ui.acts.hsonder = async el => {
    const k = find(el.dataset.id); if (!k) return;
    const liste = handSonderListe(S, tn);
    if (!liste.length) return dialog('Sonderfälle', '<p>Für diesen Abholtag gibt es keine Sonderfälle auf der Metzgerliste.</p>');
    const { k: kn, werte } = await dialogFelder(`Kiste ${k.nr}: Sonderfälle`, `<p class="klein">Antippen, was in Kiste ${k.nr} liegt. Ein Sonderfall liegt immer in genau einer Kiste.</p>
      ${liste.map((x, i) => `<label class="zeile" style="gap:10px;padding:6px 0;border-bottom:1px solid #eee;align-items:center"><input type="checkbox" id="s${i}" style="width:28px;height:28px" ${(k.sonder || []).includes(x.key) ? 'checked' : ''}>
        <span>${esc(x.text)}${x.kiste !== null && x.kiste !== k.nr ? ` <span class="marke gelb">jetzt in Kiste ${x.kiste}</span>` : ''}</span></label>`).join('')}`,
      [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Übernehmen', cls: 'haupt' }]);
    if (kn !== 'ok') return;
    const neu = liste.filter((x, i) => werte['s' + i] === true || (werte['s' + i] === undefined && (k.sonder || []).includes(x.key))).map(x => x.key);
    for (const r of ctx.rows) if (r !== k && r.art === SONDERKISTE && r.sonder) r.sonder = r.sonder.filter(x => !neu.includes(x));
    k.sonder = neu; speichern(); render();
  };
  // Auto beladen: Ablegen (Ziehen oder Antippen)
  const stellen = (nr, feldName, anNr) => {
    if (anNr === nr) { render(); return; }
    const f = kisteStellen(S, rows, nr, feldName, anNr);
    if (f) { meldung(f, true); render(); return; }
    ui.kSel = null; speichern(); render();
  };
  ui.acts.kwahl = el => {
    if (Date.now() - (ui.kZiehZeit || 0) < 400) return; // Klick direkt nach dem Ziehen ignorieren
    const n = +el.dataset.knr;
    if (ui.kSel && ui.kSel !== n && el.closest('[data-feld]')) return stellen(ui.kSel, el.closest('[data-feld]').dataset.feld, n);
    ui.kSel = ui.kSel === n ? null : n; render();
  };
  ui.acts.kfeld = el => { if (Date.now() - (ui.kZiehZeit || 0) < 400 || !ui.kSel) return; stellen(ui.kSel, el.dataset.feld); };
  ui.acts.kaus = () => { if (Date.now() - (ui.kZiehZeit || 0) < 400 || !ui.kSel) return; stellen(ui.kSel, ''); };
  const dnd = $('#autoDnd');
  if (dnd) {
    let z = null;
    const zielUnter = (x, y) => { const el = document.elementFromPoint(x, y); if (!el) return null;
      const c = el.closest('[data-feld] .kchip'), f = el.closest('[data-feld]'), a = el.closest('[data-dz="aus"]');
      return f ? { feld: f.dataset.feld, an: c ? +c.dataset.knr : null, el: f } : a ? { feld: '', el: a } : null; };
    const markieren = t => { dnd.querySelectorAll('.dz.ueber').forEach(e => e.classList.remove('ueber')); if (t) t.el.classList.add('ueber'); };
    const ende = () => { if (z && z.geist) z.geist.remove(); if (z && z.el) z.el.classList.remove('zieht'); markieren(null); z = null; };
    dnd.addEventListener('pointerdown', e => {
      const c = e.target.closest('.kchip'); if (!c || (e.pointerType === 'mouse' && e.button !== 0)) return;
      z = { nr: +c.dataset.knr, el: c, x: e.clientX, y: e.clientY, id: e.pointerId, geist: null };
    });
    dnd.addEventListener('pointermove', e => {
      if (!z || e.pointerId !== z.id) return;
      if (!z.geist) {
        if (Math.hypot(e.clientX - z.x, e.clientY - z.y) < 8) return;
        const r = z.el.getBoundingClientRect();
        z.geist = z.el.cloneNode(true); z.geist.classList.add('geist'); z.geist.style.width = Math.min(r.width, 260) + 'px';
        document.body.appendChild(z.geist); z.el.classList.add('zieht');
        try { z.el.setPointerCapture(e.pointerId); } catch (x) { }
      }
      e.preventDefault();
      // am Bildschirmrand weiterrollen, damit auch Felder außerhalb erreichbar sind
      const dy = e.clientY > innerHeight - 70 ? 18 : e.clientY < 120 ? -18 : 0;
      if (dy) { let sc = dnd.parentElement; while (sc && sc !== document.body && !(sc.scrollHeight > sc.clientHeight + 2 && /auto|scroll/.test(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
        (sc && sc !== document.body ? sc : document.scrollingElement).scrollBy(0, dy); }
      z.geist.style.left = (e.clientX - 20) + 'px'; z.geist.style.top = (e.clientY - 20) + 'px';
      markieren(zielUnter(e.clientX, e.clientY));
    });
    dnd.addEventListener('pointerup', e => {
      if (!z || e.pointerId !== z.id) return;
      if (!z.geist) { z = null; return; } // nur angetippt → Klick wählt aus
      const t = zielUnter(e.clientX, e.clientY), nr = z.nr; ende(); ui.kZiehZeit = Date.now();
      if (t) stellen(nr, t.feld, t.an); else render();
    });
    dnd.addEventListener('pointercancel', ende);
  }
  const teilen = async d => { const r = await docTeilen(d, d.title); if (r === 'gespeichert') meldung('Bild gespeichert.'); };
  const kistenDoc = () => docKistenHand(tp && tp.glieder ? tp.name : tn, kistenCalc(S, tn), tp || t);
  ui.acts.teilenKisten = () => teilen(kistenDoc());
  ui.acts.drucken = () => docDrucken(kistenDoc());
  ui.acts.abschluss = () => kistenAbschluss(tn, calc, !!(tp && tp.glieder));
}
function docKistenHand(tn, calc, t) {
  const nummern = [...new Set(calc.map(c => c.k.nr))].sort((a, b) => a - b);
  return { title: `Kisten – ${tn}`, sub: [t ? abholTxt(t) : '', `${nummern.length} Kisten · von Hand eingetragen`],
    blocks: [{ type: 'table', head: ['Kiste', 'Inhalt', 'Platz im Auto', 'übrig (ca.)'], widths: [1, 6, 2.6, 2], align: ['r', '', '', 'r'],
      rows: nummern.map(n => { const cs = calc.filter(c => c.k.nr === n);
        return [n, cs.map(c => handZeileText(S, c.k) + (c.k.art === SONDERKISTE && c.teile ? '\n' + c.teile.split(' · ').join('\n') : '')).join('\n'), cs[0].k.platz || '',
          cs.filter(c => c.k.art !== SONDERKISTE).map(c => c.k.leer ? 'leer' : has(c.restStk) ? fmtNum(c.restStk, 0) + ' Stk' : c.rest === null ? '?' : fmtNum(c.rest, 1) + ' ' + (c.einheit || 'kg')).join('\n')]; }) }], footer: fussZeile() };
}

function tabPackliste(tn, ziel) {
  const pl = packliste(S, tn);
  ziel.innerHTML = `<div class="knopfleiste" style="margin-bottom:10px"><button class="btn haupt" data-act="teilen">Als Bild teilen</button><button class="btn" data-act="drucken">Drucken</button></div>
    <div class="klein" style="margin-bottom:8px">Endbetrag nach dem Wiegen eintragen. Status antippen: offen → gepackt (mit Lagerplatz) → abgeholt.</div>
    <div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Name</th><th>Telefon</th><th>Bestellung</th><th>Sonderfälle</th><th>Lagerplatz</th><th class="r">Schätzpreis</th><th class="r">Endbetrag</th><th>Status</th></tr></thead><tbody>
    ${pl.rows.map(r => `<tr data-nr="${r.nr}"><td class="r"><a href="#/bestellung/${r.nr}">${r.nrT || r.nr}</a></td><td class="fett">${esc(r.name)}</td><td>${r.tel ? `<a href="tel:${esc(r.tel)}">${esc(r.tel)}</a>` : ''}</td><td class="klein">${esc(r.text)}${r.notiz ? `<div class="packnotiz-k">Notiz: ${esc(r.notiz)}</div>` : ''}</td><td class="klein">${esc(r.sonder)}</td><td>${r.lager ? `<b>${esc(r.lager)}</b>` : `<span class="klein">Vorschlag: ${esc(r.lagerVorschlag)}</span>`}</td><td class="r">${fmtEur(r.schaetz)}</td>
      <td style="width:120px"><input class="feld zahl" inputmode="decimal" data-ch="betrag" value="${r.endbetrag !== null ? fmtIn(r.endbetrag, 2, 2) : ''}"></td><td><button class="btn klein" data-act="status">${statusMarke(r.status)}</button>${r.status === 'abgeholt' ? `<button class="btn klein" data-act="zahl">${r.zahlOffen ? '<span class="marke rot">Zahlung offen</span>' : '<span class="marke gruen">bezahlt</span>'}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="9" class="klein">Keine Bestellungen für dieses Tier.</td></tr>'}
    </tbody></table></div>`;
  const best = el => S.bestellungen.find(o => o.nr === +el.closest('tr').dataset.nr);
  ui.acts.betrag = el => { const o = best(el); const v = num(el.value); if (el.value.trim() !== '' && !(v >= 0)) { meldung('Endbetrag: bitte einen Betrag ab 0 € eintragen.', true); el.value = has(o.endbetrag) ? fmtIn(o.endbetrag, 2, 2) : ''; return; } o.endbetrag = el.value.trim() === '' ? null : r2(v); speichern(); };
  ui.acts.status = async el => {
    const o = best(el); const f = ['offen', 'gepackt', 'abgeholt']; const neu = f[(f.indexOf(o.status || 'offen') + 1) % 3];
    if (neu === 'gepackt') { if (!(await lagerDialog(o))) return; }
    else if (neu === 'abgeholt') {
      const k = await dialog(`Nr. ${nrText(o)} abgeholt`, `<p>${esc(o.name)}${has(o.endbetrag) ? ' · Endbetrag <b>' + fmtEur(o.endbetrag) + '</b>' : ''}</p><p>Ist schon bezahlt?</p>`,
        [{ k: 'x', t: 'Abbrechen' }, { k: 'offen', t: 'Bezahlung offen', cls: 'rot' }, { k: 'ok', t: 'Bezahlt ✓', cls: 'haupt' }]);
      if (k !== 'ok' && k !== 'offen') return;
      statusSetzen(S, o, 'abgeholt', k === 'offen'); speichern();
    } else {
      // zurück auf „offen“ (seit 3.4 nur nach Nachfrage – ein versehentlicher Tipp löschte Lagerplatz, Abholdatum, Zahlung und Preis)
      if (!(await frage('Status zurücksetzen', `Nr. ${nrText(o)} – <b>${esc(o.name)}</b> wieder auf <b>offen</b> setzen?<br><span class="klein">Lagerplatz${o.status === 'abgeholt' ? ', Abholdatum, „Bezahlung offen“ und der festgehaltene Preis' : ''} werden dabei gelöscht.</span>`, 'Auf offen setzen', 'Abbrechen', 'rot'))) return;
      statusSetzen(S, o, neu); speichern();
    }
    render();
  };
  ui.acts.zahl = el => { const o = best(el); o.zahlungOffen = !o.zahlungOffen; speichern(); meldung(`Nr. ${nrText(o)}: ${o.zahlungOffen ? 'Bezahlung offen' : 'bezahlt'}.`); render(); };
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
  // Topf: alle Bestellungen des Abholtags in einer Reihenfolge (wie die Kisten geplant sind)
  const ords = !tn ? [] : kistenRows(S, tn).length ? kistenKontext(S, tn).ords : ordersOfTopf(S, topfTier(S, tn));
  let nr = q.get('nr') === 'hof' ? 'hof' : +q.get('nr') || ui.kommiNr;
  if (nr !== 'hof' && !ords.some(o => o.nr === nr)) nr = (ords.find(o => (o.status || 'offen') === 'offen') || ords[0] || {}).nr;
  ui.kommiNr = nr;
  let h = `<div class="zeile" style="margin-bottom:12px"><h1 class="platz" style="margin:0">Kommissionieren</h1>
    <label class="f" style="min-width:300px">Tier<select class="feld" data-ch="tierwahl">${tiereSortiert().map(t => { const tp = topfTier(S, t.name); return opt(t.name, `${t.name} – ${abholTxt(t)}${tp && tp.glieder ? ' (ein Topf: ' + tp.name + ')' : ''}`, t.name === tn); }).join('')}</select></label></div>`;
  if (!ords.length) { inhalt().innerHTML = h + '<div class="karte">Keine Bestellungen für dieses Tier.</div>'; ui.acts.tierwahl = el => { ui.tierWahl = el.value; ui.kommiNr = null; render(); }; return; }
  const idx = nr === 'hof' ? ords.length : ords.findIndex(o => o.nr === nr);
  const ohneKisten = !kistenRows(S, tn).length;
  h += `<div class="zeile" style="margin-bottom:12px">
      <button class="btn" data-act="vor" data-d="-1" ${idx <= 0 ? 'disabled' : ''}>◀ vorige</button>
      <select class="feld platz" data-ch="nrwahl">${ords.map(o => opt(o.nr, `Nr. ${nrText(o)} – ${o.name} (${o.status || 'offen'})`, o.nr === nr)).join('')}${ohneKisten ? '' : opt('hof', '▣ Hofladen – Reste verpacken (zum Schluss)', nr === 'hof')}</select>
      <button class="btn" data-act="vor" data-d="1" ${idx >= ords.length - (ohneKisten ? 1 : 0) ? 'disabled' : ''}>nächste ▶</button></div>`;
  ui.acts.tierwahl = el => { ui.tierWahl = el.value; ui.kommiNr = null; render(); };
  ui.acts.nrwahl = el => { ui.kommiNr = el.value === 'hof' ? 'hof' : +el.value; gehe('#/kommissionierung?nr=' + el.value); };
  ui.acts.vor = el => { const i = idx + num(el.dataset.d); const o = ords[i]; if (o) gehe('#/kommissionierung?nr=' + o.nr); else if (i === ords.length) gehe('#/kommissionierung?nr=hof'); };
  if (nr === 'hof') return kommiHofladen(tn, h);
  const ko = kommissionierung(S, nr);
  const offenZeilen = ko.picks.filter(p => !p.ist).length;
  const verm = kommVermerke(ko.o);
  h += `
    ${ohneKisten ? '<div class="hinweis">Für dieses Tier sind noch keine Kisten eingetragen (Schlachttag → Kisten & Ladeplan → „1 · Kisten füllen“).</div>' : ''}
    <div class="spalten2"><div class="karte">
      <h2 style="margin-top:0">Nr. ${esc(nrText(ko.o))} – ${esc(ko.o.name)} ${statusMarke(ko.o.status)}${zahlMarke(ko.o)}</h2>
      ${ko.o.packNotiz ? `<div class="packnotiz"><span class="klein">Notiz zur Bestellung</span><div>${esc(ko.o.packNotiz).replace(/\n/g, '<br>')}</div></div>` : ''}
      ${(() => { const lv = lagerVorschlag(S, ko.o); const ort = ko.o.lagerOrt || lv.ort;
        return `<div class="lagerbox ${ort === 'Kühlschrank' ? 'ks' : 'kr'}"><div class="klein">${ko.o.lagerOrt ? 'verräumt' : 'Lagerplatz nach dem Packen'}</div><div class="lagerort">${ort === 'Kühlschrank' ? '❄ Kühlschrank' : '▣ Kühlraum – Metzgerkiste'}${ko.o.lagerPlatz ? ' · ' + esc(lagerPlatzText(ko.o)) : ''}</div><div class="klein">${esc(lv.grund)}</div></div>`; })()}
      <table class="doc-kv"><tr><td>Genusspakete</td><td class="fett">${fmtNum(ko.o.pakete) || '–'}${num(ko.o.pakVak) ? ` (davon ${fmtNum(ko.o.pakVak)} vakuumieren)` : ''}</td></tr>
      <tr><td>Sonderfälle (Metzger)</td><td class="fett">${esc(ko.sonder.join('; ') || '–')}</td></tr>
      <tr><td>Nicht vakuumieren</td><td class="fett">${esc(ko.nichtVak.join(', ') || '–')}</td></tr>
      ${ko.o.notiz ? `<tr><td>Notiz</td><td class="fett">${esc(ko.o.notiz)}</td></tr>` : ''}
      ${verm.length ? `<tr><td>Vermerke Kommission</td><td class="fett warn">${esc(verm.join(' · '))}</td></tr>` : ''}</table>
      <div class="knopfleiste" style="margin-top:14px"><button class="btn haupt" data-act="gepackt">Gepackt ✓ und weiter</button><button class="btn" data-act="teilen">Als Bild teilen</button><button class="btn" data-act="drucken">Drucken</button></div>
      <h3>Bedarf</h3><table class="tab"><thead><tr><th>Artikel</th><th class="r">einzeln</th><th class="r">aus Paketen</th><th class="r">Bedarf</th><th class="r">aus Kisten</th><th class="r">fehlt</th></tr></thead><tbody>
      ${ko.rows.filter(r => r.bedarf > 0.0001).map(r => `<tr class="${r.fehlt > 0 ? 'rot' : ''}"><td>${esc(r.art)}${istOrgan(r.art) ? ' <span class="klein">(separat)</span>' : ''}</td><td class="r">${fmtNum(r.einzeln, 2)}</td><td class="r">${fmtNum(r.ausPak, 2)}</td><td class="r">${fmtNum(r.bedarf, 2)}</td><td class="r">${fmtNum(r.ausKisten, 2)}</td><td class="r">${r.fehlt > 0 ? fmtNum(r.fehlt, 2) : ''}</td></tr>`).join('')}
      </tbody></table></div>
    <div class="karte" style="padding:0"><h3 style="margin:14px 16px 4px">Pickliste – antippen, wiegen, bestätigen <span class="klein">${offenZeilen ? offenZeilen + ' offen' : 'alles erledigt ✓'}</span></h3>
      ${ko.picks.map((p, i) => `<div class="pick ${p.ist ? 'erledigt' : ''}" data-act="pick" data-i="${i}"><div class="kiste${p.hackTisch ? ' hack' : ''}${p.innTisch ? ' inn' : ''}${p.sonderfall ? ' sonder' : ''}">${p.hackTisch ? 'Hack' : p.innTisch ? 'Inner&shy;eien' : p.kiste === null ? '–' : p.kiste}</div><div class="menge">${pickMengeHtml(p)}</div><div><b>${esc(p.art)}</b>${p.nichtVak ? ` <span class="nvak">NICHT VAKUUMIEREN${p.nichtVak === 'einzeln' ? ' (einzeln)' : ''}</span>` : ''}${p.verpacken ? `<div class="klein">${esc(p.verpacken)}</div>` : ''}${p.ist && p.ist.vermerk ? `<div class="klein warn">Vermerk: ${esc(p.ist.vermerk)}</div>` : ''}</div><div class="klein r">${p.ist ? `<span class="ist">✓ ${istText(p.ist, p)}</span><br>` : p.wiegen ? '<span class="klein">wiegen</span><br>' : ''}${esc(p.platz)}${p.hand ? `<br><button class="btn klein ${p.kisteLeer ? 'rot' : ''}" data-act="kleer" data-i="${i}" style="margin-top:6px">${p.kisteLeer ? 'Kiste leer ✓' : 'Kiste leer'}</button>` : ''}</div></div>`).join('') || '<div style="padding:16px" class="klein">Nichts aus den Kisten zu holen.</div>'}
      <div class="knopfleiste pickende">${offenZeilen ? `<span class="klein platz">${offenZeilen} ${offenZeilen === 1 ? 'Zeile' : 'Zeilen'} offen</span>` : '<span class="klein platz ok">alles erledigt ✓</span>'}
        <button class="btn" data-act="vor" data-d="-1" ${idx <= 0 ? 'disabled' : ''}>◀ vorige</button>
        <button class="btn haupt" data-act="gepackt">Gepackt ✓ und weiter</button>
        <button class="btn" data-act="vor" data-d="1" ${idx >= ords.length - (ohneKisten ? 1 : 0) ? 'disabled' : ''}>nächste ▶</button></div>
    </div></div>`;
  inhalt().innerHTML = h;
  // Kisten von Hand (seit 3.7): Kiste ist früher leer als eingetragen → ab dieser Bestellung kommt der Rest aus der nächsten Kiste
  ui.acts.kleer = async el => { const p = ko.picks[+el.dataset.i]; if (!p) return;
    if (p.kisteLeer) { kisteLeerSetzen(S, tn, p.kiste, p.art, false); speichern(); meldung(`Kiste ${p.kiste} – ${p.art}: nicht mehr leer.`); render(); return; }
    if (!(await frage('Kiste leer', `Kiste <b>${esc(p.kiste)}</b> – ${esc(p.art)} ist jetzt leer?<br><span class="klein">Diese Bestellung behält ihre Zeile aus Kiste ${esc(p.kiste)} (beim Wiegen die echte Menge eintragen). Alle weiteren Bestellungen bekommen ${esc(p.art)} aus der nächsten Kiste – gibt es keine, steht es als „fehlt“.</span>`, 'Ja, leer'))) return;
    kisteLeerSetzen(S, tn, p.kiste, p.art, true, nr); speichern(); render(); };
  ui.acts.pick = async el => { const p = ko.picks[+el.dataset.i]; const o = S.bestellungen.find(x => x.nr === nr); if (!p || !o) return; if (await pickDialog(o, p)) render(); };
  ui.acts.gepackt = async () => {
    const o = S.bestellungen.find(x => x.nr === nr);
    if (offenZeilen && !(await frage('Noch nicht alles gewogen', `${offenZeilen} ${offenZeilen === 1 ? 'Zeile ist' : 'Zeilen sind'} noch nicht gewogen bzw. abgehakt. Trotzdem als gepackt melden?`, 'Trotzdem gepackt', 'Zurück'))) return;
    if (!(await lagerDialog(o))) return;
    const naechste = ords.slice(idx + 1).find(x => (x.status || 'offen') === 'offen') || ords[idx + 1];
    meldung(`Nr. ${nrText(o)} gepackt → ${lagerText(o)}.`);
    if (naechste) gehe('#/kommissionierung?nr=' + naechste.nr); else if (!ohneKisten) gehe('#/kommissionierung?nr=hof'); else render();
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
  // je Tier (Abschluss) eine Gruppe, neueste zuerst
  const gruppen = [];
  for (const x of liste) { const key = x.h.tier + '|' + x.h.datum; let g = gruppen.find(y => y.key === key); if (!g) { g = { key, tier: x.h.tier, datum: x.h.datum, l: [], kg: 0, stk: 0, pk: 0 }; gruppen.push(g); } g.l.push(x); if (x.h.einheit === 'Stk') { g.stk += num(x.h.rest); g.kg += num(x.h.kg); } else g.kg += num(x.h.rest); if (x.h.paeckchen) g.pk++; }
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:12px"><h1 class="platz" style="margin:0">Reste an den Hofladen</h1>
    ${jahre.length > 1 ? `<select class="feld" style="width:auto" data-ch="jahr">${jahre.map(j => opt(j, j, j === jahr)).join('')}</select>` : ''}</div>
    <div class="klein" style="margin-bottom:10px">Wird von „Tier abgeschlossen“ (Schlachttag → Kisten & Ladeplan) gefüllt: die beim Kommissionieren gewogenen Hofladen-Päckchen (mit Kühlhaus-Kiste) – wo keine gewogen wurden, der rechnerische Rest in den Kisten.</div>
    <div class="spalten2"><div class="karte"><h3 style="margin-top:0">Summe ${jahr}</h3><table class="tab"><tbody>${sum.map(s => `<tr><td>${esc(s.art)}</td><td class="r fett">${fmtNum(s.summe, 2)} ${esc(s.einheit)}</td></tr>`).join('') || '<tr><td class="klein">noch nichts</td></tr>'}</tbody></table></div>
    <div>${gruppen.map((g, gi) => `<details class="karte hofgr" data-g="${gi}" style="padding:4px 14px;margin-bottom:8px"${ui.hofOffen === g.key ? ' open' : ''}><summary class="zeile" style="cursor:pointer;gap:14px"><span class="fett">${esc(g.tier)}</span><span>${fmtDate(g.datum)}</span><span class="klein">${g.l.length} ${g.l.length === 1 ? 'Eintrag' : 'Einträge'}${g.pk ? ` · ${g.pk} Päckchen` : ''} · ca. ${fmtNum(g.kg, 1)} kg${g.stk ? ` + ${fmtNum(g.stk)} Stk` : ''}</span><span class="klein" style="margin-left:auto">antippen ▾</span></summary><div class="hofrows"></div></details>`).join('') || '<div class="karte klein">keine Einträge</div>'}</div></div>`;
  // Zeilen erst beim Aufklappen aufbauen (seit 3.3 – ein Jahr hat schnell über 2000 Einträge, das ist auf dem Tablet zu langsam)
  const zeilen = g => `<div class="tabwrap" style="margin-top:8px"><table class="tab"><thead><tr><th class="r">Kiste</th><th>Artikel</th><th class="r">Rest</th><th></th></tr></thead><tbody>
    ${g.l.map(({ h, i }) => `<tr><td class="r">${h.kiste}${h.kuehlhaus ? `<div class="klein">→ Kühlhaus ${h.kuehlhaus}</div>` : ''}</td><td>${esc(h.art)}${h.teil ? ` <span class="klein">– ${esc(h.teil)}</span>` : ''}${h.paeckchen ? ' <span class="klein">(Päckchen)</span>' : ''}</td><td class="r">${fmtNum(h.rest, h.paeckchen ? 3 : 2)} ${esc(h.einheit)}${h.stk ? ` <span class="klein">· ${fmtNum(h.stk)} Stk</span>` : ''}${h.kg ? ` <span class="klein">· ${fmtNum(h.kg, 2)} kg</span>` : ''}</td><td><button class="btn klein rot" data-act="weg" data-i="${i}">✕</button></td></tr>`).join('')}
    </tbody></table></div>`;
  const fuellen = d => { const g = gruppen[+d.dataset.g]; const z = $('.hofrows', d); if (d.open && g && !z.innerHTML) z.innerHTML = zeilen(g); if (d.open && g) ui.hofOffen = g.key; };
  $$('details[data-g]').forEach(d => { d.addEventListener('toggle', () => fuellen(d)); fuellen(d); });
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
  const heute = todayISO();
  const liste = preislisten(S);
  const aktuell = preislisteAm(S, heute);
  let pl = liste.find(p => p.ab === ui.plAb) || aktuell;
  ui.plAb = pl.ab;
  // echtes Objekt in den Einstellungen (preislisten() liefert eine sortierte Kopie der Liste, die Objekte sind dieselben)
  const status = p => p === aktuell ? '<span class="marke gruen">gilt jetzt</span>' : p.ab > heute ? '<span class="marke gelb">kommt</span>' : '<span class="marke">früher</span>';
  const offen = S.bestellungen.filter(o => o.name && (o.status || 'offen') !== 'abgeholt' && !(tier(S, o.tier) || {}).archiv);
  const anzahlFuer = p => offen.filter(o => preislisteAm(S, preisDatum(S, o)) === p).length;
  z.innerHTML = `<div class="hinweis klein">Die Preise gelten auch für die Vordrucke (Bestellformular A4/A5, Infozettel): <a href="#/vordrucke">Vordrucke ansehen und drucken</a></div>
   <div class="karte"><h3 style="margin-top:0">Preislisten <span class="klein">– maßgeblich ist der <b>Abholtermin</b> des Tiers (Warteliste: Wunschtermin, sonst heute)</span></h3>
    <div class="zeile" style="flex-wrap:wrap;gap:8px">${liste.map(p => `<button class="btn ${p === pl ? 'haupt' : ''}" data-act="plwahl" data-ab="${p.ab}">ab ${fmtDate(p.ab)} ${status(p)}<br><span class="klein">${anzahlFuer(p)} offene Bestellungen</span></button>`).join('')}
     <button class="btn" data-act="plneu">+ Neue Preisliste ab …</button></div>
    <div class="zeile" style="margin-top:12px;gap:12px;align-items:flex-end"><label class="f" style="width:200px">Gültig ab<input class="feld" type="date" data-ch="plab" value="${pl.ab}"></label>
     ${liste.length > 1 && pl.ab > heute ? '<button class="btn rot" data-act="plweg">Diese Preisliste löschen</button>' : ''}
     <p class="klein platz" style="margin:0">Du bearbeitest unten die Preisliste <b>ab ${fmtDate(pl.ab)}</b>. Beispiel: neue Preise ab 01.01. – Tiere mit Abholung im Dezember rechnen weiter mit den alten Preisen, ab Januar mit den neuen. Eingetragene Endbeträge ändern sich nie.</p></div></div>
   <div class="karte"><h3 style="margin-top:0">Genusspaket <span class="klein">– Inhalt unter Einstellungen → Genusspaket, zurzeit ca. ${fmtNum(paketGewicht(S), 1)} kg</span></h3><div class="zeile">
    ${[['preisPaketKg', 'Preis je kg (€)', paketPreisKg(S, pl)], ['preisVakPaket', 'Vakuumieren je Paket (€)', vakPreisPaket(S, pl)]].map(([f, t, v]) => `<label class="f" style="width:180px">${t}<input class="feld zahl" inputmode="decimal" data-ch="plpaket" data-f="${f}" value="${fmtIn(v, 2)}"></label>`).join('')}
    ${(() => { const ew = paketEinzelwert(S, pl), pk = num(paketPreisKg(S, pl)), paket = pk * ew.kg, vorteil = ew.eur - paket;
      return `<label class="f" style="width:200px">Einzeln gekauft (€/kg)<div class="feld zahl" style="background:#eef4e6;font-weight:700" title="Inhalt des Genusspakets zu den Einzelpreisen dieser Preisliste">${fmtNum(ew.jeKg, 2, 2)}</div></label>
      <p class="klein" style="margin:22px 0 0;max-width:430px">Paketinhalt einzeln ca. <b>${fmtEur(ew.eur)}</b>, als Genusspaket ca. <b>${fmtEur(paket)}</b> – ${vorteil >= 0 ? `Kunde spart ca. <b>${fmtEur(vorteil)}</b> (${fmtNum(ew.eur > 0 ? vorteil / ew.eur * 100 : 0, 0)} %)` : `Paket ist <b>${fmtEur(-vorteil)}</b> teurer als einzeln`}. Ohne Vakuumieren.</p>`; })()}</div></div>
   <div class="tabwrap"><table class="tab"><thead><tr><th>Artikel</th><th>bestellt in</th><th class="r">Preis (€/kg) ab ${fmtDate(pl.ab)}</th>${pl !== aktuell ? `<th class="r klein">gilt jetzt</th>` : ''}<th class="r">im Genusspaket</th><th class="c">„am Stück“ möglich</th></tr></thead><tbody>
   ${S.artikel.map((a, i) => `<tr data-i="${i}"><td class="fett">${esc(a.name)}</td><td>${esc(a.einheit)}</td>
     <td style="width:110px"><input class="feld zahl" inputmode="decimal" data-ch="plpreis" value="${fmtIn(artPreis(S, a, pl), 2)}"></td>
     ${pl !== aktuell ? `<td class="r klein">${fmtNum(artPreis(S, a, aktuell), 2, 2)}</td>` : ''}
     <td class="r klein">${paketListe(S).filter(p => p.art === a.name).map(p => `${fmtNum(p.anzahl)} × ${fmtNum(paketG(S, p))} g`).join(' + ')}</td>
     <td class="c"><label class="check"><input type="checkbox" data-ch="art" data-f="amStueck"${a.amStueck ? ' checked' : ''}></label></td>
</tr>`).join('')}
   </tbody></table></div><p class="klein">Alle Preise in €/kg – auch bei Innereien, die nach Stück bestellt werden (Schätzpreis = Anzahl × Stückgewicht × €/kg). „im Genusspaket“ wird unter Einstellungen → Genusspaket festgelegt. Stück- und Beutelgewichte: unter „Ausbeute & Kisten“. Preisänderungen wirken sofort auf die Schätzpreise aller Bestellungen, deren Abholtermin in diese Preisliste fällt.</p>`;
  const fertig = (txt = 'Gespeichert.') => { preiseAbgleichen(S); speichern(); meldung(txt); render(); };
  ui.acts.plwahl = el => { ui.plAb = el.dataset.ab; render(); };
  ui.acts.st = el => { S.settings[el.dataset.f] = el.type === 'text' && !el.classList.contains('zahl') ? el.value : num(el.value); speichern(); meldung('Gespeichert.'); };
  ui.acts.art = el => { const a = S.artikel[+el.closest('tr').dataset.i]; a[el.dataset.f] = el.type === 'checkbox' ? el.checked : num(el.value); speichern(); meldung('Gespeichert.'); };
  ui.acts.plpreis = el => { const a = S.artikel[+el.closest('tr').dataset.i]; pl.preise = pl.preise || {}; pl.preise[a.name] = r2(num(el.value)); fertig(); };
  ui.acts.plpaket = el => { pl[el.dataset.f] = r2(num(el.value)); fertig(); };
  ui.acts.plab = el => {
    const neu = el.value;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(neu)) { el.value = pl.ab; return meldung('Bitte ein Datum wählen.', true); }
    if (liste.some(p => p !== pl && p.ab === neu)) { el.value = pl.ab; return meldung(`Ab ${fmtDate(neu)} gibt es schon eine Preisliste.`, true); }
    pl.ab = neu; ui.plAb = neu; fertig(`Preisliste gilt jetzt ab ${fmtDate(neu)}.`);
  };
  ui.acts.plneu = async () => {
    const { k, werte } = await dialogFelder('Neue Preisliste', `<p>Ab wann gelten die neuen Preise? Maßgeblich ist der Abholtermin des Tiers. Die Preise werden von der Preisliste ab ${fmtDate(pl.ab)} übernommen und können dann geändert werden.</p><label class="f">Gültig ab<input class="feld" type="date" id="plneuab" value="${String(+heute.slice(0, 4) + 1)}-01-01"></label>`, [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Anlegen', cls: 'haupt' }]);
    if (k !== 'ok') return;
    const ab = String(werte.plneuab || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ab)) return meldung('Bitte ein Datum wählen.', true);
    if (liste.some(p => p.ab === ab)) return meldung(`Ab ${fmtDate(ab)} gibt es schon eine Preisliste.`, true);
    S.settings.preislisten.push({ ab, preise: Object.fromEntries(S.artikel.map(a => [a.name, artPreis(S, a, pl)])), preisPaketKg: paketPreisKg(S, pl), preisVakPaket: vakPreisPaket(S, pl) });
    ui.plAb = ab; fertig(`Preisliste ab ${fmtDate(ab)} angelegt – jetzt die neuen Preise eintragen. Die passenden Bestellzettel stehen sofort unter Vordrucke bereit.`);
  };
  ui.acts.plweg = async () => {
    if (!(await frage('Preisliste löschen', `Die Preisliste ab ${fmtDate(pl.ab)} löschen? Bestellungen rechnen dann mit der vorherigen Preisliste.`, 'Löschen', 'Abbrechen', 'rot'))) return;
    S.settings.preislisten = S.settings.preislisten.filter(p => p !== pl); ui.plAb = null; fertig('Preisliste gelöscht.');
  };
}
function tabAusbeute(z) {
  const st = S.settings;
  const eigen = st.rindWieBulle === false;
  const sB = S.artikel.reduce((s, a) => s + num(a.anteil), 0), sR = S.artikel.reduce((s, a) => s + anteilRef(S, a, 'Rind'), 0);
  const messTxt = (typ, kind, name, f = 100, dec = 2, eh = ' %') => { const g = gemessenRoh(S, typ, kind, name); return g ? `<div class="klein ${g.n >= STAT_MIN_TIERE ? 'ok fett' : ''}" title="${esc(g.tiere.join(', '))}">gemessen ${fmtNum(g.wert * f, dec)}${eh} (${g.n} ${g.n === 1 ? 'Tier' : 'Tiere'}${g.n >= STAT_MIN_TIERE ? ' – gilt' : ', ab ' + STAT_MIN_TIERE})</div>` : ''; };
  const feld = (f, t, dec = 0) => `<label class="f" style="width:250px">${t}<input class="feld zahl" inputmode="decimal" data-ch="st" data-f="${f}" value="${fmtIn(st[f], dec || 2)}"></label>`;
  const kref = kommReferenz(S);
  const hofArten = ausbeuteArtikel(S).map(a => a.name).filter(n => n !== HACK && !istOrgan(n)).concat(art(S, OCHS) ? [OCHS] : []);
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
      <td class="klein" style="width:110px">g je ${btl ? 'Beutel' : 'Stück'}${a.einheit === 'Stk' ? ' (für Schätzpreis)' : ''}</td><td class="klein r" style="width:110px">${!(num(a.ganzeStuecke) > 0) ? refText(a.stkMin, a.stkMax, 1000, 0, 'g') : ''}</td>
      <td class="klein r" style="width:190px">${kref[a.name] ? `gewogen Ø <b>${fmtNum(kref[a.name].g, 0)} g</b> (${fmtNum(kref[a.name].stk)} Stk)${a.name !== OCHS ? ` <button class="btn klein" data-act="egref" data-i="${i}" title="Referenz aus dem Kommissionieren als Einzelgewicht übernehmen">übernehmen</button>` : ''}` : ''}</td></tr>`; }).join('')}</tbody></table></div>
    <p class="klein" style="margin:6px 0 0">„gewogen Ø“ = Mittelwert aus dem Kommissionieren (Ist-Gewicht ÷ Stückzahl, Bestellungen und Hofladen-Päckchen).</p></div>
   <div class="karte"><h3 style="margin-top:0">Kommissionieren &amp; Hofladen verpacken</h3><div class="zeile oben">
    ${feld('kommToleranz', 'Toleranz Ist zu Soll ± (%) – darüber Vermerk nötig')}${feld('lagerKuehlhaus', 'Kühlhaus: Anzahl Kisten (Hofladen)')}</div>
    <p class="klein">So werden die Reste für den Hofladen verpackt (je Päckchen, vakuumiert; jedes Päckchen wird gewogen):</p>
    <div class="tabwrap" style="max-width:760px"><table class="tab"><tbody>${hofArten.map(n => { const g = hofRegel(S, n); return `<tr data-art="${esc(n)}"><td class="fett">${esc(n)}</td>
      <td style="width:190px"><select class="feld" data-ch="hofregel" data-f="r">${[['stk', 'je … Stück'], ['kg', 'je … kg'], ['ganz', 'ganz lassen'], ['halb', 'ganze Stücke halbieren'], ['kiste', 'bleibt in der Kiste']].map(([v, t]) => opt(v, t, g.r === v)).join('')}</select></td>
      <td style="width:260px">${g.r === 'stk' ? `<input class="feld zahl" style="width:90px" inputmode="numeric" data-ch="hofregel" data-f="n" value="${fmtIn(g.n)}"> Stück` : g.r === 'kg' ? `<input class="feld zahl" style="width:80px" inputmode="decimal" data-ch="hofregel" data-f="von" value="${fmtIn(g.von, 2)}"> bis <input class="feld zahl" style="width:80px" inputmode="decimal" data-ch="hofregel" data-f="bis" value="${fmtIn(g.bis, 2)}"> kg` : ''}</td>
      <td class="klein">${n === BRATEN ? 'Teilstück wird abgefragt · Bürgermeisterstück ganz' : ''}</td></tr>`; }).join('')}</tbody></table></div></div>
   <div class="karte"><h3 style="margin-top:0">Einstellungen</h3><div class="zeile oben">
    ${feld('sgBulle', 'Standard-Schlachtgewicht Bulle (kg)')}${feld('sgRind', 'Standard-Schlachtgewicht Rind/Färse (kg)')}
    ${feld('hackKiste', 'Hackfleisch je Metzgerkiste (kg)')}${feld('fettSiedProzent', 'Fettiges Hack: Anteil Siedfleisch (%)')}${feld('siedHackProzent', 'Siedfleisch, das bei Hack-Mangel ins Hack darf (höchstens %)')}${feld('terminMaxSG', 'Termin ohne Tier gilt als voll ab: Bulle mit … kg (leer = Standard Bulle)')}${feld('hackHof500Prozent', 'Hack für Hofladen: Anteil 500-g-Päckchen (%)')}${feld('kisteMax', 'Kiste max. (kg) – Packplan')}${feld('kisteAusnahme', 'Kiste in Ausnahmen bis (kg)')}

</div></div>
   <div class="karte"><h3 style="margin-top:0">Lagerplatz nach dem Packen</h3><p class="klein">Kühlschrank, wenn weniger Artikel als … <b>und</b> leichter als … kg – sonst Metzgerkiste im Kühlraum. Ein Genusspaket zählt als ein Artikel.</p><div class="zeile oben">
    ${feld('lagerMaxArtikel', 'Kühlschrank bei weniger als … Artikeln')}${feld('lagerMaxKg', 'und leichter als … kg')}${feld('lagerFaecher', 'Fächer im Kühlschrank (Anzahl)')}${feld('lagerKisten', 'Metzgerkisten im Kühlraum (Nr. 1 bis …)')}</div></div>
   <div class="karte"><h3 style="margin-top:0">Innereien je Tier (werden vorab separat geholt)</h3><div class="zeile oben">
    ${feld('leberKg', 'Leber ca. (kg)')}${feld('nierenStk', 'Nieren ca. (Stk)')}${feld('herzStk', 'Herz ca. (Stk)')}${feld('zungeStk', 'Zunge ca. (Stk)')}${feld('baeckleStk', 'Bäckle ca. (Stk)')}${feld('leberPortionG', 'Leber-Rest vakuumiert à (g)')}</div></div>
   <div class="karte"><h3 style="margin-top:0">Ochsenschwanz</h3><div class="zeile oben">${feld('ochsStk', 'Ochsenschwanz je Tier (Stk)')}<p class="klein" style="max-width:420px;margin:22px 0 0">Kein Innereien-Artikel: kommt immer zu den Beinscheiben/Waden in die Kiste und wird gewogen. Mit Häkchen „am Stück“ bestellt → bleibt ganz (Zeile im Metzgerauftrag), sonst schneidet der Metzger ihn wie gewohnt. Verkauf immer als ganzer Schwanz an eine Bestellung, Preis nach kg; nicht bestellte gehen beim Abschluss an den Hofladen.</p></div></div>`;
  ui.acts.st = el => { S.settings[el.dataset.f] = num(el.value); speichern(); render(); };
  ui.acts.egref = el => { const a = S.artikel[+el.dataset.i]; const r = kref[a.name]; if (!r) return; a.stueckG = Math.round(r.g); speichern(); meldung(`${a.name}: Einzelgewicht ${fmtNum(a.stueckG)} g übernommen.`); render(); };
  ui.acts.hofregel = el => {
    const n = el.closest('tr').dataset.art, f = el.dataset.f; S.settings.hofPack = S.settings.hofPack || {};
    const g = S.settings.hofPack[n] = Object.assign({}, hofRegel(S, n), S.settings.hofPack[n] || {});
    if (f === 'r') { g.r = el.value; if (g.r === 'stk' && !(num(g.n) > 0)) g.n = 1; if (g.r === 'kg' && !(num(g.von) > 0)) { g.von = 1; g.bis = 1.5; } }
    else g[f] = Math.max(0, num(el.value));
    if (g.r === 'kg' && num(g.bis) < num(g.von)) g.bis = g.von;
    speichern(); render();
  };
  ui.acts.eg = el => {
    const a = S.artikel[+el.closest('tr').dataset.i], f = el.dataset.f, v = num(el.value);
    if (f === 'beutelG' && !(v > 0)) { meldung('Beutelgröße muss größer 0 sein.', true); return render(); }
    a[f] = v > 0 ? v : 0; speichern(); meldung('Gespeichert.'); render();
  };
  ui.acts.ganz = el => { S.artikel[+el.closest('tr').dataset.i].ganzeStuecke = Math.max(0, Math.round(num(el.value))); speichern(); render(); };
  ui.acts.bt = el => { const x = S.settings.bratenTeile[+el.closest('tr').dataset.i], f = el.dataset.f; x[f] = f === 'name' ? el.value : f === 'bug' ? el.checked : f === 'kgBulle' && el.value.trim() === '' ? null : num(el.value); speichern(); render(); };
  ui.acts.btweg = async el => { const b0 = S.settings.bratenTeile[+el.dataset.i]; if (!(await frage('Teilstück löschen', `Braten-Teilstück <b>${esc((b0 && b0.name) || '')}</b> aus der Liste löschen? Es fehlt dann im Kistenplan und bei den Sonderwünschen.`, 'Löschen', 'Abbrechen', 'rot'))) return; S.settings.bratenTeile.splice(+el.dataset.i, 1); speichern(); render(); };
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
  ui.acts.pkweg = async el => { const p0 = P[+el.dataset.i]; if (!(await frage('Genusspaket ändern', `<b>${esc((p0 && p0.art) || 'Zeile')}</b> aus dem Genusspaket nehmen? Das ändert die Zusammensetzung für alle offenen Pakete.`, 'Herausnehmen', 'Abbrechen', 'rot'))) return; P.splice(+el.dataset.i, 1); speichern(); render(); };
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
    const altSchema = roh ? num((JSON.parse(roh) || {}).schema) : 0;
    S = roh ? standPruefen(JSON.parse(roh)) : leererStand();
    // abgelöste Preislisten: Bestellzettel ins Archiv (Texte/Artikel festhalten)
    const archiviert = vdArchivieren();
    if (!roh || altSchema !== num(S.schema) || archiviert) await idbSet('stand', JSON.stringify(S));
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
  let ort = o.lagerOrt || lv.ort, nr = lagerNr(o);
  const anz = x => { const n = num(S.settings[x === 'Kühlschrank' ? 'lagerFaecher' : 'lagerKisten']); return n >= 1 ? Math.min(99, Math.round(n)) : (x === 'Kühlschrank' ? 6 : 29); };
  const nrKnoepfe = () => `<div class="klein fett" style="margin-bottom:6px">${ort === 'Kühlschrank' ? 'Fach' : 'Kisten-Nr.'} (optional)</div><div class="lnr">${Array.from({ length: anz(ort) }, (_, i) => i + 1).map(n => `<button class="btn ${n === nr ? 'haupt' : ''}" data-nr="${n}">${n}</button>`).join('')}<button class="btn ${nr ? '' : 'haupt'}" data-nr="">–</button></div>`;
  const d = $('#dialog');
  const klick = e => {
    const b = e.target.closest('[data-ort]');
    if (b) { e.stopPropagation(); ort = b.dataset.ort; if (nr > anz(ort)) nr = null; $$('#dialog [data-ort]').forEach(x => x.classList.toggle('haupt', x.dataset.ort === ort)); $('#lnrbox').innerHTML = nrKnoepfe(); return; }
    const n = e.target.closest('[data-nr]');
    if (n) { e.stopPropagation(); nr = n.dataset.nr ? +n.dataset.nr : null; $('#lnrbox').innerHTML = nrKnoepfe(); }
  };
  d.addEventListener('click', klick, true);
  const k = await dialog(`Nr. ${nrText(o)} gepackt – wohin?`, `<p>${esc(o.name)} · ${esc(lv.grund)} → Vorschlag: <b>${lv.ort}</b></p>
    <div class="knopfleiste" style="margin-bottom:12px">${LAGER.map(x => `<button class="btn ${x === ort ? 'haupt' : ''}" data-ort="${x}" style="min-height:60px;font-size:18px">${x === 'Kühlschrank' ? '❄ Kühlschrank' : '▣ Kühlraum (Metzgerkiste)'}</button>`).join('')}</div>
    <div id="lnrbox">${nrKnoepfe()}</div>`,
    [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Gepackt ✓', cls: 'haupt' }]);
  d.removeEventListener('click', klick, true);
  if (k !== 'ok') return false;
  if (o.status !== 'abgeholt') o.status = 'gepackt';
  o.lagerOrt = ort; o.lagerPlatz = nr ? String(nr) : ''; o.gepacktAm = o.gepacktAm || todayISO();
  speichern();
  return true;
}
