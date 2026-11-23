// Unterlagen (Metzgerauftrag, Packplan, Listen …): ein Dokument-Modell,
// daraus HTML (Anzeige/Druck) und ein PNG-Bild zum Teilen (WhatsApp).
// doc = {title, sub:[..], blocks:[{type:'h'|'text'|'kv'|'table', ...}], footer}
'use strict';

const esc = s => String(s === null || s === undefined ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function docHtml(doc) {
  let h = `<div class="doc"><div class="doc-kopf"><div class="doc-titel">${esc(doc.title)}</div>`;
  (doc.sub || []).forEach(s => { h += `<div class="doc-sub">${esc(s)}</div>`; });
  h += '</div>';
  for (const b of doc.blocks) {
    if (b.type === 'h') h += `<div class="doc-h">${esc(b.text)}</div>`;
    else if (b.type === 'text') h += `<div class="doc-text${b.bold ? ' fett' : ''}${b.warn ? ' warn' : ''}">${esc(b.text).replace(/\n/g, '<br>')}</div>`;
    else if (b.type === 'kv') h += '<table class="doc-kv">' + b.rows.map(r => `<tr><td>${esc(r[0])}</td><td class="fett">${esc(r[1])}</td><td>${esc(r[2] || '')}</td></tr>`).join('') + '</table>';
    else if (b.type === 'table') {
      h += '<table class="doc-tab"><thead><tr>' + b.head.map((c, i) => `<th class="${(b.align || [])[i] === 'r' ? 'r' : ''}">${esc(c)}</th>`).join('') + '</tr></thead><tbody>';
      if (!b.rows.length) h += `<tr><td colspan="${b.head.length}" class="leer">${esc(b.leer || '– keine –')}</td></tr>`;
      b.rows.forEach((r, ri) => { h += `<tr class="${(b.rowClass || [])[ri] || ''}">` + r.map((c, i) => `<td class="${(b.align || [])[i] === 'r' ? 'r' : ''}">${esc(c).replace(/\n/g, '<br>')}</td>`).join('') + '</tr>'; });
      h += '</tbody></table>';
    }
  }
  if (doc.footer) h += `<div class="doc-fuss">${esc(doc.footer)}</div>`;
  return h + '</div>';
}

// ---------- Bild ----------
function docCanvas(doc, breite = 1080) {
  const PAD = 36, F = 'Roboto, "Segoe UI", Arial, sans-serif';
  const c = document.createElement('canvas');
  const x = c.getContext('2d');
  const W = breite - 2 * PAD;
  const fonts = { titel: `bold 40px ${F}`, sub: `26px ${F}`, h: `bold 30px ${F}`, text: `26px ${F}`, textB: `bold 26px ${F}`, th: `bold 23px ${F}`, td: `24px ${F}`, fuss: `20px ${F}` };
  const wrap = (txt, font, w) => {
    x.font = font; const out = [];
    for (const para of String(txt === null || txt === undefined ? '' : txt).split('\n')) {
      const words = para.split(' '); let line = '';
      for (const wd of words) {
        const t = line ? line + ' ' + wd : wd;
        if (x.measureText(t).width <= w || !line) {
          if (x.measureText(t).width > w && !line) { // überlanges Wort hart umbrechen
            let part = ''; for (const ch of t) { if (x.measureText(part + ch).width > w) { out.push(part); part = ch; } else part += ch; } line = part;
          } else line = t;
        } else { out.push(line); line = wd; }
      }
      out.push(line);
    }
    return out;
  };
  // Layout zuerst berechnen (zwei Durchläufe: messen, zeichnen)
  const ops = []; let y = PAD;
  const push = (font, txt, xx, yy, color, align) => ops.push({ font, txt, x: xx, y: yy, color, align });
  wrap(doc.title, fonts.titel, W).forEach(l => { push(fonts.titel, l, PAD, y + 40, '#3d2a10'); y += 50; });
  (doc.sub || []).forEach(s => wrap(s, fonts.sub, W).forEach(l => { push(fonts.sub, l, PAD, y + 28, '#444'); y += 34; }));
  ops.push({ line: true, y: y + 10, color: '#86bd40', w: 4 }); y += 26;
  for (const b of doc.blocks) {
    if (b.type === 'h') { y += 14; wrap(b.text, fonts.h, W).forEach(l => { push(fonts.h, l, PAD, y + 30, '#683c11'); y += 38; }); y += 4; }
    else if (b.type === 'text') { wrap(b.text, b.bold ? fonts.textB : fonts.text, W).forEach(l => { push(b.bold ? fonts.textB : fonts.text, l, PAD, y + 28, b.warn ? '#b00020' : '#222'); y += 34; }); y += 6; }
    else if (b.type === 'kv') {
      for (const r of b.rows) {
        const k = wrap(r[0], fonts.text, W * 0.38), v = wrap(r[1], fonts.textB, W * 0.27), z = wrap(r[2] || '', fonts.text, W * 0.33);
        const n = Math.max(k.length, v.length, z.length);
        k.forEach((l, i) => push(fonts.text, l, PAD, y + 28 + i * 34, '#333'));
        v.forEach((l, i) => push(fonts.textB, l, PAD + W * 0.40, y + 28 + i * 34, '#111'));
        z.forEach((l, i) => push(fonts.text, l, PAD + W * 0.67, y + 28 + i * 34, '#555'));
        y += n * 34 + 6;
      }
      y += 6;
    } else if (b.type === 'table') {
      const wsum = (b.widths || b.head.map(() => 1)).reduce((s, v) => s + v, 0);
      const cw = (b.widths || b.head.map(() => 1)).map(v => v / wsum * W);
      const cx = []; cw.reduce((s, v, i) => { cx[i] = s; return s + v; }, PAD);
      const row = (cells, font, bg, color) => {
        const lines = cells.map((c, i) => wrap(c, font, cw[i] - 14));
        const n = Math.max(1, ...lines.map(l => l.length));
        const hgt = n * 30 + 14;
        if (bg) ops.push({ rect: true, x: PAD, y, w: W, h: hgt, color: bg });
        lines.forEach((ls, i) => ls.forEach((l, j) => {
          const right = (b.align || [])[i] === 'r';
          push(font, l, right ? cx[i] + cw[i] - 7 : cx[i] + 7, y + 30 + j * 30, color, right ? 'right' : 'left');
        }));
        ops.push({ line: true, y: y + hgt, color: '#ccc', w: 1 });
        y += hgt;
      };
      row(b.head, fonts.th, '#e3efd3', '#222');
      if (!b.rows.length) row([b.leer || '– keine –', ...b.head.slice(1).map(() => '')], fonts.td, null, '#777');
      b.rows.forEach((r, i) => row(r.map(v => v === null || v === undefined ? '' : String(v)), fonts.td, ((b.rowClass || [])[i] || '').includes('rot') ? '#fde2e2' : (i % 2 ? '#f7f7f4' : null), '#111'));
      y += 14;
    }
  }
  if (doc.footer) { y += 10; wrap(doc.footer, fonts.fuss, W).forEach(l => { push(fonts.fuss, l, PAD, y + 22, '#666'); y += 28; }); }
  y += PAD;
  const scale = 1;
  c.width = breite * scale; c.height = Math.ceil(y) * scale;
  x.scale(scale, scale);
  x.fillStyle = '#fff'; x.fillRect(0, 0, breite, y);
  for (const o of ops) {
    if (o.rect) { x.fillStyle = o.color; x.fillRect(o.x, o.y, o.w, o.h); }
    else if (o.line) { x.fillStyle = o.color; x.fillRect(PAD, o.y, W, o.w); }
    else { x.font = o.font; x.fillStyle = o.color || '#111'; x.textAlign = o.align || 'left'; x.fillText(o.txt, o.x, o.y); }
  }
  return c;
}
function docPngBlob(doc) {
  return new Promise(res => docCanvas(doc).toBlob(b => res(b), 'image/png'));
}
async function docTeilen(doc, dateiname) {
  const blob = await docPngBlob(doc);
  return teilenDatei(blob, dateiname.replace(/[^\wäöüÄÖÜß.\- ]+/g, '_') + '.png', doc.title, doc.title);
}
function docDrucken(docs) {
  const p = document.getElementById('druck');
  p.innerHTML = (Array.isArray(docs) ? docs : [docs]).map(d => `<section class="druckseite">${docHtml(d)}</section>`).join('');
  setTimeout(() => window.print(), 50);
}
