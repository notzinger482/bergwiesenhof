// Bestellsystem Bergwiesenhof – Oberfläche (Teil 1: Grundgerüst, Start, Bestellung, Listen)
'use strict';

const APP_VERSION = '1.5.0';
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
  const navKey = seite === 'bestellung' ? 'bestellungen' : seite === 'kunde' ? 'kunden' : seite === 'tier' ? 'tiere' : seite;
  navRender(navKey);
  const V = {
    start: viewStart, neu: () => viewBestellung(null, q), bestellung: () => viewBestellung(+teile[1], q), bestellungen: viewBestellungen,
    kunden: viewKunden, kunde: () => viewKunde(teile[1]), tiere: viewTiere, tier: () => viewTier(teile[1]),
    schlachttag: () => viewSchlachttag(teile[1] || 'menge', q), kommissionierung: () => viewKommissionierung(q),
    hofladen: viewHofladen, einstellungen: () => viewEinstellungen(teile[1] || 'daten')
  };
  try { (V[seite] || viewStart)(); }
  catch (e) { console.error(e); inhalt().innerHTML = `<div class="fehlerbox">Fehler beim Anzeigen: ${esc(e.message)}</div>`; }
  window.scrollTo(0, 0);
}

// Ereignisse (delegiert)
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (el && ui.acts[el.dataset.act]) { e.preventDefault(); ui.acts[el.dataset.act](el, e); }
});
document.addEventListener('input', e => { const el = e.target.closest('[data-in]'); if (el && ui.ins[el.dataset.in]) ui.ins[el.dataset.in](el, e); });
document.addEventListener('change', e => { const el = e.target.closest('[data-ch]'); if (el && ui.acts[el.dataset.ch]) ui.acts[el.dataset.ch](el, e); });

// ---------- Hilfen für Formulare ----------
const opt = (v, t, sel) => `<option value="${esc(v)}"${sel ? ' selected' : ''}>${esc(t)}</option>`;
const tiereSortiert = () => S.tiere.slice().sort((a, b) => (a.abhol || '9999').localeCompare(b.abhol || '9999') || a.name.localeCompare(b.name));
function standardTier() {
  if (ui.tierWahl && tier(S, ui.tierWahl)) return ui.tierWahl;
  const heute = todayISO();
  const t = tiereSortiert().find(t => t.abhol && t.abhol >= isoOf(new Date(Date.now() - 10 * 864e5)));
  return t ? t.name : (S.tiere[0] ? S.tiere[0].name : '');
}
const statusMarke = s => s === 'abgeholt' ? '<span class="marke blau">abgeholt</span>' : s === 'gepackt' ? '<span class="marke gruen">gepackt</span>' : '<span class="marke">offen</span>';
function checkMarke(txt) {
  if (!txt) return '';
  if (txt === 'ok') return '<span class="marke gruen">ok</span>';
  if (txt.startsWith('Warteliste')) return '<span class="marke gelb">Warteliste</span>';
  return `<span class="marke rot">${esc(txt)}</span>`;
}
function tierOptionen(gewaehlt, mitAuto, vorschlag) {
  let h = mitAuto ? opt('', `automatisch${vorschlag ? ' → ' + vorschlag : ''}`, !gewaehlt) : '';
  for (const t of tiereSortiert()) h += opt(t.name, `${t.name}${t.abhol ? ' – Abholung ' + fmtDate(t.abhol) : ''}`, gewaehlt === t.name);
  h += opt('Warteliste', 'Warteliste', gewaehlt === 'Warteliste');
  if (gewaehlt && gewaehlt !== 'Warteliste' && !tier(S, gewaehlt)) h += opt(gewaehlt, gewaehlt + ' (unbekannt)', true);
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
  if (!ui.dauerhaft) h += `<div class="hinweis klein">Hinweis: Der dauerhafte Speicher ist noch nicht bestätigt. Bitte die App über „Zum Startbildschirm hinzufügen“ installieren – dann löscht Android die Daten nicht von selbst.</div>`;
  h += `<div class="zeile" style="margin-bottom:16px"><a class="btn haupt" href="#/neu" style="min-height:60px;font-size:19px;padding:0 28px">+ Neue Bestellung</a>
    <div class="kachel"><div class="gross">${offen}</div><div class="klein">offene Bestellungen</div></div>
    <div class="kachel"><div class="gross">${warte}</div><div class="klein">auf der Warteliste</div></div>
    <div class="kachel"><div class="gross">${S.kunden.length}</div><div class="klein">Kunden</div></div></div>`;
  if (ui.letzteNr) h += `<p class="klein">Zuletzt gespeichert: <a href="#/bestellung/${ui.letzteNr}">Bestellung Nr. ${ui.letzteNr}</a></p>`;
  h += `<h2>Tiere</h2>`;
  if (!kommende.length) h += `<div class="karte">Noch keine Tiere angelegt. <a href="#/tier/neu">Tier anlegen</a></div>`;
  h += '<div class="raster">' + kommende.map(tierKarte).join('') + '</div>';
  inhalt().innerHTML = h;
  ui.acts.sichern = async () => { if (S.settings.sicherungUrl) { const r = await autoSicherung(true); if (r.ok) { meldung('Sicherung in Google Drive abgelegt: ' + r.datei); render(); return; } meldung('Google-Drive-Sicherung fehlgeschlagen: ' + r.fehler, true); } sicherungErstellen(true); };
  ui.acts.tier = el => gehe('#/schlachttag/menge?tier=' + encodeURIComponent(el.dataset.t));
}
function tierKarte(t) {
  const i = tierInfo(S, t);
  const nen = num(S.settings.nenner) || 16;
  const pct = Math.min(100, i.pakete / nen * 100);
  return `<div class="karte tierkarte" data-act="tier" data-t="${esc(t.name)}">
    <div class="kopfz"><span class="name">${esc(t.name)}</span><span class="klein">${esc(t.typ || '')}</span></div>
    <div class="klein">Abholung: <b>${t.abhol ? fmtDate(t.abhol) : 'offen'}</b>${t.schlacht ? ' · Schlachtung ' + fmtDate(t.schlacht) : ''}</div>
    <div class="balken ${i.frei < 0 ? 'ueber' : i.frei === 0 ? 'voll' : ''}"><div style="width:${pct}%"></div></div>
    <div class="klein">Genusspakete: <b>${fmtNum(i.pakete)}</b> von ${nen} · frei ${fmtNum(i.frei)}</div>
    <div class="klein">${i.anzahl} Bestellungen${i.reichtNicht ? ` · <span class="warn">${i.reichtNicht} reicht nicht</span>` : ''}</div></div>`;
}

// =====================================================================
//  Bestellformular
// =====================================================================
function leereBestellung() {
  return { nr: null, eingang: todayISO(), tier: '', name: '', tel: '', mail: '', weg: '', notiz: '', wunsch: '', pakete: 0, pakVak: 0, tuetenManuell: null, pos: {}, sonder: [], endbetrag: null, status: 'offen' };
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
      <td style="width:76px">${kgArt ? `<input class="feld zahl" inputmode="numeric" data-in="pos" data-f="anzahl" value="${has(p.anzahl) ? fmtNum(p.anzahl, 3) : ''}" placeholder="Anz.">` : ''}</td>
      <td style="width:86px">${kgArt ? `<input class="feld zahl" inputmode="numeric" data-in="pos" data-f="g" value="${has(p.g) ? fmtNum(p.g, 0) : ''}" placeholder="g">` : ''}</td>
      <td style="width:96px"><input class="feld zahl" inputmode="decimal" data-in="pos" data-f="menge" value="${has(p.menge) ? fmtNum(p.menge, 3) : ''}" placeholder="${eh === 'kg' ? 'kg' : eh}"></td>
      <td class="einh">${eh === 'Btl' ? `Btl<br><span class="klein">à ${a.beutelG} g</span>` : eh}</td>
      <td class="c">${a.amStueck ? `<label class="check"><input type="checkbox" data-in="pos" data-f="amStueck"${p.amStueck ? ' checked' : ''}></label>` : ''}</td>
      <td class="c"><label class="check"><input type="checkbox" data-in="pos" data-f="vak"${p.vak ? ' checked' : ''}></label></td>
    </tr>`;
  }).join('');
  const sonderRows = () => (o.sonder.length ? o.sonder : []).map((s, i) => sonderZeile(s, i)).join('');
  const letzte = !nr && o.name ? letzteBestellungVon(o.name) : null;
  inhalt().innerHTML = `
  <datalist id="kundenliste">${S.kunden.slice().sort((a, b) => a.name.localeCompare(b.name)).map(k => `<option value="${esc(k.name)}">`).join('')}</datalist>
  <div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">${nr ? `Bestellung Nr. ${nr}` : 'Neue Bestellung'}</h1>
    ${nr ? `${o.lagerOrt ? `<span class="marke blau" style="font-size:15px;padding:6px 12px">${esc(lagerText(o))}</span>` : ''}<button class="btn" data-act="lager">Lagerplatz …</button><select class="feld" style="width:auto" data-in="kopf" data-f="status">${['offen', 'gepackt', 'abgeholt'].map(s => opt(s, s, (o.status || 'offen') === s)).join('')}</select>
    <button class="btn" data-act="teilen">Teilen …</button><button class="btn rot" data-act="loeschen">Löschen</button>` : ''}
    ${ui.letzteNr && !nr ? `<a class="btn klein" href="#/bestellung/${ui.letzteNr}">Zuletzt: Nr. ${ui.letzteNr} öffnen</a>` : ''}</div>
  <div id="fehler"></div>
  <div class="spalten2">
    <div>
      <div class="karte"><h3 style="margin-top:0">Kunde</h3>
        <div class="formraster">
          <label class="f ganz">Name<input class="feld" list="kundenliste" data-in="kopf" data-f="name" value="${esc(o.name)}" autocomplete="off" placeholder="Nachname, Vorname"></label>
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
          <label class="f ganz">Notiz intern<input class="feld" data-in="kopf" data-f="notiz" value="${esc(o.notiz)}"></label>
        </div>
      </div>
      <div class="karte"><h3 style="margin-top:0">Genusspakete <span class="klein">(1/${num(st.nenner)} Tier, ca. ${fmtNum(st.paketVon)}–${fmtNum(st.paketBis)} kg, ${fmtEur(st.preisPaketKg)}/kg)</span></h3>
        <div class="zeile">
          <div><div class="klein fett">Anzahl</div><div class="stepper"><button data-act="step" data-f="pakete" data-d="-1">−</button><input class="feld zahl" inputmode="numeric" data-in="kopf" data-f="pakete" value="${num(o.pakete) || ''}"><button data-act="step" data-f="pakete" data-d="1">+</button></div></div>
          <div><div class="klein fett">davon vakuumiert (${fmtEur(st.preisVakPaket)})</div><div class="stepper"><button data-act="step" data-f="pakVak" data-d="-1">−</button><input class="feld zahl" inputmode="numeric" data-in="kopf" data-f="pakVak" value="${num(o.pakVak) || ''}"><button data-act="step" data-f="pakVak" data-d="1">+</button></div></div>
        </div>
      </div>
      <div class="karte"><h3 style="margin-top:0">Sonderwünsche <span class="klein">– macht der Metzger separat</span></h3>
        <div class="klein" style="margin-bottom:6px">z. B. Hackfleisch 2000 g „besonders mager“. Die Menge gehört trotzdem rechts mit in die Bestellung.</div>
        <div id="sonderliste">${sonderRows()}</div>
        <button class="btn klein" data-act="sonderNeu">+ Sonderwunsch</button>
      </div>
      <div class="karte"><label class="f">Vakuum-Tüten (leer = automatisch)<input class="feld zahl" inputmode="numeric" style="max-width:160px" data-in="kopf" data-f="tuetenManuell" value="${has(o.tuetenManuell) ? o.tuetenManuell : ''}" id="tuetenfeld"></label><div class="klein" id="tuetenauto"></div></div>
    </div>
    <div class="karte">
      <h3 style="margin-top:0">Einzelartikel</h3>
      <div class="klein" style="margin-bottom:6px">Anzahl × g ergibt die Menge automatisch (z. B. 6 × 500 g). Nur Anzahl (z. B. 4 Rostbraten): kg werden über das Stückgewicht geschätzt.</div>
      <table class="tab art-tab"><thead><tr><th>Artikel</th><th class="r">Anzahl</th><th class="r">× g</th><th class="r">= Menge</th><th></th><th class="c">am Stück</th><th class="c">vak.</th></tr></thead><tbody>${artRows}</tbody></table>
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
        mF.classList.remove('auto', 'schaetz', 'fehlt'); mF.readOnly = false;
        if (an > 0 && g > 0) { mF.value = fmtNum(an * g / 1000, 3); mF.classList.add('auto'); mF.readOnly = true; }
        else if (an > 0 && !(num(p.menge) > 0)) {
          if (num(a.stueckG) > 0) { mF.value = fmtNum(an * a.stueckG / 1000, 3); mF.classList.add('schaetz'); mF.readOnly = true; }
          else { mF.value = ''; mF.classList.add('fehlt'); }
        } else if (mF.readOnly === false && (mF.classList.contains('auto') || mF.classList.contains('schaetz'))) mF.value = '';
      }
      tr.classList.toggle('hat', qty(S, o, a.name) > 0);
    });
    // Tier
    const vors = tierVorschlag(S, o.wunsch, o.pakete, o.nr);
    $('#tierwahl').innerHTML = tierOptionen(o.tier, true, vors);
    const tn = o.tier || vors, t = tier(S, tn);
    let ti = '';
    if (t) { const inf = tierInfo(S, t); const eigen = o.nr && S.bestellungen.find(x => x.nr === o.nr && x.tier === t.name); const frei = inf.frei + (eigen ? num(eigen.pakete) : 0) - num(o.pakete);
      ti = `${o.tier ? '' : 'Vorschlag: '}<b>${esc(t.name)}</b> – Abholung ${t.abhol ? fmtDate(t.abhol) : 'offen'} · nach dieser Bestellung noch <b class="${frei < 0 ? 'warn' : ''}">${fmtNum(frei)}</b> Pakete frei, ${inf.anzahl} Bestellungen`; }
    else if (tn === 'Warteliste') ti = '<span class="knapp">Kein passendes Tier – Bestellung kommt auf die Warteliste.</span>';
    $('#tierinfo').innerHTML = ti;
    // Kunde
    const k = S.kunden.find(x => sameText(x.name, o.name));
    const lb = !o.nr && o.name ? letzteBestellungVon(o.name) : null;
    $('#kdinfo').innerHTML = !o.name ? '' : k ? `Kd-Nr. ${k.nr}${k.notiz ? ' – ' + esc(k.notiz) : ''}${lb ? ` · <a href="#" data-act="uebernehmen">letzte Bestellung (Nr. ${lb.nr}) übernehmen</a>` : ''}` : '<span class="ok">neuer Kunde – wird beim Speichern angelegt</span>';
    // Tüten & Summe
    $('#tuetenauto').textContent = `automatisch: ${tuetenAuto(S, o)} Tüten` + (vakArtikel(S, o).length ? ` (${vakArtikel(S, o).join(', ')})` : '');
    const ek = einzelKg(S, o);
    $('#summe').innerHTML = `Einzelartikel ca. <b>${fmtNum(ek, 2)} kg</b>${num(o.pakete) ? ` + ${fmtNum(o.pakete)} Genusspaket${num(o.pakete) > 1 ? 'e' : ''}` : ''} · Schätzpreis <b>${fmtEur(schaetzpreis(S, o))}</b>`;
  };
  ui.ins.kopf = el => {
    const f = el.dataset.f; let v = el.value;
    if (['pakete', 'pakVak'].includes(f)) v = num(v);
    if (f === 'tuetenManuell') v = el.value.trim() === '' ? null : num(v);
    o[f] = v; ui.formDirty = true;
    if (f === 'name') {
      const k = S.kunden.find(x => sameText(x.name, v));
      if (k) { if (!o.tel && k.tel) { o.tel = k.tel; $('[data-f=tel]').value = k.tel; } if (!o.mail && k.mail) { o.mail = k.mail; $('[data-f=mail]').value = k.mail; } }
    }
    aktualisieren();
  };
  ui.ins.pos = el => {
    const a = S.artikel[+el.closest('tr').dataset.i]; const f = el.dataset.f;
    const p = o.pos[a.name] = o.pos[a.name] || {};
    if (el.type === 'checkbox') p[f] = el.checked;
    else p[f] = el.value.trim() === '' ? null : num(el.value);
    if (!has(p.menge) && !has(p.anzahl) && !has(p.g) && !p.amStueck && !p.vak) delete o.pos[a.name];
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
  if (!a) return fmtNum(s.menge, 3);
  const eh = einheitForm(a);
  if (eh === 'kg') return fmtNum(s.menge * 1000, 0);
  if (eh === 'Btl') return fmtNum(s.menge * 1000 / a.beutelG, 1);
  return fmtNum(s.menge, 2);
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
    if (!has(p.menge) && !has(p.anzahl) && !p.amStueck && !p.vak) delete o.pos[k];
  }
  o.pakete = num(o.pakete); o.pakVak = num(o.pakVak);
  if (!o.eingang) o.eingang = todayISO();
  let auto = false;
  if (!o.tier) { o.tier = tierVorschlag(S, o.wunsch, o.pakete, o.nr); auto = true; }
  const neu = !o.nr;
  if (neu) { o.nr = nextNr(S); S.bestellungen.push(o); }
  else { const i = S.bestellungen.findIndex(x => x.nr === o.nr); S.bestellungen[i] = o; }
  const kundeNeu = kundePflegen(S, o.name, o.tel, o.mail);
  speichern();
  ui.formDirty = false; ui.letzteNr = o.nr;
  const check = mengencheck(S, o);
  const txt = `Bestellung Nr. ${o.nr} für ${o.name} ${neu ? 'gespeichert' : 'geändert'} – Tier: ${o.tier}${auto ? ' (automatisch)' : ''}${kundeNeu ? ' – neuer Kunde angelegt' : ''}`;
  if (check && check !== 'ok' && !check.startsWith('Warteliste')) {
    await dialog('Achtung – Mengencheck', `<p>${esc(txt)}</p><p class="warn">${esc(check)}</p><p>Die Bestellung ist gespeichert. Bitte prüfen, ob sie aufs nächste Tier umgestellt werden soll (Tier im Formular ändern).</p>`);
  } else meldung(txt + (check ? ' – Mengencheck: ' + check : ''));
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
    if (F.status) os = os.filter(o => (o.status || 'offen') === F.status);
    if (q) os = os.filter(o => String(o.nr) === q || (o.name || '').toLowerCase().includes(q) || (o.tel || '').includes(q));
    const checks = {}; [...new Set(os.map(o => o.tier))].forEach(t => Object.assign(checks, mengencheckTier(S, t)));
    $('#liste').innerHTML = !os.length ? '<div class="karte">Keine Bestellungen gefunden.</div>' :
      `<div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Eingang</th><th>Name</th><th>Tier</th><th class="r">Pakete</th><th>Bestellung</th><th class="r">Schätzpreis</th><th>Status</th><th>Mengencheck</th></tr></thead><tbody>` +
      os.map(o => {
        const ch = o.tier === 'Warteliste' ? 'Warteliste – noch kein Tier' : tier(S, o.tier) ? (checks[o.nr] || '') : 'Tier unbekannt';
        return `<tr class="klick ${ch.startsWith('reicht') ? 'rot' : ''}" data-act="oeffnen" data-nr="${o.nr}"><td class="r fett">${o.nr}</td><td>${fmtDate(o.eingang)}</td><td>${esc(o.name)}</td><td>${esc(o.tier)}</td><td class="r">${num(o.pakete) || ''}</td><td class="klein" style="max-width:380px">${esc(kurzText(o))}</td><td class="r">${fmtEur(schaetzpreis(S, o))}</td><td>${statusMarke(o.status)}${o.lagerOrt ? `<div class="klein">${esc(lagerText(o))}</div>` : ''}</td><td>${checkMarke(ch)}</td></tr>`;
      }).join('') + '</tbody></table></div>';
    $('#anzahl').textContent = `${os.length} Bestellung${os.length === 1 ? '' : 'en'}`;
  };
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">Bestellungen</h1><a class="btn haupt" href="#/neu">+ Neue Bestellung</a></div>
    <div class="suchzeile">
      <input class="feld" type="search" placeholder="Suchen: Name, Telefon oder Nr." data-in="q" value="${esc(F.q)}">
      <select class="feld" data-ch="ft" style="max-width:260px">${opt('', 'alle Tiere', !F.tier)}${tiereSortiert().map(t => opt(t.name, t.name, F.tier === t.name)).join('')}${opt('Warteliste', 'Warteliste', F.tier === 'Warteliste')}</select>
      <select class="feld" data-ch="fs" style="max-width:170px">${opt('', 'jeder Status', !F.status)}${['offen', 'gepackt', 'abgeholt'].map(s => opt(s, s, F.status === s)).join('')}</select>
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
    const ks = S.kunden.filter(k => !q || k.name.toLowerCase().includes(q) || (k.tel || '').includes(q) || (k.ort || '').toLowerCase().includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    $('#liste').innerHTML = !ks.length ? '<div class="karte">Keine Kunden gefunden. Neue Kunden entstehen automatisch beim Speichern einer Bestellung.</div>' :
      `<div class="tabwrap"><table class="tab"><thead><tr><th class="r">Kd-Nr.</th><th>Name</th><th>Telefon</th><th>Ort</th><th class="r">Bestellungen</th><th>letzte</th><th class="r">Pakete</th><th class="r">Summe Endbeträge</th></tr></thead><tbody>` +
      ks.map(k => { const s = kundenStat(S, k); return `<tr class="klick" data-act="oeffnen" data-nr="${k.nr}"><td class="r">${k.nr}</td><td class="fett">${esc(k.name)}</td><td>${esc(k.tel)}</td><td>${esc(k.ort)}</td><td class="r">${s.anzahl}</td><td>${fmtDate(s.letzte)}</td><td class="r">${s.pakete || ''}</td><td class="r">${s.umsatz ? fmtEur(s.umsatz) : ''}</td></tr>`; }).join('') + '</tbody></table></div>';
  };
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">Kunden</h1><a class="btn" href="#/kunde/neu">+ Kunde anlegen</a></div>
    <div class="suchzeile"><input class="feld" type="search" placeholder="Suchen: Name, Telefon, Ort" data-in="q" value="${esc(ui.kfilter)}"></div><div id="liste"></div>`;
  ui.ins.q = el => { ui.kfilter = el.value; liste(); };
  ui.acts.oeffnen = el => gehe('#/kunde/' + el.dataset.nr);
  liste();
}
function viewKunde(id) {
  const neu = id === 'neu';
  const k0 = neu ? { nr: null, name: '', tel: '', mail: '', strasse: '', ort: '', notiz: '' } : S.kunden.find(k => k.nr === +id);
  if (!k0) { inhalt().innerHTML = '<div class="fehlerbox">Kunde nicht gefunden.</div>'; return; }
  const k = { ...k0 };
  titel(neu ? 'Neuer Kunde' : k.name);
  const os = neu ? [] : S.bestellungen.filter(o => sameText(o.name, k.name)).sort((a, b) => b.nr - a.nr);
  const st = neu ? null : kundenStat(S, k);
  const fld = (f, t, typ = 'text') => `<label class="f">${t}<input class="feld" type="${typ}" data-in="k" data-f="${f}" value="${esc(k[f] || '')}"></label>`;
  inhalt().innerHTML = `<h1>${neu ? 'Neuer Kunde' : `Kd-Nr. ${k.nr}: ${esc(k.name)}`}</h1>
    <div class="spalten2"><div class="karte"><div class="formraster">
      <div class="ganz">${fld('name', 'Name (genau so wie in den Bestellungen)')}</div>${fld('tel', 'Telefon', 'tel')}${fld('mail', 'Mail', 'email')}${fld('strasse', 'Straße')}${fld('ort', 'PLZ / Ort')}
      <label class="f ganz">Notiz (Vorlieben, Hinweise)<textarea class="feld" data-in="k" data-f="notiz">${esc(k.notiz || '')}</textarea></label></div>
      <div class="knopfleiste" style="margin-top:14px"><button class="btn haupt" data-act="speichern">Speichern</button>${neu ? '' : `<a class="btn" href="#/neu?kunde=${k.nr}">+ Neue Bestellung</a>`}${!neu && !os.length ? '<button class="btn rot" data-act="loeschen">Löschen</button>' : ''}</div></div>
    <div>${neu ? '' : `<div class="karte"><b>${st.anzahl}</b> Bestellungen · <b>${st.pakete}</b> Genusspakete · Summe Endbeträge <b>${fmtEur(st.umsatz)}</b></div>
      <div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Eingang</th><th>Tier</th><th>Bestellung</th><th>Status</th></tr></thead><tbody>${os.map(o => `<tr class="klick" data-act="best" data-nr="${o.nr}"><td class="r">${o.nr}</td><td>${fmtDate(o.eingang)}</td><td>${esc(o.tier)}</td><td class="klein">${esc(kurzText(o))}</td><td>${statusMarke(o.status)}</td></tr>`).join('') || '<tr><td colspan="5" class="klein">noch keine Bestellungen</td></tr>'}</tbody></table></div>`}</div></div>`;
  ui.ins.k = el => { k[el.dataset.f] = el.value; };
  ui.acts.best = el => gehe('#/bestellung/' + el.dataset.nr);
  ui.acts.speichern = async () => {
    k.name = k.name.trim();
    if (!k.name) return meldung('Bitte einen Namen eintragen.', true);
    const doppelt = S.kunden.find(x => sameText(x.name, k.name) && x.nr !== k.nr);
    if (doppelt) return meldung(`Den Namen „${k.name}“ gibt es schon (Kd-Nr. ${doppelt.nr}). Bei gleichen Namen z. B. den Ort ergänzen.`, true);
    if (neu) { k.nr = S.kunden.reduce((m, x) => Math.max(m, x.nr), 0) + 1; S.kunden.push(k); }
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
}

// =====================================================================
//  Tiere
// =====================================================================
function viewTiere() {
  titel('Tiere');
  inhalt().innerHTML = `<div class="zeile" style="margin-bottom:10px"><h1 class="platz" style="margin:0">Tiere</h1><a class="btn haupt" href="#/tier/neu">+ Neues Tier</a></div>
    ${S.tiere.length ? '' : '<div class="karte">Noch keine Tiere angelegt.</div>'}
    <div class="tabwrap"><table class="tab"><thead><tr><th>Tier</th><th>Typ</th><th>Ohrmarke / Notiz</th><th>Schlachtung</th><th>Abholung</th><th class="r">SG (kg)</th><th class="r">Paket ca.</th><th class="r">Pakete bestellt / frei</th><th class="r">Bestellungen</th><th>Mengen</th></tr></thead><tbody>
    ${tiereSortiert().map(t => { const i = tierInfo(S, t); return `<tr class="klick ${i.reichtNicht ? 'rot' : ''}" data-act="oeffnen" data-t="${esc(t.name)}"><td class="fett">${esc(t.name)}</td><td>${esc(t.typ)}</td><td>${esc(t.notiz)}</td><td>${fmtDate(t.schlacht)}</td><td>${fmtDate(t.abhol) || 'offen'}</td><td class="r">${fmtNum(i.sg)}${num(t.sg) ? '' : ' <span class="klein">(Std.)</span>'}</td><td class="r">${fmtNum(i.paketKg, 1)} kg</td><td class="r">${fmtNum(i.pakete)} / <b class="${i.frei < 0 ? 'warn' : ''}">${fmtNum(i.frei)}</b></td><td class="r">${i.anzahl}</td><td>${i.reichtNicht ? `<span class="marke rot">${i.reichtNicht} reicht nicht</span>` : i.anzahl ? '<span class="marke gruen">ok</span>' : ''}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  ui.acts.oeffnen = el => gehe('#/tier/' + encodeURIComponent(el.dataset.t));
}
function viewTier(name) {
  const neu = name === 'neu';
  const t0 = neu ? null : tier(S, name);
  if (!neu && !t0) { inhalt().innerHTML = '<div class="fehlerbox">Tier nicht gefunden.</div>'; return; }
  const t = t0 ? { ...t0 } : { name: '', notiz: '', typ: 'Rind', sg: null, schlacht: '', abhol: '' };
  titel(neu ? 'Neues Tier' : 'Tier ' + t.name);
  const info = () => {
    if (neu) return 'Neues Tier – Name eintragen und speichern.';
    const i = tierInfo(S, t0);
    return `Rechnung mit <b>${fmtNum(i.sg)} kg</b> Schlachtgewicht · Paket ca. <b>${fmtNum(i.paketKg, 1)} kg</b><br>Pakete bestellt: <b>${fmtNum(i.pakete)}</b> · noch frei: <b class="${i.frei < 0 ? 'warn' : ''}">${fmtNum(i.frei)}</b><br>Bestellungen: <b>${i.anzahl}</b> · davon reicht nicht: <b class="${i.reichtNicht ? 'warn' : ''}">${i.reichtNicht}</b>`;
  };
  inhalt().innerHTML = `<h1>${neu ? 'Neues Tier' : 'Tier ' + esc(t.name)}</h1>
   <div class="spalten2"><div class="karte"><div class="formraster">
    <label class="f ganz">Name / Nr.<input class="feld" data-in="t" data-f="name" value="${esc(t.name)}"></label>
    <label class="f ganz">Ohrmarke / Notiz<input class="feld" data-in="t" data-f="notiz" value="${esc(t.notiz || '')}"></label>
    <label class="f">Typ<select class="feld" data-in="t" data-f="typ">${['Rind', 'Bulle'].map(x => opt(x, x, t.typ === x)).join('')}</select></label>
    <label class="f">Schlachtgewicht (kg, leer = Standard ${fmtNum(t.typ === 'Bulle' ? S.settings.sgBulle : S.settings.sgRind)})<input class="feld zahl" inputmode="decimal" data-in="t" data-f="sg" value="${has(t.sg) ? fmtNum(t.sg, 1) : ''}"></label>
    <label class="f">Schlachttermin<input class="feld" type="date" data-in="t" data-f="schlacht" value="${esc(t.schlacht || '')}"></label>
    <label class="f">Abholtermin<input class="feld" type="date" data-in="t" data-f="abhol" value="${esc(t.abhol || '')}"></label>
   </div><div class="hinweis" style="margin-top:14px;margin-bottom:0">${info()}</div>
   <div class="knopfleiste" style="margin-top:14px"><button class="btn haupt" data-act="speichern">Speichern</button>${neu ? '' : `<a class="btn" href="#/schlachttag/menge?tier=${encodeURIComponent(t.name)}">Mengenprüfung</a><a class="btn" href="#/neu?tier=${encodeURIComponent(t.name)}">+ Bestellung für dieses Tier</a><button class="btn rot" data-act="loeschen">Löschen</button>`}</div></div>
   <div>${neu ? '' : tierBestellListe(t.name)}</div></div>`;
  ui.ins.t = el => { const f = el.dataset.f; t[f] = f === 'sg' ? (el.value.trim() ? num(el.value) : null) : el.value; };
  ui.acts.best = el => gehe('#/bestellung/' + el.dataset.nr);
  ui.acts.speichern = async () => {
    t.name = String(t.name || '').trim();
    if (!t.name) return meldung('Bitte einen Namen für das Tier eintragen.', true);
    if (t.name === 'Warteliste') return meldung('„Warteliste“ ist als Name reserviert.', true);
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
    const wl = wartelistePassend(S, tt);
    if (wl.length && await frage('Warteliste', `${wl.length} Bestellung(en) auf der Warteliste passen zu <b>${esc(tt.name)}</b> (Abholung ${fmtDate(tt.abhol)}). Jetzt diesem Tier zuordnen?`, 'Zuordnen', 'Nein')) {
      wl.forEach(o => { o.tier = tt.name; }); speichern();
      meldung(`${wl.length} Bestellung(en) zugeordnet. Bitte die Mengenprüfung für ${tt.name} ansehen.`);
    } else meldung('Tier gespeichert.');
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
function tierBestellListe(name) {
  const os = ordersOfTier(S, name); const ch = mengencheckTier(S, name);
  return `<div class="tabwrap"><table class="tab"><thead><tr><th class="r">Nr.</th><th>Name</th><th class="r">Pakete</th><th>Bestellung</th><th>Mengencheck</th></tr></thead><tbody>${os.map(o => `<tr class="klick ${(ch[o.nr] || '').startsWith('reicht') ? 'rot' : ''}" data-act="best" data-nr="${o.nr}"><td class="r">${o.nr}</td><td>${esc(o.name)}</td><td class="r">${num(o.pakete) || ''}</td><td class="klein">${esc(kurzText(o))}</td><td>${checkMarke(ch[o.nr])}</td></tr>`).join('') || '<tr><td colspan="5" class="klein">noch keine Bestellungen</td></tr>'}</tbody></table></div>`;
}

// =====================================================================
//  Bestellung teilen
// =====================================================================
async function teilenDialog(nr) {
  const o = S.bestellungen.find(x => x.nr === nr);
  const zeilen = teilZeilen(S, o);
  if (!zeilen.length) return meldung('Die Bestellung enthält nichts zum Verschieben.', true);
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
    ${zeilen.map(r => `<tr data-row="${esc(r.key)}"><td>${esc(r.text)}</td><td class="r">${fmtNum(r.bestellt, 3)}</td><td style="width:110px"><input class="feld zahl tz" inputmode="decimal" data-key="${esc(r.key)}" value="${fmtNum(start[r.key] || 0, 3)}"></td><td class="klein">${esc(r.einheit)}</td><td class="r tzb"></td></tr>`).join('')}
    </tbody></table><p class="klein">Stück, Beutel, Portionen und Pakete werden auf ganze Zahlen gerundet, kg auf 0,1 kg. Sonderwünsche bleiben bei der ursprünglichen Bestellung.</p>`;
  const d = $('#dialog');
  let werte = null, ziel = zielStd;
  const bleibt = () => $$('#dialog tbody tr').forEach(tr => {
    const r = zeilen.find(x => x.key === tr.dataset.row); const inp = $('input', tr);
    $('.tzb', tr).textContent = fmtNum(r.bestellt - Math.min(r.bestellt, num(inp.value)), 3);
  });
  const presets = e => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    e.stopPropagation(); e.preventDefault();
    const v = teilVorschlag(S, o, b.dataset.p === 'fehl' ? 'fehl' : num(b.dataset.p));
    $$('#dialog input.tz').forEach(i => { i.value = fmtNum(v[i.dataset.key] || 0, 3); }); bleibt();
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
