"""
ai_client.py
============
Интеграция с двумя ИИ-агентами через Yandex Cloud (YandexGPT,
Foundation Models API). Оба агента используют одну и ту же функцию
низкоуровневого вызова _call_yandexgpt(), но с РАЗНЫМИ системными
промптами и разной температурой генерации — это и есть "два агента"
в понимании этого приложения: не два отдельных сервиса, а два разных
режима работы одной и той же модели, разделённых на уровне промптов.

  АГЕНТ №1 — INTAKE (приёмщик обращений): intake_agent_step()
  АГЕНТ №2 — REWRITE (переформулировка стиля ответа): rewrite_style()

FALLBACK: если Yandex Cloud недоступен (сеть, неверный ключ, лимиты)
или вернул ответ, который не удаётся разобрать, обе функции откатываются
на локальную логику без сети.
"""

import json
import re
import uuid
from typing import Optional

import httpx

from config import get_settings

settings = get_settings()

YANDEX_GPT_URL = "https://llm.api.cloud.yandex.net/foundationModels/v1/completion"


def _auth_header() -> dict:
    """
    Yandex Cloud поддерживает два способа авторизации запроса:
      - статический API-ключ:  "Authorization: Api-Key <key>"
      - временный IAM-токен:   "Authorization: Bearer <token>"
    Для сервера рекомендуется API-ключ — он не истекает за 12 часов.
    """
    if settings.yandex_api_key:
        return {"Authorization": f"Api-Key {settings.yandex_api_key}"}
    if settings.yandex_iam_token:
        return {"Authorization": f"Bearer {settings.yandex_iam_token}"}
    raise RuntimeError("Не задан ни YANDEX_API_KEY, ни YANDEX_IAM_TOKEN в .env")


def _call_yandexgpt(system_prompt: str, user_prompt: str, temperature: float) -> Optional[str]:
    """Низкоуровневый вызов YandexGPT completion API."""
    if settings.ai_provider == "mock":
        return None

    try:
        response = httpx.post(
            YANDEX_GPT_URL,
            headers={
                **_auth_header(),
                "Content-Type": "application/json",
                "x-request-id": str(uuid.uuid4()),
            },
            json={
                "modelUri": f"gpt://{settings.yandex_folder_id}/{settings.yandex_gpt_model}",
                "completionOptions": {
                    "stream": False,
                    "temperature": temperature,
                    "maxTokens": 800,
                },
                "messages": [
                    {"role": "system", "text": system_prompt},
                    {"role": "user", "text": user_prompt},
                ],
            },
            timeout=30.0,
        )
        response.raise_for_status()
        data = response.json()
        return data["result"]["alternatives"][0]["message"]["text"]
    except Exception as exc:  # noqa: BLE001 — намеренно широкий перехват для fallback
        print(f"[AI FALLBACK] Ошибка вызова YandexGPT: {exc}")
        return None


def _safe_parse_json(text: str) -> Optional[dict]:
    """YandexGPT иногда оборачивает JSON в ```json ... ``` — вырезаем перед парсингом."""
    cleaned = re.sub(r"^```(json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        return None


# =============================================================
# АГЕНТ №1 — INTAKE (приёмщик обращений)
# =============================================================

INTAKE_SYSTEM_PROMPT = """\
Ты — ИИ-ассистент службы техподдержки СберТеха. Общаешься с сотрудником \
компании, который описывает свою техническую или организационную проблему. \
Твоя задача — за минимальное число шагов собрать достаточно информации, \
чтобы оператор поддержки мог сразу приступить к решению, не переспрашивая \
базовые вещи.

Правила:
1. Если в сообщениях сотрудника НЕ хватает важных деталей (например, не ясно \
   когда началась проблема, на каком устройстве/месте, что уже пробовали \
   сделать, что именно не работает) — задай ОДИН короткий уточняющий вопрос. \
   Верни строго JSON: {"action": "ask", "question": "текст вопроса на русском"}
2. Если информации уже достаточно для передачи оператору — верни строго JSON:
   {
     "action": "create_ticket",
     "summary": "краткая суть обращения одним-двумя предложениями",
     "category": "одно из: wifi, accounts, hardware, software, organization, gitverse, other",
     "priority": "одно из: low, medium, high, critical"
   }
   Приоритет critical — заблокирована работа многих людей или угроза аварии/срыва релиза.
   high — у сотрудника сорван срочный дедлайн сегодня.
   medium — обычная проблема без острой срочности.
   low — организационный вопрос, не мешающий работать прямо сейчас.
3. Не задавай больше 2 уточняющих вопросов подряд — если после второго уточнения \
   всё ещё не хватает деталей, всё равно создай тикет с той информацией, что есть.
4. Отвечай ТОЛЬКО валидным JSON без markdown-разметки и пояснений вне JSON.
5. Будь вежливым и лаконичным, обращайся на "вы".
"""


def intake_agent_step(conversation_text: str, employee_turns: int) -> dict:
    """
    conversation_text — вся переписка сотрудника с агентом до текущего момента.
    employee_turns — сколько раз сотрудник уже написал сообщение в этой сессии
    (используется для локального fallback-порога "хватит уточнять").

    Возвращает dict одного из двух видов:
      {"action": "ask", "question": "..."}
      {"action": "create_ticket", "summary": "...", "category": "...", "priority": "..."}
    """
    llm_output = _call_yandexgpt(
        INTAKE_SYSTEM_PROMPT, conversation_text, settings.yandex_intake_temperature
    )
    if llm_output:
        parsed = _safe_parse_json(llm_output)
        if parsed and parsed.get("action") in ("ask", "create_ticket"):
            return parsed
        print("[AI FALLBACK] Ответ агента-приёмщика не распознан как валидный JSON.")

    return _local_intake_fallback(conversation_text, employee_turns)


def _local_intake_fallback(conversation_text: str, employee_turns: int) -> dict:
    """Локальная имитация агента №1 без сети — по длине текста и ключевым словам."""
    text = conversation_text.lower()
    has_enough_detail = len(conversation_text) > 60 or employee_turns >= 2

    if not has_enough_detail:
        return {
            "action": "ask",
            "question": (
                "Уточните, пожалуйста, подробнее: когда началась проблема и "
                "на каком устройстве или рабочем месте это происходит?"
            ),
        }

    category = "other"
    if re.search(r"wi-?fi|вай\s?фай|сеть|vpn|сертификат", text):
        category = "wifi"
    elif re.search(r"gitverse|гитверс|репозитори|push|коммит|ssh", text):
        category = "gitverse"
    elif re.search(r"пароль|логин|учетк|учётк|доступ к аккаунту|заблокирован", text):
        category = "accounts"
    elif re.search(r"монитор|ноутбук|компьютер|мышь|клавиатур|принтер|железо", text):
        category = "hardware"
    elif re.search(r"программ|приложени|софт|1с|excel|word|установ", text):
        category = "software"
    elif re.search(r"перенос|кабинет|этаж|стол|организац|перевод в проект", text):
        category = "organization"

    priority = "medium"
    if re.search(r"срочно|критично|немедленно|горит|невозможно работать|сегодня", text):
        priority = "high"
    if re.search(r"аварийно|полностью не работает|критическ|блокирует релиз|весь отдел", text):
        priority = "critical"
    if re.search(r"когда будет время|не срочно|как удобно|без спешки", text):
        priority = "low"

    trimmed = re.sub(r"\s+", " ", conversation_text.strip())
    summary = (trimmed[:140] + "…") if len(trimmed) > 140 else trimmed

    return {"action": "create_ticket", "summary": summary, "category": category, "priority": priority}


# =============================================================
# АГЕНТ №2 — REWRITE (переформулировка стиля ответа оператора)
# =============================================================

REWRITE_SYSTEM_PROMPTS = {
    1: (
        "Ты — ИИ-редактор техподдержки СберТеха. Перепиши текст ответа оператора "
        "в виде сухой, формальной пошаговой инструкции без эмоций и вежливых "
        "оборотов. Используй нумерованный список конкретных действий. "
        "Отвечай только переписанным текстом на русском языке, без пояснений и без markdown."
    ),
    3: (
        "Ты — ИИ-редактор техподдержки СберТеха. Перепиши текст ответа оператора "
        "в вежливом, стандартном корпоративном стиле компании СберТех: обращение "
        "на «вы», деловой нейтральный тон, без излишней эмоциональности. "
        "Отвечай только переписанным текстом на русском языке, без пояснений и без markdown."
    ),
    5: (
        "Ты — ИИ-редактор техподдержки СберТеха. Перепиши текст ответа оператора "
        "в тёплом, клиентоцентричном и эмпатичном тоне: прояви понимание "
        "неудобств сотрудника, поддержи его, сохранив всю фактическую суть ответа. "
        "Отвечай только переписанным текстом на русском языке, без пояснений и без markdown."
    ),
}


def rewrite_style(text: str, level: int) -> str:
    """
    Переформулирует черновик ответа оператора в одном из трёх стилей.
    При недоступности ИИ — локальный fallback-шаблон.
    """
    system_prompt = REWRITE_SYSTEM_PROMPTS.get(level, REWRITE_SYSTEM_PROMPTS[3])
    llm_output = _call_yandexgpt(system_prompt, text, settings.yandex_rewrite_temperature)
    if llm_output:
        return llm_output.strip()
    return _local_rewrite_fallback(text, level)


def _local_rewrite_fallback(text: str, level: int) -> str:
    core = text.strip() or "необходимо выполнить указанные действия"

    if level == 1:
        return (
            f"Инструкция:\n1. Выполните: {core}.\n2. Нажмите «Применить».\n"
            f"3. Дождитесь подтверждения системы.\nПри ошибке — повторите шаги заново."
        )
    if level == 5:
        return (
            "Понимаем, как неприятно столкнуться с такой ситуацией, и искренне "
            f"сочувствуем неудобствам. Мы уже занимаемся вашим вопросом: {core}. "
            "Будем держать вас в курсе на каждом шаге и сделаем всё возможное, "
            "чтобы решить проблему как можно скорее."
        )
    return (
        f"Добрый день! Спасибо за обращение. Сообщаем, что по вашему вопросу "
        f"выполняется следующее: {core}. Мы уведомим вас об изменении статуса "
        f"заявки. С уважением, служба поддержки СберТех."
    )
