"""
auth.py
=======
Простая JWT-аутентификация оператора. Логин/пароль сверяются со
значениями из .env. Для продакшн-развёртывания в СберТехе замените
verify_credentials() на вызов корпоративного LDAP/AD/SSO — остальной
код (выпуск и проверка JWT) менять не потребуется.
"""

from datetime import datetime, timedelta, timezone

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import jwt, JWTError

from config import get_settings

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


def verify_credentials(login: str, password: str) -> bool:
    """TODO(продакшн): заменить на запрос к LDAP/AD/SSO СберТеха."""
    return login == settings.operator_login and password == settings.operator_password


def create_access_token(operator_name: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": operator_name, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_operator(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """FastAPI dependency для защиты роутов оператора JWT-токеном."""
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Токен не предоставлен")
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
        return payload["sub"]
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Недействительный или истёкший токен")
