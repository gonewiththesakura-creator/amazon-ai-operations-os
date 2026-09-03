# Amazon AI Operations OS Design System

This concise authority summary is normalized to [`DESIGN.md`](../../../DESIGN.md). When the two differ, root `DESIGN.md` wins.

## Direction

`ZEN EXECUTIVE` (`m1-6-zen-executive-f46862fe`) is a warm, quiet, editorial operating office for an AI COO. The interface should feel refined and immediately actionable: one human judgment first, then typographic metrics, ranked actions, analysis, and evidence. Jarvis is a manager who has already done the work, not a robot mascot or technology spectacle.

M1.8 preserves this direction and adds deterministic visual analytics: one judgment, up to four stage-aware metrics with source-backed sparklines, up to three actions, and six fixed domains. Exactly one priority domain auto-expands; users may open two. Collapsed rows show two metrics. Expanded domains allow one primary chart, one secondary chart, one Jarvis insight, and one action. No source data means no chart.

Warm light is the default. Dark and system-dark preserve the same semantic hierarchy; they do not restore the retired graphite-and-mint identity.

## Core Tokens

| Role | Warm Light | Dark |
| --- | --- | --- |
| Canvas | `#f4f1ea` | `#1e201d` |
| Navigation | `#ece8df` | `#242621` |
| Surface | `#faf8f3` | `#292b26` |
| Elevated paper | `#fffdfc` | `#30322d` |
| Primary ink | `#292722` | `#eeece5` |
| Secondary ink | `#746f66` | `#b6b1a7` |
| Hairline | `#ded9d0` | `#3b3d37` |
| Moss | `#6f7868` | `#9ba493` |
| Strong moss | `#596353` | `#b5bdad` |
| Champagne bronze | `#a58b63` | `#c1a97f` |
| Clay risk | `#a86355` | `#c17c6e` |
| Slate information | `#6f7f86` | `#92a4aa` |
| Chart neutral | `#9a948a` | `#8f8b82` |
| Chart grid | `#ded9d0` | `#3b3d37` |

Use Noto Serif SC and its serif fallbacks only for the daily judgment, major statements, rank numerals, and exceptional values. Use Geist, Noto Sans SC, and system sans for all working UI. Keep zero letter spacing, an 11px minimum, and tabular numerals.

## Layout And Material

- Wide shell: 52px top bar, 224px navigation, fluid center, optional 300px inspector.
- Reading rail: 960px maximum; judgment 820px; reason 740px; composer 840px.
- Responsive: inspector overlays at 1199px, navigation at 900px, narrow layout at 640px, compact composer at 380px.
- Radius: 6px controls, 8px substantial controls, 10px menus/surfaces, 12px composer; no ordinary pills or 20px+ radii.
- Depth: content is flat and unframed. Shadows belong only to the composer, account menu, responsive rails, inspector overlays, and drawers.
- Structure: prefer spacing, alignment, typography, and one-pixel hairlines to cards.

## Component Rules

- The top metric summary is a typographic strip, never four KPI cards.
- Priorities are numbered rows separated by hairlines, with champagne used only for restrained rank/value emphasis.
- Moss owns action, selection, active navigation, and healthy movement; state still requires text.
- The inspector is warm paper with an underline tab state and contains raw references, limits, and deep evidence.
- The composer is elevated paper with a light command shadow and the only solid moss command.
- Use bare Lucide icons; colored icon tiles are exceptional.
- Use transparent native-SVG charts with semantic moss, bronze, slate, clay, and neutral roles; heavy charts mount only after domain expansion.
- Chart points are source-owned, keyboard accessible, and never interpolated or zero-filled by Jarvis.

## Rejections

Do not reintroduce dark enterprise SaaS, developer-tool styling, bright mint, neon, electric blue, purple AI gradients, pure-black canvases, glass, glow, decorative blur, particles, bento walls, KPI-card walls, nested cards, release labels, component schema names, or unavailable future destinations in the primary UI.

## Delivery Gates

- One operating judgment and the next actions are obvious before dense data.
- Evidence, confidence, limitations, synthetic provenance, and read-only boundaries remain written and accessible.
- Focus, keyboard, reduced-motion, non-color status, and stable control dimensions are preserved.
- Verify 1440px plus the 1199px, 900px, 640px, and 380px transitions with no horizontal overflow.
