# Design QA — General Settings

**Source visual truth**

- `/Users/robotbird/.codex/attachments/1db96816-26e9-4312-8c2e-d3b5c1b911f8/image-1.png`
- Source pixels: 2498 × 1224, desktop light theme, Simplified Chinese, system appearance selected.

**Implementation evidence**

- `artifacts/settings-qa/settings-zh-light-final.png`
- `artifacts/settings-qa/settings-zh-system-final.png`
- `artifacts/settings-qa/settings-en-dark.png`
- `artifacts/settings-qa/chat-en-dark.png`
- `artifacts/settings-qa/management-overview-en-dark.png`
- `artifacts/settings-qa/login-zh-light.png`
- Browser viewport: 1680 × 906 CSS px at device scale factor 1.
- Implementation capture pixels: 1680 × 906.
- Normalization: source and light implementation were center-cropped/resampled to 1680 × 824 and placed together in `artifacts/settings-qa/settings-comparison-final.jpg`.
- State used for the primary visual comparison: desktop, light theme, Chinese. The separate system screenshot verifies the selected system state; the host operating system currently resolves system appearance to dark.

## Full-view comparison evidence

The final side-by-side comparison confirms the reference hierarchy and composition: fixed left navigation, a system-settings navigation group, a restrained page header, two full-width outlined settings cards, right-aligned controls, neutral surfaces, and blue selected-state emphasis. The implementation keeps the existing product's 272 px sidebar while matching the reference's content rhythm and near-edge card width.

## Focused-region comparison evidence

A separate crop was not needed: at the normalized 1680 × 824 comparison size, the page title, section headings, card labels, descriptions, language selector, and all three appearance options remain legible. The selected-state behavior was also checked directly in browser screenshots for light, dark, and system.

## Required fidelity surfaces

- Fonts and typography: Geist with the existing PingFang SC / Microsoft YaHei fallbacks preserves the product system and closely matches the reference hierarchy. Weights, line heights, and tracking are consistent; no clipping or unexpected wrapping was observed.
- Spacing and layout rhythm: section gaps, card padding, card radius, border treatment, and right-aligned controls match the reference. The main content was widened after the first comparison to remove excessive side whitespace.
- Colors and visual tokens: existing light/dark tokens are used throughout. The selected appearance option now uses the product's blue link tokens, matching the reference emphasis and remaining legible in dark mode.
- Image quality and asset fidelity: the target contains no raster artwork. Icons come from the project's existing Lucide set; no placeholder or custom-drawn assets were introduced.
- Copy and content: Chinese labels match the requested terminology. English labels fit without truncation. `中文` and `English` are both available in the language selector.

## Comparison history

1. Initial comparison found two P2 differences: the content column was too narrow/centered, and appearance selection used a gray treatment with Light as the default.
2. Fixes: widened the settings content to the reference's near-edge layout; changed the selected state to blue; changed the application default appearance to System.
3. Post-fix evidence: `settings-comparison-final.jpg` shows the corrected width/rhythm, while `settings-zh-system-final.png` shows System selected with blue emphasis. No actionable P0/P1/P2 differences remain.

## Interaction and cross-page verification

- Language selection updates immediately and persists through navigation/reload.
- Appearance buttons switch Light, Dark, and System immediately and persist through navigation/reload.
- English + dark mode was verified on the settings page, conversation home, and management overview.
- The unauthenticated login page was verified at `127.0.0.1:3000/login`; all login and preview copy renders in Chinese and is wired to the same language context.
- Navigation, select, appearance buttons, reload persistence, and cross-route updates were exercised in Chrome.
- After correcting a theme-dependent chart hydration mismatch and reloading, the browser showed no application issue overlay.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

- P3: The existing product sidebar is slightly narrower than the reference image's proportional sidebar. It is intentionally preserved to stay consistent with the rest of the management system.

final result: passed

---

# Design QA — 定时任务输入框与任务清单

**Source visual truth**

- `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-21baa75b-c7c2-4614-b74b-1a38fe876231.png`
- `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-ce215606-e47d-4e34-bd02-9f426ac54a36.png`
- Source role: visual reference for task composer, list hover state, and row action menu. Text and sample task content were treated as illustrative material.

**Implementation evidence**

- `http://localhost:3000/scheduled-tasks`
- Browser-rendered empty/recommendation state inspected in the in-app browser.
- Component implementation reviewed for populated task rows, hover-revealed edit/more controls, and the opened action menu state.
- Local account did not contain existing scheduled tasks, and manual create did not complete in this browser session, so the populated row state was verified from component behavior and type-checked code rather than persisted sample data.

## Required fidelity surfaces

- Fonts and typography: the page title uses `text-heading-lg`, subtitle and composer input use `text-body-lg`, task titles use 16/24 medium text, and metadata/menu labels stay at 14/20 or smaller. No new hand-rolled pixel font sizes were added.
- Spacing and layout rhythm: content is constrained to 920 px, the composer uses a 64 px minimum height, row touch/action targets are 40 px, and hover actions remain absolutely positioned to avoid layout shift.
- Radius and shadows: composer uses `rounded-xl` with `--shadow-float`; task rows and menu trigger buttons use `rounded-md`; menu items use `rounded-sm`; icon-only composer buttons remain circular.
- Colors and visual tokens: neutral semantic tokens drive surfaces, text, borders, hover states, destructive action, and link states. Blue is not used for ordinary emphasis.
- Interaction: plus opens manual create, typing and submit routes to AI task creation, mic shows an explicit pending-feature toast, row hover/focus reveals edit and `...`, and the `...` menu exposes run, share, pause/resume, and delete actions.
- Accessibility: icon-only buttons have accessible names; primary composer icon buttons use project Tooltip primitives; destructive delete remains behind the existing confirmation dialog.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

- P3: when local seed data or a stable test account is available, capture a persisted populated-row screenshot with the menu open for visual regression evidence.

final result: passed

---

# Design QA — 我的文档列表视觉优化

**Source visual truth**

- `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-ac6558e2-eec8-41a1-9990-26253f63d1ac.png`
- Source pixels: 1675 × 945，桌面浅色主题，网格视图和“新建”菜单展开状态。

**Implementation evidence**

- `http://localhost:3000/documents`
- In-app Browser viewport/capture: 1268 × 712 CSS px，device scale factor 1。
- Browser-rendered states inspected: populated grid, populated list, final empty state, light theme。
- The populated states used 3 temporary folders and 9 representative files. All temporary code and 13 database records were removed after capture.

## Full-view comparison evidence

The populated grid capture follows the source composition: title and subtitle at the upper left, compact view/search/create controls at the upper right, pill filters, a restrained folder row, and a dense recent-file grid. Card width adapts to the smaller review viewport, so the implementation shows four columns where the 1675 px source shows five. This is the expected responsive result rather than a fidelity defect.

The list capture was reviewed separately. It uses the same content hierarchy with aligned name, size, update time, source, and action columns. Switching views does not change the surrounding page rhythm.

## Focused-region comparison evidence

The toolbar, folder cards, file preview cards, metadata rows, and AI badges were readable in the full browser capture, so a separate crop was unnecessary. The open create menu was not reworked because the request explicitly limited this pass to the document-list presentation and existing functionality.

## Required fidelity surfaces

- Fonts and typography: the existing Geist and Chinese fallback stack is preserved. The 30 px page title, 18 px section headings, 14 px controls, 13 px filenames, and 11 px metadata reproduce the source hierarchy without clipping.
- Spacing and layout rhythm: page padding, 30 px filter offset, 36 px section rhythm, 18–20 px grid gutters, 15 px card radius, and 1 px hairlines match the source's airy density. Cards lift by only 2 px on hover.
- Colors and visual tokens: page, card, border, text, muted, link, and focus colors all come from the existing Piwork semantic tokens. File-type color remains limited to small icons and quiet preview surfaces.
- Image quality and asset fidelity: actual uploaded images still render with `object-cover`. Non-image files use existing Lucide file-type icons at consistent optical size; no raster placeholders or new decorative assets were introduced.
- Copy and content: all existing labels and actions are preserved. The reference's sample files and additional creation options were treated only as visual material and were not added to product behavior.

## Comparison history

1. Initial implementation used oversized cards, inconsistent document mock covers, heavier borders/shadows, and a sparse list layout. These were P2 visual-density mismatches.
2. The page was revised with responsive auto-fill grids, a unified preview frame, quieter hairlines/shadows, compact file metadata, polished folder cards, and a real tabular list mode.
3. Post-fix browser captures showed the target hierarchy and density at 1268 × 712. The final empty state and browser console were checked after temporary data cleanup; no page errors or warnings remained.

## Findings

No actionable P0, P1, or P2 findings remain.

## Follow-up polish

- P3: Office/PDF thumbnail generation would make non-image previews richer, but it would add backend functionality and is intentionally outside this visual-only request.

final result: passed

---

# Design QA — Model Provider Plugin Installation

**Source visual truth**

- `/var/folders/9b/8y0kwpzj4h1_wzryl7kzmbfm0000gn/T/codex-clipboard-a855fa51-6701-4b15-876d-06364356754f.png`
- Source pixels: 2380 × 1626, desktop light theme, installed provider requiring an API key, expanded plugin model list.

**Implementation evidence**

- `model-provider-installed-unconfigured-final.png`
- `model-provider-api-key-dialog-crop.png`
- `design-qa-comparison-final.png`
- Browser viewport: 1087 × 964 CSS px at device scale factor 2.
- Implementation browser crop: 2176 × 2100 physical pixels, including in-app browser chrome.
- Normalization: source and implementation were scaled proportionally into equal-width columns in the browser-rendered comparison page. The review compared information hierarchy and interaction state rather than asserting pixel identity across different product shells and viewport sizes.
- State: DeepSeek plugin installed, API Key not configured, four plugin-defined models visible, all model switches disabled.

## Full-view comparison evidence

The final side-by-side comparison confirms the requested structure: installed supplier identity and version, an explicit “需要配置 API Key” status, a prominent “添加 API Key” action, an expanded plugin-provided model directory, capability/context tags, and disabled model switches until credentials are validated. Piwork's existing sidebar, typography, spacing tokens, and restrained card treatment were intentionally preserved.

## Focused-region comparison evidence

The API Key dialog was inspected separately at `model-provider-api-key-dialog-crop.png`. It contains only the plugin-declared API Key field; there is no Base URL field. The dialog explains that the endpoint is supplied by the plugin, disables model controls until credential validation succeeds, and keeps the save action disabled while the required key is empty.

## Required fidelity surfaces

- Fonts and typography: the existing Geist/CJK fallback stack is preserved. Provider status, action, model names, context values, and capability tags remain readable without clipping.
- Spacing and layout rhythm: provider identity, credential status, action area, and model directory follow the reference hierarchy. The header intentionally stacks below the `xl` breakpoint to prevent action controls from compressing status copy.
- Colors and visual tokens: neutral borders/surfaces use the existing Piwork tokens; the primary action uses the product foreground treatment and disabled switches remain visibly unavailable.
- Image quality and asset fidelity: DeepSeek uses the real SVG shipped in `plugins/piwork-llm-deepseek/assets/icon.svg`, copied to the public model-provider asset path. No placeholder glyph or handcrafted logo remains.
- Copy and content: installation explicitly says credentials are configured afterward; the unconfigured state says “需要配置 API Key”; endpoint, model catalog, context sizes, and capability metadata are represented as plugin-owned information.

## Comparison history

1. Initial browser review found one P1 responsive issue: at the medium-width in-app browser viewport, status text was compressed into one character per line by the action column.
2. Fix: moved the three-column supplier header breakpoint from `md` to `xl`, using a stacked action row at narrower widths and right alignment only at `xl`.
3. The fidelity review also identified a P2 asset mismatch: the DeepSeek logo was represented by a “DS” text tile.
4. Fix: replaced the placeholder tile with the plugin's real DeepSeek SVG asset.
5. Post-fix browser evidence shows readable status copy, an intact API Key action, aligned model rows, real provider branding, and no browser console errors. No actionable P0, P1, or P2 findings remain.

## Interaction verification

- Installed the provider without entering credentials.
- Confirmed the installed state reports zero enabled models and requires an API Key.
- Confirmed all four plugin-defined model switches are disabled before credential configuration.
- Opened the “添加 API Key” dialog and confirmed Base URL is absent.
- Confirmed the required empty API Key keeps “验证并保存 API Key” disabled.
- Browser console errors checked after final reload: none.

## Follow-up polish

- P3: a future multi-provider catalog can load each provider icon through a generic plugin asset route instead of the current built-in public asset mapping.

final result: passed
