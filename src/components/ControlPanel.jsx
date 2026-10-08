import { useState } from 'react'
import {
  MODES,
  SHUTTER_SPEEDS,
  APERTURES,
  ISOS,
  FOCAL_LENGTHS,
  WHITE_BALANCES,
  EXPOSURE_COMP_STEPS,
  isShutterEditable,
  isApertureEditable,
  isIsoEditable,
  isExposureCompEditable,
} from '../data/cameraSettings'
import { Minus, Plus, Question } from '@phosphor-icons/react'
import './ControlPanel.css'

// Texto de ayuda por control — la idea no es explicar fotografía entera,
// sino la pregunta puntual que alguien sin experiencia se hace mirando el
// dial: "¿qué hace esto y qué le pasa a la foto si lo toco?". Se muestra
// con el botón "?" de cada dial (ver InfoButton más abajo).
const HELP_TEXT = {
  obturador:
    'Cuánto tiempo queda abierto el sensor. Más lento (1", 1/2) deja estelas de movimiento y entra más luz; más rápido (1/2000) "congela" el movimiento y entra menos luz.',
  apertura:
    'Qué tan abierto está el diafragma del lente. Más abierto (f/1.8) entra más luz y desenfoca el fondo; más cerrado (f/22) entra menos luz y deja casi todo nítido.',
  iso: 'Qué tan sensible a la luz está el sensor. Más alto = imagen más clara con poca luz, pero con más grano/ruido visible.',
  lente:
    'La distancia focal del lente puesto. Más chica (18mm) es gran angular, ve más escena; más grande (200mm) es teleobjetivo, acerca y recorta el encuadre.',
  balanceBlancos:
    'Le dice a la cámara qué tinte de color "restar" según el tipo de luz. Elegir el preset equivocado para la luz real deja la foto con un tinte naranja o azulado.',
  compExposicion:
    'En A/S/AUTO, le pide a la cámara una foto más clara (+EV) o más oscura (−EV) que lo que ella calcula como "correcto". En M no hace nada: ahí ya controlás los tres valores vos.',
}

/**
 * ControlPanel
 * ------------
 * Los controles físicos de la cámara: el dial de modo (M/A/S/AUTO) y los
 * tres parámetros principales. Es un componente "tonto": no guarda nada
 * de estado propio, sólo muestra lo que le pasan por props y avisa hacia
 * arriba (a App) cuando la persona toca algo — el mismo patrón que
 * cualquier formulario controlado de React.
 *
 * Cada parámetro se maneja como un ÍNDICE dentro de su lista de valores
 * posibles (en vez del valor en sí), porque así "siguiente/anterior" es
 * simplemente sumar o restar 1 al índice, sin tener que buscar el valor
 * en el array cada vez.
 */
export default function ControlPanel({
  mode,
  onModeChange,
  shutterIndex,
  onShutterIndexChange,
  effectiveShutterIndex,
  apertureIndex,
  onApertureIndexChange,
  effectiveApertureIndex,
  isoIndex,
  onIsoIndexChange,
  effectiveIsoIndex,
  focalIndex,
  onFocalIndexChange,
  wbIndex,
  onWbIndexChange,
  expCompIndex,
  onExpCompIndexChange,
}) {
  const shutterEditable = isShutterEditable(mode)
  const apertureEditable = isApertureEditable(mode)
  const isoEditable = isIsoEditable(mode)
  const expCompEditable = isExposureCompEditable(mode)

  return (
    <section className="control-panel surface enter" style={{ '--i': 3 }} aria-labelledby="control-panel-title">
      <h2 id="control-panel-title" className="panel-title">Ajustes de cámara</h2>
      <div className="control-panel__modes" role="group" aria-label="Modo de exposición">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`control-panel__mode-btn${mode === m.id ? ' control-panel__mode-btn--active' : ''}`}
            onClick={() => onModeChange(m.id)}
            title={m.name}
            aria-pressed={mode === m.id}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="control-panel__dials">
        <Dial
          label="Obturador"
          // Editable: tu propio dial. No editable: el valor que metió el
          // fotómetro simulado (effectiveShutterIndex) — nunca un "AUTO"
          // genérico que no diga qué está haciendo la cámara en realidad.
          value={SHUTTER_SPEEDS[shutterEditable ? shutterIndex : effectiveShutterIndex].label}
          editable={shutterEditable}
          help={HELP_TEXT.obturador}
          onPrev={() => onShutterIndexChange(clamp(shutterIndex - 1, SHUTTER_SPEEDS.length))}
          onNext={() => onShutterIndexChange(clamp(shutterIndex + 1, SHUTTER_SPEEDS.length))}
        />
        <Dial
          label="Apertura"
          value={APERTURES[apertureEditable ? apertureIndex : effectiveApertureIndex].label}
          editable={apertureEditable}
          help={HELP_TEXT.apertura}
          onPrev={() => onApertureIndexChange(clamp(apertureIndex - 1, APERTURES.length))}
          onNext={() => onApertureIndexChange(clamp(apertureIndex + 1, APERTURES.length))}
        />
        <Dial
          label="ISO"
          value={ISOS[isoEditable ? isoIndex : effectiveIsoIndex].label}
          editable={isoEditable}
          help={HELP_TEXT.iso}
          onPrev={() => onIsoIndexChange(clamp(isoIndex - 1, ISOS.length))}
          onNext={() => onIsoIndexChange(clamp(isoIndex + 1, ISOS.length))}
        />
        <Dial
          label="Lente"
          value={FOCAL_LENGTHS[focalIndex].label}
          editable
          help={HELP_TEXT.lente}
          onPrev={() => onFocalIndexChange(clamp(focalIndex - 1, FOCAL_LENGTHS.length))}
          onNext={() => onFocalIndexChange(clamp(focalIndex + 1, FOCAL_LENGTHS.length))}
        />
        <Dial
          label="Bal. Blancos"
          value={WHITE_BALANCES[wbIndex].label}
          editable
          wide
          help={HELP_TEXT.balanceBlancos}
          onPrev={() => onWbIndexChange(clamp(wbIndex - 1, WHITE_BALANCES.length))}
          onNext={() => onWbIndexChange(clamp(wbIndex + 1, WHITE_BALANCES.length))}
        />
        <Dial
          label="Comp. Exp."
          value={EXPOSURE_COMP_STEPS[expCompIndex].label}
          editable={expCompEditable}
          lockedLabel="no aplica en M"
          wide
          help={HELP_TEXT.compExposicion}
          onPrev={() => onExpCompIndexChange(clamp(expCompIndex - 1, EXPOSURE_COMP_STEPS.length))}
          onNext={() => onExpCompIndexChange(clamp(expCompIndex + 1, EXPOSURE_COMP_STEPS.length))}
        />
      </div>
    </section>
  )
}

// Un solo control tipo "dial": una etiqueta, el valor actual bien grande
// (como el visor de estado de una réflex real) y flechas para moverse por
// la lista. Cuando `editable` es false las flechas se desactivan y aparece
// la marca "auto": así representamos "esto lo calcula la cámara sola en este
// modo", igual que pasa en una Nikon real en A o S. El VALOR que se
// muestra en ese caso ya viene resuelto desde afuera (el que calculó el
// fotómetro simulado), este componente sólo lo pinta.
function Dial({ label, value, editable, lockedLabel = 'auto', help, wide, onPrev, onNext }) {
  return (
    <div className={`dial${editable ? '' : ' dial--auto'}${wide ? ' dial--wide' : ''}`}>
      <div className="dial__label-row">
        <span className="dial__label">{label}</span>
        {!editable && <span className="dial__auto">{lockedLabel}</span>}
        {help && <InfoButton label={label} text={help} />}
      </div>
      <div className="dial__control">
        <button
          type="button"
          className="dial__arrow"
          onClick={onPrev}
          disabled={!editable}
          aria-label={`${label} anterior`}
        >
          <Minus size={16} weight="bold" />
        </button>
        <span className="dial__value">{value}</span>
        <button
          type="button"
          className="dial__arrow"
          onClick={onNext}
          disabled={!editable}
          aria-label={`${label} siguiente`}
        >
          <Plus size={16} weight="bold" />
        </button>
      </div>
    </div>
  )
}

// Botón "?" chiquito que muestra/oculta una explicación corta del control.
// Clic en vez de hover a propósito: en mobile no hay hover, así que un
// botón que se puede tocar es lo único que funciona en los dos mundos.
// aria-expanded + aria-controls avisan a lectores de pantalla si el texto
// está visible o no, sin depender de que lo vean.
function InfoButton({ label, text }) {
  const [open, setOpen] = useState(false)
  const tooltipId = `dial-help-${label.replace(/\s+/g, '-').toLowerCase()}`

  return (
    <span className="dial__info-wrap">
      <button
        type="button"
        className="dial__info-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={tooltipId}
        aria-label={`Qué hace ${label}`}
      >
        <Question size={16} weight="bold" />
      </button>
      {open && (
        <span id={tooltipId} role="tooltip" className="dial__info-tooltip">
          {text}
        </span>
      )}
    </span>
  )
}

function clamp(index, length) {
  return Math.min(Math.max(index, 0), length - 1)
}
