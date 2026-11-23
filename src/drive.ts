import type { VadliItem } from './types'
import { isDriveId } from './share'

const API = 'https://www.googleapis.com/drive/v3/files'
const FOLDER = 'application/vnd.google-apps.folder'
const FIELDS =
  'id,name,mimeType,imageMediaMetadata(width,height,rotation),videoMediaMetadata(width,height,durationMillis)'
const MAX_DEPTH = 5

interface DriveFile {
  id: string
  name: string
  mimeType: string
  imageMediaMetadata?: { width?: number; height?: number; rotation?: number }
  videoMediaMetadata?: { width?: number; height?: number }
}

export interface DriveOptions {
  apiKey: string
  recursive?: boolean
  fetch?: typeof fetch
}

export const thumbUrl = (id: string, w: number) => `https://drive.google.com/thumbnail?id=${id}&sz=w${w}`

/** Map a Drive file to a cloud item; null if it isn't an image or video. */
export function toItem(f: DriveFile, apiKey: string): VadliItem | null {
  const video = f.mimeType.startsWith('video/')
  if (!video && !f.mimeType.startsWith('image/')) return null
  const meta = video ? f.videoMediaMetadata : f.imageMediaMetadata
  let width = meta?.width || 4
  let height = meta?.height || 3
  // EXIF quarter-turns: the stored pixels are sideways relative to how Drive renders them.
  if (!video && (f.imageMediaMetadata?.rotation ?? 0) % 2 === 1) [width, height] = [height, width]
  return {
    id: f.id,
    kind: video ? 'video' : 'image',
    name: f.name,
    width,
    height,
    thumb: thumbUrl(f.id, 400),
    full: thumbUrl(f.id, 1600),
    video: video ? `${API}/${f.id}?alt=media&key=${encodeURIComponent(apiKey)}` : undefined,
    embed: video ? `https://drive.google.com/file/d/${f.id}/preview` : undefined,
    page: `https://drive.google.com/file/d/${f.id}/view`,
  }
}

async function call(url: string, doFetch: typeof fetch): Promise<any> {
  const res = await doFetch(url)
  if (!res.ok) {
    let reason = ''
    try {
      reason = (await res.json())?.error?.message ?? ''
    } catch {
      /* body wasn't JSON */
    }
    throw new Error(`Drive API ${res.status}${reason ? `: ${reason}` : ''}`)
  }
  return res.json()
}

/** Every image/video in one folder (and its subfolders if `recursive`). */
export async function listFolder(folderId: string, opts: DriveOptions): Promise<VadliItem[]> {
  const doFetch = opts.fetch ?? fetch
  const out: VadliItem[] = []
  const seen = new Set<string>()
  let level = [folderId]

  for (let depth = 0; level.length && depth <= (opts.recursive ? MAX_DEPTH : 0); depth++) {
    const next: string[] = []
    for (const id of level) {
      if (!isDriveId(id) || seen.has(id)) continue
      seen.add(id)
      let pageToken = ''
      do {
        const q = `'${id}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/' or mimeType='${FOLDER}')`
        const url =
          `${API}?q=${encodeURIComponent(q)}&fields=${encodeURIComponent(`nextPageToken,files(${FIELDS})`)}` +
          `&pageSize=1000&key=${encodeURIComponent(opts.apiKey)}` +
          (pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '')
        const body = await call(url, doFetch)
        for (const f of body.files as DriveFile[]) {
          if (f.mimeType === FOLDER) next.push(f.id)
          else {
            const item = toItem(f, opts.apiKey)
            if (item) out.push(item)
          }
        }
        pageToken = body.nextPageToken ?? ''
      } while (pageToken)
    }
    level = next
  }
  return out
}

/** Several folders merged, de-duplicated by file id. */
export async function loadFolders(folders: string[], opts: DriveOptions): Promise<VadliItem[]> {
  const lists = await Promise.all(folders.map((f) => listFolder(f, opts)))
  const byId = new Map<string, VadliItem>()
  for (const item of lists.flat()) byId.set(item.id, item)
  return [...byId.values()]
}

/** One file by id, for share links that point outside the loaded folders. */
export async function getFile(id: string, opts: DriveOptions): Promise<VadliItem | null> {
  if (!isDriveId(id)) return null
  const url = `${API}/${id}?fields=${encodeURIComponent(FIELDS)}&key=${encodeURIComponent(opts.apiKey)}`
  return toItem(await call(url, opts.fetch ?? fetch), opts.apiKey)
}
