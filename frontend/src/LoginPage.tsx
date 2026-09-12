import { useState } from 'react';
import { authenticate } from './api';

interface LoginPageProps {
  onLoginSuccess: (operatorName: string) => void;
  onGoToSubmitPage: () => void;
}

export default function LoginPage({ onLoginSuccess, onGoToSubmitPage }: LoginPageProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      // Реальный/fallback-запрос: POST /api/auth
      const response = await authenticate({ login, password });
      localStorage.setItem('sbertech_auth_token', response.token);
      onLoginSuccess(response.operator_name);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка авторизации');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-logo-mark">С</div>
          <div className="login-logo-text">СберТех</div>
        </div>
        <div className="login-subtitle">Рабочее место оператора ИИ-поддержки</div>

        {error && <div className="login-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="login-field">
            <label htmlFor="login">Логин</label>
            <input
              id="login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Введите логин"
              autoComplete="username"
              required
            />
          </div>
          <div className="login-field">
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="login-submit" disabled={isLoading}>
            {isLoading && <span className="spinner spinner-light" />}
            {isLoading ? 'Проверка...' : 'Войти'}
          </button>
        </form>

        <div className="login-hint">
          Mock-режим (без backend): логин <strong>admin</strong> / пароль <strong>admin</strong>
        </div>

        <button className="login-link-btn" onClick={onGoToSubmitPage} type="button">
          Я сотрудник — хочу оставить обращение →
        </button>
      </div>
    </div>
  );
}
