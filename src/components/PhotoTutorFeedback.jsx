import './PhotoTutorFeedback.css'

/**
 * PhotoTutorFeedback
 * -------------------
 * Muestra la devolución del tutor de fotografía (ver photoTutorService.js)
 * para la última foto capturada: qué salió bien, y qué salió mal con su
 * corrección al lado — en vez de una lista de errores separada de una
 * lista de soluciones, cada problema va pegado a su arreglo, así no hay
 * que ir y volver entre dos listas para entender qué hacer.
 *
 * Es un componente tonto (no analiza nada, sólo pinta `tutor`) para que
 * App.jsx pueda calcular la devolución UNA sola vez al momento del
 * disparo y guardarla junto con la captura — así, si la foto se recarga
 * después desde Firestore/localStorage, la devolución sigue ahí sin
 * tener que volver a analizarla.
 */
export default function PhotoTutorFeedback({ tutor, challenge }) {
  if (!tutor || (tutor.bien.length === 0 && tutor.mal.length === 0)) return null

  return (
    <div className="tutor">
      <div className="tutor__head">
        <h3 className="tutor__title">Tutor de fotografía</h3>
        {typeof tutor.score === 'number' && <span className="tutor__score">{tutor.score}/100</span>}
      </div>

      {challenge && (
        <div className="tutor__section tutor__challenge">
          <span className="tutor__section-label tutor__section-label--bien">
            Desafío: {challenge.title} · {challenge.score}/100{challenge.passed ? ' · ¡Superado!' : ''}
          </span>
          <ul className="tutor__list tutor__list--checks">
            {challenge.results.map((r) => (
              <li key={r.id}>
                <span aria-hidden="true">{r.ok ? '✓' : '✗'}</span>
                <span className="tutor__sr-only">{r.ok ? 'Cumplido: ' : 'No cumplido: '}</span> {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tutor.bien.length > 0 && (
        <div className="tutor__section">
          <span className="tutor__section-label tutor__section-label--bien">Bien</span>
          <ul className="tutor__list">
            {tutor.bien.map((texto, i) => (
              <li key={i}>{texto}</li>
            ))}
          </ul>
        </div>
      )}

      {tutor.mal.length > 0 && (
        <div className="tutor__section">
          <span className="tutor__section-label tutor__section-label--mal">A mejorar</span>
          <ul className="tutor__list">
            {tutor.mal.map((item, i) => (
              <li key={i}>
                {item.problema}
                <span className="tutor__fix"> → {item.correccion}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
