/**
 * Tipos compartidos del dominio. Viven en un solo archivo para que el
 * simulador, el tutor, los desafíos y la persistencia hablen exactamente los
 * mismos "idiomas" — si un campo cambia acá, `tsc --noEmit` (npm run
 * typecheck) marca todos los lugares que quedaron desactualizados.
 */

export type ModeId = 'M' | 'A' | 'S' | 'AUTO'

/** Capa de color con mezcla 'overlay' sobre toda la escena (ver Viewfinder). */
export interface Tint {
  color: string // '#rrggbb'
  alpha: number // 0..1
}

export interface Scene {
  id: string
  label: string
  lightLabel: string
  /** Pasos de luz respecto de un día soleado (negativo = menos luz). */
  lightStops: number
  /** Ids de balance de blancos que corrigen bien la luz de esta escena. */
  correctWb: string[]
  /** Tinte propio de la luz de la escena. */
  cast: Tint | null
  /** Lo que hace el balance AUTO en esta escena (cancelar `cast`). */
  autoTint: Tint | null
  sun: boolean
  night?: boolean
  remotePhotoUrl?: string
  palette?: {
    skyTop: string
    skyBottom: string
    ridge: [string, string]
    groundTop: string
    groundBottom: string
  }
}

/** Una toma tal como la ve el tutor: los ajustes EFECTIVOS y el encuadre. */
export interface Shot {
  shutterSeconds: number
  apertureValue: number
  isoValue: number
  /** EV final de la toma (incluye la luz de la escena). 0 = exposición neutra. */
  exposureStops: number
  wbId: string
  /** Posición del sujeto en el cuadro, fracciones 0..1 (puede salirse un poco al entrar/salir). */
  subjectFrac?: { x: number; y: number }
}

export interface TutorFix {
  problema: string
  correccion: string
}

export interface TutorResult {
  bien: string[]
  mal: TutorFix[]
  /** 0..100: porcentaje de categorías evaluadas que salieron bien. */
  score: number
}

export interface ChallengeCriterionResult {
  id: string
  label: string
  ok: boolean
}

export interface ChallengeResult {
  challengeId: string
  title: string
  score: number
  passed: boolean
  results: ChallengeCriterionResult[]
}

export type CollectionName = 'captures' | 'presets' | 'attempts'

/** Cualquier documento persistido: lo que se guardó + el id y la fecha que agrega storageService. */
export type StoredItem = Record<string, unknown> & { id: string; createdAt: number }
