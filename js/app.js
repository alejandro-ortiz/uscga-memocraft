/**
 * Application Entry Point for MemoCraft
 */

import { state } from './state.js';
import { v, normalizeEmail } from './utils.js';
import { toggleSidebar, newMemo, saveMemo, renderMemoList, loadMemo, deleteMemo, toggleOpt, exportMemo, importMemo, processImportedData } from './memo-storage.js';
import { renderMemoLines, addMemoLine, shiftIndent, handleLineKey, autoGrow, addThru, updateThru, removeThru, updateLineText, removeLine, renderThru, toggleBullet } from './memo-editor.js';
import { updatePreview } from './preview.js';
import { handleDownload, handlePdfDownload } from './download-handler.js';


// ============================================
// RESPONSIVE SCALING
// ============================================
// Scale the preview based on available width.
window.currentScale = 0.75;
const PG_W = 816, PG_H = 1056;

function updateScale() {
    const container = document.getElementById('previewSide');
    if (!container) return;
    const availWidth = container.clientWidth - 48;
    window.currentScale = Math.min(1, availWidth / PG_W);

    // Updates sizer elements directly
    document.querySelectorAll('.page-sizer').forEach(sizer => {
        sizer.style.width = Math.round(PG_W * window.currentScale) + 'px';
        sizer.style.height = Math.round(PG_H * window.currentScale) + 'px';
        const pg = sizer.querySelector('.paper-page');
        if (pg) pg.style.transform = `scale(${window.currentScale})`;
    });
}

// ============================================
// EVENT WIRING
// ============================================
function setupEventListeners() {
    // Sidebar
    document.querySelector('.sidebar-close')?.addEventListener('click', toggleSidebar);
    document.querySelector('.topbar-toggle')?.addEventListener('click', toggleSidebar);
    document.getElementById('sidebarBackdrop')?.addEventListener('click', toggleSidebar);
    document.querySelector('.sidebar-new')?.addEventListener('click', newMemo);

    // Mobile Form | Preview view switch
    document.querySelectorAll('.mobile-tabs .mtab').forEach(tab => {
        tab.addEventListener('click', () => {
            const showPreview = tab.dataset.view === 'preview';
            document.getElementById('split')?.classList.toggle('show-preview', showPreview);
            document.querySelectorAll('.mobile-tabs .mtab').forEach(t =>
                t.classList.toggle('active', t === tab));
            // Preview was display:none until now, so rescale once it's laid out.
            if (showPreview) requestAnimationFrame(updateScale);
        });
    });

    // Import/Export
    document.getElementById('exportBtn')?.addEventListener('click', exportMemo);

    const importDropdown = document.getElementById('importDropdown');
    const importBtn = document.getElementById('importBtn');
    const importUploadBtn = document.getElementById('importUploadBtn');
    const importPasteBtn = document.getElementById('importPasteBtn');
    const importFile = document.getElementById('importFile');
    const pasteJsonOverlay = document.getElementById('pasteJsonOverlay');
    const pasteJsonClose = document.getElementById('pasteJsonClose');
    const loadPastedJsonBtn = document.getElementById('loadPastedJsonBtn');
    const pasteJsonTextarea = document.getElementById('pasteJsonTextarea');

    if (importBtn && importDropdown) {
        importBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            importDropdown.classList.toggle('show');
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!importDropdown.contains(e.target)) {
                importDropdown.classList.remove('show');
            }
        });
    }

    if (importUploadBtn && importFile) {
        importUploadBtn.addEventListener('click', () => {
            importFile.click();
            importDropdown.classList.remove('show');
        });

        importFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                importMemo(e.target.files[0]);
                e.target.value = ''; // Reset for next selection
            }
        });
    }

    if (importPasteBtn) {
        importPasteBtn.addEventListener('click', () => {
            pasteJsonOverlay.classList.add('open');
            importDropdown.classList.remove('show');
            pasteJsonTextarea.value = ''; // Clear previous content
            pasteJsonTextarea.focus();
        });
    }

    if (pasteJsonClose) {
        pasteJsonClose.addEventListener('click', () => {
            pasteJsonOverlay.classList.remove('open');
        });
    }

    if (pasteJsonOverlay) {
        pasteJsonOverlay.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
        });
    }

    if (loadPastedJsonBtn && pasteJsonTextarea) {
        loadPastedJsonBtn.addEventListener('click', () => {
            try {
                const jsonText = pasteJsonTextarea.value;
                if (!jsonText.trim()) {
                    alert('Please paste some JSON data.');
                    return;
                }
                const rawData = JSON.parse(jsonText);
                processImportedData(rawData);
                pasteJsonOverlay.classList.remove('open');
            } catch (e) {
                alert('Invalid JSON: ' + e.message);
            }
        });
    }

    // Topbar Actions
    document.querySelector('.topbar-save')?.addEventListener('click', saveMemo);
    document.getElementById('generateWordBtn')?.addEventListener('click', handleDownload);
    document.getElementById('generatePdfBtn')?.addEventListener('click', handlePdfDownload);
    document.getElementById('generateWordBtnBottom')?.addEventListener('click', handleDownload);
    document.getElementById('generatePdfBtnBottom')?.addEventListener('click', handlePdfDownload);

    // Credits
    document.querySelector('.topbar-credits')?.addEventListener('click', () => {
        document.getElementById('creditsOverlay').classList.add('open');
    });
    document.querySelector('.credits-close')?.addEventListener('click', () => {
        document.getElementById('creditsOverlay').classList.remove('open');
    });
    document.getElementById('creditsOverlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });

    // Help
    document.querySelector('.topbar-help')?.addEventListener('click', () => {
        document.getElementById('helpOverlay').classList.add('open');
    });
    document.getElementById('helpClose')?.addEventListener('click', () => {
        document.getElementById('helpOverlay').classList.remove('open');
    });
    document.getElementById('helpOverlay')?.addEventListener('click', (e) => {
        if (e.target === e.currentTarget) e.currentTarget.classList.remove('open');
    });

    // Editor Actions (Delegation)
    document.getElementById('memoLines')?.addEventListener('input', (e) => {
        if (e.target.matches('.li')) {
            const idx = parseInt(e.target.closest('.ed-line').dataset.index);
            updateLineText(idx, e.target.value);
            autoGrow(e.target);
        }
    });

    document.getElementById('memoLines')?.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="remove-line"]')) {
            const idx = parseInt(e.target.closest('[data-action="remove-line"]').dataset.index);
            removeLine(idx);
        }
    });

    document.getElementById('memoLines')?.addEventListener('keydown', (e) => {
        if (e.target.matches('.li')) {
            const idx = parseInt(e.target.closest('.ed-line').dataset.index);
            handleLineKey(e, idx);
        }
    });

    document.getElementById('memoLines')?.addEventListener('focusin', (e) => {
        if (e.target.matches('.li')) {
            const idx = parseInt(e.target.closest('.ed-line').dataset.index);
            state.focusedLineIdx = idx;
        }
    });

    // Thru Chain (Delegation)
    document.getElementById('thruContainer')?.addEventListener('input', (e) => {
        const entry = e.target.closest('.person-entry');
        if (entry && e.target.dataset.field) {
            const idx = parseInt(entry.dataset.index);
            updateThru(idx, e.target.dataset.field, e.target.value);
        }
    });

    document.getElementById('thruContainer')?.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="remove-thru"]')) {
            const id = parseInt(e.target.closest('[data-action="remove-thru"]').dataset.id);
            removeThru(id);
        }
    });

    document.querySelector('.add-btn')?.addEventListener('click', addThru);

    // Editor Toolbar
    // Editor Toolbar
    const toolbar = document.querySelector('.editor-toolbar');
    if (toolbar) {
        const buttons = toolbar.querySelectorAll('button');
        if (buttons[0]) buttons[0].addEventListener('click', addMemoLine);
        if (buttons[1]) buttons[1].addEventListener('click', () => shiftIndent(1));
        if (buttons[2]) buttons[2].addEventListener('click', () => shiftIndent(-1));
        if (buttons[3]) buttons[3].addEventListener('click', toggleBullet);
    }

    // Memo List (Delegation)
    document.getElementById('memoList')?.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('[data-action="delete"]');
        if (deleteBtn) {
            e.stopPropagation();
            deleteMemo(deleteBtn.dataset.id);
            return;
        }

        const item = e.target.closest('.memo-list-item');
        if (item) {
            loadMemo(item.dataset.id);
        }
    });

    // Optional Sections Toggles
    ['refs', 'encl', 'dist', 'copy', 'bcc'].forEach(key => {
        // Find element that previously had onclick="toggleOpt('key')"
        const check = document.getElementById(key + 'Check');
        if (check) {
            const toggleDiv = check.closest('.opt-toggle');
            toggleDiv?.addEventListener('click', () => toggleOpt(key));
        }
    });

    // Live Preview Inputs (Generic Listener)
    const previewInputs = [
        'headerUnit', 'headerAddress', 'contactPhone', 'contactEmail',
        'ssic', 'memoDate', 'from-name', 'from-rank', 'from-position',
        'to-name', 'to-rank', 'to-position', 'subject',
        'references', 'enclosures', 'dist', 'copyTo', 'blindCopy'
    ];
    previewInputs.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', updatePreview);
            // Auto grow for textareas
            if (el.tagName === 'TEXTAREA') {
                el.addEventListener('input', (e) => autoGrow(e.target));
            }
        }
    });

    // Tidy the email casing when the user leaves the field (firstname.m.lastname).
    const emailEl = document.getElementById('contactEmail');
    emailEl?.addEventListener('blur', () => {
        const fixed = normalizeEmail(emailEl.value);
        if (fixed !== emailEl.value) { emailEl.value = fixed; updatePreview(); }
    });

    // Fold Arrows
    // Header Info fold
    document.querySelector('.section-label')?.addEventListener('click', function () {
        const body = document.getElementById('headerInfoBody');
        body.classList.toggle('show');
        const arrow = this.querySelector('.fold-arrow');
        if (arrow) arrow.textContent = body.classList.contains('show') ? '▾' : '▸';
    });
}

// ============================================
// INITIALIZATION
// ============================================
// Run init now if the DOM is already parsed (this module is injected
// dynamically by the cache-busting loader, so it may load after DOMContentLoaded
// has already fired), otherwise wait for it.
const __domReady = (fn) => (document.readyState === 'loading')
    ? document.addEventListener('DOMContentLoaded', fn)
    : fn();
__domReady(function () {

    // Hidden measurement container for pagination
    const _mb = document.createElement('div');
    _mb.id = 'measureBox';
    _mb.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;overflow:hidden;font-family:"Times New Roman",serif;font-size:12pt;';
    document.body.appendChild(_mb);

    // On phones the sidebar is an overlay drawer — start it closed.
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar')?.classList.add('collapsed');
    }

    // Observe preview container for responsive scaling
    const _ps = document.getElementById('previewSide');
    if (_ps) new ResizeObserver(() => updateScale()).observe(_ps);
    updateScale();
    window.addEventListener('resize', updateScale);

    // Pre-populate date if empty
    const dateEl = document.getElementById('memoDate');
    if (dateEl && !dateEl.value) {
        dateEl.value = new Date().toISOString().split('T')[0];
    }

    // Setup Event Listeners
    setupEventListeners();

    // Listen for custom events from other modules
    document.addEventListener('memo-reset', () => {
        renderMemoLines();
        renderThru();
        updatePreview();
        // Reset autoGrow fields
        document.querySelectorAll('textarea').forEach(autoGrow);
    });
    document.addEventListener('memo-loaded', () => {
        renderMemoLines();
        renderThru();
        updatePreview();
        // Update autoGrow fields
        document.querySelectorAll('textarea').forEach(autoGrow);
    });
    
    document.addEventListener('autosave', () => saveMemo(true));

    // Initial renders
    renderMemoLines();
    renderMemoList(); // Initial empty/loading state

    // Restore active memo if available
    const activeId = localStorage.getItem('memocraft-active-id');
    if (activeId) {
        loadMemo(activeId);
    }

    updatePreview();
});
