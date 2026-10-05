import PhotoTutorFeedback from './PhotoTutorFeedback.jsx'
import './CapturesGallery.css'

/**
 * CapturesGallery
 * ----------------
 * La "tarjeta de memoria" del simulador: todas las fotos que se fueron
 * tomando, persistidas (Firestore o localStorage, ver storageService.js) —
 * no se pierden al cerrar la pestaña, a diferencia de un simple estado de
 * React. Es un componente tonto: recibe la lista y un callback de borrado,
 * no sabe nada de CÓMO se guardaron.
 */
export default function CapturesGallery({ captures, onDelete }) {
  if (captures.length === 0) {
    return (
      <div className="gallery gallery--empty">
        <p>Todavía no sacaste ninguna foto. Apretá el botón de disparo de arriba.</p>
      </div>
    )
  }

  const [latest, ...rest] = captures

  return (
    <div className="gallery">
      <div className="gallery__latest">
        <img src={latest.dataUrl} alt="Última foto capturada" className="gallery__latest-img" />
        <div className="gallery__latest-info">
          <p className="gallery__caption">{captionFor(latest)}</p>
          <button
            type="button"
            className="gallery__delete-btn"
            onClick={() => onDelete(latest.id)}
            aria-label="Borrar esta foto"
          >
            Borrar
          </button>
        </div>
      </div>

      <PhotoTutorFeedback tutor={latest.tutor} challenge={latest.challenge} />

      {rest.length > 0 && (
        <div className="gallery__strip">
          {rest.map((c) => (
            <figure key={c.id} className="gallery__thumb">
              <img src={c.dataUrl} alt={captionFor(c)} />
              <figcaption>{c.mode} · {c.exposureStops > 0 ? '+' : ''}{c.exposureStops.toFixed(1)} EV</figcaption>
              <button
                type="button"
                className="gallery__thumb-delete"
                onClick={() => onDelete(c.id)}
                aria-label="Borrar esta foto"
                title="Borrar"
              >
                ×
              </button>
            </figure>
          ))}
        </div>
      )}
    </div>
  )
}

function captionFor(c) {
  return `${c.mode} · ${c.shutterLabel} · ${c.apertureLabel} · ISO ${c.isoLabel} · ${c.wbLabel} · ${
    c.exposureStops > 0 ? '+' : ''
  }${c.exposureStops.toFixed(1)} EV`
}
