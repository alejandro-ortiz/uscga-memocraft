/**
 * Memo Storage and Sidebar Management for MemoCraft
 */

import { state } from './state.js';
import { esc } from './utils.js';
import { updatePreview } from './preview.js';
// Import shared state and utilities.
import { renderMemoLines, renderThruLines } from './memo-editor.js';

// ============================================
// SIDEBAR TOGGLE
// ============================================
export function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const open = sidebar.classList.toggle('collapsed') === false; // true when now open
    document.getElementById('sidebarBackdrop')?.classList.toggle('open', open);
}

// On mobile the sidebar is an overlay drawer; close it after an action that
// returns focus to the form (picking/creating a memo). No-op on desktop.
export function closeSidebarOnMobile() {
    if (window.innerWidth > 768) return;
    document.getElementById('sidebar')?.classList.add('collapsed');
    document.getElementById('sidebarBackdrop')?.classList.remove('open');
}

// ============================================
// LOCAL STORAGE
// ============================================
export function getSavedMemos() {
    try {
        return JSON.parse(localStorage.getItem('memocraft-memos') || '[]');
    } catch { return []; }
}

export function saveMemos(memos) {
    localStorage.setItem('memocraft-memos', JSON.stringify(memos));
}

// ============================================
// MEMO LIST RENDERING
// ============================================
export function renderMemoList() {
    const memos = getSavedMemos();
    const container = document.getElementById('memoList');

    if (memos.length === 0) {
        container.innerHTML = '<div style="color:#5c7080;font-size:12px;padding:12px;text-align:center;">No saved memos</div>';
        return;
    }

    container.innerHTML = memos.map(m => `
    <div class="memo-list-item ${m.id === state.currentMemoId ? 'active' : ''}" data-id="${m.id}">
      <div class="m-info">
        <div class="m-title">${esc(m.subject || 'Untitled')}</div>
        <div class="m-meta">${m.date || 'No date'}</div>
      </div>
      <button class="m-delete" data-action="delete" data-id="${m.id}" title="Delete">×</button>
    </div>
  `).join('');
}

// ============================================
// NEW MEMO
// ============================================
export function newMemo() {
    state.currentMemoId = null;
    localStorage.removeItem('memocraft-active-id');
    document.querySelectorAll('.form-side input, .form-side textarea').forEach(el => el.value = '');
    document.getElementById('headerUnit').value = "Superintendent\nU. S. Coast Guard Academy";
    document.getElementById('headerAddress').value = "15 Mohegan Ave.\nNew London, CT 06320";
    document.getElementById('memoDate').value = new Date().toISOString().split('T')[0];
    state.thruChain = [];
    document.getElementById('thruContainer').innerHTML = '';
    state.memoBodyLines = [{ text: '', indent: 0 }];

    // Reset UI state.

    // Re-setting opts
    state.opts = { refs: false, encl: false, dist: false, copy: false, bcc: false };
    document.querySelectorAll('.opt-toggle').forEach(el => el.classList.remove('on'));
    document.querySelectorAll('.opt-body').forEach(el => el.classList.remove('show'));

    renderMemoList(); // Re-render list to clear active selection
    closeSidebarOnMobile();

    // Dispatch event to notify other modules of reset.

    document.dispatchEvent(new CustomEvent('memo-reset'));
}

// ============================================
// GET/SET MEMO DATA (Helpers)
// ============================================
// Helper to get value from element.
import { v } from './utils.js';

export function getMemoData() {
    return {
        headerUnit: v('headerUnit'),
        headerAddress: v('headerAddress'),
        phone: v('contactPhone'),
        email: v('contactEmail'),
        ssic: v('ssic'),
        date: v('memoDate'),
        fromName: v('from-name'),
        fromRank: v('from-rank'),
        fromPosition: v('from-position'),
        toName: v('to-name'),
        toRank: v('to-rank'),
        toPosition: v('to-position'),
        thruChain: [...state.thruChain],
        subject: v('subject'),
        body: [...state.memoBodyLines],
        references: v('references'),
        enclosures: v('enclosures'),
        dist: v('dist'),
        copyTo: v('copyTo'),
        blindCopy: v('blindCopy'),
        opts: { ...state.opts }
    };
}

export function setMemoData(data) {
    document.getElementById('headerUnit').value = data.headerUnit || "Superintendent\nU. S. Coast Guard Academy";
    document.getElementById('headerAddress').value = data.headerAddress || "15 Mohegan Ave.\nNew London, CT 06320";
    document.getElementById('contactPhone').value = data.phone || '';
    document.getElementById('contactEmail').value = data.email || '';
    document.getElementById('ssic').value = data.ssic || '';
    document.getElementById('memoDate').value = data.date || new Date().toISOString().split('T')[0];
    document.getElementById('from-name').value = data.fromName || '';
    document.getElementById('from-rank').value = data.fromRank || '';
    document.getElementById('from-position').value = data.fromPosition || '';
    document.getElementById('to-name').value = data.toName || '';
    document.getElementById('to-rank').value = data.toRank || '';
    document.getElementById('to-position').value = data.toPosition || '';
    document.getElementById('subject').value = data.subject || '';
    document.getElementById('references').value = data.references || '';
    document.getElementById('enclosures').value = data.enclosures || '';
    document.getElementById('dist').value = data.dist || '';
    document.getElementById('copyTo').value = data.copyTo || '';
    document.getElementById('blindCopy').value = data.blindCopy || '';

    state.thruChain = data.thruChain || [];
    state.memoBodyLines = data.body || [{ text: '', indent: 0 }];

    state.opts = data.opts || { refs: false, encl: false, dist: false, copy: false, bcc: false };
    Object.keys(state.opts).forEach(k => {
        const check = document.getElementById(k + 'Check');
        if (check) {
            check.parentElement.classList.toggle('on', state.opts[k]);
            document.getElementById(k + 'Body').classList.toggle('show', state.opts[k]);
        }
    });

    // signal update
    document.dispatchEvent(new CustomEvent('memo-loaded'));
}

// ============================================
// SAVE/LOAD/DELETE MEMO
// ============================================
export function saveMemo(silent = false) {
    const data = getMemoData();
    const memos = getSavedMemos();

    if (state.currentMemoId) {
        // Update existing
        const idx = memos.findIndex(m => m.id === state.currentMemoId);
        if (idx >= 0) {
            memos[idx] = { ...data, id: state.currentMemoId };
        }
        if (silent !== true) renderMemoList();
    } else {
        // Create new
        state.currentMemoId = 'memo-' + Date.now();
        memos.unshift({ ...data, id: state.currentMemoId });
        renderMemoList();
    }


    saveMemos(memos);
    localStorage.setItem('memocraft-active-id', state.currentMemoId);

    if (silent === true) return;

    // Visual feedback
    const btn = document.querySelector('.topbar-save');
    if (btn) {
        btn.textContent = 'Saved!';
        btn.style.backgroundColor = '#27ae60'; // Green success color

        setTimeout(() => {
            btn.textContent = 'Save Memo';
            btn.style.backgroundColor = '';
        }, 1000);
    }
}

export function loadMemo(id) {
    const memos = getSavedMemos();
    const memo = memos.find(m => m.id === id);
    if (!memo) return;

    state.currentMemoId = id;
    localStorage.setItem('memocraft-active-id', id);
    setMemoData(memo);
    renderMemoList(); // Update active state
    closeSidebarOnMobile();
    // updatePreview is called by the listener of 'memo-loaded'
}

export function deleteMemo(id) {
    if (!confirm('Delete this memo?')) return;
    let memos = getSavedMemos();
    memos = memos.filter(m => m.id !== id);
    saveMemos(memos);
    if (state.currentMemoId === id) {
        state.currentMemoId = null;
        localStorage.removeItem('memocraft-active-id');
        // Optionally clear form or just leave it
    }
    renderMemoList();
}

// ============================================
// OPTIONAL SECTIONS TOGGLE
// ============================================
export function toggleOpt(key) {
    state.opts[key] = !state.opts[key];
    document.getElementById(key + 'Check').parentElement.classList.toggle('on', state.opts[key]);
    document.getElementById(key + 'Body').classList.toggle('show', state.opts[key]);
    updatePreview();
}


// ============================================
// EXPORT / IMPORT
// ============================================
export function exportMemo() {
    // Export data to JSON file.

    const data = getMemoData();
    const subject = data.subject || 'memo';
    const filename = subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '.json';

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function processImportedData(rawData) {
    try {
        // Security Validation & Sanitization
        if (typeof rawData !== 'object' || rawData === null) {
            throw new Error('Invalid JSON format');
        }

        // Whitelist allowed keys and validate types
        const cleanData = {};

        // Strings
        const stringFields = [
            'headerUnit', 'headerAddress', 'phone', 'email', 'ssic', 'date',
            'fromName', 'fromRank', 'fromPosition',
            'toName', 'toRank', 'toPosition',
            'subject', 'references', 'enclosures',
            'dist', 'copyTo', 'blindCopy'
        ];

        stringFields.forEach(field => {
            if (typeof rawData[field] === 'string') {
                cleanData[field] = rawData[field]; // Basic string copy
            }
        });

        // Thru Chain (Array of objects with specific keys)
        if (Array.isArray(rawData.thruChain)) {
            cleanData.thruChain = rawData.thruChain.map(item => ({
                id: Date.now() + Math.random(), // Regen IDs to avoid collisions
                name: typeof item.name === 'string' ? item.name : '',
                rank: typeof item.rank === 'string' ? item.rank : '',
                position: typeof item.position === 'string' ? item.position : ''
            }));
        } else {
            cleanData.thruChain = [];
        }

        // Body (Array of objects with text/indent)
        if (Array.isArray(rawData.body)) {
            cleanData.body = rawData.body.map(item => ({
                text: typeof item.text === 'string' ? item.text : '',
                indent: (typeof item.indent === 'number' && item.indent >= 0 && item.indent <= 6) ? item.indent : 0
            }));
        } else {
            throw new Error('Invalid body format');
        }

        // Options (Boolean flags)
        cleanData.opts = {
            refs: !!rawData.opts?.refs,
            encl: !!rawData.opts?.encl,
            dist: !!rawData.opts?.dist,
            copy: !!rawData.opts?.copy,
            bcc: !!rawData.opts?.bcc
        };

        // Import as new memo
        const newId = 'memo-' + Date.now();
        const importedMemo = { ...cleanData, id: newId };

        const memos = getSavedMemos();
        memos.unshift(importedMemo);
        saveMemos(memos);

        // Load it
        state.currentMemoId = newId;
        localStorage.setItem('memocraft-active-id', newId);
        setMemoData(importedMemo);
        renderMemoList();

        // Signal update
        document.dispatchEvent(new CustomEvent('memo-loaded'));
        alert('Memo imported successfully');

    } catch (err) {
        console.error('Import error:', err);
        alert('Error importing memo: ' + err.message);
    }
}

export function importMemo(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const rawData = JSON.parse(e.target.result);
            processImportedData(rawData);
        } catch (err) {
            console.error('File parsing error:', err);
            alert('Error parsing JSON file: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// ============================================
// HELPER EXPORTS
// ============================================
export function getUnitInfo() {
    return v('headerUnit') || "Superintendent\nU. S. Coast Guard Academy";
}

export function getContactBase() {
    return v('headerAddress') || "15 Mohegan Ave.\nNew London, CT 06320";
}
