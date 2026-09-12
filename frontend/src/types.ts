// Единые типы данных для всего приложения.
// Формат строго соответствует ожидаемому JSON от backend'а (см. backend/schemas.py),
// чтобы при подключении Nginx Proxy не требовалось менять модели данных.

export type TicketCategory =
  | 'wifi'
  | 'accounts'
  | 'hardware'
  | 'software'
  | 'organization'
  | 'gitverse'
  | 'other';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

/**
 * "new"         — тикет создан, оператор ещё не отвечал
 * "in_progress" — оператор взял в работу / уже отвечал хотя бы раз
 * "resolved"    — обращение закрыто
 */
export type TicketStatus = 'new' | 'in_progress' | 'resolved';

export type RewriteLevel = 1 | 3 | 5;

/** Автор сообщения в единой переписке по обращению */
export type MessageAuthor = 'employee' | 'operator' | 'ai' | 'system';

/** Основная структура тикета, как её отдаёт GET /api/tickets */
export interface Ticket {
  id: string;
  /** Суть обращения, сгенерированная ИИ-агентом-приёмщиком */
  summary: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  /** Исходный текст, с которого сотрудник начал обращение (вся переписка с ИИ) */
  raw_text: string;
  employee_name: string;
  /** Контакт для связи: телефон, email или корп. мессенджер */
  contact: string;
  /** ID чат-сессии сотрудника — связывает Ticket с историей переписки */
  session_id: string;
  created_at: string; // ISO-строка
  updated_at: string; // ISO-строка
}

/** Сообщение в единой переписке (видно и сотруднику, и оператору) */
export interface ChatMessage {
  id: string;
  session_id: string;
  ticket_id: string | null; // null, пока тикет ещё не создан ИИ-агентом
  author: MessageAuthor;
  author_name: string;
  text: string;
  created_at: string; // ISO-строка
}

/** Тело запроса POST /api/chat/start */
export interface StartChatRequest {
  employee_name: string;
  contact: string;
}

export interface StartChatResponse {
  session_id: string;
  messages: ChatMessage[];
}

/** Тело запроса POST /api/chat/{session_id}/messages — сообщение сотрудника ИИ-агенту №1 */
export interface SendChatMessageRequest {
  text: string;
}

/**
 * Ответ ИИ-агента №1 (intake) на сообщение сотрудника.
 * Если ticket = null — агент задал уточняющий вопрос (смотри message).
 * Если ticket заполнен — данных достаточно, тикет создан и ушёл оператору.
 */
export interface SendChatMessageResponse {
  message: ChatMessage;
  ticket: Ticket | null;
}

/** Тело запроса POST /api/tickets/{id}/messages — сообщение оператора (или сотрудника) в тикет */
export interface SendTicketMessageRequest {
  text: string;
  author: MessageAuthor;
}

/** Тело запроса POST /api/rewrite-style — ИИ-агент №2 */
export interface RewriteStyleRequest {
  text: string;
  level: RewriteLevel;
}

export interface RewriteStyleResponse {
  rewritten_text: string;
}

/** Тело запроса POST /api/auth */
export interface AuthRequest {
  login: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  operator_name: string;
}

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  wifi: 'Wi-Fi',
  accounts: 'Учётные записи',
  hardware: 'Оборудование',
  software: 'Программное обеспечение',
  organization: 'Организационные вопросы',
  gitverse: 'Gitverse',
  other: 'Другое',
};

export const PRIORITY_LABELS: Record<TicketPriority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  critical: 'Критический',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'Новое',
  in_progress: 'В обработке',
  resolved: 'Решено',
};
