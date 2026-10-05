/**
 * challenges
 * ----------
 * Desafíos con puntaje: una consigna fotográfica concreta ("congelá al
 * águila", "noche sin sub-exponer") evaluada con los MISMOS números reales
 * de la toma que usa el tutor (ver photoTutorService.js). No hay un segundo
 * sistema de reglas: cada criterio es una condición sobre los ajustes
 * efectivos, y el puntaje es el % de criterios cumplidos.
 *
 * Cada desafío fija su escena (al elegirlo, la app cambia a esa escena),
 * porque la consigna depende de la luz: no se puede pedir "exponer una
 * noche" sobre un día soleado.
 */
import type { ChallengeResult, Shot } from '../types'
import { shutterSpeedFactor } from './cameraSettings'
import { nearestThirdsDistance } from '../services/photoTutorService'

export interface Challenge {
  id: string
  title: string
  sceneId: string
  brief: string
  criteria: { id: string; label: string; check: (shot: Shot) => boolean }[]
}

const wellExposed = (shot: Shot) => Math.abs(shot.exposureStops) <= 0.4

export const CHALLENGES: Challenge[] = [
  {
    id: 'freeze',
    title: 'Congelá al águila',
    sceneId: 'day',
    brief: 'Sacá al águila nítida, sin estela, y bien expuesta.',
    criteria: [
      { id: 'fast', label: 'Obturador rápido (1/500 o más)', check: (s: Shot) => shutterSpeedFactor(s.shutterSeconds) < 0.25 },
      { id: 'ev', label: 'Exposición correcta (±0.4 EV)', check: wellExposed },
    ],
  },
  {
    id: 'bokeh',
    title: 'Fondo cremoso',
    sceneId: 'day',
    brief: 'Desenfocá el fondo con el diafragma bien abierto, sin quemar la foto.',
    criteria: [
      { id: 'open', label: 'Diafragma abierto (f/2.8 o menor)', check: (s: Shot) => s.apertureValue <= 2.8 },
      { id: 'ev', label: 'Exposición correcta (±0.4 EV)', check: wellExposed },
      { id: 'iso', label: 'ISO bajo (400 o menos)', check: (s: Shot) => s.isoValue <= 400 },
    ],
  },
  {
    id: 'pan',
    title: 'Efecto barrido',
    sceneId: 'day',
    brief: 'Mostrá movimiento a propósito: obturador lento pero con la foto bien expuesta.',
    criteria: [
      { id: 'slow', label: 'Obturador lento (1/15 o más lento)', check: (s: Shot) => shutterSpeedFactor(s.shutterSeconds) >= 0.55 },
      { id: 'ev', label: 'Exposición correcta (±0.4 EV)', check: wellExposed },
    ],
  },
  {
    id: 'thirds',
    title: 'Regla de tercios',
    sceneId: 'cloudy',
    brief: 'Disparaste en el momento justo: águila sobre un punto de tercios, bien expuesta y con el balance correcto.',
    criteria: [
      {
        id: 'thirds',
        label: 'Sujeto cerca de un punto de tercios',
        check: (s: Shot) => s.subjectFrac !== undefined && nearestThirdsDistance(s.subjectFrac.x, s.subjectFrac.y) < 0.12,
      },
      { id: 'ev', label: 'Exposición correcta (±0.4 EV)', check: wellExposed },
      { id: 'wb', label: 'Balance de blancos correcto para luz nublada', check: (s: Shot) => ['auto', 'cloudy'].includes(s.wbId) },
    ],
  },
  {
    id: 'night',
    title: 'Noche sin perder detalle',
    sceneId: 'night',
    brief: 'Poca luz: compensá con diafragma, obturador e ISO para exponer bien, con el color de las luces bien resuelto.',
    criteria: [
      { id: 'ev', label: 'Exposición correcta (±0.4 EV)', check: wellExposed },
      { id: 'wb', label: 'Balance de blancos correcto para tungsteno', check: (s: Shot) => ['auto', 'incandescent'].includes(s.wbId) },
      { id: 'iso', label: 'ISO razonable (3200 o menos)', check: (s: Shot) => s.isoValue <= 3200 },
    ],
  },
]

export function getChallenge(id: string | null): Challenge | null {
  return CHALLENGES.find((c) => c.id === id) ?? null
}

/**
 * Evalúa una toma contra un desafío.
 * @param {object} challenge - entrada de CHALLENGES
 * @param {object} shot - { shutterSeconds, apertureValue, isoValue, exposureStops, wbId, subjectFrac }
 * @returns {{ challengeId: string, title: string, score: number, passed: boolean, results: {id:string,label:string,ok:boolean}[] }}
 */
export function evaluateChallenge(challenge: Challenge, shot: Shot): ChallengeResult {
  const results = challenge.criteria.map((c) => ({ id: c.id, label: c.label, ok: Boolean(c.check(shot)) }))
  const okCount = results.filter((r) => r.ok).length
  return {
    challengeId: challenge.id,
    title: challenge.title,
    score: Math.round((okCount / results.length) * 100),
    passed: okCount === results.length,
    results,
  }
}
