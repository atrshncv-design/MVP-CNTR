import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Factory,
  ArrowLeft,
  Pencil,
  Trash2,
  Archive,
  Phone,
  Mail,
  User,
  Briefcase,
  ClipboardList,
  Save,
  X,
  ChevronRight,
  Plus,
  Trash2 as TrashIcon,
} from 'lucide-react';
import {
  getCustomerById,
  updateCustomer,
  deleteCustomer,
  getPriorityColor,
  getStatusColor,
  getTypeColor,
} from '@/data/adminData';

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(() => getCustomerById(id || ''));
  const [notesEdit, setNotesEdit] = useState(false);
  const [notesValue, setNotesValue] = useState(customer?.notes || '');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [newReq, setNewReq] = useState('');

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#94A3B8]">
        <Factory size={48} className="mb-4 text-[#475569]" />
        <p className="text-lg">Заказчик не найден</p>
        <Link to="/admin/customers" className="mt-4 text-[#2E5BFF] hover:underline">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  const refresh = () => {
    const updated = getCustomerById(customer.id);
    if (updated) setCustomer(updated);
  };

  const handleSaveNotes = () => {
    updateCustomer(customer.id, { notes: notesValue });
    setNotesEdit(false);
    refresh();
  };

  const handleArchive = () => {
    updateCustomer(customer.id, { status: 'Архив' });
    refresh();
  };

  const handleDelete = () => {
    deleteCustomer(customer.id);
    navigate('/admin/customers');
  };

  const handleAddRequirement = () => {
    if (!newReq.trim()) return;
    const reqs = [...customer.projectRequirements, newReq.trim()];
    updateCustomer(customer.id, { projectRequirements: reqs });
    setNewReq('');
    refresh();
  };

  const handleRemoveRequirement = (idx: number) => {
    const reqs = customer.projectRequirements.filter((_, i) => i !== idx);
    updateCustomer(customer.id, { projectRequirements: reqs });
    refresh();
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-[#94A3B8]">
        <Link to="/admin" className="hover:text-white transition-colors">Дашборд</Link>
        <ChevronRight size={14} />
        <Link to="/admin/customers" className="hover:text-white transition-colors">Заказчики</Link>
        <ChevronRight size={14} />
        <span className="text-white truncate max-w-[300px]">{customer.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/admin/customers')}
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{customer.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ background: getTypeColor(customer.type) }}
              >
                {customer.type}
              </span>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  background: `${getPriorityColor(customer.priority)}18`,
                  color: getPriorityColor(customer.priority),
                }}
              >
                {customer.priority}
              </span>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  background: `${getStatusColor(customer.status)}18`,
                  color: getStatusColor(customer.status),
                }}
              >
                {customer.status}
              </span>
              <span className="inline-flex items-center rounded-full bg-[#5B9BD5]/10 px-2.5 py-0.5 text-xs font-medium text-[#5B9BD5]">
                {customer.industry}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => { setNotesEdit(true); setNotesValue(customer.notes); }}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1E293B] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/5 active:scale-[0.98]"
          >
            <Pencil size={14} />
            Редактировать
          </button>
          <button
            onClick={handleArchive}
            disabled={customer.status === 'Архив'}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1E293B] px-4 py-2 text-sm font-medium text-[#94A3B8] transition-all hover:bg-white/5 disabled:opacity-30 active:scale-[0.98]"
          >
            <Archive size={14} />
            Архивировать
          </button>
          <button
            onClick={() => setDeleteConfirm(true)}
            className="flex items-center gap-2 rounded-lg bg-[#EF4444] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#DC2626] active:scale-[0.98]"
          >
            <Trash2 size={14} />
            Удалить
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="space-y-6 lg:col-span-1">
          {/* Contact Person */}
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5">
            <h3 className="mb-4 text-sm font-semibold text-white flex items-center gap-2">
              <User size={16} className="text-[#5B9BD5]" />
              Контактное лицо
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2E5BFF]/15 text-[#4A82FF] text-sm font-bold">
                  {customer.contactPerson.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{customer.contactPerson.name}</p>
                  <p className="text-xs text-[#94A3B8]">{customer.contactPerson.position}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Phone size={14} />
                <span>{customer.contactPerson.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Mail size={14} />
                <span>{customer.contactPerson.email}</span>
              </div>
            </div>
          </div>

          {/* LPR */}
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5">
            <h3 className="mb-4 text-sm font-semibold text-white flex items-center gap-2">
              <Briefcase size={16} className="text-[#FF7A2E]" />
              Лицо, принимающее решения
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FF7A2E]/15 text-[#FF7A2E] text-sm font-bold">
                  {customer.lpr.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{customer.lpr.name}</p>
                  <p className="text-xs text-[#94A3B8]">{customer.lpr.position}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Phone size={14} />
                <span>{customer.lpr.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Mail size={14} />
                <span>{customer.lpr.email}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Main Info */}
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">Основная информация</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs text-[#475569]">Отрасль</p>
                <p className="mt-1 text-sm text-white">{customer.industry}</p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Тип организации</p>
                <p className="mt-1 text-sm text-white">{customer.type}</p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Приоритет</p>
                <p className="mt-1 text-sm" style={{ color: getPriorityColor(customer.priority) }}>
                  {customer.priority}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Статус</p>
                <p className="mt-1 text-sm" style={{ color: getStatusColor(customer.status) }}>
                  {customer.status}
                </p>
              </div>
            </div>
          </div>

          {/* Project Requirements */}
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5">
            <h3 className="mb-4 text-sm font-semibold text-white flex items-center gap-2">
              <ClipboardList size={16} className="text-[#10B981]" />
              Требования к проектам
            </h3>
            <div className="mb-4 space-y-2">
              {customer.projectRequirements.length === 0 && (
                <p className="text-sm text-[#475569]">Нет требований</p>
              )}
              {customer.projectRequirements.map((req, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between rounded-lg bg-[#0F172A] px-3 py-2.5 text-sm text-[#94A3B8]"
                >
                  <span>{req}</span>
                  <button
                    onClick={() => handleRemoveRequirement(idx)}
                    className="text-[#475569] hover:text-[#EF4444] transition-colors"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newReq}
                onChange={(e) => setNewReq(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddRequirement()}
                placeholder="Новое требование..."
                className="flex-1 rounded-lg border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-white placeholder-[#475569] outline-none focus:border-[#2E5BFF] focus:ring-1 focus:ring-[#2E5BFF]/30"
              />
              <button
                onClick={handleAddRequirement}
                className="flex items-center gap-1.5 rounded-lg bg-[#2E5BFF] px-3 py-2 text-sm font-medium text-white transition-all hover:bg-[#2548CC] active:scale-[0.98]"
              >
                <Plus size={14} />
                Добавить
              </button>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Примечания</h3>
              {!notesEdit ? (
                <button
                  onClick={() => { setNotesEdit(true); setNotesValue(customer.notes); }}
                  className="text-xs text-[#2E5BFF] hover:underline"
                >
                  Редактировать
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleSaveNotes} className="flex items-center gap-1 rounded-md bg-[#10B981] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#059669]">
                    <Save size={12} /> Сохранить
                  </button>
                  <button onClick={() => setNotesEdit(false)} className="flex items-center gap-1 rounded-md bg-[#475569] px-2.5 py-1 text-xs font-medium text-white hover:bg-[#334155]">
                    <X size={12} /> Отмена
                  </button>
                </div>
              )}
            </div>
            {notesEdit ? (
              <textarea
                className="w-full min-h-[120px] rounded-lg border border-white/10 bg-[#0F172A] px-3 py-2 text-sm text-white placeholder-[#475569] outline-none focus:border-[#2E5BFF] resize-y"
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
              />
            ) : (
              <p className="text-sm leading-relaxed text-[#94A3B8]">
                {customer.notes || 'Нет примечаний.'}
              </p>
            )}
          </div>

          {/* History */}
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5">
            <h3 className="mb-4 text-sm font-semibold text-white">История изменений</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#10B981]" />
                <div>
                  <p className="text-white">Последнее обновление</p>
                  <p className="text-xs text-[#475569]">{new Date(customer.updatedAt).toLocaleString('ru-RU')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#2E5BFF]" />
                <div>
                  <p className="text-white">Создание записи</p>
                  <p className="text-xs text-[#475569]">{new Date(customer.createdAt).toLocaleString('ru-RU')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteConfirm && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setDeleteConfirm(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-[#1E293B] p-6 shadow-2xl"
          >
            <h2 className="mb-2 text-lg font-bold text-white">Подтверждение удаления</h2>
            <p className="mb-5 text-sm text-[#94A3B8]">
              Вы уверены, что хотите удалить <span className="font-medium text-white">"{customer.name}"</span>?
              Это действие нельзя отменить.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(false)}
                className="rounded-lg border border-white/10 bg-transparent px-4 py-2 text-sm font-medium text-[#94A3B8] transition-colors hover:bg-white/5"
              >
                Отмена
              </button>
              <button
                onClick={handleDelete}
                className="rounded-lg bg-[#EF4444] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#DC2626] active:scale-[0.98]"
              >
                Удалить
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
