const KEY = 'sshp_draft'
export const saveDraft = (d) => { try { localStorage.setItem(KEY, JSON.stringify({ ...d, _ts: Date.now() })) } catch {} }
export const loadDraft = () => { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null } catch { return null } }
export const clearDraft = () => localStorage.removeItem(KEY)
