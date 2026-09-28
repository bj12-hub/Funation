# Design Tokens

Implementation: `apps/web/src/styles/tokens.css`

## Source

- Figma file: https://www.figma.com/design/PXOl6e2HQVWsu9qx9iagJV (펀페이)
- The file has no Figma Variables or shared styles, so tokens were extracted by
  measuring usage frequency across **350 service frames** (1440px wide),
  excluding the documentation boards `01 Design System` – `08 Developer Specification`.

## Decisions

- **Service screens are the source of truth.** The `01 Design System` board
  (node `799:2558`) previously used different values (Noto Sans KR / Roboto Mono,
  `#fb7185`, `#34d399`, `#292943` ...). On 2026-09-28 the board was updated to the
  service-screen values, and a `Design tokens` section (node `899:2`) mirroring
  `tokens.css` was added to it.
- **Brand name is `Funation`.** All Latin spellings in the Figma file
  (`FunNation`, `FUNNATION`, `funnation` — 689 text nodes, 55 layer names) were
  changed to `Funation` / `FUNATION`. Code uses `Funation`.
  The Korean spelling in Figma (`펀네이션`) has not been changed yet.
- **Global header menu** uses the most complete set:
  LIVE · 인기 크리에이터 · 명예의 전당 · 고객센터.

## Rules from the Figma board

- User-facing UI must not expose supply discount rate, supply cost, or margin
  (`01 Design System` board subtitle).
- Common states: DEFAULT, HOVER, PRESSED, DISABLED, LOADING, SUCCESS, ERROR, WARNING.

## Usage

- Components reference CSS variables only; do not hardcode hex values.
- Styling uses CSS Modules (no Tailwind). Figma MCP output (Tailwind) must be
  converted to CSS Modules + tokens.
