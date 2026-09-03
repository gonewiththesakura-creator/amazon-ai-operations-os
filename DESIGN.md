---
name: Amazon AI Operations OS
description: "ZEN EXECUTIVE: a warm editorial operating office for decisive Amazon management."
colors:
  canvas: "#f4f1ea"
  nav: "#ece8df"
  surface: "#faf8f3"
  elevated: "#fffdfc"
  ink: "#292722"
  secondary: "#746f66"
  muted: "#9a948a"
  text-subtle: "#645f56"
  line: "#ded9d0"
  line-strong: "#c9c2b6"
  moss: "#6f7868"
  moss-strong: "#596353"
  moss-soft: "#e4e7df"
  luxury: "#a58b63"
  luxury-soft: "#eee6d8"
  risk: "#a86355"
  risk-soft: "#f1e3df"
  info: "#6f7f86"
  dark-canvas: "#1e201d"
  dark-nav: "#242621"
  dark-surface: "#292b26"
  dark-elevated: "#30322d"
  dark-ink: "#eeece5"
  dark-secondary: "#b6b1a7"
  dark-muted: "#8f8b82"
  dark-text-subtle: "#c8c3b9"
  dark-line: "#3b3d37"
  dark-line-strong: "#505249"
  dark-moss: "#9ba493"
  dark-moss-strong: "#b5bdad"
  dark-moss-soft: "#373d34"
  dark-luxury: "#c1a97f"
  dark-luxury-soft: "#463d30"
  dark-risk: "#c17c6e"
  dark-risk-soft: "#4b342f"
  dark-info: "#92a4aa"
  chart-moss: "#6f7868"
  chart-bronze: "#a58b63"
  chart-slate: "#6f7f86"
  chart-clay: "#a86355"
  chart-neutral: "#9a948a"
  chart-grid: "#ded9d0"
  dark-chart-moss: "#9ba493"
  dark-chart-bronze: "#c1a97f"
  dark-chart-slate: "#92a4aa"
  dark-chart-clay: "#c17c6e"
  dark-chart-neutral: "#8f8b82"
  dark-chart-grid: "#3b3d37"
typography:
  display:
    fontFamily: "Noto Serif SC, Source Han Serif SC, Songti SC, STSong, Georgia, serif"
    fontSize: "38px"
    fontWeight: 560
    lineHeight: 1.42
    letterSpacing: "0"
  headline:
    fontFamily: "Noto Serif SC, Source Han Serif SC, Songti SC, STSong, Georgia, serif"
    fontSize: "21px"
    fontWeight: 560
    letterSpacing: "0"
  title:
    fontFamily: "Noto Serif SC, Source Han Serif SC, Songti SC, STSong, Georgia, serif"
    fontSize: "17px"
    fontWeight: 560
    lineHeight: 1.45
    letterSpacing: "0"
  body:
    fontFamily: "Geist, Noto Sans SC, Microsoft YaHei, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0"
  label:
    fontFamily: "Geist, Noto Sans SC, Microsoft YaHei, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    letterSpacing: "0"
  metric:
    fontFamily: "Geist, Noto Sans SC, Microsoft YaHei, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: "25px"
    fontWeight: 540
    letterSpacing: "0"
rounded:
  none: "0"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "28px"
  4xl: "36px"
components:
  button-send:
    backgroundColor: "{colors.moss-strong}"
    textColor: "#fffdf8"
    rounded: "{rounded.md}"
    size: "36px"
  button-command:
    backgroundColor: "transparent"
    textColor: "{colors.moss-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    rounded: "{rounded.sm}"
    width: "34px"
    height: "34px"
  chip-prompt:
    backgroundColor: "transparent"
    textColor: "{colors.secondary}"
    rounded: "{rounded.sm}"
    padding: "7px 10px"
  nav-active:
    backgroundColor: "{colors.moss-soft}"
    textColor: "{colors.moss-strong}"
    rounded: "{rounded.sm}"
    padding: "9px 10px"
  composer:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "7px 8px 7px 15px"
    height: "52px"
    width: "840px"
  input-select:
    backgroundColor: "{colors.elevated}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "9px 10px"
  inspector:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    width: "300px"
  composition-block:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "28px 0 20px"
---

# Design System: Amazon AI Operations OS

## Overview

**Creative North Star: "ZEN EXECUTIVE"**

Direction contract `m1-6-zen-executive-f46862fe` makes the product feel like an AI COO's ordered office: warm, quiet, editorial, architectural, and immediately useful. Jarvis enters as a manager who has already formed a judgment, not as a robot identity, dashboard mascot, or technology spectacle.

Warm light is the default world. Paper-like planes, disciplined alignment, serif judgment statements, low-chroma moss interaction, and sparse champagne emphasis create tactile refinement without simulation or ornament. Dark and system themes preserve the same semantic hierarchy, but the identity remains light-first. Cyberpunk, dark AI SaaS, gaming HUDs, glass, bright mint, electric blue, purple gradients, pure-black canvases, bento walls, and KPI-card walls are explicit anti-references.

**Key Characteristics:**

- One editorial judgment leads; metrics, ranked actions, analysis, and evidence follow in a calm reading sequence.
- Warm paper surfaces and hairline rules organize the workspace before bounded containers do.
- Serif type carries judgment and important section statements; utility sans carries every control and working detail.
- Moss owns interaction and selection, champagne marks rare value, and risk remains muted and textual.
- Evidence stays near the decision but raw references move into the warm paper inspector.
- M1.8 keeps the first layer to one judgment, four metrics, three actions, and six progressively disclosed operating domains with deterministic visual evidence.

### M1.7 Information Architecture Contract

`HomeComposition` remains the backend contract. The frontend deterministically maps it into a `HomeViewModel`; the model never emits arbitrary HTML, JavaScript, CSS, or component identifiers. The executive layer shows the judgment, up to four stage-aware metrics, and up to three ranked actions. Analysis is grouped into `SALES_CONVERSION`, `ADVERTISING`, `PRODUCT_LISTING`, `INVENTORY_PROFIT`, `SEARCH_RANKING`, and `MARKET_OPPORTUNITY`.

M1.8 supersedes the earlier expansion rule: exactly one domain opens automatically, choosing the highest-priority critical domain, then attention, then Sales and Conversion. A user may keep at most two domains open. Collapsed rows show no more than two metrics. An expanded analytical domain contains at most one primary chart, one secondary chart, one Jarvis insight, and one action row. Raw provenance, attribution limitations, evidence chains, and machine-oriented payloads appear only in Inspector.

### M1.8 Visual Analytics Contract

Chart values come only from registered deterministic visualization sources. Jarvis may select a registered visualization type and emphasis, but cannot create, interpolate, reorder, or zero-fill points. Summary metrics may show a seven-day native SVG sparkline derived from an existing series. Expanded Sales and Advertising domains use a selectable 30-day primary line; a secondary bar, donut, or progress chart appears only when its source grain is valid. Donuts are reserved for part-to-whole data and contain at most five slices. Ranking lines invert the Y axis and show one keyword. No source data means no chart.

Charts use transparent canvases, paper hairlines, 11px minimum labels, tabular numbers, keyboard-focusable points, accessible summaries, and warm-paper tooltips. Heavy analytical components load only inside an expanded domain. The chart palette is semantic and low-chroma: moss, bronze, slate, clay, neutral, and grid, with their exact dark-mode counterparts defined in `styles/tokens.css`.

## Colors

The default palette is warm ivory and layered paper with near-black ink; dark mode is a low-chroma olive-charcoal translation of the same roles rather than a second visual identity.

Visualization roles are fixed: moss `#6f7868`, bronze `#a58b63`, slate `#6f7f86`, clay `#a86355`, neutral `#9a948a`, and grid `#ded9d0`; dark mode maps them to `#9ba493`, `#c1a97f`, `#92a4aa`, `#c17c6e`, `#8f8b82`, and `#3b3d37`.

### Primary

- **Quiet Moss** (`moss`, `moss-strong`, `moss-soft`): interaction, selection, active navigation, healthy movement, and the enabled send command. The soft form is a restrained selected-state wash.

### Secondary

- **Champagne Bronze** (`luxury`, `luxury-soft`): rare high-value opportunities, ranked emphasis, and important business signals. It never becomes a broad background, gradient, or metallic effect.
- **Clay Risk** (`risk`, `risk-soft`): negative deltas, critical alerts, and explicit boundaries. Always pair it with written meaning.

### Tertiary

- **Slate Information** (`info`): quiet informational and provenance cues where moss would imply action or selection.

### Neutral

- **Warm Ivory Canvas**, **Linen Navigation**, **Paper Surface**, and **Porcelain Elevated** (`canvas`, `nav`, `surface`, `elevated`) separate the shell, rails, reading field, inspector, menus, and composer through tone.
- **Primary Ink**, **Secondary Ink**, **Muted Ink**, and **Subtle Text** (`ink`, `secondary`, `muted`, `text-subtle`) establish a four-step reading hierarchy without pure black.
- **Paper Hairline** and **Strong Paper Rule** (`line`, `line-strong`) divide narrative regions and controls without card framing.
- Every light semantic token has an exact `dark-*` counterpart. Explicit dark mode and system-dark mode remap the variables together; warm light remains the default and system-light result.

**The One Accent Voice Rule.** Moss communicates action, selection, assistant presence, and healthy movement; it is never general decoration.

**The Rare Bronze Rule.** Champagne identifies rank or business value in small details only; never use a gold field, metallic treatment, or gradient.

**The Text Plus Tone Rule.** Risk, confidence, draft, synthetic, provisional, and read-only states always carry text; color never bears meaning alone.

## Typography

**Display Font:** Noto Serif SC with Source Han Serif SC, Songti SC, STSong, and Georgia fallbacks.

**Body Font:** Geist with Noto Sans SC, Microsoft YaHei, and system sans fallbacks.

**Character:** The serif/sans pairing is editorial plus utility. Serif makes one judgment feel considered and human; the sans stack keeps dense operating details fast to scan. All interface text uses zero letter spacing and all operating numbers use tabular numerals.

### Hierarchy

- **Display** (560, 38px, 1.42): the daily operating judgment only; it steps to 34px below the navigation breakpoint, 26px on narrow screens, and 24px below 380px.
- **Headline** (560, 21px): primary narrative sections; narrow screens use 18px.
- **Title** (560, 17px, 1.45): registered composition and inspector statements; major runtime titles may rise to 22px.
- **Body** (400, 14px, 1.7): the default interface and conversation text. The reason beneath the daily judgment rises to 15px/1.8 within a 740px measure; composition narrative uses a denser 13px/1.75.
- **Label** (650, 11px): metadata, evidence labels, state names, counts, and boundaries. Ordinary controls use 11-12px and never drop below 11px.
- **Metric** (540, 25px): the top typographic metric strip. Registered metric cells use 20px; high-value signals may use 28px serif. All use tabular numerals.

**The Serif Restraint Rule.** Use serif only for the daily judgment, primary section statements, rank numerals, and exceptional business values; buttons, navigation, metadata, and evidence remain sans.

**The No Microtype Rule.** Normal product content never uses 9px or 10px text; 11px is the implemented floor.

## Layout

The shell is a full-height work surface below a 52px top bar. Wide desktop uses a 224px navigation rail, a fluid center, and an optional 300px inspector. Every direct canvas section shares a centered maximum width of 960px with 28px minimum side insets. The hero judgment is capped at 820px, its reason at 740px, and the bottom command surface at 840px.

The desktop hero begins with 36px top padding, followed by the typographic metric strip, a 28px ranked-priority section, and unframed analysis blocks with 28px/20px vertical padding. Repeated working intervals use the extracted 4, 8, 12, 16, 20, 24, 28, and 36px rhythm. One-pixel rules, shared baselines, and whitespace do the work that cards usually do.

At 1199px and below, the inspector leaves the grid and becomes a 300px right overlay. At 900px and below, navigation becomes a left overlay, the reading measure becomes 720px with 20px side insets, and the judgment steps to 34px. At 640px and below, the top bar becomes 48px, the toolbar 44px, canvas insets become 14px, hero copy becomes 26px, metrics collapse to two columns, selected details simplify, and the main sections are explicitly reordered for scanability. At 380px and below, hero copy becomes 24px and the composer removes its shortcut column.

**The 960 Reading Rail Rule.** Judgment, metric strip, ranked action, conversation, and registered analysis share one centered rail; navigation and evidence remain supporting rails, never competing canvases.

**The Space Is Structure Rule.** Add hierarchy with measure, alignment, section padding, and hairlines before adding a bounded surface.

## Elevation & Depth

The system is quiet and flat at rest. Paper tones and hairline rules create most depth; narrative sections, metric strips, priority rows, and composition blocks have no shadow and no enclosing card.

### Shadow Vocabulary

- **Command paper** (`0 12px 36px rgba(61, 56, 47, 0.09), 0 2px 8px rgba(61, 56, 47, 0.04)`): the persistent composer in warm light only.
- **Command paper, dark** (`0 12px 38px rgba(0, 0, 0, 0.26)`): the semantic dark-mode composer shadow.
- **Paper overlay** (`0 22px 60px rgba(56, 51, 43, 0.16)`): account menu, responsive rails, inspector overlay, and workspace drawer in warm light.
- **Paper overlay, dark** (`0 22px 60px rgba(0, 0, 0, 0.42)`): the semantic dark-mode overlay shadow.
- **Context scrim** (`rgba(41, 39, 34, 0.18-0.22)`): separates responsive rails and drawers without blur.

**The Flat-by-Default Rule.** Normal content is unframed and shadowless; spacing, type, tone, and rules establish hierarchy.

**The Context-Crossing Rule.** Shadow is allowed only for the composer, account menu, responsive inspector/navigation, and drawers because those surfaces cross or persist above context.

## Shapes

The form language is gently softened but still architectural. Small controls use 6px corners, send and other substantial controls use 8px, menus and bounded surfaces use 10px, and the paper composer uses 12px. Drawers and docked rails remain square at the viewport edge. Avatars, progress dots, and tiny status geometry may be circular.

Borders are one pixel and semantic. Default controls use the normal hairline, more consequential boundaries use the strong hairline, and moss, champagne, or clay strokes appear only for state. No ordinary text button becomes a pill, and no surface uses a 20px-or-larger decorative radius.

**The Twelve-Pixel Ceiling Rule.** Standard surfaces stop at 12px; full rounding belongs only to avatars, dots, and genuinely circular status geometry.

## Motion

M1.8 motion is bounded and functional: numbers 250-350ms, sparklines 250-400ms, primary lines 300-500ms, domain reveal 180-220ms, and tooltip opacity 0-100ms. The in-app reduced-motion preference and OS setting remove all chart reveal and bar transitions without withholding data or interaction.

## Components

### Buttons

- **Shape:** icon controls use stable 34px squares with gently curved 6px corners; the send command is a stable 36px square with an 8px corner.
- **Primary:** the send command is the only solid moss action, using strong moss and warm-white icon ink. Disabled send falls back to the hairline and muted ink.
- **Secondary:** text commands remain transparent with a one-pixel moss or neutral border; prompt actions use compact 7px/10px padding.
- **Hover / Focus:** icon controls shift border, paper tone, and ink within 140ms; other commands use immediate border or ink changes. Global focus-visible uses a two-pixel moss outline with two-pixel offset.

### Chips

- **Style:** prompt chips are quiet outlined commands with 6px corners, transparent fill, secondary ink, and 7px/10px padding.
- **State:** hover strengthens the moss border and ink. Operational state is written in text rather than expressed as a field of badges.

### Cards / Containers

- **Corner Style:** ordinary narrative regions have no container or radius; the store-context record uses 8px and account menus use 10px.
- **Background:** bounded records use translucent paper or elevated paper, never a detached white card wall.
- **Shadow Strategy:** cards remain flat; only context-crossing overlays use the overlay token.
- **Border:** one-pixel paper rules define selected records and small bounded data surfaces.
- **Internal Padding:** compact records use 10-16px; unframed narrative blocks use 28px/20px vertical rhythm.

### Inputs / Fields

- **Style:** the composer is elevated paper with a strong hairline, 12px corners, a 52px minimum height, and a maximum 840px working width. Drawer selects use elevated paper, a normal hairline, 6px corners, and 9px/10px padding.
- **Focus:** inputs use the global two-pixel moss focus-visible outline; the composer remains visually stable as focus moves inside it.
- **Disabled:** unavailable input and send states use muted ink and hairline fill without hidden explanation.

### Navigation

- The 224px linen rail uses bare Lucide icons and 12px sans labels. Hover introduces paper tone; the active destination uses soft moss with strong moss text and 6px corners. Only current capabilities appear.
- At 900px and below, navigation becomes a left overlay with a scrim and explicit close command. The 52px top bar is reduced to brand, a weak demo label, and account access.

### Warm Paper Inspector

- The 300px inspector uses the main paper surface, a hairline left edge, and four equal 11px tabs. Active state is a two-pixel moss underline rather than a filled tab.
- It is docked on wide screens, overlays from the right at 1199px and below, and widens only up to 360px on narrow screens. Raw references and limitations live here rather than on the main canvas.

### Typographic Metric Strip

- Four equal desktop columns share one top/bottom rule and subtle vertical dividers. Labels are 11px, values are 25px tabular sans, and deltas use written context plus semantic color.
- At 640px the strip becomes a stable two-column grid. It never becomes four independent KPI cards.

### Ranked Priority List

- Each action is an unframed row with a champagne serif rank, a clear 14px title, a 12px reason, and a written state. A single hairline separates rows.
- The row retains its order and hierarchy on narrow screens while hiding low-priority state detail rather than shrinking type below the floor.

### Registered Composition Block

- Registered analysis renders as an unframed 28px/20px section with a serif 17px title, 13px/1.75 narrative, data lines, and explicit evidence entry points.
- Component schema names and raw tool output do not appear in the primary reading surface; evidence disclosure moves into the inspector.

## Do's and Don'ts

### Do:

- **Do** lead every home view with one human operating judgment, then show the minimum metrics and ranked actions needed to act.
- **Do** use the exact warm-light semantic roles by default and remap all roles together in explicit dark or system-dark mode.
- **Do** use shared alignment, generous measure, one-pixel rules, and whitespace before introducing a bounded surface.
- **Do** keep evidence, confidence, limitations, synthetic provenance, and read-only boundaries available in written language.
- **Do** use Lucide icons with accessible names, stable control dimensions, visible focus, and tabular operating numbers.
- **Do** verify the 1199px inspector overlay, 900px navigation overlay, 640px narrow layout, and 380px composer simplification without horizontal overflow.

### Don't:

- **Don't** reintroduce dark enterprise SaaS, developer-tool styling, bright mint, neon, glass, glow, gradients, decorative blur, particles, or pure-black canvases.
- **Don't** turn metrics, priorities, or analysis into a bento wall, KPI-card wall, nested cards, or floating page sections.
- **Don't** use champagne as a field, gradient, or metallic effect, and don't use color alone for operational meaning.
- **Don't** use serif for buttons or utility UI, shrink normal content below 11px, or add letter spacing.
- **Don't** round ordinary text controls into pills, exceed the 12px surface ceiling, or add shadows to normal content.
- **Don't** expose release labels, component schema names, raw tool output, or future unavailable destinations in the primary UI.
