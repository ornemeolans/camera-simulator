/**
 * storageService
 * ---------------
 * Capa de persistencia de la app. Guarda y lee TRES cosas:
 *   - "captures": las fotos que se van tomando (galería).
 *   - "presets": combinaciones de ajustes guardadas con un nombre.
 *   - "attempts": historial de intentos de desafíos (progreso).
 *
 * Por qué una capa separada en vez de llamar a Firestore/localStorage
 * directo desde los componentes: así el resto de la app sólo pide "guardame
 * esto" / "dame la lista", sin saber CÓMO se guardan los datos. Eso permite
 * tener Firestore como backend real con un respaldo automático en
 * localStorage cuando no hay proyecto configurado, o no se pudo iniciar
 * sesión (ver firebase.js) — la UI llama siempre a las mismas funciones.
 *
 * Datos por usuario: en Firestore todo vive bajo `users/<uid>/<colección>`,
 * donde <uid> es el de la sesión anónima del navegador. Las reglas
 * (firestore.rules) sólo dejan acceder a la propia carpeta. Usar una
 * subcolección por usuario (en vez de un campo `uid` + `where`) evita además
 * tener que crear un índice compuesto en la consola.
 *
 * Todas las funciones son async: Firestore lo es por naturaleza, y el SDK se
 * importa de forma perezosa — así que incluso el camino de localStorage
 * queda async, y cambiar de backend no obliga a tocar a quien las llama.
 */
import { getFirebase, type FirebaseHandle } from '../firebase'
import type { CollectionName, StoredItem } from '../types'

// Topes por colección. Las capturas son las más pesadas (una imagen cada
// una): sin tope, localStorage (~5MB) se llenaría rápido.
const LIMITS: Record<CollectionName, number> = { captures: 12, presets: 50, attempts: 100 }

const LOCAL_KEYS: Record<CollectionName, string> = {
  captures: 'camera-simulator:captures',
  presets: 'camera-simulator:presets',
  attempts: 'camera-simulator:attempts',
}

/** 'firestore' si hay proyecto configurado Y la sesión anónima funcionó; si no, 'localStorage'. */
export async function getBackendName(): Promise<'firestore' | 'localStorage'> {
  return (await getFirebase()) ? 'firestore' : 'localStorage'
}

function readLocal(name: CollectionName): StoredItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEYS[name])
    return raw ? JSON.parse(raw) : []
  } catch {
    // localStorage lleno, deshabilitado, JSON corrupto: mejor lista vacía que romper la app.
    return []
  }
}

function writeLocal(name: CollectionName, list: StoredItem[]): void {
  try {
    localStorage.setItem(LOCAL_KEYS[name], JSON.stringify(list))
  } catch {
    // Cuota llena: la próxima lectura devuelve lo último que sí entró.
  }
}

const userCollection = ({ db, fs, uid }: FirebaseHandle, name: CollectionName) => fs.collection(db, 'users', uid, name)

async function list(name: CollectionName): Promise<StoredItem[]> {
  const firebase = await getFirebase()
  if (firebase) {
    const { fs } = firebase
    const q = fs.query(userCollection(firebase, name), fs.orderBy('createdAt', 'desc'), fs.limit(LIMITS[name]))
    const snap = await fs.getDocs(q)
    return snap.docs.map((d) => ({ ...d.data(), id: d.id }) as StoredItem)
  }
  return readLocal(name)
}

async function save(name: CollectionName, item: Record<string, unknown>): Promise<StoredItem> {
  const entry = { ...item, createdAt: Date.now() }
  const firebase = await getFirebase()

  if (firebase) {
    const ref = await firebase.fs.addDoc(userCollection(firebase, name), entry)
    await pruneOldest(firebase, name)
    return { ...entry, id: ref.id }
  }

  const withId: StoredItem = { ...entry, id: `local-${entry.createdAt}-${Math.random().toString(36).slice(2, 8)}` }
  // Más nuevo primero, recortado al tope para no acumular para siempre.
  writeLocal(name, [withId, ...readLocal(name)].slice(0, LIMITS[name]))
  return withId
}

async function remove(name: CollectionName, id: string): Promise<void> {
  const firebase = await getFirebase()
  if (firebase) {
    await firebase.fs.deleteDoc(firebase.fs.doc(firebase.db, 'users', firebase.uid, name, id))
    return
  }
  writeLocal(name, readLocal(name).filter((x) => x.id !== id))
}

// Firestore no tiene un "slice" automático como el array de localStorage:
// al pasarnos del tope borramos los más viejos por nuestra cuenta (simple y
// suficiente para este volumen; no hace falta una Cloud Function).
async function pruneOldest(firebase: FirebaseHandle, name: CollectionName): Promise<void> {
  const { fs } = firebase
  const snap = await fs.getDocs(fs.query(userCollection(firebase, name), fs.orderBy('createdAt', 'desc')))
  const extra = snap.docs.slice(LIMITS[name])
  await Promise.all(extra.map((d) => fs.deleteDoc(d.ref)))
}

export const listCaptures = () => list('captures')
export const saveCapture = (capture: Record<string, unknown>) => save('captures', capture)
export const deleteCapture = (id: string) => remove('captures', id)

export const listPresets = () => list('presets')
export const savePreset = (preset: Record<string, unknown>) => save('presets', preset)
export const deletePreset = (id: string) => remove('presets', id)

export const listAttempts = () => list('attempts')
export const saveAttempt = (attempt: Record<string, unknown>) => save('attempts', attempt)
