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
