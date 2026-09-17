# Drawio Style → PPT Mapping (reference)

Detail reference for `scripts/drawio_to_pptx.py`. Read this only when extending a mapping, fixing a shape that rendered wrong, or diagnosing fidelity issues.

## How drawio style strings work

A cell `style` is a semicolon-separated list: `key=value;` pairs plus bare flags.

```
rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontColor=#ffffff;fontSize=12;fontStyle=1
```

The script parses these into a dict (`parse_style`). Bare flags like `ellipse;` become `{"ellipse": "1"}`.

## Vertex shape mapping

| drawio style signal | PPT autoshape (`MSO_SHAPE`) |
|---|---|
| `ellipse` (flag) | `OVAL` |
| `rhombus` (flag) | `DIAMOND` |
| `shape=cylinder` / `cylinder3` | `CAN` |
| `shape=triangle` | `ISOSCELES_TRIANGLE` |
| `shape=hexagon` | `HEXAGON` |
| `shape=cloud` | `CLOUD` |
| `shape=parallelogram` | `PARALLELOGRAM` |
| `shape=trapezoid` | `TRAPEZOID` |
| `shape=process` | `CHEVRON` |
| `shape=mxgraph.*` (any branded stencil) | `RECTANGLE` (artwork cannot be reproduced natively) |
| `text` (flag, no fill/line) | text box (`add_textbox`) |
| `swimlane` flag or `container=1` | `ROUNDED_RECTANGLE` (acts as backdrop) |
| `rounded=1` | `ROUNDED_RECTANGLE` |
| *(default)* | `RECTANGLE` |

Lookup is defensive: `_mso(name)` falls back to `RECTANGLE` if a member name differs across python-pptx versions.

## Fill / line / text mapping

| drawio key | PPT result |
|---|---|
| `fillColor=#hex` | solid fill, that color |
| `fillColor=none` | no fill (transparent) |
| *(no fillColor)* | solid white (drawio default for rectangles) |
| `gradientColor=#hex` | **ignored** — solid fill uses `fillColor` only |
| `strokeColor=#hex` | line color |
| `strokeColor=none` | no line |
| `strokeWidth=N` | line width N pt |
| `shadow=1` | **dropped** (PPT shape can re-shadow manually) |
| `fontColor=#hex` | run font color |
| `fontSize=N` | not used for sizing; text is sized by role — `--body-font` for content/edges, `--title-font` for swimlane/container titles (see Font sizing below) |
| `fontStyle` bitmask | `&1` bold, `&2` italic, `&4` underline |
| `fontFamily=X` | run font name (only when present; else PPT default — CJK falls back automatically) |
| `align=left\|center\|right` | paragraph alignment (default center) |
| `verticalAlign=top\|middle\|bottom` | text-frame vertical anchor (default middle) |
| `horizontal=0` | vertical text — sets `bodyPr vert="vert270"` |
| `html=1`, `whiteSpace=wrap` | always treated as on; multi-line via `&#xa;`/`<br>`/`</div>` |

Label HTML is flattened by `html_to_lines`: `<br>` and closing block tags become newlines, all remaining tags are stripped, then each line becomes a paragraph with one run.

## Edge (connector) mapping

| drawio key | PPT result |
|---|---|
| source + target ids, no waypoints | connector, endpoints clipped to each box boundary along the center-to-center line. Type chosen by `--edge-style`: `auto` → elbow (`MSO_CONNECTOR.ELBOW` = `bentConnector3`) when style is `orthogonalEdgeStyle`, else straight; `elbow` / `straight` force one |
| `edgeStyle=orthogonalEdgeStyle` | (under `auto`) rendered as a right-angle elbow connector instead of a diagonal straight line |
| source + target + `<Array as="points">` waypoints | open polyline through the waypoints (custom-geometry shape), arrowheads at both ends |
| `startArrow` / `endArrow` (`classic`, `open`, `block`, …) | `<a:headEnd>` / `<a:tailEnd type="triangle">` |
| `strokeColor` / `strokeWidth` | connector line color / width |
| `value` (edge label) | text box centered on the edge midpoint; `labelBackgroundColor` fills it |
| edge with no source/target | uses `<mxPoint as="sourcePoint">` / `as="targetPoint"` if present, else skipped |

A 2-point edge becomes a native, editable connector (`MSO_CONNECTOR.STRAIGHT` = `line`, or `MSO_CONNECTOR.ELBOW` = `bentConnector3`); 3+ point edges use a `custGeom` open path (editable freeform). Endpoints are always clipped to the box edge so arrows touch the shape, not its center.

## Coordinate model

- drawio units ≈ pixels. The script computes the bounding box of all vertices, then uniformly scales to fit the chosen slide size minus margins, centering the result.
- Text pt is **role-based**, not derived from the drawio `fontSize`. Content boxes and edge labels use `--body-font` (default 10 pt); swimlane/container titles use `--title-font` (default 12 pt). Both are multiplied by `--font-scale` and clamped to `[min-font, max-font]`. drawio `fontSize` is in points at the diagram's large native scale, so scaling it by the slide-fit factor (as geometry is) would crush labels to ~7pt — fixed, predictable sizes avoid that. Each text frame also gets PowerPoint shrink-to-fit (`normAutofit`) so long labels auto-shrink inside their box instead of overflowing.
- Nested containers: child geometry is relative to its parent. `resolve_geometry` walks the parent chain and sums offsets so children land at their true absolute position.

## Extending the mappings

To support a new shape or style key, edit `scripts/drawio_to_pptx.py`:

1. **New autoshape** — add an entry to the `mapping` dict in `shape_kind()` (`drawio shape name → MSO_SHAPE member name string`). Use the string form so `_mso()` tolerates version drift.
2. **New text effect** — extend `apply_text()` (e.g. parse `fontColor` per-run from inline `<font color>` by splitting the HTML instead of flattening).
3. **New edge behavior** — edit `compute_edge_points()` / `set_connector_arrows()`.
4. **New preset size** — add to `SIZE_PRESETS` in `(Emu width, Emu height)`.

After any change, re-run on a real `.drawio` and confirm the shape count and a sample label with the verify snippet in SKILL.md.
