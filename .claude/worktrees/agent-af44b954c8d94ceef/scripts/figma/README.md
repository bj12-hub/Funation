# Figma layout pipeline

Rebuilds site screens as **editable** Figma layouts (frames with auto layout, site color variables,
text styles and the components on page 8) — not screenshots. Used for pages 9 (studio) and 10 (site) of the
"Somnation — 현재 구현 (2026-09)" file; see docs/figma/site-design-system.md.

1. `outline-walker.js` runs inside a page (e.g. via Chrome DevTools Protocol `Runtime.evaluate`
   with a creator session on a local dev server). It walks the studio main column and returns a
   compact JSON tree: frames (`d` direction, `g` gap, `p` padding, `f`/`s` fill/stroke as CSS token
   names such as `surface`, `r` radius, `w` width), texts `["t", text, "size/weight", color, width]`,
   inputs `["i", …]`, checkboxes `["c", …]` and images `["m", …]`.
2. `renderer.js` is the body of `async function RENDER(D)` stored in the Figma file's shared plugin
   data (`somnation` / `renderer`). Each `use_figma` call sends `D = [{ id, name, group, url, active, tree }]`
   and runs it with `new Function("return " + figma.root.getSharedPluginData("somnation", "renderer"))()`.
   Screens land in a section per `group` with the studio header and sidebar instances.

Token names map to the variables of the "Site Color" collection (ids at the top of renderer.js).
Mock data only: never point the walker at screens with real personal data.

Site screens (page 10) use the same format with three site-specific scripts:

- `chrome-walker.js` returns the site header, side menu and footer trees; `site-renderer.js` called with
  `D = { chrome: { signed, guest, side, footer } }` turns them into the page 8 components and stores their ids in
  shared plugin data `somnation` / `siteComponents`.
- `site-walker.js` walks the main column (or the donation panel with `?tab=donation`), keeps fixed overlays
  and header popovers, trims repeated lists to six items and replaces the site footer with `["footer"]`.
- `site-renderer.js` is stored as `somnation` / `siteRenderer`. Each screen is
  `{ id, name, group, url, active, headerKind: "signed" | "guest" | null, sideOpen, width, theme?, overlays?, tree }`:
  it adds the header instance, the side menu with `active` highlighted, absolute `overlays` (`{ x, y, tree }`) and an
  explicit Light mode when `theme` is `"light"`.

Admin screens (Somnation Admin file `Js5MCzkGmAZ9QY0w3nLUe8`, page "Layouts") use the same format:

- `admin-walker.js` runs inside an `apps/admin` page (mock operator session on localhost) and maps colours to the
  `--adm-color-*` tokens (`bg-page`, `status-success-bg`, …). It returns `{ chrome, active, crumb, tree, overlays }`.
- `admin-renderer.js` is stored as `somnation` / `adminRenderer` in that file. Tokens map to the `color/*` variables
  (`bg-page` → `color/bg/page`), font keys to the `Admin/*` text styles, and it places the Sidebar (active item) and
  Topbar (breadcrumb) instances plus Button · Badge · Input · Tab instances. `somnation` / `adminHelpers` holds small
  builders (table, card, tabs, …) used to keep each `use_figma` call short.

Icons: the walkers add a sixth element to inline-SVG media, `["m", w, h, radius, color, "<width>:<first path d, 40 chars>"]`.
`svg-collect.js` returns every visible inline SVG of a page keyed by that signature. The SVGs became `Icon/<Name>` components on page 8
(ids in shared plugin data `somnation` / `iconComponents`), and `somnation` / `iconReplace` swaps the placeholder rectangles of a
screen for instances by aligning the rectangle sizes with the walker's media sequence.
