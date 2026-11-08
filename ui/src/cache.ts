// The last answer for each view, so coming back to KiPo shows it at once and
// refreshes in the background instead of waiting on GitHub with a blank page.
//
// The dashboard unmounts an app's page when you switch away, but keeps its module
// loaded, so the in-memory map survives the round trip. localStorage covers a full
// reload. Every cached value is replaced by the next real answer.

// Bump the version whenever a cached shape changes: an old shape rendered by new
// code crashes the page before the fresh answer arrives.
const PREFIX = 'kipo.cache.v2:'
try {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)
    if (k && k.startsWith('kipo.cache.') && !k.startsWith(PREFIX)) localStorage.removeItem(k)
  }
} catch { /* storage blocked: nothing to clean */ }
const mem = new Map<string, unknown>()

export function cached<T>(key: string): T | null {
  if (mem.has(key)) return mem.get(key) as T
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw == null) return null
    const value = JSON.parse(raw) as T
    mem.set(key, value)
    return value
  } catch {
    return null
  }
}

export function remember<T>(key: string, value: T): void {
  mem.set(key, value)
  try { localStorage.setItem(PREFIX + key, JSON.stringify(value)) } catch { /* full or blocked: memory still has it */ }
}

export function forget(key: string): void {
  mem.delete(key)
  try { localStorage.removeItem(PREFIX + key) } catch { /* ignore */ }
}
