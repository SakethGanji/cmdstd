"""AI Chat SSE endpoint."""

from __future__ import annotations

from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Depends
from sse_starlette.sse import EventSourceResponse, ServerSentEvent

from ..core.dependencies import get_ai_chat_service
from ..schemas.ai_chat import AIChatRequest
from ..services.ai_chat_service import AIChatService

router = APIRouter(prefix="/ai")


@router.post("/chat")
async def ai_chat(
    request: AIChatRequest,
    service: Annotated[AIChatService, Depends(get_ai_chat_service)],
) -> EventSourceResponse:
    """Stream AI chat response as SSE events."""

    async def event_generator() -> AsyncGenerator[ServerSentEvent, None]:
        async for event in service.stream_chat(request):
            yield ServerSentEvent(
                data=event["data"],
                event=event["event"],
            )

    return EventSourceResponse(event_generator())
