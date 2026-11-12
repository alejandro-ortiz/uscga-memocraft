/**
 * Collects the memo form state and hands it to either the DOCX or PDF generator.
 */

import { state } from './state.js';
import { v, fmtDate, autoLabel, normalizeEmail } from './utils.js';
import { getUnitInfo, getContactBase } from './memo-storage.js';
import { downloadMemo } from './docx-generator.js';
import { downloadMemoPdf } from './pdf-generator.js';

// Build the shared options object (same shape for DOCX and PDF) from the form.
export function collectMemoOptions() {
    const phone = v('contactPhone');
    const email = normalizeEmail(v('contactEmail'));

    let contact = getContactBase();
    contact += `\nPhone: ${phone || '(123) 456-7890'}`;
    contact += `\nEmail: ${email || 'first.m.last@uscga.edu'}`;

    // Sender.
    const fromName = v('from-name');
    const fromRank = v('from-rank');
    const fromPos = v('from-position');
    let fromLine = [fromName, fromRank].filter(Boolean).join(', ');
    if (fromPos) fromLine += '\n' + fromPos;

    // Recipient.
    const toName = v('to-name');
    const toRank = v('to-rank');
    const toPos = v('to-position');
    let toLine = [toName, toRank].filter(Boolean).join(', ');
    if (toPos) toLine += '\n' + toPos;

    // Thru chain.
    let thruLine = null;
    const validThru = state.thruChain.filter(t => t.name || t.rank || t.position);
    if (validThru.length === 1) {
        const t = validThru[0];
        thruLine = [t.name, t.rank, t.position].filter(Boolean).join(', ');
    } else if (validThru.length > 1) {
        thruLine = validThru.map((t, i) => {
            const parts = [t.name, t.rank, t.position].filter(Boolean).join(', ');
            return `(${i + 1}) ${parts}`;
        }).join('\n');
    }

    // Body.
    const body = state.memoBodyLines
        .filter(line => line.text.trim())
        .map(line => ({ level: line.indent, text: line.text, bullet: !!line.bullet }));
    if (body.length === 0) body.push({ level: 0, text: '[Memo body]' });

    const memoOptions = {
        unit: getUnitInfo(),
        contact,
        ssic: v('ssic') || '0000',
        date: fmtDate(v('memoDate')),
        from: fromLine || 'Originator',
        to: toLine || 'Addressee',
        subject: (v('subject') || 'SUBJECT').toUpperCase(),
        body
    };

    if (thruLine) memoOptions.thru = thruLine;
    if (state.opts.refs && v('references')) memoOptions.ref = autoLabel(v('references'), 'ref');
    if (state.opts.encl && v('enclosures')) memoOptions.enclosure = autoLabel(v('enclosures'), 'encl');
    if (state.opts.dist && v('dist')) memoOptions.dist = v('dist');
    if (state.opts.copy && v('copyTo')) memoOptions.copy = v('copyTo');
    if (state.opts.bcc && v('blindCopy')) memoOptions.blindCopy = v('blindCopy');

    const filenameBase = (v('subject') || 'memo')
        .toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);

    return { options: memoOptions, filenameBase };
}

// Run a download of the given kind ('docx' | 'pdf'), toggling button state.
async function runDownload(e, kind) {
    const buttons = [...document.querySelectorAll('[data-generate]')];
    const clicked = e && e.currentTarget;
    const original = clicked ? clicked.textContent : null;
    buttons.forEach(b => { b.disabled = true; });
    if (clicked) clicked.textContent = 'Generating...';

    try {
        const { options, filenameBase } = collectMemoOptions();
        if (kind === 'pdf') await downloadMemoPdf(options, filenameBase + '.pdf');
        else await downloadMemo(options, filenameBase + '.docx');
    } catch (error) {
        console.error('Generation error:', error);
        alert('Error generating document: ' + error.message);
    } finally {
        buttons.forEach(b => { b.disabled = false; });
        if (clicked && original !== null) clicked.textContent = original;
    }
}

export const handleDownload = (e) => runDownload(e, 'docx');
export const handlePdfDownload = (e) => runDownload(e, 'pdf');
