export type VadliKind = 'image' | 'video'

/** One photo or video in the cloud. */
export interface VadliItem {
  id: string
  kind: VadliKind
  name: string
  /** Natural size; used for aspect ratio only. */
  width: number
  height: number
  /** Small preview shown while drifting (also the video poster). */
  thumb: string
  /** Large rendition shown when expanded. */
  full: string
  /** Playable source for videos. */
  video?: string
  /** Fallback embed (Drive's own player) if `video` fails to load. */
  embed?: string
  /** Where to open the original. */
  page?: string
}

export interface VadliOptions {
  /** Drive API key (Drive API enabled, restricted by HTTP referrer). */
  apiKey?: string
  /** Drive folder IDs; each must be shared "Anyone with the link". */
  folders?: string[]
  /** Skip Drive and use these items directly (tests, demos, other sources). */
  items?: VadliItem[]
  /** Also read subfolders (up to 5 levels deep). Default false. */
  recursive?: boolean
  /** Most tiles in the DOM at once; the rest cycle in as tiles leave. Default 48. */
  maxTiles?: number
  /** Drift speed multiplier; 0 freezes the cloud. Default 1. */
  speed?: number
  /** Long-edge size range of a tile in px. Default 90–240. */
  minSize?: number
  maxSize?: number
  /** Base URL for share links. Default: current origin + path. */
  shareBase?: string
  /** Read/write `#m=<id>` so the browser URL deep-links to the open item. Default true. */
  syncUrl?: boolean
  onReady?: (items: VadliItem[]) => void
  onExpand?: (item: VadliItem) => void
  onCollapse?: () => void
  onError?: (error: Error) => void
}

export interface Vadli {
  /** Open an item by id (loads it from Drive if it isn't in the cloud). */
  expand(id: string): Promise<void>
  collapse(): void
  /** Share link that reopens this item directly. */
  shareUrl(id: string): string
  readonly items: readonly VadliItem[]
  destroy(): void
}
