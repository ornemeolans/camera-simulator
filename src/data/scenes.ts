/**
 * scenes
 * ------
 * Las "escenas" del simulador: cada una define con qué luz se saca la foto,
 * y por lo tanto cuál es el balance de blancos correcto y cuánta luz falta
 * para exponer bien. Antes la app tenía UNA sola escena (día soleado) y el
 * tutor tenía esa suposición escrita a fuego; ahora la escena es un dato
 * más, así el mismo tutor puede evaluar distinto según dónde se sacó la foto.
 *
 * Campos importantes:
 * - lightStops: cuánta luz tiene la escena respecto del día soleado (0).
 *   Es NEGATIVO cuando hay menos luz (noche = -3). Se suma al EV de la toma:
 *   con los mismos ajustes, una escena oscura sale subexpuesta — y el
 *   fotómetro de los modos A/S/AUTO la compensa solo (ver effectiveIndices),
 *   igual que una cámara real.
 * - correctWb: ids de balance de blancos que corrigen bien esa luz. Los
 *   presets de cameraSettings.js son el tinte que se le AGREGA a la imagen,
 *   y cada escena tiene un tinte propio de su luz (`cast`): el balance
 *   correcto es el que lo cancela.
 * - autoTint: lo que hace el balance AUTO en esa escena (cancelar el tinte
 *   solo). En el día soleado no hay nada que cancelar.
 */
import type { Scene, Tint } from '../types'
import type { WhiteBalance } from './cameraSettings'


// Fotos propias opcionales: src/assets/scenes/<id>.(jpg|jpeg|png|webp).
// Vite resuelve esto en build, así que no hace falta tocar código para
// reemplazar el dibujo generado por una foto real.
const LOCAL_PHOTOS = import.meta.glob<string>('../assets/scenes/*.{jpg,jpeg,png,webp}', {
  eager: true,
  query: '?url',
  import: 'default',
})

export function localPhotoUrl(sceneId: string): string | null {
  const key = Object.keys(LOCAL_PHOTOS).find((k) => /\/([^/]+)\.[a-z]+$/.exec(k)?.[1] === sceneId)
  return key ? LOCAL_PHOTOS[key] : null
}

export const SCENES: Scene[] = [
  {
    id: 'day',
    label: 'Día soleado',
    lightLabel: 'sol directo',
    lightStops: 0,
    correctWb: ['auto', 'daylight'],
    cast: null,
    autoTint: null,
    sun: true,
    // Foto remota original: sólo se usa si no hay una local ni falla la
    // carga; si falla, se cae al dibujo generado.
    remotePhotoUrl: 'https://picsum.photos/id/1018/1600/1000',
    palette: { skyTop: '#4fa8e0', skyBottom: '#cfe9fb', ridge: ['#7fa5b8', '#5f8a73'], groundTop: '#6fb84f', groundBottom: '#3f7d33' },
  },
  {
    id: 'cloudy',
    label: 'Día nublado',
    lightLabel: 'luz difusa de día nublado',
    lightStops: -1,
    correctWb: ['auto', 'cloudy'],
    // Cielo cubierto = luz fría/azulada: el preset "Nublado" agrega un
    // tinte cálido justamente para cancelarla.
    cast: { color: '#6f9fe0', alpha: 0.16 },
    autoTint: { color: '#ff9d3a', alpha: 0.12 },
    sun: false,
    palette: { skyTop: '#9aa8b4', skyBottom: '#d3d9de', ridge: ['#8a98a3', '#6f8577'], groundTop: '#7ea36a', groundBottom: '#4f7243' },
  },
  {
    id: 'night',
    label: 'Noche en la ciudad',
    lightLabel: 'luces de tungsteno de la ciudad',
    lightStops: -3,
    correctWb: ['auto', 'incandescent'],
    // Lámparas de tungsteno = luz anaranjada: el preset "Tungsteno" agrega
    // un tinte azul para cancelarla.
    cast: { color: '#ff8a2a', alpha: 0.2 },
    autoTint: { color: '#3a6fff', alpha: 0.16 },
    sun: false,
    night: true,
    palette: { skyTop: '#0b1430', skyBottom: '#2a3a68', ridge: ['#141c36', '#0e1428'], groundTop: '#10162a', groundBottom: '#080b18' },
  },
]

// Escena "tu foto": se arma al subir una imagen propia. Se comporta como el
// día soleado (misma luz, mismo balance correcto); la foto reemplaza sólo el
// fondo.
export const CUSTOM_SCENE: Scene = {
  id: 'custom',
  label: 'Tu foto',
  lightLabel: 'luz de tu foto (se asume luz de día)',
  lightStops: 0,
  correctWb: ['auto', 'daylight'],
  cast: null,
  autoTint: null,
  sun: false,
}

export const DEFAULT_SCENE_ID = 'day'

export function getScene(id: string): Scene {
  if (id === CUSTOM_SCENE.id) return CUSTOM_SCENE
  return SCENES.find((s) => s.id === id) ?? SCENES[0]
}

/**
 * Tinte que se le aplica a la escena según el balance de blancos elegido:
 * el del preset, salvo en AUTO, que cancela el tinte propio de la luz de la
 * escena (si lo tiene).
 */
export function resolveWhiteBalanceTint(wb: WhiteBalance, scene: Scene): Tint | null {
  if (wb.id === 'auto') return scene.autoTint ?? null
  return wb.tintColor ? { color: wb.tintColor, alpha: wb.tintAlpha } : null
}
