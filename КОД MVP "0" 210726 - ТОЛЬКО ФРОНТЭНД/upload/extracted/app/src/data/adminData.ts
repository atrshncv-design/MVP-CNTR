// ============================================================
// UGT Platform Admin Data Layer — Types, CRUD & Mock Data
// ============================================================

export type PerformerType = 'ВУЗ' | 'НИИ' | 'Научная группа' | 'Институт' | 'Лаборатория' | 'Стартап';
export type CustomerType = 'Промышленник' | 'Отраслевик' | 'Госкорпорация' | 'Средний бизнес';
export type Priority = 'Высокий' | 'Средний' | 'Низкий';
export type Status = 'Активный' | 'На рассмотрении' | 'Архив' | 'Чёрный список';

export interface ContactPerson {
  name: string;
  position: string;
  phone: string;
  email: string;
}

export interface Performer {
  id: string;
  name: string;
  type: PerformerType;
  direction: string;
  currentUGT: number;
  contactPerson: ContactPerson;
  lpr: ContactPerson;
  priority: Priority;
  status: Status;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  name: string;
  type: CustomerType;
  industry: string;
  contactPerson: ContactPerson;
  lpr: ContactPerson;
  projectRequirements: string[];
  priority: Priority;
  status: Status;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

// ─── ID Generator ───────────────────────────────────────────
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
}

// ─── localStorage Keys ──────────────────────────────────────
const PERF_KEY = 'ugt_performers';
const CUST_KEY = 'ugt_customers';
const AUTH_KEY = 'ugt_admin_auth';

// ─── Auth Helpers ───────────────────────────────────────────
export function isAuthenticated(): boolean {
  return localStorage.getItem(AUTH_KEY) === 'admin';
}

export function loginAdmin() {
  localStorage.setItem(AUTH_KEY, 'admin');
}

export function logoutAdmin() {
  localStorage.removeItem(AUTH_KEY);
}

// ─── Performer CRUD ─────────────────────────────────────────
export function getPerformers(): Performer[] {
  const raw = localStorage.getItem(PERF_KEY);
  if (!raw) {
    const initial = getInitialPerformers();
    savePerformers(initial);
    return initial;
  }
  try {
    return JSON.parse(raw) as Performer[];
  } catch {
    return getInitialPerformers();
  }
}

export function savePerformers(data: Performer[]) {
  localStorage.setItem(PERF_KEY, JSON.stringify(data));
}

export function addPerformer(p: Omit<Performer, 'id' | 'createdAt' | 'updatedAt'>): Performer {
  const performers = getPerformers();
  const now = new Date().toISOString();
  const newPerformer: Performer = {
    ...p,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  performers.push(newPerformer);
  savePerformers(performers);
  return newPerformer;
}

export function updatePerformer(id: string, updates: Partial<Performer>): Performer | null {
  const performers = getPerformers();
  const idx = performers.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  performers[idx] = { ...performers[idx], ...updates, updatedAt: new Date().toISOString() };
  savePerformers(performers);
  return performers[idx];
}

export function deletePerformer(id: string): boolean {
  const performers = getPerformers();
  const filtered = performers.filter((p) => p.id !== id);
  if (filtered.length === performers.length) return false;
  savePerformers(filtered);
  return true;
}

export function getPerformerById(id: string): Performer | undefined {
  return getPerformers().find((p) => p.id === id);
}

// ─── Customer CRUD ──────────────────────────────────────────
export function getCustomers(): Customer[] {
  const raw = localStorage.getItem(CUST_KEY);
  if (!raw) {
    const initial = getInitialCustomers();
    saveCustomers(initial);
    return initial;
  }
  try {
    return JSON.parse(raw) as Customer[];
  } catch {
    return getInitialCustomers();
  }
}

export function saveCustomers(data: Customer[]) {
  localStorage.setItem(CUST_KEY, JSON.stringify(data));
}

export function addCustomer(c: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>): Customer {
  const customers = getCustomers();
  const now = new Date().toISOString();
  const newCustomer: Customer = {
    ...c,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  customers.push(newCustomer);
  saveCustomers(customers);
  return newCustomer;
}

export function updateCustomer(id: string, updates: Partial<Customer>): Customer | null {
  const customers = getCustomers();
  const idx = customers.findIndex((c) => c.id === id);
  if (idx === -1) return null;
  customers[idx] = { ...customers[idx], ...updates, updatedAt: new Date().toISOString() };
  saveCustomers(customers);
  return customers[idx];
}

export function deleteCustomer(id: string): boolean {
  const customers = getCustomers();
  const filtered = customers.filter((c) => c.id !== id);
  if (filtered.length === customers.length) return false;
  saveCustomers(filtered);
  return true;
}

export function getCustomerById(id: string): Customer | undefined {
  return getCustomers().find((c) => c.id === id);
}

// ─── Initial Mock Data ──────────────────────────────────────
function getInitialPerformers(): Performer[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'perf_001',
      name: 'МГТУ им. Н.Э. Баумана',
      type: 'ВУЗ',
      direction: 'Аддитивные технологии',
      currentUGT: 5,
      contactPerson: { name: 'Иванов Сергей Петрович', position: 'Зав. кафедрой', phone: '+7 (495) 123-45-67', email: 'ivanov@bmstu.ru' },
      lpr: { name: 'Петров Алексей Викторович', position: 'Проректор по НИР', phone: '+7 (495) 123-45-68', email: 'petrov@bmstu.ru' },
      priority: 'Высокий',
      status: 'Активный',
      notes: 'Ключевой партнёр по аддитивным технологиям. Регулярные поставки оборудования.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'perf_002',
      name: 'Институт проблем машиноведения РАН',
      type: 'НИИ',
      direction: 'Мехатроника и робототехника',
      currentUGT: 7,
      contactPerson: { name: 'Сидорова Мария Ивановна', position: 'Научный сотрудник', phone: '+7 (812) 234-56-78', email: 'sidorova@ipm.ru' },
      lpr: { name: 'Кузнецов Дмитрий Андреевич', position: 'Директор института', phone: '+7 (812) 234-56-79', email: 'kuznetsov@ipm.ru' },
      priority: 'Высокий',
      status: 'Активный',
      notes: 'Ведущий НИИ в области мехатроники. Сотрудничество с 2021 года.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'perf_003',
      name: 'Научная группа «Наноматериалы»',
      type: 'Научная группа',
      direction: 'Нанотехнологии',
      currentUGT: 4,
      contactPerson: { name: 'Фёдоров Павел Сергеевич', position: 'Руководитель группы', phone: '+7 (495) 345-67-89', email: 'fedorov@nano.ru' },
      lpr: { name: 'Фёдоров Павел Сергеевич', position: 'Руководитель группы', phone: '+7 (495) 345-67-89', email: 'fedorov@nano.ru' },
      priority: 'Средний',
      status: 'На рассмотрении',
      notes: 'Перспективное направление — нанопокрытия для аэрокосмической отрасли.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'perf_004',
      name: 'Институт ядерной физики им. Будкера СО РАН',
      type: 'Институт',
      direction: 'Ускорительная техника',
      currentUGT: 8,
      contactPerson: { name: 'Новикова Анна Дмитриевна', position: 'Инженер-физик', phone: '+7 (383) 456-78-90', email: 'novikova@inp.nsk.su' },
      lpr: { name: 'Смирнов Геннадий Павлович', position: 'Директор', phone: '+7 (383) 456-78-91', email: 'smirnov@inp.nsk.su' },
      priority: 'Высокий',
      status: 'Активный',
      notes: 'Уникальные разработки в области ускорительной техники. Государственная поддержка.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'perf_005',
      name: 'Лаборатория промышленной автоматизации',
      type: 'Лаборатория',
      direction: 'Промышленная автоматизация',
      currentUGT: 6,
      contactPerson: { name: 'Морозов Илья Александрович', position: 'Зав. лабораторией', phone: '+7 (843) 567-89-01', email: 'morozov@labauto.ru' },
      lpr: { name: 'Васильева Ольга Николаевна', position: 'Технический директор', phone: '+7 (843) 567-89-02', email: 'vasilieva@labauto.ru' },
      priority: 'Средний',
      status: 'Активный',
      notes: 'Специализация на внедрении систем ЧПУ и роботизированных комплексов.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'perf_006',
      name: 'Стартап «Квантовые решения»',
      type: 'Стартап',
      direction: 'Квантовые вычисления',
      currentUGT: 3,
      contactPerson: { name: 'Лебедев Артём Михайлович', position: 'CEO', phone: '+7 (495) 678-90-12', email: 'lebedev@quantum.tech' },
      lpr: { name: 'Лебедев Артём Михайлович', position: 'CEO', phone: '+7 (495) 678-90-12', email: 'lebedev@quantum.tech' },
      priority: 'Высокий',
      status: 'На рассмотрении',
      notes: 'Стартап-резидент Сколково. Разработка квантовых процессоров. Требуется дофинансирование.',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

function getInitialCustomers(): Customer[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'cust_001',
      name: 'Ростех',
      type: 'Госкорпорация',
      industry: 'Оборонная промышленность',
      contactPerson: { name: 'Соколов Владимир Игоревич', position: 'Директор по инновациям', phone: '+7 (495) 111-22-33', email: 'sokolov@rostec.ru' },
      lpr: { name: 'Козлов Михаил Александрович', position: 'Зам. генерального директора', phone: '+7 (495) 111-22-34', email: 'kozlov@rostec.ru' },
      projectRequirements: ['Повышение УГТ до 8-9 уровня', 'Внедрение аддитивных технологий', 'Цифровизация производства'],
      priority: 'Высокий',
      status: 'Активный',
      notes: 'Крупнейший заказчик. Стратегическое партнёрство. Государственный контракт до 2026 года.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cust_002',
      name: 'Газпром нефть',
      type: 'Госкорпорация',
      industry: 'Нефтегазовая отрасль',
      contactPerson: { name: 'Попова Екатерина Владимировна', position: 'Начальник отдела НИОКР', phone: '+7 (495) 222-33-44', email: 'popova@gazpromneft.ru' },
      lpr: { name: 'Андреев Сергей Петрович', position: 'Технический директор', phone: '+7 (495) 222-33-45', email: 'andreev@gazpromneft.ru' },
      projectRequirements: ['Технологии бурения на арктическом шельфе', 'Мониторинг трубопроводов', 'Снижение углеродного следа'],
      priority: 'Высокий',
      status: 'Активный',
      notes: 'Активная фаза переговоров по трём направлениям. Пилотный проект запланирован на Q3.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cust_003',
      name: 'Северсталь',
      type: 'Промышленник',
      industry: 'Металлургия',
      contactPerson: { name: 'Козлова Наталья Дмитриевна', position: 'Руководитель проектов', phone: '+7 (8202) 33-44-55', email: 'kozlova@severstal.com' },
      lpr: { name: 'Макаров Игорь Васильевич', position: 'Директор по развитию', phone: '+7 (8202) 33-44-56', email: 'makarov@severstal.com' },
      projectRequirements: ['Беспилотный транспорт в цехах', 'Предиктивная аналитика оборудования'],
      priority: 'Средний',
      status: 'Активный',
      notes: 'Постоянный заказчик. Ежегодный объём контрактов — 150+ млн руб.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cust_004',
      name: 'Объединённая авиастроительная корпорация',
      type: 'Госкорпорация',
      industry: 'Авиастроение',
      contactPerson: { name: 'Волков Денис Сергеевич', position: 'Главный конструктор', phone: '+7 (495) 333-44-55', email: 'volkov@uacrussia.ru' },
      lpr: { name: 'Николаев Павел Андреевич', position: 'Вице-президент по НИОКР', phone: '+7 (495) 333-44-56', email: 'nikolaev@uacrussia.ru' },
      projectRequirements: ['Композитные материалы для авиации', 'УГТ 8+ для критических компонентов', 'Сертификация по авиационным стандартам'],
      priority: 'Высокий',
      status: 'На рассмотрении',
      notes: 'Долгосрочный проект сертификации. Сроки реализации — 3-5 лет.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cust_005',
      name: 'ТехноНиколь',
      type: 'Средний бизнес',
      industry: 'Строительные материалы',
      contactPerson: { name: 'Романова Анна Сергеевна', position: 'Директор по маркетингу', phone: '+7 (495) 444-55-66', email: 'romanova@technonicol.ru' },
      lpr: { name: 'Кузьмин Иван Петрович', position: 'Генеральный директор', phone: '+7 (495) 444-55-67', email: 'kuzmin@technonicol.ru' },
      projectRequirements: ['Новые теплоизоляционные материалы', 'Экологичные технологии производства'],
      priority: 'Низкий',
      status: 'Активный',
      notes: 'Интерес к экологичным решениям. Бюджет ограничен.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'cust_006',
      name: 'НЛМК',
      type: 'Промышленник',
      industry: 'Металлургия',
      contactPerson: { name: 'Михайлов Дмитрий Викторович', position: 'Начальник управления НТИ', phone: '+7 (4742) 55-66-77', email: 'mikhailov@nlmk.ru' },
      lpr: { name: 'Павлов Андрей Константинович', position: 'Директор по технологиям', phone: '+7 (4742) 55-66-78', email: 'pavlov@nlmk.ru' },
      projectRequirements: ['Автоматизация прокатных станов', 'Цифровые двойники', 'Снижение энергопотребления'],
      priority: 'Средний',
      status: 'Активный',
      notes: 'Крупный металлургический холдинг. Интерес к цифровизации процессов.',
      createdAt: now,
      updatedAt: now,
    },
  ];
}

// ─── Helpers ────────────────────────────────────────────────
export const PERFORMER_TYPES: PerformerType[] = ['ВУЗ', 'НИИ', 'Научная группа', 'Институт', 'Лаборатория', 'Стартап'];
export const CUSTOMER_TYPES: CustomerType[] = ['Промышленник', 'Отраслевик', 'Госкорпорация', 'Средний бизнес'];
export const PRIORITIES: Priority[] = ['Высокий', 'Средний', 'Низкий'];
export const STATUSES: Status[] = ['Активный', 'На рассмотрении', 'Архив', 'Чёрный список'];

export const INDUSTRIES = [
  'Оборонная промышленность',
  'Нефтегазовая отрасль',
  'Металлургия',
  'Авиастроение',
  'Строительные материалы',
  'Энергетика',
  'Машиностроение',
  'Химическая промышленность',
  'Фармацевтика',
  'Агропром',
  'Транспорт',
  'IT и телеком',
];

export const DIRECTIONS = [
  'Аддитивные технологии',
  'Мехатроника и робототехника',
  'Нанотехнологии',
  'Ускорительная техника',
  'Промышленная автоматизация',
  'Квантовые вычисления',
  'Искусственный интеллект',
  'Композитные материалы',
  'Цифровые двойники',
  'Энергосбережение',
  'Биотехнологии',
  'Беспилотные системы',
  'Новые материалы',
  'Микроэлектроника',
];

export function getPriorityColor(p: Priority): string {
  switch (p) {
    case 'Высокий': return '#EF4444';
    case 'Средний': return '#FF7A2E';
    case 'Низкий': return '#10B981';
  }
}

export function getStatusColor(s: Status): string {
  switch (s) {
    case 'Активный': return '#10B981';
    case 'На рассмотрении': return '#2E5BFF';
    case 'Архив': return '#94A3B8';
    case 'Чёрный список': return '#0F172A';
  }
}

export function getTypeColor(t: PerformerType | CustomerType): string {
  switch (t) {
    case 'ВУЗ': return '#2E5BFF';
    case 'НИИ': return '#5B9BD5';
    case 'Научная группа': return '#A8D65A';
    case 'Институт': return '#4A82FF';
    case 'Лаборатория': return '#6AB0B5';
    case 'Стартап': return '#FF7A2E';
    case 'Промышленник': return '#10B981';
    case 'Отраслевик': return '#5B9BD5';
    case 'Госкорпорация': return '#EF4444';
    case 'Средний бизнес': return '#E5C840';
    default: return '#94A3B8';
  }
}
