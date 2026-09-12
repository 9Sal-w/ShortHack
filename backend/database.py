"""
database.py
===========
SQLAlchemy: движок, сессии и ORM-модели.

Три сущности:
  ChatSessionORM — сессия чата сотрудника. Создаётся при "POST /api/chat/start"
                   ещё ДО появления тикета. Хранит employee_name/contact,
                   а также ticket_id, который заполняется, когда ИИ-агент
                   №1 решает, что данных достаточно, и создаёт обращение.
  TicketORM      — обращение. Связано с ChatSessionORM через session_id.
  MessageORM     — одно сообщение единой переписки (intake-диалог с ИИ
                   и дальнейшее общение с оператором идут в одну ленту).
                   Поле "seq" — автоинкрементный числовой первичный ключ,
                   используется для устойчивой сортировки сообщений по
                   порядку добавления.

Для продакшена достаточно заменить DATABASE_URL в .env на PostgreSQL —
остальной код не меняется, т.к. использует универсальный SQLAlchemy ORM.
"""

from datetime import datetime, timezone

from sqlalchemy import create_engine, Column, String, Integer
from sqlalchemy.orm import declarative_base, sessionmaker

from config import get_settings

settings = get_settings()

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ChatSessionORM(Base):
    __tablename__ = "chat_sessions"

    id = Column(String, primary_key=True, index=True)  # session_id (UUID)
    employee_name = Column(String, nullable=False)
    contact = Column(String, nullable=False)
    ticket_id = Column(String, nullable=True)
    created_at = Column(String, nullable=False, default=utc_now_iso)


class TicketORM(Base):
    __tablename__ = "tickets"

    id = Column(String, primary_key=True, index=True)
    session_id = Column(String, nullable=False, index=True)
    summary = Column(String, nullable=False)
    category = Column(String, nullable=False)
    priority = Column(String, nullable=False)
    status = Column(String, nullable=False, default="new")
    raw_text = Column(String, nullable=False)
    employee_name = Column(String, nullable=False)
    contact = Column(String, nullable=False)
    created_at = Column(String, nullable=False, default=utc_now_iso)
    updated_at = Column(String, nullable=False, default=utc_now_iso)


class MessageORM(Base):
    __tablename__ = "messages"

    seq = Column(Integer, primary_key=True, autoincrement=True)
    id = Column(String, nullable=False, unique=True, index=True)  # публичный UUID сообщения
    session_id = Column(String, nullable=False, index=True)
    ticket_id = Column(String, nullable=True, index=True)  # null до создания тикета
    author = Column(String, nullable=False)  # employee | operator | ai | system
    author_name = Column(String, nullable=False)
    text = Column(String, nullable=False)
    created_at = Column(String, nullable=False, default=utc_now_iso)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
