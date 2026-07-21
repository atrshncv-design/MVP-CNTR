import { useState, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  GraduationCap,
  ArrowLeft,
  Pencil,
  Trash2,
  Archive,
  Phone,
  Mail,
  User,
  Briefcase,
  BarChart3,
  Save,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  getPerformerById,
  updatePerformer,
  deletePerformer,
  getPriorityColor,
  getStatusColor,
  getTypeColor,
} from '@/data/adminData';

export default function PerformerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [performer, setPerformer] = useState(() => getPerformerById(id || ''));
  const [notesEdit, setNotesEdit] = useState(false);
  const [notesValue, setNotesValue] = useState(performer?.notes || '');
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  if (!performer) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-[#94A3B8]">
        <GraduationCap size={48} className="mb-4 text-[#475569]" />
        <p className="text-lg">Исполнитель не найден</p>
        <Link to="/admin/performers" className="mt-4 text-[#2E5BFF] hover:underline">
          Вернуться к списку
        </Link>
      </div>
    );
  }

  const refresh = () => {
    const updated = getPerformerById(performer.id);
    if (updated) setPerformer(updated);
  };

  const handleSaveNotes = () => {
    updatePerformer(performer.id, { notes: notesValue });
    setNotesEdit(false);
    refresh();
  };

  const handleArchive = () => {
    updatePerformer(performer.id, { status: 'Архив' });
    refresh();
  };

  const handleDelete = () => {
    deletePerformer(performer.id);
    navigate('/admin/performers');
  };

  // UGT color
  const ugtColor = useMemo(() => {
    const colors: Record<number, string> = {
      1: '#2E5BFF', 2: '#3B6CFF', 3: '#4A82FF', 4: '#5B9BD5', 5: '#6AB0B5',
      6: '#7EC8A0', 7: '#A8D65A', 8: '#E5C840', 9: '#FF7A2E',
    };
    return colors[performer.currentUGT] || '#94A3B8';
  }, [performer.currentUGT]);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1.5 text-sm text-[#94A3B8]">
        <Link to="/admin" className="hover:text-white transition-colors">Дашборд</Link>
        <ChevronRight size={14} />
        <Link to="/admin/performers" className="hover:text-white transition-colors">Исполнители</Link>
        <ChevronRight size={14} />
        <span className="text-white truncate max-w-[300px]">{performer.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <button
            onClick={() => navigate('/admin/performers')}
            className="mt-1 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-[#94A3B8] transition-colors hover:bg-white/5 hover:text-white"
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">{performer.name}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span
                className="inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-medium text-white"
                style={{ background: getTypeColor(performer.type) }}
              >
                {performer.type}
              </span>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  background: `${getPriorityColor(performer.priority)}18`,
                  color: getPriorityColor(performer.priority),
                }}
              >
                {performer.priority}
              </span>
              <span
                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium"
                style={{
                  background: `${getStatusColor(performer.status)}18`,
                  color: getStatusColor(performer.status),
                }}
              >
                {performer.status}
              </span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => { setNotesEdit(true); setNotesValue(performer.notes); }}
            className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#1E293B] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-white/5 active:scale-[0.98]"
          >
            <Pencil size={14} />
            Редактировать
          </button>
          <button
            onClick={handleArchive}
            disabled={performer.status === 'Архив'}
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
          {/* UGT Progress */}
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 size={16} className="text-[#2E5BFF]" />
              <h3 className="text-sm font-semibold text-white">Уровень готовности технологии</h3>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold" style={{ color: ugtColor }}>
                УГТ {performer.currentUGT}
              </span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-[#0F172A]">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(performer.currentUGT / 9) * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full rounded-full"
                style={{ background: `linear-gradient(90deg, ${ugtColor}, ${ugtColor}88)` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-[#475569]">
              <span>УГТ 1</span>
              <span>УГТ 9</span>
            </div>
          </div>

          {/* Contact Person */}
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5">
            <h3 className="mb-4 text-sm font-semibold text-white flex items-center gap-2">
              <User size={16} className="text-[#5B9BD5]" />
              Контактное лицо
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2E5BFF]/15 text-[#4A82FF] text-sm font-bold">
                  {performer.contactPerson.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{performer.contactPerson.name}</p>
                  <p className="text-xs text-[#94A3B8]">{performer.contactPerson.position}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Phone size={14} />
                <span>{performer.contactPerson.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Mail size={14} />
                <span>{performer.contactPerson.email}</span>
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
                  {performer.lpr.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{performer.lpr.name}</p>
                  <p className="text-xs text-[#94A3B8]">{performer.lpr.position}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Phone size={14} />
                <span>{performer.lpr.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[#94A3B8]">
                <Mail size={14} />
                <span>{performer.lpr.email}</span>
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
                <p className="text-xs text-[#475569]">Направление</p>
                <p className="mt-1 text-sm text-white">{performer.direction}</p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Тип организации</p>
                <p className="mt-1 text-sm text-white">{performer.type}</p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Приоритет</p>
                <p className="mt-1 text-sm" style={{ color: getPriorityColor(performer.priority) }}>
                  {performer.priority}
                </p>
              </div>
              <div>
                <p className="text-xs text-[#475569]">Статус</p>
                <p className="mt-1 text-sm" style={{ color: getStatusColor(performer.status) }}>
                  {performer.status}
                </p>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-xl border border-white/10 bg-[#1E293B]/80 p-5">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Примечания</h3>
              {!notesEdit ? (
                <button
                  onClick={() => { setNotesEdit(true); setNotesValue(performer.notes); }}
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
                {performer.notes || 'Нет примечаний.'}
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
                  <p className="text-xs text-[#475569]">{new Date(performer.updatedAt).toLocaleString('ru-RU')}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <div className="mt-1 h-2 w-2 rounded-full bg-[#2E5BFF]" />
                <div>
                  <p className="text-white">Создание записи</p>
                  <p className="text-xs text-[#475569]">{new Date(performer.createdAt).toLocaleString('ru-RU')}</p>
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
              Вы уверены, что хотите удалить <span className="font-medium text-white">"{performer.name}"</span>?
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
