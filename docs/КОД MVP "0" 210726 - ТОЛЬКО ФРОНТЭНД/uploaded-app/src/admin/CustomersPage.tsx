import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Factory,
  Plus,
  Search,
  Pencil,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
} from 'lucide-react';
import {
  getCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  CUSTOMER_TYPES,
  PRIORITIES,
  STATUSES,
  INDUSTRIES,
  getPriorityColor,
  getStatusColor,
  getTypeColor,
} from '@/data/adminData';
import type { Customer, CustomerType, Priority, Status } from '@/data/adminData';

// ─── Sorting ────────────────────────────────────────────────
type SortKey = 'name' | 'type' | 'industry' | 'priority' | 'status';
type SortDir = 'asc' | 'desc';

// ─── Toast ──────────────────────────────────────────────────
function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="fixed bottom-6 right-6 z-50 rounded-lg bg-[#10B981] px-5 py-3 text-sm font-medium text-white shadow-xl"
    >
      {message}
    </motion.div>
  );
}

// ─── Modal Form ─────────────────────────────────────────────
interface CustomerFormData {
  name: string;
  type: CustomerType;
  industry: string;
  priority: Priority;
  status: Status;
  notes: string;
  projectRequirements: string;
  contactName: string;
  contactPosition: string;
  contactPhone: string;
  contactEmail: string;
  lprName: string;
  lprPosition: string;
  lprPhone: string;
  lprEmail: string;
}

const emptyForm: CustomerFormData = {
  name: '',
  type: 'Госкорпорация',
  industry: INDUSTRIES[0],
  priority: 'Средний',
  status: 'Активный',
  notes: '',
  projectRequirements: '',
  contactName: '',
  contactPosition: '',
  contactPhone: '',
  contactEmail: '',
  lprName: '',
  lprPosition: '',
  lprPhone: '',
  lprEmail: '',
};

function toFormData(c: Customer): CustomerFormData {
  return {
    name: c.name,
    type: c.type,
    industry: c.industry,
    priority: c.priority,
    status: c.status,
    notes: c.notes,
    projectRequirements: c.projectRequirements.join('\n'),
    contactName: c.contactPerson.name,
    contactPosition: c.contactPerson.position,
    contactPhone: c.contactPerson.phone,
    contactEmail: c.contactPerson.email,
    lprName: c.lpr.name,
    lprPosition: c.lpr.position,
    lprPhone: c.lpr.phone,
    lprEmail: c.lpr.email,
  };
}

function fromFormData(fd: CustomerFormData): Omit<Customer, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: fd.name,
    type: fd.type,
    industry: fd.industry,
    priority: fd.priority,
    status: fd.status,
    notes: fd.notes,
    projectRequirements: fd.projectRequirements
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    contactPerson: {
      name: fd.contactName,
      position: fd.contactPosition,
      phone: fd.contactPhone,
      email: fd.contactEmail,
    },
    lpr: {
      name: fd.lprName,
      position: fd.lprPosition,
      phone: fd.lprPhone,
      email: fd.lprEmail,
    },
  };
}

function CustomerModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialData?: Customer;
}) {
  const [fd, setFd] = useState<CustomerFormData>(emptyForm);

  useEffect(() => {
    if (initialData) setFd(toFormData(initialData));
    else setFd(emptyForm);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const update = (field: keyof CustomerFormData, value: string | number) =>
    setFd((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(fromFormData(fd));
  };

  const inputClass =
    'w-full rounded-lg border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-white placeholder-[#475569] outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]/30';
  const labelClass = 'mb-1.5 block text-xs font-medium text-[#94A3B8]';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-[#1E293B] p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {initialData ? 'Редактировать заказчика' : 'Добавить заказчика'}
          </h2>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name & Type */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Название *</label>
              <input className={inputClass} value={fd.name} onChange={(e) => update('name', e.target.value)} required placeholder="Название организации" />
            </div>
            <div>
              <label className={labelClass}>Тип *</label>
              <select className={inputClass} value={fd.type} onChange={(e) => update('type', e.target.value)}>
                {CUSTOMER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Industry */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Отрасль *</label>
              <select className={inputClass} value={fd.industry} onChange={(e) => update('industry', e.target.value)}>
                {INDUSTRIES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Приоритет</label>
              <select className={inputClass} value={fd.priority} onChange={(e) => update('priority', e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className={labelClass}>Статус</label>
            <select className={inputClass} value={fd.status} onChange={(e) => update('status', e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Project requirements */}
          <div>
            <label className={labelClass}>Требования к проектам (по одному на строку)</label>
            <textarea
              className={inputClass + ' min-h-[80px] resize-y'}
              value={fd.projectRequirements}
              onChange={(e) => update('projectRequirements', e.target.value)}
              placeholder="Например: Повышение УГТ до 8 уровня\nВнедрение аддитивных технологий"
            />
          </div>

          {/* Contact person */}
          <div className="rounded-lg border border-white/5 bg-[#0F172A]/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Контактное лицо</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>ФИО</label>
                <input className={inputClass} value={fd.contactName} onChange={(e) => update('contactName', e.target.value)} placeholder="Иванов Иван Иванович" />
              </div>
              <div>
                <label className={labelClass}>Должность</label>
                <input className={inputClass} value={fd.contactPosition} onChange={(e) => update('contactPosition', e.target.value)} placeholder="Директор по инновациям" />
              </div>
              <div>
                <label className={labelClass}>Телефон</label>
                <input className={inputClass} value={fd.contactPhone} onChange={(e) => update('contactPhone', e.target.value)} placeholder="+7 (999) 123-45-67" />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input className={inputClass} type="email" value={fd.contactEmail} onChange={(e) => update('contactEmail', e.target.value)} placeholder="email@example.com" />
              </div>
            </div>
          </div>

          {/* LPR */}
          <div className="rounded-lg border border-white/5 bg-[#0F172A]/50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-white">Лицо, принимающее решения (ЛПР)</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className={labelClass}>ФИО</label>
                <input className={inputClass} value={fd.lprName} onChange={(e) => update('lprName', e.target.value)} placeholder="Петров Пётр Петрович" />
              </div>
              <div>
                <label className={labelClass}>Должность</label>
                <input className={inputClass} value={fd.lprPosition} onChange={(e) => update('lprPosition', e.target.value)} placeholder="Вице-президент по НИОКР" />
              </div>
              <div>
                <label className={labelClass}>Телефон</label>
                <input className={inputClass} value={fd.lprPhone} onChange={(e) => update('lprPhone', e.target.value)} placeholder="+7 (999) 765-43-21" />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input className={inputClass} type="email" value={fd.lprEmail} onChange={(e) => update('lprEmail', e.target.value)} placeholder="lpr@example.com" />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>Примечания</label>
            <textarea
              className={inputClass + ' min-h-[80px] resize-y'}
              value={fd.notes}
              onChange={(e) => update('notes', e.target.value)}
              placeholder="Дополнительная информация..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white"
            >
              Отмена
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#2E5BFF] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#2548CC] hover:shadow-lg active:scale-[0.98]"
            >
              {initialData ? 'Сохранить' : 'Добавить'}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
}

// ─── Delete Confirmation Modal ──────────────────────────────
function DeleteModal({
  isOpen,
  onClose,
  onConfirm,
  name,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  name: string;
}) {
  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1E293B] p-6 shadow-2xl"
      >
        <h2 className="mb-2 text-lg font-bold text-white">Подтверждение удаления</h2>
        <p className="mb-5 text-sm text-[#94A3B8]">
          Вы уверены, что хотите удалить <span className="font-medium text-white">"{name}"</span>?
          Это действие нельзя отменить.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-[#94A3B8] transition-colors hover:bg-white/5"
          >
            Отмена
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-[#EF4444] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#DC2626] active:scale-[0.98]"
          >
            Удалить
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ──────────────────────────────────────────────
export default function CustomersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [customers, setCustomers] = useState<Customer[]>(getCustomers);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('Все');
  const [filterIndustry, setFilterIndustry] = useState<string>('Все');
  const [filterPriority, setFilterPriority] = useState<string>('Все');
  const [filterStatus, setFilterStatus] = useState<string>('Все');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [modalOpen, setModalOpen] = useState(location.state?.openAdd || false);
  const [editing, setEditing] = useState<Customer | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (location.state?.openAdd) {
      navigate('/admin/customers', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = useMemo(() => {
    let list = [...customers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.industry.toLowerCase().includes(q) ||
          c.contactPerson.name.toLowerCase().includes(q)
      );
    }
    if (filterType !== 'Все') list = list.filter((c) => c.type === filterType);
    if (filterIndustry !== 'Все') list = list.filter((c) => c.industry === filterIndustry);
    if (filterPriority !== 'Все') list = list.filter((c) => c.priority === filterPriority);
    if (filterStatus !== 'Все') list = list.filter((c) => c.status === filterStatus);

    list.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [customers, search, filterType, filterIndustry, filterPriority, filterStatus, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="text-[#475569]" />;
    return sortDir === 'asc' ? (
      <ArrowUp size={12} className="text-[#2E5BFF]" />
    ) : (
      <ArrowDown size={12} className="text-[#2E5BFF]" />
    );
  };

  const handleSave = (data: Omit<Customer, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) {
      updateCustomer(editing.id, data);
      showToast('Заказчик обновлён');
    } else {
      addCustomer(data);
      showToast('Заказчик добавлен');
    }
    setCustomers(getCustomers());
    setModalOpen(false);
    setEditing(undefined);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteCustomer(deleteTarget.id);
      showToast('Заказчик удалён');
      setCustomers(getCustomers());
      setDeleteTarget(null);
    }
  };

  const openAdd = () => {
    setEditing(undefined);
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setModalOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Заказчики</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Управление промышленными компаниями и госкорпорациями
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 rounded-lg bg-[#2E5BFF] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#2548CC] hover:shadow-lg active:scale-[0.98]"
        >
          <Plus size={16} />
          Добавить
        </button>
      </div>

      {/* Filters & Search */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#475569]" />
          <input
            type="text"
            placeholder="Поиск по названию, отрасли, контакту..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-lg border border-white/10 bg-[#1E293B] pl-9 pr-4 text-sm text-white placeholder-[#475569] outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]/30"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Filter size={14} className="text-[#475569]" />
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-white/10 bg-[#1E293B] px-3 text-sm text-white outline-none"
          >
            <option value="Все">Все типы</option>
            {CUSTOMER_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
          <select
            value={filterIndustry}
            onChange={(e) => { setFilterIndustry(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-white/10 bg-[#1E293B] px-3 text-sm text-white outline-none"
          >
            <option value="Все">Все отрасли</option>
            {INDUSTRIES.map((i) => (<option key={i} value={i}>{i}</option>))}
          </select>
          <select
            value={filterPriority}
            onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-white/10 bg-[#1E293B] px-3 text-sm text-white outline-none"
          >
            <option value="Все">Все приоритеты</option>
            {PRIORITIES.map((p) => (<option key={p} value={p}>{p}</option>))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-white/10 bg-[#1E293B] px-3 text-sm text-white outline-none"
          >
            <option value="Все">Все статусы</option>
            {STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#1E293B]/80">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-white/10 text-xs font-medium text-[#94A3B8]">
              {[
                { key: 'name', label: 'Название' },
                { key: 'type', label: 'Тип' },
                { key: 'industry', label: 'Отрасль' },
                { key: 'priority', label: 'Приоритет' },
                { key: 'status', label: 'Статус' },
                { key: 'contact', label: 'Контакт', sortable: false },
                { key: 'lpr', label: 'ЛПР', sortable: false },
                { key: 'actions', label: '', sortable: false },
              ].map((col: { key: string; label: string; sortable?: boolean }) => (
                <th
                  key={col.key}
                  className="cursor-pointer select-none px-4 py-3 transition-colors hover:text-white"
                  onClick={() => col.sortable !== false ? handleSort(col.key as SortKey) : undefined}
                >
                  <div className="flex items-center gap-1.5">
                    {col.label}
                    {col.sortable !== false && <SortIcon col={col.key as SortKey} />}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.map((c) => (
              <tr
                key={c.id}
                className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
                onClick={() => navigate(`/admin/customers/${c.id}`)}
              >
                <td className="px-4 py-3 text-sm font-medium text-white">{c.name}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                    style={{ background: getTypeColor(c.type) }}
                  >
                    {c.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#94A3B8]">{c.industry}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: `${getPriorityColor(c.priority)}18`,
                      color: getPriorityColor(c.priority),
                    }}
                  >
                    {c.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: `${getStatusColor(c.status)}18`,
                      color: getStatusColor(c.status),
                    }}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#94A3B8]">{c.contactPerson.name}</td>
                <td className="px-4 py-3 text-sm text-[#94A3B8]">{c.lpr.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(c); }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-[#2E5BFF]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-[#EF4444]"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginated.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-sm text-[#475569]">
                  <Factory size={40} className="mx-auto mb-3 text-[#475569]" />
                  Заказчики не найдены. Попробуйте изменить фильтры.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-xs text-[#475569]">
            Показано {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} из {filtered.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-white/5 disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={
                  'flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ' +
                  (p === page
                    ? 'bg-[#2E5BFF] text-white'
                    : 'text-[#94A3B8] hover:bg-white/5 hover:text-white')
                }
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-white/5 disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {modalOpen && (
          <CustomerModal
            isOpen={modalOpen}
            onClose={() => { setModalOpen(false); setEditing(undefined); }}
            onSave={handleSave}
            initialData={editing}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteModal
            isOpen={!!deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onConfirm={handleDelete}
            name={deleteTarget.name}
          />
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast} onClose={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  );
}
