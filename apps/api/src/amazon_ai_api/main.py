from contextlib import asynccontextmanager
from datetime import datetime
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from amazon_ai_api import __version__
from amazon_ai_api.adapters.synthetic import SyntheticAdapter
from amazon_ai_api.config import Settings
from amazon_ai_api.db.connection import Database
from amazon_ai_api.db.repositories.store_metrics import (
    PostgresStoreMetricsRepository,
    StoreMetricsRepository,
)
from amazon_ai_api.registries.defaults import build_default_registries
from amazon_ai_api.routes import health, home, registries
from amazon_ai_api.orchestration.agents.store_operations import StoreOperationsAgent
from amazon_ai_api.orchestration.audit import (
    AuditWriter,
    MemoryAuditWriter,
    PostgresAuditWriter,
)
from amazon_ai_api.orchestration.supervisor import JarvisSupervisor
from amazon_ai_api.orchestration.tool_gateway import ToolGateway
from amazon_ai_api.services.home_composition import HomeCompositionService
from amazon_ai_api.services.business_clock import BusinessClock


def create_app(
    *,
    settings: Settings | None = None,
    repository: StoreMetricsRepository | None = None,
    audit_writer: AuditWriter | None = None,
    logical_now: datetime | None = None,
) -> FastAPI:
    settings = settings or Settings.from_env()
    registries_bundle = build_default_registries()
    database = Database(settings.database_url)
    injected_repository = repository is not None
    repository = repository or PostgresStoreMetricsRepository(database)
    business_clock = BusinessClock(settings.business_timezone, logical_now=logical_now)
    adapter = SyntheticAdapter(repository=repository, business_clock=business_clock)
    home_service = HomeCompositionService(
        adapter=adapter,
        component_registry=registries_bundle.components,
        ai_mode=settings.ai_mode,
    )
    audit_writer = audit_writer or (
        MemoryAuditWriter() if injected_repository else PostgresAuditWriter(database)
    )
    tool_gateway = ToolGateway(
        registry=registries_bundle.tools,
        repository=repository,
        business_clock=business_clock,
        audit_writer=audit_writer,
    )
    store_agent = StoreOperationsAgent(tool_gateway)
    supervisor = JarvisSupervisor(
        store_agent=store_agent,
        deterministic_composer=home_service,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        registries_bundle.validate()
        app.state.registries = registries_bundle
        app.state.adapter = adapter
        app.state.settings = settings
        app.state.database = database
        app.state.repository = repository
        app.state.business_clock = business_clock
        app.state.home_service = home_service
        app.state.audit_writer = audit_writer
        app.state.tool_gateway = tool_gateway
        app.state.store_agent = store_agent
        app.state.supervisor = supervisor
        yield

    app = FastAPI(
        title="Amazon AI Operating System API",
        version=__version__,
        description=(
            "M1 Jarvis runtime API. All demo data is synthetic and no external Amazon "
            "writes are registered or deployed."
        ),
        lifespan=lifespan,
    )
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(settings.web_origins),
        allow_credentials=False,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "X-Tenant-Id"],
    )
    app.include_router(health.router)
    app.include_router(home.router)
    app.include_router(registries.router)
    return app


app = create_app()
