"""
main.py
=======
Точка входа FastAPI-приложения. Реализует эндпоинты, которые ожидает
фронтенд СберТеха (см. frontend/src/api.ts):

    POST /api/auth                        — вход оператора
    GET  /api/tickets                     — список обращений (для оператора)
    POST /api/chat/start                  — сотрудник начинает новый чат
    POST /api/chat/{session_id}/messages  — сообщение сотрудника ИИ-агенту №1
    GET  /api/chat/{session_id}/messages  — история чата сотрудника
    GET  /api/tickets/{id}/messages       — полная переписка по тикету (оператор)
    POST /api/tickets/{id}/messages       — сообщение оператора (или сотрудника)
    POST /api/rewrite-style               — ИИ-агент №2 (переформулировка стиля)
    GET  /api/health                      — проверка живости backend'а

АРХИТЕКТУРА ПЕРЕПИСКИ: сообщения сотрудника и ИИ-агента-приёмщика на этапе
"пока тикета ещё нет" хранятся с ticket_id = NULL. Как только агент №1
решает, что данных достаточно, backend создаёт Ticket и ПРОСТАВЛЯЕТ
ticket_id всем ранее сохранённым сообщениям этой сессии — так переписка
становится единой цепочкой, видимой и сотруднику (на /submit), и оператору
(в дашборде), без дублирования данных.

ПРО NGINX: сервис слушает порт из .env (по умолчанию 8080) и не отдаёт
статику фронтенда — этим занимается Nginx (см. nginx/nginx.conf).
"""

import uuid
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

import ai_client
from auth import create_access_token, get_current_operator, verify_credentials
from config import get_settings
from database import ChatSessionORM, MessageORM, TicketORM, get_db, init_db
from schemas import (
    AuthRequest,
    AuthResponse,
    ChatMessage,
    RewriteStyleRequest,
    RewriteStyleResponse,
    SendChatMessageRequest,
    SendChatMessageResponse,
    SendTicketMessageRequest,
    StartChatRequest,
    StartChatResponse,
    Ticket,
)

settings = get_settings()

app = FastAPI(
    title="СберТех — Рабочее место оператора ИИ-поддержки (API)",
    description="Backend: чат сотрудника с ИИ-агентом-приёмщиком + дашборд оператора с перепиской.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    init_db()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _new_id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _generate_ticket_id(db: Session) -> str:
    count = db.query(TicketORM).count()
    return f"TSK-{40001 + count}"


def _save_message(db: Session, session_id: str, ticket_id, author: str, author_name: str, text: str) -> MessageORM:
    msg = MessageORM(
        id=_new_id("msg"),
        session_id=session_id,
        ticket_id=ticket_id,
        author=author,
        author_name=author_name,
        text=text,
        created_at=_now(),
    )
    db.add(msg)
    db.commit()
    db.refresh(msg)
    return msg


def _get_conversation_text(db: Session, session_id: str) -> str:
    """Собирает весь диалог сессии в один текст для передачи ИИ-агенту №1."""
    messages = (
        db.query(MessageORM)
        .filter(MessageORM.session_id == session_id)
        .order_by(MessageORM.seq.asc())
        .all()
    )
    lines = []
    for m in messages:
        role = "Сотрудник" if m.author == "employee" else "Ассистент"
        lines.append(f"{role}: {m.text}")
    return "\n".join(lines)


def _count_employee_turns(db: Session, session_id: str) -> int:
    return db.query(MessageORM).filter(
        MessageORM.session_id == session_id, MessageORM.author == "employee"
    ).count()


# =============================================================
# POST /api/auth — авторизация оператора
# =============================================================
@app.post("/api/auth", response_model=AuthResponse)
def login(payload: AuthRequest):
    if not verify_credentials(payload.login, payload.password):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = create_access_token(payload.login)
    return AuthResponse(token=token, operator_name=settings.operator_display_name)


# =============================================================
# GET /api/tickets — список обращений (только для авторизованного оператора)
# =============================================================
@app.get("/api/tickets", response_model=list[Ticket])
def list_tickets(db: Session = Depends(get_db), _operator: str = Depends(get_current_operator)):
    tickets = db.query(TicketORM).order_by(TicketORM.created_at.desc()).all()
    return [Ticket.model_validate(t) for t in tickets]


# =============================================================
# POST /api/chat/start — сотрудник начинает новое обращение (ПУБЛИЧНЫЙ эндпоинт)
# =============================================================
@app.post("/api/chat/start", response_model=StartChatResponse)
def start_chat(payload: StartChatRequest, db: Session = Depends(get_db)):
    session_id = _new_id("sess")
    session = ChatSessionORM(
        id=session_id,
        employee_name=payload.employee_name,
        contact=payload.contact,
        ticket_id=None,
        created_at=_now(),
    )
    db.add(session)
    db.commit()

    greeting_text = (
        f"Здравствуйте, {payload.employee_name}! Расскажите, что случилось — "
        f"я задам уточняющие вопросы, если что-то будет неясно, и передам "
        f"обращение оператору поддержки."
    )
    greeting = _save_message(db, session_id, None, "ai", "ИИ-ассистент поддержки", greeting_text)

    return StartChatResponse(session_id=session_id, messages=[ChatMessage.model_validate(greeting)])


# =============================================================
# POST /api/chat/{session_id}/messages — сообщение сотрудника ИИ-агенту №1.
# Агент либо задаёт уточняющий вопрос, либо создаёт Ticket.
# =============================================================
@app.post("/api/chat/{session_id}/messages", response_model=SendChatMessageResponse)
def send_chat_message(session_id: str, payload: SendChatMessageRequest, db: Session = Depends(get_db)):
    session = db.query(ChatSessionORM).filter(ChatSessionORM.id == session_id).first()
    if session is None:
        raise HTTPException(status_code=404, detail="Сессия чата не найдена")

    # Если тикет уже создан, но сотрудник продолжает писать в тот же чат —
    # это уже обычное сообщение в переписке с оператором, ИИ-агент №1 больше
    # не вызывается.
    if session.ticket_id:
        msg = _save_message(db, session_id, session.ticket_id, "employee", session.employee_name, payload.text)
        ticket_orm = db.query(TicketORM).filter(TicketORM.id == session.ticket_id).first()
        return SendChatMessageResponse(
            message=ChatMessage.model_validate(msg),
            ticket=Ticket.model_validate(ticket_orm) if ticket_orm else None,
        )

    # Сохраняем сообщение сотрудника (ticket_id пока нет)
    _save_message(db, session_id, None, "employee", session.employee_name, payload.text)

    conversation_text = _get_conversation_text(db, session_id)
    employee_turns = _count_employee_turns(db, session_id)

    # Реальный вызов ИИ-агента №1 (или локальный fallback внутри ai_client)
    result = ai_client.intake_agent_step(conversation_text, employee_turns)

    if result["action"] == "ask":
        ai_msg = _save_message(db, session_id, None, "ai", "ИИ-ассистент поддержки", result["question"])
        return SendChatMessageResponse(message=ChatMessage.model_validate(ai_msg), ticket=None)

    # action == "create_ticket": создаём обращение и связываем с сессией
    ticket_id = _generate_ticket_id(db)
    now = _now()
    ticket_orm = TicketORM(
        id=ticket_id,
        session_id=session_id,
        summary=result["summary"],
        category=result["category"],
        priority=result["priority"],
        status="new",
        raw_text=conversation_text,
        employee_name=session.employee_name,
        contact=session.contact,
        created_at=now,
        updated_at=now,
    )
    db.add(ticket_orm)

    session.ticket_id = ticket_id
    db.commit()

    # Проставляем ticket_id всем ранее сохранённым сообщениям этой сессии
    db.query(MessageORM).filter(MessageORM.session_id == session_id).update({"ticket_id": ticket_id})
    db.commit()

    system_text = f"Спасибо! Обращение принято и передано оператору поддержки, номер {ticket_id}."
    system_msg = _save_message(db, session_id, ticket_id, "system", "Система", system_text)

    return SendChatMessageResponse(
        message=ChatMessage.model_validate(system_msg),
        ticket=Ticket.model_validate(ticket_orm),
    )


# =============================================================
# GET /api/chat/{session_id}/messages — история чата сотрудника (восстановление при перезаходе)
# =============================================================
@app.get("/api/chat/{session_id}/messages", response_model=list[ChatMessage])
def get_chat_messages(session_id: str, db: Session = Depends(get_db)):
    messages = (
        db.query(MessageORM)
        .filter(MessageORM.session_id == session_id)
        .order_by(MessageORM.seq.asc())
        .all()
    )
    return [ChatMessage.model_validate(m) for m in messages]


# =============================================================
# GET /api/tickets/{id}/messages — полная переписка по тикету (для оператора)
# =============================================================
@app.get("/api/tickets/{ticket_id}/messages", response_model=list[ChatMessage])
def get_ticket_messages(
    ticket_id: str, db: Session = Depends(get_db), _operator: str = Depends(get_current_operator)
):
    messages = (
        db.query(MessageORM)
        .filter(MessageORM.ticket_id == ticket_id)
        .order_by(MessageORM.seq.asc())
        .all()
    )
    return [ChatMessage.model_validate(m) for m in messages]


# =============================================================
# POST /api/tickets/{id}/messages — сообщение оператора (или сотрудника) в переписку.
# Отправка оператором переводит статус тикета в "in_progress".
# =============================================================
@app.post("/api/tickets/{ticket_id}/messages", response_model=ChatMessage)
def send_ticket_message(
    ticket_id: str,
    payload: SendTicketMessageRequest,
    db: Session = Depends(get_db),
    _operator: str = Depends(get_current_operator),
):
    ticket_orm = db.query(TicketORM).filter(TicketORM.id == ticket_id).first()
    if ticket_orm is None:
        raise HTTPException(status_code=404, detail="Обращение не найдено")

    author_name = settings.operator_display_name if payload.author == "operator" else ticket_orm.employee_name
    msg = _save_message(db, ticket_orm.session_id, ticket_id, payload.author, author_name, payload.text)

    if payload.author == "operator" and ticket_orm.status == "new":
        ticket_orm.status = "in_progress"
    ticket_orm.updated_at = _now()
    db.commit()

    return ChatMessage.model_validate(msg)


# =============================================================
# POST /api/rewrite-style — ИИ-агент №2 (переформулировка стиля ответа оператора)
# =============================================================
@app.post("/api/rewrite-style", response_model=RewriteStyleResponse)
def rewrite_style_endpoint(
    payload: RewriteStyleRequest, _operator: str = Depends(get_current_operator)
):
    rewritten = ai_client.rewrite_style(payload.text, payload.level)
    return RewriteStyleResponse(rewritten_text=rewritten)


# =============================================================
# Служебный health-check
# =============================================================
@app.get("/api/health")
def health_check():
    return {"status": "ok", "ai_provider": settings.ai_provider}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host=settings.app_host, port=settings.app_port, reload=True)
