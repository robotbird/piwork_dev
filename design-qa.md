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
