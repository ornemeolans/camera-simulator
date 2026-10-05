import { describe, expect, it } from 'vitest'
import {
  APERTURES,
  ISOS,
  SHUTTER_SPEEDS,
  DEFAULT_APERTURE_INDEX,
  DEFAULT_ISO_INDEX,
  DEFAULT_SHUTTER_INDEX,
  computeExposureStops,
  effectiveIndices,
  shutterSpeedFactor,
} from './cameraSettings'

describe('computeExposureStops', () => {
  it('la terna por defecto da exposición neutra (0 EV)', () => {
    expect(
      computeExposureStops({
        shutterIndex: DEFAULT_SHUTTER_INDEX,
        apertureIndex: DEFAULT_APERTURE_INDEX,
        isoIndex: DEFAULT_ISO_INDEX,
      }),
    ).toBe(0)
  })

  it('cada paso de obturador, apertura o ISO suma o resta exactamente 1 EV', () => {
    const base = { shutterIndex: DEFAULT_SHUTTER_INDEX, apertureIndex: DEFAULT_APERTURE_INDEX, isoIndex: DEFAULT_ISO_INDEX }
    expect(computeExposureStops({ ...base, shutterIndex: base.shutterIndex + 1 })).toBe(1) // más lento = más luz
    expect(computeExposureStops({ ...base, apertureIndex: base.apertureIndex - 1 })).toBe(1) // más abierto = más luz
    expect(computeExposureStops({ ...base, isoIndex: base.isoIndex - 1 })).toBe(-1) // ISO menor = menos luz
  })
})

describe('effectiveIndices', () => {
  it('en M usa exactamente lo que se eligió, sin fotómetro', () => {
    expect(effectiveIndices('M', 2, 5, 1, 3)).toEqual({ shutterIndex: 2, apertureIndex: 5, isoIndex: 1 })
  })

  it('en A el fotómetro compensa apertura e ISO con el obturador (0 EV)', () => {
    for (let a = 0; a < APERTURES.length; a++) {
      for (let iso = 0; iso < ISOS.length; iso++) {
        const eff = effectiveIndices('A', 0, a, iso)
        const atEdge = eff.shutterIndex === 0 || eff.shutterIndex === SHUTTER_SPEEDS.length - 1
        // Si el obturador necesario no existe, se clampea y el EV deja de ser 0 a propósito.
        if (!atEdge) expect(computeExposureStops(eff)).toBe(0)
      }
    }
  })

  it('en S el fotómetro compensa con la apertura y respeta lo elegido', () => {
    const eff = effectiveIndices('S', 6, 0, 3)
    expect(eff.shutterIndex).toBe(6)
    expect(eff.isoIndex).toBe(3)
    expect(computeExposureStops(eff)).toBe(0)
  })

  it('la compensación de exposición corre la meta del fotómetro (+1 EV en A)', () => {
    expect(computeExposureStops(effectiveIndices('A', 0, 3, 2, 1))).toBe(1)
  })

  it('en AUTO sólo se mueve el obturador, según la compensación', () => {
    const eff = effectiveIndices('AUTO', 0, 0, 0, -1)
    expect(eff.apertureIndex).toBe(DEFAULT_APERTURE_INDEX)
    expect(eff.isoIndex).toBe(DEFAULT_ISO_INDEX)
    expect(computeExposureStops(eff)).toBe(-1)
  })

  it('en una escena oscura (-3 EV) el fotómetro de AUTO suma 3 pasos de luz', () => {
    const eff = effectiveIndices('AUTO', 0, 0, 0, 0, -3)
    // Los ajustes dejan entrar +3 EV, y la escena aporta -3: el total es neutro.
    expect(computeExposureStops(eff)).toBe(3)
    expect(computeExposureStops(eff) + -3).toBe(0)
  })

  it('en M una escena oscura NO se compensa sola (hay que hacerlo a mano)', () => {
    const eff = effectiveIndices('M', DEFAULT_SHUTTER_INDEX, DEFAULT_APERTURE_INDEX, DEFAULT_ISO_INDEX, 0, -3)
    expect(computeExposureStops(eff) + -3).toBe(-3)
  })
})

describe('shutterSpeedFactor', () => {
  it('va de 0 (la más rápida) a 1 (la más lenta)', () => {
    expect(shutterSpeedFactor(SHUTTER_SPEEDS[0].seconds)).toBeCloseTo(0, 10)
    expect(shutterSpeedFactor(SHUTTER_SPEEDS[SHUTTER_SPEEDS.length - 1].seconds)).toBeCloseTo(1, 10)
  })

  it('es estrictamente creciente entre velocidades', () => {
    const values = SHUTTER_SPEEDS.map((s) => shutterSpeedFactor(s.seconds))
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1])
  })

  it('clampea valores fuera del rango de la cámara', () => {
    expect(shutterSpeedFactor(1 / 100000)).toBe(0)
    expect(shutterSpeedFactor(60)).toBe(1)
  })
})
