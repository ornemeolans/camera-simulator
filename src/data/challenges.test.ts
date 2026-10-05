import { describe, expect, it } from 'vitest'
import { CHALLENGES, evaluateChallenge, getChallenge } from './challenges'
import { SCENES, resolveWhiteBalanceTint, getScene } from './scenes'
import { WHITE_BALANCES } from './cameraSettings'

const shot = {
  shutterSeconds: 1 / 1000,
  apertureValue: 5.6,
  isoValue: 400,
  exposureStops: 0,
  wbId: 'auto',
  subjectFrac: { x: 1 / 3, y: 1 / 3 },
}

describe('desafíos', () => {
  it('todos apuntan a una escena que existe', () => {
    for (const c of CHALLENGES) expect(SCENES.map((s) => s.id)).toContain(c.sceneId)
  })

  it('"Congelá al águila" da 100 con obturador rápido y buena exposición', () => {
    const r = evaluateChallenge(getChallenge('freeze')!, shot)
    expect(r.score).toBe(100)
    expect(r.passed).toBe(true)
  })

  it('da puntaje parcial y marca qué criterio falló', () => {
    const r = evaluateChallenge(getChallenge('freeze')!, { ...shot, exposureStops: 2 })
    expect(r.score).toBe(50)
    expect(r.passed).toBe(false)
    expect(r.results.find((x) => x.id === 'ev')?.ok).toBe(false)
  })

  it('"Efecto barrido" pide justo lo contrario que congelar', () => {
    const slow = { ...shot, shutterSeconds: 1 / 4 }
    expect(evaluateChallenge(getChallenge('pan')!, slow).passed).toBe(true)
    expect(evaluateChallenge(getChallenge('pan')!, shot).passed).toBe(false)
  })

  it('"Regla de tercios" falla con el sujeto centrado', () => {
    const r = evaluateChallenge(getChallenge('thirds')!, { ...shot, subjectFrac: { x: 0.5, y: 0.5 } })
    expect(r.results.find((x) => x.id === 'thirds')?.ok).toBe(false)
  })

  it('un id inexistente devuelve null', () => {
    expect(getChallenge('nope')).toBeNull()
  })
})

describe('escenas', () => {
  it('los balances correctos de cada escena existen', () => {
    const ids = WHITE_BALANCES.map((w) => w.id)
    for (const s of SCENES) for (const id of s.correctWb) expect(ids).toContain(id)
  })

  it('una escena desconocida cae al día soleado', () => {
    expect(getScene('xyz').id).toBe('day')
  })

  it('AUTO cancela el tinte propio de la luz de la escena', () => {
    const auto = WHITE_BALANCES.find((w) => w.id === 'auto')!
    expect(resolveWhiteBalanceTint(auto, getScene('day'))).toBeNull()
    expect(resolveWhiteBalanceTint(auto, getScene('night'))).toEqual(getScene('night').autoTint)
  })

  it('un preset manual aplica su propio tinte', () => {
    const tungsten = WHITE_BALANCES.find((w) => w.id === 'incandescent')!
    expect(resolveWhiteBalanceTint(tungsten, getScene('night'))).toEqual({
      color: tungsten.tintColor,
      alpha: tungsten.tintAlpha,
    })
  })
})
