from fastapi import APIRouter, Request

from amazon_ai_api.models.chat import ChatRequest, ChatResponse
from amazon_ai_api.routes.dependencies import TenantId


router = APIRouter(prefix="/v1", tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    request: Request,
    tenant_id: TenantId,
) -> ChatResponse:
    return request.app.state.supervisor.answer_question(
        tenant_id=tenant_id,
        message=payload.message,
        marketplace=payload.marketplace,
        business_date=payload.business_date,
        context=payload.context,
    )
