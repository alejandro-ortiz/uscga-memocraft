/**
 * Generates a USCG memorandum as a PDF (sign-ready for CAC signing in Adobe Acrobat).
 *
 * Uses pdf-lib (vendored) with PDF's built-in Times font — renders identically
 * everywhere, no font embedding or licensing. Mirrors the layout produced by
 * docx-generator.js so the PDF and Word outputs match.
 *
 * Expects the same `options` object that download-handler.js builds for the DOCX:
 *   { unit, contact, ssic, date, from, to, thru?, subject, ref?, body:[{level,text}],
 *     enclosure?, dist?, copy?, blindCopy? }
 */

import { toRoman, bulletGlyph } from './utils.js';

// ── Page geometry (points; 1pt = 1/72") ──
const PAGE_W = 612, PAGE_H = 792;      // 8.5" x 11"
const MARGIN = 72;                      // 1" margins
const LEFT = MARGIN, RIGHT = PAGE_W - MARGIN;   // 72 .. 540
const TOP = PAGE_H - MARGIN;            // 720 (content top, from bottom-left origin)
const BOTTOM = MARGIN;                  // 72

// ── Type ──
const BODY = 12;        // body font size
const LINE = 14;        // line height within a paragraph
const PARA_GAP = 12;    // extra space after a numbered body paragraph (docx after:240)
const BLANK = 14;       // one blank line between sections
const SMALL = 8;        // header unit/contact blocks (8pt, like docx Arial 8)
const SMALL_LINE = 9.6;

// ── Layout of the fixed page-1 letterhead ──
const LH = {
  logoX: LEFT, logoW: 144, logoH: 44,       // logo ~2" wide
  unitX: 234, headTop: 712,                  // unit block
  contactX: 404,                             // contact + ssic/date block (left edge)
  ssicY: 650, dateY: 636,                    // ssic / date baselines
  memoY: 618                                 // MEMORANDUM baseline
};

// Gutter after labels like "From:" / "To:" / "Subj:" / "Ref:"
const LABEL_GUTTER = 42;

export async function generateMemoPdf(options) {
  const { PDFDocument, StandardFonts } = window.PDFLib;
  const doc = await PDFDocument.create();
  const times = await doc.embedFont(StandardFonts.TimesRoman);
  const timesBold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const helv = await doc.embedFont(StandardFonts.Helvetica);

  // Logo (PNG — pdf-lib cannot embed GIF).
  let logo = null;
  try {
    const resp = await fetch('logo.png');
    if (resp.ok) logo = await doc.embedPng(new Uint8Array(await resp.arrayBuffer()));
  } catch { /* logo is optional; continue without it */ }

  let page;
  let pageNum = 0;
  let y = 0;   // baseline of the next text line

  const textW = (s, font = times, size = BODY) => font.widthOfTextAtSize(s, size);

  // Greedy word-wrap with distinct widths for the first vs. continuation lines.
  function wrap(text, firstMaxW, contMaxW, font = times, size = BODY) {
    const words = String(text).split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
      const max = lines.length === 0 ? firstMaxW : contMaxW;
      const t = cur ? cur + ' ' + w : w;
      if (textW(t, font, size) > max && cur) { lines.push(cur); cur = w; }
      else cur = t;
    }
    lines.push(cur);
    return lines.length ? lines : [''];
  }

  function drawPageNumber(pg, n) {
    const t = String(n);
    pg.drawText(t, { x: (PAGE_W - textW(t)) / 2, y: 36, size: BODY, font: times });
  }

  // Start a continuation page (page 2+): repeated Subj/SSIC/date header + footer number.
  function newContinuationPage() {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pageNum++;
    page.drawText('Subj: ' + options.subject, { x: LEFT, y: PAGE_H - 36, size: BODY, font: times });
    if (options.ssic) page.drawText(options.ssic, { x: LH.contactX, y: PAGE_H - 36, size: BODY, font: times });
    if (options.date) page.drawText(options.date, { x: LH.contactX, y: PAGE_H - 36 - LINE, size: BODY, font: times });
    drawPageNumber(page, pageNum);
    y = TOP;
  }

  // Ensure room for one more line; break to a continuation page if needed.
  function ensureLine() {
    if (y < BOTTOM) newContinuationPage();
  }

  function writeLine(text, x, { font = times, size = BODY } = {}) {
    ensureLine();
    page.drawText(text, { x, y, size, font });
    y -= LINE;
  }

  // ── Page 1 letterhead ──
  function drawLetterhead() {
    page = doc.addPage([PAGE_W, PAGE_H]);
    pageNum++;

    if (logo) page.drawImage(logo, { x: LH.logoX, y: TOP - LH.logoH, width: LH.logoW, height: LH.logoH });

    (options.unit || '').split('\n').forEach((ln, i) => {
      page.drawText(ln, { x: LH.unitX, y: LH.headTop - i * SMALL_LINE, size: SMALL, font: helv });
    });
    (options.contact || '').split('\n').forEach((ln, i) => {
      page.drawText(ln, { x: LH.contactX, y: LH.headTop - i * SMALL_LINE, size: SMALL, font: helv });
    });

    if (options.ssic) page.drawText(options.ssic, { x: LH.contactX, y: LH.ssicY, size: BODY, font: times });
    if (options.date) page.drawText(options.date, { x: LH.contactX, y: LH.dateY, size: BODY, font: times });

    page.drawText('MEMORANDUM', { x: LEFT, y: LH.memoY, size: 16, font: timesBold });
    y = LH.memoY - 2 * BLANK - 12;   // two blank lines after the title
  }

  // ── A labeled block: "From:", "To:", "Thru:", "Subj:", "Ref:", footer items ──
  // Handles multi-line input (\n): the first physical line carries the label,
  // the rest align under the text column (hanging).
  function drawLabeled(label, text, gutter) {
    const textX = LEFT + gutter;
    const segs = String(text).split('\n');
    let first = true;
    segs.forEach(seg => {
      const lines = wrap(seg, RIGHT - textX, RIGHT - textX);
      lines.forEach(ln => {
        ensureLine();
        if (first) page.drawText(label, { x: LEFT, y, size: BODY, font: times });
        page.drawText(ln, { x: textX, y, size: BODY, font: times });
        y -= LINE;
        first = false;
      });
    });
  }

  function numLabel(level, counters) {
    const n = counters[level];
    switch (level) {
      case 0: return n + '.';
      case 1: return String.fromCharCode(96 + n) + '.';
      case 2: return '(' + n + ')';
      case 3: return '(' + String.fromCharCode(96 + n) + ')';
      case 4: return '(' + toRoman(n).toLowerCase() + ')';
      case 5: { const c = String.fromCharCode(96 + n); return '(' + c + c + '.)'; }
      case 6: { const c = String.fromCharCode(96 + n); return '(' + c + c + c + ')'; }
      default: return n + '.';
    }
  }

  function drawBody(body) {
    const single = body.length === 1;
    const counters = [0, 0, 0, 0, 0, 0, 0];
    // Text column per level, built as a hanging chain so each subparagraph's
    // label sits under the FIRST LETTER of its parent paragraph's text (manual:
    // "the first item of the subparagraph is aligned with the first letter of
    // the first paragraph"). Level 0 wraps back to the left margin; deeper
    // levels hang their runover under their own text.
    const textCol = [LEFT, LEFT, LEFT, LEFT, LEFT, LEFT, LEFT];

    body.forEach(item => {
      const L = item.level;
      // Bulleted lines are not numbered, so they don't advance the counter.
      if (!item.bullet) counters[L]++;
      for (let j = L + 1; j < counters.length; j++) counters[j] = 0;

      const label = single ? '' : (item.bullet ? bulletGlyph(L) : numLabel(L, counters));
      const gut = Math.max(textW(label) + 6, 18);   // room for label + a set gap

      const labelX = (single || L === 0) ? LEFT : textCol[L - 1];
      const textX = single ? LEFT : labelX + gut;
      const contX = L === 0 ? LEFT : textX;
      textCol[L] = textX;

      const lines = wrap(item.text, RIGHT - textX, RIGHT - contX);
      lines.forEach((ln, i) => {
        ensureLine();
        if (i === 0 && label) page.drawText(label, { x: labelX, y, size: BODY, font: times });
        page.drawText(ln, { x: i === 0 ? textX : contX, y, size: BODY, font: times });
        y -= LINE;
      });
      y -= PARA_GAP;
    });
  }

  // ════════════ Assemble ════════════
  drawLetterhead();

  drawLabeled('From:', options.from, LABEL_GUTTER);
  y -= BLANK;
  drawLabeled('To:', options.to, LABEL_GUTTER);
  if (options.thru) drawLabeled('Thru:', options.thru, LABEL_GUTTER);
  y -= BLANK;
  drawLabeled('Subj:', options.subject, LABEL_GUTTER);
  if (options.ref) { y -= BLANK; drawLabeled('Ref:', options.ref, LABEL_GUTTER); }
  y -= BLANK;

  drawBody(options.body && options.body.length ? options.body : [{ level: 0, text: '[Memo body]' }]);

  // Closing "#": land it on the third line below the last paragraph (two blank
  // lines between), matching the DOCX. drawBody already left one PARA_GAP.
  y -= 2 * BLANK - PARA_GAP;
  ensureLine();
  page.drawText('#', { x: (PAGE_W - textW('#')) / 2, y, size: BODY, font: times });
  y -= LINE;

  // Footer sections after the "#".
  const footer = [];
  if (options.enclosure) footer.push(['Enclosures:', options.enclosure]);
  if (options.dist) footer.push(['Dist:', options.dist]);
  if (options.copy) footer.push(['Copy:', options.copy]);
  if (options.blindCopy) footer.push(['Blind Copy:', options.blindCopy]);
  if (footer.length) {
    y -= 2 * BLANK;
    footer.forEach(([label, text], i) => {
      drawLabeled(label, text, textW(label) + 6);
      if (i < footer.length - 1) y -= BLANK;
    });
  }

  return new Blob([await doc.save()], { type: 'application/pdf' });
}

export async function downloadMemoPdf(options, filename = 'memo.pdf') {
  const blob = await generateMemoPdf(options);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
