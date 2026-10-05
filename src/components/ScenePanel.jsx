import { useRef } from 'react'
import { SCENES, CUSTOM_SCENE } from '../data/scenes'
import './ScenePanel.css'

/**
 * ScenePanel
 * ----------
 * Elegir DÓNDE se saca la foto (día soleado, nublado, noche), subir una
 * foto propia como fondo, y prender el histograma. Cambiar de escena
 * cambia la luz de verdad: la cantidad de luz disponible (hay que
 * compensar la exposición), el tinte de color de esa luz (hay que elegir el
 * balance de blancos correcto) y lo que el tutor considera "bien".
 *
 * Es un componente tonto: el estado vive en App.jsx.
 */
export default function ScenePanel({
  sceneId,
  onSceneChange,
  hasCustomPhoto,
  onCustomPhoto,
  showHistogram,
  onToggleHistogram,
}) {
  const fileInputRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files?.[0]
    if (file) onCustomPhoto(file)
    e.target.value = '' // permite volver a elegir el mismo archivo
  }

  return (
    <section className="scene-panel" aria-label="Escena">
      <div className="scene-panel__row" role="group" aria-label="Escena de la toma">
        {SCENES.map((s) => (
          <button
            key={s.id}
            type="button"
            className={'scene-panel__chip' + (sceneId === s.id ? ' scene-panel__chip--active' : '')}
            aria-pressed={sceneId === s.id}
            onClick={() => onSceneChange(s.id)}
          >
            {s.label}
          </button>
        ))}
        {hasCustomPhoto && (
          <button
            type="button"
            className={'scene-panel__chip' + (sceneId === CUSTOM_SCENE.id ? ' scene-panel__chip--active' : '')}
            aria-pressed={sceneId === CUSTOM_SCENE.id}
            onClick={() => onSceneChange(CUSTOM_SCENE.id)}
          >
            {CUSTOM_SCENE.label}
          </button>
        )}
      </div>

      <div className="scene-panel__row scene-panel__row--tools">
        <button type="button" className="scene-panel__tool" onClick={() => fileInputRef.current?.click()}>
          {hasCustomPhoto ? 'Cambiar mi foto' : 'Subir mi foto como fondo'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="scene-panel__file"
          onChange={handleFile}
          aria-label="Elegir una foto propia para usar de fondo"
          tabIndex={-1}
        />
        <label className="scene-panel__toggle">
          <input type="checkbox" checked={showHistogram} onChange={(e) => onToggleHistogram(e.target.checked)} />
          Histograma
        </label>
      </div>

      {sceneId === CUSTOM_SCENE.id && (
        <p className="scene-panel__hint">
          Con tu foto de fondo el águila sigue volando encima y el tutor evalúa la composición con ella; la luz se
          asume de día.
        </p>
      )}
    </section>
  )
}
