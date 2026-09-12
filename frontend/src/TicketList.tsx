import type { Ticket } from './types';
import { CATEGORY_LABELS, PRIORITY_LABELS, STATUS_LABELS } from './types';

interface TicketListProps {
  tickets: Ticket[];
  selectedTicketId: string | null;
  onSelect: (ticketId: string) => void;
  isLoading: boolean;
}

export default function TicketList({ tickets, selectedTicketId, onSelect, isLoading }: TicketListProps) {
  return (
    <div className="panel panel-tickets">
      <div className="panel-header">
        <h2>Обращения</h2>
        <div className="panel-header-sub">
          {isLoading ? 'Обновление списка...' : `Всего в очереди: ${tickets.length}`}
        </div>
      </div>
      <div className="ticket-list">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className={`ticket-item ${ticket.id === selectedTicketId ? 'active' : ''}`}
            onClick={() => onSelect(ticket.id)}
          >
            <div className="ticket-item-top">
              <span className="ticket-id">{ticket.id}</span>
              <span className={`tag tag-status-${ticket.status}`}>{STATUS_LABELS[ticket.status]}</span>
            </div>
            <div className="ticket-summary">{ticket.summary}</div>
            <div className="ticket-tags">
              <span className="tag tag-category">{CATEGORY_LABELS[ticket.category]}</span>
              <span className={`tag tag-priority-${ticket.priority}`}>{PRIORITY_LABELS[ticket.priority]}</span>
            </div>
          </div>
        ))}
        {tickets.length === 0 && !isLoading && (
          <div style={{ padding: 20, fontSize: 13, color: '#4a5568' }}>Обращений нет.</div>
        )}
      </div>
    </div>
  );
}
