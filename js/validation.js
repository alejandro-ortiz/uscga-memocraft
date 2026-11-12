/**
 * Soft, non-blocking format checks that help cadets avoid common rejections.
 * Nothing here prevents generating a memo — it just surfaces reminders.
 */

import { state } from './state.js';
import { v } from './utils.js';

// Return an array of warning strings for the current memo.
export function validateMemo() {
    const warnings = [];

    const subject = v('subject');
    if (!subject) {
        warnings.push('Add a subject line — it goes in ALL CAPS on every page.');
    } else if (subject.trim().split(/\s+/).length > 10) {
        warnings.push('Subject is over 10 words — memos usually keep it to 10 or fewer.');
    }

    if (!v('ssic')) warnings.push('Add an SSIC — it appears on every page of the memo.');
    if (!v('from-name')) warnings.push('Fill in the "From" line.');
    if (!v('to-name')) warnings.push('Fill in the "To" line.');

    // Two-subparagraph rule: a subparagraph level must have at least two items,
    // otherwise it should be merged into the paragraph above it.
    const counts = [0, 0, 0, 0, 0, 0, 0];
    let lone = false;
    for (const line of state.memoBodyLines) {
        const L = line.indent;
        counts[L]++;
        for (let j = L + 1; j < counts.length; j++) {
            if (counts[j] === 1) lone = true;   // a deeper group closed with a single item
            counts[j] = 0;
        }
    }
    for (let j = 1; j < counts.length; j++) if (counts[j] === 1) lone = true;  // trailing group
    if (lone) {
        warnings.push('A subparagraph level has only one item — use at least two (both "a." and "b.", or two bullets) or merge it into the paragraph above.');
    }

    return warnings;
}

// Render the warnings into #validationPanel.
export function updateValidation() {
    const panel = document.getElementById('validationPanel');
    if (!panel) return;

    const warnings = validateMemo();
    if (warnings.length === 0) {
        panel.className = 'validation-panel ok';
        panel.innerHTML = '<span class="vp-icon">✓</span> Looks good — no format issues flagged.';
        panel.style.display = '';
        return;
    }

    panel.className = 'validation-panel warn';
    panel.innerHTML =
        '<div class="vp-title">Before you send — a few reminders:</div>' +
        '<ul class="vp-list">' +
        warnings.map(w => `<li>${w}</li>`).join('') +
        '</ul>';
    panel.style.display = '';
}
