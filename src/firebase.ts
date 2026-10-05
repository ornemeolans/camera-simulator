/**
 * firebase
 * --------
 * Inicialización OPCIONAL y PEREZOSA de Firebase/Firestore como backend
 * "real" de persistencia. La app funciona perfectamente sin esto: si no
 * hay configuración de Firebase, nunca se descarga el SDK de Firebase y
 * storageService.js usa localStorage como respaldo con la MISMA forma de
 * datos — así que activar Firebase más adelante no rompe nada ni pierde
 * capturas/presets viejos (simplemente no los migra automáticamente de un
 * lado al otro).
 *
 * Es "perezosa" (lazy) a propósito: el SDK de Firebase pesa varios cientos
 * de KB. La gran mayoría de quienes prueben este simulador NO van a tener
 * un proyecto de Firebase configurado, así que no tiene sentido que
 * descarguen ese código si nunca se va a usar — por eso el import real
 * (`import('firebase/app')`) pasa adentro de getFirebase(), no al principio del
 * archivo, y sólo se ejecuta la primera vez que de verdad hace falta.
 *
 * Para activar el backend real hace falta crear un proyecto gratis en
 * https://console.firebase.google.com, habilitar Firestore y la
 * autenticación Anónima (Authentication → Método de acceso), y copiar las
 * credenciales del proyecto a un archivo `.env` en la raíz (NO se sube al
 * repo, ver .gitignore) con estas variables (todas con el prefijo VITE_
 * porque Vite sólo expone al navegador las variables que empiezan así):
 *
 *   VITE_FIREBASE_API_KEY=...
 *   VITE_FIREBASE_AUTH_DOMAIN=...
 *   VITE_FIREBASE_PROJECT_ID=...
 *   VITE_FIREBASE_APP_ID=...
 *
 * Sin ese archivo .env, todas quedan `undefined`, isFirebaseConfigured
 * queda en false, y nunca se llama a getFirebase() — nos vamos directo al modo
 * localStorage sin descargar ni un byte del SDK de Firebase.
 */
import type { Firestore } from 'firebase/firestore'

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Sólo intentamos conectar a Firestore si están las tres variables
// imprescindibles. apiKey/appId son necesarias para inicializar pero
// projectId es la que realmente define a qué base de datos hablamos.
export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId)

/** Lo que devuelve getFirebase(): Firestore, su módulo y el uid de la sesión anónima. */
export interface FirebaseHandle {
  db: Firestore
  fs: typeof import('firebase/firestore')
  uid: string
}

let initPromise: Promise<FirebaseHandle | null> | null = null

/**
 * Devuelve `{ db, fs, uid }` (instancia de Firestore, el módulo completo de
 * `firebase/firestore` y el id del usuario anónimo), inicializando todo
 * —y descargando el SDK— recién la primera vez que se llama. Devuelve
 * `null` si no hay config real o si algo falla (proyecto inexistente, typo,
 * proveedor "Anónimo" sin habilitar en la consola, etc.) — en cualquiera de
 * esos casos storageService.js cae a localStorage en vez de romper la app.
 *
 * Por qué sesión ANÓNIMA: antes cualquiera con la URL podía leer y escribir
 * todos los datos (reglas abiertas). Con Authentication anónima cada
 * navegador obtiene un `uid` propio sin pedir registro, y las reglas de
 * Firestore (ver firestore.rules) sólo dejan leer/escribir lo que está bajo
 * `users/<uid>/` — cada visitante ve únicamente lo suyo.
 */
export function getFirebase(): Promise<FirebaseHandle | null> {
  if (!isFirebaseConfigured) return Promise.resolve(null)
  if (!initPromise) {
    initPromise = Promise.all([import('firebase/app'), import('firebase/firestore'), import('firebase/auth')])
      .then(async ([{ initializeApp }, fs, authSdk]) => {
        const app = initializeApp(config)
        const credential = await authSdk.signInAnonymously(authSdk.getAuth(app))
        return { db: fs.getFirestore(app), fs, uid: credential.user.uid }
      })
      .catch((err) => {
        console.warn('[firebase] No se pudo iniciar sesión/Firestore, usando localStorage como respaldo:', err)
        return null
      })
  }
  return initPromise
}
