import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GraduationCap,
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
  getPerformers,
  addPerformer,
  updatePerformer,
  deletePerformer,
  PERFORMER_TYPES,
  PRIORITIES,
  STATUSES,
  DIRECTIONS,
  getPriorityColor,
  getStatusColor,
  getTypeColor,
} from '@/data/adminData';
import type { Performer, PerformerType, Priority, Status } from '@/data/adminData';

// ─── Sorting ────────────────────────────────────────────────
type SortKey = 'name' | 'type' | 'direction' | 'currentUGT' | 'priority' | 'status';
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
interface PerformerFormData {
  name: string;
  type: PerformerType;
  direction: string;
  currentUGT: number;
  priority: Priority;
  status: Status;
  notes: string;
  contactName: string;
  contactPosition: string;
  contactPhone: string;
  contactEmail: string;
  lprName: string;
  lprPosition: string;
  lprPhone: string;
  lprEmail: string;
}

const emptyForm: PerformerFormData = {
  name: '',
  type: 'ВУЗ',
  direction: DIRECTIONS[0],
  currentUGT: 1,
  priority: 'Средний',
  status: 'Активный',
  notes: '',
  contactName: '',
  contactPosition: '',
  contactPhone: '',
  contactEmail: '',
  lprName: '',
  lprPosition: '',
  lprPhone: '',
  lprEmail: '',
};

function toFormData(p: Performer): PerformerFormData {
  return {
    name: p.name,
    type: p.type,
    direction: p.direction,
    currentUGT: p.currentUGT,
    priority: p.priority,
    status: p.status,
    notes: p.notes,
    contactName: p.contactPerson.name,
    contactPosition: p.contactPerson.position,
    contactPhone: p.contactPerson.phone,
    contactEmail: p.contactPerson.email,
    lprName: p.lpr.name,
    lprPosition: p.lpr.position,
    lprPhone: p.lpr.phone,
    lprEmail: p.lpr.email,
  };
}

function fromFormData(fd: PerformerFormData, _existing?: Performer): Omit<Performer, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    name: fd.name,
    type: fd.type,
    direction: fd.direction,
    currentUGT: fd.currentUGT,
    priority: fd.priority,
    status: fd.status,
    notes: fd.notes,
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

function PerformerModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Omit<Performer, 'id' | 'createdAt' | 'updatedAt'>) => void;
  initialData?: Performer;
}) {
  const [fd, setFd] = useState<PerformerFormData>(emptyForm);

  useEffect(() => {
    if (initialData) setFd(toFormData(initialData));
    else setFd(emptyForm);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const update = (field: keyof PerformerFormData, value: string | number) =>
    setFd((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(fromFormData(fd, initialData));
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
            {initialData ? 'Редактировать исполнителя' : 'Добавить исполнителя'}
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
                {PERFORMER_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Direction & UGT */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Направление *</label>
              <select className={inputClass} value={fd.direction} onChange={(e) => update('direction', e.target.value)}>
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>УГТ (1-9) *</label>
              <input
                className={inputClass}
                type="number"
                min={1}
                max={9}
                value={fd.currentUGT}
                onChange={(e) => update('currentUGT', parseInt(e.target.value) || 1)}
                required
              />
            </div>
          </div>

          {/* Priority & Status */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Приоритет</label>
              <select className={inputClass} value={fd.priority} onChange={(e) => update('priority', e.target.value)}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelClass}>Статус</label>
              <select className={inputClass} value={fd.status} onChange={(e) => update('status', e.target.value)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
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
                <input className={inputClass} value={fd.contactPosition} onChange={(e) => update('contactPosition', e.target.value)} placeholder="Зав. кафедрой" />
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
                <input className={inputClass} value={fd.lprPosition} onChange={(e) => update('lprPosition', e.target.value)} placeholder="Проректор по НИР" />
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
export default function PerformersPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const [performers, setPerformers] = useState<Performer[]>(getPerformers);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('Все');
  const [filterPriority, setFilterPriority] = useState<string>('Все');
  const [filterStatus, setFilterStatus] = useState<string>('Все');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [page, setPage] = useState(1);
  const perPage = 10;

  const [modalOpen, setModalOpen] = useState(location.state?.openAdd || false);
  const [editing, setEditing] = useState<Performer | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Performer | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Clear openAdd state
  useEffect(() => {
    if (location.state?.openAdd) {
      navigate('/admin/performers', { replace: true, state: {} });
    }
  }, [location.state, navigate]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const filtered = useMemo(() => {
    let list = [...performers];
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.direction.toLowerCase().includes(q) ||
          p.contactPerson.name.toLowerCase().includes(q)
      );
    }
    if (filterType !== 'Все') list = list.filter((p) => p.type === filterType);
    if (filterPriority !== 'Все') list = list.filter((p) => p.priority === filterPriority);
    if (filterStatus !== 'Все') list = list.filter((p) => p.status === filterStatus);

    list.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [performers, search, filterType, filterPriority, filterStatus, sortKey, sortDir]);

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

  const handleSave = (data: Omit<Performer, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editing) {
      updatePerformer(editing.id, data);
      showToast('Исполнитель обновлён');
    } else {
      addPerformer(data);
      showToast('Исполнитель добавлен');
    }
    setPerformers(getPerformers());
    setModalOpen(false);
    setEditing(undefined);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deletePerformer(deleteTarget.id);
      showToast('Исполнитель удалён');
      setPerformers(getPerformers());
      setDeleteTarget(null);
    }
  };

  const openAdd = () => {
    setEditing(undefined);
    setModalOpen(true);
  };

  const openEdit = (p: Performer) => {
    setEditing(p);
    setModalOpen(true);
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Исполнители</h1>
          <p className="mt-1 text-sm text-[#94A3B8]">
            Управление научными организациями, ВУЗами, НИИ и стартапами
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
            placeholder="Поиск по названию, направлению, контакту..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="h-10 w-full rounded-lg border border-white/10 bg-[#1E293B] pl-9 pr-4 text-sm text-white placeholder-[#475569] outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-[#475569]" />
          <select
            value={filterType}
            onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
            className="h-10 rounded-lg border border-white/10 bg-[#1E293B] px-3 text-sm text-white outline-none"
          >
            <option value="Все">Все типы</option>
            {PERFORMER_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
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
                { key: 'direction', label: 'Направление' },
                { key: 'currentUGT', label: 'УГТ' },
                { key: 'priority', label: 'Приоритет' },
                { key: 'status', label: 'Статус' },
                { key: 'contact', label: 'Контакт', sortable: false },
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
            {paginated.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer border-b border-white/5 transition-colors hover:bg-white/5"
                onClick={() => navigate(`/admin/performers/${p.id}`)}
              >
                <td className="px-4 py-3 text-sm font-medium text-white">{p.name}</td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                    style={{ background: getTypeColor(p.type) }}
                  >
                    {p.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#94A3B8]">{p.direction}</td>
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold" style={{ color: `var(--ugt-${p.currentUGT})` }}>
                    УГТ {p.currentUGT}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: `${getPriorityColor(p.priority)}18`,
                      color: getPriorityColor(p.priority),
                    }}
                  >
                    {p.priority}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                    style={{
                      background: `${getStatusColor(p.status)}18`,
                      color: getStatusColor(p.status),
                    }}
                  >
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-[#94A3B8]">{p.contactPerson.name}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                      className="flex h-8 w-8 items-center justify-center rounded-md text-[#94A3B8] transition-colors hover:bg-white/10 hover:text-[#2E5BFF]"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setDeleteTarget(p); }}
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
                  <GraduationCap size={40} className="mx-auto mb-3 text-[#475569]" />
                  Исполнители не найдены. Попробуйте изменить фильтры.
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
          <PerformerModal
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
