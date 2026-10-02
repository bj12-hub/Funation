# Mock images

Original illustrations for the mock data in `apps/web/public/mock`. No photos, no third-party art, no real people:
the mock creators are fictional personal broadcasters and 엑셀방송 crews (the service focus).

- `scenes.mjs` draws each scene as SVG: character avatars, personal broadcasts (talk, singing, game, mukbang, late-night
  radio, virtual) and 엑셀방송 scoreboards with the crew, plus wide hero / promo / trophy art without text.
- `render.mjs` lists every output file (path, size, scene) and renders them with headless Chrome. Each creator keeps the
  same character everywhere (seed per creator id).

```bash
node scripts/mock-images/render.mjs
```

Pass a filter to render a subset, e.g. `node scripts/mock-images/render.mjs home/`. After replacing images, clear the dev
image cache (`apps/web/.next/cache/images`) or the old optimized copies keep showing.

Not generated here: platform logos (`room/logo-*`), OBS/XSplit guide screenshots, widget samples, signature samples and the
studio banner samples.
