// Persistance sans serveur. Trois backends interchangeables derrière la même interface :
//  - « claude »  : base de l'artefact claude.ai (privée par utilisateur, synchronisée entre appareils)
//  - « device »  : IndexedDB du navigateur (PWA installée, 100 % hors ligne)
//  - « memory »  : secours si rien d'autre n'est disponible (rien n'est conservé)
// Les données sont rangées par « seaux » (ex. workouts-2026-11) pour limiter le nombre de documents.

export type Bucket = Record<string, unknown>

export interface Store {
  kind: 'claude' | 'device' | 'memory'
  label: string
  loadAll(): Promise<Record<string, Bucket>>
  put(key: string, value: Bucket): Promise<void>
  remove(key: string): Promise<void>
}

const withTimeout = <T,>(p: Promise<T>, ms: number, msg: string) =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg)), ms)
    p.then((v) => { clearTimeout(t); resolve(v) }, (e) => { clearTimeout(t); reject(e) })
  })

const errMsg = (e: unknown) =>
  e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)

// ------------------------------------------------------------------ Claude (artefact)
interface DocSnap { id: string; data(): Record<string, unknown> | undefined }
interface ClaudeDb {
  collection(path: string): {
    limit(n: number): { get(): Promise<{ docs: DocSnap[] }> }
    doc(id: string): { set(d: Record<string, unknown>): Promise<void>; delete(): Promise<void> }
  }
}
interface ClaudeUser { id(): Promise<string | null> }
type ClaudeGlobal = { use(name: string): Promise<unknown> }

const claudeGlobal = (): ClaudeGlobal | null => {
  const c = (window as unknown as { claude?: ClaudeGlobal }).claude
  return c && typeof c.use === 'function' ? c : null
}

export const insideClaudeArtifact = () => claudeGlobal() !== null

async function claudeStore(): Promise<Store | null> {
  const c = claudeGlobal()
  if (!c) return null
  const [db, user] = (await Promise.all([c.use('db'), c.use('user')])) as [ClaudeDb | null, ClaudeUser | null]
  if (!db || !user) return null
  const uid = await user.id()
  if (!uid) return null
  const col = db.collection(`data/users/${uid}`)
  // Une écriture à la fois par document : on chaîne les écritures par clé.
  const queues = new Map<string, Promise<void>>()
  const enqueue = (key: string, fn: () => Promise<void>) => {
    const run = (queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(fn)
    queues.set(key, run)
    return run
  }
  const retry = async (fn: () => Promise<void>) => {
    try { await fn() } catch (e) {
      if ((e as { code?: string })?.code !== 'unavailable') throw new Error(errMsg(e))
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 600))
      await fn()
    }
  }
  return {
    kind: 'claude',
    label: 'Synchronisé avec ton compte Claude (téléphone et ordinateur)',
    async loadAll() {
      const snap = await withTimeout(col.limit(1000).get(), 12000, 'Base injoignable (connexion ?)')
      const out: Record<string, Bucket> = {}
      for (const d of snap.docs) out[d.id] = structuredClone(d.data() ?? {}) as Bucket
      return out
    },
    put: (key, value) => enqueue(key, () => retry(() => col.doc(key).set(value))),
    remove: (key) => enqueue(key, () => retry(() => col.doc(key).delete())),
  }
}

// ------------------------------------------------------------------ IndexedDB
function idbStore(): Promise<Store | null> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest
    try { req = indexedDB.open('footprog', 1) } catch { resolve(null); return }
    req.onupgradeneeded = () => req.result.createObjectStore('buckets')
    req.onerror = () => resolve(null)
    req.onsuccess = () => {
      const db = req.result
      const tx = <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
        new Promise<T>((res, rej) => {
          const r = fn(db.transaction('buckets', mode).objectStore('buckets'))
          r.onsuccess = () => res(r.result)
          r.onerror = () => rej(r.error)
        })
      void navigator.storage?.persist?.().catch(() => undefined)
      resolve({
        kind: 'device',
        label: 'Stocké sur cet appareil (hors ligne)',
        async loadAll() {
          const [keys, values] = await Promise.all([tx('readonly', (s) => s.getAllKeys()), tx('readonly', (s) => s.getAll())])
          return Object.fromEntries(keys.map((k, i) => [String(k), values[i] as Bucket]))
        },
        put: async (key, value) => { await tx('readwrite', (s) => s.put(value, key)) },
        remove: async (key) => { await tx('readwrite', (s) => s.delete(key)) },
      })
    }
  })
}

function memoryStore(): Store {
  const m = new Map<string, Bucket>()
  return {
    kind: 'memory',
    label: 'Mémoire temporaire — rien n’est conservé à la fermeture',
    loadAll: async () => Object.fromEntries(m),
    put: async (k, v) => { m.set(k, v) },
    remove: async (k) => { m.delete(k) },
  }
}

export async function pickStore(): Promise<Store> {
  if (insideClaudeArtifact()) {
    const s = await claudeStore().catch(() => null)
    if (s) return s
  }
  return (await idbStore()) ?? memoryStore()
}
