# Management Overview Design QA

- Source visual truth: `/Users/robotbird/.codex/attachments/2989485b-d2e0-4e9d-9ecb-c9aff1618b27/image-1.png`
- Return interaction reference: `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-df0f5e66-f6f4-4dff-ac0a-75359caae617.png` (`480 × 762`)
- Source pixels: `1680 × 945`, desktop light-theme reference
- Implementation: `http://localhost:3000/management`
- Implementation capture: Chrome browser session capture at `1680 × 945` CSS px; the session-backed capture was emitted inline but not persisted as a local file
- Implementation pixels/CSS size: `1680 × 945`, device scale 1
- State: authenticated regular user, management overview, light theme
- Density normalization: none; source and implementation were inspected at the same viewport size

## Full-view comparison evidence

The source and final browser render were compared at the same 1680 × 945 viewport. Both use a 248 px fixed white sidebar, a 56 px empty top utility bar, a pale blue-gray page canvas, five equal metric cards, a 5/4/3 analytical grid, and a matching 5/4/3 detail grid. The final implementation keeps all primary content above the fold with proportions and whitespace closely aligned to the source.

## Focused region evidence

The full-size captures were readable enough to judge the sidebar groups, metric typography, ECharts axes and labels, donut legend, table rows, status list, timeline, borders, radii, and card spacing. The supplied settings-sidebar crop was also inspected at original size to match its arrow-and-label return control. No additional focused crop was needed.

## Required fidelity surfaces

- Fonts and typography: Uses the existing Geist/PingFang stack with 30 px page title, compact 11–16 px dashboard labels, strong tabular values, and no visible clipping or unintended wrapping.
- Spacing and layout rhythm: Sidebar width, top utility bar, content gutters, card gaps, 5-column KPI row, two 12-column content rows, and row heights now align with the reference composition.
- Colors and visual tokens: Pale `#f9fbfe` canvas, white cards, subtle blue-gray borders, dark navy headings, blue primary accents, and green success states match the source palette.
- Image quality and asset fidelity: The edited return region contains no raster imagery. Its arrow uses the project's established Lucide icon set and remains sharp at all densities. Both analytical graphics are native ECharts canvas renders with crisp labels and responsive sizing.
- Copy and content: All overview metrics, task data, system states, Skill ranking, and activity entries are deterministic static Chinese demo data matching the reference's information architecture.

## Findings

No actionable P0, P1, or P2 visual differences remain. The return control follows the reference's left-arrow and bold-label pattern while using the management console's existing blue-gray tokens.

## Interaction and runtime checks

- Overview navigation loads and the active sidebar item is correctly highlighted.
- The “返回应用” control is keyboard focusable, exposes a descriptive link name, and navigates to `/`; browser back restores the management overview.
- Enterprise Skill navigation reaches `/management/skills`, and browser back returns to the overview.
- ECharts bar and donut charts render without runtime errors and resize with their containers.
- At narrower desktop widths the analytics and detail panels stack without horizontal page overflow; mobile uses a horizontally scrollable top navigation.
- Application console errors: none. Chrome reported only its extension message-channel closure notice, unrelated to the page runtime.

## Comparison history

- Iteration 1 — P2: the main content started too high because the empty desktop utility bar visible in the source was missing. Fixed by adding a 56 px bordered top bar above management content.
- Iteration 1 — P2: the lower detail cards were visibly shorter than the source, leaving excessive blank canvas at 945 px height. Fixed by increasing chart and list-row heights while preserving the grid.
- Iteration 2 — P2: the management sidebar lacked the explicitly requested return-to-app affordance. Replaced the top brand-only slot with a 56 px arrow-and-label link, added hover/focus feedback, and mirrored the control in the mobile header.
- Post-fix evidence: final 1680 × 945 browser capture aligns the title, KPI row, analytics row, detail row, sidebar footer, and bottom card edge with the source's vertical rhythm.

## Follow-up polish

No P3 items are required for the requested scope.

final result: passed

## PiWork conversation refinement QA (2026-09-18, round 3)

- Source visual truth:
  - `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-a21bdea8-da80-4b5b-83b0-2aa3a08bd9b3.png` — previous PiWork implementation, `3360 × 1924`.
  - `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-9705f653-df52-4b52-a2f0-1d3c13784180.png` — ChatGPT Web conversation reference, `3360 × 1924`.
- Implementation URL: `http://localhost:3000/` and `/chat/81275fc9-461a-49e1-b0ef-1ea3edaad272`.
- Implementation screenshot path: browser-session inline captures from the in-app Browser and Chrome; the browser backend did not expose a persistent filesystem path.
- CSS viewport: `1680 × 962`, device scale normalized against the supplied `3360 × 1924` source captures at approximately 2× density.
- State: desktop light theme; empty composer and authenticated existing-conversation state.

### Findings and comparison history

- Iteration 1 — P1: the empty-state `聊天 / 工作` segmented control remained visible despite the explicit request to remove it. Fixed by rendering an empty desktop header when no messages exist; post-fix accessibility snapshot contains no chat/work controls.
- Iteration 1 — P2: the empty-state visual group sat too low and the composer was roughly 10% wider than the reference. Fixed by moving the title to `y=327`, anchoring the composer at `37.5%` (`y=407.75`), and reducing the outer composer track to `832px`, producing a visible composer width of `768px` after gutters.
- Iteration 1 — P2: sidebar navigation appeared heavier than the reference. Fixed with a system UI/PingFang stack, explicit 400 weights, zero extra tracking, 15px primary navigation, and 14px project/history text; selected rows no longer increase font weight.
- Iteration 2 — P2: the existing-conversation reading column and composer remained `72px` narrower than the normalized ChatGPT reference. Fixed by changing the outer chat-content track from `760px` to `832px`; the verified conversation composer is now `768 × 64px` at `x=586`.

### Full-view comparison evidence

The final empty state uses the same overall composition as the reference: a 260px quiet sidebar, large neutral canvas, centered 28px question, 768px visible composer, and recessed project bar. There is no centered mode switch. The final conversation state preserves the reference's breadcrumb/header tools, document-style answer column, right-aligned user bubble, and bottom-centered 768px single-line composer.

### Focused region evidence

- Sidebar crop: navigation line heights remain 44px/36px, while explicit normal weights remove the previous bold appearance without changing the established vertical rhythm.
- Empty composer crop: measured `768 × 124px`, 28px radius, subtle one-pixel border, low shadow, unchanged white surface between empty and entered states.
- Conversation composer crop: measured `768 × 64px`, 32px radius, placeholder `处理任何事务`, borderless model trigger, microphone, and circular send control.

### Required fidelity surfaces

- Fonts and typography: system UI/PingFang sidebar stack; 20/600 brand, 15/400 primary navigation, 14/400 project/history, 28/400 greeting, and 15px conversation text.
- Spacing and layout rhythm: normalized 260px sidebar, 832px outer tracks, 768px visible reading/input widths, and reference-aligned empty-state vertical grouping.
- Colors and tokens: `#F9F9F9` sidebar, white canvas/composer, neutral `#ECECEC` selection, subtle hairline border, and low-opacity shadow.
- Image quality and asset fidelity: no raster or generated imagery is required by either target; UI icons remain vector icons from the existing Lucide set.
- Copy and content: `PiWork` remains the text brand; the empty header no longer contains `聊天 / 工作`; conversation input copy is `处理任何事务`.

### Interaction and runtime checks

- Empty input remains focused and submit remains disabled until content exists.
- Existing history loads, active history highlighting is singular, and the compact conversation composer renders after navigation.
- Browser console warnings/errors: none in the final conversation pass.

### Follow-up polish

No P3 item is required for the requested desktop scope.

final result: passed

## PiWork ChatGPT-style conversation redesign QA (2026-09-18)

- Source visual truth:
  - `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-67b6aa49-b456-4818-8277-6274b0df4bd2.png`
  - `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-2c4d0f3c-1e64-4ae9-ae90-1d9d7801929d.png`
  - `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-03fd5473-55e8-4ed4-b097-9a3db8017394.png`
- Source pixels: all three references are `3360 × 1924`, desktop light-theme ChatGPT Web views.
- Implementation: `http://localhost:3000/` and `/chat/81275fc9-461a-49e1-b0ef-1ea3edaad272`.
- Implementation captures: Chrome browser-session captures at the default `1405 × 727` CSS viewport plus a temporary `1024 × 768` desktop-width check. Captures were emitted inline by the browser QA session and not persisted as local files.
- Density normalization: proportional rather than pixel-identical because the implementation viewport was smaller than the supplied references; sidebar width, content max-width, and composer widths were compared relative to the available main canvas.

### Full-view comparison evidence

The empty-chat render matches the reference hierarchy: 260 px light-gray sidebar, text-only PiWork brand, centered chat/work switch, single-line greeting, large white composer, and a recessed context bar below it. The conversation render matches the third reference's document layout: breadcrumb header, right-side utilities, constrained reading column, subtle user surface, and a sticky one-line composer with a centered disclaimer.

### Focused state evidence

- Empty input and filled input were both captured. Entering `请帮我整理本周项目进展` changed only the text and send-button state; the composer surface, border, dimensions, and context bar remained unchanged.
- Existing conversation history was opened from the sidebar. The active row switched from “新对话” to the selected history item, the breadcrumb title was derived from the first user message, and the bottom composer changed to the compact conversation variant.
- At `1024 × 768`, the message column, header tools, disclaimer, and bottom composer stayed within the viewport with no horizontal overflow or clipped controls.

### Required fidelity surfaces

- Typography and spacing: quiet 14–15 px navigation, 13 px group labels, 28 px empty-state heading, and 15 px conversation copy reproduce the reference hierarchy without decorative branding.
- Sidebar: transparent default rows, one neutral selected row, no history-file icons, no group divider lines, and consistent 44/36 px navigation and history rhythms.
- Composer: 124 px empty-state card with 26 px radius; 64 px conversation pill with 32 px radius; borderless model trigger; 40 px voice/send/stop controls.
- Conversation chrome: left breadcrumb with project context, right share/more/settings actions, assistant content without a chat bubble, and a low-emphasis accuracy disclaimer above the sticky composer.
- Accessibility: icon-only controls expose names, the composer remains keyboard-operable, and disabled/enabled send state was verified through the browser accessibility tree.

### Findings

No actionable P0, P1, or P2 visual differences remain for the requested desktop Web scope. The implementation intentionally preserves PiWork's existing navigation labels and message/tool behavior while adopting the reference layout and visual rhythm.

### Validation

- `pnpm exec biome check --write` on all changed chat and design-system files: passed.
- `pnpm exec tsc --noEmit`: passed.
- `git diff --check`: passed.
- Browser console errors and warnings: none during empty-state and conversation-state inspection.

final result: passed

## Geist restyle QA (2026-09-18)

Scope: full-system restyle to the Vercel Geist specification — token rewrite in `app/globals.css`, UI primitives, chat surface, management console, auth pages, icon normalization, and this DESIGN.md rewrite.

- Light theme: canvas `#fafafa`, hairline `#ebebeb`, ink `#171717`; `--primary` maps to ink so every primary button/selected state/brand mark turned neutral automatically. No warm-cream or Cursor-orange hex remains (grep-verified).
- Dark theme: Vercel official black — `#000` canvas, `#0a0a0a` panels, `#262626`/`#333` hairlines, `#ededed` ink, white primary buttons. The composer's dark `!important` block was deleted; tokens now produce the same result natively.
- Radius system: `--radius` 0.75→0.5rem; controls re-classified to `rounded-md` (6px), content cards stay `rounded-xl` (12px). Command palette `rounded-4xl`, tooltip `rounded-2xl`, and alert-dialog outliers normalized. The `hsl(var(--sidebar-border))` legacy bug in `sidebar.tsx` was fixed.
- Icons: global `svg.lucide { stroke-width: 1.5 }` plus zero `strokeWidth` props in app code; sizes snapped to the 12/14/16/20 scale (no 17/18/19px remain). Dual-track rule enforced — `multimodal-input.tsx` switched to the hand-drawn `ArrowUpIcon`/`ChevronDownIcon` so all seven collision names have a single source inside `components/chat/**`.
- Management console: charts rebuilt on `lib/chart-theme.ts` (`useMemo` keyed on `resolvedTheme`) — first-class dark mode for dashboard ECharts; warm hex palette, emerald/blue/red status colors replaced with link/warning/destructive semantics.
- Mesh gradient exists only on the new-chat greeting (`mesh-bloom`, dimmed to 42% in dark). Buttons: 6px ink app-wide; the black pill CTA appears solely on login/register (`variant="pill"`).
- Protected items re-verified intact: message bubble structure (`rounded-xl rounded-br-md bg-secondary`), sidebar nav copy (新对话 / 我的项目 …), Chinese UI copy, next-themes class strategy, no new dependencies.
- `pnpm exec tsc --noEmit` and `pnpm check` (ultracite) both clean after every phase.

final result: passed

## Geist restyle regression fixes (2026-09-18, round 2)

User-reported regressions after the Geist restyle:

- Logo: the restyle had replaced the original image mark (`/piwork-mark.png`, `rounded-[22%]`) with a π glyph tile. Restored the HEAD-committed `BrandMark` (next/image, opaque blue brand mark). Geist adaptation: size stays `size-10` in the sidebar lockup (40px, aligned with `h-10` nav rows) and `size-16` on the greeting; the legacy blue glow shadow (`rgba(47,119,255)`) stays removed — no glow per Geist elevation rules; the mark's own blue is the one brand-color exception and reads correctly on both light and Vercel-black sidebars.
- Composer focus border: focusing the input drew a blue border (+ ring) around the composer card — reported as unreasonable. Root cause was stacked treatments: `input-group.tsx`'s `has-[…focus-visible]:border-link ring-2 ring-link/20` plus a redundant `[&>div]:focus-within:!…` override chain on `PromptInput`. Fixes: the override chain and the dead `piwork-composer` hook were deleted from `multimodal-input.tsx`; the focus trio was removed from `input-group.tsx` (containers never self-ring; standalone `Input`/`Textarea` primitives keep the standard `border-link` + `ring-link/20` focus pair); the unused `--shadow-composer-focus` token was removed from both theme blocks in `app/globals.css`. The composer now keeps its resting `--hairline-strong` border in every state; the caret is the focus indicator. DESIGN.md §5/§7 updated to record the rule.

final result: passed

## PiWork empty composer detail QA (2026-09-18, round 4)

- Source visual truth: `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-04020a60-6c6d-4c7a-a9a6-c8c0300a6d3d.png`.
- Source pixels: `1876 × 648`; focused light-theme empty-composer crop.
- Implementation URL: `http://localhost:3000/`.
- Implementation screenshot path: in-app Browser inline capture; the browser backend did not expose a persistent filesystem path.
- Implementation viewport: default in-app Browser viewport `1405 × 727`, device scale 1.
- Normalization: the source composer measures approximately `1538 × 258` source pixels and was treated as a 2× reference, producing a logical target of approximately `769 × 129px`.
- State: empty chat, light theme, composer focused, submit disabled.

### Findings and comparison history

- Iteration 1 — P2: the lower tray contained only project and approval actions, so its information architecture did not match the reference. Rebuilt it as `项目 / 文件 / 插件` on the left and `打开桌面应用` on the right; file selection uses the existing multi-file input.
- Iteration 1 — P2: tray content started too far from its inset edge and the icons were oversized. Reduced nested horizontal padding to a 14px effective leading inset and normalized tray icons to 18px with 14px labels.
- Iteration 1 — P2: the white composer was 4–5px shorter than the normalized reference. Increased the empty-state minimum height from 124px to 128px while retaining the measured 28px corner radius.
- Post-fix evidence: final browser measurements are `768 × 128px` for the white composer and `728 × 48px` for the lower tray, with exact 20px side insets.

### Full-view and focused-region evidence

The final full empty state preserves the existing centered question and sidebar while matching the reference component proportions. The focused composer region now has four complete rounded white corners, a restrained floating shadow, a light-gray tray visually tucked behind the lower edge, and the reference's left/right control distribution.

### Required fidelity surfaces

- Fonts and typography: 16px composer placeholder; 14px tray labels; normal weight throughout.
- Spacing and layout rhythm: 768px visible composer, 128px height, 28px radius; tray inset 20px per side, 48px height, and 16px bottom radius.
- Colors and tokens: white composer, `#F7F7F7` tray, neutral tertiary text, pale-blue disabled send button, and low-opacity shadow.
- Image quality and asset fidelity: the target contains no raster assets; standard controls use the existing Lucide vector icon library. Third-party plugin avatars shown in the reference were not available product assets, so the existing plugin affordance uses the product's vector puzzle icon rather than a fabricated raster mark.
- Copy and content: placeholder `处理任何事务`; tray labels `项目`, `文件`, `插件`, and `打开桌面应用`.

### Interaction and runtime checks

- The file button successfully emits a multi-file chooser event.
- Project, plugin, and desktop actions retain visible product feedback.
- Browser console warnings/errors: none.
- `pnpm check`, `pnpm exec tsc --noEmit`, and `git diff --check`: passed.

### Follow-up polish

No actionable P3 item remains for this focused component scope.

final result: passed

## PiWork sidebar and composer refinement QA (2026-09-18, round 5)

- Source: user review of the live empty state with an annotated screenshot; spec library `docs/design-system/openai-unified-interface/`.
- Implementation URL: `http://localhost:3000/`.
- Implementation screenshot path: `/tmp/piwork-empty-state.png`; viewport `1440 × 900`, device scale 2.

### Changes

- Sidebar text unification: project rows (`我的项目` and siblings) previously used `text-sidebar-foreground` (secondary gray) while recent rows used `text-sidebar-accent-foreground`; both lists now share `14px / 20px / 400` in `text-primary`, distinguished only by icons.
- Sidebar density: primary nav rows 44px → 40px, group separation 20px → 16px (plus removed 4px `pt-1`), group label rows 28px → 24px with 2px list gap, brand-area bottom padding 16px → 8px.
- Composer shadows removed in every state (empty, conversation, focus-within); the card keeps only its 1px hairline border, and the dark-theme `--shadow-composer` token is now `none`.
- Context tray: removed the `打开桌面应用` entry and its handler; the tray now carries only `项目 / 文件 / 插件` on the left, still tucked below the composer.

### Spec library sync

- `design-spec.md` §11.1/§11.2 updated (nav row height, group spacing, unified list text, no composer shadow, tray without desktop entry); version bumped to 1.1.
- `tokens.css` gained `--shadow-composer: none`; `tokens.json` gained a `shadow` group including `composer: none`.

### Interaction and runtime checks

- `pnpm check`: passed.
- Live screenshot confirms: border-only composer, tray without desktop entry, unified sidebar text color, tightened vertical rhythm.
- Browser console warnings/errors: none.

final result: passed

## PiWork composer shadow and tray placement QA (2026-09-18, round 6)

- Source: user review of the round-5 state with an annotated screenshot.
- Implementation URL: `http://localhost:3000/`.
- Implementation screenshot path: `/tmp/piwork-empty-state.png`; viewport `1440 × 900`, device scale 2.

### Changes

- Composer shadow restored at a ChatGPT-referenced, restrained level: `0 1px 2px rgb(0 0 0 / 4%), 0 8px 24px rgb(0 0 0 / 5%)` in every state (empty, conversation, focus); focus still only deepens the border. `--shadow-composer` token updated in both chat theme scopes.
- Context tray rebuilt as a standalone block strictly below the composer: removed the `-mt-4` tuck and `relative z-0` stacking trick; now `h-11` (44px), fully rounded (`rounded-xl` 12px), 12px gap from the composer, same 20px side insets and `#F7F7F7` surface. It no longer overlaps the composer edge or its shadow.

### Spec library sync

- `design-spec.md` §11.2 updated (composer shadow values, standalone tray dimensions and placement rule); version bumped to 1.2.
- `tokens.css` / `tokens.json`: `composer` shadow token set to the two-tier subtle value.

### Interaction and runtime checks

- `pnpm check`: passed.
- Live screenshot confirms: subtle two-tier shadow on the composer, fully rounded gray tray clearly separated below the input box.
- Browser console warnings/errors: none.

final result: passed

## PiWork tray layering QA (2026-09-18, round 7)

- Source: user review of the round-6 state with a ChatGPT reference crop; feedback clarified the tray must sit underneath the composer in stacking order, not as a separate bar moved down.
- Implementation URL: `http://localhost:3000/`.
- Implementation screenshot path: `/tmp/piwork-empty-state.png`; viewport `1440 × 900`, device scale 2.

### Changes

- Restored the tucked geometry: tray `h-12` (48px) with `-mt-4` over the `gap-3` baseline (net 4px behind the card), `rounded-b-2xl`, `items-end` — ~44px visible.
- Fixed the stacking so the white card genuinely overlays the tray: the composer form now carries `relative z-10` while the tray stays `relative z-0`; previously the positioned tray painted above the non-positioned form, covering the card's bottom border.
- The card's border and subtle float shadow now render on top of the gray tray, matching the ChatGPT reference (shadow falls on the tray surface).

### Spec library sync

- `design-spec.md` §11.2 updated with the layered placement rule (tray underneath in z-order, ~4px tuck, ~44px exposed); version bumped to 1.3.

### Interaction and runtime checks

- `pnpm check`: passed.
- Live screenshot confirms: card edge and shadow over the tray, no gap, tray tucked behind the composer.
- Browser console warnings/errors: none.

final result: passed

## PiWork sidebar collapse behavior QA (2026-09-18, round 8)

- Source: user review; the collapse toggle must reveal the Logo in collapsed state and show a hover tooltip.
- Implementation URL: `http://localhost:3000/`.
- Implementation screenshot paths: `/tmp/piwork-expanded-tip.png`, `/tmp/piwork-collapsed.png`, `/tmp/piwork-collapsed-tip.png`; viewport `1440 × 900`, device scale 2.

### Changes

- Collapsed rail (48px): the brand area now shows the `BrandMark` logo (`piwork-mark.png`, `size-7`, rounded 22%) centered at the top, linking home; header padding drops to `px-2` in icon mode so the mark and buttons fit the rail.
- The collapse toggle stays visible in both states; in icon mode it becomes a `32px` button under the logo with the `PanelLeftOpen` glyph (expanded keeps `PanelLeftClose`, `36px`).
- Hover tooltip added to the toggle via the shared Tooltip primitive, placed on the right with state-aware copy: 「展开侧边栏」 collapsed / 「收起侧边栏」 expanded; `aria-label` matches the visible copy.

### Spec library sync

- `design-spec.md` §11.1 amended: expanded brand text-only vs collapsed logo mark, toggle visibility/glyph/tooltip rules; version bumped to 1.4.

### Interaction and runtime checks

- Toggle click collapses/expands with animation; tooltips render on hover in both states (verified in screenshots).
- Composer tray unaffected in both states (checked in collapsed screenshot).
- `pnpm check`: passed.
- Browser console warnings/errors: none.

final result: passed

## PiWork collapsed brand trigger QA (2026-09-19, round 9)

- Source: `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-71cf35e5-631d-49c4-b176-bbff6c3e812d.png` (`702 × 842`).
- Implementation URL: `http://localhost:3000/`; verified in the Codex in-app browser.

### Changes

- Replaced the collapsed header's previous two-control stack (Logo link plus a separate open button) with one centered `40 × 40px` brand trigger in the `48px` icon rail.
- The trigger shows the `28px` PiWork mark at rest. Hover or keyboard focus fades the mark out and fades a `20px PanelLeftOpen` icon into the same position, avoiding layout movement.
- Added the exact right-side tooltip copy `打开侧边栏`; the expanded control uses `收起侧边栏`. Both controls share the existing Sidebar state and preserve the current collapse animation.
- Kept `aria-label` synchronized with the visible tooltip copy and exposed the same reveal behavior through `focus-visible` for keyboard users.

### Spec library sync

- `design-spec.md` §11.1 now defines the single-trigger collapsed brand pattern, icon morph, tooltip copy, and expanded-state control; version bumped to 1.5.
- `tokens.css` and `tokens.json` now expose the shared `48px` collapsed-sidebar width token.

### Interaction and runtime checks

- Expanded → collapsed → expanded interaction passed in the in-app browser; collapsed rest state visibly shows the PiWork mark.
- Focus-visible state visibly swaps to the panel-open icon and renders the `打开侧边栏` tooltip; this is the keyboard equivalent of the hover state.
- Browser console warnings/errors: none.
- `pnpm exec tsc --noEmit`, targeted Biome formatting, and `git diff --check`: passed.

final result: passed
