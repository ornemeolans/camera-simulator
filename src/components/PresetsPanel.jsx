import { useState } from 'react'
import { FloppyDisk, X } from '@phosphor-icons/react'
import './PresetsPanel.css'

/**
 * PresetsPanel
 * ------------
 * Guardar y volver a cargar una combinación completa de ajustes (modo,
 * obturador, apertura, ISO, lente, balance de blancos, compensación de
 * exposición) con un nombre — para no tener que recordar "¿cómo estaba
 * armado ese retrato con fondo desenfocado que probé el otro día?". Los
 * presets se persisten igual que las capturas (Firestore o localStorage,
 * ver storageService.js), así que siguen ahí la próxima vez que se abre la
 * app.
 */
export default function PresetsPanel({ presets, onSave, onLoad, onDelete }) {
  const [name, setName] = useState('')

  function handleSave(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
    setName('')
  }

  return (
    <section className="presets surface enter" style={{ '--i': 5 }} aria-labelledby="presets-title">
      <h2 id="presets-title" className="panel-title">
        Ajustes guardados
      </h2>

      <form className="presets__form" onSubmit={handleSave}>
        <label className="presets__field">
          <span className="presets__label">Nombre del ajuste</span>
          <input
            type="text"
            className="presets__input"
            placeholder="Ej. Retrato desenfocado"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
          />
        </label>
        <button type="submit" className="presets__save-btn" disabled={!name.trim()}>
          <FloppyDisk size={16} weight="bold" aria-hidden="true" />
          Guardar
        </button>
      </form>

      {presets.length > 0 ? (
        <ul className="presets__list">
          {presets.map((p) => (
            <li key={p.id} className="presets__item">
              <div className="presets__item-text">
                <span className="presets__item-name">{p.name}</span>
                <span className="presets__item-meta">{summaryFor(p)}</span>
              </div>
              <div className="presets__item-actions">
                <button type="button" onClick={() => onLoad(p)} className="presets__load-btn">
                  Cargar
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  className="presets__delete-btn"
                  aria-label={`Borrar preset ${p.name}`}
                  title="Borrar"
                >
                  <X size={14} weight="bold" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="presets__empty">
          Guardá la combinación actual de modo, obturador, apertura, ISO, lente y balance de blancos para volver a
          ella con un clic.
        </p>
      )}
    </section>
  )
}

function summaryFor(p) {
  return `${p.mode}  ${p.shutterLabel}  ${p.apertureLabel}  ISO ${p.isoLabel}  ${p.focalLabel}  ${p.wbLabel}`
}
