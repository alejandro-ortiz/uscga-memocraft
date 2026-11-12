/**
 * Shared application state.
 */

export const state = {
    currentMemoId: null,
    thruChain: [],
    memoBodyLines: [{ text: '', indent: 0 }],
    focusedLineIdx: 0,
    opts: { refs: false, encl: false, dist: false, copy: false, bcc: false }
};

export function resetState() {
    state.currentMemoId = null;
    state.thruChain = [];
    state.memoBodyLines = [{ text: '', indent: 0 }];
    state.focusedLineIdx = 0;
    state.opts = { refs: false, encl: false, dist: false, copy: false, bcc: false };
}
