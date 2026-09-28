# Design Tokens

Implementation: `apps/web/src/styles/tokens.css`

## Source

- Figma file: https://www.figma.com/design/PXOl6e2HQVWsu9qx9iagJV (펀페이)
- The file has no Figma Variables or shared styles, so tokens were extracted by
  measuring usage frequency across **350 service frames** (1440px wide),
  excluding the documentation boards `01 Design System` – `08 Developer Specification`.

## Service screens vs. `01 Design System` board

The `01 Design System` board (node `799:2558`) and the actual service screens use
**different** visual values. Tokens follow the service screens, because they are
what users see and they make up almost all frames.

| Item | Service screens (used) | `01 Design System` board |
|---|---|---|
| UI font | Gothic A1 (+ Inter) | Noto Sans KR, Roboto Mono |
| Primary text | `#f3f4f6` | `#f5f5fa` |
| Secondary text | `#9ca3af` | `#9a9aaf` |
| Surface | `#121225` | `#11111e` |
| Border | `#20203e` | `#292943` |
| Success | `#10b981` | `#34d399` |
| Danger | `#ef4444` | `#fb7185` |

**Open decision:** align the Figma board with the service screens, or vice versa.

## Brand name

Figma screens use **FunNation** (logo, UI copy). The repository and docs use
**Funation**. Code uses the Figma spelling for user-facing text.

**Open decision:** confirm the official product name.

## Rules from the Figma board

- User-facing UI must not expose supply discount rate, supply cost, or margin
  (`01 Design System` board subtitle).
- Common states: DEFAULT, HOVER, PRESSED, DISABLED, LOADING, SUCCESS, ERROR, WARNING.

## Usage

- Components reference CSS variables only; do not hardcode hex values.
- Styling uses CSS Modules (no Tailwind). Figma MCP output (Tailwind) must be
  converted to CSS Modules + tokens.
