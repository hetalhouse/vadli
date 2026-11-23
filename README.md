# Vadli

Turn a Google Drive folder of photos and videos into a slowly drifting cloud.
Click anything to expand it in place, play videos, and share a link that opens
that exact photo or video for someone else.

*Vadli* is from the Gujarati *vādal*, "cloud". Part of [hetalhouse](https://github.com/hetalhouse).

## Quick start

```bash
npm install @hetalhouse/vadli
```

```ts
import { createVadli } from '@hetalhouse/vadli'
import '@hetalhouse/vadli/style'

createVadli(document.getElementById('app')!, {
  apiKey: 'YOUR_DRIVE_API_KEY',
  folders: ['FOLDER_ID_1', 'FOLDER_ID_2'],
  recursive: true,
})
```

The container needs a size (e.g. `height: 100vh`).

## Drive setup

1. In Google Cloud Console, create a project and enable the **Google Drive API**.
2. Create an **API key**. Restrict it to the Drive API and to your site's HTTP
   referrers. It ships in the client bundle, so the restriction is what protects it.
3. Share each folder **Anyone with the link → Viewer**. The folder ID is the last
   part of its URL: `drive.google.com/drive/folders/<FOLDER_ID>`.

Private folders are not supported yet (see Roadmap).

## Options

| Option | Default | |
|---|---|---|
| `apiKey`, `folders` | | Drive source. Several folders are merged and de-duplicated. |
| `items` | | Skip Drive and pass `VadliItem[]` directly (tests, other sources). |
| `recursive` | `false` | Include subfolders, up to 5 levels. |
| `maxTiles` | `48` | Most tiles in the DOM at once; the rest cycle in as tiles drift off. |
| `speed` | `1` | Drift multiplier; `0` freezes. `prefers-reduced-motion` forces `0`. |
| `minSize` / `maxSize` | `90` / `240` | Long-edge size range in px. Bigger tiles are nearer: faster and in front. |
| `shareBase` | current page | Base URL for share links. |
| `syncUrl` | `true` | Keep `#m=<id>` in the address bar; back button collapses. |
| `onReady` `onExpand` `onCollapse` `onError` | | Callbacks. |

`createVadli` returns `{ expand(id), collapse(), shareUrl(id), items, destroy() }`.

Theme with CSS variables on the container: `--vadli-bg`, `--vadli-fg`, `--vadli-accent`.

## Share links

`https://your.site/page?f=<folderId>,<folderId>#m=<fileId>`

Opening it loads the same folders and expands that item. If the file isn't in
those folders, it is fetched directly by id. The **Share** button uses the
native share sheet where available, otherwise copies the link. Every id is
validated (`[A-Za-z0-9_-]{10,}`) before it is placed in a Drive query.

## Videos

Videos play in a native `<video>` streamed from the Drive API
(`alt=media`). If that fails (very large files hit Drive's download limits),
Vadli falls back to Drive's embedded player.

## Develop

```bash
cp .env.example .env     # VITE_DRIVE_API_KEY, VITE_DRIVE_FOLDERS
npm run dev              # demo; with no key it shows generated sample tiles
npm test                 # unit (Drive mapping, share links)
npm run test:e2e         # Playwright: drift, expand, share, deep link, video
npm run build            # library -> dist/
npm run build:demo       # demo   -> demo-dist/
```

`?videos` on the demo makes some sample tiles videos.

## Roadmap

- Private folders via Google sign-in (OAuth, `drive.file` / Picker)
- Vue wrapper component
- Prev/next while expanded
- iOS app (Capacitor shell) once the web library is stable
