# Figma layout pipeline

Rebuilds site screens as **editable** Figma layouts (frames with auto layout, site color variables,
text styles and the components on page 8) — not screenshots. Used for pages 9 (studio) and 10 (site) of the
"Ssumnation — 현재 구현 (2026-09)" file; see docs/figma/site-design-system.md.

1. `outline-walker.js` runs inside a page (e.g. via Chrome DevTools Protocol `Runtime.evaluate`
   with a creator session on a local dev server). It walks the studio main column and returns a
   compact JSON tree: frames (`d` direction, `g` gap, `p` padding, `f`/`s` fill/stroke as CSS token
   names such as `surface`, `r` radius, `w` width), texts `["t", text, "size/weight", color, width]`,
   inputs `["i", …]`, checkboxes `["c", …]` and images `["m", …]`.
2. `renderer.js` is the body of `async function RENDER(D)` stored in the Figma file's shared plugin
   data (`ssumnation` / `renderer`). Each `use_figma` call sends `D = [{ id, name, group, url, active, tree }]`
   and runs it with `new Function("return " + figma.root.getSharedPluginData("somnation", "renderer"))()`.
   Screens land in a section per `group` with the studio header and sidebar instances.

Token names map to the variables of the "Site Color" collection (ids at the top of renderer.js).
Mock data only: never point the walker at screens with real personal data.

Site screens (page 10) use the same format with three site-specific scripts:

- `chrome-walker.js` returns the site header, side menu and footer trees; `site-renderer.js` called with
  `D = { chrome: { signed, guest, side, footer } }` turns them into the page 8 components and stores their ids in
  shared plugin data `ssumnation` / `siteComponents`.
- `site-walker.js` walks the main column (or the donation panel with `?tab=donation`), keeps fixed overlays
  and header popovers, trims repeated lists to six items and replaces the site footer with `["footer"]`.
- `site-renderer.js` is stored as `ssumnation` / `siteRenderer`. Each screen is
  `{ id, name, group, url, active, headerKind: "signed" | "guest" | null, sideOpen, width, theme?, overlays?, tree }`:
  it adds the header instance, the side menu with `active` highlighted, absolute `overlays` (`{ x, y, tree }`) and an
  explicit Light mode when `theme` is `"light"`.

Admin screens ("Ssumnation Admin" Figma file `Js5MCzkGmAZ9QY0w3nLUe8`, page "Layouts") use the same format:

- `admin-walker.js` runs inside an `apps/admin` page (mock operator session on localhost) and maps colours to the
  `--adm-color-*` tokens (`bg-page`, `status-success-bg`, …). It returns `{ chrome, active, crumb, tree, overlays }`.
- `admin-renderer.js` is stored as `ssumnation` / `adminRenderer` in that file. Tokens map to the `color/*` variables
  (`bg-page` → `color/bg/page`), font keys to the `Admin/*` text styles, and it places the Sidebar (active item) and
  Topbar (breadcrumb) instances plus Button · Badge · Input · Tab instances. `ssumnation` / `adminHelpers` holds small
  builders (table, card, tabs, …) used to keep each `use_figma` call short.

Icons: the walkers add a sixth element to inline-SVG media, `["m", w, h, radius, color, "<width>:<first path d, 40 chars>"]`.
`svg-collect.js` returns every visible inline SVG of a page keyed by that signature. The SVGs became `Icon/<Name>` components on page 8
(ids in shared plugin data `ssumnation` / `iconComponents`), and `ssumnation` / `iconReplace` swaps the placeholder rectangles of a
screen for instances by aligning the rectangle sizes with the walker's media sequence.

Names: the brand and code identifiers are `ssumnation` since 2026-10-08, and the two Figma files were renamed to
"Ssumnation — 현재 구현 (2026-09)" and "Ssumnation Admin" (by hand — the plugin API cannot rename a file). One thing keeps
the old spelling on purpose: the shared plugin-data namespace `somnation` (data stored inside both Figma files: the stored
renderers, helper snippets and per-node width hints).

Overlay themes (page 11 "11 레이아웃 · 오버레이 테마", 2026-10-08) are built differently: the overlays are components on page 8
(Overlay Theme section) bound to the "Overlay Theme" variable collection, so one layout serves all three themes through the variable
mode. Two snippets live in shared plugin data `somnation`: `ovHelpers` (builders for theme cards, chips, tracks, avatars and display text
bound to the `ov/*` variables) and `ovBoard` (`(modeId, title, x)` → one theme section with the OBS frames; the 세로 방송 row was appended afterwards). Run them with
`new Function("return " + figma.root.getSharedPluginData("somnation", "ovHelpers"))()`; set `figma.skipInvisibleInstanceChildren = false`
first, because theme-specific layers are hidden by boolean variables and are skipped otherwise.

Widget settings popups (9 페이지 section "방송 · 위젯 · 설정 팝업 (오버레이 테마)", 2026-10-08): `dialog-walker.js` walks an open
`<dialog>` (theme previews, swatches and mini drawings become named placeholders). The stored renderer takes
`{ id, name, group, url, base, popup: { name, tree } }`: it clones the screen `base`, adds a 60 % dim layer and places the popup
120 px from the top. Shared plugin data `ovPopup` (`(screenId)`) then swaps the placeholders for Overlay Theme instances
(previews scaled to the stage, never enlarged), `Overlay/Theme Swatch`, `Studio/Alert Layout Icon` and `Studio/Goal Shape Icon`,
adds the modal header margin and sets switch knobs; `ovPopupKit` holds the tree builders used for the popups (SHELL, ROW, SWITCH …).
