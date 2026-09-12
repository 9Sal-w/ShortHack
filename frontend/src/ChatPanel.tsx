import { useEffect, useRef, useState } from 'react';
import type { ChatMessage, RewriteLevel, Ticket } from './types';
import { fetchTicketMessages, rewriteStyle, sendTicketMessage } from './api';

interface ChatPanelProps {
  ticket: Ticket | null;
  onTicketUpdated: (updated: Ticket) => void;
}

const STYLE_BUTTONS: { level: RewriteLevel; emoji: string; label: string }[] = [
  { level: 1, emoji: '🤖', label: 'Робот' },
  { level: 3, emoji: '💼', label: 'Стандарт' },
  { level: 5, emoji: '❤️', label: 'Эмпатия' },
];

/**
 * Правая панель оператора — полноценная переписка с сотрудником
 * (та же переписка, что сотрудник ведёт на странице /submit, включая
 * предшествующий диалог с ИИ-агентом №1). Оператор пишет ответы в textarea,
 * может прогнать черновик через ИИ-агент №2 (переформулировка стиля),
 * затем отправляет — сообщение сразу появляется в чате обеих сторон.
 */
export default function ChatPanel({ ticket, onTicketUpdated }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isRewriting, setIsRewriting] = useState<RewriteLevel | null>(null);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!ticket) {
      setMessages([]);
      setDraft('');
      return;
    }
    let cancelled = false;
    setIsLoadingMessages(true);
    setDraft('');
    // Реальный/fallback-запрос: GET /api/tickets/{id}/messages
    fetchTicketMessages(ticket.id).then((data) => {
      if (!cancelled) {
        setMessages(data);
        setIsLoadingMessages(false);
      }
    });

    // Периодический опрос новых сообщений (в т.ч. от сотрудника),
    // чтобы оператор видел ответы без перезагрузки страницы.
    pollRef.current = window.setInterval(async () => {
      const fresh = await fetchTicketMessages(ticket.id);
      if (!cancelled) setMessages(fresh);
    }, 5000);

    return () => {
      cancelled = true;
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [ticket]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleStyleClick(level: RewriteLevel) {
    if (!draft.trim() || isRewriting) return;
    setIsRewriting(level);
    try {
      // Реальный/fallback-запрос: POST /api/rewrite-style (ИИ-агент №2)
      const response = await rewriteStyle({ text: draft, level });
      setDraft(response.rewritten_text);
    } finally {
      setIsRewriting(null);
    }
  }

  async function handleSend() {
    if (!ticket || !draft.trim() || isSending) return;
    setIsSending(true);
    try {
      // Реальный/fallback-запрос: POST /api/tickets/{id}/messages
      const newMessage = await sendTicketMessage(ticket.id, { text: draft, author: 'operator' });
      setMessages((prev) => [...prev, newMessage]);
      setDraft('');
      onTicketUpdated({ ...ticket, status: 'in_progress', updated_at: new Date().toISOString() });
    } finally {
      setIsSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  if (!ticket) {
    return (
      <div className="panel panel-chat">
        <div className="empty-state">
          <div style={{ fontSize: 32 }}>💬</div>
          <div>Переписка появится после выбора обращения</div>
        </div>
      </div>
    );
  }

  return (
    <div className="panel panel-chat">
      <div className="panel-header">
        <h2>Переписка</h2>
        <div className="panel-header-sub">{isLoadingMessages ? 'Загрузка истории...' : ticket.id}</div>
      </div>

      <div className="chat-messages">
        {messages.map((msg) => (
          <div key={msg.id} className={`chat-bubble chat-bubble-${msg.author}`}>
            {msg.author !== 'system' && <div className="chat-bubble-meta">{msg.author_name}</div>}
            <div>{msg.text}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-compose">
        <div className="style-buttons">
          {STYLE_BUTTONS.map((btn) => (
            <button
              key={btn.level}
              className="style-btn"
              disabled={isRewriting !== null || !draft.trim()}
              onClick={() => handleStyleClick(btn.level)}
              title={`Уровень ${btn.level}`}
            >
              {isRewriting === btn.level ? <span className="spinner" /> : <span className="emoji">{btn.emoji}</span>}
              <span>{btn.label}</span>
            </button>
          ))}
        </div>

        <div className="compose-textarea-wrap">
          <textarea
            className="compose-textarea"
            placeholder="Напишите ответ сотруднику..."
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isRewriting !== null}
          />
          {isRewriting !== null && (
            <div className="compose-loading-overlay">
              <span className="spinner spinner-lg" />
            </div>
          )}
        </div>

        <div className="send-row">
          <button className="send-btn" onClick={handleSend} disabled={isSending || !draft.trim()}>
            {isSending && <span className="spinner spinner-light" />}
            {isSending ? 'Отправка...' : 'Отправить'}
          </button>
        </div>
      </div>
    </div>
  );
}
