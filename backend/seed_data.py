"""
seed_data.py
============
Наполняет БД тестовыми данными: 4 чат-сессии, 4 тикета и полная
переписка по каждому (диалог с ИИ-агентом-приёмщиком + сообщения
оператора) — те же кейсы, что зашиты во фронтенде как mock-данные.

Запуск (один раз, после первого создания таблиц):
    python seed_data.py

Скрипт идемпотентен: повторный запуск не создаёт дубликаты сессий.
"""

from database import ChatSessionORM, MessageORM, SessionLocal, TicketORM, init_db

SESSIONS = [
    dict(id="sess-40521", employee_name="Дмитрий Ковалёв", contact="+7 (900) 123-45-67", ticket_id="TSK-40521", created_at="2026-09-12T07:11:00+03:00"),
    dict(id="sess-40518", employee_name="Анна Светлова", contact="a.svetlova@sbertech.internal", ticket_id="TSK-40518", created_at="2026-09-11T15:39:00+03:00"),
    dict(id="sess-40509", employee_name="Игорь Панфилов", contact="+7 (901) 555-20-14", ticket_id="TSK-40509", created_at="2026-09-11T10:19:00+03:00"),
    dict(id="sess-40495", employee_name="Мария Левитина", contact="m.levitina@sbertech.internal", ticket_id="TSK-40495", created_at="2026-09-08T13:04:00+03:00"),
]

TICKETS = [
    dict(
        id="TSK-40521", session_id="sess-40521",
        summary="Не удаётся авторизоваться в корпоративной Wi-Fi сети SberCorp-Secure на новом ноутбуке — сертификат не принимается.",
        category="wifi", priority="high", status="new",
        raw_text="Сотрудник: вай фай не пускает, ошибка сертификата сети.\nАссистент: На новом или привычном устройстве? Этаж/крыло?\nСотрудник: Новый ноутбук, этаж 4 крыло Б.",
        employee_name="Дмитрий Ковалёв", contact="+7 (900) 123-45-67",
        created_at="2026-09-12T07:12:00+03:00", updated_at="2026-09-12T07:20:00+03:00",
    ),
    dict(
        id="TSK-40518", session_id="sess-40518",
        summary="Проблема с доступом к репозиторию в Gitverse: push отклоняется с ошибкой прав доступа после смены команды.",
        category="gitverse", priority="medium", status="in_progress",
        raw_text="Сотрудник: не пушится в гитверс, permission denied.\nАссистент: Менялась команда? Название репозитория?\nСотрудник: Да, команда Эквайринг мобильный, репо acquiring-mobile-core.",
        employee_name="Анна Светлова", contact="a.svetlova@sbertech.internal",
        created_at="2026-09-11T15:40:00+03:00", updated_at="2026-09-12T09:05:00+03:00",
    ),
    dict(
        id="TSK-40509", session_id="sess-40509",
        summary="Заявка на замену монитора инженера: экран мигает и появляются горизонтальные полосы.",
        category="hardware", priority="critical", status="in_progress",
        raw_text="Сотрудник: монитор мигает, пошли полосы через весь экран.\nАссистент: Инвентарный номер и отдел?\nСотрудник: INV-885241, отдел нагрузочного тестирования.",
        employee_name="Игорь Панфилов", contact="+7 (901) 555-20-14",
        created_at="2026-09-11T10:20:00+03:00", updated_at="2026-09-12T08:55:00+03:00",
    ),
    dict(
        id="TSK-40495", session_id="sess-40495",
        summary="Перенос рабочего места на другой этаж в связи с переходом в новый проектный офис.",
        category="organization", priority="low", status="resolved",
        raw_text="Сотрудник: перевели в новый проект, нужно перенести рабочее место.\nАссистент: На какой этаж и какое оборудование?\nСотрудник: 7 этаж, компьютер, два монитора, док-станция, тумбочка.",
        employee_name="Мария Левитина", contact="m.levitina@sbertech.internal",
        created_at="2026-09-08T13:05:00+03:00", updated_at="2026-09-10T17:30:00+03:00",
    ),
]

MESSAGES = [
    dict(id="msg-1", session_id="sess-40521", ticket_id="TSK-40521", author="employee", author_name="Дмитрий Ковалёв", text="здравствуйте! вай фай в офисе не пускает, ошибка сертификата сети.", created_at="2026-09-12T07:11:00+03:00"),
    dict(id="msg-2", session_id="sess-40521", ticket_id="TSK-40521", author="ai", author_name="ИИ-ассистент поддержки", text="Подскажите: это на новом или привычном устройстве? И на каком этаже/крыле офиса вы находитесь?", created_at="2026-09-12T07:11:30+03:00"),
    dict(id="msg-3", session_id="sess-40521", ticket_id="TSK-40521", author="employee", author_name="Дмитрий Ковалёв", text="Получил новый ноутбук сегодня утром. Этаж 4, крыло Б.", created_at="2026-09-12T07:12:00+03:00"),
    dict(id="msg-4", session_id="sess-40521", ticket_id="TSK-40521", author="system", author_name="Система", text="Спасибо! Обращение принято и передано оператору поддержки, номер TSK-40521.", created_at="2026-09-12T07:12:10+03:00"),
    dict(id="msg-5", session_id="sess-40521", ticket_id="TSK-40521", author="operator", author_name="Оператор поддержки", text="Дмитрий, добрый день! Принял заявку в работу, уточняю модель нового устройства у инженеров.", created_at="2026-09-12T07:20:00+03:00"),
    dict(id="msg-6", session_id="sess-40518", ticket_id="TSK-40518", author="employee", author_name="Анна Светлова", text="Не могу запушить коммиты, permission denied (publickey).", created_at="2026-09-11T15:39:00+03:00"),
    dict(id="msg-7", session_id="sess-40518", ticket_id="TSK-40518", author="ai", author_name="ИИ-ассистент поддержки", text="Уточните: недавно менялась ваша команда или проект в Gitverse? И название репозитория.", created_at="2026-09-11T15:39:20+03:00"),
    dict(id="msg-8", session_id="sess-40518", ticket_id="TSK-40518", author="employee", author_name="Анна Светлова", text="Да, перевели в команду «Эквайринг мобильный». Репозиторий acquiring-mobile-core.", created_at="2026-09-11T15:40:00+03:00"),
    dict(id="msg-9", session_id="sess-40518", ticket_id="TSK-40518", author="operator", author_name="Оператор поддержки", text="Анна, передал запрос администраторам Gitverse на пересинхронизацию прав. Ожидаемое время — до 2 часов.", created_at="2026-09-11T16:25:00+03:00"),
    dict(id="msg-10", session_id="sess-40518", ticket_id="TSK-40518", author="employee", author_name="Анна Светлова", text="Спасибо, буду ждать! Очень боюсь не успеть до релиза.", created_at="2026-09-11T16:30:00+03:00"),
    dict(id="msg-11", session_id="sess-40509", ticket_id="TSK-40509", author="employee", author_name="Игорь Панфилов", text="срочно нужна замена монитора, пошли полосы через весь экран.", created_at="2026-09-11T10:19:00+03:00"),
    dict(id="msg-12", session_id="sess-40509", ticket_id="TSK-40509", author="ai", author_name="ИИ-ассистент поддержки", text="Подскажите инвентарный номер монитора и ваш отдел.", created_at="2026-09-11T10:19:20+03:00"),
    dict(id="msg-13", session_id="sess-40509", ticket_id="TSK-40509", author="employee", author_name="Игорь Панфилов", text="Инвентарный номер INV-885241, отдел нагрузочного тестирования.", created_at="2026-09-11T10:20:00+03:00"),
    dict(id="msg-14", session_id="sess-40509", ticket_id="TSK-40509", author="operator", author_name="Оператор поддержки", text="Игорь, заявка эскалирована в АХО как критическая. Резервный монитор зарезервирован, ожидаем курьера до 14:00.", created_at="2026-09-12T08:55:00+03:00"),
    dict(id="msg-15", session_id="sess-40495", ticket_id="TSK-40495", author="employee", author_name="Мария Левитина", text="Меня перевели в проект, нужно перенести рабочее место.", created_at="2026-09-08T13:04:00+03:00"),
    dict(id="msg-16", session_id="sess-40495", ticket_id="TSK-40495", author="ai", author_name="ИИ-ассистент поддержки", text="Уточните: на какой этаж и какое оборудование нужно перевезти?", created_at="2026-09-08T13:04:20+03:00"),
    dict(id="msg-17", session_id="sess-40495", ticket_id="TSK-40495", author="employee", author_name="Мария Левитина", text="На 7 этаж. Компьютер, два монитора, док-станция, тумбочка.", created_at="2026-09-08T13:05:00+03:00"),
    dict(id="msg-18", session_id="sess-40495", ticket_id="TSK-40495", author="operator", author_name="Оператор поддержки", text="Мария, перенос согласован с АХО на пятницу, 18:30. Всё оборудование перенесёт техник.", created_at="2026-09-09T11:00:00+03:00"),
    dict(id="msg-19", session_id="sess-40495", ticket_id="TSK-40495", author="employee", author_name="Мария Левитина", text="Отлично, подходит! Спасибо за оперативность.", created_at="2026-09-09T11:05:00+03:00"),
    dict(id="msg-20", session_id="sess-40495", ticket_id="TSK-40495", author="system", author_name="Система", text="Обращение закрыто со статусом «Решено».", created_at="2026-09-10T17:30:00+03:00"),
]


def run_seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        created_sessions = 0
        for row in SESSIONS:
            if not db.query(ChatSessionORM).filter(ChatSessionORM.id == row["id"]).first():
                db.add(ChatSessionORM(**row))
                created_sessions += 1
        db.commit()

        created_tickets = 0
        for row in TICKETS:
            if not db.query(TicketORM).filter(TicketORM.id == row["id"]).first():
                db.add(TicketORM(**row))
                created_tickets += 1
        db.commit()

        created_messages = 0
        for row in MESSAGES:
            if not db.query(MessageORM).filter(MessageORM.id == row["id"]).first():
                db.add(MessageORM(**row))
                created_messages += 1
        db.commit()

        print(
            f"Готово. Добавлено: сессий — {created_sessions}, тикетов — {created_tickets}, "
            f"сообщений — {created_messages}."
        )
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
