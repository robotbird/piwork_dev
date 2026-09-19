# piwork Design System — Geist

This file is the visual source of truth for every piwork page and component. It adapts the Vercel Geist specification to the product UI. New UI must consume the semantic tokens in `app/globals.css`; do not introduce page-local brand colors, radii, shadows, or icon styles.

## 1. Design direction

piwork is a black-and-white duet with exactly one blue. Structure comes from 1px hairlines, hierarchy from scale and spacing, color from restraint.

- Near-white canvas (`#fafafa`) with near-black ink (`#171717`). Never pure white as the page floor, never pure black for copy in light mode.
- `--primary` **is** ink. Every primary button, selected state, and brand mark is the same neutral ink — it is not a brand color, it is the absence of one. In dark mode the mapping flips automatically (ink `#ededed` on black).
- Link blue `#0070f3` is the only functional accent: links, focus rings, selection, and success states. It never appears as a fill for large surfaces.
- Chroma lives in exactly two places: the mesh gradient on the new-chat greeting (see §9) and data visualization (see §10). Nowhere else.
- Depth is hairlines first; when a surface must float, use the two-tier whisper/float shadows (§5). Never a single heavy shadow, never glow, never glassmorphism.
- Dark mode is Vercel official black: pure `#000000` canvas, `#0a0a0a` elevated panels, `#262626`/`#333` hairlines, `#ededed` ink. Managed by next-themes `class` strategy; both themes are first-class.

## 2. Color tokens

All values live in `app/globals.css` (`:root` and `.dark`). Components reference the shadcn-style semantic layer (`bg-background`, `text-muted-foreground`, `border-border`, …), which resolves to these primitives.

### Light

| Token | Value | Use |
| --- | --- | --- |
| `--canvas` | `#fafafa` | Page floor |
| `--canvas-soft` | `#f2f2f2` | Quiet inset regions, table headers |
| `--surface-card` | `#ffffff` | Cards, popovers, menus, inputs |
| `--surface-strong` | `#f2f2f2` | Neutral fills, user chat bubble |
| `--hairline` | `#ebebeb` | Default 1px divider / card outline |
| `--hairline-soft` | `#f2f2f2` | Quiet separators |
| `--hairline-strong` | `#e0e0e0` | Inputs, composer, high-contrast outlines |
| `--ink` | `#171717` | Headings, primary buttons, brand mark |
| `--body` | `#4d4d4d` | Running text |
| `--muted-ink` | `#8f8f8f` | Secondary labels |
| `--muted-ink-soft` | `#a1a1a1` | Disabled / faint content |
| `--link` | `#0070f3` | Links, focus ring, selection, success |
| `--link-deep` | `#0761d1` | Link hover / pressed |
| `--link-soft` | `#d3e5ff` | Soft highlight fill |
| `--destructive` | `#ee0000` | Errors and destructive actions only |
| `--destructive-deep` | `#c50000` | Destructive hover / pressed |
| `--warning` | `#f5a623` | Caution states, in-progress timeline |

### Dark (Vercel official black)

| Token | Value | | Token | Value |
| --- | --- | --- | --- | --- |
| `--canvas` | `#000000` | | `--hairline` | `#262626` |
| `--canvas-soft` | `#111111` | | `--hairline-soft` | `#1a1a1a` |
| `--surface-card` | `#0a0a0a` | | `--hairline-strong` | `#333333` |
| `--surface-strong` | `#1a1a1a` | | `--ink` | `#ededed` |
| `--link` | `#0070f3` | | `--link-deep` | `#3291ff` |
| `--link-soft` | `#12325e` | | `--destructive` | `#f31b1b` |

Dark text ladder: ink `#ededed` → body `#a1a1a1` → muted `#6e6e6e` → faint `#575757`. `--primary-foreground` is `#171717`, so the primary button inverts to a white pill on black automatically.

### Chart palette

Owned by `lib/chart-theme.ts` (ECharts canvases cannot read CSS variables). Light `#007cf0 #00dfd8 #7928ca #f9cb28 #eb367f`; dark `#3291ff #4ddecf #9d7bff #ffd76a #ff5ca8`. These mirror `--chart-1..5` in both themes. See §10.

### Rules

- Success reuses link blue. There is no separate green brand color.
- Destructive red is reserved for errors and irreversible actions.
- No Tailwind default palette colors (`emerald`, `sky`, `amber`, `red-500`, …) in components — always the semantic tokens above.

## 3. Typography

Geist Sans via `next/font` (`--font-geist`), Chinese fallback PingFang SC / Microsoft YaHei. Geist Mono (`--font-geist-mono`) for code, paths, logs, IDs, and small uppercase eyebrow labels only.

Weights are binary-plus-one: **600** headings, **500** buttons/labels, **400** body. No 700+, no italics, no relaxed tracking on headings.

| Role | Utility | Size / line | Weight | Tracking |
| --- | --- | --- | --- | --- |
| Display XL | `text-display-xl` | 48 / 48 | 600 | -5% |
| Heading LG (page titles) | `text-heading-lg` | 32 / 40 | 600 | -4% |
| Heading MD | `text-heading-md` | 20 / 28 | 600 | -2% |
| Label SM (buttons, tabs) | `text-label-sm` | 14 / 20 | 500 | -2% |
| Body LG | `text-body-lg` | 16 / 24 | 400 | 0 |
| Body MD | `text-body-md` / `text-sm` | 14 / 20 | 400 | 0 |
| Body SM | `text-body-sm` / `text-xs` | 12 / 16 | 400 | 0 |

Rules:

- Page titles use `text-heading-lg`; panel/card titles `text-base font-medium`; never hand-rolled `text-[Npx]` sizes — use the utilities above (`text-[13px]` → `text-sm`, `text-[15/16px]` → `text-base`).
- Negative tracking belongs to headings only.
- Mono eyebrows: `font-mono text-xs font-medium uppercase` (see `Badge`).
- Tabular numerals (`tabular-nums`) for metrics and aligned numeric columns.

## 4. Shape (radius)

`--radius: 0.5rem` → `rounded-sm` 4 · `rounded-md` 6 · `rounded-lg` 8 · `rounded-xl` 12. The distribution is bimodal — controls are square-ish, content is soft, and only two true circles exist:

| Radius | Utility | Use |
| --- | --- | --- |
| 4px | `rounded-sm` | Menu items, kbd chips, inline tags |
| 6px | `rounded-md` | **Buttons, inputs, triggers, toolbar rows, nav rows, icon tiles** |
| 8px | `rounded-lg` | Nested content inside a 12px card (error blocks, forecast cells) |
| 12px | `rounded-xl` | **Cards, dialogs, menus/popovers, composer, toasts** |
| 16px | `rounded-2xl` | Rare large feature panels only |
| full | `rounded-full` | Icon-only circular buttons (send/stop), avatars, status dots — and the auth pill (§6) |
| full | `rounded-full` | User chat bubble tail keeps `rounded-br-md` inside `rounded-xl` |

Never mix: a control never gets 12px; a card never gets 6px; pills are never used for navigation or ordinary buttons.

## 5. Elevation

Three levels, hairline always included so a shadow is never the only edge:

| Level | Token | Value (light) |
| --- | --- | --- |
| L0 flush | `--shadow-card` | `0 0 0 1px var(--hairline)` |
| L1 whisper | `--shadow-whisper` | hairline + `0 1px 1px rgba(0,0,0,.04)` |
| L2 float | `--shadow-float` | hairline + `0 2px 2px rgba(0,0,0,.02)` + `0 8px 16px -4px rgba(0,0,0,.08)` |

Dark mode keeps the same geometry with heavier alphas (`.3` / `.2` / `.4`). Floating chrome (slash menu, scroll pill, toasts) uses `shadow-[var(--shadow-float)]`.

## 6. Buttons

- **Primary (app)**: ink background, white text, `rounded-md` (6px), `h-9`, hover `bg-primary/85`. Dark mode inverts to white on black via tokens — no component code changes.
- **Secondary/outline**: card surface, ink text, `border-border`, `rounded-md`.
- **Ghost**: transparent, `hover:bg-muted`, `rounded-md`.
- **Circular icon buttons**: `rounded-full`, only for icon-only actions (send, stop, avatars). Keep them true circles — never 6px squares.
- **Pill (`variant="pill"`)**: full-round black CTA. **Sole occupant: the login/register submit button.** Marketing-style pills never appear inside the app shell.
- Icon-only buttons need an accessible name and ≥40×40px on touch layouts.

## 7. Components

### Navigation

- Chat sidebar sits on `--sidebar` (canvas in light / `#0a0a0a` in dark) with hairline dividers; the management sidebar matches.
- **Sidebar lists are one shared spec across surfaces** (chat home and management). The chat sidebar must never redefine font family, size, or text colors locally — no `.openai-sidebar`-style CSS overrides; Geist and the tokens below apply everywhere.
- **Sidebar rows** (nav items, chat history): Geist `text-[14px] leading-5` (14/20). Inactive: `text-sidebar-foreground`, weight 400. Active/current row: `bg-sidebar-accent` + `font-medium` + `text-sidebar-accent-foreground`. Hover: `bg-sidebar-accent/65` + `text-sidebar-accent-foreground`. Management rows are the reference implementation (`NavigationLink` in `management-sidebar.tsx`).
- **Sidebar group labels**: `text-[13px] font-medium leading-5 text-muted-foreground`. The `SidebarGroupLabel` primitive defaults to `text-[10px] font-semibold uppercase tracking-[0.12em]` — always cancel with `normal-case tracking-normal` and override size/weight/color (see `Projects` / `Recent` labels and management `h2` headings).
- **Sidebar icons**: 18px (`size-[18px]`, or `[&_svg]:size-[18px]` on the row to beat the primitive's `[&_svg]:size-4`), inactive `text-muted-foreground`, hover/active `text-foreground`.
- Tailwind v4 gotcha: the data variant shorthand `data-active:` compiles to attribute *presence* `[data-active]`, which also matches `data-active="false"`. Use the explicit `data-[active=true]:` form in `components/ui/sidebar.tsx` and row classes.

### Cards and dialogs

- Cards: `rounded-xl border-border bg-card`, 20–24px padding, L0 (hairline only) by default.
- Dialogs/alert dialogs: `rounded-xl border-border bg-card`, overlay `bg-foreground/50`.
- Menus/popovers/tooltips/dropdowns: `rounded-md border-border bg-card`; items `rounded-sm`.

### Forms

- Inputs/textarea: `h-9`, `rounded-md`, white on `border-border`; focus pair is `border-link` + `ring-2 ring-link/20`.
- Composer: 12px (`rounded-xl` via input-group textarea mode), `--hairline-strong` border. **Focus never changes the composer border** — the caret is the focus indicator; no blue border or ring appears on the card.

### Chat

- User bubble (structure is settled — do not reshape): `rounded-xl rounded-br-md border-border bg-secondary shadow-none`; token change alone recolors it per theme.
- Assistant content sits directly on canvas.
- Error cards: `rounded-lg border border-destructive/25 bg-destructive/5 text-destructive` (dark-safe).
- Tool progress / file cards / message actions keep neutral surfaces; brand moments use ink, not blue.

## 8. Icons (dual-track standard)

Two sanctioned sets, never mixed within one component:

**Track 1 — lucide-react (default for all UI chrome).**

- Stroke width is normalized globally in `app/globals.css`: `@layer base { svg.lucide { stroke-width: 1.5; } }`. **Never pass a `strokeWidth` prop** — the CSS property wins over the attribute anyway. Escape hatch for rare emphasis: `[stroke-width:2]` utility class.
- Size scale is 12 / 14 / 16 / 20 (`size-3` / `size-3.5` / `size-4` / `size-5`). No 17/18/19px one-offs; dense rows use 16, feature rows 20.
- Icons inherit the surrounding text color.

**Track 2 — hand-drawn Geist fill set (`components/chat/icons.tsx`).**

- 16-grid filled glyphs (Vercel-style) with `size` prop (default 16).
- Scope: brand marks, message-action glyphs, provider logos, and the send/stop controls. Not for general navigation or management chrome.

**Name ownership (no dual sourcing).** Seven names exist in both sets — inside `components/chat/**` the hand-drawn set is the single source; management and general chrome use lucide: `ArrowUp` · `Stop` · `Copy` · `Download` · `ChevronDown` · `Sparkles` · `Cross`. A file must never import the same name from both.

## 9. Mesh gradient

The single chromatic flourish. Six radial stops over the brand mark on the **new-chat greeting only** (`components/chat/greeting.tsx`, `.mesh-bloom`): develop `#007cf0→#00dfd8`, preview `#7928ca→#ff0080`, ship `#ff4d4d→#f9cb28`, masked to fade before the edges. Dark mode dims to `opacity: 0.42`. It never appears on buttons, cards, banners, or any other page.

## 10. Charts

ECharts cannot read CSS variables, so all chart color lives in `lib/chart-theme.ts` (`getChartTheme(resolvedTheme)`) — single source, mirrored by `--chart-1..5`:

- Series palette per theme (§2). The 6th "other" slice is neutral `#a1a1a1` / `#575757`; failed/neutral series is hairline gray.
- Axis labels `--muted-ink`, split lines hairline-soft, tooltip is ink `#171717` with white text in both themes.
- Charts rebuild on theme switch (options are `useMemo`-keyed on `resolvedTheme`).
- Chart colors mean data, not status. Status colors are link (healthy/success), warning (in progress), destructive (failed).

## 11. Responsive behavior

| Breakpoint | Behavior |
| --- | --- |
| `<640px` | Single-column grids; single primary pane; hamburger navigation |
| `640–1024px` | Two-column grids; compressed product panes |
| `1024–1280px` | Full product shell; three-column feature grids |
| `>1280px` | Chat content caps at `max-w-3xl`; management at 1480px |

- Touch targets 44px where space permits, never below 40px for primary actions.
- Sidebar navigation collapses below 768px.
- No horizontal scrolling except deliberate chip/table rails.

## 12. Accessibility

- Meet WCAG AA text contrast in both themes.
- Never rely on color alone for status; pair with copy or an icon.
- Every icon-only control has an `aria-label` or visually hidden label.
- Focus indicator is always visible (`color-mix(link 50%)` outline); never globally disable outlines.
- Honor reduced motion; keep framer-motion transitions functional, brief, low-amplitude.

## 13. Do / Do not

Do:

- Use semantic CSS variables and the type/radius utilities everywhere.
- Let `--primary` do the work — selected states, buttons, and brand moments all stay ink.
- Keep blue to links, focus, success, and data.
- Use hairlines; float with `--shadow-float` only when genuinely overlaying.
- Keep icon strokes at the global 1.5 and sizes on the 12/14/16/20 scale.
- Keep sidebar lists on the shared §7 Navigation spec — chat and management rows use identical font, weight, and color tokens.

Do not:

- Introduce a second brand color, a green success color, or Tailwind palette colors.
- Use pill radii outside the auth CTA and true circular icon buttons.
- Add bold (700) headings, relaxed heading tracking, glassmorphism, gradient cards, or glow shadows.
- Copy the mesh gradient or chart palette onto other surfaces.
- Hardcode hex values in components when a token exists (charts go through `lib/chart-theme.ts`).
- Write the `data-active:` shorthand for state-dependent row styles — it matches attribute presence in Tailwind v4 and fires on `data-active="false"`; use `data-[active=true]:`.
- Override the app font family per surface (system-font stacks on one sidebar, Geist on the other).
- Reshape the settled chat bubble structure or pass `strokeWidth` to lucide icons.

## 14. Contribution checklist

Before merging UI work, verify:

1. All colors, radii, spacing, and depth use this system or an existing semantic utility.
2. Ink is the only "brand" fill; blue only links/focuses/success/data.
3. Headings use the type-scale utilities; no `text-[Npx]` one-offs.
4. Icons follow §8: correct track for the context, no `strokeWidth` props, on-scale sizes.
5. Keyboard focus, labels, contrast, responsive collapse, and touch sizes were checked in **both** themes.
6. Charts pull from `lib/chart-theme.ts` and rebuild on theme switch.
7. No pill/oversized-radius, shadow-stacking, or second-accent regressions were introduced.
