from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI

from amazon_ai_api import __version__
from amazon_ai_api.adapters.synthetic import SyntheticAdapter
from amazon_ai_api.registries.defaults import build_default_registries
from amazon_ai_api.routes import health, home, registries
from amazon_ai_api.services.home_composition import HomeCompositionService


def create_app() -> FastAPI:
    registries_bundle = build_default_registries()
    adapter = SyntheticAdapter()
    home_service = HomeCompositionService(
        adapter=adapter,
        component_registry=registries_bundle.components,
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        registries_bundle.validate()
        app.state.registries = registries_bundle
        app.state.adapter = adapter
        app.state.home_service = home_service
        yield

    app = FastAPI(
        title="Amazon AI Operating System API",
        version=__version__,
        description=(
            "M0 contract API. All demo data is synthetic and no external Amazon writes "
            "are registered or deployed."
        ),
        lifespan=lifespan,
    )
    app.include_router(health.router)
    app.include_router(home.router)
    app.include_router(registries.router)
    return app


app = create_app()
