import { describe, expect, it, vi } from 'vitest'
import { getFile, listFolder, loadFolders, toItem } from '../src/drive'

const ROOT = '1RootFolderIdRootFolderId'
const SUB = '1SubFolderIdSubFolderId0'
const KEY = 'k&y'

const img = (id: string, extra = {}) => ({
  id, name: `${id}.jpg`, mimeType: 'image/jpeg', imageMediaMetadata: { width: 800, height: 600 }, ...extra,
})
const vid = (id: string) => ({
  id, name: `${id}.mp4`, mimeType: 'video/mp4', videoMediaMetadata: { width: 1920, height: 1080 },
})
const folder = (id: string) => ({ id, name: 'sub', mimeType: 'application/vnd.google-apps.folder' })

/** Fake Drive: maps the folder id found in `q` to a list of pages. */
function fakeDrive(tree: Record<string, any[][]>) {
  return vi.fn(async (input: any) => {
    const url = new URL(String(input))
    const parent = /'([^']+)' in parents/.exec(url.searchParams.get('q') ?? '')![1]
    const pages = tree[parent]
    if (!pages) return new Response(JSON.stringify({ error: { message: 'File not found' } }), { status: 404 })
    const i = Number(url.searchParams.get('pageToken') ?? 0)
    return new Response(JSON.stringify({ files: pages[i], nextPageToken: i + 1 < pages.length ? String(i + 1) : undefined }))
  })
}

describe('toItem', () => {
  it('maps images and swaps dimensions for sideways EXIF rotation', () => {
    expect(toItem(img('a1', { imageMediaMetadata: { width: 800, height: 600, rotation: 1 } }), KEY)).toMatchObject({
      kind: 'image', width: 600, height: 800,
    })
  })
  it('maps videos with an encoded-key media url and an embed fallback', () => {
    const v = toItem(vid('v1'), KEY)!
    expect(v.kind).toBe('video')
    expect(v.video).toBe('https://www.googleapis.com/drive/v3/files/v1?alt=media&key=k%26y')
    expect(v.embed).toBe('https://drive.google.com/file/d/v1/preview')
  })
  it('ignores other file types and defaults to 4:3 without metadata', () => {
    expect(toItem({ id: 'd', name: 'd', mimeType: 'application/pdf' }, KEY)).toBeNull()
    expect(toItem({ id: 'i', name: 'i', mimeType: 'image/png' }, KEY)).toMatchObject({ width: 4, height: 3 })
  })
})

describe('listFolder', () => {
  it('follows nextPageToken', async () => {
    const f = fakeDrive({ [ROOT]: [[img('a'), img('b')], [vid('c')]] })
    const items = await listFolder(ROOT, { apiKey: KEY, fetch: f as any })
    expect(items.map((i) => i.id)).toEqual(['a', 'b', 'c'])
    expect(f).toHaveBeenCalledTimes(2)
  })
  it('only descends into subfolders when recursive', async () => {
    const tree = { [ROOT]: [[img('a'), folder(SUB)]], [SUB]: [[img('b')]] }
    expect((await listFolder(ROOT, { apiKey: KEY, fetch: fakeDrive(tree) as any })).map((i) => i.id)).toEqual(['a'])
    expect(
      (await listFolder(ROOT, { apiKey: KEY, recursive: true, fetch: fakeDrive(tree) as any })).map((i) => i.id),
    ).toEqual(['a', 'b'])
  })
  it('does not loop on a folder that contains itself', async () => {
    const f = fakeDrive({ [ROOT]: [[folder(ROOT), img('a')]] })
    await listFolder(ROOT, { apiKey: KEY, recursive: true, fetch: f as any })
    expect(f).toHaveBeenCalledTimes(1)
  })
  it('surfaces the Drive error message', async () => {
    await expect(listFolder(ROOT, { apiKey: KEY, fetch: fakeDrive({}) as any })).rejects.toThrow('Drive API 404: File not found')
  })
  it('refuses a folder id that could break out of the query', async () => {
    const f = fakeDrive({})
    expect(await listFolder("x' or '1'='1", { apiKey: KEY, fetch: f as any })).toEqual([])
    expect(f).not.toHaveBeenCalled()
  })
})

describe('loadFolders / getFile', () => {
  it('merges several folders and dedupes by file id', async () => {
    const f = fakeDrive({ [ROOT]: [[img('a'), img('b')]], [SUB]: [[img('b'), img('c')]] })
    const items = await loadFolders([ROOT, SUB], { apiKey: KEY, fetch: f as any })
    expect(items.map((i) => i.id).sort()).toEqual(['a', 'b', 'c'])
  })
  it('getFile returns null for a bad id without calling Drive', async () => {
    const f = vi.fn()
    expect(await getFile('nope', { apiKey: KEY, fetch: f as any })).toBeNull()
    expect(f).not.toHaveBeenCalled()
  })
})
