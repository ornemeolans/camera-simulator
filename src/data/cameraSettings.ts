/**
 * cameraSettings
 * --------------
 * Los "datos" de la cámara: qué modos existen, qué valores puede tomar
 * cada parámetro, y qué parámetros controla la persona en cada modo (en
 * una réflex real, en prioridad de apertura vos elegís el diafragma y la
 * cámara calcula la velocidad de obturación sola, y viceversa en
 * prioridad de obturación).
 *
 * Separar esto en su propio archivo (en vez de tenerlo mezclado en el
 * componente) hace que sea fácil de ajustar sin tocar la lógica de UI, y
 * es el mismo archivo que después va a alimentar el resto de la cámara
 * (lentes, balance de blancos, etc.).
 */
import type { ModeId } from '../types'

/** Los tres índices (dentro de SHUTTER_SPEEDS / APERTURES / ISOS) que definen una exposición. */
export interface ExposureIndices {
  shutterIndex: number
  apertureIndex: number
  isoIndex: number
}


export const MODES = [
  { id: 'M', label: 'M', name: 'Manual' },
  { id: 'A', label: 'A', name: 'Prioridad de apertura' },
  { id: 'S', label: 'S', name: 'Prioridad de obturación' },
  { id: 'AUTO', label: 'AUTO', name: 'Automático' },
]

// Velocidades de obturación típicas de una Nikon D7200, de más rápida a
// más lenta. `seconds` es el valor real en segundos — lo que en realidad
// usamos para calcular el desenfoque de movimiento.
export const SHUTTER_SPEEDS = [
  { label: '1/2000', seconds: 1 / 2000 },
  { label: '1/1000', seconds: 1 / 1000 },
  { label: '1/500', seconds: 1 / 500 },
  { label: '1/250', seconds: 1 / 250 },
  { label: '1/125', seconds: 1 / 125 },
  { label: '1/60', seconds: 1 / 60 },
  { label: '1/30', seconds: 1 / 30 },
  { label: '1/15', seconds: 1 / 15 },
  { label: '1/8', seconds: 1 / 8 },
  { label: '1/4', seconds: 1 / 4 },
  { label: '1/2', seconds: 1 / 2 },
  { label: '1"', seconds: 1 },
]

export const APERTURES = [
  { label: 'f/1.8', value: 1.8 },
  { label: 'f/2.8', value: 2.8 },
  { label: 'f/4', value: 4 },
  { label: 'f/5.6', value: 5.6 },
  { label: 'f/8', value: 8 },
  { label: 'f/11', value: 11 },
  { label: 'f/16', value: 16 },
  { label: 'f/22', value: 22 },
]

export const ISOS = [
  { label: '100', value: 100 },
  { label: '200', value: 200 },
  { label: '400', value: 400 },
  { label: '800', value: 800 },
  { label: '1600', value: 1600 },
  { label: '3200', value: 3200 },
  { label: '6400', value: 6400 },
]

// Distancias focales típicas de un lente de viaje (18-200mm), de gran
// angular a teleobjetivo. A diferencia de obturador/apertura/ISO, esto no
// depende del modo de disparo — es una propiedad del LENTE, no de la
// exposición, así que se puede tocar en cualquier modo (M, A, S o AUTO).
export const FOCAL_LENGTHS = [
  { label: '18mm', mm: 18 },
  { label: '24mm', mm: 24 },
  { label: '35mm', mm: 35 },
  { label: '50mm', mm: 50 },
  { label: '85mm', mm: 85 },
  { label: '105mm', mm: 105 },
  { label: '135mm', mm: 135 },
  { label: '200mm', mm: 200 },
]
export const DEFAULT_FOCAL_INDEX = 3 // 50mm — lente "normal", sin zoom ni gran angular

// Balance de blancos: cada preset representa para qué tipo de luz está
// "corrigiendo" la cámara. En una réflex real, el sensor ve la luz con un
// tinte de color según la fuente (tungsteno = anaranjado, sombra = azulado,
// etc.) y el balance de blancos le dice a la cámara qué tinte restar para
// que el blanco se vea blanco. Acá no simulamos distintas fuentes de luz de
// la ESCENA (la foto base es siempre la misma), así que en cambio mostramos
// directamente el tinte que CADA preset le agrega a la imagen si lo elegís
// — así se ve y se entiende el efecto visual de cada uno igual que en una
// cámara real, aunque la "luz real" de la escena no cambie.
// tintColor/tintAlpha: null = neutro (Automático). Si no, un color y una
// intensidad para una capa de mezcla 'overlay' sobre toda la escena.
export const WHITE_BALANCES = [
  { id: 'auto', label: 'AUTO', name: 'Automático', tintColor: null, tintAlpha: 0 },
  { id: 'daylight', label: 'Día', name: 'Luz de día directa', tintColor: null, tintAlpha: 0 },
  { id: 'cloudy', label: 'Nublado', name: 'Día nublado', tintColor: '#ff9d3a', tintAlpha: 0.10 },
  { id: 'shade', label: 'Sombra', name: 'Sombra', tintColor: '#ff8a3a', tintAlpha: 0.16 },
  { id: 'incandescent', label: 'Tungsteno', name: 'Luz incandescente', tintColor: '#3a6fff', tintAlpha: 0.16 },
  { id: 'fluorescent', label: 'Fluorescente', name: 'Luz fluorescente', tintColor: '#b060ff', tintAlpha: 0.10 },
  { id: 'flash', label: 'Flash', name: 'Flash', tintColor: '#ff7a3a', tintAlpha: 0.08 },
]
export const DEFAULT_WB_INDEX = 0 // Automático
export type WhiteBalance = (typeof WHITE_BALANCES)[number]

// Compensación de exposición: el dial +/- EV que en una réflex real sigue
// existiendo incluso en A/S/AUTO — le dice al fotómetro "meté más o menos
// luz de la que vos calculás como correcta". En M no se usa: ahí ya elegís
// los tres parámetros a mano, no hay fotómetro al que darle una meta
// distinta (igual que en una Nikon real, donde en M el dial de comp. de
// exposición no cambia nada que ya no controles vos).
export const EXPOSURE_COMP_STEPS = [
  { label: '−3 EV', stops: -3 },
  { label: '−2 EV', stops: -2 },
  { label: '−1 EV', stops: -1 },
  { label: '0 EV', stops: 0 },
  { label: '+1 EV', stops: 1 },
  { label: '+2 EV', stops: 2 },
  { label: '+3 EV', stops: 3 },
]
export const DEFAULT_EXPCOMP_INDEX = 3 // 0 EV

export function isExposureCompEditable(mode: ModeId): boolean {
  return mode !== 'M'
}

// 50mm es nuestro punto de referencia ("zoom x1"): cuánto más largo el
// lente respecto de eso, más "acercada" se ve la escena.
const BASE_FOCAL_MM = FOCAL_LENGTHS[DEFAULT_FOCAL_INDEX].mm
export function computeZoomFactor(focalMm: number): number {
  return focalMm / BASE_FOCAL_MM
}

// Índices "por defecto" para cada modo — lo que se ve la primera vez y lo
// que se muestra (sin poder tocarlo) cuando el parámetro pasa a estar en
// automático.
export const DEFAULT_SHUTTER_INDEX = 4 // 1/125
export const DEFAULT_APERTURE_INDEX = 3 // f/5.6
export const DEFAULT_ISO_INDEX = 2 // 400

// En cada modo, ¿qué parámetros elige la persona y cuáles calcula la
// cámara sola? (Igual que en una réflex real.)
export function isShutterEditable(mode: ModeId): boolean {
  return mode === 'M' || mode === 'S'
}

export function isApertureEditable(mode: ModeId): boolean {
  return mode === 'M' || mode === 'A'
}

export function isIsoEditable(mode: ModeId): boolean {
  return mode !== 'AUTO'
}

function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), length - 1)
}

// Fracción logarítmica de "qué tan lenta" es una velocidad de obturación
// dentro del rango de la cámara: 0 = la más rápida (1/2000), 1 = la más
// lenta (1"). Logarítmica porque las velocidades también lo son (de 1/2000
// a 1" cada paso duplica el tiempo, no suma una cantidad fija).
//
// Vive acá (no en Viewfinder.jsx) porque la usan DOS lugares que no deberían
// poder desincronizarse: el visor, para decidir cuánta estela de movimiento
// dibujar, y el tutor de fotografía (photoTutorService.js), para avisar si
// un sujeto en movimiento va a salir con motion blur. Si esta cuenta
// viviera duplicada en los dos archivos, un ajuste futuro en una copia y no
// en la otra haría que el visor y el tutor "opinen" distinto sobre la misma
// foto.
export function shutterSpeedFactor(seconds: number): number {
  const minSeconds = SHUTTER_SPEEDS[0].seconds
  const maxSeconds = SHUTTER_SPEEDS[SHUTTER_SPEEDS.length - 1].seconds
  const clamped = Math.min(Math.max(seconds, minSeconds), maxSeconds)
  return (Math.log(clamped) - Math.log(minSeconds)) / (Math.log(maxSeconds) - Math.log(minSeconds))
}

// Índices "efectivos": cuando un parámetro no es editable en el modo
// actual, la cámara lo calcula sola — fotómetro real, no un valor fijo.
// En A y S vos elegís dos de los tres (apertura+ISO, u obturador+ISO) y
// la cámara resuelve el tercero para que la exposición total dé lo más
// cerca posible de `targetStops` (0 EV por defecto, o lo que pida el dial
// de compensación de exposición — ver EXPOSURE_COMP_STEPS). Si el valor
// que necesitaría no existe en la lista (por ejemplo, pedís f/22 con ISO
// 100 y ni el obturador más lento alcanza a compensar), se clampea al
// extremo disponible — el EV del HUD ya lo muestra como sobre/subexpuesto,
// así que el aviso sale solo, sin lógica extra.
export function effectiveIndices(
  mode: ModeId,
  shutterIndex: number,
  apertureIndex: number,
  isoIndex: number,
  expCompStops = 0,
  sceneLightStops = 0,
): ExposureIndices {
  if (mode === 'A') {
    // Prioridad de apertura: elegís diafragma e ISO, la cámara mete el
    // obturador que compensa ambos (y apunta a expCompStops en vez de 0).
    const apertureStops = DEFAULT_APERTURE_INDEX - apertureIndex
    const isoStops = isoIndex - DEFAULT_ISO_INDEX
    const meteredShutterIndex = clampIndex(
      DEFAULT_SHUTTER_INDEX + expCompStops - apertureStops - isoStops - sceneLightStops,
      SHUTTER_SPEEDS.length,
    )
    return { shutterIndex: meteredShutterIndex, apertureIndex, isoIndex }
  }

  if (mode === 'S') {
    // Prioridad de obturación: elegís obturador e ISO, la cámara mete la
    // apertura que compensa ambos (y apunta a expCompStops en vez de 0).
    const shutterStops = shutterIndex - DEFAULT_SHUTTER_INDEX
    const isoStops = isoIndex - DEFAULT_ISO_INDEX
    const meteredApertureIndex = clampIndex(
      DEFAULT_APERTURE_INDEX - expCompStops + shutterStops + isoStops + sceneLightStops,
      APERTURES.length,
    )
    return { shutterIndex, apertureIndex: meteredApertureIndex, isoIndex }
  }

  if (mode === 'AUTO') {
    // Automático total: no hay apertura/ISO libres, pero el dial de
    // compensación de exposición sigue funcionando (como en una Nikon
    // real) corriendo el obturador desde la terna de referencia.
    const meteredShutterIndex = clampIndex(
      DEFAULT_SHUTTER_INDEX + expCompStops - sceneLightStops,
      SHUTTER_SPEEDS.length,
    )
    return {
      shutterIndex: meteredShutterIndex,
      apertureIndex: DEFAULT_APERTURE_INDEX,
      isoIndex: DEFAULT_ISO_INDEX,
    }
  }

  // Modo M: manual total, se usa exactamente lo que la persona eligió. La
  // compensación de exposición no aplica acá — no hay fotómetro al que
  // darle una meta distinta, ya elegís los tres valores vos mismo.
  return { shutterIndex, apertureIndex, isoIndex }
}

// El "triángulo de exposición": cada índice de distancia respecto del
// valor por defecto equivale a UN PASO (stop) de luz, porque las tres
// listas de arriba están armadas así a propósito (cada paso duplica o
// divide a la mitad la luz que entra). Sumando los tres pasos conseguimos
// cuánta luz de más o de menos está entrando respecto de una exposición
// "correcta" — positivo = sobreexpuesta, negativo = subexpuesta.
//
// Ojo con la apertura: un número f más CHICO (f/1.8) es un diafragma más
// ABIERTO → entra más luz. Como en nuestra lista el índice 0 es el
// diafragma más abierto, su aporte va al revés que obturador e ISO.
export function computeExposureStops({ shutterIndex, apertureIndex, isoIndex }: ExposureIndices): number {
  const shutterStops = shutterIndex - DEFAULT_SHUTTER_INDEX
  const apertureStops = DEFAULT_APERTURE_INDEX - apertureIndex
  const isoStops = isoIndex - DEFAULT_ISO_INDEX
  return shutterStops + apertureStops + isoStops
}
