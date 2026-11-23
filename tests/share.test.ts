import { describe, expect, it } from 'vitest'
import { buildShare, isDriveId, parseShare } from '../src/share'

const A = '1AbCdEfGhIjKlMnOpQrStUv'
const B = '1ZyXwVuTsRqPoNmLkJiHgFe'
const F = '0B7xyzFILEidFILEidFILEid'

describe('share links', () => {
  it('round-trips folders and file', () => {
    const url = buildShare('https://hetalhouse.github.io/vadli/', { folders: [A, B], file: F })
    expect(url).toBe(`https://hetalhouse.github.io/vadli/?f=${A}%2C${B}#m=${F}`)
    const u = new URL(url)
    expect(parseShare({ search: u.search, hash: u.hash })).toEqual({ folders: [A, B], file: F })
  })

  it('drops anything that is not a Drive id', () => {
    expect(buildShare('https://x.test/', { folders: ["a'b", A], file: '../x' })).toBe(`https://x.test/?f=${A}`)
    expect(parseShare({ search: `?f=${A},bad id,'--`, hash: '#m=%27%20or' })).toEqual({ folders: [A], file: undefined })
  })

  it('replaces any existing query/hash on the base', () => {
    expect(buildShare('https://x.test/p?z=1#old', { folders: [], file: F })).toBe(`https://x.test/p#m=${F}`)
  })

  it('validates ids', () => {
    expect(isDriveId(A)).toBe(true)
    expect(isDriveId('short')).toBe(false)
    expect(isDriveId(`${A}'`)).toBe(false)
    expect(isDriveId(undefined)).toBe(false)
  })
})
