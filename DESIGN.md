---
name: Jarvis Daily Operations Workspace
description: "A calm, evidence-led operating instrument for daily Amazon decisions."
colors:
  surface-canvas: "#0d0f0e"
  surface-nav: "#111411"
  surface-raised: "#171b18"
  surface-quiet: "#1d221e"
  surface-overlay: "#202521"
  text-primary: "#f2f3ed"
  text-secondary: "#a8afa7"
  text-muted: "#767f77"
  line: "#2a302b"
  line-strong: "#3a423b"
  accent: "#68c9a7"
  accent-strong: "#8bdabb"
  accent-muted: "#193a30"
  opportunity: "#d7b56d"
  risk: "#e47d68"
  risk-muted: "#3d2520"
  info: "#81a9c6"
  system-light-surface-canvas: "#f3f4ef"
  system-light-surface-nav: "#e9ebe5"
  system-light-surface-raised: "#ffffff"
  system-light-surface-quiet: "#e4e7e1"
  system-light-surface-overlay: "#ffffff"
  system-light-text-primary: "#171a17"
  system-light-text-secondary: "#4e574f"
  system-light-text-muted: "#69736b"
  system-light-line: "#cfd4cd"
  system-light-line-strong: "#aeb7af"
  system-light-accent: "#147d5d"
  system-light-accent-strong: "#0f684d"
  system-light-accent-muted: "#d8ece4"
  system-light-opportunity: "#8a661f"
  system-light-risk: "#b64937"
  system-light-risk-muted: "#f3dcd6"
  system-light-info: "#416e8d"
typography:
  display:
    fontFamily: "Inter, Noto Sans SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 650
    lineHeight: 1.18
    letterSpacing: "0"
  headline:
    fontFamily: "Inter, Noto Sans SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 650
    letterSpacing: "0"
  title:
    fontFamily: "Inter, Noto Sans SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 620
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Inter, Noto Sans SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.7
    letterSpacing: "0"
  label:
    fontFamily: "Inter, Noto Sans SC, Microsoft YaHei, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "0"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "0"
rounded:
  none: "0"
  xs: "4px"
  sm: "5px"
  md: "6px"
  lg: "7px"
  xl: "8px"
  pill: "999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  7: "28px"
  8: "32px"
components:
  button-send:
    backgroundColor: "{colors.accent}"
    textColor: "#0a1712"
    rounded: "{rounded.md}"
    size: "36px"
  button-command:
    backgroundColor: "{colors.accent-muted}"
    textColor: "{colors.accent-strong}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "7px 11px"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    width: "34px"
    height: "34px"
  chip-prompt:
    backgroundColor: "transparent"
    textColor: "{colors.text-secondary}"
    rounded: "{rounded.md}"
    padding: "6px 9px"
    height: "33px"
  chip-status:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.xs}"
    padding: "3px 6px"
  nav-active:
    backgroundColor: "{colors.accent-muted}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "7px 8px"
    height: "37px"
  nav-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.text-muted}"
    rounded: "{rounded.md}"
    padding: "7px 8px"
    height: "37px"
  composer:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.xl}"
    padding: "8px 9px 8px 14px"
    height: "54px"
    width: "840px"
  card-evidence-metric:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "9px"
  input-select:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "7px 10px"
    height: "40px"
  composition-block:
    backgroundColor: "transparent"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.none}"
    padding: "24px 0 20px"
---

# Design System: Jarvis Daily Operations Workspace

## Overview

**Creative North Star: "Calm AI Operations Workspace"**

Direction contract `m1-5-calm-ops-v1` treats Jarvis as a focused operating instrument for an owner-operator reviewing evidence, not as a dashboard with a chat box. The visual world combines a conversational center with the density of an Amazon workbench and a restrained assistant presence. Judgment, ranked action, provenance, and explicit limits form one reading sequence.

The default scene is deep warm graphite for sustained desk use, with warm white copy and sparse mint signals. The system-light preference remaps the same semantic roles to warm off-white and forest tones only when the operating system is light. Both modes reject pure-black theatricality, saturated navy, neon command-center effects, blank-chat emptiness, and walls of KPI cards.

**Key Characteristics:**

- Judgment-first narrative hierarchy with deterministic evidence close at hand.
- Flat, rule-separated work surfaces with overlays reserved for context changes.
- Sparse Jarvis mint, review gold, risk coral, and evidence blue with written status labels.
- Persistent read-only and synthetic-data boundaries rather than decorative trust cues.
- Progressive disclosure through evidence details, the inspector, and settings/help drawers.

## Colors

The default palette is warm graphite with a low-chroma sage cast; the system-light palette preserves every semantic role instead of introducing a second identity.

### Primary

- **Jarvis Mint** (`accent`, `accent-strong`, `accent-muted`): identifies Jarvis presence, active navigation, focus, positive deltas, progress, and the enabled send command. The muted form carries selection and focus-fill states.

### Secondary

- **Review Gold** (`opportunity`): marks provisional states, draft review, limitations, and unsupported-but-safe content.
- **Risk Coral** (`risk`, `risk-muted`): marks negative deltas and explicit execution boundaries; the muted form is reserved for bounded warnings.
- **Evidence Blue** (`info`): identifies raw references and provenance-oriented machine text.

### Neutral

- **Warm Graphite Canvas** (`surface-canvas`) is the central workspace; **Navigation Graphite** (`surface-nav`) separates persistent rails; **Raised Graphite** (`surface-raised`) supports controls and small bounded records; **Quiet Graphite** (`surface-quiet`) carries selected or low-emphasis utility states; **Overlay Graphite** (`surface-overlay`) is reserved for menus and drawers.
- **Warm White**, **Soft Sage Gray**, and **Muted Sage Gray** (`text-primary`, `text-secondary`, `text-muted`) establish the reading hierarchy.
- **Hairline Sage** and **Strong Sage Rule** (`line`, `line-strong`) organize the workspace without card framing.
- Every default semantic token has an implemented `system-light-*` counterpart. It is activated only by `theme=system` under a light OS preference; the explicit dark preference remains graphite.

**The One Accent Voice Rule.** Mint communicates Jarvis, interaction, selection, and healthy movement; it is not a general decoration color.

**The Text Plus Tone Rule.** Synthetic, provisional, confidence, draft, risk, and read-only states always carry text. Color never bears meaning alone.

## Typography

**Display Font:** Inter with Noto Sans SC, Microsoft YaHei, and system sans fallbacks.

**Body Font:** The same bilingual workhorse stack, preserving a single operational voice.

**Label/Mono Font:** UI monospace with SFMono-Regular and Consolas fallbacks, reserved for references and compact machine statuses.

**Character:** The system uses measured weight and generous body leading rather than a decorative technology face. Chinese and English terms share the same hierarchy; numerical operating values use tabular numerals.

### Hierarchy

- **Display** (650, 34px, 1.18): the daily operating judgment only; it steps to 28px at the tablet layout and 25px at the narrow layout.
- **Headline** (650, 18px): major narrative and runtime sections.
- **Title** (620, 16px, 1.35): registered composition blocks and inspector/action titles.
- **Body** (400, 14px, 1.7): reasoning and conversation, normally limited to 72ch. Supporting judgment copy may rise to 15px; narrow body text drops to 13px while judgment copy remains 14px.
- **Label** (650, 11px, 1.45): statuses, metadata, evidence labels, counts, and machine boundaries. Labels never shrink below 11px.
- **Operating Metric** (620, 18px): key values with tabular numerals; the positive-signal value may rise to 24px.
- **Mono Reference** (400, 11px, 1.45): composition versions, evidence references, and raw identifiers only.

**The Zero Tracking Rule.** All interface text uses zero letter spacing, including uppercase machine labels.

## Layout

The shell is a full-height operating grid below a 56px top bar. On wide screens, the grid is a 216px left navigation, a fluid central canvas, and an optional 312px inspector. The central content measure is 920px; the persistent composer is capped at 840px and sits below the independently scrolling narrative canvas.

Spacing follows a compact 4px-derived rhythm, with 8, 12, 16, 20, 24, 28, and 32px as the repeated layout steps. Sections remain unframed and are divided by one-pixel rules. Comfortable density uses 24px vertical composition blocks and 32px canvas insets; compact density reduces block padding and the canvas top inset without changing type size.

At 1119px and below, the inspector becomes a right overlay up to 340px wide. At 800px and below, the 216px navigation also becomes a left overlay up to 260px wide and the main canvas takes the full grid. At 600px and below, the top bar becomes 52px, the toolbar 50px, canvas insets become 16px, prompt chips scroll horizontally, status/detail layouts wrap, and the composer keeps a ten-pixel viewport margin. The responsive contract is no horizontal viewport overflow at 375, 768, 1024, or 1440px.

**The Reading Rail Rule.** Judgment, ranked action, conversation, and registered evidence share one centered measure; side rails hold navigation and inspection, never a second competing narrative.

## Elevation & Depth

The workspace is flat by default. Depth comes from tonal layering and structural rules; shadows appear only when a surface crosses context or when the persistent composer must remain legible over scrolling content.

### Shadow Vocabulary

- **Overlay structural shadow** (`0 18px 48px rgba(0, 0, 0, 0.42)`; system light uses `rgba(35, 43, 37, 0.18)`): account menus, the responsive inspector, navigation overlay, and workspace drawers.
- **Composer dock shadow** (`0 14px 34px rgba(0, 0, 0, 0.3)`): the persistent bottom composer only; focus adds a two-pixel muted-accent halo.
- **Context scrim** (`rgba(4, 6, 5, 0.58-0.68)`): separates modal drawers and responsive rails from the workspace without blur.

**The Flat-by-Default Rule.** Narrative sections and registered composition blocks receive no shadow and no enclosing card; rules and spacing carry the hierarchy.

**The Context-Crossing Rule.** A shadow is allowed only when an element overlays content, opens outside its rail, or persists above a scrolling region.

## Shapes

Corners are compact and utilitarian. Four-pixel corners belong to status labels, release tags, and raw references; five-pixel corners belong to dense menu rows; six-pixel corners are the standard for controls, prompt chips, icons, inputs, and metric tiles; seven-pixel corners identify small bounded warnings or repeated records; eight-pixel corners are reserved for the composer, menus, and other substantial overlays. Pills are limited to compact top-level status and tab counts, while rank markers, presence dots, and avatars are circular.

Borders remain one pixel and semantic: normal rules use the quiet divider, stronger overlay edges use the strong divider, and accent/risk borders appear only for state. No component uses decorative clipping, excessive rounding, or a soft floating silhouette.

**The Tight Geometry Rule.** The 4-8px radius range keeps the workspace precise; full rounding is for status geometry, never for ordinary text commands.

## Components

### Buttons

- **Solid Send:** a 36px square mint command with a six-pixel radius and dark ink. Hover uses the stronger mint; disabled changes to the quiet surface with muted text.
- **Muted Command:** a minimum 36px text command with muted-mint fill, accent border, six-pixel radius, and 7px by 11px padding. Hover strengthens the border and text without lifting the control.
- **Ghost/Icon:** a stable 34px square, transparent by default. Hover adds a raised tonal surface and quiet border. Disabled controls retain native `disabled`, muted color, and reduced opacity.
- **Focus:** all buttons, inputs, selects, and summaries use a two-pixel mint outline with a two-pixel offset.

### Chips

- **Prompt Chip:** a minimum 33px outlined command with a six-pixel radius and 6px by 9px padding. Hover shifts to muted mint with a stronger green border.
- **Status Badge:** a four-pixel compact label with 3px by 6px padding. Synthetic, provisional, draft, confidence, and release variants always include literal text.

### Cards / Containers

- **Composition Block:** the signature registered-content container is unframed, padded 24px vertically, and separated by a bottom rule. Its header pairs a 30px quiet-surface icon tile with title and explicit status badges.
- **Evidence Metric:** a true bounded tile in the inspector, using a raised surface, one-pixel divider, six-pixel corner, and 9px padding.
- **Draft/Warning Record:** seven-pixel corners and a one-pixel semantic border. Warning backgrounds are muted, never glow-filled.
- **Nested containers:** do not put cards inside composition blocks. Evidence detail is a disclosure and definition list, not another decorative card layer.

### Inputs / Fields

- **Composer:** a persistent 54px field with an eight-pixel radius, raised surface, structural border, 8px/9px/8px/14px padding, Jarvis icon, shortcut hint, and fixed send control. Focus strengthens the border and adds a muted accent halo.
- **Select:** a minimum 40px raised field with a strong divider, six-pixel radius, and 7px by 10px padding.
- **Toggles and segmented controls:** native checkboxes retain the accent color; binary option groups use a quiet selected segment inside a seven-pixel outlined track.

### Navigation

- The 216px navigation rail uses quiet text, 37px destinations, six-pixel corners, and 7px by 8px padding. Active state is muted mint plus a mint icon; M2 destinations remain disabled, visibly tagged, and titled with their availability reason.
- The top bar remains 56px with a bottom rule, brand mark, synthetic/AI status, disabled notifications, and the account menu. At narrow widths it becomes 52px and exposes the menu button.
- The inspector uses four equal tabs with a two-pixel active underline, counts in pills, an independently scrolling body, and a persistent read-only footer.

### Drawers and Inspector

- Evidence opens in the inspector without disturbing narrative scroll. Context, evidence, action, and approval are explicit modes.
- Settings and help use a right drawer up to 420px wide over a scrim. The drawer is a modal dialog with a named heading, close control, strong edge, and structural overlay shadow.
- Action drafts expose reason, downside, confidence, observation period, evidence, approval requirement, and the literal `NO AMAZON WRITE ACCESS` boundary. There is no approval or execution control in M1.5.

### Motion and Runtime State

- Ordinary hover and layout transitions run for 160-180ms with standard ease. The refreshed judgment reveals once over 420ms with a restrained fade, two-pixel blur, and five-pixel rise.
- Jarvis loading and thinking use staged text/dots; refresh alone uses an 800ms spin. No background or infinite decorative effect is allowed.
- `prefers-reduced-motion` and the in-app reduced-motion preference reduce every animation and transition to 0.001ms and a single iteration.
- Loading, empty, error, unsupported, synthetic, provisional, and read-only states are rendered explicitly; enabled controls always produce a real local result.

## Do's and Don'ts

### Do:

- **Do** lead the canvas with one operating judgment, its reason, ranked review actions, and immediate evidence access.
- **Do** use one-pixel rules and shared reading alignment before introducing a bounded container.
- **Do** preserve exact provenance, attribution, confidence, limitation, synthetic, and read-only labels in every relevant component.
- **Do** keep controls at their implemented stable dimensions and at least 40px touch targets on narrow viewports.
- **Do** use Lucide icons with accessible names for icon-only commands and preserve visible focus.
- **Do** adapt the same semantic palette and hierarchy across the default dark and system-light modes.

### Don't:

- **Don't** turn the home surface into a KPI-card dashboard, a blank chat page, or a neon command center.
- **Don't** add gradients, glow, decorative blur, particles, spotlight effects, floating page sections, or cards nested inside cards.
- **Don't** use color alone for status, hide evidence behind hover, or imply that a draft can write to Amazon.
- **Don't** round ordinary controls into pills or exceed the established eight-pixel surface radius.
- **Don't** add arbitrary UI outside the registered `HomeComposition` component boundary.
- **Don't** animate continuously when the user is not waiting for a real operation.
