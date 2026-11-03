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
  service-screen values, and a `Design tokens` section (node `902:2`) mirroring
  `tokens.css` was added to it.
- **Brand name is `Ssumnation`.** All brand spellings in the Figma file were changed
  to `Ssumnation` (`SSUMNATION` for all-caps): Latin `FunNation` / `FUNNATION` /
  `funnation` (689) and Korean `펀네이션` (431), plus 56 layer names.
  Every changed text node was verified against its expected string.
  Code and new UI copy must use `Ssumnation` only.
- **Global header menu** uses the most complete set:
  LIVE · 인기 크리에이터 · 명예의 전당 · 고객센터.

- **Home tokens (2026-09-28).** The home screen (727:2742) added media overlay
  colors/gradients, `--color-accent-soft`, `--color-neutral-soft`, `--color-bg-footer`,
  `--color-bg-light`, `--font-size-40` and `--shadow-button`, taken directly from that frame.

## 2026-11-03 visual refresh — direction B "웜 블랙 · 버밀리언" (code-first)

User request (2026-11-03): the colors and layout looked too much like funnation, and the design looked AI-made. Three
directions were shown; the user picked **B (warm black · vermilion)** with the side menu kept and tidied. OBS overlay
themes (`features/overlayTheme`, 2026-10-08) and the admin console (`apps/admin`, own `--adm-*` tokens) stay as they are.

This is a **difference from Figma**: the 펀페이 frames and the "현재 구현" file's Site Color variables still hold the old
navy · purple values. Token names are unchanged, so code keeps referencing the same variables.

| Area | Figma (before) | Code since 2026-11-03 |
|---|---|---|
| Neutrals (dark) | navy `#080811` · `#121225` · `#1a1a2e` · `#20203e`, cool greys | warm black `#131211` · `#1b1a18` · `#22201e` · `#2a2825`, borders `#2e2b27` · `#3a3632`, text `#f2ede6` · `#a8a196` · `#857e74` |
| Neutrals (light) | `#f6f6fb` · white · lavender greys | paper `#f7f4ef` · white · `#f5f2ed`, borders `#e6e0d8` · `#d9d2c8`, text `#1a1714` · `#5e574e` · `#6b645a` |
| Primary | purple `#8b5cf6` (light `#7c3aed`) | vermilion `#cf4527` (light `#b8391a`), as text `#ff8a66` (light `#9a3412`) |
| Accent | pink `#ec4899` (light `#db2777`) | teal `#18806a` (light `#157a65`), as text `#3dbfa6` (light `#0f6e5a`) |
| Live · highlight · charge | gold `#f5bf0a` · cyan `#06b6d4` · blue `#4a90e2` | butter `#f2c14e` · teal `#3dbfa6` · teal `#18806a` (light `#157a65`) |
| Gradients | purple → pink / indigo buttons and logo text, blue → purple settlement banner | flat: every `--gradient-*` button / logo / banner token is one color (`linear-gradient(c, c)`), so `background-clip: text` and image uses still work. Media scrims and rank medal gradients stay |
| Shadows | `--shadow-header` · `--shadow-card` drop shadows, `--shadow-button` | hairlines (`0 1px 0 border`, `0 0 0 1px border`), button shadow none. Modal and popup shadows stay |
| Radius | 2 · 4 · 6 · 8 · 12 · 16 · 20 · pill | same names, smaller values: 6 and 8 → 4px, 12 and 16 → 6px, 20 → 8px (2, 4 and pill unchanged). Literal `border-radius` values in modules are unchanged |
| Latin / numbers | Inter (`--font-latin`) | Archivo (`--font-archivo`). Inter stays loaded only for the 미니멀 필 overlay theme |

Status colors (success · danger · warning · info), third-party brand colors (Kakao, Naver Pay, Google, platform marks),
media scrims and the overlay `--ov-*` tokens did not change. White on the new fills: vermilion 4.63:1 (light 5.77:1),
teal 4.84:1 (light 5.25:1); the `onAccentTextGuard` rule (`--color-text-on-accent` stays white) still holds.

## Rules from the Figma board

- User-facing UI must not expose supply discount rate, supply cost, or margin
  (`01 Design System` board subtitle).
- Common states: DEFAULT, HOVER, PRESSED, DISABLED, LOADING, SUCCESS, ERROR, WARNING.

## Usage

- Components reference CSS variables only; do not hardcode hex values.
- Styling uses CSS Modules (no Tailwind). Figma MCP output (Tailwind) must be
  converted to CSS Modules + tokens.
