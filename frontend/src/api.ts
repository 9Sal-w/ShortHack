import axios, { AxiosError } from 'axios';
import type {
  AuthRequest,
  AuthResponse,
  ChatMessage,
  RewriteStyleRequest,
  RewriteStyleResponse,
  SendChatMessageRequest,
  SendChatMessageResponse,
  SendTicketMessageRequest,
  StartChatRequest,
  StartChatResponse,
  Ticket,
} from './types';
import { MOCK_TICKETS, MOCK_MESSAGES, localRewriteFallback, localIntakeFallback } from './mockData';

/**
 * =============================================================
 *  СЛОЙ ИНТЕГРАЦИИ С BACKEND (готов к работе через Nginx Proxy)
 * =============================================================
 * Все запросы идут по ОТНОСИТЕЛЬНЫМ путям ("/api/..."), без хоста и порта —
 * Nginx проксирует /api на реальный backend. baseURL НЕ задаётся намеренно.
 *
 * FALLBACK: каждая функция сначала пытается выполнить реальный HTTP-запрос.
 * При ошибке (backend/Nginx ещё не настроены) происходит откат на
 * встроенные mock-данные, чтобы интерфейс оставался работоспособным.
 *
 * ДВА ИИ-АГЕНТА НА BACKEND'Е:
 *  1. Intake-агент — ведёт диалог с сотрудником на /api/chat/*,
 *     уточняет детали и создаёт Ticket.
 *  2. Rewrite-агент — POST /api/rewrite-style, меняет стиль ответа оператора.
 */

const httpClient = axios.create({
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('sbertech_auth_token');
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function logFallback(endpoint: string, error: unknown): void {
  const message = error instanceof AxiosError ? error.message : String(error);
  // eslint-disable-next-line no-console
  console.warn(`[API FALLBACK] Backend недоступен для "${endpoint}" (${message}). Используются mock-данные.`);
}

/** POST /api/auth — авторизация оператора */
export async function authenticate(payload: AuthRequest): Promise<AuthResponse> {
  try {
    const { data } = await httpClient.post<AuthResponse>('/api/auth', payload);
    return data;
  } catch (error) {
    logFallback('/api/auth', error);
    if (payload.login === 'admin' && payload.password === 'admin') {
      return { token: 'mock-token-' + Date.now(), operator_name: 'Оператор (mock-режим)' };
    }
    throw new Error('Неверный логин или пароль');
  }
}

/** GET /api/tickets — список обращений для левой панели оператора */
export async function fetchTickets(): Promise<Ticket[]> {
  try {
    const { data } = await httpClient.get<Ticket[]>('/api/tickets');
    return data;
  } catch (error) {
    logFallback('/api/tickets', error);
    return getLocalTicketsStore();
  }
}

/**
 * POST /api/chat/start — сотрудник начинает новое обращение.
 * Backend создаёт chat-сессию и возвращает session_id + приветственное
 * сообщение ИИ-агента №1 (intake).
 */
export async function startChat(payload: StartChatRequest): Promise<StartChatResponse> {
  try {
    const { data } = await httpClient.post<StartChatResponse>('/api/chat/start', payload);
    return data;
  } catch (error) {
    logFallback('/api/chat/start', error);
    const sessionId = `local-sess-${Date.now()}`;
    const greeting: ChatMessage = {
      id: `local-msg-${Date.now()}`,
      session_id: sessionId,
      ticket_id: null,
      author: 'ai',
      author_name: 'ИИ-ассистент поддержки',
      text: `Здравствуйте, ${payload.employee_name}! Расскажите, что случилось — я задам уточняющие вопросы, если что-то будет неясно, и передам обращение оператору.`,
      created_at: new Date().toISOString(),
    };
    setLocalChatMessages(sessionId, [greeting]);
    return { session_id: sessionId, messages: [greeting] };
  }
}

/**
 * POST /api/chat/{session_id}/messages — сотрудник отправляет сообщение
 * ИИ-агенту №1. Агент либо задаёт уточняющий вопрос, либо (когда данных
 * достаточно) создаёт Ticket — с этого момента переписка продолжается
 * уже с оператором.
 */
export async function sendChatMessage(
  sessionId: string,
  payload: SendChatMessageRequest,
  employeeName: string,
  contact: string,
): Promise<SendChatMessageResponse> {
  try {
    const { data } = await httpClient.post<SendChatMessageResponse>(`/api/chat/${sessionId}/messages`, payload);
    return data;
  } catch (error) {
    logFallback(`/api/chat/${sessionId}/messages`, error);
    return localHandleChatMessage(sessionId, payload.text, employeeName, contact);
  }
}

/** GET /api/chat/{session_id}/messages — восстановление истории чата сотрудника при перезаходе */
export async function fetchChatMessages(sessionId: string): Promise<ChatMessage[]> {
  try {
    const { data } = await httpClient.get<ChatMessage[]>(`/api/chat/${sessionId}/messages`);
    return data;
  } catch (error) {
    logFallback(`/api/chat/${sessionId}/messages [GET]`, error);
    return getLocalChatMessages(sessionId);
  }
}

/** GET /api/tickets/{id}/messages — полная переписка по тикету (для оператора) */
export async function fetchTicketMessages(ticketId: string): Promise<ChatMessage[]> {
  try {
    const { data } = await httpClient.get<ChatMessage[]>(`/api/tickets/${ticketId}/messages`);
    return data;
  } catch (error) {
    logFallback(`/api/tickets/${ticketId}/messages`, error);
    const ticket = getLocalTicketsStore().find((t) => t.id === ticketId);
    return ticket ? getLocalChatMessages(ticket.session_id) : (MOCK_MESSAGES[ticketId] ?? []);
  }
}

/** POST /api/tickets/{id}/messages — оператор (или сотрудник) отправляет сообщение в переписку */
export async function sendTicketMessage(
  ticketId: string,
  payload: SendTicketMessageRequest,
): Promise<ChatMessage> {
  try {
    const { data } = await httpClient.post<ChatMessage>(`/api/tickets/${ticketId}/messages`, payload);
    return data;
  } catch (error) {
    logFallback(`/api/tickets/${ticketId}/messages [POST]`, error);
    const ticket = getLocalTicketsStore().find((t) => t.id === ticketId);
    const sessionId = ticket?.session_id ?? ticketId;
    const message: ChatMessage = {
      id: `local-msg-${Date.now()}`,
      session_id: sessionId,
      ticket_id: ticketId,
      author: payload.author,
      author_name: payload.author === 'operator' ? 'Оператор поддержки' : 'Сотрудник',
      text: payload.text,
      created_at: new Date().toISOString(),
    };
    const current = getLocalChatMessages(sessionId);
    setLocalChatMessages(sessionId, [...current, message]);
    updateLocalTicketStatus(ticketId, 'in_progress');
    return message;
  }
}

/** POST /api/rewrite-style — ИИ-агент №2, переформулировка стиля черновика ответа оператора */
export async function rewriteStyle(payload: RewriteStyleRequest): Promise<RewriteStyleResponse> {
  try {
    const { data } = await httpClient.post<RewriteStyleResponse>('/api/rewrite-style', payload);
    return data;
  } catch (error) {
    logFallback('/api/rewrite-style', error);
    return { rewritten_text: localRewriteFallback(payload.text, payload.level) };
  }
}

/**
 * =============================================================
 *  ЛОКАЛЬНОЕ ХРАНИЛИЩЕ MOCK-ДАННЫХ (только для fallback-режима)
 * =============================================================
 */
const TICKETS_STORE_KEY = 'sbertech_local_tickets_store';
const MESSAGES_STORE_PREFIX = 'sbertech_local_messages_';

function getLocalTicketsStore(): Ticket[] {
  try {
    const raw = sessionStorage.getItem(TICKETS_STORE_KEY);
    const extra: Ticket[] = raw ? JSON.parse(raw) : [];
    return [...extra, ...MOCK_TICKETS];
  } catch {
    return MOCK_TICKETS;
  }
}

function addTicketToLocalStore(ticket: Ticket): void {
  try {
    const raw = sessionStorage.getItem(TICKETS_STORE_KEY);
    const extra: Ticket[] = raw ? JSON.parse(raw) : [];
    sessionStorage.setItem(TICKETS_STORE_KEY, JSON.stringify([ticket, ...extra]));
  } catch {
    /* sessionStorage недоступен — молча игнорируем в mock-режиме */
  }
}

function updateLocalTicketStatus(ticketId: string, status: Ticket['status']): void {
  try {
    const raw = sessionStorage.getItem(TICKETS_STORE_KEY);
    const extra: Ticket[] = raw ? JSON.parse(raw) : [];
    const now = new Date().toISOString();
    const updatedExtra = extra.map((t) => (t.id === ticketId ? { ...t, status, updated_at: now } : t));
    sessionStorage.setItem(TICKETS_STORE_KEY, JSON.stringify(updatedExtra));
  } catch {
    /* игнорируем */
  }
}

function getLocalChatMessages(sessionId: string): ChatMessage[] {
  try {
    const raw = sessionStorage.getItem(MESSAGES_STORE_PREFIX + sessionId);
    if (raw) return JSON.parse(raw);
  } catch {
    /* игнорируем */
  }
  return MOCK_MESSAGES[sessionId] ?? [];
}

function setLocalChatMessages(sessionId: string, messages: ChatMessage[]): void {
  try {
    sessionStorage.setItem(MESSAGES_STORE_PREFIX + sessionId, JSON.stringify(messages));
  } catch {
    /* игнорируем */
  }
}

/**
 * Локальная имитация работы ИИ-агента №1 (intake), используется только
 * когда backend недоступен.
 */
function localHandleChatMessage(
  sessionId: string,
  text: string,
  employeeName: string,
  contact: string,
): SendChatMessageResponse {
  const history = getLocalChatMessages(sessionId);
  const now = new Date().toISOString();

  const employeeMessage: ChatMessage = {
    id: `local-msg-${Date.now()}`,
    session_id: sessionId,
    ticket_id: null,
    author: 'employee',
    author_name: employeeName,
    text,
    created_at: now,
  };

  const employeeTurns = history.filter((m) => m.author === 'employee').length + 1;
  const allEmployeeText = [...history.filter((m) => m.author === 'employee').map((m) => m.text), text].join(' ');

  const result = localIntakeFallback(allEmployeeText, employeeTurns);

  if (result.needsMoreInfo) {
    const aiMessage: ChatMessage = {
      id: `local-msg-${Date.now() + 1}`,
      session_id: sessionId,
      ticket_id: null,
      author: 'ai',
      author_name: 'ИИ-ассистент поддержки',
      text: result.question!,
      created_at: new Date().toISOString(),
    };
    setLocalChatMessages(sessionId, [...history, employeeMessage, aiMessage]);
    return { message: aiMessage, ticket: null };
  }

  const ticketId = `TSK-${Math.floor(40000 + Math.random() * 9999)}`;
  const newTicket: Ticket = {
    id: ticketId,
    summary: result.classification!.summary,
    category: result.classification!.category,
    priority: result.classification!.priority,
    status: 'new',
    raw_text: allEmployeeText,
    employee_name: employeeName,
    contact,
    session_id: sessionId,
    created_at: now,
    updated_at: now,
  };
  addTicketToLocalStore(newTicket);

  const systemMessage: ChatMessage = {
    id: `local-msg-${Date.now() + 1}`,
    session_id: sessionId,
    ticket_id: ticketId,
    author: 'system',
    author_name: 'Система',
    text: `Спасибо! Обращение принято и передано оператору поддержки, номер ${ticketId}.`,
    created_at: new Date().toISOString(),
  };

  const updatedHistory = [...history, employeeMessage].map((m) => ({ ...m, ticket_id: ticketId }));
  setLocalChatMessages(sessionId, [...updatedHistory, systemMessage]);

  return { message: systemMessage, ticket: newTicket };
}
