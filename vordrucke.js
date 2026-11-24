// Vordrucke: Bestellformular A4, Bestellformular A5 (2 je A4-Blatt) und Infozettel „So läuft's ab“.
// Preise, Genusspaket-Angaben, Beutelgrößen und „am Stück“ kommen aus den Einstellungen.
'use strict';

const VD_TEXTE = [
  ['vdName', 'Name(n)', 'Bernd & Claudia Huber'],
  ['vdAdresse', 'Adresse', 'Bergwiesenweg 10 · 72658 Bempflingen'],
  ['vdTel', 'Telefon', '07123 / 31543'],
  ['vdMail', 'E-Mail', 'huber-bempflingen@t-online.de'],
  ['vdAbholung', 'Abholung Fleisch (lang)', 'Freitag 9.00–11.30 und 15.00–18.00 Uhr · Samstag 9.00–11.30 Uhr'],
  ['vdAbholungKurz', 'Abholung Fleisch (kurz, A5)', 'Fr 9.00–11.30 + 15.00–18.00, Sa 9.00–11.30 Uhr'],
  ['vdHoflaedle', 'Zeile Hoflädle (A4)', 'Wurst, Gemüse und viele regionale Produkte jederzeit im Hoflädle'],
  ['vdHofladen', 'Hofladen-Zeiten (Infozettel)', 'Hofladen: Mittwoch 15.30–18.00 · Freitag 9.00–11.30 und 15.00–18.00 · Samstag 9.00–11.30 Uhr · Marktstand Neuffen: Samstag 8.00–12.00 Uhr'],
  ['vdMotto', 'Leitsatz (Infozettel)', 'Extensiv aus Überzeugung'],
  ['kistePfand', 'Pfand je Kiste (€)', 10]
];
// Preisliste für die Vordrucke: wählbar (aktuelle oder kommende), Standard = heute gültige
let vdAb = null;
const vdPl = () => { const l = preislisten(S); return l.find(p => p.ab === vdAb) || preislisteAm(S, todayISO()); };
const vdT = f => { if (f === 'preiseAb') { const p = vdPl(); return p ? fmtDate(p.ab) : (S.settings.preiseAb || ''); } const st = S.settings; const d = VD_TEXTE.find(x => x[0] === f); return has(st[f]) && st[f] !== '' ? st[f] : (d ? d[2] : ''); };
const vdEur = x => fmtNum(num(x), 2, 2) + ' €';
const vdUnd = l => l.length < 2 ? l.join('') : l.slice(0, -1).join(', ') + ' und ' + l[l.length - 1];

function vdArtikel() {
  const pl = vdPl();
  return S.artikel.filter(a => artPreis(S, a, pl) > 0).map(a => {
    const btl = num(a.beutelG) > 0;
    let hint = '';
    if (btl) hint = `Beutel à ${num(a.beutelG)} g`;
    else if (a.amStueck && a.name === 'Beinscheiben') hint = 'am Stück = ganze Wade';
    else if (a.amStueck && a.name === OCHS) hint = 'am Stück = ganz';
    return { name: a.name, preis: vdEur(artPreis(S, a, pl)), einheit: btl ? 'Btl' : a.einheit === 'Stk' ? 'Stk' : 'kg', hint, amStueck: !!a.amStueck };
  });
}
function vdPaket() {
  const st = S.settings;
  const pl = vdPl();
  return { preis: vdEur(paketPreisKg(S, pl)), anteil: `1/${num(st.nenner) || 16} eines Tieres`, kg: `ca. ${fmtNum(st.paketVon)}–${fmtNum(st.paketBis)} kg`, vak: vdEur(vakPreisPaket(S, pl)).replace(',00', ''), };
}
const VD_BOX = '<span class="vd-box"></span>';
const VD_LOGO = '<img class="vd-logo" src="logo.svg" alt="">';

// ---------- Bestellformular A4 ----------
function vdBestellA4() {
  const arts = vdArtikel(), p = vdPaket();
  const rowH = Math.min(7.4, 132 / Math.max(1, arts.length));
  return `<div class="vd vd-a4">
  <div class="vd-kopf">${VD_LOGO}<div class="vd-kopf-r"><div class="vd-titel">Bestellformular</div><div class="vd-gruen">Fleisch vom Limousin-Rind</div><div class="vd-k">Verbindliche Bestellung</div><div class="vd-k">Preise gültig ab ${esc(vdT('preiseAb'))}</div></div></div>
  <div class="vd-felder">${['Name', 'Telefon', 'E-Mail'].map(t => `<div class="vd-feld"><b>${t}</b><span class="vd-linie"></span></div>`).join('')}
   <div class="vd-feld"><b>Wunschtermin</b><span class="vd-linie"><i>leer lassen = nächster freier Termin</i></span></div></div>
  <div class="vd-paket"><div class="vd-empf">★ Unsere Empfehlung · Mischpaket</div>
   <div class="vd-pz"><span class="vd-pname">Limousin-Genussfleischpaket</span><span class="vd-anz"><b>Anzahl Pakete:</b>${VD_BOX}</span></div>
   <div class="vd-pz"><span><b class="vd-ppreis">${p.preis} / kg</b> <b>· ${esc(p.anteil)} · ${esc(p.kg)}</b></span></div>
   <div class="vd-pz"><span class="vd-inhalt">Steak · Rostbraten · Rouladen · Bratenstücke/Gulasch · Hackfleisch · Siedfleisch · Beinscheibe · Suppenknochen (SK) · Soßenknochen (FK)</span><span class="vd-anz"><b>vakuumieren (${p.vak} / Paket)</b>${VD_BOX.replace('vd-box', 'vd-box klein')}</span></div></div>
  <div class="vd-zw"><b>Einzelne Stücke</b><span>Einzelstücke werden vakuumiert · „nicht vakuumieren“ nur ankreuzen, wenn nicht gewünscht</span></div>
  <table class="vd-tab" style="--rh:${rowH}mm"><colgroup><col style="width:28%"><col style="width:15%"><col style="width:13%"><col style="width:22%"><col style="width:9%"><col style="width:13%"></colgroup>
   <thead><tr><th>Artikel</th><th class="r">Preis</th><th class="c">Menge</th><th>Wunsch / Portionen<br>(z. B. 6 × 500 g)</th><th class="c">am<br>Stück</th><th class="c">nicht<br>vakuumieren</th></tr></thead><tbody>
   ${arts.map(a => `<tr><td class="vd-art">${esc(a.name)}</td><td class="r">${a.preis} / kg</td><td class="vd-menge"><span class="vd-mbox"></span><span class="vd-einh">${a.einheit}</span></td><td class="vd-hint">${esc(a.hint)}</td><td class="c">${a.amStueck ? VD_BOX.replace('vd-box', 'vd-box klein') : ''}</td><td class="c">${VD_BOX.replace('vd-box', 'vd-box klein')}</td></tr>`).join('')}
  </tbody></table>
  <div class="vd-feld vd-bem"><b>Bemerkung</b><span class="vd-linie"></span></div>
  <div class="vd-fuss"><div><div class="vd-danke">Vielen Dank für Ihre Bestellung!</div>${esc(vdT('vdName'))} · ${esc(vdT('vdAdresse'))}<br>Tel. ${esc(vdT('vdTel'))} · ${esc(vdT('vdMail'))}<br>Abholung: ${esc(vdT('vdAbholung'))}<br>${esc(vdT('vdHoflaedle'))}</div><div class="vd-mwst">inkl. 7 % MwSt.</div></div>
  </div>`;
}

// ---------- Bestellformular A5 (eine Hälfte) ----------
function vdBestellA5() {
  const arts = vdArtikel(), p = vdPaket();
  const n1 = Math.ceil(arts.length / 2), sp = [arts.slice(0, n1), arts.slice(n1)];
  const rowH = Math.min(8, 72 / Math.max(1, n1));
  const tab = l => `<table class="vd-tab a5" style="--rh:${rowH}mm"><colgroup><col style="width:33%"><col style="width:17%"><col style="width:17%"><col style="width:13%"><col style="width:10%"><col style="width:10%"></colgroup>
    <thead><tr><th>Artikel</th><th class="r">Preis/kg</th><th class="c">Menge</th><th>Wunsch</th><th class="c">am<br>Stück</th><th class="c">nicht<br>vak.</th></tr></thead><tbody>
    ${l.map(a => `<tr><td class="vd-art">${esc(a.name)}</td><td class="r">${a.preis}</td><td class="vd-menge"><span class="vd-mbox"></span><span class="vd-einh">${a.einheit}</span></td><td class="vd-hint">${esc(a.hint.replace('Beutel à', 'Btl à').replace('am Stück = ', ''))}</td><td class="c">${a.amStueck ? VD_BOX.replace('vd-box', 'vd-box klein') : ''}</td><td class="c">${VD_BOX.replace('vd-box', 'vd-box klein')}</td></tr>`).join('')}
    ${Array(n1 - l.length).fill('<tr><td colspan="6"></td></tr>').join('')}</tbody></table>`;
  return `<div class="vd vd-a5">
  <div class="vd-kopf">${VD_LOGO}<div class="vd-kopf-r"><div class="vd-titel">Bestellformular – Fleisch vom Limousin-Rind</div><div class="vd-k">Verbindliche Bestellung · Preise gültig ab ${esc(vdT('preiseAb'))} · alle Preise inkl. 7 % MwSt.</div></div></div>
  <div class="vd-felder zwei"><div class="vd-feld"><b>Name</b><span class="vd-linie"></span></div><div class="vd-feld"><b>Telefon</b><span class="vd-linie"></span></div>
   <div class="vd-feld"><b>E-Mail</b><span class="vd-linie"></span></div><div class="vd-feld"><b>Wunschtermin</b><span class="vd-linie"><i>leer = nächster Termin</i></span></div></div>
  <div class="vd-paket"><div class="vd-pz"><span class="vd-pname">★ Genussfleischpaket</span><b>${p.preis} / kg · ${esc(p.anteil)} · ${esc(p.kg)}</b><span class="vd-anz"><b>Anzahl Pakete:</b>${VD_BOX}</span></div>
   <div class="vd-pz"><span class="vd-inhalt">Steak · Rostbraten · Rouladen · Braten/Gulasch · Hack · Siedfleisch · Beinscheibe · Suppen- u. Soßenknochen</span><span class="vd-anz"><b>vakuumieren (${p.vak} je Paket)</b>${VD_BOX.replace('vd-box', 'vd-box klein')}</span></div></div>
  <div class="vd-zwei">${tab(sp[0])}${tab(sp[1])}</div>
  <div class="vd-unten"><div class="vd-feld vd-bem"><b>Bemerkung</b><span class="vd-linie"></span></div><div class="vd-hof">Einzelstücke werden vakuumiert – „nicht vak.“ ankreuzen, wenn nicht gewünscht</div></div>
  <div class="vd-fuss1">Bergwiesenhof · ${esc(vdT('vdName'))} · ${esc(vdT('vdAdresse'))} · Tel. ${esc(vdT('vdTel'))} · Abholung ${esc(vdT('vdAbholungKurz'))}</div>
  </div>`;
}
function vdBlattA5() { const h = vdBestellA5(); return `<div class="vd-blatt-a5">${h}<div class="vd-schnitt">✂</div>${h}</div>`; }

// ---------- Infozettel ----------
function vdInfo() {
  const p = vdPaket();
  const sk = S.artikel.find(a => a.name === SK), fk = S.artikel.find(a => a.name === FK);
  const nm = { 'Gulasch geschnitten': 'Gulasch', Beinscheiben: 'Beinscheiben (als ganze Wade)', Ochsenschwanz: 'Ochsenschwanz (ganz)' };
  const amSt = S.artikel.filter(a => a.amStueck && artPreis(S, a, vdPl()) > 0).map(a => nm[a.name] || a.name);
  const pk = ['Steak', 'Rostbraten', 'Rouladen', 'Braten / Gulasch', 'Hackfleisch', 'Sied-/Suppenfleisch', 'Beinscheibe', 'Suppenknochen (SK)', 'Soßenknochen (FK)'];
  const abs = (n, t, inner) => `<div class="vd-abs"><div class="vd-balken">${n} · ${t}</div>${inner}</div>`;
  return `<div class="vd vd-a4 vd-info">
  <div class="vd-kopf">${VD_LOGO}<div class="vd-kopf-r"><div class="vd-titel">So läuft’s ab</div><div class="vd-gruen">Limousin-Genussfleischpaket &amp; Einzelstücke</div><div class="vd-k"><i>${esc(vdT('vdMotto'))}</i></div></div></div>
  ${abs(1, 'Bestellen', '<p>Wir nehmen Ihre Vorbestellung gerne persönlich, telefonisch, per E-Mail oder mit unserem Bestellzettel entgegen. Haben Sie einen Wunschtermin, tragen Sie ihn einfach ein – ohne Wunschtermin planen wir Sie beim nächsten Tier ein.</p>')}
  ${abs(2, 'Schlachtung &amp; Abholtermin', '<p>Ist ein Tier komplett verteilt, wird es stressfrei geschlachtet und reift anschließend einige Tage im Kühlhaus. Danach teilen wir Ihnen Ihren Abholtermin mit.</p>')}
  <div class="vd-paket gross"><div class="vd-empf">★ Unsere Empfehlung · Mischpaket</div><div class="vd-pname">Limousin-Genussfleischpaket</div>
   <div class="vd-pzeile">${esc(p.anteil)} · ${esc(p.kg)} · ${p.preis} / kg</div>
   <div class="vd-pinhalt"><div><div class="vd-k">Das Paket enthält:</div><ul>${pk.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><img src="genusspaket.webp" alt=""></div></div>
  ${abs(3, 'Verpackung', `<p>Das Fleisch ist haushaltsgerecht portioniert und liegt sortiert in einer roten Metzgerkiste. Hackfleisch, Rostbraten, Steak und Rouladen werden separat in Tüten verpackt, Suppenknochen (SK) in Beuteln à ${sk ? num(sk.beutelG) : 800} g und Soßenknochen (FK) in Beuteln à ${fk ? num(fk.beutelG) : 1000} g. Die übrigen Stücke können Sie selbst nach Ihrem Bedarf portionieren und einfrieren.</p><p>Einzelne Stücke vakuumieren wir grundsätzlich – wenn Sie das nicht möchten, kreuzen Sie auf dem Bestellzettel „nicht vakuumieren“ an. Das Genusspaket vakuumieren wir auf Wunsch komplett für pauschal ${p.vak}.</p>`)}
  ${abs(4, 'Einzelne Stücke', `<p>Neben dem Paket können Sie auch einzelne Stücke bestellen – die aktuellen Preise finden Sie auf dem Bestellzettel. Wünsche wie „6 × 500 g Hackfleisch“ berücksichtigen wir gerne${amSt.length ? `; ${esc(vdUnd(amSt))} gibt es auf Wunsch auch am Stück` : ''}.</p>`)}
  <div class="vd-kontakt"><div class="vd-kt">Abholung &amp; Kontakt</div>${esc(vdT('vdName'))} · ${esc(vdT('vdAdresse'))}<br>Tel. ${esc(vdT('vdTel'))} · ${esc(vdT('vdMail'))}<br><b>Abholung Fleisch: ${esc(vdT('vdAbholung'))}</b><br>Bringen Sie gerne eigene Behältnisse mit – oder Sie leihen sich eine Kiste gegen ${fmtNum(num(vdT('kistePfand')))} € Pfand.</div>
  <div class="vd-schluss">Wir zeigen Ihnen auch gerne unsere Tiere und den Mutterkuhstall.</div>
  <div class="vd-k c">${esc(vdT('vdHofladen'))}</div>
  </div>`;
}

const VD_LISTE = [
  ['a4', 'Bestellformular A4', 'ein Formular je A4-Blatt', vdBestellA4],
  ['a5', 'Bestellformular A5', 'zwei Formulare je A4-Blatt (in der Mitte schneiden)', vdBlattA5],
  ['info', 'Infozettel „So läuft’s ab“', 'A4', vdInfo]
];
function vdDrucken(k) {
  const v = VD_LISTE.find(x => x[0] === k); if (!v) return;
  const st = document.getElementById('druckfuss'); if (st) st.textContent = ''; // keine Fußzeile der Unterlagen
  document.getElementById('druck').innerHTML = `<section class="druckseite vordruck">${v[3]()}</section>`;
  const imgs = [...document.querySelectorAll('#druck img')];
  Promise.all(imgs.map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; }))).then(() => setTimeout(() => window.print(), 80));
}

// ---------- Seite ----------
function viewVordrucke() {
  titel('Vordrucke');
  const pl = vdPl(), heute = todayISO(), liste = preislisten(S).filter(p => p === preislisteAm(S, heute) || p.ab > heute);
  const ohne = S.artikel.filter(a => !(artPreis(S, a, pl) > 0)).map(a => a.name);
  inhalt().innerHTML = `<h1>Vordrucke</h1>
   ${liste.length > 1 ? `<div class="karte zeile" style="gap:8px;flex-wrap:wrap"><b>Preise auf den Vordrucken:</b>${liste.map(p => `<button class="btn ${p === pl ? 'haupt' : ''}" data-act="vdpl" data-ab="${p.ab}">ab ${fmtDate(p.ab)}${p === preislisteAm(S, heute) ? ' (gilt jetzt)' : ' (kommt)'}</button>`).join('')}</div>` : ''}
   <p class="klein">Preise, Genusspaket (Preis, kg, Vakuumieren je Paket), Beutelgrößen und „am Stück“ kommen automatisch aus Einstellungen → Preisliste. Artikel ohne Preis stehen nicht auf dem Formular${ohne.length ? ` (zurzeit: ${esc(ohne.join(', '))})` : ''}. Beim Drucken unter „Weitere Einstellungen“ Papier A4 und „Hintergrundgrafiken“ einschalten; Anzahl Kopien im Druckdialog wählen.</p>
   <div class="vd-raster">${VD_LISTE.map(([k, t, u, f]) => `<div class="karte"><div class="zeile"><div class="platz"><b>${t}</b><div class="klein">${u}</div></div><button class="btn haupt" data-act="vddruck" data-k="${k}">Drucken</button></div>
     <div class="vd-vorschau" data-act="vddruck" data-k="${k}"><div class="vd-skal">${f()}</div></div></div>`).join('')}</div>
   <div class="karte"><h3 style="margin-top:0">Texte auf den Vordrucken</h3><div class="vd-formular">
   ${VD_TEXTE.map(([f, t]) => `<label class="f">${t}<input class="feld${f === 'kistePfand' ? ' zahl' : ''}" ${f === 'kistePfand' ? 'inputmode="decimal"' : ''} data-ch="vdtext" data-f="${f}" value="${esc(f === 'kistePfand' ? fmtIn(num(vdT(f)), 2) : vdT(f))}"></label>`).join('')}</div></div>`;
  ui.acts.vddruck = el => vdDrucken(el.dataset.k);
  ui.acts.vdpl = el => { vdAb = el.dataset.ab; render(); };
  ui.acts.vdtext = el => { S.settings[el.dataset.f] = el.dataset.f === 'kistePfand' ? num(el.value) : el.value.trim(); speichern(); meldung('Gespeichert.'); render(); };
}
