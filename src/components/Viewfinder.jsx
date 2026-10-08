import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import './Viewfinder.css'
import eagleAsset from '../assets/eagle.png'
import { computeZoomFactor, shutterSpeedFactor } from '../data/cameraSettings'
import { SCENES, localPhotoUrl } from '../data/scenes'
import { renderProceduralScene } from '../scenes/proceduralScene'

/**
 * Viewfinder
 * ----------
 * El visor en vivo de la cámara. La base de la escena es una FOTO real (no
 * formas vectoriales), y encima dibujamos capas animadas que simulan
 * "atmósfera" viva: sombras de nubes que se desplazan, un reflejo/flare de
 * sol que pulsa, grano (según el ISO) y un viñeteado tipo lente.
 *
 * Por qué así:
 * - Una foto real le da el realismo que una escena dibujada a mano no
 *   puede lograr fácilmente.
 * - Las capas de atmósfera se dibujan por ENCIMA de la foto con
 *   composición de canvas (multiply/screen), así se sienten parte de la
 *   luz de la escena y no un dibujo pegado arriba.
 * - Si la foto no carga (sin internet, bloqueada, etc.) cae a una escena
 *   de emergencia dibujada a mano, para que el visor nunca se rompa.
 * - La apertura controla cuánto se desenfoca el FONDO (foto + nubes +
 *   flare) respecto del sujeto, que siempre queda nítido — profundidad
 *   de campo, igual que en una réflex real.
 *
 * (Probamos en algún momento un GIF animado acá en vez de una foto fija,
 * para que el fondo se mueva solo — quedó revertido por ahora porque el
 * clip elegido no se veía bien. Si se retoma esa idea, sólo hay que volver
 * a apuntar la foto de la escena (data/scenes.js) a un GIF: el resto del dibujado ya funciona
 * igual para cualquier imagen, fija o animada.)
 */

// La foto base ya no es una constante: depende de la escena elegida (ver
// data/scenes.js). Orden de preferencia: foto subida por la persona →
// foto propia en src/assets/scenes/<id>.jpg → foto remota de la escena (si
// la tiene) → dibujo generado por código (scenes/proceduralScene.js), que
// además es lo que se muestra mientras la foto carga y si la carga falla.

// Cuánta "historia" de posiciones guardamos como máximo. El obturador no
// cambia este número directamente — decide cuántas de esas posiciones
// recientes se USAN para dibujar la estela en cada frame (ver
// shutterToTrailParams más abajo).
const MAX_TRAIL_HISTORY = 20

// Traduce una velocidad de obturación (en segundos) a "cuánta estela se
// ve". La escala es logarítmica porque las velocidades de obturación
// también lo son (1/2000 a 1" es un rango enorme, no lineal): así 1/500 y
// 1/250 se sienten tan distintas entre sí como 1/2 y 1".
function shutterToTrailParams(seconds) {
  const t = shutterSpeedFactor(seconds)
  const historyLength = Math.round(1 + t * (MAX_TRAIL_HISTORY - 1))
  const alphaScale = 0.4 + t * 0.9 // obturador lento = estela más marcada, no solo más larga
  return { historyLength, alphaScale }
}

// Traduce el valor de apertura (el número f) en cuánto se desenfoca el
// FONDO respecto del sujeto — el efecto de profundidad de campo de una
// réflex real. Un diafragma más ABIERTO (número f chico, como f/1.8) deja
// el fondo bien desenfocado y sólo el sujeto en foco; uno más CERRADO
// (f/22) deja casi todo nítido. Escala logarítmica por el mismo motivo que
// en shutterToTrailParams: los números f no son lineales, cada paso
// multiplica por √2. El exponente 1.4 al final exagera un poco la
// diferencia en los extremos (f/1.8 se nota MUY desenfocado), que es como
// se percibe en una cámara real más que una rampa perfectamente pareja.
function apertureToBackgroundBlur(fValue) {
  const minF = 1.8
  const maxF = 22
  const clamped = Math.min(Math.max(fValue, minF), maxF)
  const t = (Math.log(clamped) - Math.log(minF)) / (Math.log(maxF) - Math.log(minF))
  const maxBlurPx = 14
  return maxBlurPx * Math.pow(1 - t, 1.4)
}

// Convierte "pasos de exposición" (ver computeExposureStops en
// cameraSettings.js) en un filtro CSS de brillo/contraste que se le aplica
// a la escena entera al final. Cada paso duplica o divide a la mitad la
// luz, así que el brillo escala como 2^pasos — igual que la exposición
// real. El contraste baja un poco cuando está sobreexpuesta, porque una
// foto muy quemada no sólo se ve más clara: se ve "lavada".
function exposureToFilter(stops) {
  const clamped = Math.min(Math.max(stops, -6), 6)
  const brightnessPct = Math.round(100 * Math.pow(2, clamped))
  // Un toque de "lavado" en la sobreexposición moderada (fotos quemadas
  // reales pierden algo de contraste, no sólo se aclaran) — pero suave,
  // para no pelearse con el brillo: los filtros de canvas se aplican en
  // cadena (brightness primero, contrast después), así que si el
  // contraste bajara demasiado tiraría los blancos ya "quemados" de
  // vuelta hacia el gris en vez de dejarlos blancos.
  const contrastPct = clamped > 0 ? Math.round(Math.max(88, 100 - clamped * 2)) : 100
  // Grado de color "vintage analógico" sutil: un toque de sepia y un pelín
  // menos saturación, para que la escena tenga ese aire de foto analógica
  // vieja (colores algo desteñidos, cálidos) sin taparse como un filtro de
  // Instagram. Va SIEMPRE encima del brillo/contraste de la exposición —
  // nunca lo reemplaza, sólo lo "tiñe" un poco.
  return `brightness(${brightnessPct}%) contrast(${contrastPct}%) sepia(16%) saturate(90%)`
}

// Traduce el ISO en cuánto grano se ve — cuanto más alto el ISO, más
// "amplificada" está la señal del sensor y más ruido se nota, igual que en
// una réflex real. Escala logarítmica otra vez (ISO 100→200→400... también
// duplica cada paso). A ISO 100 el grano queda casi invisible; a ISO 6400,
// bien marcado.
function isoToGrainAlpha(isoValue) {
  const minIso = 100
  const maxIso = 6400
  const clamped = Math.min(Math.max(isoValue, minIso), maxIso)
  const t = (Math.log(clamped) - Math.log(minIso)) / (Math.log(maxIso) - Math.log(minIso))
  return 0.12 + t * 0.98
}

const Viewfinder = forwardRef(function Viewfinder(
  {
    width = 960,
    height = 640,
    shutterSpeedSeconds = 1 / 125,
    exposureStops = 0,
    apertureValue = 5.6,
    isoValue = 400,
    focalLengthMm = 50,
    // { color: '#rrggbb', alpha: 0..1 } o null (balance de blancos neutro).
    whiteBalanceTint = null,
    // Escena activa (data/scenes.js) y, si la persona subió una foto
    // propia, su URL (blob:) para usarla de fondo.
    scene = SCENES[0],
    customPhotoUrl = null,
    // Dibuja el histograma de luminosidad sobre el visor.
    showHistogram = false,
  },
  ref,
) {
  const canvasRef = useRef(null)

  // El canvas VISIBLE sólo hace un trabajo: mostrar la escena ya dibujada
  // con el ajuste de exposición aplicado encima. Toda la escena en sí
  // (foto, águila, nubes, grano...) se dibuja primero en un canvas
  // invisible (`offscreenRef`) exactamente como antes; al final de cada
  // frame lo "copiamos" al canvas visible con un filtro de brillo/
  // contraste — un filtro de canvas sólo afecta lo que se dibuja MIENTRAS
  // está activo, así que necesitamos la escena ya lista en otro lado para
  // poder aplicárselo de una sola vez.
  const offscreenRef = useRef(null)
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'

  // El obturador y la exposición pueden cambiar todo el tiempo mientras la
  // persona juega con los diales, y no queremos reiniciar el efecto de
  // abajo cada vez (eso volvería a cargar la foto y el águila desde cero).
  // Por eso los guardamos en refs: el loop de animación lee siempre el
  // valor más reciente sin que React tenga que re-crear el canvas.
  const shutterRef = useRef(shutterSpeedSeconds)
  useEffect(() => {
    shutterRef.current = shutterSpeedSeconds
  }, [shutterSpeedSeconds])

  const exposureRef = useRef(exposureStops)
  useEffect(() => {
    exposureRef.current = exposureStops
  }, [exposureStops])

  const apertureRef = useRef(apertureValue)
  useEffect(() => {
    apertureRef.current = apertureValue
  }, [apertureValue])

  const isoRef = useRef(isoValue)
  useEffect(() => {
    isoRef.current = isoValue
  }, [isoValue])

  const focalRef = useRef(focalLengthMm)
  useEffect(() => {
    focalRef.current = focalLengthMm
  }, [focalLengthMm])

  const whiteBalanceRef = useRef(whiteBalanceTint)
  useEffect(() => {
    whiteBalanceRef.current = whiteBalanceTint
  }, [whiteBalanceTint])

  const sceneRef = useRef(scene)
  useEffect(() => {
    sceneRef.current = scene
  }, [scene])

  const showHistogramRef = useRef(showHistogram)
  useEffect(() => {
    showHistogramRef.current = showHistogram
  }, [showHistogram])

  const histogramCanvasRef = useRef(null)

  // Fuente del fondo actual: { el, w, h, crop } (el = imagen o canvas
  // pre-renderizado). Vive en una ref (no en el closure del efecto de
  // dibujo) para poder cambiar de escena sin reiniciar el loop de
  // animación ni recargar el águila.
  const sourceRef = useRef(null)

  // Dónde está el sujeto (el águila) en el cuadro, como fracción 0..1 del
  // ancho/alto — se actualiza en CADA frame dentro del loop de animación
  // (ver drawMovingSubject). La usa capture() para que el tutor de
  // fotografía (photoTutorService.js) pueda evaluar la composición —
  // regla de tercios, sujeto cortado por el borde, etc. — con la posición
  // EXACTA que tenía el sujeto en el instante del disparo, no una
  // aproximación.
  const subjectFracRef = useRef({ x: 0.5, y: 0.3 })

  // Le da a quien use <Viewfinder ref={...}> una forma de "apretar el
  // disparador" desde afuera: capture() devuelve el frame actual (ya con
  // la exposición aplicada) como imagen, más la posición del sujeto en ese
  // instante — todo lo que hace falta para guardar la foto y para que el
  // tutor de fotografía la analice.
  useImperativeHandle(ref, () => ({
    capture() {
      if (!canvasRef.current) return null
      try {
        // Se guarda REDUCIDA (640 px de ancho, JPEG 0.8): la foto vive dentro
        // de un documento de Firestore (tope de 1 MB) o de localStorage
        // (~5 MB en total), y la versión a 960 px con calidad 0.92 pesaba
        // 3-4 veces más sin que se note en una tarjeta de 360 px de ancho.
        // (Con Firebase Storage —que pide plan Blaze— la imagen iría fuera
        // del documento y este recorte no haría falta.)
        const small = document.createElement('canvas')
        small.width = 640
        small.height = Math.round((640 * canvasRef.current.height) / canvasRef.current.width)
        small.getContext('2d').drawImage(canvasRef.current, 0, 0, small.width, small.height)
        const dataUrl = small.toDataURL('image/jpeg', 0.8)
        return { dataUrl, subjectFrac: { ...subjectFracRef.current } }
      } catch (err) {
        // Si el fondo viene de un servidor que no habilita CORS, el canvas
        // queda "contaminado" y toDataURL tira un error de seguridad en vez
        // de devolver la imagen. Mejor avisar por consola y devolver null
        // (App ya maneja el caso de que capture() no devuelva nada) que
        // romper toda la app por no poder sacar la foto.
        console.warn('No se pudo capturar el cuadro actual (¿el fondo no tiene CORS habilitado?):', err)
        return null
      }
    },
  }))

  // Carga del fondo de la escena (cada vez que cambia la escena o la foto
  // subida). Primero se muestra el dibujo generado (instantáneo), y si hay
  // una foto real se reemplaza cuando termina de cargar.
  useEffect(() => {
    let cancelled = false
    function applySource(el, w, h) {
      if (cancelled) return
      sourceRef.current = { el, w, h, crop: computeCoverCrop(w, h, width, height) }
    }

    const procedural = scene.palette ? renderProceduralScene(scene) : null
    if (procedural) applySource(procedural, procedural.width, procedural.height)
    else sourceRef.current = null
    setStatus(procedural ? 'ready' : 'loading')

    const url = customPhotoUrl ?? (scene.id === 'custom' ? null : localPhotoUrl(scene.id) ?? scene.remotePhotoUrl ?? null)
    if (url) {
      const img = new Image()
      img.crossOrigin = 'anonymous' // necesario para poder dibujarla en canvas sin "contaminarlo" (ver capture())
      img.onload = () => {
        applySource(img, img.naturalWidth, img.naturalHeight)
        if (!cancelled) setStatus('ready')
      }
      img.onerror = () => {
        if (!cancelled) setStatus(procedural ? 'ready' : 'error')
      }
      img.src = url
    } else if (!procedural) {
      setStatus('ready')
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, customPhotoUrl, width, height])

  useEffect(() => {
    const canvas = canvasRef.current
    const visibleCtx = canvas.getContext('2d')

    const offscreen = document.createElement('canvas')
    offscreen.width = width
    offscreen.height = height
    offscreenRef.current = offscreen
    const ctx = offscreen.getContext('2d')

    // --- Carga del sujeto en movimiento (foto real de un águila, con
    // fondo transparente) ---
    const eagle = new Image()
    let eagleReady = false
    eagle.onload = () => { eagleReady = true }
    eagle.src = eagleAsset

    // --- Capas de atmósfera animadas (se usan con la foto o con el fallback) ---
    const cloudShadows = Array.from({ length: 3 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height * 0.6,
      radius: 120 + Math.random() * 160,
      speed: 8 + Math.random() * 14,
    }))

    // --- Sujeto en movimiento ---
    // El águila es nuestro "sujeto de prueba": cuando armemos el control
    // de velocidad de obturación, vamos a usar su posición en cada frame
    // para decidir si se dibuja nítida (obturador rápido, "congela" el
    // movimiento) o con una estela de motion blur (obturador lento). Por
    // eso se mueve a velocidad constante y bien visible: así el efecto se
    // va a notar claro más adelante.
    const subject = {
      x: -80,
      y: height * 0.3,
      history: [], // últimas posiciones — se usan para dibujar la estela de movimiento
    }
    const BASE_SUBJECT_SPEED = 150 // píxeles por segundo, a 50mm ("zoom x1")
    const EAGLE_DISPLAY_WIDTH = 150 // ancho en pantalla a 50mm; la foto original es mucho más grande

    // Cuánto "acerca" el lente actual, aplicado tanto al tamaño del sujeto
    // en pantalla como a lo rápido que parece cruzar el cuadro — a más
    // teleobjetivo, más grande se ve y más rápido parece moverse (cuesta
    // más seguirlo), justo como pasa con un lente largo de verdad. El
    // exponente 0.7 suaviza los extremos (200mm no llega a verse 4 veces
    // más grande/rápido) para que el efecto se sienta natural y no exagerado.
    function lensDisplayScale(focalMm) {
      return Math.pow(computeZoomFactor(focalMm), 0.7)
    }

    // --- Geometría para el aleteo ---
    // La foto es UNA sola imagen con las dos alas ya extendidas. Para que
    // "aleteen" sin tener fotos separadas de cada ala, la partimos en dos
    // mitades (recortando con un clip) justo por el cuerpo, y rotamos cada
    // mitad un poquito alrededor de ese punto — en espejo, para que las dos
    // puntas suban y bajen juntas, como un aleteo real. EAGLE_PIVOT_FRAC es
    // dónde está ese punto (a ojo, sobre la foto) como fracción del ancho y
    // alto de la imagen; EAGLE_AXIS_ANGLE es el ángulo con el que las alas
    // salen del cuerpo en la foto original.
    const EAGLE_PIVOT_FRAC = { x: 0.465, y: 0.636 }
    const EAGLE_AXIS_ANGLE = (29 * Math.PI) / 180
    const FLAP_AMPLITUDE = 0.45 // radianes (~26°) — qué tan arriba/abajo llega cada ala
    const FLAP_SPEED = 2.2 // más alto = aletea más rápido; las águilas reales aletean lento y potente

    // Textura de grano: un patrón chico de ruido que se repite en mosaico.
    // Generarlo una sola vez (no en cada frame) es clave para el rendimiento.
    const grainCanvas = document.createElement('canvas')
    grainCanvas.width = 128
    grainCanvas.height = 128
    const grainCtx = grainCanvas.getContext('2d')
    const grainImage = grainCtx.createImageData(128, 128)
    for (let i = 0; i < grainImage.data.length; i += 4) {
      const v = Math.random() * 255
      grainImage.data[i] = v
      grainImage.data[i + 1] = v
      grainImage.data[i + 2] = v
      grainImage.data[i + 3] = 22 // alpha bajo: el grano tiene que ser sutil
    }
    grainCtx.putImageData(grainImage, 0, 0)
    const grainPattern = ctx.createPattern(grainCanvas, 'repeat')

    let animationId
    let lastTime = performance.now()

    // --- Fallback: escena dibujada a mano si la foto no carga ---
    function drawFallbackScene() {
      const sky = ctx.createLinearGradient(0, 0, 0, height * 0.65)
      sky.addColorStop(0, '#4fa8e0')
      sky.addColorStop(1, '#cfe9fb')
      ctx.fillStyle = sky
      ctx.fillRect(0, 0, width, height * 0.65)

      const ground = ctx.createLinearGradient(0, height * 0.65, 0, height)
      ground.addColorStop(0, '#6fb84f')
      ground.addColorStop(1, '#3f7d33')
      ctx.fillStyle = ground
      ctx.fillRect(0, height * 0.65, width, height * 0.35)
    }

    function drawCloudShadows(dt) {
      ctx.save()
      ctx.globalCompositeOperation = 'multiply'
      for (const shadow of cloudShadows) {
        shadow.x += shadow.speed * dt
        if (shadow.x - shadow.radius > width) shadow.x = -shadow.radius

        const gradient = ctx.createRadialGradient(
          shadow.x, shadow.y, 0,
          shadow.x, shadow.y, shadow.radius,
        )
        gradient.addColorStop(0, 'rgba(120, 130, 145, 0.22)')
        gradient.addColorStop(1, 'rgba(120, 130, 145, 0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(shadow.x, shadow.y, shadow.radius, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.restore()
    }

    function drawSunFlare(t) {
      const flareX = width * 0.84
      const flareY = height * 0.16
      const pulse = 0.75 + Math.sin(t * 0.8) * 0.15 // brillo respirando lentamente

      ctx.save()
      ctx.globalCompositeOperation = 'screen'
      // Tono más cálido/ambarino que antes (era casi blanco): se siente más
      // "light leak" de rollo analógico que reflejo de lente moderno.
      const glow = ctx.createRadialGradient(flareX, flareY, 0, flareX, flareY, 140)
      glow.addColorStop(0, `rgba(255, 214, 158, ${0.55 * pulse})`)
      glow.addColorStop(1, 'rgba(255, 214, 158, 0)')
      ctx.fillStyle = glow
      ctx.fillRect(flareX - 140, flareY - 140, 280, 280)
      ctx.restore()
    }

    // Dibuja la foto del águila en una posición dada. Se reutiliza tanto
    // para el águila "nítida" (arriba de todo) como para cada copia
    // fantasma de la estela — lo único que cambia es la opacidad, el
    // desenfoque y una leve inclinación de vuelo, así que separarlo en su
    // propia función evita repetir la lógica de dibujo varias veces.
    function drawEagle(x, y, bank, alpha, blurPx) {
      if (!eagleReady) return
      const displayW = EAGLE_DISPLAY_WIDTH * lensDisplayScale(focalRef.current)
      const displayH = displayW * (eagle.naturalHeight / eagle.naturalWidth)
      const pivotX = EAGLE_PIVOT_FRAC.x * displayW
      const pivotY = EAGLE_PIVOT_FRAC.y * displayH

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(bank) // leve "banqueo" al planear, no queda pegado horizontal siempre
      ctx.globalAlpha = alpha
      ctx.filter = blurPx ? `blur(${blurPx}px)` : 'none'
      ctx.drawImage(eagle, -pivotX, -pivotY, displayW, displayH)
      ctx.restore()
    }

    // Dibuja UNA mitad del águila (clipSide = -1 recorta el ala izquierda,
    // +1 la derecha), rotada `rotationAngle` alrededor del punto donde las
    // alas se unen al cuerpo. El recorte (clip) se define alineando el
    // canvas con el eje del ala (EAGLE_AXIS_ANGLE) y cortando todo lo que
    // quede de un lado; ese recorte queda "fijo" aunque después rotemos de
    // nuevo para dibujar — por eso se puede desarmar el giro con
    // -EAGLE_AXIS_ANGLE sin perder el recorte ya hecho.
    function drawEagleHalf(displayW, displayH, pivotX, pivotY, clipSide, rotationAngle) {
      ctx.save()
      ctx.rotate(EAGLE_AXIS_ANGLE)
      ctx.beginPath()
      if (clipSide < 0) ctx.rect(-4000, -4000, 4000, 8000)
      else ctx.rect(0, -4000, 4000, 8000)
      ctx.clip()
      ctx.rotate(-EAGLE_AXIS_ANGLE) // el clip ya quedó fijo; volvemos a la orientación normal
      ctx.rotate(rotationAngle) // giro del aleteo, alrededor del mismo punto (0,0) = el cuerpo
      ctx.drawImage(eagle, -pivotX, -pivotY, displayW, displayH)
      ctx.restore()
    }

    function drawEagleFlapping(x, y, bank, flapAngle, alpha, blurPx) {
      if (!eagleReady) return
      const displayW = EAGLE_DISPLAY_WIDTH * lensDisplayScale(focalRef.current)
      const displayH = displayW * (eagle.naturalHeight / eagle.naturalWidth)
      const pivotX = EAGLE_PIVOT_FRAC.x * displayW
      const pivotY = EAGLE_PIVOT_FRAC.y * displayH

      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(bank)
      ctx.globalAlpha = alpha
      ctx.filter = blurPx ? `blur(${blurPx}px)` : 'none'
      // Signo opuesto en cada mitad: dado que las dos alas salen del cuerpo
      // en direcciones OPUESTAS a lo largo del eje, para que las dos puntas
      // suban (o bajen) juntas cada mitad tiene que rotar al revés de la
      // otra alrededor del mismo eje. (Medido a mano sobre la foto: +flapAngle
      // en la izquierda y -flapAngle en la derecha suben ambas puntas juntas.)
      drawEagleHalf(displayW, displayH, pivotX, pivotY, -1, flapAngle)
      drawEagleHalf(displayW, displayH, pivotX, pivotY, 1, -flapAngle)
      ctx.restore()
    }

    function drawMovingSubject(t, dt) {
      const speed = BASE_SUBJECT_SPEED * lensDisplayScale(focalRef.current)
      subject.x += speed * dt
      if (subject.x > width + 100) {
        subject.x = -100 // vuelve a entrar por la izquierda
        subject.history = [] // arranca una estela nueva, la vieja no tiene sentido
      }
      const y = subject.y + Math.sin(t * 0.6) * 10 // leve planeo, como aprovechando una corriente
      const bank = Math.sin(t * 0.4) * 0.06 // inclinación sutil de las alas al planear

      // Posición actual del sujeto como fracción del cuadro (0..1), para
      // que capture() se la pueda pasar al tutor de fotografía. Puede caer
      // levemente fuera de [0,1] cuando el águila está entrando o saliendo
      // del cuadro (subject.x arranca en -100 y llega hasta width+100) —
      // eso es justamente la señal que el tutor usa para avisar "sujeto
      // cortado por el borde", así que no la recortamos acá.
      subjectFracRef.current = { x: subject.x / width, y: y / height }

      // Guardamos la posición actual en el historial, y lo recortamos al
      // máximo posible (así no crece para siempre). Guardamos siempre el
      // máximo, aunque el obturador actual use menos — así, si la persona
      // pasa a un obturador más lento, la estela ya tiene "de dónde sacar"
      // frames sin esperar a que se acumulen.
      subject.history.push({ x: subject.x, y, bank })
      if (subject.history.length > MAX_TRAIL_HISTORY) subject.history.shift()

      // Acá es donde el obturador entra en juego: velocidades rápidas usan
      // poquitas posiciones recientes (o ninguna) → el águila queda casi
      // "congelada". Velocidades lentas usan muchas → estela larga y bien
      // marcada, como una exposición larga de verdad.
      const { historyLength, alphaScale } = shutterToTrailParams(shutterRef.current)
      const visibleHistory = subject.history.slice(-historyLength)

      // Estela: copias "fantasma" de frames anteriores, cada vez más tenues
      // y más desenfocadas cuanto más viejas. Esto es lo que hace que el
      // movimiento se LEA como movimiento (como en una foto real con algo
      // de motion blur) en vez de un objeto que simplemente teletransporta
      // de un frame al otro.
      const trailFrames = visibleHistory.slice(0, -1)
      trailFrames.forEach((frame, i) => {
        const progress = (i + 1) / trailFrames.length // 0 (más vieja) → 1 (más reciente)
        const alpha = (0.05 + progress * 0.18) * alphaScale
        const blurPx = (1 + (1 - progress) * 2.5) * (0.6 + alphaScale * 0.5)
        drawEagle(frame.x, frame.y, frame.bank, alpha, blurPx)
      })

      // El águila "actual", nítida (con un pelín de blur para que no se
      // vea recortada con tijera contra la foto de fondo), con las alas
      // aleteando de verdad.
      const current = subject.history[subject.history.length - 1]
      const flapAngle = FLAP_AMPLITUDE * Math.sin(t * FLAP_SPEED)
      drawEagleFlapping(current.x, current.y, current.bank, flapAngle, 0.95, 0.4)
    }

    function drawGrain(t) {
      ctx.save()
      ctx.globalAlpha = isoToGrainAlpha(isoRef.current)
      ctx.globalCompositeOperation = 'overlay'
      // Desplazamos el patrón levemente cada frame: sensación de grano "vivo",
      // igual que el ruido de un sensor real.
      ctx.translate((t * 15) % 128, (t * 9) % 128)
      ctx.fillStyle = grainPattern
      ctx.fillRect(-128, -128, width + 256, height + 256)
      ctx.restore()
    }

    function drawVignette() {
      const vignette = ctx.createRadialGradient(
        width / 2, height / 2, height * 0.35,
        width / 2, height / 2, height * 0.75,
      )
      // Viñeteado neutro casi negro (no negro puro), como la caída de luz
      // en los bordes de un lente real.
      vignette.addColorStop(0, 'rgba(8, 9, 11, 0)')
      vignette.addColorStop(1, 'rgba(8, 9, 11, 0.38)')
      ctx.fillStyle = vignette
      ctx.fillRect(0, 0, width, height)
    }

    // Tinte de balance de blancos: una capa de color pareja sobre TODA la
    // escena (fondo + sujeto + grano + viñeta), con mezcla 'overlay' para
    // que se sienta como un tinte de luz real y no como un filtro pegado
    // encima — 'overlay' oscurece los tonos oscuros y aclara los claros al
    // mezclar el color, en vez de simplemente taparlos.
    function drawWhiteBalanceTint() {
      const tint = whiteBalanceRef.current
      if (!tint || !tint.color || !tint.alpha) return
      const { r, g, b } = hexToRgb(tint.color)
      ctx.save()
      ctx.globalCompositeOperation = 'overlay'
      ctx.globalAlpha = tint.alpha
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Tinte propio de la LUZ de la escena (naranja de tungsteno de noche,
    // azulado de día nublado): igual que el balance de blancos, va sobre
    // todo el cuadro, sujeto incluido, porque la luz le llega a todo por
    // igual. El balance de blancos elegido lo cancela (o lo empeora).
    function drawSceneCast() {
      const cast = sceneRef.current.cast
      if (!cast) return
      const { r, g, b } = hexToRgb(cast.color)
      ctx.save()
      ctx.globalCompositeOperation = 'overlay'
      ctx.globalAlpha = cast.alpha
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      ctx.fillRect(0, 0, width, height)
      ctx.restore()
    }

    // Histograma de luminosidad del cuadro YA expuesto (lo que se ve en el
    // visor). Se mide sobre una copia chica (96×64) y sólo cada 8 frames:
    // leer píxeles con getImageData es caro y no hace falta a 60 fps.
    const HIST_BINS = 32
    const sampleCanvas = document.createElement('canvas')
    sampleCanvas.width = 96
    sampleCanvas.height = 64
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true })
    let frameCount = 0

    function drawHistogram() {
      const target = histogramCanvasRef.current
      if (!target) return
      let data
      try {
        sampleCtx.drawImage(canvas, 0, 0, 96, 64)
        data = sampleCtx.getImageData(0, 0, 96, 64).data
      } catch {
        return // canvas contaminado por una imagen sin CORS: sin histograma, pero sin romper nada
      }
      const bins = new Array(HIST_BINS).fill(0)
      for (let i = 0; i < data.length; i += 4) {
        const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255
        bins[Math.min(HIST_BINS - 1, Math.floor(lum * HIST_BINS))]++
      }
      const total = data.length / 4
      const hctx = target.getContext('2d')
      const hw = target.width
      const hh = target.height
      hctx.clearRect(0, 0, hw, hh)
      hctx.fillStyle = 'rgba(12, 13, 15, 0.72)'
      hctx.fillRect(0, 0, hw, hh)
      // Raíz cuadrada para que las zonas con pocos píxeles también se vean.
      const peak = Math.sqrt(Math.max(...bins))
      const barW = hw / HIST_BINS
      hctx.fillStyle = '#ecedef'
      bins.forEach((count, i) => {
        const barH = peak ? (Math.sqrt(count) / peak) * (hh - 8) : 0
        hctx.fillRect(i * barW + 0.5, hh - barH, barW - 1, barH)
      })
      // Marcas de recorte: más de un 8% de los píxeles pegados al extremo
      // = sombras tapadas (izquierda) o luces quemadas (derecha).
      hctx.fillStyle = '#e2623f'
      if (bins[0] / total > 0.08) hctx.fillRect(0, 0, 4, hh)
      if (bins[HIST_BINS - 1] / total > 0.08) hctx.fillRect(hw - 4, 0, 4, hh)
    }

    function render(now) {
      const dt = (now - lastTime) / 1000
      lastTime = now
      const t = now / 1000

      ctx.clearRect(0, 0, width, height)

      // Todo lo que es "fondo" (la foto de base, las sombras de nubes, el
      // flare de sol) se dibuja con un blur aplicado según la apertura —
      // así simulamos la profundidad de campo. El blur es parte del estado
      // del canvas, así que save()/restore() alrededor de este bloque lo
      // deja prendido para estas capas y apagado para el resto (el águila
      // tiene que quedar nítida, es el sujeto en foco).
      ctx.save()
      ctx.filter = `blur(${apertureToBackgroundBlur(apertureRef.current)}px)`
      const source = sourceRef.current
      if (source) {
        const zoomFactor = computeZoomFactor(focalRef.current)
        const { sx, sy, sw, sh } = computeZoomedCrop(source.crop, zoomFactor, source.w, source.h)
        ctx.drawImage(source.el, sx, sy, sw, sh, 0, 0, width, height)
      } else {
        drawFallbackScene()
      }
      drawCloudShadows(dt)
      if (sceneRef.current.sun) drawSunFlare(t)
      ctx.restore()

      drawMovingSubject(t, dt)
      drawGrain(t)
      drawVignette()
      drawSceneCast()
      drawWhiteBalanceTint()

      // Composición final: la escena ya está lista en el canvas invisible
      // (`ctx`/offscreen); la "copiamos" al canvas visible con el filtro
      // de exposición puesto — así sobre/subexposición afecta a la foto Y
      // al águila por igual, como en una cámara real.
      visibleCtx.clearRect(0, 0, width, height)
      visibleCtx.filter = exposureToFilter(exposureRef.current)
      visibleCtx.drawImage(offscreen, 0, 0)
      visibleCtx.filter = 'none'

      frameCount++
      if (showHistogramRef.current && frameCount % 8 === 0) drawHistogram()

      animationId = requestAnimationFrame(render)
    }

    animationId = requestAnimationFrame(render)

    return () => cancelAnimationFrame(animationId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height])

  return (
    <div className="viewfinder">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="viewfinder__canvas"
      />
      <div className="viewfinder__frame-lines" aria-hidden="true" />
      {showHistogram && (
        <canvas
          ref={histogramCanvasRef}
          width={160}
          height={64}
          className="viewfinder__histogram"
          role="img"
          aria-label="Histograma de luminosidad: sombras a la izquierda, luces a la derecha"
        />
      )}
      {status === 'loading' && (
        <div className="viewfinder__overlay-text">Cargando escena…</div>
      )}
    </div>
  )
})

export default Viewfinder

/**
 * Calcula qué rectángulo recortar de la imagen original para que cubra
 * todo el canvas sin deformarse (el mismo comportamiento que
 * `background-size: cover` en CSS, pero manual porque canvas no lo trae
 * incorporado).
 */
function computeCoverCrop(imgWidth, imgHeight, targetWidth, targetHeight) {
  const imgRatio = imgWidth / imgHeight
  const targetRatio = targetWidth / targetHeight

  if (imgRatio > targetRatio) {
    // La imagen es más "ancha" que el destino: recortamos los costados.
    const sh = imgHeight
    const sw = sh * targetRatio
    return { sx: (imgWidth - sw) / 2, sy: 0, sw, sh }
  }
  // La imagen es más "alta" que el destino: recortamos arriba/abajo.
  const sw = imgWidth
  const sh = sw / targetRatio
  return { sx: 0, sy: (imgHeight - sh) / 2, sw, sh }
}

/**
 * Toma el recorte base (`computeCoverCrop`, el "zoom x1" a 50mm) y lo
 * acerca o aleja según `zoomFactor`: un lente más largo (zoomFactor > 1)
 * recorta una porción más chica y centrada de la foto (efecto "acercar");
 * uno más corto (zoomFactor < 1) pide una porción más grande (efecto "gran
 * angular"). Como la foto fuente tiene un tamaño fijo, no podemos pedir más
 * área de la que existe — por eso se calcula cuánto se puede agrandar el
 * recorte sin salirse de los bordes de la imagen, y también se limita
 * cuánto se puede acercar para no terminar recortando un pedacito
 * minúsculo (y pixelado) de la foto.
 */
function computeZoomedCrop(baseRect, zoomFactor, imgWidth, imgHeight) {
  const maxScaleUp = Math.min(imgWidth / baseRect.sw, imgHeight / baseRect.sh)
  const minScaleDown = 0.2 // no acercar más allá de un 20% del recorte base
  const scale = Math.min(Math.max(1 / zoomFactor, minScaleDown), maxScaleUp)

  const sw = baseRect.sw * scale
  const sh = baseRect.sh * scale
  const sx = baseRect.sx + (baseRect.sw - sw) / 2
  const sy = baseRect.sy + (baseRect.sh - sh) / 2
  return { sx, sy, sw, sh }
}

/**
 * '#rrggbb' → { r, g, b }. Usado por drawWhiteBalanceTint para armar el
 * `rgb()` que necesita fillStyle a partir del color plano que define cada
 * preset de balance de blancos en cameraSettings.js.
 */
function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.substring(0, 2), 16)
  const g = parseInt(clean.substring(2, 4), 16)
  const b = parseInt(clean.substring(4, 6), 16)
  return { r, g, b }
}
