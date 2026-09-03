# Amazon AI Operations OS

> Current milestone: `M1_8_VISUAL_ANALYTICS_IMPLEMENTED`

Amazon AI Operations OS is an AI-native operating workspace for Amazon store operations and product research. M1.8 adds deterministic visual analytics to the M1.7 progressive-disclosure workspace while preserving the M1 end-to-end synthetic runtime:

> Why did orders fall today, and what should I do now?

The running path is:

`PostgreSQL -> deterministic metrics and visualization tools -> Tool Gateway -> Jarvis Supervisor -> HomeComposition / Visualization API -> Next.js`

All demo records and UI outputs are marked `synthetic=true`. The MVP is read-only: it can create recommendations and approval drafts, but it has no Amazon write tool and does not connect to Amazon or third-party production APIs.

## Capability Matrix

| Capability | Status | Notes |
|---|---|---|
| Next.js Zen Executive workspace | IMPLEMENTED | Judgment-first brief, four summary metrics, three ranked actions, six operating domains, on-demand inspector, persistent composer, responsive drawers |
| Home presentation model | IMPLEMENTED | Deterministic `HomeComposition -> HomeViewModel` mapping; no arbitrary model-generated UI |
| Visual analytics layer | IMPLEMENTED | Native SVG sparklines/lines, bars and donuts from explicit tool points; no browser-side metric invention |
| FastAPI runtime | IMPLEMENTED | Home, chat, visualization, health, and registry endpoints |
| PostgreSQL schema and RLS | IMPLEMENTED | Migrations `0001` through `0005`, tenant-scoped application role |
| Synthetic generator | IMPLEMENTED | 20 owned ASINs, 365 days, product-research and procurement domains |
| PostgreSQL synthetic ingestion | IMPLEMENTED | Idempotent loader with provenance and `synthetic=true` |
| Deterministic store analytics | IMPLEMENTED | Orders, funnel, comparison, anomaly, and SP attribution metrics |
| Tool Registry | IMPLEMENTED | 22 safe definitions; no external mutation tools |
| Tool Gateway | IMPLEMENTED | Seven real read tools, including series, Top entities, and mix breakdown; all others return `NOT_IMPLEMENTED` |
| Store Operations Agent | IMPLEMENTED | First bounded domain-agent vertical slice |
| Jarvis Supervisor | IMPLEMENTED | `DAILY_HOME` and contextual store-question control paths |
| OpenAI structured orchestration | IMPLEMENTED, OPTIONAL | Disabled by default; strict schema/evidence guard and fallback |
| Contextual chat | IMPLEMENTED | Multi-turn context with evidence-backed Findings |
| Other 11 domain Agent runtimes | DESIGNED | Registered contracts only, not runtime implementations |
| Amazon SP-API / Ads API | NOT_IMPLEMENTED | Adapter boundary only |
| SellerSprite / Keepa / public-source ingestion | NOT_IMPLEMENTED | No production connectors in M1 |
| Amazon external writes | NOT_IMPLEMENTED | Explicitly forbidden in MVP |

## M1.8 Demo

The seeded final business day is intentionally anomalous. The Home API automatically selects `ORDER_AD_ANOMALY` and returns registered blocks including Critical Alert, Order Funnel, Sponsored Products diagnosis, priority action, data reference, and follow-up question.

Ask the UI:

```text
为什么今天订单下降？
我现在应该先改广告吗？
```

The second answer carries the previous run context, labels Sponsored Products attribution `PROVISIONAL`, and does not recommend an immediate bid or budget change before availability and conversion checks.

The first reading layer contains one judgment, no more than four metrics with source-backed seven-day sparklines, and no more than three actions. Exactly one operating domain is auto-expanded by priority; a user may open at most two, while collapsed domains expose no more than two metrics. Expanded Sales and Advertising domains lazy-load one selectable 30-day primary trend, at most one valid secondary breakdown, one Jarvis insight, and one evidence action. Missing source data means no chart; it is never converted to a fabricated zero series. Full provenance and limitations remain in Inspector.

Warm Light is the default theme. Dark and System modes remain available under Settings. The seeded demo date is `2026-08-31`; override `NEXT_PUBLIC_DEMO_BUSINESS_DATE` when loading a different synthetic or real business day.

## Local Setup

Prerequisites:

- Node.js 22+
- Python 3.11+
- [uv](https://docs.astral.sh/uv/)
- PostgreSQL 16, or Docker Desktop

Copy local configuration:

```powershell
Copy-Item .env.example .env
```

Never commit `.env` or API credentials.

### Docker Compose

```powershell
docker compose up --build
```

Fresh PostgreSQL volumes apply all migrations and the `seed` service loads the synthetic workspace before the API starts.

### Native Development

```powershell
uv sync --project apps/api --extra dev
npm ci --prefix apps/web
npm run seed:synthetic
```

Start two terminals:

```powershell
npm run dev:api
npm run dev:web
```

Open:

- Web: `http://127.0.0.1:3000`
- API: `http://127.0.0.1:8000`
- OpenAPI: `http://127.0.0.1:8000/docs`

Amazon US business dates are assigned in `America/Los_Angeles`. Database timestamps remain UTC and provenance retains the original source timezone. The UI can display Los Angeles, China, or browser-local time without changing business-day ownership.

## Optional OpenAI Mode

The default is deterministic fallback:

```dotenv
APP_DATA_MODE=SYNTHETIC
OPENAI_ENABLED=false
OPENAI_API_KEY=
```

To use structured orchestration, set `OPENAI_ENABLED=true`, provide `OPENAI_API_KEY`, and select `OPENAI_MODEL`. The model may only select/reorder candidate blocks and produce schema-valid narrative fields. It cannot introduce component IDs, metric payloads, evidence, provenance, actions, or external writes. Invalid output retries once, then returns `DETERMINISTIC_FALLBACK`.

## Verification

```powershell
npm run test:all
npm run build
```

With PostgreSQL available, set both `DATABASE_URL` and `TEST_DATABASE_URL` to include repository and cross-tenant integration tests. GitHub Actions provisions PostgreSQL 16, applies migrations, loads synthetic data, and runs backend, infrastructure/security, frontend, and production-build checks on every push and pull request.

## Repository Map

| Path | Purpose |
|---|---|
| `apps/web` | Next.js 16 frontend, component registry, contextual chat |
| `apps/api` | FastAPI, repository, analytics, Tool Gateway, Agent, Supervisor |
| `infra/postgres/migrations` | PostgreSQL schemas, RLS/RBAC, audit and M1 ads facts |
| `infra/tests` | Migration, RLS, write-protection, OCR, and scale contracts |
| `scripts/seed_synthetic.py` | Reproducible synthetic fixture generation and DB loader |
| `docs/12-m1-runtime.md` | Implemented M1 architecture and remaining boundaries |
| `docs/13-interaction-audit.md` | M1.5 interaction inventory, inspector contract, and acceptance evidence |
| `docs/14-m1.6-zen-executive.md` | M1.6 visual contract, responsive evidence, accessibility and verification |
| `docs/15-m1.7-information-architecture.md` | M1.7 presentation model, operating-domain and progressive-disclosure contract |
| `docs/16-m1.8-visual-analytics.md` | M1.8 deterministic visualization contract, density rules, tools, and acceptance |

## Product and Data Contracts

1. [PRD](docs/01-prd.md)
2. [System architecture](docs/02-system-architecture.md)
3. [Data sources](docs/03-data-sources.md)
4. [Data dictionary](docs/04-data-dictionary.md)
5. [Metric definitions](docs/05-metric-definitions.md)
6. [Database ER model](docs/06-er-model.md)
7. [API and MCP adapters](docs/07-adapters-and-apis.md)
8. [Security and RBAC](docs/08-security-and-rbac.md)
9. [MVP acceptance](docs/09-mvp-acceptance.md)
10. [Synthetic data](docs/10-synthetic-data.md)
11. [AI orchestration design](docs/11-ai-orchestration.md)
12. [M1 implemented runtime](docs/12-m1-runtime.md)
13. [M1.5 interaction audit](docs/13-interaction-audit.md)
14. [M1.6 Zen Executive acceptance](docs/14-m1.6-zen-executive.md)
15. [M1.7 information architecture](docs/15-m1.7-information-architecture.md)
16. [M1.8 visual analytics](docs/16-m1.8-visual-analytics.md)
