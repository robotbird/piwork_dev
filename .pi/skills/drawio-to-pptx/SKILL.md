---
name: drawio-to-pptx
description: 'Convert a draw.io (.drawio) diagram into a NATIVE, EDITABLE PowerPoint (.pptx) — every box becomes an editable autoshape/text box and every arrow becomes an editable connector with arrowheads, NOT a flat image. Use when the user wants a .drawio (architecture, flowchart, ERD, etc.) turned into PowerPoint they can edit, or says "make this drawio editable in PPT / 把drawio转成ppt / 转成原生ppt / 在ppt里修改". Pairs with the drawio-skill — generate the .drawio, then convert it to an editable deck.'
---

# Drawio → Native Editable PPTX

Convert `.drawio` files into a PowerPoint deck where **everything is a real, editable shape** — autoshapes, text boxes, and line connectors with arrowheads. The slide is not a picture; a user can move boxes, recolor them, edit text, and re-route arrows in PowerPoint / Keynote / WPS.

## Prerequisites

- Python 3 with `python-pptx` and `lxml`. Check / install:

```bash
python3 -c "import pptx, lxml" 2>/dev/null && echo OK || pip install python-pptx lxml
```

## Quick start

```bash
python3 <skill-dir>/scripts/drawio_to_pptx.py input.drawio -o output.pptx
```

That's the whole job for most diagrams. Defaults: 16:9 slide, fit-to-slide, 0.3" margin.

## Workflow

1. **Resolve deps** — run the check above; install if missing.
2. **Convert** — run the one-liner. Bump text size for dense diagrams: `--font-scale 1.2`.
3. **Verify** (optional) — reopen with python-pptx to confirm shapes are native, not images:

```bash
python3 -c "from pptx import Presentation; s=Presentation('output.pptx').slides[0]; print(len(list(s.shapes)),'shapes')"
```

A high shape count (one per drawio cell) means it converted correctly; a single `PICTURE` shape means something fell back to an image (should not happen with this script).

4. **Deliver** — report the `.pptx` path. Offer to open it: `open output.pptx` (macOS).

## Options

| Flag | Default | Purpose |
|---|---|---|
| `-o / --output` | required | output `.pptx` path |
| `--size` | `16:9` | slide preset: `16:9`, `4:3`, `16:10`, `A4-landscape` |
| `--landscape` | off | auto-pick `16:9` if diagram is wider than tall, else `4:3` |
| `--margin` | `0.3` | slide margin in inches |
| `--edge-style` | `auto` | connector routing: `auto` (honor drawio `orthogonalEdgeStyle` → elbow), `straight`, or `elbow` |
| `--font-scale` | `1.0` | extra multiplier on top of the drawio `fontSize` (use `1.1`–`1.3` for dense diagrams) |
| `--body-font` | `12` | fallback font pt for cells with **no** `fontSize` style (drawio's own default is 12) |
| `--title-font` | `12` | fallback font pt for swimlane/container titles with no `fontSize` style |
| `--min-font` / `--max-font` | `1` / `400` | clamp text pt — effectively off by default; pass explicitly to bound sizes |

**Font sizing**: the drawio source file is authoritative — a cell's `fontSize` style maps verbatim to the PPT run size. `--body-font`/`--title-font` only fill in for cells that set no `fontSize`, and the min/max clamps only apply when passed. Nothing adjusts source sizes by default.

## What maps to what (summary)

- Rectangle / `rounded=1` → Rectangle / Rounded-Rectangle autoshape
- `ellipse`, `rhombus`, `cylinder3`, `triangle`, `hexagon`, `cloud`, `parallelogram`, `trapezoid` → matching PPT autoshape
- `text`-only style → text box (no fill/line)
- Nested containers/swimlanes → absolute coordinates resolved, drawn as a box (children placed correctly on top). The swimlane/container **title is rendered as its own transparent text box in the `startSize` title strip** (top strip for horizontal, left strip for `horizontal=0`), so it is never covered by child shapes.
- Edges → connector (2 points) or open polyline (waypoints). By default (`--edge-style auto`) a 2-point edge becomes a **right-angle elbow connector** when the drawio style is `orthogonalEdgeStyle`, otherwise a straight line; force one or the other with `--edge-style elbow|straight`. Arrowheads come from `startArrow`/`endArrow`, color/width from `strokeColor`/`strokeWidth`, and the edge `value` is placed as a label box at the midpoint.
- `horizontal=0` → vertical text (`vert270`)
- Slide background set from the drawio `background` attribute when present

For the full style-key → PPT mapping table, edge-routing details, and how to extend the mappings, see [references/style-mapping.md](references/style-mapping.md).

## Limitations (be honest with the user)

- **Branded stencils** (`shape=mxgraph.aws4.*`, Cisco/Kubernetes icons, AI logos) render as a labeled rectangle — draw.io's stencil artwork cannot be reproduced as a native PPT shape. The label and color are preserved.
- **Gradients** (`gradientColor`) collapse to a solid fill using `fillColor`. **Shadows** (`shadow=1`) are dropped (PPT autoshapes can re-add a shadow manually).
- **Orthogonal routing** is preserved when edges carry waypoints (rendered as a polyline); edges with only source/target are drawn as a clean straight line clipped to the box edges — re-route in PPT if a different path is wanted.
- **Font**: Chinese/CJK labels render via PowerPoint's font fallback. Pass `--font-scale` up if text looks small on a dense slide.
- Multiple drawio `<diagram>` pages → multiple slides. Compressed `.drawio` files (base64+deflate payload) are decoded automatically.

## Files

- `scripts/drawio_to_pptx.py` — the converter (run it; no need to read unless patching/extending).
- `references/style-mapping.md` — detailed mapping table + extension guide.
