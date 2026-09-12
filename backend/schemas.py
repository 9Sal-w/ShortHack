"""
schemas.py
==========
Pydantic-схемы запросов/ответов API. Соответствуют TypeScript-интерфейсам
фронтенда (frontend/src/types.ts) один в один, чтобы JSON от backend'а
ложился на фронтенд без адаптации.
"""

from typing import Literal, Optional, List

from pydantic import BaseModel, Field

TicketCategory = Literal[
    "wifi", "accounts", "hardware", "software", "organization", "gitverse", "other"
]
TicketPriority = Literal["low", "medium", "high", "critical"]
TicketStatus = Literal["new", "in_progress", "resolved"]
RewriteLevel = Literal[1, 3, 5]
MessageAuthor = Literal["employee", "operator", "ai", "system"]


class Ticket(BaseModel):
    id: str
    summary: str
    category: TicketCategory
    priority: TicketPriority
    status: TicketStatus
    raw_text: str
    employee_name: str
    contact: str
    session_id: str
    created_at: str
    updated_at: str

    model_config = {"from_attributes": True}


class ChatMessage(BaseModel):
    id: str
    session_id: str
    ticket_id: Optional[str] = None
    author: MessageAuthor
    author_name: str
    text: str
    created_at: str

    model_config = {"from_attributes": True}


class AuthRequest(BaseModel):
    login: str
    password: str


class AuthResponse(BaseModel):
    token: str
    operator_name: str


class StartChatRequest(BaseModel):
    employee_name: str = Field(min_length=1, max_length=200)
    contact: str = Field(min_length=1, max_length=200)


class StartChatResponse(BaseModel):
    session_id: str
    messages: List[ChatMessage]


class SendChatMessageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)


class SendChatMessageResponse(BaseModel):
    message: ChatMessage
    ticket: Optional[Ticket] = None


class SendTicketMessageRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    author: MessageAuthor = "operator"


class RewriteStyleRequest(BaseModel):
    text: str = Field(min_length=1, max_length=4000)
    level: RewriteLevel


class RewriteStyleResponse(BaseModel):
    rewritten_text: str
