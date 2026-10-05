/**
 * photoTutorService
 * ------------------
 * El "tutor de fotografía": cuando se saca una foto, analiza los ajustes
 * REALES que se usaron (los mismos que ya calcula el resto de la app: EV
 * efectivo, velocidad, apertura, ISO, balance de blancos, y dónde quedó el
 * sujeto en el cuadro) y arma una devolución corta con qué salió bien, qué
 * salió mal, y cómo corregirlo — como lo haría alguien revisando la foto
 * con vos, no como una IA "adivinando" qué hay en la imagen.
 *
 * Por qué así (determinístico, no un modelo que mira el pixel):
 * - Esto es un SIMULADOR: conocemos con exactitud qué efecto tuvo cada
 *   ajuste sobre la imagen porque somos nosotros los que lo dibujamos (ver
 *   Viewfinder.jsx). Evaluar la foto con las mismas reglas de fotografía
 *   real que ya usamos para simular el efecto es más preciso y mucho más
 *   barato que mandar la imagen a un modelo de visión a adivinar.
 * - Las reglas de abajo son las reglas de fotografía de siempre (exposición
 *   en pasos, "regla de 1/foco" para congelar movimiento, profundidad de
 *   campo según apertura, ruido según ISO, regla de tercios) — por eso la
 *   devolución es defendible: no es una opinión de la app, es fotografía
 *   básica aplicada a los números reales de la toma.
 *
 * Cada categoría de análisis aporta COMO MÁXIMO un acierto O un error (no
 * los dos) — así la devolución se mantiene corta, como pidió Orne, en vez
 * de una lista interminable de observaciones.
 */
import { shutterSpeedFactor, WHITE_BALANCES } from '../data/cameraSettings'
import { getScene } from '../data/scenes'
import type { Shot, TutorFix, TutorResult } from '../types'

// Qué tinte le agrega cada preset de balance de blancos a la imagen (ver
// WHITE_BALANCES en cameraSettings.js). Se usa para explicar el error con
// palabras: "te quedó un tinte azulado". Qué preset es el CORRECTO ya no
// está acá: lo define cada escena (`scene.correctWb`, ver data/scenes.js),
// porque la luz de un día soleado y la de una noche de ciudad piden
// balances distintos. Antes esto estaba escrito a fuego para una sola escena.
const WB_TINT_TONE: Record<string, string> = {
  daylight: 'neutro',
  cloudy: 'cálido',
  shade: 'cálido',
  incandescent: 'azulado',
  fluorescent: 'violáceo',
  flash: 'cálido leve',
}

const THIRDS_LINES = [1 / 3, 2 / 3]

export function nearestThirdsDistance(xFrac: number, yFrac: number): number {
  let min = Infinity
  for (const tx of THIRDS_LINES) {
    for (const ty of THIRDS_LINES) {
      const d = Math.hypot(xFrac - tx, yFrac - ty)
      if (d < min) min = d
    }
  }
  return min
}

/**
 * Analiza una captura y devuelve `{ bien: string[], mal: {problema, correccion}[] }`.
 *
 * @param {object} params
 * @param {number} params.shutterSeconds - velocidad de obturación EFECTIVA (en segundos)
 * @param {number} params.apertureValue - apertura EFECTIVA (número f)
 * @param {number} params.isoValue - ISO EFECTIVO
 * @param {number} params.exposureStops - EV final (0 = exposición neutra)
 * @param {string} params.wbId - id del preset de balance de blancos elegido
 * @param {{x:number,y:number}} [params.subjectFrac] - posición del sujeto en el cuadro (0..1), si está disponible
 * @param {string} [params.sceneId] - escena en la que se sacó la foto (data/scenes.js); por defecto, día soleado
 *
 * Además de `bien`/`mal` devuelve `score` (0..100): el porcentaje de
 * categorías evaluadas que salieron bien. Es la misma lógica del tutor
 * resumida en un número, así los desafíos y el historial de progreso se
 * apoyan en UNA sola fuente de verdad en vez de duplicar reglas.
 */
export function analyzeCapture({
  shutterSeconds,
  apertureValue,
  isoValue,
  exposureStops,
  wbId,
  subjectFrac,
  sceneId,
}: Shot & { sceneId?: string }): TutorResult {
  const scene = getScene(sceneId ?? 'day')
  const bien: string[] = []
  const mal: TutorFix[] = []

  // --- 1. Exposición ---
  // ±0.4 EV se considera "bien expuesta" — ni una réflex real clava el 0.0
  // exacto todo el tiempo, un margen chico es normal y no se nota a simple
  // vista.
  const ev = exposureStops
  if (Math.abs(ev) <= 0.4) {
    bien.push('La exposición está bien equilibrada (cerca de 0 EV): ni quemada ni tapada.')
  } else if (ev > 0.4) {
    const fuerte = ev > 1.5
    mal.push({
      problema:
        `La foto está ${fuerte ? 'bastante' : 'un poco'} sobreexpuesta (+${ev.toFixed(1)} EV)` +
        (fuerte ? ', se están perdiendo detalles en las zonas claras.' : '.'),
      correccion:
        'Cerrá un poco el diafragma (número f más alto), subí la velocidad de obturación, o bajá el ISO — cualquiera de los tres resta luz por igual.',
    })
  } else {
    const fuerte = ev < -1.5
    mal.push({
      problema:
        `La foto está ${fuerte ? 'bastante' : 'un poco'} subexpuesta (${ev.toFixed(1)} EV)` +
        (fuerte ? ', se pierden detalles en las sombras.' : '.'),
      correccion:
        'Abrí un poco más el diafragma (número f más bajo), bajá la velocidad de obturación, o subí el ISO.',
    })
  }

  // --- 2. Congelado de movimiento ---
  // El sujeto de este simulador SIEMPRE está en vuelo, así que la velocidad
  // de obturación elegida importa de verdad acá (no es decorativo). t=0 es
  // la velocidad más rápida disponible (1/2000), t=1 la más lenta (1").
  const t = shutterSpeedFactor(shutterSeconds)
  if (t < 0.25) {
    bien.push('La velocidad de obturación fue lo bastante rápida como para congelar al sujeto en movimiento, nítido y sin estela.')
  } else if (t >= 0.55) {
    mal.push({
      problema: 'La velocidad de obturación es lenta para un sujeto que se mueve rápido: queda con una estela marcada (motion blur).',
      correccion:
        'Si buscabas congelarlo nítido, subí la velocidad a 1/500 o más rápido. Si el efecto de movimiento fue intencional (barrido), ¡ya lo lograste!',
    })
  }

  // --- 3. Profundidad de campo ---
  // Sólo comentamos en los extremos — en el rango medio (f/4 a f/8) no hay
  // nada particular que señalar, es una elección neutra.
  if (apertureValue <= 2.8) {
    bien.push('El diafragma bien abierto desenfocó el fondo y hace que el sujeto resalte — buen recurso para retrato o fauna.')
  } else if (apertureValue >= 11) {
    bien.push('El diafragma cerrado mantiene casi todo el cuadro nítido — ideal si buscabas ver el fondo con detalle, como en un paisaje.')
  }

  // --- 4. ISO / ruido ---
  if (isoValue <= 400) {
    bien.push('El ISO bajo mantiene la imagen limpia, sin grano notorio.')
  } else if (isoValue > 1600) {
    mal.push({
      problema: `Con ISO ${isoValue} la imagen va a mostrar bastante grano/ruido.`,
      correccion:
        'Si hay suficiente luz en la escena, bajá el ISO y compensá esa luz que falta abriendo más el diafragma o usando una velocidad de obturación más lenta.',
    })
  }

  // --- 5. Balance de blancos ---
  // El correcto depende de la luz de la escena (scene.correctWb): Automático
  // siempre acierta; los demás sólo si coinciden con esa luz. Cualquier otro
  // preset agrega un tinte pensado para una luz distinta a la de la toma.
  const wb = WHITE_BALANCES.find((w) => w.id === wbId)
  if (scene.correctWb.includes(wbId)) {
    bien.push(`El balance de blancos (${wb?.label ?? wbId}) corresponde a la luz de esta escena (${scene.lightLabel}).`)
  } else {
    const tono = WB_TINT_TONE[wbId] ?? 'de color'
    const sugeridos = scene.correctWb
      .map((id) => WHITE_BALANCES.find((w) => w.id === id)?.label ?? id)
      .join(' o ')
    mal.push({
      problema: `El balance de blancos elegido (${wb?.label ?? wbId}) no corresponde a la luz de esta escena (${scene.lightLabel}) y deja un tinte ${tono} que no debería estar.`,
      correccion: `Probá con ${sugeridos} para este tipo de luz.`,
    })
  }

  // --- 6. Composición (regla de tercios) ---
  if (subjectFrac) {
    const { x, y } = subjectFrac
    const cortado = x < 0.04 || x > 0.96 || y < 0.04 || y > 0.96
    const centrado = Math.abs(x - 0.5) < 0.08 && Math.abs(y - 0.5) < 0.08

    if (cortado) {
      mal.push({
        problema: 'El sujeto quedó cortado o muy pegado al borde del cuadro.',
        correccion: 'Esperá un instante antes o después de disparar para que entre completo en el encuadre.',
      })
    } else if (nearestThirdsDistance(x, y) < 0.12) {
      bien.push('El sujeto está ubicado cerca de un punto de la regla de tercios — buena composición, le da dinamismo a la toma.')
    } else if (centrado) {
      mal.push({
        problema: 'El sujeto quedó muy centrado en el cuadro — una composición válida, pero poco dinámica.',
        correccion: 'Probá disparar un poco antes o después para que quede sobre una de las líneas de la cuadrícula de tercios (se ve en el visor).',
      })
    }
  }

  const total = bien.length + mal.length
  const score = total === 0 ? 0 : Math.round((bien.length / total) * 100)
  return { bien, mal, score }
}
