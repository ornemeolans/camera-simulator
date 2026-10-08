import { useEffect, useRef, useState } from 'react'
import Viewfinder from './components/Viewfinder.jsx'
import ControlPanel from './components/ControlPanel.jsx'
import CapturesGallery from './components/CapturesGallery.jsx'
import PresetsPanel from './components/PresetsPanel.jsx'
import ScenePanel from './components/ScenePanel.jsx'
import ChallengesPanel from './components/ChallengesPanel.jsx'
import {
  listCaptures,
  saveCapture,
  deleteCapture,
  listPresets,
  savePreset,
  deletePreset,
  listAttempts,
  saveAttempt,
} from './services/storageService'
import { analyzeCapture } from './services/photoTutorService'
import { DEFAULT_SCENE_ID, getScene, resolveWhiteBalanceTint } from './data/scenes'
import { getChallenge, evaluateChallenge } from './data/challenges'
import {
  SHUTTER_SPEEDS,
  APERTURES,
  ISOS,
  FOCAL_LENGTHS,
  WHITE_BALANCES,
  EXPOSURE_COMP_STEPS,
  DEFAULT_SHUTTER_INDEX,
  DEFAULT_APERTURE_INDEX,
  DEFAULT_ISO_INDEX,
  DEFAULT_FOCAL_INDEX,
  DEFAULT_WB_INDEX,
  DEFAULT_EXPCOMP_INDEX,
  isShutterEditable,
  isApertureEditable,
  isIsoEditable,
  effectiveIndices,
  computeExposureStops,
} from './data/cameraSettings'
import { Aperture } from '@phosphor-icons/react'
import './App.css'

export default function App() {
  const [mode, setMode] = useState('M')
  const [shutterIndex, setShutterIndex] = useState(DEFAULT_SHUTTER_INDEX)
  const [apertureIndex, setApertureIndex] = useState(DEFAULT_APERTURE_INDEX)
  const [isoIndex, setIsoIndex] = useState(DEFAULT_ISO_INDEX)
  const [focalIndex, setFocalIndex] = useState(DEFAULT_FOCAL_INDEX)
  const [wbIndex, setWbIndex] = useState(DEFAULT_WB_INDEX)
  const [expCompIndex, setExpCompIndex] = useState(DEFAULT_EXPCOMP_INDEX)
  const [isFlashing, setIsFlashing] = useState(false)

  // Escena (dónde se saca la foto), foto propia opcional, histograma y
  // desafío activo. La escena define la luz: cuánta hay (lightStops) y de
  // qué color es (balance de blancos correcto) — ver data/scenes.js.
  const [sceneId, setSceneId] = useState(DEFAULT_SCENE_ID)
  const [customPhotoUrl, setCustomPhotoUrl] = useState(null)
  const [showHistogram, setShowHistogram] = useState(false)
  const [activeChallengeId, setActiveChallengeId] = useState(null)

  // Capturas y presets persistidos (Firestore si hay un proyecto
  // configurado, si no localStorage — ver services/storageService.js). Se
  // cargan una sola vez al montar la app, así la galería y la lista de
  // ajustes guardados siguen ahí aunque se recargue la página.
  const [captures, setCaptures] = useState([])
  const [presets, setPresets] = useState([])
  // Historial de intentos de desafíos (progreso), persistido igual que lo demás.
  const [attempts, setAttempts] = useState([])

  useEffect(() => {
    listCaptures().then(setCaptures).catch(() => setCaptures([]))
    listPresets().then(setPresets).catch(() => setPresets([]))
    listAttempts().then(setAttempts).catch(() => setAttempts([]))
  }, [])

  // El objectURL de una foto propia ocupa memoria hasta que se libera: lo
  // soltamos al reemplazarla o al cerrar la app.
  useEffect(() => () => customPhotoUrl && URL.revokeObjectURL(customPhotoUrl), [customPhotoUrl])

  const viewfinderRef = useRef(null)

  const expCompStops = EXPOSURE_COMP_STEPS[expCompIndex].stops
  const scene = getScene(sceneId)
  const activeChallenge = getChallenge(activeChallengeId)

  // Cuando un parámetro no es editable en el modo actual (por ejemplo la
  // apertura en modo S), la cámara lo "calcula sola" con el fotómetro
  // simulado (ver effectiveIndices en cameraSettings.js). Calculamos esto
  // UNA vez y lo usamos para la estela de movimiento, la exposición Y lo
  // que se muestra en pantalla, así todo el simulador está de acuerdo
  // sobre qué valores están "realmente" activos en cada momento. La
  // compensación de exposición sólo tiene efecto fuera de M (ver
  // isExposureCompEditable) — en M siempre se pasa 0 porque effectiveIndices
  // la ignora igual en ese modo, pero así queda explícito acá también.
  const effective = effectiveIndices(
    mode,
    shutterIndex,
    apertureIndex,
    isoIndex,
    mode === 'M' ? 0 : expCompStops,
    scene.lightStops,
  )
  const effectiveShutterSeconds = SHUTTER_SPEEDS[effective.shutterIndex].seconds
  const effectiveApertureValue = APERTURES[effective.apertureIndex].value
  const effectiveIsoValue = ISOS[effective.isoIndex].value
  const focalLengthMm = FOCAL_LENGTHS[focalIndex].mm
  // El EV real de la toma incluye la luz de la escena: con los mismos
  // ajustes, una noche (-3) sale 3 pasos más oscura que un día soleado.
  const exposureStops = computeExposureStops(effective) + scene.lightStops

  const whiteBalance = WHITE_BALANCES[wbIndex]
  const whiteBalanceTint = resolveWhiteBalanceTint(whiteBalance, scene)

  function handleSceneChange(id) {
    setSceneId(id)
    // Si cambiás a mano a una escena distinta de la del desafío, el
    // desafío deja de tener sentido (su consigna depende de esa luz).
    if (activeChallenge && activeChallenge.sceneId !== id) setActiveChallengeId(null)
  }

  function handleCustomPhoto(file) {
    setCustomPhotoUrl(URL.createObjectURL(file))
    setSceneId('custom')
    setActiveChallengeId(null)
  }

  function handleSelectChallenge(id) {
    setActiveChallengeId(id)
    const challenge = getChallenge(id)
    if (challenge) setSceneId(challenge.sceneId)
  }

  function handleShutterPress() {
    setIsFlashing(true)
    setTimeout(() => setIsFlashing(false), 150)

    const captured = viewfinderRef.current?.capture()
    if (!captured) return
    const { dataUrl, subjectFrac } = captured

    // El tutor de fotografía analiza los ajustes EFECTIVOS (los mismos que
    // se usaron para exponer de verdad) más dónde quedó el sujeto en el
    // cuadro, y devuelve una devolución corta — se calcula UNA sola vez acá
    // y se guarda junto con la captura (ver photoTutorService.js), así no
    // hay que volver a analizarla cada vez que se muestra la galería.
    const shot = {
      shutterSeconds: effectiveShutterSeconds,
      apertureValue: effectiveApertureValue,
      isoValue: effectiveIsoValue,
      exposureStops,
      wbId: whiteBalance.id,
      subjectFrac,
    }
    const tutor = analyzeCapture({ ...shot, sceneId })

    // Si hay un desafío activo, la misma toma se evalúa también contra sus
    // criterios y el intento queda en el historial de progreso.
    const challenge = activeChallenge ? evaluateChallenge(activeChallenge, shot) : null
    if (challenge) {
      const attempt = { challengeId: challenge.challengeId, score: challenge.score, passed: challenge.passed }
      setAttempts((prev) => [attempt, ...prev])
      saveAttempt(attempt).catch(() => {})
    }

    const capture = {
      dataUrl,
      mode,
      // Siempre el valor EFECTIVO (lo que la cámara realmente usó para
      // exponer, editado a mano o calculado por el fotómetro) — así el
      // pie de foto queda igual de correcto en M que en A/S/AUTO.
      shutterLabel: SHUTTER_SPEEDS[effective.shutterIndex].label,
      apertureLabel: APERTURES[effective.apertureIndex].label,
      isoLabel: ISOS[effective.isoIndex].label,
      wbLabel: whiteBalance.label,
      exposureStops,
      sceneId,
      sceneLabel: scene.label,
      tutor,
      ...(challenge ? { challenge } : {}),
    }

    // Optimista: la foto aparece en la galería al instante; el guardado
    // real (Firestore o localStorage) pasa en segundo plano. Si falla (por
    // ejemplo sin conexión con Firestore configurado), igual queda en la
    // galería de esta sesión aunque no se haya persistido.
    const optimisticId = `pending-${Date.now()}`
    setCaptures((prev) => [{ id: optimisticId, ...capture }, ...prev].slice(0, 12))

    saveCapture(capture)
      .then((saved) => {
        setCaptures((prev) => prev.map((c) => (c.id === optimisticId ? saved : c)))
      })
      .catch(() => {
        // Se queda el id "pending" — se pierde al recargar la página, pero
        // no rompe la sesión actual.
      })
  }

  function handleSavePreset(name) {
    const preset = {
      name,
      mode,
      shutterIndex,
      apertureIndex,
      isoIndex,
      focalIndex,
      wbIndex,
      expCompIndex,
      // Etiquetas legibles para mostrar en la lista sin tener que resolver
      // los índices de nuevo ahí.
      shutterLabel: SHUTTER_SPEEDS[shutterIndex].label,
      apertureLabel: APERTURES[apertureIndex].label,
      isoLabel: ISOS[isoIndex].label,
      focalLabel: FOCAL_LENGTHS[focalIndex].label,
      wbLabel: whiteBalance.label,
    }
    const optimisticId = `pending-${Date.now()}`
    setPresets((prev) => [{ id: optimisticId, ...preset }, ...prev])
    savePreset(preset)
      .then((saved) => setPresets((prev) => prev.map((p) => (p.id === optimisticId ? saved : p))))
      .catch(() => {})
  }

  function handleLoadPreset(preset) {
    setMode(preset.mode)
    setShutterIndex(preset.shutterIndex)
    setApertureIndex(preset.apertureIndex)
    setIsoIndex(preset.isoIndex)
    setFocalIndex(preset.focalIndex)
    setWbIndex(preset.wbIndex)
    setExpCompIndex(preset.expCompIndex)
  }

  function handleDeleteCapture(id) {
    setCaptures((prev) => prev.filter((c) => c.id !== id))
    deleteCapture(id).catch(() => {})
  }

  function handleDeletePreset(id) {
    setPresets((prev) => prev.filter((p) => p.id !== id))
    deletePreset(id).catch(() => {})
  }

  return (
    <div className="app">
      <header className="app__header enter">
        <span className="app__mark" aria-hidden="true">
          <Aperture size={22} weight="duotone" />
        </span>
        <div>
          <h1>Simulador de Cámara</h1>
          <p className="app__subtitle">Simulador interactivo de réflex, inspirado en la Nikon D7200</p>
        </div>
      </header>

      <main className="app__main">
        <div className="app__viewfinder-wrap enter" style={{ '--i': 1 }}>
          <Viewfinder
            ref={viewfinderRef}
            width={960}
            height={640}
            shutterSpeedSeconds={effectiveShutterSeconds}
            exposureStops={exposureStops}
            apertureValue={effectiveApertureValue}
            isoValue={effectiveIsoValue}
            focalLengthMm={focalLengthMm}
            whiteBalanceTint={whiteBalanceTint}
            scene={scene}
            customPhotoUrl={customPhotoUrl}
            showHistogram={showHistogram}
          />
          {isFlashing && <div className="app__flash" />}
          <button
            type="button"
            className="app__shutter-btn"
            onClick={handleShutterPress}
            title="Disparar"
            aria-label="Disparar"
          />
          <div className="app__hud">
            <span className="app__hud-mode">{mode}</span>
            {/* app__hud-metered marca (con un estilo sutil, no con la
                palabra "AUTO") los valores que decidió el fotómetro y no
                vos — así se ve el número real que está usando la cámara,
                no un genérico "AUTO" que no dice nada. */}
            <span className={isShutterEditable(mode) ? undefined : 'app__hud-metered'}>
              {SHUTTER_SPEEDS[effective.shutterIndex].label}
            </span>
            <span className={isApertureEditable(mode) ? undefined : 'app__hud-metered'}>
              {APERTURES[effective.apertureIndex].label}
            </span>
            <span className={isIsoEditable(mode) ? undefined : 'app__hud-metered'}>
              ISO {ISOS[effective.isoIndex].label}
            </span>
            <span
              className={
                'app__hud-ev' +
                (exposureStops > 0.4 ? ' app__hud-ev--over' : exposureStops < -0.4 ? ' app__hud-ev--under' : '')
              }
            >
              {exposureStops > 0 ? '+' : ''}
              {exposureStops.toFixed(1)} EV
            </span>
          </div>
        </div>

        <CapturesGallery captures={captures} onDelete={handleDeleteCapture} />

        <ScenePanel
          sceneId={sceneId}
          onSceneChange={handleSceneChange}
          hasCustomPhoto={Boolean(customPhotoUrl)}
          onCustomPhoto={handleCustomPhoto}
          showHistogram={showHistogram}
          onToggleHistogram={setShowHistogram}
        />

        <ControlPanel
          mode={mode}
          onModeChange={setMode}
          shutterIndex={shutterIndex}
          onShutterIndexChange={setShutterIndex}
          effectiveShutterIndex={effective.shutterIndex}
          apertureIndex={apertureIndex}
          onApertureIndexChange={setApertureIndex}
          effectiveApertureIndex={effective.apertureIndex}
          isoIndex={isoIndex}
          onIsoIndexChange={setIsoIndex}
          effectiveIsoIndex={effective.isoIndex}
          focalIndex={focalIndex}
          onFocalIndexChange={setFocalIndex}
          wbIndex={wbIndex}
          onWbIndexChange={setWbIndex}
          expCompIndex={expCompIndex}
          onExpCompIndexChange={setExpCompIndex}
        />

        <ChallengesPanel
          activeId={activeChallengeId}
          onSelect={handleSelectChallenge}
          attempts={attempts}
        />

        <PresetsPanel
          presets={presets}
          onSave={handleSavePreset}
          onLoad={handleLoadPreset}
          onDelete={handleDeletePreset}
        />
      </main>
    </div>
  )
}
