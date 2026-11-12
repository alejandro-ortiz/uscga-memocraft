/**
 * Live Preview Rendering for MemoCraft
 */

import { state } from './state.js';
import { v, esc, fmtDate, toRoman, autoLabel, bulletGlyph, normalizeEmail } from './utils.js';
import { getUnitInfo, getContactBase } from './memo-storage.js';
import { updateValidation } from './validation.js';

// ============================================
// FORMAT HELPERS
// ============================================
function formatFromToLine(name, rank, position) {
    // Format: "Name, RANK" on first line, position on second line
    const nameLine = [name, rank].filter(Boolean).join(', ');
    if (position) {
        return `${nameLine}<br>${position}`;
    }
    return nameLine;
}

function formatThruLine() {
    const validThru = state.thruChain.filter(t => t.name || t.rank || t.position);
    if (validThru.length === 0) return '';

    if (validThru.length === 1) {
        // Single: "Name, RANK, Position" on one line
        const t = validThru[0];
        return [esc(t.name), esc(t.rank), esc(t.position)].filter(Boolean).join(', ');
    } else {
        // Multiple: numbered (1), (2), etc.
        return validThru.map((t, i) => {
            const parts = [esc(t.name), esc(t.rank), esc(t.position)].filter(Boolean).join(', ');
            return `(${i + 1}) ${parts}`;
        }).join('<br>');
    }
}

// ============================================
// MAIN PREVIEW UPDATE
// ============================================
export function updatePreview() {
    const phone = v('contactPhone');
    const email = normalizeEmail(v('contactEmail'));
    const ssic = v('ssic');
    const date = v('memoDate');
    const subject = v('subject');

    // ---- First-page header (logo/unit/contact/SSIC-date) ----
    const unitHtml = esc(getUnitInfo()).replace(/\n/g, '<br>');
    let contactHtml = esc(getContactBase()).replace(/\n/g, '<br>');
    contactHtml += `<br>Phone: ${esc(phone) || '(123) 456-7890'}`;
    contactHtml += `<br>Email: ${esc(email) || 'first.m.last@uscga.edu'}`;
    const ssicStr = ssic ? esc(ssic) : '<span class="pv-empty">SSIC</span>';
    const dateStr = date ? fmtDate(date) : '<span class="pv-empty">Date</span>';

    const pg1Header =
        `<div class="paper-header">` +
        `<div class="paper-logo"><img src="logo.gif" alt="USCG Logo" width="192" height="59"></div>` +
        `<div class="paper-unit">${unitHtml}</div>` +
        `<div class="paper-contact">${contactHtml}</div>` +
        `</div>` +
        `<div class="paper-header-row2">` +
        `<div class="paper-ssic-date">${ssicStr}<br>${dateStr}</div>` +
        `</div>`;

    // ---- Content blocks (each a separate measurable element) ----
    const blocks = [];

    blocks.push(`<div class="pv-memo-title">MEMORANDUM</div>`);

    // From
    const fromName = v('from-name');
    const fromRank = v('from-rank');
    const fromPos = v('from-position');
    const fromDisplay = formatFromToLine(esc(fromName), esc(fromRank), esc(fromPos));
    blocks.push(`<div class="pv-line"><span style="display:inline-table"><span style="display:table-cell;width:48px;white-space:nowrap;"><b>From:</b></span><span style="display:table-cell;">${fromDisplay || '<span class="pv-empty">Originator</span>'}</span></span></div>`);
    blocks.push(`<div class="pv-spacer"></div>`);

    // To
    const toName = v('to-name');
    const toRank = v('to-rank');
    const toPos = v('to-position');
    const toDisplay = formatFromToLine(esc(toName), esc(toRank), esc(toPos));
    blocks.push(`<div class="pv-line"><span style="display:inline-table"><span style="display:table-cell;width:48px;white-space:nowrap;"><b>To:</b></span><span style="display:table-cell;">${toDisplay || '<span class="pv-empty">Addressee</span>'}</span></span></div>`);

    // Thru
    const thruDisplay = formatThruLine();
    if (thruDisplay) {
        blocks.push(`<div class="pv-line"><span style="display:inline-table"><span style="display:table-cell;width:48px;white-space:nowrap;"><b>Thru:</b></span><span style="display:table-cell;">${thruDisplay}</span></span></div>`);
    }

    blocks.push(`<div class="pv-spacer"></div>`);

    // Subject
    blocks.push(`<div class="pv-subj"><span style="display:inline-table"><span style="display:table-cell;width:48px;white-space:nowrap;"><b>Subj:</b></span><span style="display:table-cell;">${subject ? esc(subject).toUpperCase() : '<span class="pv-empty">Subject line</span>'}</span></span></div>`);

    // References
    if (state.opts.refs && v('references')) {
        blocks.push(`<div class="pv-spacer"></div>`);
        const refs = autoLabel(v('references'), 'ref').split('\n').filter(Boolean);
        const refsFormatted = refs.map((r, i) => {
            if (i === 0) {
                return `<span style="display:inline-table"><span style="display:table-cell;width:48px;white-space:nowrap;"><b>Ref:</b></span><span style="display:table-cell;">${esc(r)}</span></span>`;
            } else {
                return `<span style="display:inline-table"><span style="display:table-cell;width:48px;white-space:nowrap;visibility:hidden;"><b>Ref:</b></span><span style="display:table-cell;">${esc(r)}</span></span>`;
            }
        }).join('<br>');
        blocks.push(`<div class="pv-line">${refsFormatted}</div>`);
    }

    blocks.push(`<div class="pv-spacer"></div>`);

    // Body paragraphs
    const counters = [0, 0, 0, 0, 0, 0, 0];
    const isSinglePara = state.memoBodyLines.length === 1;

    state.memoBodyLines.forEach(line => {
        const level = line.indent;
        // Bulleted lines are not numbered, so they don't advance the counter.
        if (!line.bullet) counters[level]++;
        for (let j = level + 1; j < counters.length; j++) counters[j] = 0;

        // If single paragraph, render without number
        if (isSinglePara) {
            const text = line.text ? esc(line.text) : '<span class="pv-empty">\u2026</span>';
            blocks.push(`<div class="pv-para" style="margin-left:0">${text}</div>`);
            return;
        }

        let num;
        if (line.bullet) { num = bulletGlyph(level); }
        else switch (level) {
            case 0: num = counters[0] + '.'; break;
            case 1: num = String.fromCharCode(96 + counters[1]) + '.'; break;
            case 2: num = '(' + counters[2] + ')'; break;
            case 3: num = '(' + String.fromCharCode(96 + counters[3]) + ')'; break;
            case 4: num = '(' + toRoman(counters[4]).toLowerCase() + ')'; break;
            case 5: { const c = String.fromCharCode(96 + counters[5]); num = '(' + c + c + '.)'; break; }
            case 6: { const c = String.fromCharCode(96 + counters[6]); num = '(' + c + c + c + ')'; break; }
            default: num = counters[level] + '.';
        }

        const indent = level * 24;
        const numW = level > 3 ? 36 : 24;
        const text = line.text ? esc(line.text) : '<span class="pv-empty">\u2026</span>';

        if (level === 0) {
            // Level 0: wraps below the number
            blocks.push(`<div class="pv-para" style="margin-left:${indent}px"><span style="display:inline-block;min-width:${numW}px">${num}</span> ${text}</div>`);
        } else {
            // Level > 0: hanging indent (flex behavior)
            blocks.push(`<div class="pv-para pv-para-hanging" style="margin-left:${indent}px"><div style="flex:0 0 ${numW}px">${num}</div><div style="flex:1">${text}</div></div>`);
        }
    });

    blocks.push(`<div class="pv-center">#</div>`);

    // Footer sections
    const footerSections = [];
    if (state.opts.encl && v('enclosures')) footerSections.push({ label: 'Enclosures:', text: autoLabel(v('enclosures'), 'encl') });
    if (state.opts.dist && v('dist')) footerSections.push({ label: 'Dist:', text: v('dist') });
    if (state.opts.copy && v('copyTo')) footerSections.push({ label: 'Copy:', text: v('copyTo') });
    if (state.opts.bcc && v('blindCopy')) footerSections.push({ label: 'Blind Copy:', text: v('blindCopy') });

    if (footerSections.length > 0) {
        blocks.push(`<div class="pv-spacer"></div>`);
        blocks.push(`<div class="pv-spacer"></div>`);
    }

    footerSections.forEach((item, idx) => {
        const lines = esc(item.text).split('\n').filter(l => l.trim());
        const formatted = lines.map((line, li) => {
            if (li === 0) {
                return `<span style="display:inline-table"><span style="display:table-cell;white-space:nowrap;padding-right:0.5em;"><b>${esc(item.label)}</b></span><span style="display:table-cell;">${line}</span></span>`;
            } else {
                return `<span style="display:inline-table"><span style="display:table-cell;white-space:nowrap;padding-right:0.5em;visibility:hidden;"><b>${esc(item.label)}</b></span><span style="display:table-cell;">${line}</span></span>`;
            }
        }).join('<br>');
        blocks.push(`<div class="pv-footer">${formatted}</div>`);
        if (idx < footerSections.length - 1) {
            blocks.push(`<div class="pv-spacer"></div>`);
        }
    });

    // ---- Continuation header for pages 2+ ----
    const subjText = subject ? esc(subject).toUpperCase() : '<span class="pv-empty">Subject line</span>';
    const contHeader =
        `<table class="cont-table" style="table-layout: fixed;">` +
        `<colgroup><col style="width: 83%"><col style="width: 17%"></colgroup>` +
        `<tr>` +
        `<td>Subj:&ensp;${subjText}</td>` +
        `<td class="cont-right">${ssic || '<span class="pv-empty">SSIC</span>'}<br>${date ? fmtDate(date) : ''}</td></tr></table>`;

    // ---- Measure heights for pagination ----
    const measure = document.getElementById('measureBox');

    // Use hardcoded values that match what was in app.js or constants
    const CONTENT_W = 624;
    const CONTENT_H = 864;

    measure.style.width = CONTENT_W + 'px';

    // Page 1 header height
    measure.innerHTML = pg1Header + '<div class="m-end"></div>';
    const pg1HdrH = measure.querySelector('.m-end').offsetTop;

    // Each content block height (using position-difference to include margins)
    measure.innerHTML = blocks.join('') + '<div class="m-end"></div>';
    const els = [...measure.children];
    const endEl = els.pop();
    const bH = els.map((el, i) => {
        const next = els[i + 1] || endEl;
        return next.offsetTop - el.offsetTop;
    });
    measure.innerHTML = '';

    // ---- Paginate ----
    const pages = [[]];
    let pIdx = 0;
    let rem = CONTENT_H - pg1HdrH;

    for (let i = 0; i < blocks.length; i++) {
        if (bH[i] > rem && pages[pIdx].length > 0) {
            pIdx++;
            pages.push([]);
            rem = CONTENT_H;
        }
        pages[pIdx].push(i);
        rem -= bH[i];
    }

    // ---- Render pages ----
    // Use current scale for rendering.
    const effectiveScale = (typeof window !== 'undefined' && window.currentScale) || 0.75;
    const PG_W = 816, PG_H = 1056;

    const stack = document.getElementById('pageStack');
    let html = '';

    for (let p = 0; p < pages.length; p++) {
        const sw = Math.round(PG_W * effectiveScale);
        const sh = Math.round(PG_H * effectiveScale);
        html += `<div class="page-sizer" style="width:${sw}px;height:${sh}px;">`;
        html += `<div class="paper-page" style="transform:scale(${effectiveScale});">`;

        if (p > 0) {
            html += `<div class="page-header-area">${contHeader}</div>`;
        }

        html += `<div class="page-content-area">`;
        if (p === 0) html += pg1Header;
        for (const idx of pages[p]) html += blocks[idx];
        html += `</div>`;

        if (p > 0) {
            html += `<div class="page-footer-area">${p + 1}</div>`;
        }

        html += `</div></div>`;
    }

    stack.innerHTML = html;

    // Update soft validation reminders.
    updateValidation();

    // Auto-save if subject exists
    if (subject) {
        document.dispatchEvent(new CustomEvent('autosave'));
    }
}
