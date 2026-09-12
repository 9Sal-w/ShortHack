import { useEffect, useMemo, useState } from 'react';
import type { Ticket } from './types';
import { fetchTickets } from './api';
import TicketList from './TicketList';
import TicketDetails from './TicketDetails';
import ChatPanel from './ChatPanel';
import { MOCK_TICKETS } from './mockData';

interface DashboardProps {
  operatorName: string;
  onLogout: () => void;
}

export default function Dashboard({ operatorName, onLogout }: DashboardProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // Реальный/fallback-запрос: GET /api/tickets
      const data = await fetchTickets();
      if (cancelled) return;
      setTickets(data);
      setIsOffline(JSON.stringify(data) === JSON.stringify(MOCK_TICKETS));
      setSelectedTicketId((current) => current ?? data[0]?.id ?? null);
      setIsLoading(false);
    }

    setIsLoading(true);
    load();

    // Периодически обновляем список тикетов — чтобы новые обращения,
    // созданные ИИ-агентом из чата сотрудника, появлялись автоматически.
    const pollId = window.setInterval(load, 6000);
    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, []);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId],
  );

  function handleTicketUpdated(updated: Ticket) {
    setTickets((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-left">
          <span className="topbar-title">СберТех · Рабочее место оператора ИИ-поддержки</span>
          <span className="topbar-badge">ВНУТРЕННЕЕ ИСПОЛЬЗОВАНИЕ</span>
        </div>
        <div className="topbar-right">
          <span>{operatorName}</span>
          <button className="topbar-logout" onClick={onLogout}>
            Выйти
          </button>
        </div>
      </div>

      {isOffline && (
        <div className="offline-banner">
          ⚠ Backend недоступен — приложение работает в mock-режиме на встроенных тестовых данных. Настройте Nginx Proxy для подключения к реальному серверу.
        </div>
      )}

      <div className="dashboard-grid">
        <TicketList
          tickets={tickets}
          selectedTicketId={selectedTicketId}
          onSelect={setSelectedTicketId}
          isLoading={isLoading}
        />
        <TicketDetails ticket={selectedTicket} />
        <ChatPanel ticket={selectedTicket} onTicketUpdated={handleTicketUpdated} />
      </div>
    </div>
  );
}
