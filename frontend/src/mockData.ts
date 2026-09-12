import type { ChatMessage, Ticket, TicketCategory, TicketPriority } from './types';

/**
 * Встроенные mock-данные. Используются исключительно как fallback,
 * когда реальный backend (через Nginx Proxy) недоступен.
 * Формат полностью совпадает с ответом GET /api/tickets и
 * GET /api/tickets/{id}/messages, поэтому переключение на реальный
 * API не требует изменений в UI-слое.
 */
export const MOCK_TICKETS: Ticket[] = [
  {
    id: 'TSK-40521',
    summary:
      'Не удаётся авторизоваться в корпоративной Wi-Fi сети SberCorp-Secure на новом рабочем ноутбуке — сертификат не принимается.',
    category: 'wifi',
    priority: 'high',
    status: 'new',
    raw_text:
      'здравствуйте! короче у меня беда, вай фай в офисе не пускает, вводишь логин от учетки как обычно а он такой "не удалось проверить сертификат сети" и все, крутится колесико и потом отваливается.',
    employee_name: 'Дмитрий Ковалёв',
    contact: '+7 (900) 123-45-67',
    session_id: 'sess-40521',
    created_at: '2026-09-12T07:12:00+03:00',
    updated_at: '2026-09-12T07:20:00+03:00',
  },
  {
    id: 'TSK-40518',
    summary:
      'Проблема с доступом к репозиторию в Gitverse: push отклоняется с ошибкой прав доступа после смены команды в проекте.',
    category: 'gitverse',
    priority: 'medium',
    status: 'in_progress',
    raw_text:
      'приветствую тех поддержку. Пишу по гитверс, у нас перевели меня на прошлой неделе в другую команду и теперь я не могу запушить свои коммиты, вылетает permission denied (publickey).',
    employee_name: 'Анна Светлова',
    contact: 'a.svetlova@sbertech.internal',
    session_id: 'sess-40518',
    created_at: '2026-09-11T15:40:00+03:00',
    updated_at: '2026-09-12T09:05:00+03:00',
  },
  {
    id: 'TSK-40509',
    summary:
      'Заявка на замену монитора инженера: экран мигает и появляются горизонтальные полосы, работа невозможна.',
    category: 'hardware',
    priority: 'critical',
    status: 'in_progress',
    raw_text:
      'добрый день срочно нужна замена монитора. Уже второй день монитор моргает как неисправная лампа, а сегодня вообще пошли полосы через весь экран.',
    employee_name: 'Игорь Панфилов',
    contact: '+7 (901) 555-20-14',
    session_id: 'sess-40509',
    created_at: '2026-09-11T10:20:00+03:00',
    updated_at: '2026-09-12T08:55:00+03:00',
  },
  {
    id: 'TSK-40495',
    summary:
      'Сотрудник просит организовать перенос рабочего места на другой этаж в связи с переходом в новый проектный офис.',
    category: 'organization',
    priority: 'low',
    status: 'resolved',
    raw_text:
      'Здравствуйте. Меня перевели в проект "Цифровой ассистент 2.0" и сказали что там места на 7 этаже, а я сейчас сижу на 4 этаже в закрытом кабинете. Нужно перенести моё рабочее место.',
    employee_name: 'Мария Левитина',
    contact: 'm.levitina@sbertech.internal',
    session_id: 'sess-40495',
    created_at: '2026-09-08T13:05:00+03:00',
    updated_at: '2026-09-10T17:30:00+03:00',
  },
];

/**
 * Полная переписка по каждому тикету: сначала диалог сотрудника с
 * ИИ-агентом-приёмщиком (author: "employee" / "ai"), затем сообщения
 * оператора (author: "operator"). Ключ словаря — session_id.
 */
export const MOCK_MESSAGES: Record<string, ChatMessage[]> = {
  'sess-40521': [
    {
      id: 'msg-1',
      session_id: 'sess-40521',
      ticket_id: 'TSK-40521',
      author: 'employee',
      author_name: 'Дмитрий Ковалёв',
      text: 'здравствуйте! короче у меня беда, вай фай в офисе не пускает, вводишь логин от учетки как обычно а он такой "не удалось проверить сертификат сети" и все, крутится колесико и потом отваливается.',
      created_at: '2026-09-12T07:11:00+03:00',
    },
    {
      id: 'msg-2',
      session_id: 'sess-40521',
      ticket_id: 'TSK-40521',
      author: 'ai',
      author_name: 'ИИ-ассистент поддержки',
      text: 'Подскажите, пожалуйста: это произошло на новом или уже привычном устройстве? И на каком этаже/крыле офиса вы находитесь?',
      created_at: '2026-09-12T07:11:30+03:00',
    },
    {
      id: 'msg-3',
      session_id: 'sess-40521',
      ticket_id: 'TSK-40521',
      author: 'employee',
      author_name: 'Дмитрий Ковалёв',
      text: 'Получил новый ноутбук сегодня утром, на старом всё работало нормально. Этаж 4, крыло Б.',
      created_at: '2026-09-12T07:12:00+03:00',
    },
    {
      id: 'msg-4',
      session_id: 'sess-40521',
      ticket_id: 'TSK-40521',
      author: 'system',
      author_name: 'Система',
      text: 'Спасибо! Обращение принято и передано оператору поддержки, номер TSK-40521.',
      created_at: '2026-09-12T07:12:10+03:00',
    },
    {
      id: 'msg-5',
      session_id: 'sess-40521',
      ticket_id: 'TSK-40521',
      author: 'operator',
      author_name: 'Оператор поддержки',
      text: 'Дмитрий, добрый день! Принял заявку в работу, уточняю модель нового устройства у инженеров.',
      created_at: '2026-09-12T07:20:00+03:00',
    },
  ],
  'sess-40518': [
    {
      id: 'msg-6',
      session_id: 'sess-40518',
      ticket_id: 'TSK-40518',
      author: 'employee',
      author_name: 'Анна Светлова',
      text: 'приветствую тех поддержку. Пишу по гитверс, не могу запушить коммиты, вылетает permission denied.',
      created_at: '2026-09-11T15:39:00+03:00',
    },
    {
      id: 'msg-7',
      session_id: 'sess-40518',
      ticket_id: 'TSK-40518',
      author: 'ai',
      author_name: 'ИИ-ассистент поддержки',
      text: 'Уточните, пожалуйста: недавно менялась ли ваша команда или проект в Gitverse? И название репозитория, в который не получается запушить.',
      created_at: '2026-09-11T15:39:20+03:00',
    },
    {
      id: 'msg-8',
      session_id: 'sess-40518',
      ticket_id: 'TSK-40518',
      author: 'employee',
      author_name: 'Анна Светлова',
      text: 'Да, перевели в команду «Эквайринг мобильный» на прошлой неделе. Репозиторий acquiring-mobile-core.',
      created_at: '2026-09-11T15:40:00+03:00',
    },
    {
      id: 'msg-9',
      session_id: 'sess-40518',
      ticket_id: 'TSK-40518',
      author: 'operator',
      author_name: 'Оператор поддержки',
      text: 'Анна, передал запрос администраторам Gitverse на пересинхронизацию прав по новой команде. Ожидаемое время — до 2 часов.',
      created_at: '2026-09-11T16:25:00+03:00',
    },
    {
      id: 'msg-10',
      session_id: 'sess-40518',
      ticket_id: 'TSK-40518',
      author: 'employee',
      author_name: 'Анна Светлова',
      text: 'Спасибо, буду ждать! Очень боюсь не успеть до релиза.',
      created_at: '2026-09-11T16:30:00+03:00',
    },
  ],
  'sess-40509': [
    {
      id: 'msg-11',
      session_id: 'sess-40509',
      ticket_id: 'TSK-40509',
      author: 'employee',
      author_name: 'Игорь Панфилов',
      text: 'добрый день срочно нужна замена монитора. Появились полосы через весь экран.',
      created_at: '2026-09-11T10:19:00+03:00',
    },
    {
      id: 'msg-12',
      session_id: 'sess-40509',
      ticket_id: 'TSK-40509',
      author: 'ai',
      author_name: 'ИИ-ассистент поддержки',
      text: 'Подскажите инвентарный номер монитора (наклейка снизу) и ваш отдел, чтобы мы подобрали замену как можно быстрее.',
      created_at: '2026-09-11T10:19:20+03:00',
    },
    {
      id: 'msg-13',
      session_id: 'sess-40509',
      ticket_id: 'TSK-40509',
      author: 'employee',
      author_name: 'Игорь Панфилов',
      text: 'Инвентарный номер INV-885241, отдел нагрузочного тестирования.',
      created_at: '2026-09-11T10:20:00+03:00',
    },
    {
      id: 'msg-14',
      session_id: 'sess-40509',
      ticket_id: 'TSK-40509',
      author: 'operator',
      author_name: 'Оператор поддержки',
      text: 'Игорь, заявка эскалирована в АХО как критическая. Резервный монитор зарезервирован, ожидаем курьера до 14:00.',
      created_at: '2026-09-12T08:55:00+03:00',
    },
  ],
  'sess-40495': [
    {
      id: 'msg-15',
      session_id: 'sess-40495',
      ticket_id: 'TSK-40495',
      author: 'employee',
      author_name: 'Мария Левитина',
      text: 'Здравствуйте. Меня перевели в проект "Цифровой ассистент 2.0", нужно перенести рабочее место.',
      created_at: '2026-09-08T13:04:00+03:00',
    },
    {
      id: 'msg-16',
      session_id: 'sess-40495',
      ticket_id: 'TSK-40495',
      author: 'ai',
      author_name: 'ИИ-ассистент поддержки',
      text: 'Уточните, пожалуйста, на какой этаж нужно перенести рабочее место и какое оборудование нужно перевезти?',
      created_at: '2026-09-08T13:04:20+03:00',
    },
    {
      id: 'msg-17',
      session_id: 'sess-40495',
      ticket_id: 'TSK-40495',
      author: 'employee',
      author_name: 'Мария Левитина',
      text: 'На 7 этаж, открытое пространство. Компьютер, два монитора, док-станция, тумбочка с документами.',
      created_at: '2026-09-08T13:05:00+03:00',
    },
    {
      id: 'msg-18',
      session_id: 'sess-40495',
      ticket_id: 'TSK-40495',
      author: 'operator',
      author_name: 'Оператор поддержки',
      text: 'Мария, перенос согласован с АХО на пятницу, 18:30. Всё оборудование перенесёт техник.',
      created_at: '2026-09-09T11:00:00+03:00',
    },
    {
      id: 'msg-19',
      session_id: 'sess-40495',
      ticket_id: 'TSK-40495',
      author: 'employee',
      author_name: 'Мария Левитина',
      text: 'Отлично, подходит! Спасибо за оперативность.',
      created_at: '2026-09-09T11:05:00+03:00',
    },
    {
      id: 'msg-20',
      session_id: 'sess-40495',
      ticket_id: 'TSK-40495',
      author: 'system',
      author_name: 'Система',
      text: 'Обращение закрыто со статусом «Решено».',
      created_at: '2026-09-10T17:30:00+03:00',
    },
  ],
};

/**
 * Локальные шаблоны для mock-режима переформулировки стиля ответа (ИИ-агент №2).
 * Используются, только если запрос POST /api/rewrite-style падает.
 */
export function localRewriteFallback(text: string, level: 1 | 3 | 5): string {
  const trimmed = text.trim();
  const core = trimmed.length > 0 ? trimmed : 'необходимо выполнить указанные действия';

  if (level === 1) {
    return `Инструкция:\n1. Выполните: ${core}.\n2. Нажмите «Применить».\n3. Дождитесь подтверждения системы.\nПри ошибке — повторите шаги заново.`;
  }
  if (level === 5) {
    return `Понимаем, как неприятно столкнуться с такой ситуацией, и искренне сочувствуем неудобствам. Мы уже занимаемся вашим вопросом: ${core}. Будем держать вас в курсе на каждом шаге и сделаем всё возможное, чтобы решить проблему как можно скорее.`;
  }
  return `Добрый день! Спасибо за обращение. Сообщаем, что по вашему вопросу выполняется следующее: ${core}. Мы уведомим вас об изменении статуса заявки. С уважением, служба поддержки СберТех.`;
}

/**
 * Локальная имитация ИИ-агента №1 (приёмщика обращений) для mock-режима.
 * Если данных мало — задаёт уточняющий вопрос, иначе классифицирует и
 * "создаёт" тикет.
 */
export function localIntakeFallback(
  allEmployeeText: string,
  turnCount: number,
): {
  needsMoreInfo: boolean;
  question?: string;
  classification?: { summary: string; category: TicketCategory; priority: TicketPriority };
} {
  const text = allEmployeeText.toLowerCase();
  const hasEnoughDetail = allEmployeeText.length > 60 || turnCount >= 2;

  if (!hasEnoughDetail) {
    return {
      needsMoreInfo: true,
      question: 'Уточните, пожалуйста, подробнее: когда началась проблема и на каком устройстве/месте это происходит?',
    };
  }

  let category: TicketCategory = 'other';
  if (/wi-?fi|вай\s?фай|сеть|vpn|сертификат/.test(text)) category = 'wifi';
  else if (/gitverse|гитверс|репозитори|push|коммит|ssh/.test(text)) category = 'gitverse';
  else if (/пароль|логин|учетк|учётк|доступ к аккаунту|заблокирован/.test(text)) category = 'accounts';
  else if (/монитор|ноутбук|компьютер|мышь|клавиатур|принтер|железо/.test(text)) category = 'hardware';
  else if (/программ|приложени|софт|1с|excel|word|установ/.test(text)) category = 'software';
  else if (/перенос|кабинет|этаж|стол|организац|перевод в проект/.test(text)) category = 'organization';

  let priority: TicketPriority = 'medium';
  if (/срочно|критично|немедленно|горит|невозможно работать|сегодня/.test(text)) priority = 'high';
  if (/аварийно|полностью не работает|критическ|блокирует релиз|весь отдел/.test(text)) priority = 'critical';
  if (/когда будет время|не срочно|как удобно|без спешки/.test(text)) priority = 'low';

  const trimmedText = allEmployeeText.trim().replace(/\s+/g, ' ');
  const summary = trimmedText.length > 140 ? trimmedText.slice(0, 140).trim() + '…' : trimmedText;

  return { needsMoreInfo: false, classification: { summary, category, priority } };
}
