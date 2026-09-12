import { useEffect, useRef, useState } from 'react';
import { fetchChatMessages, sendChatMessage, startChat } from './api';
import type { ChatMessage, Ticket } from './types';

interface SubmitTicketPageProps {
  onBackToOperator: () => void;
}

type Stage = 'intro' | 'chat';

/**
 * Публичная страница сотрудника СберТеха. Работает как чат с ИИ-агентом
 * №1 (intake): сотрудник описывает проблему, агент уточняет детали, если
 * их не хватает, а когда данных достаточно — создаёт Ticket и с этого
 * момента в тот же чат подключается оператор поддержки (сотрудник видит
 * его сообщения и может отвечать здесь же, без создания нового обращения).
 */
export default function SubmitTicketPage({ onBackToOperator }: SubmitTicketPageProps) {
  const [stage, setStage] = useState<Stage>('intro');
  const [employeeName, setEmployeeName] = useState('');
  const [contact, setContact] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [draft, setDraft] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Пока обращение уже создано (ticket !== null), периодически подтягиваем
  // историю чата — чтобы сотрудник увидел новые сообщения оператора без
  // необходимости обновлять страницу.
  useEffect(() => {
    if (!sessionId || !ticket) return;
    pollRef.current = window.setInterval(async () => {
      const fresh = await fetchChatMessages(sessionId);
      setMessages(fresh);
    }, 5000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [sessionId, ticket]);

  async function handleStart(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeName.trim() || !contact.trim()) return;
    setIsStarting(true);
    setError(null);
    try {
      // Реальный/fallback-запрос: POST /api/chat/start
      const response = await startChat({ employee_name: employeeName, contact });
      setSessionId(response.session_id);
      setMessages(response.messages);
      setStage('chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось начать обращение. Попробуйте ещё раз.');
    } finally {
      setIsStarting(false);
    }
  }

  async function handleSend() {
    if (!sessionId || !draft.trim() || isSending) return;
    setIsSending(true);
    setError(null);
    const textToSend = draft;
    setDraft('');
    try {
      // Реальный/fallback-запрос: POST /api/chat/{session_id}/messages
      const response = await sendChatMessage(sessionId, { text: textToSend }, employeeName, contact);
      setMessages((prev) => [...prev, response.message]);
      if (response.ticket) {
        setTicket(response.ticket);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить сообщение.');
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

  if (stage === 'intro') {
    return (
      <div className="submit-page">
        <div className="submit-topbar">
          <div className="topbar-left">
            <span className="topbar-title">СберТех · Служба поддержки сотрудников</span>
          </div>
          <button className="topbar-logout" onClick={onBackToOperator}>
            Вход для операторов
          </button>
        </div>

        <div className="submit-container">
          <div className="submit-card">
            <h1 className="submit-heading">Обращение в поддержку</h1>
            <p className="submit-subheading">
              Наш ИИ-ассистент задаст несколько уточняющих вопросов, если понадобится, а затем передаст
              обращение оператору. Переписка продолжится в этом же окне.
            </p>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleStart}>
              <div className="submit-row">
                <div className="login-field">
                  <label htmlFor="employeeName">Ваше имя</label>
                  <input
                    id="employeeName"
                    type="text"
                    value={employeeName}
                    onChange={(e) => setEmployeeName(e.target.value)}
                    placeholder="Иванов Иван"
                    required
                  />
                </div>
                <div className="login-field">
                  <label htmlFor="contact">Контакт для связи</label>
                  <input
                    id="contact"
                    type="text"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="Телефон, email или логин в мессенджере"
                    required
                  />
                </div>
              </div>

              <button type="submit" className="login-submit" disabled={isStarting}>
                {isStarting && <span className="spinner spinner-light" />}
                {isStarting ? 'Открываем чат...' : 'Начать обращение'}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="submit-page">
      <div className="submit-topbar">
        <div className="topbar-left">
          <span className="topbar-title">СберТех · Служба поддержки сотрудников</span>
        </div>
        <button className="topbar-logout" onClick={onBackToOperator}>
          Вход для операторов
        </button>
      </div>

      <div className="submit-chat-container">
        <div className="submit-chat-card">
          <div className="submit-chat-header">
            <div>
              <div className="submit-chat-header-title">
                {ticket ? `Обращение ${ticket.id}` : 'Чат с ИИ-ассистентом поддержки'}
              </div>
              <div className="submit-chat-header-sub">
                {ticket ? 'Переписка с оператором поддержки' : 'Отвечает ИИ-ассистент, который уточнит детали'}
              </div>
            </div>
            {ticket && <span className="tag tag-status-in_progress">Передано оператору</span>}
          </div>

          <div className="chat-messages submit-chat-messages">
            {messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble chat-bubble-${msg.author}`}>
                {msg.author !== 'system' && <div className="chat-bubble-meta">{msg.author_name}</div>}
                <div>{msg.text}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {error && <div className="login-error" style={{ margin: '0 16px' }}>{error}</div>}

          <div className="chat-compose">
            <div className="compose-textarea-wrap">
              <textarea
                className="compose-textarea"
                placeholder="Напишите сообщение..."
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending}
              />
            </div>
            <div className="send-row">
              <button className="send-btn" onClick={handleSend} disabled={isSending || !draft.trim()}>
                {isSending && <span className="spinner spinner-light" />}
                {isSending ? 'Отправка...' : 'Отправить'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
