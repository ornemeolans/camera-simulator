import { Camera, Trash, X } from '@phosphor-icons/react'
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
      <section className="gallery enter" style={{ '--i': 2 }} aria-label="Fotos capturadas">
        <div className="gallery__empty surface">
          <span className="gallery__empty-icon" aria-hidden="true">
            <Camera size={26} weight="duotone" />
          </span>
          <p className="gallery__empty-title">Todavía no sacaste ninguna foto</p>
          <p className="gallery__empty-text">
            Ajustá la exposición y tocá el disparador rojo sobre el visor. La foto y la devolución del tutor
            aparecen acá.
          </p>
        </div>
      </section>
    )
  }

  const [latest, ...rest] = captures

  return (
    <section className="gallery enter" style={{ '--i': 2 }} aria-label="Fotos capturadas">
      {/* key = id: cada foto nueva vuelve a montar la tarjeta y repite la
          animación de "revelado". */}
      <figure key={latest.id} className="gallery__latest surface">
        <img src={latest.dataUrl} alt="Última foto capturada" className="gallery__latest-img" />
        <figcaption className="gallery__latest-info">
          <span className="gallery__caption">{captionFor(latest)}</span>
          <button
            type="button"
            className="gallery__delete-btn"
            onClick={() => onDelete(latest.id)}
            aria-label="Borrar esta foto"
            title="Borrar"
          >
            <Trash size={16} weight="bold" />
          </button>
        </figcaption>
      </figure>

      <PhotoTutorFeedback tutor={latest.tutor} challenge={latest.challenge} />

      {rest.length > 0 && (
        <div className="gallery__strip" aria-label="Fotos anteriores">
          {rest.map((c) => (
            <figure key={c.id} className="gallery__thumb">
              <img src={c.dataUrl} alt={captionFor(c)} />
              <figcaption>
                {c.mode} {c.exposureStops > 0 ? '+' : ''}
                {c.exposureStops.toFixed(1)} EV
              </figcaption>
              <button
                type="button"
                className="gallery__thumb-delete"
                onClick={() => onDelete(c.id)}
                aria-label="Borrar esta foto"
                title="Borrar"
              >
                <X size={12} weight="bold" />
              </button>
            </figure>
          ))}
        </div>
      )}
    </section>
  )
}

function captionFor(c) {
  return `${c.mode}  ${c.shutterLabel}  ${c.apertureLabel}  ISO ${c.isoLabel}  ${c.wbLabel}  ${
    c.exposureStops > 0 ? '+' : ''
  }${c.exposureStops.toFixed(1)} EV`
}
