# M1.5 Interaction Audit

## Scope

This audit covers every visible interactive element in the M1 Jarvis home before the M1.5 redesign. The acceptance rule is simple: an element is functional, explicitly disabled with a reason, or rendered as non-interactive content.

## Baseline Findings

| Surface | Baseline behavior | M1.5 classification | Required outcome |
| --- | --- | --- | --- |
| Mobile navigation open/close | Functional | FUNCTIONAL | Preserve with focusable close and scrim. |
| Notification bell | Clickable, no effect | DISABLED_WITH_REASON | Keep disabled and label as an M2 capability. |
| Account avatar | Clickable, no effect | FUNCTIONAL | Open a real account/workspace menu. |
| Store selector | Clickable, no effect | NON_INTERACTIVE | Render fixed store context as text until switching exists. |
| AI home navigation | Changes a local active style only | FUNCTIONAL | Keep as the only current destination. |
| Product, Ads, Search, Market, Experiment, Audit navigation | Changes active style but has no page | DISABLED_WITH_REASON | Disable with `M2` and explain availability. |
| Settings | Clickable, no effect | FUNCTIONAL | Open settings drawer; preferences update the UI and persist locally. |
| Help | Clickable, no effect | FUNCTIONAL | Open truthful keyboard/data-boundary help. |
| Timezone selector | Functional | FUNCTIONAL | Move into settings and keep a compact current-time display. |
| Refresh | Functional | FUNCTIONAL | Reload `HomeComposition` and show staged progress. |
| Quick questions | Functional | FUNCTIONAL | Submit immediately with the active composition context. |
| Typed Jarvis question | Functional | FUNCTIONAL | Preserve submit, disabled, error, and running states. |
| Context collapse/expand | Functional | FUNCTIONAL | Preserve on desktop; use a named drawer on narrower viewports. |
| Evidence links in right rail | Styled as clickable, no handler | FUNCTIONAL | Open a complete Evidence Inspector. |
| Approval queue | Styled as a card, no handler | FUNCTIONAL | Open Approval Inspector; no approval/execute button in M1. |
| Priority action | Shows a generic toast only | FUNCTIONAL | Open Action Inspector with boundaries and evidence. |
| Follow-up question | Only copies text into input | FUNCTIONAL | Submit directly as a contextual follow-up. |
| Evidence details in blocks | Native details works | FUNCTIONAL | Keep progressive disclosure and add inspector access. |
| Chat finding details | Native details works | FUNCTIONAL | Preserve with human labels and provenance. |

## Inspector Content Contract

Evidence mode must show claim, observed and baseline values when present, data period, data and semantic source, update time, attribution window, confidence, synthetic flag, limitations, and raw references.

Action mode must show suggestion, rationale, scope of likely impact, downside risk, evidence, confidence, truthful observation period, approval requirement, and `DRAFT · REVIEW ONLY · NO AMAZON WRITE ACCESS`.

Approval mode lists reviewable drafts only. M1 must not expose `Approve`, `Execute`, Amazon write, or misleading completed-state controls.

## Test Contract

Automated interaction tests cover account, settings, help, refresh, quick questions, typed chat, context rail, evidence inspector, priority action inspector, approval inspector, follow-up submission, truthful disabled navigation, and the non-interactive store context. Browser verification covers those flows at 1440px and the shell at 1024, 768, and 375px.

## M1.5 Acceptance Result

- All visible controls satisfy the functional, disabled-with-reason, or non-interactive contract.
- Action inspectors bind supporting rationale and confidence through matching `evidence_refs`; stale block state is cleared when no association exists.
- Closed responsive inspectors are hidden and inert. `Escape` closes the inspector and returns focus to its opener.
- The 375px first viewport shows the operating judgment and the first complete ranked action above the persistent composer.
- Screenshots were verified at exact widths of 1440, 1024, 768, and 375 pixels without horizontal overflow.
- The UI remains synthetic and read-only. No approval, Amazon write, arbitrary HTML, JavaScript, or CSS generation path is exposed.
- Frontend interaction coverage passes 19 tests. Backend and infrastructure suites remain unchanged and passing.
