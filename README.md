# Amazon AI Operations OS

> Current milestone: `M1_5_INTERACTION_UI_REDESIGN_IMPLEMENTED`

Amazon AI Operations OS is an AI-native operating workspace for Amazon store operations and product research. M1.5 implements a production-shaped interaction layer over the M1 end-to-end synthetic scenario:

> Why did orders fall today, and what should I do now?

The running path is:

`PostgreSQL -> deterministic metrics -> Tool Gateway -> Store Operations Agent -> Jarvis Supervisor -> HomeComposition / Chat API -> Next.js`

All demo records and UI outputs are marked `synthetic=true`. The MVP is read-only: it can create recommendations and approval drafts, but it has no Amazon write tool and does not connect to Amazon or third-party production APIs.

## Capability Matrix

| Capability | Status | Notes |
|---|---|---|
| Next.js three-column workspace | IMPLEMENTED | Jarvis daily brief, ranked review drafts, evidence/action/approval inspectors, persistent composer, responsive drawers |
| FastAPI runtime | IMPLEMENTED | Home, chat, health, and registry endpoints |
| PostgreSQL schema and RLS | IMPLEMENTED | Migrations `0001` through `0005`, tenant-scoped application role |
| Synthetic generator | IMPLEMENTED | 20 owned ASINs, 365 days, product-research and procurement domains |
| PostgreSQL synthetic ingestion | IMPLEMENTED | Idempotent loader with provenance and `synthetic=true` |
| Deterministic store analytics | IMPLEMENTED | Orders, funnel, comparison, anomaly, and SP attribution metrics |
| Tool Registry | IMPLEMENTED | 22 safe definitions; no external mutation tools |
| Tool Gateway | IMPLEMENTED | Four real read tools; all others return `NOT_IMPLEMENTED` |
| Store Operations Agent | IMPLEMENTED | First bounded domain-agent vertical slice |
| Jarvis Supervisor | IMPLEMENTED | `DAILY_HOME` and contextual store-question control paths |
| OpenAI structured orchestration | IMPLEMENTED, OPTIONAL | Disabled by default; strict schema/evidence guard and fallback |
| Contextual chat | IMPLEMENTED | Multi-turn context with evidence-backed Findings |
| Other 11 domain Agent runtimes | DESIGNED | Registered contracts only, not runtime implementations |
| Amazon SP-API / Ads API | NOT_IMPLEMENTED | Adapter boundary only |
| SellerSprite / Keepa / public-source ingestion | NOT_IMPLEMENTED | No production connectors in M1 |
| Amazon external writes | NOT_IMPLEMENTED | Explicitly forbidden in MVP |

## M1.5 Demo

The seeded final business day is intentionally anomalous. The Home API automatically selects `ORDER_AD_ANOMALY` and returns registered blocks including Critical Alert, Order Funnel, Sponsored Products diagnosis, priority action, data reference, and follow-up question.

Ask the UI:

```text
为什么今天订单下降？
我现在应该先改广告吗？
```

The second answer carries the previous run context, labels Sponsored Products attribution `PROVISIONAL`, and does not recommend an immediate bid or budget change before availability and conversion checks.

Every visible control is either functional or explicitly disabled with its M2 availability reason. Action drafts resolve their rationale and confidence through matching evidence references. At responsive widths, navigation and inspector surfaces become keyboard-safe drawers; `Escape` closes them and restores focus.

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
