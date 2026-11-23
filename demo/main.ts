import { createVadli, parseShare, type VadliItem } from '../src'

const key = import.meta.env.VITE_DRIVE_API_KEY as string | undefined
const defaults = ((import.meta.env.VITE_DRIVE_FOLDERS as string | undefined) ?? '').split(',').filter(Boolean)
const shared = parseShare(location).folders
const folders = shared.length ? shared : defaults

/** No Drive key/folders configured: generated tiles so the cloud still runs. */
function sample(n: number): VadliItem[] {
  return Array.from({ length: n }, (_, i) => {
    const w = [400, 300, 500][i % 3]
    const h = [300, 400, 300][(i + 1) % 3]
    const hue = (i * 47) % 360
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'>` +
      `<rect width='100%' height='100%' fill='hsl(${hue} 60% 45%)'/>` +
      `<text x='50%' y='50%' fill='white' font-family='sans-serif' font-size='48' text-anchor='middle' dominant-baseline='middle'>${i + 1}</text></svg>`
    const url = `data:image/svg+xml,${encodeURIComponent(svg)}`
    const id = `sample${String(i).padStart(6, '0')}`
    // `?videos` makes every 5th sample a video (the source 404s on purpose: it exercises the player + fallback).
    const video = location.search.includes('videos') && i % 5 === 0
    return {
      id, kind: video ? ('video' as const) : ('image' as const), name: `Sample ${i + 1}`,
      width: w, height: h, thumb: url, full: url,
      ...(video ? { video: './missing.mp4', embed: 'about:blank' } : {}),
    }
  })
}

createVadli(document.getElementById('app')!, {
  ...(key && folders.length ? { apiKey: key, folders, recursive: true } : { items: sample(60) }),
})
