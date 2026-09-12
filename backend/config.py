"""
config.py
=========
Централизованная конфигурация backend'а. Все секреты (пароли, API-ключ
Yandex Cloud, строка подключения к БД) читаются ИСКЛЮЧИТЕЛЬНО из
переменных окружения (.env) — это обязательное требование безопасности
для внутреннего продукта СберТеха.
"""

from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ---- Сервер ----
    app_host: str = "0.0.0.0"
    app_port: int = 8080

    # ---- Аутентификация оператора ----
    jwt_secret: str = "change-me-to-a-long-random-secret-string"
    jwt_expire_minutes: int = 480
    jwt_algorithm: str = "HS256"

    operator_login: str = "admin"
    operator_password: str = "admin"
    operator_display_name: str = "Оператор поддержки"

    # ---- База данных ----
    database_url: str = "sqlite:///./sbertech_support.db"

    # ---- ИИ-провайдер: Yandex Cloud (YandexGPT) ----
    # "yandexgpt" | "mock"
    ai_provider: str = "mock"

    yandex_api_key: str = ""
    yandex_iam_token: str = ""
    yandex_folder_id: str = ""
    yandex_gpt_model: str = "yandexgpt-lite"
    yandex_intake_temperature: float = 0.2
    yandex_rewrite_temperature: float = 0.4

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


@lru_cache
def get_settings() -> Settings:
    return Settings()
