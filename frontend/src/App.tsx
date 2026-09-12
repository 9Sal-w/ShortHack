import { useState } from 'react';
import LoginPage from './LoginPage';
import Dashboard from './Dashboard';
import SubmitTicketPage from './SubmitTicketPage';

/**
 * Простой роутинг без внешних библиотек, основанный на пути в адресной строке:
 *  - "/submit"  -> публичный чат для сотрудников (создание обращения через ИИ-агента)
 *  - любой другой путь -> вход/дашборд оператора поддержки
 */
type View = 'operator' | 'submit';

function getInitialView(): View {
  return window.location.pathname.startsWith('/submit') ? 'submit' : 'operator';
}

export default function App() {
  const [view, setView] = useState<View>(getInitialView());
  const [operatorName, setOperatorName] = useState<string | null>(() =>
    localStorage.getItem('sbertech_auth_token') ? localStorage.getItem('sbertech_operator_name') : null,
  );

  function handleLoginSuccess(name: string) {
    localStorage.setItem('sbertech_operator_name', name);
    setOperatorName(name);
  }

  function handleLogout() {
    localStorage.removeItem('sbertech_auth_token');
    localStorage.removeItem('sbertech_operator_name');
    setOperatorName(null);
  }

  function goToSubmitView() {
    window.history.pushState({}, '', '/submit');
    setView('submit');
  }

  function goToOperatorView() {
    window.history.pushState({}, '', '/');
    setView('operator');
  }

  if (view === 'submit') {
    return <SubmitTicketPage onBackToOperator={goToOperatorView} />;
  }

  if (!operatorName) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} onGoToSubmitPage={goToSubmitView} />;
  }

  return <Dashboard operatorName={operatorName} onLogout={handleLogout} />;
}
