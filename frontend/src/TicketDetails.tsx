import type { Ticket } from './types';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from './types';

interface TicketDetailsProps {
  ticket: Ticket | null;
}

export default function TicketDetails({ ticket }: TicketDetailsProps) {
  if (!ticket) {
    return (
      <div className="panel panel-ticket-view">
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>🎫</div>
          <div>Выберите обращение из списка слева</div>
        </div>
      </div>
    );
  }

  const createdDate = new Date(ticket.created_at).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="panel panel-ticket-view">
      <div className="ticket-card">
        <div className="ticket-card-header">
          <div>
            <div className="ticket-card-id">{ticket.id}</div>
            <div className="ticket-card-employee">
              {ticket.employee_name} · {ticket.contact}
            </div>
          </div>
          <div className="ticket-card-employee">{createdDate}</div>
        </div>

        <div className="ticket-card-summary">{ticket.summary}</div>

        <div className="ticket-card-tags">
          <span className="tag tag-category">{CATEGORY_LABELS[ticket.category]}</span>
          <span className={`tag tag-priority-${ticket.priority}`}>
            Приоритет: {PRIORITY_LABELS[ticket.priority]}
          </span>
          <span className={`tag tag-status-${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
        </div>
      </div>

      <div className="raw-text-block">
        <h3>📝 Исходное описание проблемы</h3>
        <div className="raw-text-content">{ticket.raw_text}</div>
      </div>
    </div>
  );
}
