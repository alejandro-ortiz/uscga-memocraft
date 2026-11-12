/**
 * Editor logic for the THRU chain and memo body.
 */

import { state } from './state.js';
import { esc, toRoman, bulletGlyph } from './utils.js';
import { updatePreview } from './preview.js';

// ============================================
// THRU CHAIN
// ============================================
export function addThru() {
    state.thruChain.push({ id: Date.now(), name: '', rank: '', position: '' });
    renderThru();
    updatePreview();
}

export function removeThru(id) {
    state.thruChain = state.thruChain.filter(t => t.id !== id);
    renderThru();
    updatePreview();
}

export function updateThru(index, field, value) {
    if (state.thruChain[index]) {
        state.thruChain[index][field] = value;
        updatePreview();
    }
}

export function renderThru() {
    // Use data attributes to enable event delegation.

    document.getElementById('thruContainer').innerHTML = state.thruChain.map((t, i) => `
    <div class="person-entry" data-index="${i}" data-id="${t.id}">
      <input type="text" placeholder="First M. Last" value="${esc(t.name)}" data-field="name">
      <input type="text" class="rank" placeholder="Rank" value="${esc(t.rank)}" data-field="rank">
      <input type="text" class="pos" placeholder="Position / Title" value="${esc(t.position)}" data-field="position">
      <button class="remove-btn" data-action="remove-thru" data-id="${t.id}" title="Remove">×</button>
    </div>`).join('');
}
// Export alias.
export const renderThruLines = renderThru;

// ============================================
// MEMO BODY EDITOR
// ============================================
export function renderMemoLines() {
    document.getElementById('memoLines').innerHTML = state.memoBodyLines.map((line, i) => {
        const num = getLineNum(i);
        const indent = line.indent * 24;
        return `<div class="ed-line" data-index="${i}">
      <div style="width:${indent}px;flex-shrink:0"></div>
      <div class="ln">${num}</div>
      <textarea class="li" rows="1" data-action="edit-line"
        placeholder="${i === 0 && state.memoBodyLines.length === 1 ? 'Start typing...' : ''}">${esc(line.text)}</textarea>
      ${state.memoBodyLines.length > 1 ? `<button class="lx" data-action="remove-line" data-index="${i}">×</button>` : '<div style="width:24px"></div>'}
    </div>`;
    }).join('');
    document.querySelectorAll('#memoLines .li').forEach(autoGrow);
}

export function autoGrow(el) {
    el.style.height = 'auto';
    el.style.height = (el.scrollHeight + 2) + 'px';
    el.style.overflowY = 'hidden';
}

function getLineNum(idx) {
    // Calculate hierarchical numbering based on indentation.
    const counters = [0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i <= idx; i++) {
        const line = state.memoBodyLines[i];
        if (!line) continue;
        const level = line.indent;
        // Bulleted lines are not numbered, so they don't advance the counter.
        if (!line.bullet) counters[level]++;
        // Reset counters for deeper levels.
        for (let j = level + 1; j < counters.length; j++) {
            counters[j] = 0;
        }
    }

    const level = state.memoBodyLines[idx]?.indent || 0;
    if (state.memoBodyLines[idx]?.bullet) return bulletGlyph(level);
    const num = counters[level];

    switch (level) {
        case 0: return num + '.';
        case 1: return String.fromCharCode(96 + num) + '.';
        case 2: return '(' + num + ')';
        case 3: return '(' + String.fromCharCode(96 + num) + ')';
        case 4: return '(' + toRoman(num).toLowerCase() + ')';
        case 5: { const c = String.fromCharCode(96 + num); return '(' + c + c + '.)'; }
        case 6: { const c = String.fromCharCode(96 + num); return '(' + c + c + c + ')'; }
        default: return num + '.';
    }
}

export function addMemoLine() {
    state.memoBodyLines.push({ text: '', indent: 0 });
    renderMemoLines();
    const inputs = document.querySelectorAll('#memoLines .li');
    if (inputs.length) inputs[inputs.length - 1].focus();
    updatePreview();
}

export function removeLine(idx) {
    if (state.memoBodyLines.length <= 1) return;
    state.memoBodyLines.splice(idx, 1);
    renderMemoLines();
    updatePreview();
}

export function updateLineText(idx, text) {
    if (state.memoBodyLines[idx]) {
        state.memoBodyLines[idx].text = text;
        updatePreview();
    }
}

export function shiftIndent(dir) {
    const line = state.memoBodyLines[state.focusedLineIdx];
    if (!line) return;
    const next = line.indent + dir;
    if (next < 0 || next > 6) return;
    line.indent = next;
    renderMemoLines();

    // Restore focus to the edited line.
    const el = document.querySelectorAll('#memoLines .li')[state.focusedLineIdx];
    if (el) {
        el.focus();
        // Move cursor to the end of the line.
        el.setSelectionRange(el.value.length, el.value.length);
    }
    updatePreview();
}

export function toggleBullet() {
    const line = state.memoBodyLines[state.focusedLineIdx];
    if (!line) return;
    line.bullet = !line.bullet;
    renderMemoLines();
    const el = document.querySelectorAll('#memoLines .li')[state.focusedLineIdx];
    if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
    }
    updatePreview();
}

export function handleLineKey(e, idx) {
    if (e.key === 'Enter') {
        e.preventDefault();
        state.memoBodyLines.splice(idx + 1, 0, { text: '', indent: state.memoBodyLines[idx].indent });
        renderMemoLines();
        document.querySelectorAll('#memoLines .li')[idx + 1]?.focus();
        updatePreview();
    }
    if (e.key === 'Tab') {
        e.preventDefault();
        state.focusedLineIdx = idx;
        shiftIndent(e.shiftKey ? -1 : 1);
    }
    if (e.key === 'Backspace' && state.memoBodyLines[idx].text === '' && state.memoBodyLines.length > 1) {
        e.preventDefault();
        state.memoBodyLines.splice(idx, 1);
        renderMemoLines();
        document.querySelectorAll('#memoLines .li')[Math.max(0, idx - 1)]?.focus();
        updatePreview();
    }
}
