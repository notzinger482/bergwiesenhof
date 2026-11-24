// Bestellsystem Bergwiesenhof – Oberfläche (Teil 1: Grundgerüst, Start, Bestellung, Listen)
'use strict';

const APP_VERSION = '2.6';
let S = null;                 // Datenstand
const ui = { acts: {}, ins: {}, formDirty: false, filter: { q: '', tier: '', status: '' }, kfilter: '', tierWahl: '', ticks: {}, letzteNr: null };
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const inhalt = () => $('#inhalt');

// ---------- Speichern ----------
let speicherTimer = null, speicherFehler = false;
function speichern() {
  clearTimeout(speicherTimer);
  kopfStatus('speichert …');
  speicherTimer = setTimeout(async () => {
    try { S.gespeichert = new Date().toISOString(); await idbSet('stand', JSON.stringify(S)); speicherFehler = false; kopfStatus(); }
    catch (e) { speicherFehler = true; kopfStatus('SPEICHERN FEHLGESCHLAGEN', true); meldung('Speichern fehlgeschlagen: ' + e.message, true); }
  }, 250);
}
function kopfStatus(txt, warn) {
  const el = $('#kopf .status');
  if (!el) return;
  if (txt) { el.textContent = txt; el.classList.toggle('warn', !!warn); return; }
  const ls = letzteSicherungZeit();
  const tage = ls ? Math.floor((Date.now() - ls) / 864e5) : null;
  const warnTage = S.settings.sicherungUrl ? 3 : 7;
  el.classList.toggle('warn', tage === null ? S.bestellungen.length > 0 : tage >= warnTage);
  el.innerHTML = `gespeichert ✓<br>${tage === null ? 'noch keine Sicherung' : 'Sicherung: ' + (tage === 0 ? 'heute' : 'vor ' + tage + ' Tag' + (tage === 1 ? '' : 'en'))}${autoMeta.fehler && S.settings.sicherungUrl ? ' ⚠' : ''}`;
}

// ---------- Meldungen / Dialoge ----------
let meldTimer;
function meldung(txt, rot) {
  const m = $('#meldung'); m.textContent = txt; m.className = 'auf' + (rot ? ' rot' : '');
  clearTimeout(meldTimer); meldTimer = setTimeout(() => { m.className = ''; }, rot ? 6000 : 3200);
}
// knöpfe: [{k:'ja', t:'Ja', cls:'haupt'}] -> Promise<key|null>
function dialog(titel, html, knoepfe = [{ k: 'ok', t: 'OK', cls: 'haupt' }]) {
  return new Promise(res => {
    const d = $('#dialog');
    d.innerHTML = `<div class="box"><h2>${esc(titel)}</h2><div>${html}</div><div class="knopfleiste">${knoepfe.map(b => `<button class="btn ${b.cls || ''}" data-k="${b.k}">${esc(b.t)}</button>`).join('')}</div></div>`;
    d.classList.add('auf');
    const fertig = k => { d.classList.remove('auf'); d.innerHTML = ''; res(k); };
    d.onclick = e => { const b = e.target.closest('[data-k]'); if (b) fertig(b.dataset.k); else if (e.target === d) fertig(null); };
    const f = $('input,select', d); if (f) setTimeout(() => f.focus(), 50);
  });
}
// Dialog mit Eingabefeldern: liefert den Knopf und die Werte aller Felder mit id (vor dem Schließen gelesen)
async function dialogFelder(titel, html, knoepfe) {
  const d = $('#dialog'), werte = {};
  const merk = () => $$('input,textarea,select', d).forEach(f => { if (f.id) werte[f.id] = f.type === 'checkbox' ? f.checked : f.value; });
  d.addEventListener('click', merk, true);
  const k = await dialog(titel, html, knoepfe);
  d.removeEventListener('click', merk, true);
  return { k, werte };
}
const frage = (titel, text, ja = 'Ja', nein = 'Abbrechen', jaCls = 'haupt') =>
  dialog(titel, `<p>${text}</p>`, [{ k: 'nein', t: nein }, { k: 'ja', t: ja, cls: jaCls }]).then(k => k === 'ja');

// ---------- Router ----------
function route() {
  const h = location.hash.replace(/^#\/?/, '');
  const [pfad, q] = h.split('?');
  return { teile: pfad.split('/').filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(q || '') };
}
function gehe(hash) { if (location.hash === hash) render(); else location.hash = hash; }
let letzterHash = location.hash;
window.addEventListener('hashchange', async () => {
  if (ui.formDirty && !ui.ignoriereHash) {
    const neu = location.hash;
    ui.ignoriereHash = true; history.replaceState(null, '', letzterHash); ui.ignoriereHash = false;
    if (!(await frage('Nicht gespeichert', 'Die Bestellung ist noch nicht gespeichert. Änderungen verwerfen?', 'Verwerfen', 'Zurück zum Formular', 'rot'))) return;
    ui.formDirty = false; location.hash = neu; return;
  }
  letzterHash = location.hash;
  render();
});
window.addEventListener('beforeunload', e => { if (ui.formDirty) { e.preventDefault(); e.returnValue = ''; } });

const NAV = [
  ['neu', 'Bestellung', '<path d="M12 5v14M5 12h14"/>', 'neu'],
  ['start', 'Übersicht', '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>'],
  ['bestellungen', 'Bestel&shy;lungen', '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>'],
  ['kunden', 'Kunden', '<circle cx="9" cy="8" r="4"/><path d="M2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 21c0-3-2-5-5-5.5"/>'],
  ['tiere', 'Tiere', '<path d="M4 9c0-3 3-5 8-5s8 2 8 5v4c0 4-3 7-8 7s-8-3-8-7z"/><path d="M2 7l3 2M22 7l-3 2M9 12h.01M15 12h.01M10 16h4"/>'],
  ['schlachttag', 'Schlacht&shy;tag', '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V4h8v3M3 12h18"/>'],
  ['kommissionierung', 'Kommissio&shy;nieren', '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>'],
  ['hofladen', 'Hofladen', '<path d="M3 9l2-5h14l2 5M4 9v11h16V9M3 9h18M9 20v-6h6v6"/>'],
  ['einstellungen', 'Einstel&shy;lungen', '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>']
];
function navRender(aktiv) {
  $('#nav').innerHTML = NAV.map(([k, t, svg, cls]) => `<a href="#/${k}" class="${cls || ''} ${aktiv === k ? 'aktiv' : ''}"><svg viewBox="0 0 24 24">${svg}</svg><span>${t}</span></a>`).join('');
}
function titel(t) { $('#kopf .titel').textContent = t; document.title = t + ' – Bergwiesenhof'; }

function render() {
  const { teile, q } = route();
  const seite = teile[0] || 'start';
  ui.acts = {}; ui.ins = {};
  if (seite !== 'neu' && seite !== 'bestellung') ui.formDirty = false;
  const navKey = seite === 'bestellung' ? 'bestellungen' : seite === 'kunde' ? 'kunden' : seite === 'tier' || seite === 'archiv' ? 'tiere' : seite === 'warteliste' ? 'bestellungen' : seite === 'vordrucke' ? 'start' : seite;
  navRender(navKey);
  const V = {
    start: viewStart, neu: () => viewBestellung(null, q), bestellung: () => viewBestellung(+teile[1], q), bestellungen: viewBestellungen,
    kunden: viewKunden, kunde: () => viewKunde(teile[1]), tiere: viewTiere, archiv: viewArchiv, tier: () => viewTier(teile[1]),
    schlachttag: () => viewSchlachttag(teile[1] || 'menge', q), kommissionierung: () => viewKommissionierung(q),
    hofladen: viewHofladen, warteliste: viewWarteliste, vordrucke: viewVordrucke, einstellungen: () => viewEinstellungen(teile[1] || 'daten')
  };
  try { (V[seite] || viewStart)(); }
  catch (e) { console.error(e); inhalt().innerHTML = `<div class="fehlerbox">Fehler beim Anzeigen: ${esc(e.message)}</div>`; }
  window.scrollTo(0, 0);
}

// Ereignisse (delegiert)
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && ui.acts[el.dataset.act]) { e.preventDefault(); ui.acts[el.dataset.act](el, e); }
  else if (el && ui.globalActs && ui.globalActs[el.dataset.act]) { e.preventDefault(); ui.globalActs[el.dataset.act](el, e); }
});
document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && ui.ins[el.dataset.in]) ui.ins[el.dataset.in](el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && ui.acts[el.dataset.ch]) ui.acts[el.dataset.ch](el, e); });

// ---------- Offene Bestellungen neu verteilen (Vorschau, dann übernehmen) ----------
async function neuVerteilenDialog(nurWennWechsel) {
  const plan = neuVerteilenPlan(S);
  if (nurWennWechsel && !plan.wechsel.length) return false;
  const reicht = c => !c ? '' : c === 'ok' ? '<span class="ok">ok</span>' : `<span class="warn">${esc(c)}</span>`;
  const bleibtNicht = plan.zeilen.filter(z => sameText(z.von, z.nach) && z.check && z.check !== 'ok');
  const html = `<p>Geprüft: <b>${plan.zeilen.length}</b> offene Bestellungen (alle Tiere ohne gewogene Kisten und Warteliste), in Reihenfolge des Eingangs.
      ${plan.festTiere.length ? `<br><span class="klein">Fest (Kisten schon gewogen): ${plan.festTiere.map(esc).join(', ')} · gepackte und bewusst überbelegte Bestellungen bleiben, wo sie sind.</span>` : ''}</p>
    ${plan.wechsel.length ? `<p><b>${plan.wechsel.length} Bestellung${plan.wechsel.length === 1 ? '' : 'en'} wechseln das Tier:</b></p>
    <div class="tabwrap" style="max-height:50vh;overflow:auto"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Name</th><th>Eingang</th><th>bisher</th><th></th><th>neu</th><th>Mengencheck</th></tr></thead><tbody>
    ${plan.wechsel.map(z => `<tr><td class="r fett">${z.nr}</td><td>${esc(z.name)}</td><td>${fmtDate(z.eingang)}</td><td>${esc(z.von)}</td><td>→</td><td class="fett">${esc(z.nach)}</td><td>${reicht(z.check)}</td></tr>`).join('')}
    </tbody></table></div>` : '<p class="ok"><b>Alles passt – keine Bestellung muss das Tier wechseln.</b></p>'}
    ${bleibtNicht.length ? `<p class="warn">Weiter „reicht nicht“ (kein Tier passt, bleibt wo sie war): ${bleibtNicht.map(z => 'Nr. ' + z.nr + ' ' + esc(z.name)).join(', ')}</p>` : ''}`;
  const planHtml = plan.planNeu.length ? `<p class="klein">Kistenplan wird danach automatisch neu berechnet: <b>${plan.planNeu.map(esc).join(', ')}</b> (noch nichts gewogen).</p>` : '';
  const k = await dialog('Offene Bestellungen neu verteilen', html + planHtml, plan.wechsel.length ? [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: `${plan.wechsel.length} übernehmen`, cls: 'haupt' }] : [{ k: 'x', t: 'Schließen', cls: 'haupt' }]);
  if (k !== 'ok') return false;
  neuVerteilenUebernehmen(S, plan);
  const kp = plan.planNeu.length ? kistenplaeneAktualisieren(S, plan.planNeu) : { neu: [], weg: [] };
  speichern();
  meldung(`${plan.wechsel.length} Bestellung(en) neu zugeordnet.` + (kp.neu.length ? ` Kistenplan neu: ${kp.neu.join(', ')}.` : '') + (kp.weg.length ? ` Kisten zurückgesetzt: ${kp.weg.join(', ')}.` : '')); render();
  return true;
}
ui.globalActs = { neuverteilen: () => neuVerteilenDialog(false) };

// ---------- Hilfen für Formulare ----------
const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
const tiereSortiert = () => S.tiere.filter(t => !t.archiv).sort((a, b) => (a.abhol || '9999').localeCompare(b.abhol || '9999') || a.name.localeCompare(b.name));
function standardTier() {
  if (ui.tierWahl && tier(S, ui.tierWahl)) return ui.tierWahl;
  const heute = todayISO();
  const t = tiereSortiert().find(t => t.abhol && t.abhol >= isoOf(new Date(Date.now() - 10 * 864e5)));
  const aktiv = tiereSortiert();
  return t ? t.name : (aktiv[0] ? aktiv[0].name : '');
}
const zahlMarke = o => zahlungOffen(o) ? ' <span class="marke rot">Zahlung offen</span>' : '';
const statusMarke = s => s === 'abgeholt' ? '<span class="marke blau">abgeholt</span>' : s === 'gepackt' ? '<span class="marke gruen">gepackt</span>' : '<span class="marke">offen</span>';
// bewusst überbelegt (Bestellung bleibt trotz „reicht nicht“ bei diesem Tier): gelb statt rot
const rotZeile = (ch, o) => String(ch || '').startsWith('reicht') && !(o && o.ueberbelegt);
function checkMarke(txt, o) {
  if (!txt) return '';
  if (o && o.ueberbelegt && txt.startsWith('reicht')) return `<span class="marke gelb">bewusst überbelegt</span> <span class="klein">${esc(txt.replace(/^reicht nicht: /, ''))}</span>`;
  if (txt === 'ok') return '<span class="marke gruen">ok</span>';
  if (txt.startsWith('Warteliste')) return '<span class="marke gelb">Warteliste</span>';
  return `<span class="marke rot">${esc(txt)}</span>`;
}
function tierOptionen(gewaehlt, mitAuto, vorschlag) {
  let h = mitAuto ? opt('', `automatisch${vorschlag ? ' → ' + vorschlag : ''}`, !gewaehlt) : '';
  for (const t of tiereSortiert()) h += opt(t.name, `${t.name}${t.abhol ? ' – Abholung ' + fmtDate(t.abhol) : ''}`, gewaehlt === t.name);
  h += opt('Warteliste', 'Warteliste', gewaehlt === 'Warteliste');
  if (gewaehlt && gewaehlt !== 'Warteliste' && !tier(S, gewaehlt)) h += opt(gewaehlt, gewaehlt + ' (unbekannt)', true);
  else if (gewaehlt && tier(S, gewaehlt) && tier(S, gewaehlt).archiv) h += opt(gewaehlt, gewaehlt + ' (Archiv)', true);
  return h;
}

// =====================================================================
//  Übersicht
// =====================================================================
function viewStart() {
  titel('Übersicht');
  const heute = todayISO();
  const offen = S.bestellungen.filter(o => (o.status || 'offen') === 'offen').length;
  const warte = S.bestellungen.filter(o => o.tier === 'Warteliste').length;
  const kommende = tiereSortiert().filter(t => !t.abhol || t.abhol >= isoOf(new Date(Date.now() - 14 * 864e5)));
  const ls = letzteSicherungZeit();
  const tage = ls ? Math.floor((Date.now() - ls) / 864e5) : null;
  let h = '';
  if (S.bestellungen.length && (tage === null || tage >= (S.settings.sicherungUrl ? 3 : 7)))
    h += `<div class="hinweis zeile"><div class="platz"><b>Datensicherung:</b> ${tage === null ? 'Es gibt noch keine Sicherung.' : `Letzte Sicherung vor ${tage} Tagen.`} ${S.settings.sicherungUrl ? 'Die automatische Sicherung hat nicht geklappt' + (autoMeta.fehler ? ' (' + esc(autoMeta.fehler) + ')' : '') + '. Bitte ins WLAN gehen oder unter Einstellungen prüfen.' : 'Bitte zu Hause im WLAN eine Sicherung erstellen.'}</div><button class="btn haupt" data-act="sichern">Jetzt sichern</button></div>`;
  if (!sicherungPw) h += `<div class="hinweis zeile"><div class="platz"><b>Sicherungs-Passwort fehlt:</b> Sicherungen werden jetzt verschlüsselt. Bis ein Passwort festgelegt ist, wird nichts gesichert.</div><a class="btn haupt" href="#/einstellungen/daten">Passwort festlegen</a></div>`;
  const inaktiv = inaktiveKunden(S).length;
  if (inaktiv) h += `<div class="hinweis zeile"><div class="platz"><b>Datenschutz:</b> ${inaktiv} Kunde${inaktiv > 1 ? 'n haben' : ' hat'} seit über ${kundenFrist(S)} Jahren nicht bestellt und ${inaktiv > 1 ? 'sollten' : 'sollte'} anonymisiert werden.</div><a class="btn" href="#/einstellungen/daten">Ansehen</a></div>`;
  // Kistenpläne, die nicht mehr zu den Bestellungen passen
  for (const n of kistenTiere(S)) { const v = tier(S, n) && !tier(S, n).archiv ? kistenplanVeraltet(S, n) : null; if (v) h += `<div class="hinweis zeile"><div class="platz"><b>Kistenplan ${esc(n)}:</b> ${esc(v)} – bitte neu berechnen oder zurücksetzen.</div><a class="btn" href="#/schlachttag/kisten?tier=${encodeURIComponent(n)}">Kisten & Ladeplan</a></div>`; }
  // Preislisten: kommende neue Bestellzettel / gerade gewechselte Preise
  const plAkt = preislisteAm(S, heute), plNeu = preislisten(S).find(p => p.ab > heute);
  if (plNeu) h += `<div class="hinweis zeile"><div class="platz"><b>Neue Preise ab ${fmtDate(plNeu.ab)}:</b> Die Bestellzettel mit den neuen Preisen sind fertig und können schon gedruckt werden.</div><a class="btn" href="#/vordrucke">Vordrucke</a></div>`;
  else if (plAkt && preislisten(S).length > 1 && plAkt.ab <= heute && plAkt.ab >= isoOf(new Date(Date.now() - 14 * 864e5)))
    h += `<div class="hinweis zeile"><div class="platz"><b>Seit ${fmtDate(plAkt.ab)} gelten neue Preise:</b> Bitte die neuen Bestellzettel drucken – die alten liegen im Archiv unter Vordrucke.</div><a class="btn" href="#/vordrucke">Vordrucke</a></div>`;
  if (!ui.dauerhaft) h += `<div class="hinweis klein">Hinweis: Der dauerhafte Speicher ist noch nicht bestätigt. Bitte die App über „Zum Startbildschirm hinzufügen“ installieren – dann löscht Android die Daten nicht von selbst.</div>`;
  h += `<div class="zeile" style="margin-bottom:16px"><a class="btn haupt" href="#/neu" style="min-height:60px;font-size:19px;padding:0 28px">+ Neue Bestellung</a>
    <div class="kachel"><div class="gross">${offen}</div><div class="klein">offene Bestellungen</div></div>
    <div class="kachel"><div class="gross">${warte}</div><div class="klein">auf der Warteliste</div></div>
    <div class="kachel"><div class="gross">${S.kunden.length}</div><div class="klein">Kunden</div></div>
    <a class="btn" href="#/vordrucke" style="min-height:60px">🖨 Vordrucke drucken</a></div>`;
  // Bezahlung offen: abgeholte Bestellungen, die noch nicht bezahlt sind
  const zo = offeneZahlungen(S);
  if (zo.length) {
    const summe = zo.reduce((s, o) => s + (has(o.endbetrag) ? num(o.endbetrag) : schaetzpreis(S, o)), 0);
    h += `<div class="karte zahlkarte"><h3 style="margin-top:0">Bezahlung offen <span class="marke rot">${zo.length}</span> <span class="klein">– zusammen ca. ${fmtEur(summe)}</span></h3>
      <div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Name</th><th>Telefon</th><th>Tier</th><th>abgeholt am</th><th class="r">Betrag</th><th></th></tr></thead><tbody>
      ${zo.map(o => `<tr class="klick" data-act="zbest" data-nr="${o.nr}"><td class="r fett">${o.nr}</td><td class="fett">${esc(o.name)}</td><td>${o.tel ? `<a href="tel:${esc(o.tel)}" data-act="anrufen">${esc(o.tel)}</a>` : ''}</td><td>${esc(o.tier)}</td><td>${fmtDate(o.abgeholtAm)}</td>
        <td class="r">${has(o.endbetrag) ? fmtEur(o.endbetrag) : `<span class="klein">ca.</span> ${fmtEur(schaetzpreis(S, o))}`}</td><td class="r"><button class="btn klein haupt" data-act="zbezahlt" data-nr="${o.nr}">bezahlt ✓</button></td></tr>`).join('')}
      </tbody></table></div></div>`;
  }
  if (ui.letzteNr) h += `<p class="klein">Zuletzt gespeichert: <a href="#/bestellung/${ui.letzteNr}">Bestellung Nr. ${ui.letzteNr}</a></p>`;
  h += `<h2>Tiere</h2>`;
  if (!kommende.length) h += `<div class="karte">Noch keine Tiere angelegt. <a href="#/tier/neu">Tier anlegen</a></div>`;
  h += '<div class="raster">' + kommende.map(tierKarte).join('') + '</div>';
  inhalt().innerHTML = h;
  ui.acts.sichern = async () => { if (S.settings.sicherungUrl) { const r = await autoSicherung(true); if (r.ok) { meldung('Sicherung in Google Drive abgelegt: ' + r.datei); render(); return; } meldung('Google-Drive-Sicherung fehlgeschlagen: ' + r.fehler, true); } sicherungErstellen(true); };
  ui.acts.tier = el => gehe('#/schlachttag/menge?tier=' + encodeURIComponent(el.dataset.t));
  ui.acts.zbest = el => gehe('#/bestellung/' + el.dataset.nr);
  ui.acts.anrufen = el => { location.href = el.getAttribute('href'); };
  ui.acts.zbezahlt = async el => {
    const o = S.bestellungen.find(x => x.nr === +el.dataset.nr); if (!o) return;
    if (!(await frage('Bezahlt', `Nr. ${o.nr} – <b>${esc(o.name)}</b>${has(o.endbetrag) ? ' (' + fmtEur(o.endbetrag) + ')' : ''} als bezahlt markieren?`, 'Bezahlt ✓', 'Abbrechen'))) return;
    o.zahlungOffen = false; speichern(); meldung(`Nr. ${o.nr}: bezahlt.`); render();
  };
}
function tierKarte(t) {
  const i = tierInfo(S, t);
  const nen = i.maxPak || 1;
  const pct = Math.min(100, i.pakete / nen * 100);
  return `<div class="karte tierkarte" data-act="tier" data-t="${esc(t.name)}">
    <div class="kopfz"><span class="name">${esc(t.name)}</span><span class="klein">${esc(t.typ || '')}</span></div>
    <div class="klein">Abholung: <b>${t.abhol ? fmtDate(t.abhol) : 'offen'}</b>${t.schlacht ? ' · Schlachtung ' + fmtDate(t.schlacht) : ''}</div>
    <div class="balken ${i.frei < 0 ? 'ueber' : i.frei === 0 ? 'voll' : ''}"><div style="width:${pct}%"></div></div>
    <div class="klein">Genusspakete: <b>${fmtNum(i.pakete)}</b> von ${nen} · frei ${fmtNum(i.frei)}</div>
    <div class="klein">${i.anzahl} Bestellungen${i.reichtNicht ? ` · <span class="warn">${i.reichtNicht} reicht nicht</span>` : ''}${i.ueberbelegt ? ` · <span class="klein">${i.ueberbelegt} bewusst überbelegt</span>` : ''}</div></div>`;
}

// =====================================================================
//  Bestellformular
// =====================================================================
function leereBestellung() {
  return { nr: null, eingang: todayISO(), tier: '', name: '', tel: '', mail: '', weg: '', notiz: '', wunsch: '', pakete: 0, pakVak: 0, pos: {}, sonder: [], endbetrag: null, status: 'offen' };
}
function viewBestellung(nr, q, vorlage) {
  let o;
  if (vorlage) o = vorlage;
  else if (nr) {
    const vorh = S.bestellungen.find(x => x.nr === nr);
    if (!vorh) { inhalt().innerHTML = `<div class="fehlerbox">Bestellung Nr. ${nr} gibt es nicht.</div>`; return; }
    o = JSON.parse(JSON.stringify(vorh));
  } else {
    o = leereBestellung();
    if (q && q.get('kunde')) { const k = S.kunden.find(x => x.nr === +q.get('kunde')); if (k) { o.name = k.name; o.tel = k.tel; o.mail = k.mail; } }
    if (q && q.get('tier')) o.tier = q.get('tier');
  }
  ui.o = o; ui.formDirty = false;
  titel(nr ? `Bestellung Nr. ${nr}` : 'Neue Bestellung');
  const st = S.settings;
  const artRows = S.artikel.map((a, i) => {
    const p = o.pos[a.name] || {};
    const eh = einheitForm(a);
    const kgArt = eh === 'kg';
    return `<tr data-i="${i}">
      <td class="name">${esc(a.name)}</td>
      <td style="width:76px">${kgArt ? `<input class="feld zahl" inputmode="numeric" data-in="pos" data-f="anzahl" value="${has(p.anzahl) ? fmtIn(p.anzahl, 3) : ''}" placeholder="Anz.">` : ''}</td>
      <td style="width:86px">${kgArt ? `<input class="feld zahl" inputmode="numeric" data-in="pos" data-f="g" value="${has(p.g) ? fmtIn(p.g, 0) : ''}" placeholder="g">` : ''}</td>
      <td style="width:96px"><input class="feld zahl" inputmode="decimal" data-in="pos" data-f="menge" value="${has(p.menge) ? fmtIn(p.menge, 3) : ''}" placeholder="${eh === 'kg' ? 'kg' : eh}"></td>
      <td class="einh">${eh === 'Btl' ? `Btl<br><span class="klein">à ${a.beutelG} g</span>` : eh}</td>
      <td style="width:150px">${kgArt ? `<input class="feld klein" data-in="pos" data-f="pack" value="${esc(p.pack || '')}" placeholder="${a.name === HACK ? 'z. B. 2x500+700' : a.name === 'Rouladen' ? 'z. B. 4+4 Stk' : ''}">` : ''}</td>
      <td class="c">${a.amStueck ? `<label class="check"><input type="checkbox" data-in="pos" data-f="amStueck"${p.amStueck ? ' checked' : ''}></label>` : ''}</td>
      <td class="c"><label class="check"><input type="checkbox" data-in="pos" data-f="vak"${istVak(o.pos[a.name] || {}) ? ' checked' : ''}></label></td>
    </tr>`;
  }).join('');
  const sonderRows = () => (o.sonder.length ? o.sonder : []).map((s, i) => sonderZeile(s, i)).join('');
  const letzte = !nr && o.name ? letzteBestellungVon(o.name) : null;
  inhalt().innerHTML = `
  <div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">${nr ? `Bestellung Nr. ${nr}` : 'Neue Bestellung'}</h1>
    ${nr ? `${o.lagerOrt ? `<span class="marke blau" style="font-size:15px;padding:6px 12px">${esc(lagerText(o))}</span>` : ''}<button class="btn" data-act="lager">Lagerplatz …</button><select class="feld" style="width:auto" data-in="kopf" data-f="status">${['offen', 'gepackt', 'abgeholt'].map(s => opt(s, s, (o.status || 'offen') === s)).join('')}</select><label class="check zahlcheck" id="zahlbox" style="${(o.status || 'offen') === 'abgeholt' ? '' : 'display:none'}"><input type="checkbox" id="zahloffen"${o.zahlungOffen ? ' checked' : ''}> Bezahlung offen</label>
    <button class="btn" data-act="teilen">Teilen …</button><button class="btn rot" data-act="loeschen">Löschen</button>` : ''}
    ${ui.letzteNr && !nr ? `<a class="btn klein" href="#/bestellung/${ui.letzteNr}">Zuletzt: Nr. ${ui.letzteNr} öffnen</a>` : ''}</div>
  <div id="fehler"></div>
  <div id="mcheck"></div>
  <div class="spalten2">
    <div>
      <div class="karte"><h3 style="margin-top:0">Kunde</h3>
        <div class="formraster">
          <div class="f ganz kdsuche"><label class="f">Name<input class="feld" data-in="kopf" data-f="name" id="kdname" value="${esc(o.name)}" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="Nachname, Vorname – Vorschläge aus der Kundenliste"></label><div id="kdvorschlag" class="kdvorschlag"></div></div>
          <div class="ganz klein" id="kdinfo"></div>
          <label class="f">Telefon<input class="feld" type="tel" data-in="kopf" data-f="tel" value="${esc(o.tel)}"></label>
          <label class="f">Mail<input class="feld" type="email" data-in="kopf" data-f="mail" value="${esc(o.mail)}"></label>
          <label class="f">Bestellweg<select class="feld" data-in="kopf" data-f="weg">${opt('', '–', !o.weg)}${S.wege.map(w => opt(w, w, o.weg === w)).join('')}</select></label>
          <label class="f">Eingang<input class="feld" type="date" data-in="kopf" data-f="eingang" value="${esc(o.eingang)}"></label>
        </div>
      </div>
      <div class="karte"><h3 style="margin-top:0">Tier & Termin</h3>
        <div class="formraster">
          <label class="f">Wunschtermin (leer = nächstes Tier)<input class="feld" type="date" data-in="kopf" data-f="wunsch" value="${esc(o.wunsch)}"></label>
          <label class="f">Tier<select class="feld" id="tierwahl" data-in="kopf" data-f="tier"></select></label>
          <div class="ganz klein" id="tierinfo"></div>
          <label class="f ganz">Notiz intern<input class="feld" data-in="kopf" data-f="notiz" value="${esc(o.notiz)}" placeholder="nur Bestellbezogenes – keine Gesundheitsangaben"></label>
        </div>
      </div>
      <div class="karte"><h3 style="margin-top:0">Genusspakete <span class="klein">(ca. ${fmtNum(paketGewicht(S), 1)} kg, ${fmtEur(paketPreisKg(S, preislisteAm(S, preisDatum(S, o))))}/kg)</span></h3><div class="klein" style="margin:-4px 0 8px">${esc(paketListe(S).map(p => (num(p.anzahl) > 1 ? fmtNum(p.anzahl) + ' ' : fmtNum(num(p.anzahl) * paketG(S, p) / 1000, 2) + ' kg ') + p.art).join(' · '))}</div>
        <div class="zeile">
          <div><div class="klein fett">Anzahl</div><div class="stepper"><button data-act="step" data-f="pakete" data-d="-1">−</button><input class="feld zahl" inputmode="numeric" data-in="kopf" data-f="pakete" value="${num(o.pakete) || ''}"><button data-act="step" data-f="pakete" data-d="1">+</button></div></div>
          <div><div class="klein fett">davon vakuumiert (${fmtEur(vakPreisPaket(S, preislisteAm(S, preisDatum(S, o))))})</div><div class="stepper"><button data-act="step" data-f="pakVak" data-d="-1">−</button><input class="feld zahl" inputmode="numeric" data-in="kopf" data-f="pakVak" value="${num(o.pakVak) || ''}"><button data-act="step" data-f="pakVak" data-d="1">+</button></div></div>
        </div>
      </div>
      <div class="karte"><label class="f ganz"><span class="fett">Notiz zur Bestellung</span> <span class="klein">– erscheint beim Kommissionieren und in der Packliste</span><textarea class="feld" rows="2" data-in="kopf" data-f="packNotiz" placeholder="z. B. „Steak in 2er-Packungen“, „holt Nachbar ab“">${esc(o.packNotiz || '')}</textarea></label></div>
      <div class="karte"><h3 style="margin-top:0">Sonderwünsche <span class="klein">– macht der Metzger separat</span></h3>
        <div class="klein" style="margin-bottom:6px">z. B. Hackfleisch 2000 g „besonders mager“. Die Menge gehört trotzdem rechts mit in die Bestellung. Nur den Wunsch eintragen, keine Gründe wie Krankheiten.</div>
        <div id="sonderliste">${sonderRows()}</div>
        <button class="btn klein" data-act="sonderNeu">+ Sonderwunsch</button>
      </div>
    </div>
    <div class="karte">
      <h3 style="margin-top:0">Einzelartikel</h3>
      <div class="klein" style="margin-bottom:6px">Anzahl × g ergibt die Menge automatisch (z. B. 6 × 500 g). Verschiedene Packungen unter „Packungen“, z. B. 2x500+2x700 oder 4+4 Stk. Nur Anzahl (z. B. 4 Rostbraten): kg werden über das Stückgewicht geschätzt. <b>Vakuumieren ist bei allen Einzelartikeln vorbelegt (kostenlos)</b> – Haken bei „vak.“ rausnehmen, wenn nicht vakuumiert werden soll.</div>
      <table class="tab art-tab"><thead><tr><th>Artikel</th><th class="r">Anzahl</th><th class="r">× g</th><th class="r">= Menge</th><th></th><th>Packungen <span class="klein">(frei)</span></th><th class="c">am Stück</th><th class="c">vak.</th></tr></thead><tbody>${artRows}</tbody></table>
      <div class="summenleiste"><div class="platz" id="summe"></div>
        <button class="btn" data-act="leeren">${nr ? 'Abbrechen' : 'Leeren'}</button>
        <button class="btn haupt" data-act="speichern" style="min-width:160px">Speichern</button></div>
    </div>
  </div>`;

  // --- Live-Berechnung ---
  const aktualisieren = () => {
    // Positionen: automatische Menge bei Anzahl × g bzw. Schätzung
    $$('.art-tab tbody tr').forEach(tr => {
      const a = S.artikel[+tr.dataset.i];
      const p = o.pos[a.name] || {};
      const mF = $('[data-f=menge]', tr);
      if (einheitForm(a) === 'kg') {
        const an = num(p.anzahl), g = num(p.g);
        // vorher automatisch berechnet/geschätzt? (muss VOR dem Entfernen der Klassen gemerkt werden)
        const warAuto = mF.classList.contains('auto') || mF.classList.contains('schaetz');
        mF.classList.remove('auto', 'schaetz', 'fehlt'); mF.readOnly = false;
        if (an > 0 && g > 0) { mF.value = fmtIn(an * g / 1000, 3); mF.classList.add('auto'); mF.readOnly = true; }
        else if (an > 0 && !(num(p.menge) > 0)) {
          const sg = posStueckG(S, a, p, Object.assign({}, o, { tier: o.tier || tierVorschlag(S, o.wunsch, o.pakete, o.nr) }));
          if (sg > 0) { mF.value = fmtIn(an * sg / 1000, 3); mF.classList.add('schaetz'); mF.readOnly = true; }
          else { mF.value = ''; mF.classList.add('fehlt'); }
        } else if (warAuto) mF.value = has(p.menge) ? fmtIn(p.menge, 3) : ''; // Anzahl/g gelöscht → berechneten Wert entfernen
      }
      tr.classList.toggle('hat', qty(S, o, a.name) > 0);
    });
    // Tier
    const vors = tierVorschlag(S, o.wunsch, o.pakete, o.nr, o);
    $('#tierwahl').innerHTML = tierOptionen(o.tier, true, vors);
    const tn = o.tier || vors, t = tier(S, tn);
    let ti = '';
    if (t) { const inf = tierInfo(S, t); const eigen = o.nr && S.bestellungen.find(x => x.nr === o.nr && x.tier === t.name); const frei = inf.frei + (eigen ? num(eigen.pakete) : 0) - num(o.pakete);
      ti = `${o.tier ? '' : 'Vorschlag: '}<b>${esc(t.name)}</b> – Abholung ${t.abhol ? fmtDate(t.abhol) : 'offen'} · nach dieser Bestellung noch <b class="${frei < 0 ? 'warn' : ''}">${fmtNum(frei)}</b> Pakete frei, ${inf.anzahl} Bestellungen`; }
    else if (tn === 'Warteliste') ti = '<span class="knapp">Kein passendes Tier – Bestellung kommt auf die Warteliste.</span>';
    $('#tierinfo').innerHTML = ti;
    // Mengencheck live: wie viel fehlt bei diesem Tier (auch vor dem Speichern)
    const fd = t && !t.archiv ? fehlDetail(S, Object.assign({}, o, { tier: t.name })) : null;
    ui.fehlDetail = fd;
    if (fd && fd.ok && ti) $('#tierinfo').innerHTML = ti + ' · Mengencheck <span class="ok">ok</span>';
    const ueb = !!o.ueberbelegt && !!fd && !fd.ok;
    $('#mcheck').innerHTML = !fd || fd.ok ? '' : `<div class="${ueb ? 'hinweis' : 'fehlerbox'} mcheck"><b>${ueb ? `Bewusst überbelegt bei ${esc(fd.tier)}` : `Mengencheck ${esc(fd.tier)}: reicht nicht`}</b>${ueb ? ' <span class="klein">– bleibt bei diesem Tier, wird beim Neu-Verteilen nicht verschoben</span>' : ''}
      ${fd.zeilen.length ? `<table class="tab mcheck-tab"><thead><tr><th>Artikel</th><th class="r">bestellt</th><th class="r">verfügbar</th><th class="r">fehlt</th></tr></thead><tbody>${fd.zeilen.map(z => {
        const stk = (n, z2) => z.stkBestellt !== undefined ? ` <span class="klein">(${fmtNum(n)} ${esc(z.stkText)})</span>` : z.btlBestellt !== undefined ? ` <span class="klein">(${fmtNum(n)} Btl)</span>` : '';
        const nB = z.stkBestellt !== undefined ? z.stkBestellt : z.btlBestellt, nV = z.stkVerf !== undefined ? z.stkVerf : z.btlVerf;
        return `<tr><td class="fett">${esc(z.art)}</td><td class="r">${fmtNum(z.bestelltKg, 2)} kg${stk(nB)}</td><td class="r">ca. ${fmtNum(z.verfuegbarKg, 2)} kg${stk(nV)}</td><td class="r warn">${fehlKgText(z.fehltKg)}${nB !== undefined ? ` <span class="klein">(${fmtNum(nB - nV)} ${z.stkBestellt !== undefined ? 'Stk' : 'Btl'})</span>` : ''}</td></tr>`; }).join('')}</tbody></table>` : ''}
      ${fd.sonst.length ? `<p style="margin:6px 0">${fd.sonst.map(esc).join('<br>')}</p>` : ''}
      <div class="zeile" style="gap:8px;margin-top:8px;flex-wrap:wrap">${ueb ? '<button class="btn" data-act="ueberbelegen" data-w="0">Überbelegung aufheben</button>' : `${fd.zeilen.length ? '<button class="btn" data-act="kuerzen">Auf verfügbare Menge kürzen</button>' : ''}${nr && fd.zeilen.length ? '<button class="btn" data-act="teilen">Rest aufs nächste Tier (Teilen …)</button>' : ''}<button class="btn braun" data-act="ueberbelegen" data-w="1">Bewusst überbelegen – bei diesem Tier lassen</button><span class="klein platz">Ist der Kunde mit weniger einverstanden, kürzen und speichern – sonst den Rest aufs nächste Tier verschieben oder bewusst überbelegen.</span>`}</div></div>`;
    // Kunde
    const k = S.kunden.find(x => sameText(x.name, o.name));
    const lb = !o.nr && o.name ? letzteBestellungVon(o.name) : null;
    $('#kdinfo').innerHTML = !o.name ? '' : k ? `Kd-Nr. ${k.nr}${k.notiz ? ' – ' + esc(k.notiz) : ''}${lb ? ` · <a href="#" data-act="uebernehmen">letzte Bestellung (Nr. ${lb.nr}) übernehmen</a>` : ''}` : '<span class="ok">neuer Kunde – wird beim Speichern angelegt</span>';
    // Summe
    const ek = einzelKg(S, o);
    $('#summe').innerHTML = `Einzelartikel ca. <b>${fmtNum(ek, 2)} kg</b>${num(o.pakete) ? ` + ${fmtNum(o.pakete)} Genusspaket${num(o.pakete) > 1 ? 'e' : ''}` : ''} · Schätzpreis <b>${fmtEur(schaetzpreis(S, o))}</b>`;
  };
  ui.ins.kopf = el => {
    const f = el.dataset.f; let v = el.value;
    if (['pakete', 'pakVak'].includes(f)) v = num(v);
    o[f] = v; ui.formDirty = true;
    if (f === 'tier') delete o.ueberbelegt;
    if (f === 'status') { const zb = $('#zahlbox'); if (zb) zb.style.display = v === 'abgeholt' ? '' : 'none'; }
    if (f === 'name') {
      const k = S.kunden.find(x => sameText(x.name, v));
      if (k) { if (!o.tel && k.tel) { o.tel = k.tel; $('[data-f=tel]').value = k.tel; } if (!o.mail && k.mail) { o.mail = k.mail; $('[data-f=mail]').value = k.mail; } }
      kdVorschlaege(v);
    }
    aktualisieren();
  };
  // ---- Kunden-Vorschläge beim Namen ----
  let kdTreffer = [], kdAktiv = -1;
  const kdBox = () => $('#kdvorschlag');
  const kdZu = () => { kdTreffer = []; kdAktiv = -1; const b = kdBox(); if (b) { b.innerHTML = ''; b.classList.remove('auf'); } };
  function kdVorschlaege(q) {
    kdTreffer = kundenVorschlaege(S, q); kdAktiv = -1;
    const b = kdBox(); if (!b) return;
    if (!kdTreffer.length) return kdZu();
    b.innerHTML = kdTreffer.map((t, i) => `<div class="kdv" data-i="${i}"><div class="fett">${esc(t.k.name)}</div><div class="klein">${[t.k.tel, t.anzahl ? `${t.anzahl} Bestellung${t.anzahl > 1 ? 'en' : ''}${t.letzteNr ? ', zuletzt Nr. ' + t.letzteNr : ''}` : 'noch keine Bestellung'].filter(Boolean).map(esc).join(' · ')}</div></div>`).join('');
    b.classList.add('auf');
  }
  function kdWaehlen(i) {
    const t = kdTreffer[i]; if (!t) return;
    const k = t.k, el = $('#kdname');
    o.name = k.name; el.value = k.name;
    if (k.tel && !o.tel) { o.tel = k.tel; $('[data-f=tel]').value = k.tel; }
    if (k.mail && !o.mail) { o.mail = k.mail; $('[data-f=mail]').value = k.mail; }
    ui.formDirty = true; kdZu(); aktualisieren();
  }
  const kdEl = $('#kdname');
  kdEl.addEventListener('focus', () => { if (kdEl.value.trim()) kdVorschlaege(kdEl.value); });
  kdEl.addEventListener('blur', () => setTimeout(kdZu, 200));
  kdEl.addEventListener('keydown', e => {
    if (!kdTreffer.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); kdAktiv = (kdAktiv + (e.key === 'ArrowDown' ? 1 : -1) + kdTreffer.length) % kdTreffer.length; $$('.kdv', kdBox()).forEach((d, i) => d.classList.toggle('aktiv', i === kdAktiv)); }
    else if (e.key === 'Enter') { e.preventDefault(); kdWaehlen(kdAktiv >= 0 ? kdAktiv : 0); }
    else if (e.key === 'Escape') kdZu();
  });
  kdBox().addEventListener('pointerdown', e => { const d = e.target.closest('.kdv'); if (d) { e.preventDefault(); kdWaehlen(+d.dataset.i); } });
  ui.ins.pos = el => {
    const a = S.artikel[+el.closest('tr').dataset.i]; const f = el.dataset.f;
    const p = o.pos[a.name] = o.pos[a.name] || { vak: true };
    const tr = el.closest('tr'), feldEl = n => $(`[data-f=${n}]`, tr);
    if (el.type === 'checkbox') p[f] = el.checked;
    else if (f === 'pack') {
      // Packungen frei: Menge daraus berechnen, Anzahl/g leeren
      const txt = el.value.trim(), r = txt ? packParse(S, a, txt) : null;
      el.classList.toggle('fehlerfeld', !!(r && r.fehler)); el.title = r && r.fehler ? r.fehler : r ? r.text : '';
      if (!txt) delete p.pack;
      else { p.pack = txt; if (r && !r.fehler) { p.menge = r.kg; p.anzahl = null; p.g = null; feldEl('menge').value = fmtIn(r.kg, 3); if (feldEl('anzahl')) feldEl('anzahl').value = ''; if (feldEl('g')) feldEl('g').value = ''; } }
    }
    else {
      p[f] = el.value.trim() === '' ? null : num(el.value);
      if (['menge', 'anzahl', 'g'].includes(f) && p.pack) { delete p.pack; if (feldEl('pack')) { feldEl('pack').value = ''; feldEl('pack').classList.remove('fehlerfeld'); } }
    }
    if (!has(p.menge) && !has(p.anzahl) && !has(p.g) && !p.pack && !p.amStueck && p.vak !== false) delete o.pos[a.name];
    ui.formDirty = true; aktualisieren();
  };
  ui.acts.step = el => {
    const f = el.dataset.f; o[f] = Math.max(0, num(o[f]) + num(el.dataset.d));
    $(`[data-in=kopf][data-f=${f}]`).value = o[f] || ''; ui.formDirty = true; aktualisieren();
  };
  ui.acts.sonderNeu = () => { o.sonder.push({ art: '', menge: null, wunsch: '' }); $('#sonderliste').innerHTML = o.sonder.map(sonderZeile).join(''); ui.formDirty = true; };
  ui.acts.sonderWeg = el => { o.sonder.splice(+el.dataset.i, 1); $('#sonderliste').innerHTML = o.sonder.map(sonderZeile).join(''); ui.formDirty = true; aktualisieren(); };
  ui.ins.sonder = el => {
    const i = +el.closest('[data-si]').dataset.si, s = o.sonder[i], f = el.dataset.f;
    // gespeicherte Sonderwünsche: angezeigte Menge übernehmen, sonst ginge sie beim Ändern von Text/Artikel verloren
    if (s.eingabe === undefined) s.eingabe = ($('[data-f=menge]', el.closest('[data-si]')) || {}).value || '';
    if (f === 'art') { s.art = el.value; const a = art(S, s.art); $('.sonder-eh', el.closest('[data-si]')).textContent = sonderEinheit(a); }
    else if (f === 'menge') s.eingabe = el.value;
    else s[f] = el.value;
    s.menge = sonderMengeIntern(s);
    ui.formDirty = true; aktualisieren();
  };
  ui.acts.uebernehmen = () => {
    const lb = letzteBestellungVon(o.name); if (!lb) return;
    o.pos = JSON.parse(JSON.stringify(lb.pos)); o.pakete = lb.pakete; o.pakVak = lb.pakVak; o.sonder = JSON.parse(JSON.stringify(lb.sonder || [])); o.weg = o.weg || lb.weg;
    viewBestellung(null, null, o); ui.formDirty = true;
  };
  ui.acts.leeren = async () => {
    if (ui.formDirty && !(await frage('Verwerfen?', 'Eingaben verwerfen?', 'Verwerfen', 'Zurück', 'rot'))) return;
    ui.formDirty = false; if (nr) history.back(); else render();
  };
  ui.acts.loeschen = async () => {
    if (!(await frage('Bestellung löschen', `Bestellung Nr. ${nr} von <b>${esc(o.name)}</b> wirklich löschen? Das kann nicht rückgängig gemacht werden.`, 'Löschen', 'Abbrechen', 'rot'))) return;
    S.bestellungen = S.bestellungen.filter(x => x.nr !== nr); speichern(); ui.formDirty = false; meldung(`Bestellung Nr. ${nr} gelöscht.`); gehe('#/bestellungen');
  };
  ui.acts.speichern = () => bestellungSpeichern(o);
  { const zc = $('#zahloffen'); if (zc) zc.addEventListener('change', () => { ui.formDirty = true; }); }
  ui.acts.ueberbelegen = el => { if (el.dataset.w === '1') o.ueberbelegt = true; else delete o.ueberbelegt; ui.formDirty = true; aktualisieren(); meldung(el.dataset.w === '1' ? 'Als bewusst überbelegt markiert – bitte speichern.' : 'Überbelegung aufgehoben – bitte speichern.'); };
  // Auf die verfügbare Menge kürzen (nur im Formular – erst „Speichern“ übernimmt es)
  ui.acts.kuerzen = () => {
    const fd = ui.fehlDetail; if (!fd || !fd.zeilen.length) return;
    const txt = [];
    for (const z of fd.zeilen) {
      const p = o.pos[z.art]; if (!p) continue;
      if (z.neu > 0) { p[z.feld] = z.neu; if (z.feld === 'anzahl') p.menge = null; }
      else delete o.pos[z.art];
      const i = S.artikel.findIndex(a => a.name === z.art), tr = $(`.art-tab tbody tr[data-i="${i}"]`);
      if (tr) { const pp = o.pos[z.art] || {}; for (const f of ['anzahl', 'menge']) { const el = $(`[data-f=${f}]`, tr); if (el) el.value = has(pp[f]) && num(pp[f]) > 0 ? fmtIn(pp[f], 3) : ''; } }
      txt.push(`${z.art} ${z.neu > 0 ? 'auf ' + fmtNum(z.neu, 1) + (z.feld === 'anzahl' ? ' Stück' : z.btlBestellt !== undefined ? ' Btl' : ' kg') : 'entfernt'}`);
    }
    ui.formDirty = true; aktualisieren();
    meldung('Gekürzt: ' + txt.join(', ') + ' – bitte speichern.');
  };
  ui.acts.lager = async () => {
    if (ui.formDirty) return meldung('Bitte die Änderungen zuerst speichern.', true);
    const echt = S.bestellungen.find(x => x.nr === nr);
    if (await lagerDialog(echt)) { meldung(`Nr. ${nr}: ${lagerText(echt)}`); render(); }
  };
  ui.acts.teilen = () => { if (ui.formDirty) return meldung('Bitte die Änderungen zuerst speichern, dann teilen.', true); teilenDialog(nr); };
  aktualisieren();
}
function letzteBestellungVon(name) {
  return S.bestellungen.filter(x => sameText(x.name, name)).sort((a, b) => b.nr - a.nr)[0] || null;
}
const sonderEinheit = a => !a ? '' : (einheitForm(a) === 'kg' ? 'g' : einheitForm(a));
function sonderMengeIntern(s) {
  const a = art(S, s.art); const v = String(s.eingabe === undefined ? '' : s.eingabe).trim();
  if (!v) return null;
  if (!a) return num(v);
  const eh = einheitForm(a);
  if (eh === 'kg') return num(v) / 1000;
  if (eh === 'Btl') return r3(num(v) * a.beutelG / 1000);
  return num(v);
}
function sonderAnzeige(s) {
  const a = art(S, s.art);
  if (s.eingabe !== undefined) return s.eingabe;
  if (!has(s.menge)) return '';
  if (!a) return fmtIn(s.menge, 3);
  const eh = einheitForm(a);
  if (eh === 'kg') return fmtIn(s.menge * 1000, 0);
  if (eh === 'Btl') return fmtIn(s.menge * 1000 / a.beutelG, 1);
  return fmtIn(s.menge, 2);
}
function sonderZeile(s, i) {
  const a = art(S, s.art);
  return `<div class="zeile" data-si="${i}" style="margin-bottom:8px;flex-wrap:nowrap">
    <select class="feld" style="flex:1.2" data-in="sonder" data-f="art">${opt('', 'Artikel …', !s.art)}${S.artikel.map(x => opt(x.name, x.name, s.art === x.name)).join('')}</select>
    <input class="feld zahl" style="width:92px" inputmode="decimal" data-in="sonder" data-f="menge" value="${esc(sonderAnzeige(s))}" placeholder="Menge">
    <span class="klein sonder-eh" style="width:26px">${sonderEinheit(a)}</span>
    <input class="feld" style="flex:2" data-in="sonder" data-f="wunsch" value="${esc(s.wunsch || '')}" placeholder="Wunsch / Vorgabe">
    <button class="btn klein rot" data-act="sonderWeg" data-i="${i}">✕</button></div>`;
}
async function bestellungSpeichern(o) {
  o.name = String(o.name || '').trim();
  const fb = $('#fehler');
  if (!o.name) { fb.innerHTML = '<div class="fehlerbox">Bitte einen Namen eintragen.</div>'; $('[data-f=name]').focus(); window.scrollTo(0, 0); return; }
  const f = formFehler(S, o);
  if (f.length) { fb.innerHTML = `<div class="fehlerbox"><b>Bitte korrigieren – nicht gespeichert:</b><br>${f.map(esc).join('<br>')}</div>`; window.scrollTo(0, 0); return; }
  fb.innerHTML = '';
  // aufräumen
  o.sonder = (o.sonder || []).filter(s => s.art).map(s => ({ art: s.art, menge: has(s.menge) ? s.menge : null, wunsch: (s.wunsch || '').trim() }));
  for (const [k, p] of Object.entries(o.pos)) {
    const a = art(S, k);
    if (!a) { delete o.pos[k]; continue; }
    if (a.einheit !== 'Stk' && !a.beutelG && num(p.anzahl) > 0 && num(p.g) > 0) p.menge = null; // automatisch
    if (!has(p.menge) && !has(p.anzahl) && !p.amStueck) delete o.pos[k];
  }
  o.pakete = num(o.pakete); o.pakVak = num(o.pakVak);
  if (!o.eingang) o.eingang = todayISO();
  let auto = false;
  if (!o.tier) { o.tier = tierVorschlag(S, o.wunsch, o.pakete, o.nr, o); auto = true; }
  const neu = !o.nr;
  // Mengencheck der anderen Bestellungen dieses Tiers vorher merken (eine neue Bestellung mit Genusspaket hat Vorrang und kann ihnen etwas wegnehmen)
  const vorher = tier(S, o.tier) ? mengencheckTier(S, o.tier) : {};
  // Reihenfolge beim Tier: neu oder Tier gewechselt → hinten anstellen
  if (neu) { o.nr = nextNr(S); o.rang = nextRang(S); S.bestellungen.push(o); }
  else {
    const i = S.bestellungen.findIndex(x => x.nr === o.nr);
    if (S.bestellungen[i].tier !== o.tier) o.rang = nextRang(S);
    S.bestellungen[i] = o;
  }
  // bewusst überbelegt: gilt nur für das Tier, bei dem es entschieden wurde, und nur solange es nicht reicht
  if (o.ueberbelegt) { const fdS = fehlDetail(S, o); if (!fdS || fdS.ok) delete o.ueberbelegt; }
  // Bezahlung: nur bei „abgeholt“ (Haken „Bezahlung offen“ im Formular)
  if ((o.status || 'offen') === 'abgeholt') { o.abgeholtAm = o.abgeholtAm || todayISO(); const zc = $('#zahloffen'); if (zc) o.zahlungOffen = zc.checked; }
  else { delete o.abgeholtAm; delete o.zahlungOffen; }
  // Schätzpreis abgeholter/archivierter Bestellungen festhalten (bei Änderung neu berechnet), sonst mit der Preisliste am Abholtermin
  if (preisBleibtFest(S, o)) preisFestsetzen(S, o); else delete o.preisFest;
  const kundeNeu = kundePflegen(S, o.name, o.tel, o.mail, o.eingang);
  speichern();
  ui.formDirty = false; ui.letzteNr = o.nr;
  const check = mengencheck(S, o);
  const nachher = tier(S, o.tier) ? mengencheckTier(S, o.tier) : {};
  const gekippt = Object.keys(nachher).filter(nr => +nr !== o.nr && vorher[nr] === 'ok' && nachher[nr] !== 'ok').map(nr => S.bestellungen.find(x => x.nr === +nr)).filter(Boolean);
  const txt = `Bestellung Nr. ${o.nr} für ${o.name} ${neu ? 'gespeichert' : 'geändert'} – Tier: ${o.tier}${auto ? ' (automatisch)' : ''}${kundeNeu ? ' – neuer Kunde angelegt' : ''}`;
  const gekipptHtml = gekippt.length ? `<p class="warn"><b>Dadurch reicht es bei ${gekippt.length === 1 ? 'einer anderen Bestellung' : gekippt.length + ' anderen Bestellungen'} von ${esc(o.tier)} nicht mehr:</b><br>${gekippt.map(x => `Nr. ${x.nr} – ${esc(x.name)}: ${esc(nachher[x.nr])}`).join('<br>')}</p><p class="klein">Genusspakete haben Vorrang und nehmen den früheren Einzelbestellungen etwas weg. Bitte diese Bestellung oder die genannten auf ein anderes Tier umstellen (Mengenprüfung).</p>` : '';
  const warnSelbst = check && check !== 'ok' && !check.startsWith('Warteliste') && !o.ueberbelegt;
  if (warnSelbst || gekippt.length) {
    await dialog('Achtung – Mengencheck', `<p>${esc(txt)}</p>${warnSelbst ? `<p class="warn">${esc(check)}</p><p>Die Bestellung ist gespeichert. Bitte prüfen, ob sie aufs nächste Tier umgestellt werden soll (Tier im Formular ändern).</p>` : ''}${gekipptHtml}`);
  } else meldung(txt + (check ? ' – Mengencheck: ' + (o.ueberbelegt && check !== 'ok' ? 'bewusst überbelegt' : check) : ''));
  if (neu) render(); else history.back();
}

// =====================================================================
//  Bestellungen (Liste)
// =====================================================================
function viewBestellungen() {
  titel('Bestellungen');
  const F = ui.filter;
  const liste = () => {
    const q = F.q.trim().toLowerCase();
    let os = S.bestellungen.slice().sort((a, b) => b.nr - a.nr);
    if (F.tier) os = os.filter(o => o.tier === F.tier);
    if (F.status === 'zahlung') os = os.filter(zahlungOffen); else if (F.status) os = os.filter(o => (o.status || 'offen') === F.status);
    if (q) os = os.filter(o => String(o.nr) === q || (o.name || '').toLowerCase().includes(q) || (o.tel || '').includes(q));
    const checks = {}; [...new Set(os.map(o => o.tier))].forEach(t => Object.assign(checks, mengencheckTier(S, t)));
    $('#liste').innerHTML = !os.length ? '<div class="karte">Keine Bestellungen gefunden.</div>' :
      `<div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Eingang</th><th>Wunschtermin</th><th>Name</th><th>Tier</th><th class="r">Pakete</th><th>Bestellung</th><th class="r">Schätzpreis</th><th>Status</th><th>Mengencheck</th></tr></thead><tbody>` +
      os.map(o => {
        const ch = o.tier === 'Warteliste' ? 'Warteliste – noch kein Tier' : tier(S, o.tier) ? (checks[o.nr] || '') : 'Tier unbekannt';
        return `<tr class="klick ${rotZeile(ch, o) ? 'rot' : ''}" data-act="oeffnen" data-nr="${o.nr}"><td class="r fett">${o.nr}</td><td>${fmtDate(o.eingang)}</td><td>${o.wunsch ? fmtDate(o.wunsch) : ''}</td><td>${esc(o.name)}</td><td>${esc(o.tier)}</td><td class="r">${num(o.pakete) || ''}</td><td class="klein" style="max-width:380px">${esc(kurzText(o))}</td><td class="r">${fmtEur(schaetzpreis(S, o))}</td><td>${statusMarke(o.status)}${zahlMarke(o)}${o.lagerOrt ? `<div class="klein">${esc(lagerText(o))}</div>` : ''}</td><td>${checkMarke(ch, o)}</td></tr>`;
      }).join('') + '</tbody></table></div>';
    $('#anzahl').textContent = `${os.length} Bestellung${os.length === 1 ? '' : 'en'}`;
  };
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">Bestellungen</h1><button class="btn" data-act="neuverteilen">Offene neu verteilen …</button><a class="btn" href="#/warteliste">Prüfliste Warteliste (${S.bestellungen.filter(o => o.tier === 'Warteliste' && o.name).length})</a><a class="btn haupt" href="#/neu">+ Neue Bestellung</a></div>
    <div class="suchzeile">
      <input class="feld" type="search" placeholder="Suchen: Name, Telefon oder Nr." data-in="q" value="${esc(F.q)}">
      <select class="feld" data-ch="ft" style="max-width:260px">${opt('', 'alle Tiere', !F.tier)}${tiereSortiert().map(t => opt(t.name, t.name, F.tier === t.name)).join('')}${opt('Warteliste', 'Warteliste', F.tier === 'Warteliste')}</select>
      <select class="feld" data-ch="fs" style="max-width:170px">${opt('', 'jeder Status', !F.status)}${['offen', 'gepackt', 'abgeholt'].map(s => opt(s, s, F.status === s)).join('')}${opt('zahlung', 'Zahlung offen', F.status === 'zahlung')}</select>
    </div><div class="klein" id="anzahl" style="margin-bottom:6px"></div><div id="liste"></div>`;
  ui.ins.q = el => { F.q = el.value; liste(); };
  ui.acts.ft = el => { F.tier = el.value; liste(); };
  ui.acts.fs = el => { F.status = el.value; liste(); };
  ui.acts.oeffnen = el => gehe('#/bestellung/' + el.dataset.nr);
  liste();
}
function kurzText(o) {
  const t = bestellText(S, o);
  return t.length > 120 ? t.slice(0, 118) + ' …' : t;
}

// =====================================================================
//  Kunden
// =====================================================================
function viewKunden() {
  titel('Kunden');
  const liste = () => {
    const q = ui.kfilter.trim().toLowerCase();
    const idx = bestellIndex(S);
    const ks = S.kunden.filter(k => !q || k.name.toLowerCase().includes(q) || (k.tel || '').includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    $('#liste').innerHTML = !ks.length ? '<div class="karte">Keine Kunden gefunden. Neue Kunden entstehen automatisch beim Speichern einer Bestellung.</div>' :
      `<div class="tabwrap"><table class="tab"><thead><tr><th class="r">Kd-Nr.</th><th>Name</th><th>Telefon</th><th>Mail</th><th class="r">Bestellungen</th><th>letzte</th><th class="r">Pakete</th><th class="r">Summe Endbeträge</th></tr></thead><tbody>` +
      ks.map(k => { const s = kundenStat(S, k, idx); return `<tr class="klick" data-act="oeffnen" data-nr="${k.nr}"><td class="r">${k.nr}</td><td class="fett">${esc(k.name)}</td><td>${esc(k.tel)}</td><td>${esc(k.mail)}</td><td class="r">${s.anzahl}</td><td>${fmtDate(kundeLetzte(S, k, idx))}</td><td class="r">${s.pakete || ''}</td><td class="r">${s.umsatz ? fmtEur(s.umsatz) : ''}</td></tr>`; }).join('') + '</tbody></table></div>';
  };
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">Kunden</h1><a class="btn" href="#/kunde/neu">+ Kunde anlegen</a></div>
    <div class="suchzeile"><input class="feld" type="search" placeholder="Suchen: Name oder Telefon" data-in="q" value="${esc(ui.kfilter)}"></div><div id="liste"></div>`;
  ui.ins.q = el => { ui.kfilter = el.value; liste(); };
  ui.acts.oeffnen = el => gehe('#/kunde/' + el.dataset.nr);
  liste();
}
function viewKunde(id) {
  const neu = id === 'neu';
  const k0 = neu ? { nr: null, name: '', tel: '', mail: '', notiz: '' } : S.kunden.find(k => k.nr === +id);
  if (!k0) { inhalt().innerHTML = '<div class="fehlerbox">Kunde nicht gefunden.</div>'; return; }
  const k = { ...k0 };
  titel(neu ? 'Neuer Kunde' : k.name);
  const os = neu ? [] : S.bestellungen.filter(o => sameText(o.name, k.name)).sort((a, b) => b.nr - a.nr);
  const st = neu ? null : kundenStat(S, k);
  const fld = (f, t, typ = 'text') => `<label class="f">${t}<input class="feld" type="${typ}" data-in="k" data-f="${f}" value="${esc(k[f] || '')}"></label>`;
  inhalt().innerHTML = `<h1>${neu ? 'Neuer Kunde' : `Kd-Nr. ${k.nr}: ${esc(k.name)}`}</h1>
    <div class="spalten2"><div class="karte"><div class="formraster">
      <div class="ganz">${fld('name', 'Name (genau so wie in den Bestellungen)')}</div>${fld('tel', 'Telefon', 'tel')}${fld('mail', 'Mail', 'email')}
      <label class="f ganz">Notiz (Vorlieben, Hinweise)<textarea class="feld" data-in="k" data-f="notiz" placeholder="z. B. mag Hack mager, holt immer samstags">${esc(k.notiz || '')}</textarea>
        <span class="klein">Nur was für Bestellung und Abholung wichtig ist. <b>Keine Gesundheitsangaben</b> (Allergien, Krankheiten) und nichts Privates.</span></label></div>
      <div class="knopfleiste" style="margin-top:14px"><button class="btn haupt" data-act="speichern">Speichern</button>${neu ? '' : `<a class="btn" href="#/neu?kunde=${k.nr}">+ Neue Bestellung</a>`}${!neu && !os.length ? '<button class="btn rot" data-act="loeschen">Löschen</button>' : ''}${!neu && os.length ? '<button class="btn rot" data-act="anonym">Anonymisieren …</button>' : ''}</div>
      ${neu ? '' : `<p class="klein" style="margin-top:10px">Angelegt: ${fmtDate(k.angelegt) || '–'} · letzte Bestellung: ${fmtDate(kundeLetzte(S, k)) || '–'}</p>`}</div>
    <div>${neu ? '' : `<div class="karte"><b>${st.anzahl}</b> Bestellungen · <b>${st.pakete}</b> Genusspakete · Summe Endbeträge <b>${fmtEur(st.umsatz)}</b></div>
      <div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Eingang</th><th>Tier</th><th>Bestellung</th><th>Status</th></tr></thead><tbody>${os.map(o => `<tr class="klick" data-act="best" data-nr="${o.nr}"><td class="r">${o.nr}</td><td>${fmtDate(o.eingang)}</td><td>${esc(o.tier)}</td><td class="klein">${esc(kurzText(o))}</td><td>${statusMarke(o.status)}${zahlMarke(o)}</td></tr>`).join('') || '<tr><td colspan="5" class="klein">noch keine Bestellungen</td></tr>'}</tbody></table></div>`}</div></div>`;
  ui.ins.k = el => { k[el.dataset.f] = el.value; };
  ui.acts.best = el => gehe('#/bestellung/' + el.dataset.nr);
  ui.acts.speichern = async () => {
    k.name = k.name.trim();
    if (!k.name) return meldung('Bitte einen Namen eintragen.', true);
    const doppelt = S.kunden.find(x => sameText(x.name, k.name) && x.nr !== k.nr);
    if (doppelt) return meldung(`Den Namen „${k.name}“ gibt es schon (Kd-Nr. ${doppelt.nr}). Bei gleichen Namen z. B. den Ort ergänzen.`, true);
    if (sameText(k.name, ANONYM)) return meldung('„anonymisiert“ ist als Name reserviert.', true);
    if (neu) { k.nr = S.kunden.reduce((m, x) => Math.max(m, x.nr), 0) + 1; k.angelegt = todayISO(); S.kunden.push(k); }
    else {
      if (k0.name !== k.name) {
        const n = S.bestellungen.filter(o => sameText(o.name, k0.name)).length;
        if (n && !(await frage('Kunde umbenennen', `„${esc(k0.name)}“ in „${esc(k.name)}“ umbenennen? ${n} Bestellung(en) werden mit umgestellt.`))) return;
        S.bestellungen.forEach(o => { if (sameText(o.name, k0.name)) o.name = k.name; });
      }
      Object.assign(k0, k);
    }
    speichern(); meldung('Kunde gespeichert.'); gehe('#/kunde/' + k.nr);
  };
  ui.acts.loeschen = async () => {
    if (!(await frage('Kunde löschen', `Kunde „${esc(k.name)}“ löschen?`, 'Löschen', 'Abbrechen', 'rot'))) return;
    S.kunden = S.kunden.filter(x => x.nr !== k.nr); speichern(); gehe('#/kunden');
  };
  ui.acts.anonym = async () => {
    if (!(await frage('Kunde anonymisieren', `„${esc(k0.name)}“ aus der Kundenliste löschen? Die ${os.length} Bestellung(en) bleiben für Statistik und Ausbeute erhalten, aber <b>ohne Name, Telefon, Mail und Notiz</b>.${os.some(o => (o.status || 'offen') !== 'abgeholt') ? '<br><br><span class="warn">Achtung: Es gibt noch Bestellungen, die nicht abgeholt sind.</span>' : ''}<br><br>Das kann nicht rückgängig gemacht werden.`, 'Anonymisieren', 'Abbrechen', 'rot'))) return;
    const n = kundeAnonymisieren(S, k0); speichern(); meldung(`Kunde anonymisiert (${n} Bestellungen ohne Namen behalten).`); gehe('#/kunden');
  };
}

// =====================================================================
//  Tiere
// =====================================================================
function viewTiere() {
  titel('Tiere');
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">Tiere</h1><button class="btn" data-act="neuverteilen">Offene Bestellungen neu verteilen …</button><a class="btn" href="#/archiv">Archiv (${S.tiere.filter(t => t.archiv).length})</a><a class="btn haupt" href="#/tier/neu">+ Neues Tier</a></div>
    ${tiereSortiert().length ? '' : '<div class="karte">Keine aktiven Tiere angelegt.</div>'}
    <div class="tabwrap"><table class="tab"><thead><tr><th>Tier</th><th>Typ</th><th>Ohrmarke / Notiz</th><th>Schlachtung</th><th>Abholung</th><th class="r">SG (kg)</th><th class="r">Paket ca.</th><th class="r">Pakete bestellt / frei</th><th class="r">Bestellungen</th><th>Mengen</th></tr></thead><tbody>
    ${tiereSortiert().map(t => { const i = tierInfo(S, t); return `<tr class="klick ${i.reichtNicht ? 'rot' : ''}" data-act="oeffnen" data-t="${esc(t.name)}"><td class="fett">${esc(t.name)}</td><td>${esc(t.typ)}</td><td>${esc(t.notiz)}</td><td>${fmtDate(t.schlacht)}</td><td>${fmtDate(t.abhol) || 'offen'}</td><td class="r">${fmtNum(i.sg)}${num(t.sg) ? '' : ' <span class="klein">(Std.)</span>'}</td><td class="r">${fmtNum(i.paketKg, 1)} kg</td><td class="r">${fmtNum(i.pakete)} / <b class="${i.frei < 0 ? 'warn' : ''}">${fmtNum(i.frei)}</b></td><td class="r">${i.anzahl}</td><td>${i.reichtNicht ? `<span class="marke rot">${i.reichtNicht} reicht nicht</span>` : i.anzahl ? '<span class="marke gruen">ok</span>' : ''}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  ui.acts.oeffnen = el => gehe('#/tier/' + encodeURIComponent(el.dataset.t));
}
function viewTier(name) {
  const neu = name === 'neu';
  const t0 = neu ? null : tier(S, name);
  if (!neu && !t0) { inhalt().innerHTML = '<div class="fehlerbox">Tier nicht gefunden.</div>'; return; }
  const t = t0 ? { ...t0 } : { name: '', notiz: '', typ: 'Rind', sg: null, schlacht: '', abhol: '', kommentar: '' };
  titel(neu ? 'Neues Tier' : (t0.archiv ? 'Archiv – ' : 'Tier ') + t.name);
  const info = () => {
    if (neu) return 'Neues Tier – Name eintragen und speichern.';
    const i = tierInfo(S, t0);
    return `Rechnung mit <b>${fmtNum(i.sg)} kg</b> Schlachtgewicht · Paket ca. <b>${fmtNum(i.paketKg, 1)} kg</b><br>Pakete bestellt: <b>${fmtNum(i.pakete)}</b> · noch frei: <b class="${i.frei < 0 ? 'warn' : ''}">${fmtNum(i.frei)}</b><br>Bestellungen: <b>${i.anzahl}</b> · davon reicht nicht: <b class="${i.reichtNicht ? 'warn' : ''}">${i.reichtNicht}</b>`;
  };
  inhalt().innerHTML = `<h1>${neu ? 'Neues Tier' : 'Tier ' + esc(t.name)}${t0 && t0.archiv ? ` <span class="marke blau" style="font-size:15px">Archiv seit ${fmtDate(t0.archiv)}</span>` : ''}</h1>
   <div class="spalten2"><div class="karte"><div class="formraster">
    <label class="f ganz">Name / Nr.<input class="feld" data-in="t" data-f="name" value="${esc(t.name)}"></label>
    <label class="f ganz">Ohrmarke / Notiz<input class="feld" data-in="t" data-f="notiz" value="${esc(t.notiz || '')}"></label>
    <label class="f">Typ<select class="feld" data-in="t" data-f="typ">${['Rind', 'Bulle'].map(x => opt(x, x, t.typ === x)).join('')}</select></label>
    <label class="f">Schlachtgewicht (kg, leer = Standard ${fmtNum(t.typ === 'Bulle' ? S.settings.sgBulle : S.settings.sgRind)})<input class="feld zahl" inputmode="decimal" data-in="t" data-f="sg" value="${has(t.sg) ? fmtIn(t.sg, 1) : ''}"></label>
    <label class="f">Schlachttermin<input class="feld" type="date" data-in="t" data-f="schlacht" value="${esc(t.schlacht || '')}"></label>
    <label class="f">Abholtermin<input class="feld" type="date" data-in="t" data-f="abhol" value="${esc(t.abhol || '')}"></label>
    <label class="f ganz">Kommentar / Notizen<textarea class="feld" rows="3" data-in="t" data-f="kommentar" placeholder="z. B. sehr fett, Bug klein ausgefallen">${esc(t.kommentar || '')}</textarea></label>
    ${neu ? '' : `<label class="zeile ganz" style="gap:10px"><input type="checkbox" data-in="t" data-f="ohneStatistik" style="width:24px;height:24px"${t.ohneStatistik ? ' checked' : ''}> nicht in die Ausbeute-Statistik übernehmen <span class="klein">(z. B. Ausreißer)</span></label>`}
   </div><div class="hinweis" style="margin-top:14px;margin-bottom:0">${info()}</div>
   <div class="knopfleiste" style="margin-top:14px"><button class="btn haupt" data-act="speichern">Speichern</button>${neu ? '' : t0.archiv ? `<button class="btn" data-act="zurueck">Aus dem Archiv holen</button><button class="btn rot" data-act="loeschen">Löschen</button>` : `<a class="btn" href="#/schlachttag/menge?tier=${encodeURIComponent(t.name)}">Mengenprüfung</a><a class="btn" href="#/neu?tier=${encodeURIComponent(t.name)}">+ Bestellung für dieses Tier</a><button class="btn" data-act="archiv">Ins Archiv</button><button class="btn rot" data-act="loeschen">Löschen</button>`}</div></div>
   <div>${neu ? '' : tierBestellListe(t.name)}</div></div>
   ${neu ? '' : tierAusbeuteHtml(t0)}`;
  ui.ins.t = el => { const f = el.dataset.f; t[f] = el.type === 'checkbox' ? el.checked : f === 'sg' ? (el.value.trim() ? num(el.value) : null) : el.value; };
  ui.acts.archiv = async () => {
    if (!(num(t0.sg) > 0)) return dialog('Schlachtgewicht fehlt', '<p>Bitte zuerst das echte Schlachtgewicht eintragen und speichern – es wird für die Ausbeute-Statistik gebraucht.</p>');
    if (S.kisten.some(k => k.tier === t0.name)) return dialog('Noch Kisten offen', '<p>Für dieses Tier sind noch Kisten eingetragen. Bitte unter Schlachttag → Kisten & Ladeplan „Tier abgeschlossen“ verwenden (Reste gehen dann an den Hofladen).</p>');
    const offen = ordersOfTier(S, t0.name).filter(o => (o.status || 'offen') === 'offen');
    if (offen.length && !(await frage('Ins Archiv', `${offen.length} Bestellung(en) sind noch offen. Trotzdem ins Archiv?`, 'Ins Archiv', 'Abbrechen'))) return;
    archivStandFesthalten(S, t0); t0.archiv = todayISO(); speichern(); meldung(`${t0.name} ist im Archiv.`); render();
  };
  ui.acts.zurueck = async () => {
    if (!(await frage('Aus dem Archiv holen', `${esc(t0.name)} wieder zu den aktiven Tieren nehmen? Es zählt dann nicht mehr für die Ausbeute-Statistik.`, 'Zurückholen', 'Abbrechen'))) return;
    t0.archiv = null; delete t0.archivStand; ordersOfTier(S, t0.name).forEach(o => { if (!preisBleibtFest(S, o)) delete o.preisFest; }); speichern(); meldung(`${t0.name} ist wieder aktiv.`); render();
  };
  ui.acts.erfWeg = async el => { if (!(await frage('Gewogenes Teil löschen', 'Diesen Eintrag löschen?', 'Löschen', 'Abbrechen', 'rot'))) return; t0.erfassung.splice(+el.dataset.i, 1); speichern(); render(); };
  ui.acts.best = el => gehe('#/bestellung/' + el.dataset.nr);
  ui.acts.speichern = async () => {
    t.name = String(t.name || '').trim();
    if (!t.name) return meldung('Bitte einen Namen für das Tier eintragen.', true);
    if (t.name === 'Warteliste') return meldung('„Warteliste“ ist als Name reserviert.', true);
    const altAbhol = t0 ? t0.abhol : '';
    const anderes = S.tiere.find(x => sameText(x.name, t.name) && x !== t0);
    if (anderes) return meldung(`Ein Tier mit dem Namen „${t.name}“ gibt es schon.`, true);
    if (neu) S.tiere.push(t);
    else {
      if (t0.name !== t.name) {
        if (!(await frage('Tier umbenennen', `Tier „${esc(t0.name)}“ in „${esc(t.name)}“ umbenennen? Alle Bestellungen und Kisten werden mit umgestellt.`))) return;
        tierUmbenennen(S, t0.name, t.name);
      }
      Object.assign(t0, t);
    }
    speichern();
    const tt = tier(S, t.name);
    meldung('Tier gespeichert.');
    // neues Tier oder neuer Termin: offene Bestellungen (inkl. Warteliste) neu verteilen anbieten
    if (!tt.archiv && tt.abhol && (neu || altAbhol !== tt.abhol)) await neuVerteilenDialog(true);
    history.replaceState(null, '', '#/tier/' + encodeURIComponent(tt.name)); letzterHash = location.hash; render();
  };
  ui.acts.loeschen = async () => {
    const n = S.bestellungen.filter(o => o.tier === t0.name).length;
    if (!(await frage('Tier löschen', `Tier „${esc(t0.name)}“ löschen?${n ? ` ${n} Bestellung(en) kommen auf die Warteliste.` : ''} Kisten dieses Tiers werden geleert.`, 'Löschen', 'Abbrechen', 'rot'))) return;
    S.bestellungen.forEach(o => { if (o.tier === t0.name) o.tier = 'Warteliste'; });
    S.kisten = S.kisten.filter(k => k.tier !== t0.name);
    delete S.packplaene[t0.name]; delete S.metzgerManuell[t0.name];
    S.tiere = S.tiere.filter(x => x !== t0); speichern(); gehe('#/tiere');
  };
}
function viewArchiv() {
  titel('Tier-Archiv');
  const liste = S.tiere.filter(t => t.archiv).sort((a, b) => String(b.archiv).localeCompare(String(a.archiv)) || a.name.localeCompare(b.name));
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">Tier-Archiv</h1><a class="btn" href="#/tiere">◀ aktive Tiere</a></div>
    <p class="klein">Abgeschlossene Tiere mit ihren Bestellungen, der gewogenen Ausbeute und dem Kistenstand am Ende. Tiere mit echtem Schlachtgewicht und gewogenen Teilen fließen in die Ausbeute (Einstellungen), sobald ${STAT_MIN_TIERE} Tiere eines Typs erfasst sind – außer „nicht in die Statistik“.</p>
    ${liste.length ? '' : '<div class="karte">Noch keine Tiere im Archiv. Tiere kommen hierher über Schlachttag → Kisten & Ladeplan → „Tier abgeschlossen“ oder über „Ins Archiv“ beim Tier.</div>'}
    ${liste.length ? `<div class="tabwrap"><table class="tab"><thead><tr><th>Tier</th><th>Typ</th><th>Abholung</th><th>Archiv seit</th><th class="r">SG (kg)</th><th class="r">Bestellungen</th><th class="r">gewogen</th><th>Statistik</th><th>Kommentar</th></tr></thead><tbody>
    ${liste.map(t => { const su = erfassungSumme(t, S); return `<tr class="klick" data-act="oeffnen" data-t="${esc(t.name)}"><td class="fett">${esc(t.name)}</td><td>${esc(t.typ)}</td><td>${fmtDate(t.abhol)}</td><td>${fmtDate(t.archiv)}</td><td class="r">${num(t.sg) > 0 ? fmtNum(t.sg) : '<span class="warn">fehlt</span>'}</td><td class="r">${ordersOfTier(S, t.name).length}</td><td class="r">${su.teile ? `${fmtNum(su.kg, 1)} kg · ${su.teile} ${su.teile === 1 ? 'Teil' : 'Teile'}` : '–'}</td><td>${zaehltStatistik(t) ? '<span class="marke gruen">zählt</span>' : t.ohneStatistik ? '<span class="marke">ausgeblendet</span>' : '<span class="marke gelb">zählt nicht</span>'}</td><td class="klein">${esc(t.kommentar || '')}</td></tr>`; }).join('')}
    </tbody></table></div>` : ''}`;
  ui.acts.oeffnen = el => gehe('#/tier/' + encodeURIComponent(el.dataset.t));
}
// Ausbeute (gewogen) und Kistenstand am Ende – im Tier-Detail und im Archiv
function tierAusbeuteHtml(t) {
  const au = ausbeuteTier(S, t);
  const er = (t.erfassung || []).map((e, i) => ({ e, i }));
  const grund = !t.archiv ? 'zählt erst nach dem Archivieren' : t.ohneStatistik ? 'aus der Statistik ausgeblendet' : !(num(t.sg) > 0) ? 'zählt nicht – echtes Schlachtgewicht fehlt' : !au.anzahl ? 'zählt nicht – nichts gewogen' : 'zählt für die Ausbeute-Statistik';
  let h = `<div class="karte"><h3 style="margin-top:0">Ausbeute gewogen <span class="klein">– ${au.anzahl} Teile, ${fmtNum(au.kg, 2)} kg${au.sg > 0 ? ` · ${fmtNum(au.kg / au.sg * 100, 1)} % vom SG ${fmtNum(au.sg)} kg` : ''} · ${grund}</span></h3>
    <p class="klein">Gewogen wird beim Kommissionieren (jedes Teil in Gramm antippen), Reste mit „Rest (Hofladen)“. Hackfleisch, Suppen- und Soßenknochen kommen aus den gewogenen Kisten (beim Hack abzüglich dessen, was laut Plan an Gulasch/Bug ins Hack ging). Ein Artikel zählt für die Statistik nur, wenn bei diesem Tier etwas davon gewogen wurde.</p>
    <div class="spalten2"><div class="tabwrap"><table class="tab"><thead><tr><th>Artikel</th><th class="r">Teile</th><th class="r">kg</th><th class="r">% vom SG</th><th class="r">Einstellung</th><th class="r">Plan kg</th></tr></thead><tbody>
    ${au.rows.map(r => `<tr><td>${esc(r.art)}${r.kisten ? ` <span class="klein">(${r.teile} ${r.teile === 1 ? 'Kiste' : 'Kisten'}${r.abzug > 0.05 ? `, − ${fmtNum(r.abzug, 1)} kg Gulasch/Bug` : ''})</span>` : ''}</td><td class="r">${r.kisten ? '' : r.teile || ''}</td><td class="r">${r.kg ? fmtNum(r.kg, 2) : '–'}</td><td class="r">${r.anteil !== null ? fmtNum(r.anteil * 100, 2) + ' %' : ''}</td><td class="r klein">${r.ref !== null ? fmtNum(r.ref * 100, 2) + ' %' : ''}</td><td class="r klein">${r.plan !== null ? fmtNum(r.plan, 1) : ''}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="tabwrap"><table class="tab"><thead><tr><th>Braten-Teilstück</th><th class="r">Teile</th><th class="r">kg</th><th class="r">kg je gewachsenes Stück</th><th class="r">Einstellung</th></tr></thead><tbody>
    ${au.teile.map(r => `<tr><td>${esc(r.teil)}</td><td class="r">${r.teile || ''}</td><td class="r">${r.kg ? fmtNum(r.kg, 2) : '–'}</td><td class="r">${r.jeStueck !== null ? `${fmtNum(r.jeStueck, 2)} <span class="klein">(÷ ${r.stueck})</span>` : ''}</td><td class="r klein">${fmtNum(r.ref, 2)}</td></tr>`).join('') || '<tr><td colspan="5" class="klein">keine Braten-Teilstücke in den Einstellungen</td></tr>'}
    </tbody></table></div></div>
    ${er.length ? `<details style="margin-top:10px"><summary class="fett">Alle gewogenen Teile (${er.length})</summary><div class="tabwrap" style="margin-top:8px"><table class="tab"><thead><tr><th>Artikel</th><th class="r">g</th><th>für</th><th></th></tr></thead><tbody>
      ${er.map(({ e, i }) => `<tr><td>${esc(e.teil ? e.art + ': ' + e.teil : e.art)}</td><td class="r">${fmtNum(num(e.kg) * 1000, 0)}</td><td>${num(e.nr) ? 'Nr. ' + e.nr + ' ' + esc((S.bestellungen.find(o => o.nr === num(e.nr)) || {}).name || '') : 'Rest (Hofladen)'}</td><td style="width:44px"><button class="btn klein rot" data-act="erfWeg" data-i="${i}">✕</button></td></tr>`).join('')}
    </tbody></table></div></details>` : ''}</div>`;
  if (t.abschluss && t.abschluss.kisten && t.abschluss.kisten.length) {
    const ks = t.abschluss.kisten, stk = k => k.einheit === 'Stk';
    h += `<div class="karte"><h3 style="margin-top:0">Kisten am Ende <span class="klein">– Stand beim Abschluss am ${fmtDate(t.abschluss.datum)} (Rest ging an den Hofladen)</span></h3>
      <div class="tabwrap"><table class="tab"><thead><tr><th class="r">Kiste</th><th>Inhalt</th><th class="r">kg</th><th class="r">Plan</th><th class="r">an Bestellungen</th><th class="r">Rest</th><th>Teilstücke</th></tr></thead><tbody>
      ${ks.map(k => `<tr><td class="r">${k.nr}</td><td>${esc(k.art)}</td><td class="r">${stk(k) ? fmtNum(k.kg, 0) + ' Stk' + (has(k.gew) ? ' · ' + fmtNum(k.gew, 2) + ' kg' : '') : fmtNum(k.kg, 1)}</td><td class="r klein">${has(k.plan) ? fmtNum(k.plan, 1) : ''}</td><td class="r">${fmtNum(k.verplant, stk(k) ? 0 : 1)}</td><td class="r fett">${fmtNum(k.rest, stk(k) ? 0 : 1)}</td><td class="klein">${esc(k.info || '')}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }
  return h;
}
function tierBestellListe(name) {
  const os = ordersOfTier(S, name); const ch = mengencheckTier(S, name);
  return `<div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Name</th><th class="r">Pakete</th><th>Bestellung</th><th>Mengencheck</th></tr></thead><tbody>${os.map(o => `<tr class="klick ${rotZeile(ch[o.nr], o) ? 'rot' : ''}" data-act="best" data-nr="${o.nr}"><td class="r">${o.nr}</td><td>${esc(o.name)}</td><td class="r">${num(o.pakete) || ''}</td><td class="klein">${esc(kurzText(o))}</td><td>${checkMarke(ch[o.nr], o)}</td></tr>`).join('') || '<tr><td colspan="5" class="klein">noch keine Bestellungen</td></tr>'}</tbody></table></div>`;
}

// =====================================================================
//  Bestellung teilen
// =====================================================================
async function teilenDialog(nr) {
  const o = S.bestellungen.find(x => x.nr === nr);
  const zeilen = teilZeilen(S, o);
  if (!zeilen.length) return meldung(num(o.pakete) > 0 ? 'Nichts zum Verschieben – Genusspakete bleiben immer bei diesem Tier.' : 'Die Bestellung enthält nichts zum Verschieben.', true);
  const fehl = teilFehlmengen(S, o);
  const hatFehl = Object.keys(fehl).length > 0;
  // Ziel: nächstes Tier nach dem jetzigen, sonst Warteliste
  const jetzt = tier(S, o.tier);
  const spaeter = tiereSortiert().filter(t => t.name !== o.tier && (!jetzt || !jetzt.abhol || (t.abhol || '9999') > jetzt.abhol));
  const zielStd = spaeter.length ? spaeter[0].name : 'Warteliste';
  const start = teilVorschlag(S, o, hatFehl ? 'fehl' : 20);
  const html = `<p>Bestellung Nr. ${o.nr} – <b>${esc(o.name)}</b> (jetzt: ${esc(o.tier)}). Die eingetragenen Mengen kommen in eine <b>neue Bestellung</b> beim Ziel-Tier, der Rest bleibt hier.</p>
    ${hatFehl ? `<p class="warn">Reicht nicht: ${Object.entries(fehl).map(([k, v]) => `${esc(k)} ${fmtNum(v, 1)} kg`).join(', ')}</p>` : '<p class="ok">Mengencheck ist ok – Teilen ist trotzdem möglich.</p>'}
    <label class="f" style="margin-bottom:10px">verschieben zu<select class="feld" id="tzziel">${tiereSortiert().filter(t => t.name !== o.tier).map(t => opt(t.name, `${t.name}${t.abhol ? ' – Abholung ' + fmtDate(t.abhol) : ''}`, t.name === zielStd)).join('')}${opt('Warteliste', 'Warteliste', zielStd === 'Warteliste')}</select></label>
    <div class="knopfleiste" style="margin-bottom:8px">${hatFehl ? '<button class="btn klein" data-p="fehl">nur Fehlmenge</button>' : ''}<button class="btn klein" data-p="20">20 %</button><button class="btn klein" data-p="40">40 %</button><button class="btn klein" data-p="50">50 %</button><button class="btn klein" data-p="0">nichts</button></div>
    <table class="tab"><thead><tr><th>Artikel</th><th class="r">bestellt</th><th class="r">verschieben</th><th></th><th class="r">bleibt</th></tr></thead><tbody>
    ${zeilen.map(r => `<tr data-row="${esc(r.key)}"><td>${esc(r.text)}</td><td class="r">${fmtNum(r.bestellt, 3)}${r.max < r.bestellt ? `<div class="klein">max. ${fmtNum(r.max, 3)}</div>` : ''}${r.sonderRest ? `<div class="klein">${esc(r.sonderRest)}</div>` : ''}</td><td style="width:110px"><input class="feld zahl tz" inputmode="decimal" data-key="${esc(r.key)}" value="${fmtIn(start[r.key] || 0, 3)}"></td><td class="klein">${esc(r.einheit)}</td><td class="r tzb"></td></tr>`).join('')}
    </tbody></table><p class="klein">${num(o.pakete) > 0 ? `<b>${fmtNum(o.pakete)} ${num(o.pakete) > 1 ? 'Genusspakete bleiben' : 'Genusspaket bleibt'} bei ${esc(o.tier)}</b> – Pakete sind nicht teilbar und haben Vorrang. ` : ''}Stück, Beutel und Portionen werden auf ganze Zahlen gerundet, kg auf 0,1 kg. Sonderwünsche bleiben bei der ursprünglichen Bestellung.</p>`;
  const d = $('#dialog');
  let werte = null, ziel = zielStd;
  const bleibt = () => $$('#dialog tbody tr').forEach(tr => {
    const r = zeilen.find(x => x.key === tr.dataset.row); const inp = $('input', tr);
    const zuViel = num(inp.value) > r.max + 1e-9; inp.classList.toggle('fehlt', zuViel);
    $('.tzb', tr).textContent = fmtNum(r.bestellt - Math.min(r.max, num(inp.value)), 3);
  });
  const presets = e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const v = teilVorschlag(S, o, b.dataset.p === 'fehl' ? 'fehl' : num(b.dataset.p));
    $$('#dialog input.tz').forEach(i => { i.value = fmtIn(v[i.dataset.key] || 0, 3); }); bleibt();
  };
  const merk = e => { if (e.target.closest('[data-k="ok"]')) { werte = {}; $$('#dialog input.tz').forEach(i => { werte[i.dataset.key] = num(i.value); }); ziel = $('#tzziel').value; } };
  const inp = e => { if (e.target.classList.contains('tz')) bleibt(); };
  d.addEventListener('click', presets, true); d.addEventListener('click', merk, true); d.addEventListener('input', inp);
  const p = dialog(`Bestellung Nr. ${o.nr} teilen`, html, [{ k: 'x', t: 'Abbrechen' }, { k: 'ok', t: 'Teilen', cls: 'haupt' }]);
  bleibt();
  const k = await p;
  d.removeEventListener('click', presets, true); d.removeEventListener('click', merk, true); d.removeEventListener('input', inp);
  if (k !== 'ok' || !werte) return;
  const neu = bestellungTeilen(S, o, werte, ziel);
  if (!neu) return meldung('Nichts zum Verschieben eingetragen.', true);
  speichern();
  const c1 = mengencheck(S, o), c2 = mengencheck(S, neu);
  await dialog('Bestellung geteilt', `<p>Nr. ${o.nr} bleibt bei <b>${esc(o.tier)}</b> – Mengencheck: <b>${esc(c1 || '–')}</b><br>Neu: <b>Nr. ${neu.nr}</b> bei <b>${esc(neu.tier)}</b> – Mengencheck: <b>${esc(c2 || '–')}</b></p><p class="klein">Beide Bestellungen sind miteinander vermerkt (Notiz).</p>`);
  ui.formDirty = false; render();
}
