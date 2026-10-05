import { describe, expect, it } from 'vitest'
import { analyzeCapture } from './photoTutorService'

// Toma "de manual" en la escena de día: 1/500, f/5.6, ISO 400, exposición
// neutra, balance AUTO y el águila sobre un punto de tercios.
const goodShot = {
  shutterSeconds: 1 / 500,
  apertureValue: 5.6,
  isoValue: 400,
  exposureStops: 0,
  wbId: 'auto',
  subjectFrac: { x: 1 / 3, y: 1 / 3 },
  sceneId: 'day',
}

const text = (list: unknown[]) => JSON.stringify(list)

describe('analyzeCapture', () => {
  it('una toma correcta no tiene errores y saca 100', () => {
    const r = analyzeCapture(goodShot)
    expect(r.mal).toEqual([])
    expect(r.score).toBe(100)
    expect(r.bien.length).toBeGreaterThanOrEqual(4)
  })

  it('detecta sobreexposición y distingue "un poco" de "bastante"', () => {
    expect(text(analyzeCapture({ ...goodShot, exposureStops: 1 }).mal)).toContain('un poco sobreexpuesta')
    expect(text(analyzeCapture({ ...goodShot, exposureStops: 2 }).mal)).toContain('bastante sobreexpuesta')
  })

  it('detecta subexposición', () => {
    expect(text(analyzeCapture({ ...goodShot, exposureStops: -2 }).mal)).toContain('subexpuesta')
  })

  it('tolera ±0.4 EV como exposición correcta', () => {
    expect(analyzeCapture({ ...goodShot, exposureStops: 0.4 }).mal).toEqual([])
    expect(analyzeCapture({ ...goodShot, exposureStops: -0.4 }).mal).toEqual([])
  })

  it('avisa del motion blur con obturador lento', () => {
    expect(text(analyzeCapture({ ...goodShot, shutterSeconds: 1 / 8 }).mal)).toContain('estela')
  })

  it('avisa del grano con ISO alto', () => {
    expect(text(analyzeCapture({ ...goodShot, isoValue: 6400 }).mal)).toContain('ISO 6400')
  })

  it('el balance de blancos correcto depende de la escena', () => {
    // Tungsteno en un día soleado: está mal. En la noche de ciudad: está bien.
    expect(analyzeCapture({ ...goodShot, wbId: 'incandescent', sceneId: 'day' }).mal).toHaveLength(1)
    expect(analyzeCapture({ ...goodShot, wbId: 'incandescent', sceneId: 'night' }).mal).toEqual([])
    // Y al revés: "Día" en la noche no corresponde.
    expect(analyzeCapture({ ...goodShot, wbId: 'daylight', sceneId: 'night' }).mal).toHaveLength(1)
  })

  it('AUTO es siempre un acierto de balance de blancos', () => {
    for (const sceneId of ['day', 'cloudy', 'night']) {
      expect(analyzeCapture({ ...goodShot, wbId: 'auto', sceneId }).mal).toEqual([])
    }
  })

  it('detecta sujeto cortado por el borde y sujeto centrado', () => {
    expect(text(analyzeCapture({ ...goodShot, subjectFrac: { x: -0.05, y: 0.3 } }).mal)).toContain('cortado')
    expect(text(analyzeCapture({ ...goodShot, subjectFrac: { x: 0.5, y: 0.5 } }).mal)).toContain('centrado')
  })

  it('sin posición del sujeto no opina sobre composición', () => {
    const r = analyzeCapture({ ...goodShot, subjectFrac: undefined })
    expect(text(r.bien)).not.toContain('tercios')
    expect(text(r.mal)).not.toContain('centrado')
  })

  it('cada categoría aporta como máximo un comentario', () => {
    const worst = analyzeCapture({
      shutterSeconds: 1,
      apertureValue: 1.8,
      isoValue: 6400,
      exposureStops: 3,
      wbId: 'fluorescent',
      subjectFrac: { x: 0.5, y: 0.5 },
      sceneId: 'day',
    })
    expect(worst.bien.length + worst.mal.length).toBeLessThanOrEqual(6)
  })

  it('el score es el porcentaje de categorías que salieron bien', () => {
    const r = analyzeCapture({ ...goodShot, exposureStops: 2 }) // un error
    expect(r.score).toBe(Math.round((r.bien.length / (r.bien.length + r.mal.length)) * 100))
    expect(r.score).toBeLessThan(100)
  })
})
