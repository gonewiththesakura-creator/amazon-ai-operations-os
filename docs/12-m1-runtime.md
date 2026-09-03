# M1 Jarvis Runtime Status

- Version: `1.0`
- Status: `IMPLEMENTED_VERTICAL_SLICE`
- Data mode: `SYNTHETIC`
- External writes: `DISABLED`

## Implemented Boundary

M1 deliberately implements one store-level question instead of producing empty shells for all domain agents:

```text
DAILY_HOME or USER_QUESTION
  -> JarvisSupervisor
  -> StoreOperationsAgent
  -> ToolGateway
  -> StoreMetricsRepository
  -> PostgreSQL synthetic facts
  -> deterministic analytics
  -> FindingEnvelope[]
  -> validated HomeComposition or ChatResponse
```

The Store Operations Agent decision flow invokes four real tools:

1. `get_store_summary`
2. `get_order_funnel`
3. `compare_periods`
4. `detect_anomalies`

The Tool Gateway additionally implements three deterministic visualization reads: `get_metric_series`, `get_top_entities`, and `get_mix_breakdown`. `GET /v1/visualizations/home` composes their PostgreSQL outputs into a typed, evidence-backed package. Missing rows are omitted rather than zero-filled. This raises the implemented Gateway total to seven reads without adding a write capability.

Other registered tools return `NOT_IMPLEMENTED`; they do not return placeholder success data.

## Runtime Contracts

`ToolResult` contains tool status, output, evidence references, data period, source, update time, confidence, limitations, and the synthetic flag. The Tool Gateway validates agent authorization and arguments before executing a deterministic service and writes allow/deny/not-implemented events to the append-only audit table in PostgreSQL.

`FindingEnvelope` contains claim, evidence, source, data period, update time, confidence, causal status, limitations, alternative hypotheses, next step, and synthetic flag. Empty evidence is rejected. `CONFIRMED_CAUSAL` is rejected unless experiment evidence exists.

`HomeComposition` remains the only home-rendering contract. Every block is checked by the Component Registry. The frontend renders unsupported future components as a visible safe-failure block and never executes model-produced HTML, JavaScript, or CSS.

## Data and Metric Path

`npm run seed:synthetic` generates the reproducible fixture workspace and loads PostgreSQL. The dataset includes 20 owned ASINs and 365 daily sales/traffic records per ASIN. M1 also loads one year of store-level Sponsored Products facts used by the first vertical slice.

All records remain `synthetic=true`. Retail and ads facts retain independent source/provenance and attribution fields. Sponsored Products data inside the 14-day click window is returned as `PROVISIONAL`; it is not mixed with mature attribution without a status warning.

The final fixture day contains an intentional order anomaly. Orders, sessions, CVR, spend, attributed sales, ACOS, comparisons, and thresholds are calculated by SQL/Python services. No LLM calculates these metrics.

## Time Semantics

Business-day ownership is always `America/Los_Angeles`. `BusinessClock` uses `zoneinfo.ZoneInfo` to derive the date and UTC boundaries, including daylight-saving offsets. PostgreSQL stores timestamps in UTC and provenance retains the source timezone. A logical clock can be injected for reproducible tests.

## Optional OpenAI Layer

OpenAI is disabled by default. When enabled, the Responses API structured-output path receives a validated candidate composition and evidence-backed findings. It may select/order candidate blocks and synthesize presentation fields within strict limits.

The validator rejects changes to tenant/date/marketplace/state, synthetic status, component IDs/types, metric payloads, evidence, provenance, data periods, and unknown actions. A failed SDK call or invalid schema retries once and then returns deterministic fallback. No API key is required for the default experience.

## Chat Context

`POST /v1/chat` accepts the authenticated tenant from `X-Tenant-Id` and a body containing message, marketplace, business date, and context. Context scope must match the request. The response returns answer, Findings, evidence, suggested follow-ups, context snapshot, run ID, and synthetic status.

The frontend carries composition ID, business date, marketplace, selected entity fields, and previous run ID. Each assistant response exposes an expandable Finding/evidence view.

## Security Boundary

- Tenant identity comes only from `X-Tenant-Id`, not query/body overrides.
- Repository connections set tenant context and switch to the RLS-constrained application role.
- Tool permissions are enforced by registry metadata.
- No external Amazon mutation tool is registered or exposed in OpenAPI.
- Recommendations remain approval drafts; approval is not execution.
- Secrets are read from environment configuration and excluded from Git.

## Remaining Work

| Capability | Status |
|---|---|
| Store-level daily/home and chat slice | IMPLEMENTED |
| Store inventory/availability tool in the chat slice | NOT_IMPLEMENTED |
| Ads, Listing, Keyword, Inventory, Finance Agent runtimes | NOT_IMPLEMENTED |
| Product-research and policy Agent runtimes | NOT_IMPLEMENTED |
| Real Amazon and third-party adapters | NOT_IMPLEMENTED |
| Hourly scheduling and event workers | NOT_IMPLEMENTED |
| External Amazon execution | FORBIDDEN_IN_MVP |

M2 should add one bounded domain vertical at a time, beginning with inventory availability and Sponsored Products/search-term diagnosis, while preserving the same data-to-evidence contract.
