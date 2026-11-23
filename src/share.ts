/** Drive file/folder IDs are url-safe base64-ish. Validate before they reach a query string. */
const ID = /^[A-Za-z0-9_-]{10,}$/

export function isDriveId(s: unknown): s is string {
  return typeof s === 'string' && ID.test(s)
}

export interface ShareState {
  folders: string[]
  file?: string
}

/** Share link = `?f=<folder>,<folder>#m=<file>`. */
export function buildShare(base: string, state: ShareState): string {
  const url = new URL(base)
  url.search = ''
  url.hash = ''
  const folders = state.folders.filter(isDriveId)
  if (folders.length) url.searchParams.set('f', folders.join(','))
  if (state.file && isDriveId(state.file)) url.hash = `m=${state.file}`
  return url.toString()
}

export function parseShare(loc: { search: string; hash: string }): ShareState {
  const q = new URLSearchParams(loc.search)
  const folders = (q.get('f') ?? '').split(',').map((s) => s.trim()).filter(isDriveId)
  const m = new URLSearchParams(loc.hash.replace(/^#/, '')).get('m')
  return { folders, file: m && isDriveId(m) ? m : undefined }
}
