from datetime import date

from fastapi import APIRouter, HTTPException, Query, Request

from amazon_ai_api.models.home import HomeComposition
from amazon_ai_api.routes.dependencies import TenantId


router = APIRouter(prefix="/v1/home", tags=["home"])


@router.get("/composition", response_model=HomeComposition)
async def get_home_composition(
    request: Request,
    tenant_id: TenantId,
    business_date: date | None = Query(default=None),
    marketplace: str = Query(default="ATVPDKIKX0DER", min_length=1, max_length=32),
) -> HomeComposition:
    try:
        return await request.app.state.supervisor.daily_home(
            tenant_id=tenant_id,
            marketplace=marketplace,
            business_date=business_date or request.app.state.business_clock.current_business_date(),
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
