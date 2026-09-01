# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

The primary user is the owner-operator of a US Amazon store managing no more than 20 owned ASINs. The operator reviews the business once per day, responds to material hourly anomalies, and may display timestamps in China local time while the business date remains anchored to `America/Los_Angeles`.

## Product Purpose

Amazon AI Operations OS is an AI-native operating workspace for Amazon operations and product research. It turns collected evidence into a daily business judgment, ranked actions, approval drafts, and a traceable follow-up conversation. Success means the first screen answers why the store did or did not generate orders and what the operator should do next without hiding the evidence or overstating certainty.

## Positioning

Jarvis is the controlled analysis and interaction layer over deterministic metrics, provenance-aware evidence, registered tools, and registered UI components. It is not a dashboard with a chat box and it cannot create arbitrary HTML, JavaScript, CSS, metric values, or Amazon write operations.

## Operating Context

- The default marketplace is Amazon US and the business timezone is `America/Los_Angeles`.
- The database stores timestamps in UTC and preserves source timezones.
- The MVP focuses on Sponsored Products.
- Data is analyzed daily with hourly anomaly checks.
- Owned ASINs can operate in launch, scale, harvest, or rank-recovery stages. The system recommends stage changes, but the user confirms the effective stage.
- The current runnable vertical slice is the store-level Jarvis home and contextual chat backed by PostgreSQL synthetic data.

## Capabilities and Constraints

- `HomeComposition` is the only dynamic home rendering contract. Models can select only registered components.
- Every conclusion exposes evidence references, data period, source semantics, freshness, attribution window, confidence, limitations, and synthetic status.
- All demonstration records and operating metrics are `synthetic=true`.
- The MVP is read-only. Recommendations and approval drafts are review artifacts; no Amazon advertising or Listing write tool is registered.
- Attribution windows cannot be added or compared as if they were equivalent.
- Buyer PII is not collected unless strictly required by a future approved workflow.
- Loading, empty, error, stale/provisional, and synthetic states must be explicit.

## Brand Commitments

The product name is Amazon AI Operations OS and the assistant is Jarvis. The product should feel like a calm, senior operations partner: direct, evidence-led, restrained, and serious about uncertainty. The user has fixed the interaction structure as a left navigation, central AI conversation and dynamic canvas, persistent bottom composer, and collapsible right context/approval inspector.

## Evidence on Hand

- Product, architecture, security, data, orchestration, and acceptance contracts in `docs/`.
- A PostgreSQL synthetic dataset with 20 owned ASINs and 365 days of operations data.
- A working FastAPI `HomeComposition` and chat runtime.
- No live Amazon APIs, public-product claims, customer testimonials, or production performance claims are available. Future work must not fabricate them.

## Product Principles

1. Lead with the operating judgment and the next action, not a wall of metrics.
2. Keep deterministic calculation and provenance underneath every AI statement.
3. Make uncertainty, synthetic data, and read-only boundaries impossible to miss.
4. Give every enabled control a real result; disable or remove unavailable behavior.
5. Preserve expert density while revealing detail progressively.

## Accessibility & Inclusion

The web workspace must support keyboard operation, visible focus, reduced motion, non-color status labels, Chinese and English data terminology, and responsive use at 375, 768, 1024, and 1440 pixel widths.
