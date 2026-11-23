import type { Vadli, VadliItem, VadliOptions } from './types'
import { buildShare, parseShare } from './share'
import { getFile, loadFolders } from './drive'

interface Tile {
  el: HTMLElement
  img: HTMLImageElement
  item: VadliItem
  /** Long-edge size class; kept when the tile is recycled to a new item. */
  size: number
  depth: number
  x: number
  y: number
  w: number
  h: number
  vx: number
  vy: number
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, text?: string) {
  const e = document.createElement(tag)
  e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export function createVadli(root: HTMLElement, options: VadliOptions = {}): Vadli {
  const opts = { maxTiles: 48, speed: 1, minSize: 90, maxSize: 240, syncUrl: true, ...options }
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const speed = reduced ? 0 : opts.speed

  root.classList.add('vadli')
  const field = el('div', 'vadli-field')
  const status = el('div', 'vadli-status', 'Loading…')
  const bar = el('div', 'vadli-bar')
  const title = el('span', 'vadli-title')
  const note = el('span', 'vadli-note')
  const shareBtn = el('button', 'vadli-btn', 'Share')
  const openLink = el('a', 'vadli-btn', 'Open in Drive')
  const closeBtn = el('button', 'vadli-btn', 'Close')
  openLink.target = '_blank'
  openLink.rel = 'noopener'
  shareBtn.type = closeBtn.type = 'button'
  bar.append(title, note, shareBtn, openLink, closeBtn)
  root.append(field, bar, status)

  let items: VadliItem[] = []
  const byId = new Map<string, VadliItem>()
  let queue: VadliItem[] = []
  const tiles: Tile[] = []
  let W = root.clientWidth
  let H = root.clientHeight
  let raf = 0
  let last = 0
  let open: Tile | null = null
  let destroyed = false
  let applying = false
  let noteTimer = 0

  const fail = (e: unknown) => {
    const err = e instanceof Error ? e : new Error(String(e))
    status.textContent = err.message
    status.hidden = false
    opts.onError?.(err)
  }

  const nextItem = (): VadliItem => {
    if (!queue.length) queue = shuffle([...items])
    return queue.pop()!
  }

  function dims(t: Tile) {
    const ar = t.item.width / t.item.height
    t.w = ar >= 1 ? t.size : t.size * ar
    t.h = ar >= 1 ? t.size / ar : t.size
    t.el.style.width = `${t.w}px`
    t.el.style.height = `${t.h}px`
  }

  function place(t: Tile) {
    t.el.style.transform = `translate3d(${t.x}px,${t.y}px,0)`
  }

  function setItem(t: Tile, item: VadliItem) {
    t.item = item
    t.img.src = item.thumb
    t.img.alt = item.name
    t.el.dataset.id = item.id
    t.el.classList.toggle('is-video', item.kind === 'video')
    dims(t)
  }

  function spawn() {
    const n = Math.min(opts.maxTiles, items.length)
    for (let i = 0; i < n; i++) {
      const depth = Math.random()
      const e = el('div', 'vadli-tile')
      const img = el('img', 'vadli-img')
      img.draggable = false
      img.decoding = 'async'
      e.append(img, el('span', 'vadli-play', '▶'))
      e.style.zIndex = String(Math.round(depth * 100))
      e.style.opacity = String(0.55 + 0.45 * depth)
      const dir = Math.random() < 0.5 ? -1 : 1
      const t: Tile = {
        el: e,
        img,
        item: nextItem(),
        size: opts.minSize + depth * (opts.maxSize - opts.minSize),
        depth,
        x: 0,
        y: 0,
        w: 0,
        h: 0,
        vx: dir * (6 + depth * 24) * speed,
        vy: rand(-4, 4) * speed,
      }
      setItem(t, t.item)
      t.x = rand(-t.w / 2, Math.max(W - t.w / 2, 1))
      t.y = rand(-t.h / 2, Math.max(H - t.h / 2, 1))
      place(t)
      e.addEventListener('click', () => void expand(t.item.id))
      field.append(e)
      tiles.push(t)
    }
  }

  function recycle(t: Tile) {
    if (items.length > tiles.length) setItem(t, nextItem())
  }

  function frame(now: number) {
    raf = requestAnimationFrame(frame)
    const dt = Math.min((now - last) / 1000, 0.1)
    last = now
    if (open || !speed) return
    for (const t of tiles) {
      t.x += t.vx * dt
      t.y += t.vy * dt
      if (t.x > W) (t.x = -t.w), recycle(t)
      else if (t.x + t.w < 0) (t.x = W), recycle(t)
      if (t.y > H) (t.y = -t.h), recycle(t)
      else if (t.y + t.h < 0) (t.y = H), recycle(t)
      place(t)
    }
  }

  function say(msg: string) {
    note.textContent = msg
    clearTimeout(noteTimer)
    noteTimer = window.setTimeout(() => (note.textContent = ''), 2200)
  }

  function shareUrl(id: string) {
    const base = opts.shareBase ?? location.origin + location.pathname
    return buildShare(base, { folders: opts.folders ?? [], file: id })
  }

  function setHash(id: string | null) {
    if (!opts.syncUrl || applying) return
    const url = new URL(location.href)
    url.hash = id ? `m=${id}` : ''
    history.pushState(null, '', url)
  }

  async function expand(id: string) {
    if (destroyed) return
    let item = byId.get(id)
    if (!item && opts.apiKey) {
      try {
        item = (await getFile(id, { apiKey: opts.apiKey })) ?? undefined
      } catch (e) {
        return fail(e)
      }
      if (item) {
        byId.set(id, item)
        items = [...items, item]
      }
    }
    if (!item) return fail(new Error('That item is not available'))
    if (open?.item.id === id) return
    if (open) collapse(false)
    if (!tiles.length) return

    let t = tiles.find((x) => x.item.id === id)
    if (!t) {
      // Share link to something not currently drifting: borrow the front-most tile.
      t = tiles.reduce((a, b) => (b.depth > a.depth ? b : a))
      setItem(t, item)
    }
    open = t
    root.classList.add('vadli--open')
    t.el.classList.add('is-open')

    const ar = item.width / item.height
    const boxW = W * 0.92
    const boxH = H * 0.82
    const w = Math.min(boxW, boxH * ar)
    const h = w / ar
    t.el.style.width = `${w}px`
    t.el.style.height = `${h}px`
    t.el.style.transform = `translate3d(${(W - w) / 2}px,${(H - h) / 2 + 20}px,0)`

    title.textContent = item.name
    openLink.href = item.page ?? '#'
    openLink.hidden = !item.page
    bar.classList.add('is-on')

    const big = new Image()
    big.onload = () => {
      if (open === t) t!.img.src = item!.full
    }
    big.src = item.full

    if (item.kind === 'video' && item.video) mountVideo(t, item)
    setHash(id)
    opts.onExpand?.(item)
  }

  function mountVideo(t: Tile, item: VadliItem) {
    const v = document.createElement('video')
    v.className = 'vadli-video'
    v.controls = true
    v.playsInline = true
    v.preload = 'metadata'
    v.poster = item.thumb
    v.src = item.video!
    v.addEventListener('error', () => {
      if (!item.embed || !t.el.contains(v)) return
      const f = document.createElement('iframe')
      f.className = 'vadli-video'
      f.src = item.embed
      f.allow = 'autoplay; fullscreen'
      v.replaceWith(f)
    })
    t.el.append(v)
    t.el.querySelector('.vadli-play')?.setAttribute('hidden', '')
  }

  function collapse(sync = true) {
    const t = open
    if (!t) return
    open = null
    t.el.querySelectorAll('.vadli-video').forEach((v) => {
      if (v instanceof HTMLVideoElement) v.pause()
      v.remove()
    })
    t.el.querySelector('.vadli-play')?.removeAttribute('hidden')
    t.img.src = t.item.thumb
    t.el.classList.remove('is-open')
    root.classList.remove('vadli--open')
    bar.classList.remove('is-on')
    dims(t)
    place(t)
    if (sync) setHash(null)
    opts.onCollapse?.()
  }

  async function share() {
    if (!open) return
    const url = shareUrl(open.item.id)
    try {
      if (navigator.share) await navigator.share({ title: open.item.name, url })
      else {
        await navigator.clipboard.writeText(url)
        say('Link copied')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') say(url) // clipboard blocked: show it for manual copy
    }
  }

  function applyHash() {
    const { file } = parseShare(location)
    applying = true
    const done = () => (applying = false)
    if (file) void expand(file).finally(done)
    else {
      collapse(false)
      done()
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && open) collapse()
  }
  const onPop = () => opts.syncUrl && applyHash()
  const ro = new ResizeObserver(() => {
    W = root.clientWidth
    H = root.clientHeight
    if (open) {
      const t = open
      collapse(false)
      void expand(t.item.id)
    }
  })

  closeBtn.addEventListener('click', () => collapse())
  shareBtn.addEventListener('click', () => void share())
  field.addEventListener('click', (e) => {
    if (open && e.target === field) collapse()
  })
  addEventListener('keydown', onKey)
  addEventListener('popstate', onPop)
  ro.observe(root)

  async function boot() {
    try {
      if (opts.items) items = [...opts.items]
      else if (opts.apiKey && opts.folders?.length) {
        items = await loadFolders(opts.folders, { apiKey: opts.apiKey, recursive: opts.recursive })
      } else throw new Error('Vadli needs `items`, or `apiKey` + `folders`')
      if (destroyed) return
      if (!items.length) throw new Error('No photos or videos found in those folders')
      items.forEach((i) => byId.set(i.id, i))
      queue = shuffle([...items])
      status.hidden = true
      spawn()
      opts.onReady?.(items)
      raf = requestAnimationFrame((n) => ((last = n), frame(n)))
      if (opts.syncUrl && parseShare(location).file) applyHash()
    } catch (e) {
      fail(e)
    }
  }
  void boot()

  return {
    expand,
    collapse: () => collapse(),
    shareUrl,
    get items() {
      return items
    },
    destroy() {
      destroyed = true
      cancelAnimationFrame(raf)
      clearTimeout(noteTimer)
      ro.disconnect()
      removeEventListener('keydown', onKey)
      removeEventListener('popstate', onPop)
      root.classList.remove('vadli', 'vadli--open')
      field.remove()
      bar.remove()
      status.remove()
    },
  }
}
