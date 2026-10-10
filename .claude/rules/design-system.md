---
paths:
  - "ui/src/**"
---

# Design system (UI)

Source of truth: this file plus the actual code in `ui/src/design/tokens.css` and `ui/src/components/common/`. Keep them in sync with reality.

## Golden rules

- **No ad-hoc hex in CSS modules.** Pick an existing token. If none fits, propose a new token in `tokens.css` — never hardcode.
- **No bespoke `<input>` / `<button>` styling.** Use the primitive components (`Input`, `IconButton`, `Button`, `InputGroup`, `ToggleSwitch`). Extending? Pass `className` for layout, not for colours/sizing.
- **Primary (orchid) = active/selected.** Secondary (amber) = hover/interactive intent. Never flip these roles.
- **Weight for hierarchy, not size.** Two text sizes only (13/15). If you need a third, the design failed — push back.
- **Width of interactive elements uses `var(--input-height)`**: 32px. Never hardcode pixel heights on inputs/buttons/selects.

## Key files

| Role | Path |
|---|---|
| Tokens (source of truth) | `ui/src/design/tokens.css` |
| Legacy alias layer (`--color-*`) | `ui/src/styles/variables.css` |
| Font declarations (`--font-sans`, `--font-mono`) | `ui/src/assets/fonts/fonts.css` |
| Primitive components | `ui/src/components/common/{Input,IconButton,Button,InputGroup,ToggleSwitch,Numeric}.tsx` |
| Theme store | `ui/src/store/theme.ts` |
| Theme sync hook | `ui/src/hooks/useSyncTheme.ts` |

## Palette (semantic tokens)

| Token | Role | Light | Dark |
|---|---|---|---|
| `--color-primary` (`--accent`) | Selected, active, brand identity | `#c026d3` Orchid-600 | `#d946ef` Orchid-500 |
| `--color-secondary` (`--secondary`) | Preset/scene indicator, hover hint, warning | `#f59e0b` Amber-500 | `#fbbf24` Amber-400 |
| `--color-green` (`--success`) | Confirmation (always + ✓ icon) | `#10b981` Emerald-500 | same |
| `--color-danger` (`--danger`) | Error, destructive, clip (always + ⚠ icon) | `#e11d48` Rose-600 | same |
| `--midi` / `--midi-text` | MIDI-assigned indicators (preset/scene tag, badge, link button) — distinct from accent and hover | `#0ea5e9` Azure-500 / `#0369a1` Azure-700 | `#38bdf8` Azure-400 / same |
| `--color-border` | Interactive control borders (inputs, buttons, selects) | `#e5e7eb` | `rgba(255,255,255,0.25)` |
| `--color-divider` | Chrome separators (header/footer/panel edges) | `#e5e7eb` | `rgba(255,255,255,0.1)` |
| `--color-bg` | Page background | grey-50 | radial gradient navy |
| `--color-surface` | Cards, elevated panels | white | `rgba(255,255,255,0.03)` + blur |
| `--color-text` / `--color-muted` / `--text-subtle` | Text scale | grey-900 / 500 / 400 | grey-dark-900 / 500 / 400 |

## Typography

Two typefaces, both SIL OFL 1.1, self-hosted as variable woff2. `@font-face` declarations live in `ui/src/assets/fonts/fonts.css`; the website mirrors them via `web/src/styles/fonts.css`.

- **Space Grotesk** (variable, weights 300–700) — everything that reads as text: labels, headings, body copy, all chrome surfaces. Exposed as the `--font-sans` token; the app root sets `font-family: var(--font-sans)`.
- **JetBrains Mono** — every numeric value and machine identifier: dB / Hz / cents / LUFS readouts, parameter values, MIDI labels (CC/PC), sample-buffer counts, version strings, plugin-format tags. Exposed as `--font-mono`. Applied via the **`<Numeric>` primitive** (`ui/src/components/common/Numeric.tsx`), which wraps numeric/identifier text and sets `font-family: var(--font-mono); font-variant-numeric: tabular-nums slashed-zero;` — never restyle colours/sizing on it, it inherits from context. Numeric *form fields* use the `mono` prop on the `Input` primitive instead (since `<Numeric>` cannot wrap an `<input>`). Do not hand-roll `font-variant-numeric: tabular-nums` on individual CSS rules — use `<Numeric>`.
- Slashed zero: `<Numeric>` applies `slashed-zero` automatically, distinguishing 0 from O at a glance — standard pro-audio convention.
- Chrome scale (panels, settings, dialogs, header, footer): `--text-xs` (13px, weight 500) · `--text-base` (15px, weight 400) · `--text-base-strong-weight` (600) · `--text-display` (reserved). Minimum 13px anywhere in chrome.
- **Weight for hierarchy, not size** — two text sizes only (13 / 15). If a third is needed, the design has failed; push back.

## Grid block scale + accessibility floors

The Grid is a viz surface — block-internal typography scales proportionally with the active cell zoom and is **not** bound to the chrome 13/15 scale. Set the `--block-scale` CSS variable on the Grid root from `useGridLayout().blockScale` (= `cellSize / 88`, M baseline). Block CSS uses:

```css
font-size: max(<floor>, calc(<base> * var(--block-scale, 1)));
```

Floors enforce WCAG-aligned readability regardless of zoom — they cannot be defeated by zooming out:

- `.blockType` (abbreviation tag like "IN" / "OUT" / "PLG"): floor `16px`
- `.pluginName` (block plugin label): floor `11px`
- Icons inside blocks: floor `14px` (apply via `Math.max(14, Math.round(<base> * blockScale))` in JS)

Chrome typography (panels, settings, dialogs, header) is NOT scaled by zoom — only the Grid viz surface scales. When adding new block-internal typography, default to `var(--block-scale)` consumption with a sensible floor.

## Dimension tokens

| Token | Value | Use |
|---|---|---|
| `--radius` | 0 | every interactive bordered element (sharp-edge direction) |
| `--input-height` | 32px | default height for inputs/buttons/selects/InputGroup |
| `--input-height-sm` | 24px | compact variant (badges, tags) |
| `--input-padding-x` | 0.6rem | horizontal padding for text inputs/buttons |
| `--border-container` | light: `none` / dark: `1px solid var(--color-border)` | optional outline for tinted containers (e.g. tab list) |

## Interaction patterns

- **Hover on bordered controls:** `border-color: var(--color-secondary)` + `background: color-mix(in srgb, var(--color-secondary) 8%, transparent)`. Transition `var(--transition-snap)` (180ms `cubic-bezier(0.2, 0, 0, 1)` — sharp-out, lands gently; replaces the older 150ms `ease`).
- **Focus on text inputs:** `border-color: var(--color-secondary)` (same colour as hover); `outline: none`. Rationale — **focus is a hover-in-place**: the user expects visual continuity, not a separate ring colour. Don't introduce a blue focus ring; **blue is reserved exclusively for azure MIDI indicators** (`--midi` / `--midi-text`) so colour-vision-deficient users can still distinguish "MIDI-assigned" from "focused" at a glance.
- **Active/selected:** `color: var(--color-primary)` + orchid tint background. Never blue/grey.
- **Tactile press:** Button / IconButton / Tag / Tablist tab apply `:active:not(:disabled) { transform: translateY(0.5px); }`. Press is instant (no transition on transform); the rest of the snap easing handles colour/border changes.
- **Section-title convention (Options panel):** orchid for grouping headers (Parameters, States). Neutral `var(--color-text)` for input labels (Plugin, Test Tone, Level, Target Loudness).
- **Slider design spec** (canonical):
  - Track: 4px tall, background `color-mix(in srgb, var(--color-muted) 25%, transparent)`. Sharp edges (`--radius: 0`).
  - Active fill: `var(--color-secondary)` (amber). Direction: from min toward the current value by default; flip to the right of the thumb (current → max) when the active range *is* the right-of-thumb region (e.g. binary "ON" trigger).
  - Thumb: square 16×16, `var(--color-secondary)` (amber) background, **darker-amber outline** `border: 2px solid var(--color-secondary-outline); box-sizing: border-box;` (`--secondary-outline` = `--amber-700` light / `--amber-600` dark). Sharp edges. Outline reads against the amber fill at any zoom; no surface-coloured halo, no layout shift on focus.
  - Focus-visible: **recolour the existing border** to `var(--color-primary)` (orchid) — `transition: border-color var(--transition-snap);` makes the colour swap feel continuous with the rest of the hover system. No extra outer ring.
  - Tick row (optional): 1px-wide × 4px-tall ticks in `var(--color-muted)` with 13px (`var(--text-xs)`) labels — wrap the value in `<Numeric>` for monospace + tabular-nums alignment.
  - Floating thumb value label (optional): 13px `var(--color-secondary)`, centred over the thumb — wrap in `<Numeric>` for monospace rendering. Clamp `left` to `[8%, 92%]` so it doesn't bleed past the track at extremes.
  - Reusable component: `ui/src/components/common/Slider.tsx` (Radix-backed). All sliders (Trigger, Options panel ParametersSection, SignalSection) consume this primitive — never roll a bespoke `<input type="range">` or duplicate styling.
- **Radix-controlled triggers** (Select/DropdownMenu) expose `--trigger-border` and `--trigger-radius` CSS variables — set on a parent to fuse a trigger into an `InputGroup` without modifying its markup.

## Floating panel titlebar (canonical pattern)

Used for the Options panel and any modal dialog (e.g. `MidiAssignDialog`). Every floating surface that has a title gets the same titlebar shape so the app reads as one design system.

```css
.titlebar {
  display: flex;
  align-items: center;
  padding: 0.4rem 0.6rem;
  background: var(--panel-titlebar);
  border-bottom: 1px solid var(--color-divider);
  gap: 0.35rem;
}
.titlebarText {
  font-size: var(--text-base);
  font-weight: var(--text-base-strong-weight);
  color: var(--color-text);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0;
}
```

- Titlebar sits at the top of the panel/dialog container; the body lives below it (with its own padding `0.75rem`).
- Container itself has no `padding` — the titlebar handles its own; the body handles its own.
- For modal dialogs, set `overflow: hidden` on the container so the titlebar's bottom border lines up with the side borders.
- Reference impls: `ui/src/components/options/OptionsPanel.module.css` (`.titlebar`, `.blockName`) and `ui/src/components/common/MidiAssignDialog.module.css` (`.titlebar`, `.titlebarText`).

## Icons

- Library: [`react-icons`](https://react-icons.github.io/react-icons/)
- Active sets: Tabler (`react-icons/tb`), Lucide (`react-icons/lu`), Ionicons 5 (`react-icons/io5`), Phosphor (`react-icons/pi`).
- Tabler is the default for new icons where multiple sets have an equivalent. The other sets are in use only because a specific glyph wasn't available in Tabler at sufficient quality (e.g. `PiTrafficSignal` for the Grid toolbar's MIDI test panel toggle, `LuSparkles` as the GridOverlay preset/scene separator, `IoCloseSharp` for hover-only block close affordance).
- Before introducing a fifth set, audit existing imports and exhaust the four current sets first.

## Theme

- Zustand store holds `theme: 'light' | 'dark' | 'system'`; persists under localStorage key `stellarr.theme`
- `useSyncTheme()` (called in `App.tsx`) writes `data-theme="light"|"dark"` on `<html>` and subscribes to `prefers-color-scheme` changes when `'system'`
- UI toggle in header flips between resolved light/dark (skips `'system'` to avoid invisible transitions)

## UI mockups + design previews

- **Preview-before-implement is mandatory for any new or modified visual UI.** When the user asks for a UI change (new component, restyled control, layout shift, colour swap), produce an HTML mockup first and wait for the user to pick / approve before touching `.tsx` / `.module.css`. Don't bundle "I'll show you the preview AND implement it" — split into two turns. Applies even to small tweaks; the user wants to see it before code lands.
- **Always render mockups in light AND dark mode side-by-side.** Stellarr ships both themes; a mockup that only shows one half is incomplete. Use a 2-column layout (light left, dark right) per variant, or two stacked sections — never a single theme.
- Use the real semantic tokens from `ui/src/design/tokens.css`. Don't hardcode hex values. Light theme palette is the `:root[data-theme="light"]` block; dark is `:root[data-theme="dark"]`. Copy the tokens needed (or load them via a `<style>` block in the HTML preview).
- Save mockup HTML under `.superpowers/brainstorm/<session-id>/content/` (gitignored, persistent across sessions, discoverable). Reference the absolute path back to the user so they can open it.

