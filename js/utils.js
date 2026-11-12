/**
 * Utility functions.
 */

// Get trimmed input value.
export function v(id) {
    return (document.getElementById(id)?.value || '').trim();
}

// Escape HTML.
export function esc(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
}

// Convert to Roman numerals.
export function toRoman(num) {
    const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    for (let i = 0; i < vals.length; i++) {
        while (num >= vals[i]) {
            result += syms[i];
            num -= vals[i];
        }
    }
    return result;
}

// Normalize a USCG(A) email so each part of the name in the local part is
// title-cased, per the standard firstname.middleinitial.lastname@uscga.edu
// (or @uscg.mil). e.g. "alejandro.m.ORTIZ@USCGA.EDU" -> "Alejandro.M.Ortiz@uscga.edu".
// The domain is lowercased; hyphenated name parts are title-cased on each side.
export function normalizeEmail(email) {
    const s = String(email || '').trim();
    if (!s) return s;
    const at = s.indexOf('@');
    const local = at === -1 ? s : s.slice(0, at);
    const domain = at === -1 ? '' : s.slice(at);   // includes the "@"
    const tc = p => p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : p;
    const newLocal = local.split('.')
        .map(part => part.split('-').map(tc).join('-'))
        .join('.');
    return newLocal + domain.toLowerCase();
}

// Bullet glyph for a bulleted subparagraph (manual allows a "simple bullet
// symbol" for subparagraphs). Uniform "•" at every level for consistency.
export function bulletGlyph(_level) {
    return '•';
}

// Spreadsheet-style lowercase letters for reference labels: 0->a … 25->z, 26->aa …
function refLetter(i) {
    let s = '';
    do { s = String.fromCharCode(97 + (i % 26)) + s; i = Math.floor(i / 26) - 1; } while (i >= 0);
    return s;
}

/**
 * Auto-label reference / enclosure lines so they are always sequential and
 * correctly formatted, regardless of what (if anything) the user typed as a
 * label. One entry per line; blank lines are dropped.
 *   kind 'ref'  -> (a) (b) (c) …   kind 'encl' -> (1) (2) (3) …
 * Any leading label the user typed — "(a)", "a.", "1)", "(1)" etc. — is stripped
 * first so we never double-label.
 */
export function autoLabel(text, kind) {
    const lines = String(text || '').split('\n').map(l => l.trim()).filter(Boolean);
    return lines.map((line, i) => {
        const body = line.replace(/^[\(\[]?[A-Za-z0-9]{1,3}[\)\].:]\s+/, '').trim();
        const label = kind === 'ref' ? `(${refLetter(i)})` : `(${i + 1})`;
        return `${label} ${body}`;
    }).join('\n');
}

// Format date (e.g., "1 Jan 2024").
export function fmtDate(d) {
    if (!d) return '';
    const dt = new Date(d + 'T00:00:00');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${dt.getDate()} ${months[dt.getMonth()]} ${dt.getFullYear()}`;
}
