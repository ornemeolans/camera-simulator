/**
 * proceduralScene
 * ---------------
 * Dibuja una escena (cielo, montañas, suelo y, de noche, estrellas, luna y
 * ciudad) en un canvas aparte, UNA sola vez por escena. El visor lo usa como
 * si fuera una foto: lo recorta y lo acerca según el lente, le aplica el
 * desenfoque de fondo, etc.
 *
 * Por qué se pre-renderiza en vez de dibujarse en cada frame: un skyline
 * con cientos de ventanas encendidas dibujado 60 veces por segundo, y
 * encima con `ctx.filter = blur(...)` (que es caro), arruinaría el
 * rendimiento. Pre-renderizado cuesta una sola vez.
 *
 * La escena se dibuja "bien expuesta": el oscurecimiento de la noche lo
 * decide la exposición de la toma (scene.lightStops), no la paleta — así
 * si la persona expone bien la foto nocturna, se ve como debe verse.
 */

// Generador pseudoaleatorio con semilla (mulberry32): da siempre la misma
// secuencia, así la ciudad y las estrellas no cambian cada vez que se
// vuelve a dibujar la escena.
function seededRandom(seed) {
  let a = seed >>> 0
  return () => {
    a += 0x6d2b79f5
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function drawRidge(ctx, w, h, baseY, amplitude, color, seed) {
  const rand = seededRandom(seed)
  const phases = [rand() * 6, rand() * 6, rand() * 6]
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(0, h)
  for (let x = 0; x <= w; x += 8) {
    const y =
      baseY -
      amplitude *
        (0.5 * Math.sin(x * 0.004 + phases[0]) +
          0.3 * Math.sin(x * 0.011 + phases[1]) +
          0.2 * Math.sin(x * 0.027 + phases[2]))
    ctx.lineTo(x, y)
  }
  ctx.lineTo(w, h)
  ctx.closePath()
  ctx.fill()
}

function drawStars(ctx, w, h) {
  const rand = seededRandom(7)
  for (let i = 0; i < 160; i++) {
    const x = rand() * w
    const y = rand() * h * 0.55
    const r = 0.4 + rand() * 1.2
    ctx.fillStyle = `rgba(255, 250, 235, ${0.35 + rand() * 0.6})`
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawMoon(ctx, w, h) {
  const mx = w * 0.82
  const my = h * 0.16
  const glow = ctx.createRadialGradient(mx, my, 0, mx, my, 150)
  glow.addColorStop(0, 'rgba(230, 236, 255, 0.55)')
  glow.addColorStop(1, 'rgba(230, 236, 255, 0)')
  ctx.fillStyle = glow
  ctx.fillRect(mx - 150, my - 150, 300, 300)
  ctx.fillStyle = '#eef1ff'
  ctx.beginPath()
  ctx.arc(mx, my, 34, 0, Math.PI * 2)
  ctx.fill()
}

function drawCity(ctx, w, h) {
  const rand = seededRandom(21)
  const baseY = h * 0.78
  let x = -10
  while (x < w) {
    const bw = 40 + rand() * 70
    const bh = 90 + rand() * 260
    ctx.fillStyle = `rgb(${14 + Math.floor(rand() * 10)}, ${18 + Math.floor(rand() * 10)}, ${34 + Math.floor(rand() * 14)})`
    ctx.fillRect(x, baseY - bh, bw, bh + (h - baseY))
    // Ventanas: una grilla con parte de ellas encendidas (luz cálida de
    // tungsteno — la que el balance de blancos "Tungsteno" corrige).
    for (let wy = baseY - bh + 10; wy < baseY - 6; wy += 16) {
      for (let wx = x + 7; wx < x + bw - 8; wx += 12) {
        if (rand() < 0.42) {
          ctx.fillStyle = `rgba(255, ${190 + Math.floor(rand() * 50)}, ${110 + Math.floor(rand() * 60)}, ${0.7 + rand() * 0.3})`
          ctx.fillRect(wx, wy, 6, 8)
        }
      }
    }
    x += bw + rand() * 6
  }
  // Calle con reflejos cálidos.
  const street = ctx.createLinearGradient(0, baseY, 0, h)
  street.addColorStop(0, '#171b2e')
  street.addColorStop(1, '#07091a')
  ctx.fillStyle = street
  ctx.fillRect(0, baseY, w, h - baseY)
  for (let i = 0; i < 26; i++) {
    const lx = rand() * w
    const glow = ctx.createRadialGradient(lx, baseY + 14, 0, lx, baseY + 14, 38)
    glow.addColorStop(0, 'rgba(255, 190, 110, 0.55)')
    glow.addColorStop(1, 'rgba(255, 190, 110, 0)')
    ctx.fillStyle = glow
    ctx.fillRect(lx - 40, baseY - 24, 80, 80)
  }
}

/**
 * Devuelve un canvas (w×h) con la escena dibujada.
 * @param {object} scene - una entrada de SCENES (data/scenes.js) con `palette`
 */
export function renderProceduralScene(scene, w = 1600, h = 1000) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const { palette } = scene

  const horizon = h * 0.62
  const sky = ctx.createLinearGradient(0, 0, 0, horizon)
  sky.addColorStop(0, palette.skyTop)
  sky.addColorStop(1, palette.skyBottom)
  ctx.fillStyle = sky
  ctx.fillRect(0, 0, w, h)

  if (scene.night) {
    drawStars(ctx, w, h)
    drawMoon(ctx, w, h)
  }

  drawRidge(ctx, w, h, horizon - 20, 90, palette.ridge[0], 3)
  drawRidge(ctx, w, h, horizon + 20, 70, palette.ridge[1], 11)

  if (scene.night) {
    drawCity(ctx, w, h)
  } else {
    const ground = ctx.createLinearGradient(0, horizon + 30, 0, h)
    ground.addColorStop(0, palette.groundTop)
    ground.addColorStop(1, palette.groundBottom)
    ctx.fillStyle = ground
    ctx.fillRect(0, horizon + 30, w, h - horizon - 30)
  }
  return canvas
}
