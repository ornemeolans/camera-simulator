import { Check, X, ArrowRight } from '@phosphor-icons/react'
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
    <section className="tutor surface" aria-labelledby="tutor-title">
      <div className="tutor__head">
        <h2 id="tutor-title" className="panel-title">
          Tutor de fotografía
        </h2>
        {typeof tutor.score === 'number' && (
          <span className="tutor__score">
            {tutor.score}
            <span className="tutor__score-max">/100</span>
          </span>
        )}
      </div>

      {challenge && (
        <div className={'tutor__challenge' + (challenge.passed ? ' tutor__challenge--passed' : '')}>
          <p className="tutor__challenge-head">
            <span>Desafío: {challenge.title}</span>
            <span className="tutor__challenge-score">
              {challenge.passed ? 'Superado, ' : ''}
              {challenge.score}/100
            </span>
          </p>
          <ul className="tutor__list tutor__list--checks">
            {challenge.results.map((r) => (
              <li key={r.id} className={r.ok ? 'tutor__check tutor__check--ok' : 'tutor__check'}>
                <span className="tutor__check-icon" aria-hidden="true">
                  {r.ok ? <Check size={12} weight="bold" /> : <X size={12} weight="bold" />}
                </span>
                <span className="sr-only">{r.ok ? 'Cumplido: ' : 'No cumplido: '}</span>
                {r.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {tutor.bien.length > 0 && (
        <div className="tutor__section">
          <h3 className="tutor__section-label">Bien</h3>
          <ul className="tutor__list">
            {tutor.bien.map((texto, i) => (
              <li key={i}>{texto}</li>
            ))}
          </ul>
        </div>
      )}

      {tutor.mal.length > 0 && (
        <div className="tutor__section">
          <h3 className="tutor__section-label tutor__section-label--mal">A mejorar</h3>
          <ul className="tutor__list">
            {tutor.mal.map((item, i) => (
              <li key={i}>
                {item.problema}
                <span className="tutor__fix">
                  <ArrowRight size={13} weight="bold" aria-hidden="true" />
                  {item.correccion}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
