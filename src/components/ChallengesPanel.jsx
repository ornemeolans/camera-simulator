import { CHALLENGES } from '../data/challenges'
import './ChallengesPanel.css'

/**
 * ChallengesPanel
 * ---------------
 * Lista de desafíos fotográficos con el mejor puntaje de cada uno. Elegir
 * un desafío cambia a su escena; la próxima foto que se saque se evalúa
 * contra sus criterios (el resultado aparece junto a la devolución del
 * tutor, en la galería). Los intentos vienen de `attempts` (persistidos en
 * storageService), así el progreso sigue ahí al recargar la página.
 */
export default function ChallengesPanel({ activeId, onSelect, attempts }) {
  const stats = {}
  for (const a of attempts) {
    const s = (stats[a.challengeId] ??= { best: 0, count: 0 })
    s.best = Math.max(s.best, a.score)
    s.count += 1
  }
  const completed = CHALLENGES.filter((c) => stats[c.id]?.best === 100).length

  return (
    <section className="challenges" aria-label="Desafíos">
      <header className="challenges__header">
        <h3 className="challenges__title">Desafíos</h3>
        <span className="challenges__progress">
          {completed} de {CHALLENGES.length} completados
        </span>
      </header>

      <ul className="challenges__list">
        {CHALLENGES.map((c) => {
          const active = c.id === activeId
          const s = stats[c.id]
          return (
            <li key={c.id} className={'challenges__item' + (active ? ' challenges__item--active' : '')}>
              <div className="challenges__item-head">
                <span className="challenges__item-title">{c.title}</span>
                <span className="challenges__item-best">
                  {s ? `Mejor: ${s.best}/100 · ${s.count} ${s.count === 1 ? 'intento' : 'intentos'}` : 'Sin intentos'}
                </span>
              </div>
              <p className="challenges__brief">{c.brief}</p>
              {active && (
                <ul className="challenges__criteria">
                  {c.criteria.map((cr) => (
                    <li key={cr.id}>{cr.label}</li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                className="challenges__btn"
                onClick={() => onSelect(active ? null : c.id)}
                aria-pressed={active}
              >
                {active ? 'Salir del desafío' : 'Probar este desafío'}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
